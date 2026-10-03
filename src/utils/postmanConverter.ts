import { ApiRequest, Collection, Environment, Folder, HttpMethod, KeyValuePair } from '../types';

// Postman v2.1.0 Collection Exporter
export function exportPostmanCollection(collection: Collection): any {
  const items = convertCollectionToPostmanItems(collection);

  return {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: items,
    variable: (collection.variables || []).map(v => ({
      key: v.key,
      value: v.value,
      type: 'string'
    }))
  };
}

function convertCollectionToPostmanItems(collection: Collection): any[] {
  const result: any[] = [];
  const folderMap = new Map<string, any>();

  // Create folders
  for (const folder of collection.folders) {
    const postmanFolder = {
      id: folder.id,
      name: folder.name,
      description: folder.description || '',
      item: [] as any[]
    };
    folderMap.set(folder.id, postmanFolder);
  }

  // Assign requests to folders or root
  for (const req of collection.requests) {
    const postmanReq = convertApiRequestToPostman(req);
    if (req.folderId && folderMap.has(req.folderId)) {
      folderMap.get(req.folderId).item.push(postmanReq);
    } else {
      result.push(postmanReq);
    }
  }

  // Link sub-folders or push to root
  for (const folder of collection.folders) {
    const postmanFolder = folderMap.get(folder.id);
    if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
      folderMap.get(folder.parentFolderId).item.push(postmanFolder);
    } else {
      result.push(postmanFolder);
    }
  }

  return result;
}

function convertApiRequestToPostman(req: ApiRequest): any {
  const urlObj: any = {
    raw: req.url,
    query: req.params.map(p => ({
      key: p.key,
      value: p.value,
      disabled: !p.enabled,
      description: p.description
    }))
  };

  try {
    const parsed = new URL(req.url);
    urlObj.protocol = parsed.protocol.replace(':', '');
    urlObj.host = parsed.host.split('.');
    urlObj.path = parsed.pathname.split('/').filter(Boolean);
  } catch {
    // Keep raw
  }

  let bodyObj: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body.type !== 'none') {
    if (req.body.type === 'json') {
      bodyObj = {
        mode: 'raw',
        raw: req.body.json || '',
        options: {
          raw: { language: 'json' }
        }
      };
    } else if (req.body.type === 'x-www-form-urlencoded') {
      bodyObj = {
        mode: 'urlencoded',
        urlencoded: (req.body.urlencoded || []).map(p => ({
          key: p.key,
          value: p.value,
          disabled: !p.enabled
        }))
      };
    } else if (req.body.type === 'form-data') {
      bodyObj = {
        mode: 'formdata',
        formdata: (req.body.formData || []).map(p => ({
          key: p.key,
          value: p.value,
          disabled: !p.enabled,
          type: p.type === 'file' ? 'file' : 'text'
        }))
      };
    } else if (req.body.type === 'graphql') {
      bodyObj = {
        mode: 'graphql',
        graphql: {
          query: req.body.graphqlQuery || '',
          variables: req.body.graphqlVariables || ''
        }
      };
    } else if (req.body.type === 'raw') {
      bodyObj = {
        mode: 'raw',
        raw: req.body.raw || '',
        options: {
          raw: { language: req.body.rawType || 'text' }
        }
      };
    }
  }

  let authObj: any = undefined;
  if (req.auth.type === 'bearer' && req.auth.bearerToken) {
    authObj = {
      type: 'bearer',
      bearer: [{ key: 'token', value: req.auth.bearerToken, type: 'string' }]
    };
  } else if (req.auth.type === 'basic') {
    authObj = {
      type: 'basic',
      basic: [
        { key: 'username', value: req.auth.basicUser || '', type: 'string' },
        { key: 'password', value: req.auth.basicPass || '', type: 'string' }
      ]
    };
  } else if (req.auth.type === 'apikey') {
    authObj = {
      type: 'apikey',
      apikey: [
        { key: 'key', value: req.auth.apiKeyName || '', type: 'string' },
        { key: 'value', value: req.auth.apiKeyValue || '', type: 'string' },
        { key: 'in', value: req.auth.apiKeyLocation || 'header', type: 'string' }
      ]
    };
  }

  return {
    id: req.id,
    name: req.name || `${req.method} ${req.url}`,
    request: {
      method: req.method,
      header: req.headers.map(h => ({
        key: h.key,
        value: h.value,
        disabled: !h.enabled,
        description: h.description
      })),
      body: bodyObj,
      url: urlObj,
      auth: authObj,
      description: req.description || ''
    }
  };
}

