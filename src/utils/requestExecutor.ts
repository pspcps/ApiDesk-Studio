import { ApiRequest, ApiResponse, ScriptLogItem } from '../types';
import { runAssertions } from './assertionRunner';
import { resolveTemplateString, VariableContext } from './variableResolver';
import { runPreRequestScript, runPostResponseScript } from './scriptEngine';
import { getEffectiveRequest } from './environmentOverrideHelper';

export async function executeApiRequest(
  rawInputRequest: ApiRequest,
  variableContext: VariableContext,
  signal?: AbortSignal
): Promise<ApiResponse> {
  const startTime = Date.now();
  const allScriptLogs: ScriptLogItem[] = [];

  // Resolve environment-specific request overrides (custom body, params, headers, auth for the active environment)
  const activeEnvId = variableContext.activeEnvironment?.id || null;
  const request = getEffectiveRequest(rawInputRequest, activeEnvId);

  // 1. Run Pre-Request Script (if configured)
  const envList = variableContext.activeEnvironment?.variables 
    ? [...variableContext.activeEnvironment.variables] 
    : (variableContext.environment ? [...variableContext.environment] : []);
  const globList = variableContext.globalVariables 
    ? [...variableContext.globalVariables] 
    : (variableContext.globals ? [...variableContext.globals] : []);
  const colList = variableContext.collectionVariables 
    ? [...variableContext.collectionVariables] 
    : (variableContext.collection ? [...variableContext.collection] : undefined);

  const effectiveContext: VariableContext = {
    ...variableContext,
    environment: envList,
    globals: globList,
    collection: colList
  };

  const preScriptResult = runPreRequestScript(request.preRequestScript, request, effectiveContext);
  allScriptLogs.push(...preScriptResult.logs);

  // Apply environment variables updated in pre-request script
  if (Object.keys(preScriptResult.updatedEnvironmentVariables).length > 0) {
    for (const [k, v] of Object.entries(preScriptResult.updatedEnvironmentVariables)) {
      const idx = effectiveContext.environment!.findIndex(item => item.key === k);
      if (idx > -1) {
        effectiveContext.environment![idx] = { ...effectiveContext.environment![idx], value: v };
      } else {
        effectiveContext.environment!.push({
          id: 'dyn_env_' + Math.random().toString(36).substring(2, 9),
          key: k,
          value: v,
          enabled: true
        });
      }
    }
  }

  // Apply global variables updated in pre-request script
  if (Object.keys(preScriptResult.updatedGlobalVariables).length > 0) {
    for (const [k, v] of Object.entries(preScriptResult.updatedGlobalVariables)) {
      const idx = effectiveContext.globals!.findIndex(item => item.key === k);
      if (idx > -1) {
        effectiveContext.globals![idx] = { ...effectiveContext.globals![idx], value: v };
      } else {
        effectiveContext.globals!.push({
          id: 'dyn_g_' + Math.random().toString(36).substring(2, 9),
          key: k,
          value: v,
          enabled: true
        });
      }
    }
  }

  // 2. Resolve URL with variables
  const resolvedRawUrl = resolveTemplateString(request.url, effectiveContext);
  
  // 3. Build and resolve Query Parameters
  const activeParams = (request.params || []).filter(p => p.enabled && p.key);
  let finalUrl = resolvedRawUrl;
  const urlObj = parseOrFormatUrl(resolvedRawUrl);

  if (activeParams.length > 0 || Object.keys(preScriptResult.dynamicParams).length > 0) {
    for (const p of activeParams) {
      const resolvedKey = resolveTemplateString(p.key, effectiveContext);
      const resolvedVal = resolveTemplateString(p.value, effectiveContext);
      urlObj.searchParams.append(resolvedKey, resolvedVal);
    }
    for (const [k, v] of Object.entries(preScriptResult.dynamicParams)) {
      urlObj.searchParams.append(k, v);
    }
    finalUrl = urlObj.toString();
  }

  // 4. Resolve Headers
  const resolvedHeaders: Record<string, string> = {};
  for (const h of (request.headers || [])) {
    if (h.enabled && h.key) {
      const resolvedKey = resolveTemplateString(h.key, effectiveContext);
      const resolvedVal = resolveTemplateString(h.value, effectiveContext);
      resolvedHeaders[resolvedKey] = resolvedVal;
    }
  }

  // Apply dynamic headers from pre-request script
  for (const [k, v] of Object.entries(preScriptResult.dynamicHeaders)) {
    resolvedHeaders[k] = v;
  }

  // 5. Resolve Auth
  if (request.auth) {
    if (request.auth.type === 'bearer' && request.auth.bearerToken) {
      const token = resolveTemplateString(request.auth.bearerToken, effectiveContext);
      resolvedHeaders['Authorization'] = `Bearer ${token}`;
    } else if (request.auth.type === 'basic') {
      const u = resolveTemplateString(request.auth.basicUser || '', effectiveContext);
      const p = resolveTemplateString(request.auth.basicPass || '', effectiveContext);
      resolvedHeaders['Authorization'] = `Basic ${btoa(`${u}:${p}`)}`;
    } else if (request.auth.type === 'apikey' && request.auth.apiKeyName && request.auth.apiKeyValue) {
      const keyName = resolveTemplateString(request.auth.apiKeyName, effectiveContext);
      const keyVal = resolveTemplateString(request.auth.apiKeyValue, effectiveContext);
      if (request.auth.apiKeyLocation === 'query') {
        const uObj = parseOrFormatUrl(finalUrl);
        uObj.searchParams.append(keyName, keyVal);
        finalUrl = uObj.toString();
      } else {
        resolvedHeaders[keyName] = keyVal;
      }
    } else if (request.auth.type === 'oauth2' && request.auth.oauthToken) {
      const prefix = request.auth.oauthHeaderPrefix || 'Bearer';
      const token = resolveTemplateString(request.auth.oauthToken, effectiveContext);
      resolvedHeaders['Authorization'] = `${prefix} ${token}`;
    }
  }

  // 6. Prepare and resolve Body
  let resolvedBody: any = undefined;
  const upperMethod = request.method.toUpperCase();
  const canSendBody = upperMethod !== 'GET' && upperMethod !== 'HEAD';

  if (canSendBody && request.body && request.body.type !== 'none') {
    if (request.body.type === 'json' && request.body.json) {
      const resolvedJsonStr = resolveTemplateString(request.body.json, effectiveContext);
      try {
        resolvedBody = JSON.parse(resolvedJsonStr);
      } catch {
        resolvedBody = resolvedJsonStr;
      }
      if (!Object.keys(resolvedHeaders).some(k => k.toLowerCase() === 'content-type')) {
        resolvedHeaders['Content-Type'] = 'application/json';
      }
    } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
      const formObj: Record<string, string> = {};
      for (const p of request.body.urlencoded.filter(x => x.enabled && x.key)) {
        formObj[resolveTemplateString(p.key, effectiveContext)] = resolveTemplateString(p.value, effectiveContext);
      }
      resolvedBody = formObj;
      if (!Object.keys(resolvedHeaders).some(k => k.toLowerCase() === 'content-type')) {
        resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (request.body.type === 'raw' && request.body.raw) {
      resolvedBody = resolveTemplateString(request.body.raw, effectiveContext);
    } else if (request.body.type === 'graphql' && request.body.graphqlQuery) {
      const query = resolveTemplateString(request.body.graphqlQuery, effectiveContext);
      let variables = {};
      if (request.body.graphqlVariables) {
        try {
          variables = JSON.parse(resolveTemplateString(request.body.graphqlVariables, effectiveContext));
        } catch {
          // ignore
        }
      }
      resolvedBody = { query, variables };
      if (!Object.keys(resolvedHeaders).some(k => k.toLowerCase() === 'content-type')) {
        resolvedHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  // 7. Execute Request via Backend Proxy or Direct Fetch
  const useProxy = request.settings.proxyMode !== false;
  let rawResponse: ApiResponse;

  if (useProxy) {
    try {
      let targetUrl = finalUrl;
      if (targetUrl.startsWith('/')) {
        targetUrl = window.location.origin + targetUrl;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: targetUrl,
          method: request.method,
          headers: resolvedHeaders,
          body: resolvedBody,
          bodyType: request.body.type,
          timeout: request.settings.timeout || 30000
        }),
        signal
      });

      const proxyData = await proxyRes.json();
      rawResponse = proxyData;
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      rawResponse = {
        ok: false,
        status: 0,
        statusText: 'Proxy Request Failed',
        headers: {},
        data: {
          error: err.message || 'Failed to connect to local API proxy server.',
          detail: 'Check network connectivity or backend console.'
        },
        isJson: true,
        isBinary: false,
        contentType: 'application/json',
        sizeBytes: 0,
        timeMs: elapsed,
        timing: { dns: 0, tcp: 0, ttfb: 0, download: 0, total: elapsed },
        timestamp: Date.now()
      };
    }
  } else {
    // Direct browser fetch
    try {
      const fetchHeaders: Record<string, string> = { ...resolvedHeaders };
      let fetchBody: any = undefined;
      if (canSendBody && resolvedBody !== undefined) {
        if (request.body.type === 'x-www-form-urlencoded' || (request.body as any).type === 'urlencoded') {
          if (typeof resolvedBody === 'object' && resolvedBody !== null) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(resolvedBody)) {
              params.append(k, String(v));
            }
            fetchBody = params.toString();
          } else {
            fetchBody = String(resolvedBody || '');
          }
          if (!Object.keys(fetchHeaders).some(h => h.toLowerCase() === 'content-type')) {
            fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          }
        } else if (typeof resolvedBody === 'object' && !(resolvedBody instanceof FormData)) {
          fetchBody = JSON.stringify(resolvedBody);
        } else {
          fetchBody = resolvedBody;
        }
      }

      const directRes = await fetch(finalUrl, {
        method: request.method,
        headers: fetchHeaders,
        body: fetchBody,
        redirect: request.settings.followRedirects ? 'follow' : 'manual',
        signal
      });

      const elapsed = Date.now() - startTime;
      const resHeaders: Record<string, string> = {};
      directRes.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const contentType = directRes.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const text = await directRes.text();
      let responseData: any = text;
      if (isJson) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      rawResponse = {
        ok: directRes.ok,
        status: directRes.status,
        statusText: directRes.statusText,
        headers: resHeaders,
        data: responseData,
        isJson,
        isBinary: false,
        contentType,
        sizeBytes: new Blob([text]).size,
        timeMs: elapsed,
        timing: { dns: 5, tcp: 10, ttfb: elapsed - 5, download: 5, total: elapsed },
        timestamp: Date.now()
      };
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      rawResponse = {
        ok: false,
        status: 0,
        statusText: 'CORS or Network Error (Try enabling Proxy mode in request settings)',
        headers: {},
        data: {
          error: err.message || 'Direct browser fetch blocked by CORS or Network error.',
          tip: 'Tip: Enable "Backend Proxy" in request settings to test any public or private URL without CORS restrictions.'
        },
        isJson: true,
        isBinary: false,
        contentType: 'application/json',
        sizeBytes: 0,
        timeMs: elapsed,
        timing: { dns: 0, tcp: 0, ttfb: 0, download: 0, total: elapsed },
        timestamp: Date.now()
      };
    }
  }

  // 8. Run Post-Response / Test JavaScript Scripts (pm.test, pm.expect, pm.environment.set)
  const postScriptResult = runPostResponseScript(request.postResponseScript, request, rawResponse, effectiveContext);
  allScriptLogs.push(...postScriptResult.logs);

  // 9. Run Visual Test Assertions and Extractions
  const { testResults: uiTestResults, savedVariables: uiSavedVariables } = runAssertions(request, rawResponse);

  // Combine results
  const combinedTestResults = [...(postScriptResult.testResults || []), ...uiTestResults];
  const combinedSavedVariables = {
    ...preScriptResult.updatedEnvironmentVariables,
    ...postScriptResult.updatedEnvironmentVariables,
    ...uiSavedVariables
  };

  rawResponse.testResults = combinedTestResults;
  rawResponse.savedVariables = combinedSavedVariables;
  rawResponse.scriptLogs = allScriptLogs;

  return rawResponse;
}

function parseOrFormatUrl(rawUrl: string): URL {
  try {
    if (rawUrl.startsWith('/')) {
      return new URL(window.location.origin + rawUrl);
    }
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      return new URL('https://' + rawUrl);
    }
    return new URL(rawUrl);
  } catch {
    return new URL(window.location.origin);
  }
}
