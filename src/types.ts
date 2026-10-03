export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
  type?: 'text' | 'file' | 'secret';
}

export type AuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  bearerToken?: string;
  basicUser?: string;
  basicPass?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
  oauthToken?: string;
  oauthHeaderPrefix?: string;
}

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'graphql' | 'binary';
export type RawType = 'text' | 'javascript' | 'html' | 'xml' | 'json';

export interface BodyConfig {
  type: BodyType;
  rawType?: RawType;
  json?: string;
  raw?: string;
  formData?: KeyValuePair[];
  urlencoded?: KeyValuePair[];
  graphqlQuery?: string;
  graphqlVariables?: string;
  binaryFileName?: string;
  binaryFileSize?: number;
  binaryFileBase64?: string;
}

export type AssertionType = 'status_code' | 'response_time' | 'json_path' | 'header_exists' | 'body_contains' | 'custom_js';
export type AssertionOperator = 'equals' | 'not_equals' | 'less_than' | 'greater_than' | 'contains' | 'exists';

export interface TestAssertion {
  id: string;
  name: string;
  type: AssertionType;
  targetValue?: string;
  operator?: AssertionOperator;
  customScript?: string;
  enabled: boolean;
}

export interface VariableExtraction {
  id: string;
  variableName: string;
  source: 'json_path' | 'header' | 'status_code';
  pathOrKey: string;
  enabled: boolean;
}

export interface RequestSettings {
  timeout: number;
  followRedirects: boolean;
  proxyMode: boolean; // true = use backend proxy (recommended for CORS), false = direct browser fetch
}

export interface EnvironmentRequestOverride {
  url?: string;
  params?: KeyValuePair[];
  headers?: KeyValuePair[];
  auth?: AuthConfig;
  body?: BodyConfig;
}

export interface ApiRequest {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  auth: AuthConfig;
  body: BodyConfig;
  environmentOverrides?: Record<string, EnvironmentRequestOverride>;
  tests: TestAssertion[];
  extractions: VariableExtraction[];
  preRequestScript?: string;
  postResponseScript?: string;
  collectionId?: string;
  folderId?: string;
  settings: RequestSettings;
  createdAt: number;
  updatedAt: number;
}

export interface ScriptLogItem {
  type: 'log' | 'info' | 'warn' | 'error';
  message: string;
  messages?: any[];
  timestamp: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface TimingBreakdown {
  dns: number;
  tcp: number;
  ttfb: number;
  download: number;
  total: number;
}

export interface ApiResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  isJson: boolean;
  isBinary: boolean;
  contentType: string;
  sizeBytes: number;
  timeMs: number;
  timing: TimingBreakdown;
  timestamp: number;
  testResults?: TestResult[];
  savedVariables?: Record<string, string>;
  scriptLogs?: ScriptLogItem[];
}

export type StorageLocationMode = 'browser_local' | 'pc_file_handle' | 'server_disk';

export interface StorageStatus {
  mode: StorageLocationMode;
  fileName?: string;
  lastSavedAt?: number;
  autoSaveEnabled: boolean;
  serverDiskAvailable?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  collectionId: string;
  parentFolderId?: string;
  description?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  auth?: AuthConfig;
  variables?: KeyValuePair[];
  folders: Folder[];
  requests: ApiRequest[];
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

export interface HistoryItem {
  id: string;
  request: ApiRequest;
  response?: ApiResponse;
  executedAt: number;
}

export interface TabItem {
  id: string;
  requestId: string;
  title?: string;
  isDirty?: boolean;
}

export interface WorkspaceState {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  globalVariables: KeyValuePair[];
  history: HistoryItem[];
  tabs: TabItem[];
  activeTabId: string;
  openRequests: Record<string, ApiRequest>;
}

export interface RunnerResultItem {
  request: ApiRequest;
  response?: ApiResponse;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  status: 'passed' | 'failed' | 'error' | 'running' | 'pending';
  error?: string;
}

export interface CollectionRunnerState {
  collectionId: string;
  folderId?: string;
  status: 'idle' | 'running' | 'completed' | 'stopped';
  delayMs: number;
  iterations: number;
  currentIteration: number;
  results: RunnerResultItem[];
  totalTimeMs: number;
}
