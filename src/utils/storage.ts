import { ApiRequest, Collection, Environment, HistoryItem, KeyValuePair, WorkspaceState, ApiResponse, TabItem } from '../types';

const STORAGE_KEY = 'api_client_workspace_v2';
const HISTORY_KEY = 'api_client_history_v2';

export const DEFAULT_ENVIRONMENTS: Environment[] = [
  {
    id: 'env_dev',
    name: 'Development',
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
      { id: 'v2', key: 'localEcho', value: '/api/echo', enabled: true },
      { id: 'v3', key: 'apiKey', value: 'dev_secret_key_88912', enabled: true }
    ]
  },
  {
    id: 'env_prod',
    name: 'Production',
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'https://api.github.com', enabled: true },
      { id: 'v2', key: 'apiKey', value: 'prod_secure_token_99120', enabled: true }
    ]
  },
  {
    id: 'env_local',
    name: 'Localhost',
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
      { id: 'v2', key: 'echoUrl', value: 'http://localhost:3000/api/echo', enabled: true }
    ]
  }
];

export const DEFAULT_GLOBALS: KeyValuePair[] = [
  { id: 'g1', key: 'appName', value: 'Postman-Local', enabled: true },
  { id: 'g2', key: 'contentType', value: 'application/json', enabled: true }
];

