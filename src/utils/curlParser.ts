import { ApiRequest, HttpMethod, KeyValuePair } from '../types';

export function isCurlCommand(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  return (
    trimmed.startsWith('curl ') ||
    trimmed.startsWith('curl\n') ||
    trimmed.startsWith('curl\r\n') ||
    trimmed.startsWith('curl\t') ||
    trimmed.startsWith('curl\\') ||
    trimmed.startsWith('$ curl') ||
    /^curl[\s\\]/i.test(trimmed) ||
    /^\$\s*curl[\s\\]/i.test(trimmed)
  );
}

/**
 * Robust shell/curl argument tokenizer that respects:
 * - Line continuation with backslash (\ + newline)
 * - Single quotes '...' (literal content preserved without escapes)
 * - Double quotes "..." (supports \" and \\ escapes)
 * - ANSI-C quotes $'...'
 * - Key=Value formats (e.g. --data='...', -H='...')
 */
export function tokenizeCurl(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inAnsiC = false;
  let escaped = false;

  let cleanCmd = cmd.trim();
  if (cleanCmd.startsWith('$')) {
    cleanCmd = cleanCmd.substring(1).trim();
  }

  for (let i = 0; i < cleanCmd.length; i++) {
    const c = cleanCmd[i];
    const next = cleanCmd[i + 1];

    if (escaped) {
      if (c === '\n' || c === '\r') {
        // Line continuation: \ followed by \n or \r\n
        if (c === '\r' && next === '\n') {
          i++; // skip \r\n
        }
        escaped = false;
        continue;
      } else if (c === ' ' || c === '\t') {
        // Trailing whitespace after \ before newline
        // Check if there is a newline coming up
        let lookAhead = i + 1;
        while (lookAhead < cleanCmd.length && (cleanCmd[lookAhead] === ' ' || cleanCmd[lookAhead] === '\t')) {
          lookAhead++;
        }
        if (lookAhead < cleanCmd.length && (cleanCmd[lookAhead] === '\n' || cleanCmd[lookAhead] === '\r')) {
          i = lookAhead;
          if (cleanCmd[i] === '\r' && cleanCmd[i + 1] === '\n') {
            i++;
          }
          escaped = false;
          continue;
        }
      }
      current += c;
      escaped = false;
      continue;
    }

    if (c === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    // ANSI-C $'...' string literals
    if (c === '$' && next === "'" && !inSingle && !inDouble) {
      inAnsiC = true;
      i++;
      continue;
    }

    if (c === "'" && !inDouble) {
      if (inAnsiC) {
        inAnsiC = false;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (c === '"' && !inSingle && !inAnsiC) {
      inDouble = !inDouble;
      continue;
    }

    if ((c === ' ' || c === '\t' || c === '\n' || c === '\r') && !inSingle && !inDouble && !inAnsiC) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += c;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  // Filter out any stray line-continuation backslash tokens
  return tokens.filter(t => t !== '\\');
}

export function parseCurlCommand(rawInput: string): Partial<ApiRequest> | null {
  if (!rawInput) return null;
  const input = rawInput.trim();
  if (!isCurlCommand(input)) return null;

  const tokens = tokenizeCurl(input);

  // Remove leading 'curl' token
  if (tokens.length > 0 && tokens[0].toLowerCase() === 'curl') {
    tokens.shift();
  }

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValuePair[] = [];
  let bodyData = '';
  let isUrlEncoded = false;
  let isJsonExplicit = false;
  let basicAuthUser = '';
  let basicAuthPass = '';
  let bearerToken = '';
  const formDataList: KeyValuePair[] = [];
  const urlencodedList: KeyValuePair[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    // Method: -X, --request or -X=POST, --request=POST
    if (token === '-X' || token === '--request') {
      if (nextToken) {
        const upper = nextToken.toUpperCase() as HttpMethod;
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(upper)) {
          method = upper;
        }
        i++;
      }
    } else if (token.startsWith('-X=') || token.startsWith('--request=')) {
      const val = token.substring(token.indexOf('=') + 1).toUpperCase() as HttpMethod;
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(val)) {
        method = val;
      }
    }
    // Headers: -H, --header or -H=..., --header=...
    else if (token === '-H' || token === '--header') {
      if (nextToken !== undefined) {
        processHeader(nextToken);
        i++;
      }
    } else if (token.startsWith('-H=') || token.startsWith('--header=')) {
      processHeader(token.substring(token.indexOf('=') + 1));
    }
    // Data/Body: -d, --data, --data-raw, --data-binary, --data-ascii or =...
    else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-ascii') {
      if (nextToken !== undefined) {
        bodyData = nextToken;
        if (method === 'GET') {
          method = 'POST'; // curl defaults to POST when data is provided
        }
        i++;
      }
    } else if (
      token.startsWith('-d=') ||
      token.startsWith('--data=') ||
      token.startsWith('--data-raw=') ||
      token.startsWith('--data-binary=') ||
      token.startsWith('--data-ascii=')
    ) {
      bodyData = token.substring(token.indexOf('=') + 1);
      if (method === 'GET') {
        method = 'POST';
      }
    }
    // Modern --json flag (sets Content-Type: application/json & defaults to POST)
    else if (token === '--json') {
      if (nextToken !== undefined) {
        bodyData = nextToken;
        isJsonExplicit = true;
        if (method === 'GET') method = 'POST';
        i++;
      }
    } else if (token.startsWith('--json=')) {
      bodyData = token.substring(token.indexOf('=') + 1);
      isJsonExplicit = true;
      if (method === 'GET') method = 'POST';
    }
    // Form data: -F, --form
    else if (token === '-F' || token === '--form') {
      if (nextToken !== undefined) {
        const eqIdx = nextToken.indexOf('=');
        if (eqIdx > -1) {
          const k = nextToken.substring(0, eqIdx);
          const v = nextToken.substring(eqIdx + 1);
          formDataList.push({
            id: 'fd_' + Math.random().toString(36).substring(2, 9),
            key: k,
            value: v,
            enabled: true
          });
        }
        if (method === 'GET') method = 'POST';
        i++;
      }
    }
    // URL-encoded data: --data-urlencode
    else if (token === '--data-urlencode') {
      if (nextToken !== undefined) {
        isUrlEncoded = true;
        parseUrlEncodedToken(nextToken);
        if (method === 'GET') method = 'POST';
        i++;
      }
    } else if (token.startsWith('--data-urlencode=')) {
      const val = token.substring(token.indexOf('=') + 1);
      isUrlEncoded = true;
      parseUrlEncodedToken(val);
      if (method === 'GET') method = 'POST';
    }
    // Basic Auth: -u, --user
    else if (token === '-u' || token === '--user') {
      if (nextToken) {
        const parts = nextToken.split(':');
        basicAuthUser = parts[0] || '';
        basicAuthPass = parts.slice(1).join(':') || '';
        i++;
      }
    } else if (token.startsWith('-u=') || token.startsWith('--user=')) {
      const val = token.substring(token.indexOf('=') + 1);
      const parts = val.split(':');
      basicAuthUser = parts[0] || '';
      basicAuthPass = parts.slice(1).join(':') || '';
    }
    // User Agent: -A, --user-agent
    else if (token === '-A' || token === '--user-agent') {
      if (nextToken) {
        headers.push({
          id: 'h_' + Math.random().toString(36).substring(2, 9),
          key: 'User-Agent',
          value: nextToken,
          enabled: true
        });
        i++;
      }
    }
    // Explicit URL flag: --url
    else if (token === '--url') {
      if (nextToken) {
        url = nextToken.replace(/^['"]|['"]$/g, '');
        i++;
      }
    } else if (token.startsWith('--url=')) {
      url = token.substring(token.indexOf('=') + 1).replace(/^['"]|['"]$/g, '');
    }
    // Common flags without values (skip safely)
    else if (
      token === '--location' ||
      token === '-L' ||
      token === '--location-trusted' ||
      token === '-k' ||
      token === '--insecure' ||
      token === '-s' ||
      token === '--silent' ||
      token === '-S' ||
      token === '--show-error' ||
      token === '-v' ||
      token === '--verbose' ||
      token === '-i' ||
      token === '--include' ||
      token === '-g' ||
      token === '--globoff' ||
      token === '--compressed'
    ) {
      continue;
    }
    // Bare URL (non-flag argument)
    else if (!token.startsWith('-') && !url) {
      url = token.replace(/^['"]|['"]$/g, '');
    }
  }

  function parseUrlEncodedToken(tokenVal: string) {
    const eqIdx = tokenVal.indexOf('=');
    if (eqIdx > -1) {
      const k = tokenVal.substring(0, eqIdx);
      const v = tokenVal.substring(eqIdx + 1);
      urlencodedList.push({
        id: 'u_' + Math.random().toString(36).substring(2, 9),
        key: k,
        value: v,
        enabled: true
      });
    } else {
      urlencodedList.push({
        id: 'u_' + Math.random().toString(36).substring(2, 9),
        key: tokenVal,
        value: '',
        enabled: true
      });
    }
  }

  function processHeader(headerStr: string) {
    const colonIdx = headerStr.indexOf(':');
    if (colonIdx > -1) {
      const key = headerStr.substring(0, colonIdx).trim();
      const val = headerStr.substring(colonIdx + 1).trim();

      if (key.toLowerCase() === 'authorization') {
        if (val.toLowerCase().startsWith('bearer ')) {
          bearerToken = val.substring(7).trim();
        } else if (val.toLowerCase().startsWith('basic ')) {
          try {
            const decoded = atob(val.substring(6).trim());
            const [u, p] = decoded.split(':');
            basicAuthUser = u || '';
            basicAuthPass = p || '';
          } catch {
            // Keep in headers if base64 decode fails
          }
        }
      }

      headers.push({
        id: 'h_' + Math.random().toString(36).substring(2, 9),
        key,
        value: val,
        enabled: true
      });
    }
  }

  // If --json was specified, ensure Content-Type is present
  if (isJsonExplicit) {
    const hasCt = headers.some(h => h.key.toLowerCase() === 'content-type');
    if (!hasCt) {
      headers.push({
        id: 'h_' + Math.random().toString(36).substring(2, 9),
        key: 'Content-Type',
        value: 'application/json',
        enabled: true
      });
    }
  }

  // Parse URL query params
  const params: KeyValuePair[] = [];
  let cleanUrl = url;
  if (url && url.includes('?')) {
    const qIndex = url.indexOf('?');
    cleanUrl = url.substring(0, qIndex);
    const queryString = url.substring(qIndex + 1);
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params.push({
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        key,
        value,
        enabled: true
      });
    });
  }

  // Determine Body format
  let bodyType: any = 'none';
  let jsonBody = '';
  let rawBody = '';
  let finalUrlencoded: KeyValuePair[] = [];

  if (urlencodedList.length > 0) {
    bodyType = 'x-www-form-urlencoded';
    finalUrlencoded = urlencodedList;
  } else if (formDataList.length > 0) {
    bodyType = 'form-data';
  } else if (bodyData) {
    const hasJsonHeader = isJsonExplicit || headers.some(h => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('application/json'));

    // Try parsing as JSON first
    let parsedJson = false;
    try {
      const parsed = JSON.parse(bodyData);
      jsonBody = JSON.stringify(parsed, null, 2);
      bodyType = 'json';
      parsedJson = true;
    } catch {
      // Not valid strict JSON, check if headers indicate JSON
      if (hasJsonHeader) {
        bodyType = 'json';
        jsonBody = bodyData;
        parsedJson = true;
      }
    }

    if (!parsedJson) {
      if (isUrlEncoded || headers.some(h => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('form-urlencoded'))) {
        bodyType = 'x-www-form-urlencoded';
        try {
          // Parse urlencoded pairs with decoding for %20, %40, %3A, +
          const pairs = bodyData.split('&').filter(Boolean);
          for (const pair of pairs) {
            const eqIdx = pair.indexOf('=');
            let rawK = eqIdx > -1 ? pair.substring(0, eqIdx) : pair;
            let rawV = eqIdx > -1 ? pair.substring(eqIdx + 1) : '';
            try {
              rawK = decodeURIComponent(rawK.replace(/\+/g, ' '));
            } catch {}
            try {
              rawV = decodeURIComponent(rawV.replace(/\+/g, ' '));
            } catch {}
            finalUrlencoded.push({
              id: 'u_' + Math.random().toString(36).substring(2, 9),
              key: rawK,
              value: rawV,
              enabled: true
            });
          }
        } catch {
          rawBody = bodyData;
          bodyType = 'raw';
        }
      } else {
        bodyType = 'raw';
        rawBody = bodyData;
      }
    }
  }

  // Auth setup
  let authType: any = 'none';
  if (bearerToken) {
    authType = 'bearer';
  } else if (basicAuthUser) {
    authType = 'basic';
  }

  // Ensure default empty rows for UI editors
  if (params.length === 0) {
    params.push({ id: 'p_' + Math.random().toString(36).substring(2, 9), key: '', value: '', enabled: true });
  }
  if (headers.length === 0) {
    headers.push({ id: 'h_' + Math.random().toString(36).substring(2, 9), key: '', value: '', enabled: true });
  }

  return {
    method,
    url: cleanUrl || url,
    params,
    headers,
    auth: {
      type: authType,
      bearerToken,
      basicUser: basicAuthUser,
      basicPass: basicAuthPass
    },
    body: {
      type: bodyType,
      rawType: 'json',
      json: jsonBody || '{\n  \n}',
      raw: rawBody,
      urlencoded: finalUrlencoded,
      formData: formDataList
    }
  };
}

export function generateCurl(request: ApiRequest, fullUrl: string, resolvedHeaders: Record<string, string>): string {
  const parts: string[] = ['curl'];

  // Follow redirects flag by standard convention
  parts.push('--location');

  if (request.method !== 'GET') {
    parts.push(`--request ${request.method}`);
  }

  parts.push(`'${fullUrl}'`);

  // Headers (ensure Content-Type is present for form-urlencoded if not already set)
  const headerEntries = { ...resolvedHeaders };
  if (
    request.body.type === 'x-www-form-urlencoded' &&
    !Object.keys(headerEntries).some(k => k.toLowerCase() === 'content-type')
  ) {
    headerEntries['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  for (const [key, value] of Object.entries(headerEntries)) {
    if (!key) continue;
    parts.push(`--header '${key}: ${value.replace(/'/g, "\\'")}'`);
  }

  // Body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.body.type === 'json' && request.body.json) {
      try {
        const compact = JSON.stringify(JSON.parse(request.body.json));
        parts.push(`--data '${compact.replace(/'/g, "\\'")}'`);
      } catch {
        parts.push(`--data '${request.body.json.replace(/'/g, "\\'")}'`);
      }
    } else if (request.body.type === 'x-www-form-urlencoded' && request.body.urlencoded) {
      const activePairs = request.body.urlencoded.filter(p => p.enabled && p.key);
      for (const p of activePairs) {
        if (p.value !== undefined && p.value !== '') {
          parts.push(`--data-urlencode '${p.key.replace(/'/g, "\\'")}=${p.value.replace(/'/g, "\\'")}'`);
        } else {
          parts.push(`--data-urlencode '${p.key.replace(/'/g, "\\'")}'`);
        }
      }
    } else if (request.body.type === 'form-data' && request.body.formData) {
      const activePairs = request.body.formData.filter(p => p.enabled && p.key);
      for (const p of activePairs) {
        parts.push(`--form '${p.key.replace(/'/g, "\\'")}=${(p.value || '').replace(/'/g, "\\'")}'`);
      }
    } else if (request.body.type === 'raw' && request.body.raw) {
      parts.push(`--data '${request.body.raw.replace(/'/g, "\\'")}'`);
    } else if (request.body.type === 'graphql' && request.body.graphqlQuery) {
      const gqlPayload = JSON.stringify({
        query: request.body.graphqlQuery,
        variables: request.body.graphqlVariables ? JSON.parse(request.body.graphqlVariables || '{}') : {}
      });
      parts.push(`--data '${gqlPayload.replace(/'/g, "\\'")}'`);
    }
  }

  return parts.join(' \\\n  ');
}

export function generateCodeSnippet(language: string, request: ApiRequest, fullUrl: string, resolvedHeaders: Record<string, string>): string {
  const isPostOrPut = request.method !== 'GET' && request.method !== 'HEAD';
  const isUrlEncoded = request.body.type === 'x-www-form-urlencoded';

  switch (language) {
    case 'javascript-fetch': {
      if (isPostOrPut && isUrlEncoded && request.body.urlencoded) {
        const active = request.body.urlencoded.filter(x => x.enabled && x.key);
        return `// JavaScript (Fetch API - URL Encoded)
const urlencoded = new URLSearchParams();
${active.map(p => `urlencoded.append("${p.key}", "${p.value.replace(/"/g, '\\"')}");`).join('\n')}

const response = await fetch('${fullUrl}', {
  method: '${request.method}',
  headers: ${JSON.stringify({ ...resolvedHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }, null, 2)},
  body: urlencoded
});
const data = await response.json();
console.log(data);`;
      }
      return `// JavaScript (Fetch API)
const response = await fetch('${fullUrl}', {
  method: '${request.method}',
  headers: ${JSON.stringify(resolvedHeaders, null, 2)},
  ${isPostOrPut && request.body.type === 'json' && request.body.json ? `body: JSON.stringify(${request.body.json}),` : ''}
});
const data = await response.json();
console.log(data);`;
    }

    case 'javascript-axios': {
      if (isPostOrPut && isUrlEncoded && request.body.urlencoded) {
        const active = request.body.urlencoded.filter(x => x.enabled && x.key);
        return `// JavaScript (Axios - URL Encoded)
import axios from 'axios';

const params = new URLSearchParams();
${active.map(p => `params.append("${p.key}", "${p.value.replace(/"/g, '\\"')}");`).join('\n')}

const response = await axios({
  method: '${request.method.toLowerCase()}',
  url: '${fullUrl}',
  headers: ${JSON.stringify({ ...resolvedHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }, null, 2)},
  data: params
});
console.log(response.data);`;
      }
      return `// JavaScript (Axios)
import axios from 'axios';

const response = await axios({
  method: '${request.method.toLowerCase()}',
  url: '${fullUrl}',
  headers: ${JSON.stringify(resolvedHeaders, null, 2)},
  ${isPostOrPut && request.body.type === 'json' && request.body.json ? `data: ${request.body.json},` : ''}
});
console.log(response.data);`;
    }

    case 'python-requests': {
      if (isPostOrPut && isUrlEncoded && request.body.urlencoded) {
        const active = request.body.urlencoded.filter(x => x.enabled && x.key);
        const payloadObj: Record<string, string> = {};
        for (const p of active) {
          payloadObj[p.key] = p.value;
        }
        return `# Python (Requests - URL Encoded)
import requests

url = "${fullUrl}"
headers = ${JSON.stringify({ ...resolvedHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }, null, 4)}
payload = ${JSON.stringify(payloadObj, null, 4)}

response = requests.request("${request.method}", url, headers=headers, data=payload)
print(response.status_code)
print(response.json() if "application/json" in response.headers.get("content-type", "") else response.text)`;
      }
      return `# Python (Requests)
import requests

url = "${fullUrl}"
headers = ${JSON.stringify(resolvedHeaders, null, 4)}
${isPostOrPut && request.body.type === 'json' && request.body.json ? `payload = ${request.body.json}\nresponse = requests.request("${request.method}", url, headers=headers, json=payload)` : `response = requests.request("${request.method}", url, headers=headers)`}

print(response.status_code)
print(response.json() if "application/json" in response.headers.get("content-type", "") else response.text)`;
    }

    case 'go': {
      if (isPostOrPut && isUrlEncoded && request.body.urlencoded) {
        const active = request.body.urlencoded.filter(x => x.enabled && x.key);
        return `// Go (net/http - URL Encoded)
package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"net/url"
\t"strings"
)

func main() {
\tendpoint := "${fullUrl}"
\tdata := url.Values{}
${active.map(p => `\tdata.Set("${p.key}", "${p.value.replace(/"/g, '\\"')}")`).join('\n')}

\treq, _ := http.NewRequest("${request.method}", endpoint, strings.NewReader(data.Encode()))
${Object.entries({ ...resolvedHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }).map(([k, v]) => `\treq.Header.Add("${k}", "${v}")`).join('\n')}

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tbody, _ := io.ReadAll(res.Body)
\tfmt.Println(res.Status)
\tfmt.Println(string(body))
}`;
      }
      return `// Go (net/http)
package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"strings"
)

func main() {
\turl := "${fullUrl}"
\t${request.body.json && request.method !== 'GET' ? `payload := strings.NewReader(\`${request.body.json}\`)
\treq, _ := http.NewRequest("${request.method}", url, payload)` : `req, _ := http.NewRequest("${request.method}", url, nil)`}

\t${Object.entries(resolvedHeaders).map(([k, v]) => `req.Header.Add("${k}", "${v}")`).join('\n\t')}

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tbody, _ := io.ReadAll(res.Body)
\tfmt.Println(res.Status)
\tfmt.Println(string(body))
}`;
    }

    case 'curl':
    default:
      return generateCurl(request, fullUrl, resolvedHeaders);
  }
}
