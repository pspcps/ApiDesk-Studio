// Load Testing & Script Regression Runner Types

export interface LoadTestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  connections: number; // e.g. 10
  pipelining: number; // e.g. 1
  duration: number; // in seconds, e.g. 10
  amount?: number; // total number of requests (optional)
  rate?: number; // requests per second cap (optional)
  timeout: number; // timeout in seconds
}

export interface LatencyDistributionItem {
  percentile: number;
  value: number;
}

export interface LatencyBucket {
  range: string;
  minMs: number;
  maxMs: number;
  count: number;
  percentage: number;
}

export interface SlaThresholds {
  maxP95Ms: number;
  maxP99Ms: number;
  maxErrorPercent: number;
  minRps: number;
  maxTimeouts: number;
  targetApdexMs: number;
}

export interface SlaAuditResult {
  passed: boolean;
  score: number; // 0 - 100
  apdex: {
    score: number; // 0 - 1.00
    rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    satisfiedCount: number;
    toleratingCount: number;
    frustratedCount: number;
    targetMs: number;
  };
  checks: {
    id: string;
    label: string;
    target: string;
    actual: string;
    passed: boolean;
    critical: boolean;
  }[];
  diagnostics: {
    type: 'success' | 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    recommendation?: string;
  }[];
}

export interface LoadTestHistoryItem {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  connections: number;
  duration: number;
  requestsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRatePercent: number;
  apdexScore: number;
  totalRequests: number;
  healthScore: number;
}

export interface SampleProbeResult {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  isJson: boolean;
  durationMs: number;
  error?: string;
}

export interface FailureReasonItem {
  code: string | number;
  count: number;
  percentage: number;
  meaning: string;
  reason: string;
  fixRecommendation: string;
}

export interface LoadTestResult {
  url: string;
  method: string;
  connections: number;
  duration: number;
  totalRequests: number;
  requestsPerSecond: number;
  bytesPerSecond: number;
  totalBytes: number;
  durationActual: number;
  errors: number;
  timeouts: number;
  non2xx: number;
  statusCodes: Record<string, number>;
  sampleProbe?: SampleProbeResult;
  failureReasons?: FailureReasonItem[];
  latency: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p90: number;
    p97_5: number;
    p99: number;
    p99_9: number;
    p99_99: number;
  };
  throughput: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    total: number;
  };
  timeSeries?: {
    second: number;
    rps: number;
    avgLatency: number;
    p95Latency: number;
    errors: number;
    activeUsers: number;
  }[];
  latencyBuckets?: LatencyBucket[];
  rawOutput?: string;
  completedAt: number;
}

export interface ScriptExecutionConfig {
  scriptContent: string;
  scriptName?: string;
  scriptType: 'node_script' | 'bash_script';
  envVars: Record<string, string>;
  cliArgs: string; // e.g. "--env dev --test 1,2"
  timeoutSec: number;
}

export interface SavedScript {
  id: string;
  name: string;
  description?: string;
  scriptName: string;
  scriptContent: string;
  scriptType: 'node_script' | 'bash_script';
  selectedEnvId: string | null;
  cliArgs: string;
  customEnvVars: { id: string; key: string; value: string; enabled: boolean }[];
  timeoutSec: number;
  createdAt: number;
  updatedAt: number;
  lastExecutedAt?: number;
  lastExitCode?: number | null;
  lastStatus?: 'completed' | 'failed' | 'timeout';
}

export interface ScriptExecutionResult {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  startedAt: number;
  finishedAt: number | null;
  testsSummary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    avgTimeMs?: number;
  };
}