// Postman v2.1.0 Collection Importer
export function importPostmanCollection(json: any): Collection {
  const colId = json.info?._postman_id || 'col_' + Math.random().toString(36).substring(2, 9);
  const name = json.info?.name || 'Imported Collection';
  const description = json.info?.description || '';

  const variables: KeyValuePair[] = (json.variable || []).map((v: any) => ({
    id: 'var_' + Math.random().toString(36).substring(2, 9),
    key: v.key || '',
    value: String(v.value || ''),
    description: v.description || '',
    enabled: !v.disabled
  }));

  const folders: Folder[] = [];
  const requests: ApiRequest[] = [];

  function traverseItems(items: any[], currentFolderId?: string) {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      if (Array.isArray(item.item)) {
        // It's a folder
        const folderId = item.id || 'fld_' + Math.random().toString(36).substring(2, 9);
        folders.push({
          id: folderId,
          name: item.name || 'Folder',
          collectionId: colId,
          parentFolderId: currentFolderId,
          description: item.description || ''
        });
        traverseItems(item.item, folderId);
      } else if (item.request) {
        // It's a request
        const req = parsePostmanRequestItem(item, colId, currentFolderId);
        requests.push(req);
      }
    }
  }

  traverseItems(json.item || []);

  return {
    id: colId,
    name,
    description,
    variables,
    folders,
    requests,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function parsePostmanRequestItem(item: any, collectionId: string, folderId?: string): ApiRequest {
  const pReq = item.request || {};
  const method = (typeof pReq === 'string' ? 'GET' : pReq.method || 'GET').toUpperCase() as HttpMethod;
  
  let rawUrl = '';
  const params: KeyValuePair[] = [];

  if (typeof pReq === 'string') {
    rawUrl = pReq;
  } else if (typeof pReq.url === 'string') {
    rawUrl = pReq.url;
  } else if (pReq.url && typeof pReq.url === 'object') {
    rawUrl = pReq.url.raw || '';
    if (Array.isArray(pReq.url.query)) {
      for (const q of pReq.url.query) {
        params.push({
          id: 'p_' + Math.random().toString(36).substring(2, 9),
          key: q.key || '',
          value: String(q.value || ''),
          description: q.description || '',
          enabled: !q.disabled
        });
      }
    }
  }

  // Headers
  const headers: KeyValuePair[] = [];
  if (Array.isArray(pReq.header)) {
    for (const h of pReq.header) {
      headers.push({
        id: 'h_' + Math.random().toString(36).substring(2, 9),
        key: h.key || '',
        value: String(h.value || ''),
        description: h.description || '',
        enabled: !h.disabled
      });
    }
  }

  // Body
  let bodyType: any = 'none';
  let jsonBody = '';
  let rawBody = '';
  let urlencoded: KeyValuePair[] = [];
  let formData: KeyValuePair[] = [];
  let gqlQuery = '';
  let gqlVars = '';

  if (pReq.body) {
    const mode = pReq.body.mode;
    if (mode === 'raw') {
      const rawText = pReq.body.raw || '';
      try {
        JSON.parse(rawText);
        bodyType = 'json';
        jsonBody = rawText;
      } catch {
        bodyType = 'raw';
        rawBody = rawText;
      }
    } else if (mode === 'urlencoded') {
      bodyType = 'x-www-form-urlencoded';
      if (Array.isArray(pReq.body.urlencoded)) {
        urlencoded = pReq.body.urlencoded.map((p: any) => ({
          id: 'u_' + Math.random().toString(36).substring(2, 9),
          key: p.key || '',
          value: String(p.value || ''),
          enabled: !p.disabled
        }));
      }
    } else if (mode === 'formdata') {
      bodyType = 'form-data';
      if (Array.isArray(pReq.body.formdata)) {
        formData = pReq.body.formdata.map((p: any) => ({
          id: 'fd_' + Math.random().toString(36).substring(2, 9),
          key: p.key || '',
          value: String(p.value || ''),
          type: p.type === 'file' ? 'file' : 'text',
          enabled: !p.disabled
        }));
      }
    } else if (mode === 'graphql') {
      bodyType = 'graphql';
      gqlQuery = pReq.body.graphql?.query || '';
      gqlVars = pReq.body.graphql?.variables || '';
    }
  }

  // Auth
  let authType: any = 'none';
  let bearerToken = '';
  let basicUser = '';
  let basicPass = '';
  let apiKeyName = '';
  let apiKeyValue = '';
  let apiKeyLocation: any = 'header';

  if (pReq.auth) {
    const aType = pReq.auth.type;
    if (aType === 'bearer' && Array.isArray(pReq.auth.bearer)) {
      authType = 'bearer';
      const tokenObj = pReq.auth.bearer.find((b: any) => b.key === 'token');
      bearerToken = tokenObj ? String(tokenObj.value || '') : '';
    } else if (aType === 'basic' && Array.isArray(pReq.auth.basic)) {
      authType = 'basic';
      const uObj = pReq.auth.basic.find((b: any) => b.key === 'username');
      const pObj = pReq.auth.basic.find((b: any) => b.key === 'password');
      basicUser = uObj ? String(uObj.value || '') : '';
      basicPass = pObj ? String(pObj.value || '') : '';
    } else if (aType === 'apikey' && Array.isArray(pReq.auth.apikey)) {
      authType = 'apikey';
      const kObj = pReq.auth.apikey.find((b: any) => b.key === 'key');
      const vObj = pReq.auth.apikey.find((b: any) => b.key === 'value');
      const inObj = pReq.auth.apikey.find((b: any) => b.key === 'in');
      apiKeyName = kObj ? String(kObj.value || '') : '';
      apiKeyValue = vObj ? String(vObj.value || '') : '';
      apiKeyLocation = inObj && inObj.value === 'query' ? 'query' : 'header';
    }
  }

  return {
    id: item.id || 'req_' + Math.random().toString(36).substring(2, 9),
    name: item.name || `${method} ${rawUrl}`,
    description: pReq.description || '',
    method,
    url: rawUrl,
    params,
    headers,
    auth: {
      type: authType,
      bearerToken,
      basicUser,
      basicPass,
      apiKeyName,
      apiKeyValue,
      apiKeyLocation
    },
    body: {
      type: bodyType,
      rawType: 'json',
      json: jsonBody,
      raw: rawBody,
      urlencoded,
      formData,
      graphqlQuery: gqlQuery,
      graphqlVariables: gqlVars
    },
    tests: [],
    extractions: [],
    collectionId,
    folderId,
    settings: {
      timeout: 30000,
      followRedirects: true,
      proxyMode: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// OpenAPI 3.0 / Swagger Importer
export function importOpenApiSpec(spec: any): Collection {
  const title = spec.info?.title || 'OpenAPI Imported API';
  const colId = 'col_' + Math.random().toString(36).substring(2, 9);
  const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';

  const requests: ApiRequest[] = [];
  const folders: Folder[] = [];
  const tagsSet = new Set<string>();

  const paths = spec.paths || {};
  for (const [pathUrl, pathMethods] of Object.entries<any>(paths)) {
    for (const [methodKey, endpoint] of Object.entries<any>(pathMethods)) {
      const upperMethod = methodKey.toUpperCase() as HttpMethod;
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
        continue;
      }

      const tag = endpoint.tags?.[0] || 'Default';
      tagsSet.add(tag);

      const reqId = 'req_' + Math.random().toString(36).substring(2, 9);
      const fullUrl = `${baseUrl}${pathUrl}`;

      const params: KeyValuePair[] = [];
      const headers: KeyValuePair[] = [];

      if (Array.isArray(endpoint.parameters)) {
        for (const p of endpoint.parameters) {
          if (p.in === 'query') {
            params.push({
              id: 'p_' + Math.random().toString(36).substring(2, 9),
              key: p.name,
              value: p.schema?.default || p.example || '',
              description: p.description || '',
              enabled: !!p.required
            });
          } else if (p.in === 'header') {
            headers.push({
              id: 'h_' + Math.random().toString(36).substring(2, 9),
              key: p.name,
              value: p.schema?.default || p.example || '',
              description: p.description || '',
              enabled: !!p.required
            });
          }
        }
      }

      // Sample Body
      let bodyType: any = 'none';
      let jsonBody = '';
      if (endpoint.requestBody?.content?.['application/json']) {
        bodyType = 'json';
        headers.push({
          id: 'h_' + Math.random().toString(36).substring(2, 9),
          key: 'Content-Type',
          value: 'application/json',
          enabled: true
        });
        const example = endpoint.requestBody.content['application/json'].example;
        if (example) {
          jsonBody = JSON.stringify(example, null, 2);
        } else {
          jsonBody = '{\n  \n}';
        }
      }

      requests.push({
        id: reqId,
        name: endpoint.summary || endpoint.operationId || `${upperMethod} ${pathUrl}`,
        description: endpoint.description || '',
        method: upperMethod,
        url: fullUrl,
        params,
        headers,
        auth: { type: 'none' },
        body: {
          type: bodyType,
          rawType: 'json',
          json: jsonBody
        },
        tests: [
          {
            id: 't_200',
            name: 'Status code is 200/201',
            type: 'status_code',
            targetValue: '200',
            enabled: true
          }
        ],
        extractions: [],
        collectionId: colId,
        folderId: tag,
        settings: {
          timeout: 30000,
          followRedirects: true,
          proxyMode: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  }

  for (const tag of tagsSet) {
    folders.push({
      id: tag,
      name: tag,
      collectionId: colId
    });
  }

  return {
    id: colId,
    name: title,
    description: spec.info?.description || 'Imported from OpenAPI specification',
    variables: [
      {
        id: 'var_base',
        key: 'baseUrl',
        value: baseUrl,
        enabled: true
      }
    ],
    folders,
    requests,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Team Workspace Full Export / Import Bundle
export interface TeamWorkspaceBundle {
  version: '1.0';
  exportedAt: number;
  type: 'workspace_export' | 'collection_export' | 'environment_export';
  collections: Collection[];
  environments: Environment[];
  globalVariables: KeyValuePair[];
}

export function exportTeamWorkspace(collections: Collection[], environments: Environment[], globalVariables: KeyValuePair[]): TeamWorkspaceBundle {
  return {
    version: '1.0',
    exportedAt: Date.now(),
    type: 'workspace_export',
    collections,
    environments,
    globalVariables
  };
}

export function parseTeamImport(data: any): { collections: Collection[]; environments: Environment[]; globalVariables: KeyValuePair[] } {
  // If it is a Postman collection
  if (data.info && (data.info.schema?.includes('postman') || Array.isArray(data.item))) {
    const col = importPostmanCollection(data);
    return {
      collections: [col],
      environments: [],
      globalVariables: []
    };
  }

  // If it is OpenAPI
  if (data.openapi || data.swagger) {
    const col = importOpenApiSpec(data);
    return {
      collections: [col],
      environments: [],
      globalVariables: []
    };
  }

  // If it is a single native collection
  if (data.id && data.requests && Array.isArray(data.requests)) {
    return {
      collections: [data as Collection],
      environments: [],
      globalVariables: []
    };
  }

  // If it is our native workspace bundle
  if (data.type === 'workspace_export' || Array.isArray(data.collections)) {
    return {
      collections: Array.isArray(data.collections) ? data.collections : [],
      environments: Array.isArray(data.environments) ? data.environments : [],
      globalVariables: Array.isArray(data.globalVariables) ? data.globalVariables : []
    };
  }

  throw new Error('Unsupported JSON file format. Please provide a Postman Collection v2.1, OpenAPI JSON, or Native Workspace Export.');
}