export function createNewRequest(
  collectionId?: string,
  folderId?: string,
  name = 'New Request',
  method: any = 'GET',
  url = '{{localEcho}}'
): ApiRequest {
  return {
    id: 'req_' + Math.random().toString(36).substring(2, 9),
    name,
    method,
    url,
    params: [
      { id: 'p_' + Math.random().toString(36).substring(2, 9), key: '', value: '', enabled: true }
    ],
    headers: [
      { id: 'h_' + Math.random().toString(36).substring(2, 9), key: 'Accept', value: 'application/json', enabled: true },
      { id: 'h_' + Math.random().toString(36).substring(2, 9), key: '', value: '', enabled: true }
    ],
    auth: {
      type: 'none'
    },
    body: {
      type: 'none',
      rawType: 'json',
      json: '{\n  "message": "Hello from API Client!",\n  "active": true\n}',
      formData: [],
      urlencoded: []
    },
    tests: [
      {
        id: 't_1',
        name: 'Status code is 200',
        type: 'status_code',
        operator: 'equals',
        targetValue: '200',
        enabled: true
      },
      {
        id: 't_2',
        name: 'Response time under 1500ms',
        type: 'response_time',
        operator: 'less_than',
        targetValue: '1500',
        enabled: true
      }
    ],
    extractions: [],
    collectionId,
    folderId,
    settings: {
      timeout: 10000,
      followRedirects: true,
      proxyMode: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function createNewCollection(name = 'New Collection'): Collection {
  return {
    id: 'col_' + Math.random().toString(36).substring(2, 9),
    name,
    description: '',
    folders: [],
    requests: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function getDefaultCollections(): Collection[] {
  return [
    {
      id: 'col_echo',
      name: 'Local Echo & Diagnostics API',
      description: 'Quick local test requests to inspect request headers, query params, and body parsing.',
      folders: [
        {
          id: 'f_core',
          name: 'Echo Endpoints',
          collectionId: 'col_echo'
        }
      ],
      requests: [
        {
          id: 'req_echo_get',
          name: 'Echo GET Request with Query Params',
          method: 'GET',
          url: '{{localEcho}}?greeting=hello&timestamp={{$timestamp}}',
          params: [
            { id: 'p1', key: 'greeting', value: 'hello', enabled: true },
            { id: 'p2', key: 'timestamp', value: '{{$timestamp}}', enabled: true }
          ],
          headers: [
            { id: 'h1', key: 'X-App-Client', value: 'Postman-Local', enabled: true }
          ],
          auth: { type: 'none' },
          body: { type: 'none' },
          tests: [
            { id: 't1', name: 'Status is 200 OK', type: 'status_code', operator: 'equals', targetValue: '200', enabled: true },
            { id: 't2', name: 'Response is JSON', type: 'header_exists', targetValue: 'content-type', enabled: true }
          ],
          extractions: [],
          collectionId: 'col_echo',
          folderId: 'f_core',
          settings: { timeout: 10000, followRedirects: true, proxyMode: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'req_echo_post',
          name: 'Echo POST JSON Payload',
          method: 'POST',
          url: '{{localEcho}}',
          params: [],
          headers: [
            { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true }
          ],
          auth: { type: 'none' },
          body: {
            type: 'json',
            rawType: 'json',
            json: '{\n  "userId": 101,\n  "action": "sync_workspace",\n  "tag": "local_machine",\n  "uuid": "{{$guid}}"\n}'
          },
          tests: [
            { id: 't1', name: 'Status is 200 OK', type: 'status_code', operator: 'equals', targetValue: '200', enabled: true },
            { id: 't2', name: 'Echo response contains action', type: 'body_contains', targetValue: 'sync_workspace', enabled: true }
          ],
          extractions: [],
          collectionId: 'col_echo',
          folderId: 'f_core',
          settings: { timeout: 10000, followRedirects: true, proxyMode: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'col_users',
      name: 'Sample REST API (JSONPlaceholder)',
      description: 'Demo collection fetching users, posts, and creating comments.',
      folders: [],
      requests: [
        {
          id: 'req_get_users',
          name: 'Get All Users List',
          method: 'GET',
          url: '{{baseUrl}}/users',
          params: [],
          headers: [
            { id: 'h1', key: 'Accept', value: 'application/json', enabled: true }
          ],
          auth: { type: 'none' },
          body: { type: 'none' },
          tests: [
            { id: 't1', name: 'Status is 200 OK', type: 'status_code', operator: 'equals', targetValue: '200', enabled: true },
            { id: 't2', name: 'Latency < 2000ms', type: 'response_time', operator: 'less_than', targetValue: '2000', enabled: true }
          ],
          extractions: [
            { id: 'ex1', variableName: 'firstUserId', source: 'json_path', pathOrKey: '[0].id', enabled: true }
          ],
          collectionId: 'col_users',
          settings: { timeout: 10000, followRedirects: true, proxyMode: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'req_create_post',
          name: 'Create New Post',
          method: 'POST',
          url: '{{baseUrl}}/posts',
          params: [],
          headers: [
            { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true }
          ],
          auth: { type: 'none' },
          body: {
            type: 'json',
            rawType: 'json',
            json: '{\n  "title": "Post from API Client",\n  "body": "Testing automated assertions and local storage sync",\n  "userId": 1\n}'
          },
          tests: [
            { id: 't1', name: 'Status is 201 Created', type: 'status_code', operator: 'equals', targetValue: '201', enabled: true }
          ],
          extractions: [
            { id: 'ex1', variableName: 'createdPostId', source: 'json_path', pathOrKey: 'id', enabled: true }
          ],
          collectionId: 'col_users',
          settings: { timeout: 10000, followRedirects: true, proxyMode: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
}

export function loadWorkspaceState(): WorkspaceState {
  try {
    // Purge legacy v1 storage keys if present
    localStorage.removeItem('api_client_workspace_v1');
    localStorage.removeItem('api_client_history_v1');
    localStorage.removeItem('apidesk_saved_regression_scripts');
    localStorage.removeItem('apidesk_load_test_history');

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.collections)) {
        const collections: Collection[] = parsed.collections;
        const environments: Environment[] = parsed.environments || DEFAULT_ENVIRONMENTS;
        const globalVariables: KeyValuePair[] = parsed.globalVariables || DEFAULT_GLOBALS;
        const activeEnvironmentId: string | null = parsed.activeEnvironmentId ?? 'env_dev';
        const history: HistoryItem[] = parsed.history || [];
        const tabs: TabItem[] = parsed.tabs || [];
        const activeTabId = parsed.activeTabId || tabs[0]?.id;

        const openRequests: Record<string, ApiRequest> = { ...(parsed.openRequests || {}) };
        for (const col of collections) {
          for (const req of col.requests) {
            if (!openRequests[req.id]) {
              openRequests[req.id] = req;
            }
          }
        }

        // If tabs empty, create initial tab from first collection request
        if (tabs.length === 0 && collections[0]?.requests[0]) {
          const req0 = collections[0].requests[0];
          openRequests[req0.id] = req0;
          const t0: TabItem = { id: 'tab_' + req0.id, requestId: req0.id, isDirty: false };
          return {
            collections,
            environments,
            activeEnvironmentId,
            globalVariables,
            history,
            tabs: [t0],
            activeTabId: t0.id,
            openRequests
          };
        }

        // Ensure all tabs point to a valid request in openRequests
        const validatedTabs: TabItem[] = [];
        for (const tab of tabs) {
          if (!openRequests[tab.requestId]) {
            // Find in collections
            let foundReq: ApiRequest | undefined;
            for (const col of collections) {
              const r = col.requests.find(x => x.id === tab.requestId);
              if (r) {
                foundReq = r;
                break;
              }
            }
            if (foundReq) {
              openRequests[tab.requestId] = foundReq;
              validatedTabs.push(tab);
            } else {
              // Create a dummy request for tab
              const fallbackReq = createNewRequest(undefined, undefined, tab.title || 'Untitled Request');
              openRequests[fallbackReq.id] = fallbackReq;
              validatedTabs.push({ ...tab, requestId: fallbackReq.id });
            }
          } else {
            validatedTabs.push(tab);
          }
        }

        if (validatedTabs.length === 0) {
          const freshReq = createNewRequest();
          openRequests[freshReq.id] = freshReq;
          const freshTab = { id: 'tab_' + freshReq.id, requestId: freshReq.id, isDirty: false };
          validatedTabs.push(freshTab);
        }

        return {
          collections,
          environments,
          activeEnvironmentId,
          globalVariables,
          history,
          tabs: validatedTabs,
          activeTabId: activeTabId && validatedTabs.some(t => t.id === activeTabId) ? activeTabId : validatedTabs[0].id,
          openRequests
        };
      }
    }
  } catch (err) {
    console.error('Failed to parse saved workspace from localStorage:', err);
  }

  // Default initial workspace
  const defaultCols = getDefaultCollections();
  const openRequests: Record<string, ApiRequest> = {};
  for (const col of defaultCols) {
    for (const req of col.requests) {
      openRequests[req.id] = req;
    }
  }

  const initialReq = defaultCols[0].requests[0];
  const initialTab = { id: 'tab_' + initialReq.id, requestId: initialReq.id, isDirty: false };

  return {
    collections: defaultCols,
    environments: DEFAULT_ENVIRONMENTS,
    activeEnvironmentId: 'env_dev',
    globalVariables: DEFAULT_GLOBALS,
    history: [],
    tabs: [initialTab],
    activeTabId: initialTab.id,
    openRequests
  };
}

export function saveWorkspaceState(state: {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  globalVariables: KeyValuePair[];
  history: HistoryItem[];
  tabs: TabItem[];
  activeTabId: string;
  openRequests: Record<string, ApiRequest>;
}) {
  try {
    const payload = {
      collections: state.collections,
      environments: state.environments,
      activeEnvironmentId: state.activeEnvironmentId,
      globalVariables: state.globalVariables,
      history: (state.history || []).slice(0, 100),
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      openRequests: state.openRequests
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Could not save to localStorage:', err);
  }
}

export function addToHistory(request: ApiRequest, response?: ApiResponse): HistoryItem[] {
  const item: HistoryItem = {
    id: 'hist_' + Math.random().toString(36).substring(2, 9),
    request: { ...request },
    response: response ? { ...response } : undefined,
    executedAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const existing: HistoryItem[] = raw ? JSON.parse(raw) : [];
    const updated = [item, ...existing].slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [item];
  }
}

export function clearHistoryStorage(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (err) {
    console.error('Could not clear history from localStorage:', err);
  }
}
