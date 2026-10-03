import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Flame, 
  Activity, 
  Copy, 
  Check, 
  Download, 
  BarChart2, 
  Zap, 
  Gauge, 
  AlertTriangle, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Sliders,
  Terminal,
  FileCode,
  Key,
  Shield,
  Plus,
  Trash2,
  Code,
  Sparkles,
  AlignLeft,
  X,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Bug,
  Globe,
  TrendingUp,
  History,
  ShieldCheck,
  Share2
} from 'lucide-react';
import { ApiRequest, Environment, KeyValuePair } from '../types';
import { 
  LoadTestConfig, 
  LoadTestResult, 
  SlaThresholds, 
  SlaAuditResult, 
  LoadTestHistoryItem 
} from '../types/loadTesting';
import { resolveTemplateString } from '../utils/variableResolver';
import { isCurlCommand, parseCurlCommand } from '../utils/curlParser';
import { DebugInspectorModal, DebugInspectorData, DebugLogEntry } from './DebugInspectorModal';
import { copyToClipboard } from '../utils/clipboard';
import { CopyButton } from './CopyButton';
import { 
  computeSlaAndApdexAudit, 
  DEFAULT_SLA_THRESHOLDS,
  generateLatencyHistogram,
  generateSyntheticTimeSeries
} from '../utils/loadTestAnalytics';
import { LoadTesterPresets, TestProfile } from './loadtester/LoadTesterPresets';
import { LoadTesterInsightsTab } from './loadtester/LoadTesterInsightsTab';
import { LoadTesterChartsTab } from './loadtester/LoadTesterChartsTab';
import { LoadTesterHistoryTab } from './loadtester/LoadTesterHistoryTab';
import { LoadTesterExportTab } from './loadtester/LoadTesterExportTab';
import { LoadTesterLiveBanner } from './loadtester/LoadTesterLiveBanner';
import { LoadTesterFailureDiagnosticsCard } from './loadtester/LoadTesterFailureDiagnosticsCard';

interface LoadTesterViewProps {
  activeRequest: ApiRequest | null;
  activeEnvironment: Environment | null;
  globalVariables: KeyValuePair[];
}

type ConfigTab = 'settings' | 'headers' | 'auth' | 'params' | 'body';
type ResultViewMode = 'insights' | 'metrics' | 'charts' | 'history' | 'export' | 'raw';

const STORAGE_KEY_HISTORY = 'apidesk_load_test_history_v2';
const STORAGE_KEY_THRESHOLDS = 'apidesk_load_sla_thresholds_v2';

export const LoadTesterView: React.FC<LoadTesterViewProps> = ({
  activeRequest,
  activeEnvironment,
  globalVariables
}) => {
  // Config state
  const [url, setUrl] = useState<string>(() => {
    if (activeRequest?.url) {
      return activeRequest.url;
    }
    return 'https://httpbin.org/get';
  });

  const [method, setMethod] = useState<string>(() => activeRequest?.method || 'GET');
  const [activeTab, setActiveTab] = useState<ConfigTab>('settings');

  // Load Settings
  const [connections, setConnections] = useState<number>(15);
  const [duration, setDuration] = useState<number>(10);
  const [pipelining, setPipelining] = useState<number>(1);
  const [rateLimit, setRateLimit] = useState<string>('');
  const [timeout, setTimeoutSec] = useState<number>(10);
  const [amount, setAmount] = useState<string>('');

  // Headers list
  const [headers, setHeaders] = useState<KeyValuePair[]>(() => {
    if (activeRequest?.headers && activeRequest.headers.length > 0) {
      return activeRequest.headers.map(h => ({ ...h }));
    }
    return [
      { id: 'h1', key: 'User-Agent', value: 'ApiDesk-LoadTester/1.0', enabled: true },
      { id: 'h2', key: 'Accept', value: '*/*', enabled: true }
    ];
  });

  // Query Params list
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>(() => {
    if (activeRequest?.params && activeRequest.params.length > 0) {
      return activeRequest.params.map(q => ({ ...q }));
    }
    return [];
  });

  // Auth Configuration
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic' | 'apikey'>(() => {
    if (activeRequest?.auth) {
      if (activeRequest.auth.type === 'bearer') return 'bearer';
      if (activeRequest.auth.type === 'basic') return 'basic';
      if (activeRequest.auth.type === 'apikey') return 'apikey';
    }
    return 'none';
  });
  const [bearerToken, setBearerToken] = useState<string>(() => activeRequest?.auth?.bearerToken || '');
  const [basicUser, setBasicUser] = useState<string>(() => activeRequest?.auth?.basicUser || '');
  const [basicPass, setBasicPass] = useState<string>(() => activeRequest?.auth?.basicPass || '');
  const [apiKeyName, setApiKeyName] = useState<string>(() => activeRequest?.auth?.apiKeyName || 'X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState<string>(() => activeRequest?.auth?.apiKeyValue || '');
  const [apiKeyPlacement, setApiKeyPlacement] = useState<'header' | 'query'>(() => 
    (activeRequest?.auth?.apiKeyLocation as any) || 'header'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Body Payload
  const [bodyPayload, setBodyPayload] = useState<string>(() => {
    if (activeRequest?.body?.type === 'json' && activeRequest.body.json) {
      return activeRequest.body.json;
    }
    if (activeRequest?.body?.raw) {
      return activeRequest.body.raw;
    }
    return '';
  });

  // SLA Thresholds State
  const [slaThresholds, setSlaThresholds] = useState<SlaThresholds>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SLA_THRESHOLDS;
  });

  // History State
  const [history, setHistory] = useState<LoadTestHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [baselineId, setBaselineId] = useState<string | null>(null);

  // cURL Modal State
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [curlInputText, setCurlInputText] = useState('');
  const [curlNotice, setCurlNotice] = useState<string | null>(null);

  // Execution & Results State
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<LoadTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ResultViewMode>('insights');
  const [engineMode, setEngineMode] = useState<'backend' | 'browser'>('backend');

  // Live Telemetry Tickers
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveRequestsCount, setLiveRequestsCount] = useState(0);
  const [liveRps, setLiveRps] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Debug Inspector State
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [debugInspectorData, setDebugInspectorData] = useState<DebugInspectorData>({
    title: 'Load Test Diagnostics',
    endpoint: '/api/load-test',
    method: 'POST',
    executionLogs: []
  });

  // Save history on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // Save thresholds on changes
  const handleUpdateThresholds = (newThresholds: SlaThresholds) => {
    setSlaThresholds(newThresholds);
    try {
      localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(newThresholds));
    } catch {}
  };

  const showCurlBanner = (msg: string) => {
    setCurlNotice(msg);
    setTimeout(() => setCurlNotice(null), 4000);
  };

  const addDebugLog = (level: 'info' | 'warn' | 'error' | 'success', title: string, message: string, details?: any) => {
    const entry: DebugLogEntry = {
      id: 'load_log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      level,
      title,
      message,
      details
    };
    setDebugInspectorData(prev => ({
      ...prev,
      executionLogs: [...prev.executionLogs, entry]
    }));
  };

  // Profile preset selector
  const handleSelectProfile = (profile: TestProfile) => {
    setConnections(profile.connections);
    setDuration(profile.duration);
    setPipelining(profile.pipelining);
    setRateLimit(profile.rateLimit);
    showCurlBanner(`Applied preset: ${profile.name} (${profile.connections} VUs, ${profile.duration}s)`);
  };

  // Abort execution handler
  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearInterval(timerIntervalRef.current);
    setIsRunning(false);
    addDebugLog('warn', 'Load Test Aborted', 'The active load test run was cancelled by user.');
  };

  // In-Browser Multi-Connection Load Engine
  const runBrowserLoadTest = async (
    targetUrl: string,
    reqMethod: string,
    reqHeaders: Record<string, string>,
    reqBody: string | undefined,
    concurrency: number,
    durationSec: number
  ) => {
    setIsRunning(true);
    setErrorMessage(null);
    setTestResult(null);
    setElapsedSec(0);
    setLiveRequestsCount(0);
    setLiveRps(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    addDebugLog('info', 'In-Browser Engine Started', `Spawning ${concurrency} concurrent browser worker sockets for ${durationSec}s...`, {
      targetUrl,
      reqMethod,
      headersCount: Object.keys(reqHeaders).length
    });

    // 1. Initial Diagnostic Sample Probe (pre-load inspection)
    let sampleProbe: any = undefined;
    try {
      const probeController = new AbortController();
      const probeTimeoutId = setTimeout(() => probeController.abort(), 6000);
      const probeStart = performance.now();
      const probeRes = await fetch(targetUrl, {
        method: reqMethod,
        headers: reqHeaders,
        body: reqBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(reqMethod) ? reqBody : undefined,
        signal: probeController.signal
      });
      clearTimeout(probeTimeoutId);
      const probeDurationMs = Math.round(performance.now() - probeStart);
      const probeHeadersMap: Record<string, string> = {};
      probeRes.headers.forEach((v, k) => {
        probeHeadersMap[k] = v;
      });
      const rawBody = await probeRes.text();
      let isJson = false;
      let formattedBody = rawBody;
      try {
        const parsed = JSON.parse(rawBody);
        formattedBody = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {}

      sampleProbe = {
        statusCode: probeRes.status,
        statusText: probeRes.statusText || String(probeRes.status),
        headers: probeHeadersMap,
        body: formattedBody.substring(0, 4000),
        isJson,
        durationMs: probeDurationMs
      };
    } catch (probeErr: any) {
      sampleProbe = {
        statusCode: 0,
        statusText: 'Probe Connection Failure',
        headers: {},
        body: probeErr.message || 'Failed to connect during initial diagnostic sample probe.',
        isJson: false,
        durationMs: 0,
        error: probeErr.message
      };
    }

    const startTime = Date.now();
    const endTime = startTime + durationSec * 1000;
    const latencies: number[] = [];
    const statusCodes: Record<string, number> = {};
    const timeSeriesMap: Record<number, { rps: number; latencies: number[]; errors: number }> = {};
    let totalBytes = 0;
    let errorsCount = 0;
    let timeoutsCount = 0;
    let non2xxCount = 0;

    // Start live timer
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const currentElapsed = Math.min(durationSec, Math.floor((now - startTime) / 1000));
      setElapsedSec(currentElapsed);
      setLiveRequestsCount(latencies.length);
      const currentRps = currentElapsed > 0 ? latencies.length / currentElapsed : 0;
      setLiveRps(currentRps);
    }, 250);

    const worker = async () => {
      while (Date.now() < endTime && !abortController.signal.aborted) {
        const reqStart = performance.now();
        const currentSec = Math.floor((Date.now() - startTime) / 1000) + 1;
        if (!timeSeriesMap[currentSec]) {
          timeSeriesMap[currentSec] = { rps: 0, latencies: [], errors: 0 };
        }

        try {
          const innerController = new AbortController();
          const timeoutId = setTimeout(() => innerController.abort(), 10000);

          const res = await fetch(targetUrl, {
            method: reqMethod,
            headers: reqHeaders,
            body: reqBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(reqMethod) ? reqBody : undefined,
            signal: innerController.signal
          });
          clearTimeout(timeoutId);

          const elapsed = Math.round(performance.now() - reqStart);
          latencies.push(elapsed);
          timeSeriesMap[currentSec].rps++;
          timeSeriesMap[currentSec].latencies.push(elapsed);

          const statusStr = String(res.status);
          statusCodes[statusStr] = (statusCodes[statusStr] || 0) + 1;

          if (res.status < 200 || res.status >= 300) {
            non2xxCount++;
          }

          const blob = await res.blob();
          totalBytes += blob.size;
        } catch (err: any) {
          const elapsed = Math.round(performance.now() - reqStart);
          latencies.push(elapsed);
          if (timeSeriesMap[currentSec]) {
            timeSeriesMap[currentSec].errors++;
          }

          if (err.name === 'AbortError') {
            timeoutsCount++;
          } else {
            errorsCount++;
          }
        }
      }
    };

    const workerCount = Math.min(Math.max(1, concurrency), 100);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    clearInterval(timerIntervalRef.current);

    const totalDurationActual = Math.max(0.1, (Date.now() - startTime) / 1000);
    const totalRequests = latencies.length;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    const getPercentile = (p: number) => {
      if (sortedLatencies.length === 0) return 0;
      const index = Math.min(sortedLatencies.length - 1, Math.floor((p / 100) * sortedLatencies.length));
      return sortedLatencies[index];
    };

    const avgLatency = sortedLatencies.length > 0 
      ? Math.round(sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length) 
      : 0;

    // Build real time-series
    const timeSeries = Object.entries(timeSeriesMap).map(([sec, data]) => {
      const secAvgLat = data.latencies.length > 0
        ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
        : avgLatency;
      return {
        second: Number(sec),
        rps: data.rps,
        avgLatency: secAvgLat,
        p95Latency: Math.round(secAvgLat * 1.3),
        errors: data.errors,
        activeUsers: workerCount
      };
    });

    // Generate failure reasons breakdown
    const failureReasonsList: any[] = [];
    if (statusCodes && Object.keys(statusCodes).length > 0) {
      for (const [codeStr, count] of Object.entries(statusCodes)) {
        const codeNum = parseInt(codeStr, 10);
        if (codeNum < 200 || codeNum >= 300) {
          let meaning = `HTTP ${codeNum}`;
          let reason = `Endpoint returned status code ${codeNum}`;
          let fixRecommendation = 'Check backend server logs and request parameters.';

          if (codeNum === 405) {
            meaning = 'HTTP 405 Method Not Allowed';
            reason = `The destination server explicitly rejected HTTP ${reqMethod}. The endpoint does not support ${reqMethod} requests.`;
            fixRecommendation = `Switch the HTTP Method selector from ${reqMethod} to ${reqMethod === 'GET' ? 'POST or PUT' : 'GET or POST'}, and provide any required request payload in the Body tab.`;
          } else if (codeNum === 401) {
            meaning = 'HTTP 401 Unauthorized';
            reason = 'The target server requires authentication credentials (missing or expired token).';
            fixRecommendation = 'Configure Bearer Token, API Key, or Basic Auth in the "Auth & Tokens" tab.';
          } else if (codeNum === 403) {
            meaning = 'HTTP 403 Forbidden';
            reason = 'Access was denied. The provided token or IP address does not have sufficient permissions.';
            fixRecommendation = 'Verify IAM permissions, API Gateway scopes, or whitelist IP.';
          } else if (codeNum === 404) {
            meaning = 'HTTP 404 Not Found';
            reason = 'The requested endpoint URL or path does not exist on the server.';
            fixRecommendation = 'Verify the URL path, path variables, and query parameters.';
          } else if (codeNum === 400 || codeNum === 422) {
            meaning = `HTTP ${codeNum} ${codeNum === 400 ? 'Bad Request' : 'Unprocessable Entity'}`;
            reason = 'The server could not process the request due to malformed payload syntax or validation errors.';
            fixRecommendation = 'Verify JSON payload formatting and required fields in the Body tab.';
          } else if (codeNum === 429) {
            meaning = 'HTTP 429 Too Many Requests';
            reason = 'Rate limiting or DDoS protection throttled incoming connections.';
            fixRecommendation = 'Decrease Concurrent Clients (VUs) or set a Rate Cap (RPS) limit.';
          } else if (codeNum === 500) {
            meaning = 'HTTP 500 Internal Server Error';
            reason = 'An unhandled exception or crash occurred in the backend application code.';
            fixRecommendation = 'Check backend application stack traces and database connections.';
          } else if (codeNum === 502 || codeNum === 503 || codeNum === 504) {
            meaning = `HTTP ${codeNum} ${codeNum === 502 ? 'Bad Gateway' : codeNum === 503 ? 'Service Unavailable' : 'Gateway Timeout'}`;
            reason = 'The upstream application service, reverse proxy, or load balancer failed or timed out under load.';
            fixRecommendation = 'Increase backend replica count, scale upstream pods, or increase gateway timeout thresholds.';
          }

          failureReasonsList.push({
            code: codeStr,
            meaning,
            count,
            percentage: Number(((count / Math.max(1, totalRequests)) * 100).toFixed(1)),
            reason,
            fixRecommendation
          });
        }
      }
    }

    const formattedResult: LoadTestResult = {
      url: targetUrl,
      method: reqMethod,
      connections: workerCount,
      duration: durationSec,
      durationActual: Number(totalDurationActual.toFixed(2)),
      totalRequests,
      requestsPerSecond: Number((totalRequests / totalDurationActual).toFixed(2)),
      bytesPerSecond: Number((totalBytes / totalDurationActual).toFixed(2)),
      totalBytes,
      errors: errorsCount,
      timeouts: timeoutsCount,
      non2xx: non2xxCount,
      statusCodes,
      failureReasons: failureReasonsList.length > 0 ? failureReasonsList : undefined,
      sampleProbe,
      latency: {
        average: avgLatency,
        mean: avgLatency,
        stddev: 0,
        min: sortedLatencies[0] || 0,
        max: sortedLatencies[sortedLatencies.length - 1] || 0,
        p50: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90),
        p97_5: getPercentile(97.5),
        p99: getPercentile(99),
        p99_9: getPercentile(99.9),
        p99_99: getPercentile(99.99),
      },
      throughput: {
        average: Number((totalBytes / totalDurationActual).toFixed(2)),
        mean: Number((totalBytes / totalDurationActual).toFixed(2)),
        stddev: 0,
        min: 0,
        max: totalBytes,
        total: totalBytes
      },
      timeSeries: timeSeries.length > 0 ? timeSeries : undefined,
      latencyBuckets: generateLatencyHistogram(sortedLatencies, {
        totalRequests,
        latency: { average: avgLatency, p50: getPercentile(50), p90: getPercentile(90), p99: getPercentile(99) }
      } as any),
      completedAt: Date.now()
    };

    const audit = computeSlaAndApdexAudit(formattedResult, slaThresholds);

    // Save to history
    saveResultToHistory(formattedResult, audit);

    addDebugLog('success', 'In-Browser Load Test Completed', `Generated ${totalRequests} total requests (${formattedResult.requestsPerSecond} RPS) with ${errorsCount} errors.`, {
      avgLatency,
      totalRequests,
      statusCodes
    });

    setTestResult(formattedResult);
    setIsRunning(false);
  };

  const saveResultToHistory = (res: LoadTestResult, audit: SlaAuditResult) => {
    const item: LoadTestHistoryItem = {
      id: 'run_' + Date.now(),
      timestamp: Date.now(),
      url: res.url,
      method: res.method,
      connections: res.connections,
      duration: res.durationActual,
      requestsPerSecond: res.requestsPerSecond,
      avgLatency: res.latency.average,
      p95Latency: res.latency.p97_5 || res.latency.p90,
      p99Latency: res.latency.p99,
      errorRatePercent: Number(((res.errors / Math.max(1, res.totalRequests)) * 100).toFixed(1)),
      apdexScore: audit.apdex.score,
      totalRequests: res.totalRequests,
      healthScore: audit.score
    };

    setHistory(prev => [item, ...prev.slice(0, 19)]);
  };

  // Helper to import from cURL command
  const applyParsedCurl = (rawText: string) => {
    if (!rawText.trim()) return false;
    const parsed = parseCurlCommand(rawText);
    if (!parsed) return false;

    if (parsed.url) {
      setUrl(parsed.url);
    }
    if (parsed.method) {
      setMethod(parsed.method);
    }
    if (parsed.headers && parsed.headers.length > 0) {
      const nonAuthHeaders: KeyValuePair[] = [];
      let foundBearer = '';

      parsed.headers.forEach(h => {
        const lowerKey = h.key.toLowerCase();
        if (lowerKey === 'authorization') {
          if (h.value.toLowerCase().startsWith('bearer ')) {
            foundBearer = h.value.substring(7).trim();
          } else {
            nonAuthHeaders.push(h);
          }
        } else {
          nonAuthHeaders.push(h);
        }
      });

      setHeaders(nonAuthHeaders.length > 0 ? nonAuthHeaders : [
        { id: 'h1', key: 'Accept', value: '*/*', enabled: true }
      ]);

      if (foundBearer) {
        setAuthType('bearer');
        setBearerToken(foundBearer);
      }
    }

    if (parsed.auth) {
      if (parsed.auth.type === 'bearer' && parsed.auth.bearerToken) {
        setAuthType('bearer');
        setBearerToken(parsed.auth.bearerToken);
      } else if (parsed.auth.type === 'basic') {
        setAuthType('basic');
        if (parsed.auth.basicUser) setBasicUser(parsed.auth.basicUser);
        if (parsed.auth.basicPass) setBasicPass(parsed.auth.basicPass);
      }
    }

    if (parsed.body) {
      if (parsed.body.type === 'json' && parsed.body.json) {
        setBodyPayload(parsed.body.json);
        setActiveTab('body');
      } else if (parsed.body.raw) {
        setBodyPayload(parsed.body.raw);
        setActiveTab('body');
      }
    }

    if (parsed.params && parsed.params.length > 0) {
      setQueryParams(parsed.params);
    }

    showCurlBanner(`Imported cURL: ${parsed.method || 'GET'} ${parsed.url}`);
    return true;
  };

  // Direct paste handler on URL input
  const handleUrlChange = (newVal: string) => {
    if (isCurlCommand(newVal)) {
      const success = applyParsedCurl(newVal);
      if (success) return;
    }
    setUrl(newVal);
  };

  // Sync from Current Active Request in workspace
  const handleSyncFromCurrentRequest = () => {
    if (!activeRequest) return;
    setUrl(activeRequest.url);
    setMethod(activeRequest.method);

    if (activeRequest.headers && activeRequest.headers.length > 0) {
      setHeaders(activeRequest.headers.map(h => ({ ...h })));
    }
    if (activeRequest.params && activeRequest.params.length > 0) {
      setQueryParams(activeRequest.params.map(q => ({ ...q })));
    }
    if (activeRequest.auth) {
      if (activeRequest.auth.type === 'bearer') {
        setAuthType('bearer');
        setBearerToken(activeRequest.auth.bearerToken || '');
      } else if (activeRequest.auth.type === 'basic') {
        setAuthType('basic');
        setBasicUser(activeRequest.auth.basicUser || '');
        setBasicPass(activeRequest.auth.basicPass || '');
      } else if (activeRequest.auth.type === 'apikey') {
        setAuthType('apikey');
        setApiKeyName(activeRequest.auth.apiKeyName || 'X-API-Key');
        setApiKeyValue(activeRequest.auth.apiKeyValue || '');
        setApiKeyPlacement((activeRequest.auth.apiKeyLocation as any) || 'header');
      } else {
        setAuthType('none');
      }
    }
    if (activeRequest.body?.type === 'json' && activeRequest.body.json) {
      setBodyPayload(activeRequest.body.json);
    } else if (activeRequest.body?.raw) {
      setBodyPayload(activeRequest.body.raw);
    }

    showCurlBanner(`Populated all parameters from "${activeRequest.name}"`);
  };

  // Header management
  const handleAddHeader = (key = '', value = '') => {
    setHeaders(prev => [
      ...prev,
      { id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5), key, value, enabled: true }
    ]);
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    setHeaders(prev => prev.map(h => h.id === id ? { ...h, [field]: val } : h));
  };

  const handleDeleteHeader = (id: string) => {
    setHeaders(prev => prev.filter(h => h.id !== id));
  };

  // Query Params management
  const handleAddParam = () => {
    setQueryParams(prev => [
      ...prev,
      { id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5), key: '', value: '', enabled: true }
    ]);
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    setQueryParams(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const handleDeleteParam = (id: string) => {
    setQueryParams(prev => prev.filter(p => p.id !== id));
  };

  // Format JSON payload
  const handleFormatJson = () => {
    try {
      if (!bodyPayload.trim()) return;
      const parsed = JSON.parse(bodyPayload);
      setBodyPayload(JSON.stringify(parsed, null, 2));
    } catch {
      alert('Invalid JSON: Could not format.');
    }
  };

  const handleBodyChange = (newVal: string) => {
    setBodyPayload(newVal);
    if (newVal.trim().length > 0 && method === 'GET') {
      setMethod('POST');
      showCurlBanner('Auto-switched HTTP Method from GET to POST because a request body was entered');
    }
  };

  // Execute Load Test
  const handleRunLoadTest = async (overrideEngine?: 'backend' | 'browser') => {
    if (!url.trim()) {
      setErrorMessage('Please specify a target endpoint URL.');
      return;
    }

    let effectiveMethod = method.toUpperCase();
    if (bodyPayload.trim().length > 0 && effectiveMethod === 'GET') {
      effectiveMethod = 'POST';
      setMethod('POST');
      showCurlBanner('Auto-switched HTTP Method to POST to transmit request body');
    }

    setIsRunning(true);
    setErrorMessage(null);
    setTestResult(null);
    setElapsedSec(0);
    setLiveRequestsCount(0);
    setLiveRps(0);

    // Resolve URL with query params
    let resolvedUrl = resolveTemplateString(url.trim(), {
      activeEnvironment,
      globalVariables
    });

    // Append enabled query parameters
    const activeParams = queryParams.filter(p => p.enabled && p.key);
    if (activeParams.length > 0) {
      const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `https://${resolvedUrl}`);
      activeParams.forEach(p => {
        const resolvedVal = resolveTemplateString(p.value, {
          activeEnvironment,
          globalVariables
        });
        urlObj.searchParams.append(p.key, resolvedVal);
      });
      resolvedUrl = urlObj.toString();
    }

    // Prepare Request Headers
    const headersMap: Record<string, string> = {
      'user-agent': 'ApiDesk-LoadTester/1.0',
      'accept': '*/*'
    };

    // Add custom configured headers
    headers.filter(h => h.enabled && h.key).forEach(h => {
      const resolvedVal = resolveTemplateString(h.value, {
        activeEnvironment,
        globalVariables
      });
      headersMap[h.key] = resolvedVal;
    });

    // Apply Auth configuration
    if (authType === 'bearer' && bearerToken.trim()) {
      const resolvedToken = resolveTemplateString(bearerToken.trim(), {
        activeEnvironment,
        globalVariables
      });
      headersMap['Authorization'] = resolvedToken.startsWith('Bearer ') ? resolvedToken : `Bearer ${resolvedToken}`;
    } else if (authType === 'basic' && (basicUser || basicPass)) {
      const resolvedUser = resolveTemplateString(basicUser, { activeEnvironment, globalVariables });
      const resolvedPass = resolveTemplateString(basicPass, { activeEnvironment, globalVariables });
      const encoded = btoa(`${resolvedUser}:${resolvedPass}`);
      headersMap['Authorization'] = `Basic ${encoded}`;
    } else if (authType === 'apikey' && apiKeyName.trim() && apiKeyValue.trim()) {
      const resolvedKeyVal = resolveTemplateString(apiKeyValue.trim(), { activeEnvironment, globalVariables });
      if (apiKeyPlacement === 'header') {
        headersMap[apiKeyName.trim()] = resolvedKeyVal;
      } else {
        try {
          const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `https://${resolvedUrl}`);
          urlObj.searchParams.append(apiKeyName.trim(), resolvedKeyVal);
          resolvedUrl = urlObj.toString();
        } catch {}
      }
    }

    // Resolve Body
    let resolvedBody: string | undefined = undefined;
    if (bodyPayload.trim() && (effectiveMethod === 'POST' || effectiveMethod === 'PUT' || effectiveMethod === 'PATCH' || effectiveMethod === 'DELETE')) {
      resolvedBody = resolveTemplateString(bodyPayload, {
        activeEnvironment,
        globalVariables
      });
      if (!headersMap['Content-Type'] && !headersMap['content-type']) {
        headersMap['Content-Type'] = 'application/json';
      }
    }

    const payload: LoadTestConfig = {
      url: resolvedUrl,
      method: effectiveMethod,
      headers: headersMap,
      body: resolvedBody,
      connections: Number(connections) || 15,
      duration: Number(duration) || 10,
      pipelining: Number(pipelining) || 1,
      timeout: Number(timeout) || 10,
      rate: rateLimit ? Number(rateLimit) : undefined,
      amount: amount ? Number(amount) : undefined
    };

    const currentEngine = overrideEngine || engineMode;

    setDebugInspectorData({
      title: `Load Test: ${resolvedUrl}`,
      endpoint: currentEngine === 'browser' ? 'browser://fetch-workers' : '/api/load-test',
      method: currentEngine === 'browser' ? 'LOCAL' : 'POST',
      engineMode: currentEngine,
      requestPayload: payload,
      requestHeaders: {
        'Content-Type': 'application/json',
        'X-Load-Engine': currentEngine
      },
      executionLogs: [
        {
          id: 'log_load_init',
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          title: 'Load Test Configured',
          message: `Target: [${payload.method}] ${payload.url} with ${payload.connections} connections for ${payload.duration}s via ${currentEngine === 'browser' ? 'In-Browser Load Engine' : 'Backend Autocannon Engine'}.`,
          details: { ...payload }
        }
      ]
    });

    // Browser Engine Mode
    if (currentEngine === 'browser') {
      await runBrowserLoadTest(
        resolvedUrl,
        method.toUpperCase(),
        headersMap,
        resolvedBody,
        Number(connections) || 15,
        Number(duration) || 10
      );
      return;
    }

    // Backend Autocannon Mode with live simulation ticker
    const startTime = Date.now();
    const durationSec = payload.duration;
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const currentElapsed = Math.min(durationSec, Math.floor((now - startTime) / 1000));
      setElapsedSec(currentElapsed);
    }, 250);

    try {
      addDebugLog('info', 'Dispatching Autocannon Request', 'Sending POST /api/load-test to local Express load testing daemon...', {
        connections: payload.connections,
        duration: payload.duration
      });

      const response = await fetch('/api/load-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(timerIntervalRef.current);

      const responseHeadersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeadersObj[key] = val;
      });

      const responseText = await response.text();
      const isHtml = responseText.trim().startsWith('<') || (response.headers.get('content-type') || '').includes('text/html');

      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch (parseErr) {
        if (isHtml) {
          addDebugLog('error', 'HTML Gateway Output Received', 'The server returned an HTML document instead of JSON. The dev proxy may be initializing.', {
            htmlSnippet: responseText.substring(0, 300)
          });
          setDebugInspectorData(prev => ({
            ...prev,
            responseStatus: response.status,
            responseStatusText: response.statusText,
            responseHeaders: responseHeadersObj,
            rawResponseText: responseText,
            isHtmlResponse: true,
            error: 'Backend returned HTML instead of JSON.'
          }));
          throw new Error(
            'Server returned HTML output instead of JSON. You can click "Run in Browser Load Engine" below to execute concurrent requests directly without backend dependency!'
          );
        }
        throw new Error(`Failed to parse response: ${responseText.substring(0, 100)}`);
      }

      setDebugInspectorData(prev => ({
        ...prev,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseHeaders: responseHeadersObj,
        responseBody: json,
        rawResponseText: responseText,
        isHtmlResponse: false
      }));

      if (!response.ok || !json.success) {
        addDebugLog('warn', 'Backend Autocannon Error', json.error || json.detail || 'Load test execution failed');
        throw new Error(json.error || json.detail || 'Failed to complete load test.');
      }

      const res: LoadTestResult = json.result;
      const audit = computeSlaAndApdexAudit(res, slaThresholds);

      // Save to history
      saveResultToHistory(res, audit);

      setTestResult(res);
      addDebugLog('success', 'Load Test Completed', `Generated ${res.totalRequests} requests (${res.requestsPerSecond} RPS) with ${res.errors} errors.`);
    } catch (err: any) {
      clearInterval(timerIntervalRef.current);
      setErrorMessage(err.message || 'An error occurred while running the load test.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyMetrics = async () => {
    if (!testResult) return;
    const audit = computeSlaAndApdexAudit(testResult, slaThresholds);
    const formatted = `=== ApiDesk Load Test & SLA Report ===
Target URL     : ${testResult.url} (${testResult.method})
Connections    : ${testResult.connections} concurrent clients
Duration       : ${testResult.durationActual}s
Total Requests : ${testResult.totalRequests.toLocaleString()}
Req / sec (RPS): ${testResult.requestsPerSecond.toFixed(2)}
Throughput/sec : ${(testResult.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
Total Volume   : ${(testResult.totalBytes / 1024 / 1024).toFixed(2)} MB
Errors / Timeouts: ${testResult.errors} / ${testResult.timeouts}
Non-2xx Status : ${testResult.non2xx}

SLA Health Score: ${audit.score} / 100 (${audit.passed ? 'PASSED' : 'FAILED'})
Apdex User Score: ${audit.apdex.score} (${audit.apdex.rating})

Latency Percentiles:
  Average : ${testResult.latency.average.toFixed(2)} ms
  p50 (Median) : ${testResult.latency.p50} ms
  p75     : ${testResult.latency.p75} ms
  p90     : ${testResult.latency.p90} ms
  p97.5   : ${testResult.latency.p97_5} ms
  p99     : ${testResult.latency.p99} ms
  p99.9   : ${testResult.latency.p99_9} ms
  Max     : ${testResult.latency.max} ms
================================`;
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeHeadersCount = headers.filter(h => h.enabled && h.key).length + (authType !== 'none' ? 1 : 0);
  const activeParamsCount = queryParams.filter(p => p.enabled && p.key).length;

  // Compute live audit if result exists
  const activeAudit: SlaAuditResult | null = testResult 
    ? computeSlaAndApdexAudit(testResult, slaThresholds)
    : null;

  const currentConfigPayload: LoadTestConfig = {
    url,
    method,
    headers: headers.filter(h => h.enabled && h.key).reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
    body: bodyPayload,
    connections,
    duration,
    pipelining,
    timeout
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Banner */}
      <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
            <Flame className="w-4 h-4 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Enterprise Load Testing &amp; Performance Intelligence Suite
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                SLA &amp; Apdex Audits
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Benchmark RPS throughput, tail latency percentiles (p50-p99.99), bottleneck diagnostics, and SLA thresholds.
            </p>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {curlNotice && (
            <span className="text-xs text-emerald-300 bg-emerald-950/90 border border-emerald-800 px-2.5 py-1 rounded-md animate-fade-in flex items-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5" />
              {curlNotice}
            </span>
          )}

          <button
            type="button"
            id="btn-open-loadtest-diagnostics"
            onClick={() => setIsDebugModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition cursor-pointer ${
              debugInspectorData.isHtmlResponse || errorMessage
                ? 'bg-rose-950/80 text-rose-300 border-rose-700/80 hover:bg-rose-900/80 animate-pulse'
                : 'bg-slate-850 hover:bg-slate-800 text-amber-300 border-amber-500/30'
            }`}
            title="Open Diagnostic Debugger & Request/Response Inspector"
          >
            <Bug className="w-3.5 h-3.5 text-amber-400" />
            <span>Diagnostics &amp; Logs</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurlInputText('');
              setIsCurlModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-amber-300 border border-amber-500/30 transition cursor-pointer"
            title="Import or paste a cURL command"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Paste / Import cURL</span>
          </button>

          {activeRequest && (
            <button
              type="button"
              onClick={handleSyncFromCurrentRequest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-850 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-750 transition cursor-pointer"
              title={`Load settings from "${activeRequest.name}"`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">From Active Request ({activeRequest.name})</span>
              <span className="sm:hidden">From Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Parameters / Headers / Auth on Left, Output & Insights on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        
        {/* ================= LEFT COLUMN: CONFIGURATION & PRESETS (5 cols) ================= */}
        <div className="lg:col-span-5 border-r border-slate-800/80 flex flex-col bg-slate-950/60 overflow-hidden">
          
          {/* Target URL & Method Header Bar */}
          <div className="p-3 border-b border-slate-800 flex flex-col gap-1.5 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400">Target Endpoint / cURL</label>
              <span className="text-[10px] text-slate-500">Paste cURL or endpoint URL</span>
            </div>
            <div className="flex rounded-md border border-slate-800 bg-slate-900 overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="bg-slate-850 px-2.5 py-1.5 text-xs font-bold text-amber-400 border-r border-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (isCurlCommand(pasted)) {
                    e.preventDefault();
                    applyParsedCurl(pasted);
                  }
                }}
                placeholder="https://api.example.com/v1/resource or paste curl..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center px-3 border-b border-slate-800 bg-slate-900/30 gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Load Parameters</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`py-2 px-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'headers'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Headers</span>
              {activeHeadersCount > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded-full">
                  {activeHeadersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`py-2 px-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'auth'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Auth &amp; Tokens</span>
              {authType !== 'none' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('params')}
              className={`py-2 px-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'params'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Params</span>
              {activeParamsCount > 0 && (
                <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.2 rounded-full">
                  {activeParamsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('body')}
              className={`py-2 px-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'body'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Body</span>
              {bodyPayload.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 p-3.5 overflow-y-auto flex flex-col gap-3">
            
            {/* 1. LOAD SETTINGS TAB WITH PRESETS */}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-3.5">
                {/* 1-Click Profile Presets Bar */}
                <LoadTesterPresets
                  currentConnections={connections}
                  currentDuration={duration}
                  onSelectProfile={handleSelectProfile}
                  disabled={isRunning}
                />

                {/* Concurrency & Duration Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Concurrent Clients (VUs)</label>
                      <span className="text-xs font-bold text-amber-400 font-mono">{connections}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="300"
                      value={connections}
                      onChange={(e) => setConnections(Number(e.target.value))}
                      className="accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>1</span>
                      <span>50</span>
                      <span>150</span>
                      <span>300</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Duration (seconds)</label>
                      <span className="text-xs font-bold text-amber-400 font-mono">{duration}s</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="120"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>3s</span>
                      <span>30s</span>
                      <span>60s</span>
                      <span>120s</span>
                    </div>
                  </div>
                </div>

                {/* Pipelining, Rate Limit, Timeout */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-slate-400">Pipelining</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={pipelining}
                      onChange={(e) => setPipelining(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Loops per socket</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-slate-400">Rate Cap (RPS)</label>
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Max req / sec</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-slate-400">Timeout (sec)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={timeout}
                      onChange={(e) => setTimeoutSec(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Per-socket limit</span>
                  </div>
                </div>

                {/* Engine Mode Switcher */}
                <div className="flex flex-col gap-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Load Engine Runner
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {engineMode === 'backend' ? 'High-Performance Node Socket Daemon' : 'Direct Browser Concurrent Workers'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEngineMode('backend')}
                      className={`p-2 rounded border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                        engineMode === 'backend'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Backend Autocannon
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Native socket speed &amp; pipelining
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEngineMode('browser')}
                      className={`p-2 rounded border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                        engineMode === 'browser'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-sky-400" />
                        In-Browser Multi-Fetch
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Zero backend dependency sandbox
                      </span>
                    </button>
                  </div>
                </div>

                {/* Workspace Variable Notice */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5 text-[11px] text-slate-400 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-300">Dynamic Environment Variables: </span>
                    Interpolate variables like <span className="font-mono text-amber-300">{`{{BASE_URL}}`}</span> or <span className="font-mono text-amber-300">{`{{AUTH_TOKEN}}`}</span> across URLs, headers, and payloads.
                  </div>
                </div>
              </div>
            )}

            {/* 2. HEADERS TAB */}
            {activeTab === 'headers' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">HTTP Headers</span>
                    <span className="text-[10px] text-slate-500 font-mono">({headers.length} defined)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddHeader('Content-Type', 'application/json')}
                      className="text-[10px] text-slate-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                    >
                      + JSON Type
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddHeader()}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Header
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {headers.map((h) => (
                    <div key={h.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => handleUpdateHeader(h.id, 'enabled', e.target.checked)}
                        className="accent-amber-500 rounded"
                        title="Enable/disable header"
                      />
                      <input
                        type="text"
                        placeholder="Header (e.g. Authorization)"
                        value={h.key}
                        onChange={(e) => handleUpdateHeader(h.id, 'key', e.target.value)}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Bearer {{TOKEN}})"
                        value={h.value}
                        onChange={(e) => handleUpdateHeader(h.id, 'value', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHeader(h.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Delete header"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. AUTHORIZATION & TOKENS TAB */}
            {activeTab === 'auth' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-400">Authentication Scheme</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-bold text-amber-400 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="none">No Authentication</option>
                    <option value="bearer">Bearer Token (JWT / OAuth2 Token)</option>
                    <option value="basic">Basic Auth (Username / Password)</option>
                    <option value="apikey">API Key (Custom Header / Query)</option>
                  </select>
                </div>

                {authType === 'bearer' && (
                  <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span>Bearer Token</span>
                      <span className="text-[10px] text-slate-500">Supports {`{{TOKEN}}`} variable</span>
                    </label>
                    <input
                      type="text"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... or {{JWT_TOKEN}}"
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">
                      Will be automatically attached as <span className="font-mono text-slate-400">Authorization: Bearer &lt;token&gt;</span>
                    </p>
                  </div>
                )}

                {authType === 'basic' && (
                  <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-slate-400">Username</label>
                      <input
                        type="text"
                        value={basicUser}
                        onChange={(e) => setBasicUser(e.target.value)}
                        placeholder="admin or {{USER}}"
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-400">Password</label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={basicPass}
                        onChange={(e) => setBasicPass(e.target.value)}
                        placeholder="•••••••• or {{PASSWORD}}"
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {authType === 'apikey' && (
                  <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-slate-400">Key Name</label>
                        <input
                          type="text"
                          value={apiKeyName}
                          onChange={(e) => setApiKeyName(e.target.value)}
                          placeholder="X-API-Key"
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-slate-400">Add To</label>
                        <select
                          value={apiKeyPlacement}
                          onChange={(e) => setApiKeyPlacement(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-medium text-amber-400 focus:border-amber-500 focus:outline-none cursor-pointer"
                        >
                          <option value="header">Header</option>
                          <option value="query">Query Param</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-slate-400">Key Value</label>
                      <input
                        type="text"
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        placeholder="secret_key_123 or {{API_KEY}}"
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {authType === 'none' && (
                  <div className="p-4 text-center text-slate-500 text-xs bg-slate-900/30 rounded-lg border border-slate-800/80">
                    No custom authentication selected. Requests will run without an Authorization header unless defined manually under Headers.
                  </div>
                )}
              </div>
            )}

            {/* 4. QUERY PARAMETERS TAB */}
            {activeTab === 'params' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">URL Query Parameters</span>
                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Parameter
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {queryParams.length === 0 ? (
                    <div className="text-[11px] text-slate-500 py-2">
                      No query parameters defined. Click &quot;+ Add Parameter&quot; to append query strings like <span className="font-mono text-slate-400">?limit=50&amp;offset=0</span>.
                    </div>
                  ) : (
                    queryParams.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => handleUpdateParam(p.id, 'enabled', e.target.checked)}
                          className="accent-amber-500 rounded"
                          title="Enable/disable parameter"
                        />
                        <input
                          type="text"
                          placeholder="Key"
                          value={p.key}
                          onChange={(e) => handleUpdateParam(p.id, 'key', e.target.value)}
                          className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={p.value}
                          onChange={(e) => handleUpdateParam(p.id, 'value', e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteParam(p.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          title="Delete parameter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. BODY TAB */}
            {activeTab === 'body' && (
              <div className="flex flex-col gap-2.5">
                {method === 'GET' && (
                  <div className="p-2.5 bg-amber-950/50 border border-amber-500/40 rounded-lg flex items-center justify-between text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Method is set to <strong>GET</strong>. HTTP GET requests do not send a body payload.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('POST');
                        showCurlBanner('Switched HTTP Method to POST');
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 transition cursor-pointer"
                    >
                      Switch to POST
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">Request Body (JSON / Raw Payload)</label>
                  <button
                    type="button"
                    onClick={handleFormatJson}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                  >
                    Beautify JSON
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={bodyPayload}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder='{\n  "username": "tester",\n  "token": "{{API_TOKEN}}"\n}'
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none resize-y leading-relaxed"
                />
              </div>
            )}

          </div>

          {/* Action Trigger Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => { handleRunLoadTest(); }}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                isRunning
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isRunning ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  Running Stress Test ({duration}s with {connections} concurrent users)...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  Launch Autocannon Load Test ({connections} VUs • {duration}s)
                </>
              )}
            </button>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>{connections} Clients • {duration}s Duration</span>
              <span>Method: {method} • Engine: {engineMode === 'backend' ? 'Autocannon' : 'In-Browser'}</span>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: CHARTS, INSIGHTS & RESULTS (7 cols) ================= */}
        <div className="lg:col-span-7 p-4 flex flex-col gap-4 overflow-y-auto bg-slate-900/30">
          
          {/* Live Progress Banner during execution */}
          <LoadTesterLiveBanner
            isRunning={isRunning}
            elapsedSec={elapsedSec}
            totalDuration={duration}
            connections={connections}
            engineMode={engineMode}
            liveRequestsCount={liveRequestsCount}
            liveRps={liveRps}
            onAbort={handleAbort}
          />

          {/* Top Bar for Results View Mode & Actions */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('insights')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'insights'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Insights &amp; SLA</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('metrics')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'metrics'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>KPI Metrics</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('charts')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'charts'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Charts</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('history')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'history'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({history.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('export')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'export'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Export &amp; Code</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/50'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>

            {testResult && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMetrics}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
                  title="Copy formatted summary to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Error Banner if any */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-xl flex flex-col gap-2.5 text-xs text-rose-200 shadow-lg animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="font-bold text-rose-300">Load Test Execution Error</span>
                  <span className="text-rose-200/90 leading-relaxed">{errorMessage}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-rose-800/60 justify-end">
                <button
                  type="button"
                  onClick={() => handleRunLoadTest('browser')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-sm cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Run with In-Browser Engine</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDebugModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition cursor-pointer"
                >
                  <Bug className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inspect Diagnostic Logs</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isRunning && !testResult && !errorMessage && (
            <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-8 bg-slate-950 border border-slate-800/80 rounded-xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
                <Gauge className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Enterprise Load Intelligence Ready</h3>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                Choose a 1-click test preset (Smoke, Benchmark, Spike, or Stress), configure custom SLA criteria, and execute to uncover real-time tail latency, Apdex user satisfaction, and bottleneck diagnostics.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCurlModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-amber-300 border border-slate-700 cursor-pointer"
                >
                  Paste cURL Command
                </button>
                <button
                  type="button"
                  onClick={() => { handleRunLoadTest(); }}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-xs font-bold text-slate-950 shadow-md cursor-pointer"
                >
                  Run Baseline Benchmark (15 VUs)
                </button>
              </div>
            </div>
          )}

          {/* RESULTS: View Mode - Insights & SLA Health */}
          {!isRunning && testResult && activeAudit && viewMode === 'insights' && (
            <LoadTesterInsightsTab
              result={testResult}
              audit={activeAudit}
              slaThresholds={slaThresholds}
              onUpdateThresholds={handleUpdateThresholds}
              onSwitchMethod={(newM) => setMethod(newM)}
            />
          )}

          {/* RESULTS: View Mode - KPI Metrics & Status Matrix */}
          {!isRunning && testResult && viewMode === 'metrics' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Failure Root-Cause Diagnostics Card if any errors */}
              <LoadTesterFailureDiagnosticsCard
                result={testResult}
                activeRequest={activeRequest}
                onSwitchMethod={(newM) => setMethod(newM)}
                onSyncFromActiveRequest={handleSyncFromCurrentRequest}
                onRunTest={() => handleRunLoadTest()}
              />

              {/* Top KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
                  <span className="text-xs text-slate-400 font-medium">Req / sec (RPS)</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {testResult.requestsPerSecond.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total: {testResult.totalRequests.toLocaleString()} reqs
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
                  <span className="text-xs text-slate-400 font-medium">Avg Latency</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {testResult.latency.average.toFixed(1)} <span className="text-xs text-slate-400 font-normal">ms</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    p50: {testResult.latency.p50}ms
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
                  <span className="text-xs text-slate-400 font-medium">p99 Latency</span>
                  <span className="text-2xl font-black text-sky-400 font-mono">
                    {testResult.latency.p99} <span className="text-xs text-slate-400 font-normal">ms</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Max: {testResult.latency.max}ms
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
                  <span className="text-xs text-slate-400 font-medium">Throughput</span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    {(testResult.bytesPerSecond / 1024 / 1024).toFixed(2)} <span className="text-xs text-slate-400 font-normal">MB/s</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total: {(testResult.totalBytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>

              {/* Status / Errors Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Total Errors</span>
                    <span className="text-[10px] text-slate-500">Network / Gateway failures</span>
                  </div>
                  <span className={`text-base font-bold font-mono ${testResult.errors > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {testResult.errors}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Timeouts</span>
                    <span className="text-[10px] text-slate-500">Exceeded socket duration</span>
                  </div>
                  <span className={`text-base font-bold font-mono ${testResult.timeouts > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {testResult.timeouts}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Non-2xx Status</span>
                    <span className="text-[10px] text-slate-500">4xx / 5xx responses</span>
                  </div>
                  <span className={`text-base font-bold font-mono ${testResult.non2xx > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {testResult.non2xx}
                  </span>
                </div>
              </div>

              {/* Latency Percentiles Breakdown Table with visual meters */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white">Full Tail Latency Percentiles Breakdown</span>
                  <span className="text-[10px] text-slate-500 font-mono">Response time benchmarks</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p50 (Median)</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{testResult.latency.p50}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p50 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-emerald-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p75</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{testResult.latency.p75}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p75 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-emerald-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p90</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{testResult.latency.p90}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p90 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-sky-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p97.5</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{testResult.latency.p97_5}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p97_5 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-sky-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p99</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">{testResult.latency.p99}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p99 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-amber-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p99.9</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">{testResult.latency.p99_9}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p99_9 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-amber-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">p99.99</span>
                    <span className="text-sm font-bold text-rose-300 font-mono">{testResult.latency.p99_99}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: `${Math.min(100, (testResult.latency.p99_99 / Math.max(1, testResult.latency.max)) * 100)}%` }} className="bg-rose-400 h-full" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">Max Peak</span>
                    <span className="text-sm font-bold text-rose-400 font-mono">{testResult.latency.max}ms</span>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div style={{ width: '100%' }} className="bg-rose-500 h-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Code Matrix */}
              {testResult.statusCodes && Object.keys(testResult.statusCodes).length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white">HTTP Status Code Distribution Breakdown</span>
                    <span className="text-[10px] text-slate-500 font-mono">Response code share</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {Object.entries(testResult.statusCodes).map(([code, count]) => {
                      const share = ((count / Math.max(1, testResult.totalRequests)) * 100).toFixed(1);
                      const is2xx = code.startsWith('2');
                      const is3xx = code.startsWith('3');
                      const is4xx = code.startsWith('4');
                      const is5xx = code.startsWith('5');

                      let badgeColor = 'text-sky-300 bg-sky-500/10 border-sky-500/30';
                      if (is2xx) badgeColor = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
                      else if (is4xx) badgeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/30';
                      else if (is5xx) badgeColor = 'text-rose-300 bg-rose-500/10 border-rose-500/30';

                      return (
                        <div key={code} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${badgeColor} w-fit`}>
                              HTTP {code}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1 font-mono">{share}% share</span>
                          </div>
                          <span className="text-base font-black font-mono text-white">{count.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESULTS: View Mode - Charts */}
          {!isRunning && testResult && viewMode === 'charts' && (
            <LoadTesterChartsTab result={testResult} />
          )}

          {/* RESULTS: View Mode - History & Comparisons */}
          {viewMode === 'history' && (
            <LoadTesterHistoryTab
              history={history}
              currentResult={testResult}
              baselineId={baselineId}
              onSetBaseline={(id) => setBaselineId(id)}
              onClearHistory={() => setHistory([])}
              onDeleteHistoryItem={(id) => setHistory(prev => prev.filter(h => h.id !== id))}
            />
          )}

          {/* RESULTS: View Mode - Export & Code Generation */}
          {!isRunning && testResult && activeAudit && viewMode === 'export' && (
            <LoadTesterExportTab
              result={testResult}
              audit={activeAudit}
              config={currentConfigPayload}
            />
          )}

          {/* RESULTS: View Mode - Raw JSON */}
          {!isRunning && testResult && viewMode === 'raw' && (
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3.5 overflow-auto relative group">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900">
                <span className="text-xs font-semibold text-slate-400">Raw JSON Report</span>
                <CopyButton
                  textToCopy={JSON.stringify(testResult, null, 2)}
                  label="Copy JSON"
                  className="text-[10px] px-2 py-0.5"
                />
              </div>
              <pre className="font-mono text-xs text-slate-300 leading-relaxed">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

        </div>

      </div>

      {/* ================= cURL IMPORT MODAL ================= */}
      {isCurlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-4 flex flex-col gap-3 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Import cURL Command</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCurlModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste any cURL request. ApiDesk will automatically extract the target URL, HTTP Method, Authentication Tokens, Headers, and Request Body.
            </p>

            <textarea
              rows={8}
              value={curlInputText}
              onChange={(e) => setCurlInputText(e.target.value)}
              placeholder={`curl -X POST https://api.example.com/v1/auth/login \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer eyJhbGciOi...' \\
  -d '{"username": "admin", "password": "password123"}'`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCurlModalOpen(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const success = applyParsedCurl(curlInputText);
                  if (success) {
                    setIsCurlModalOpen(false);
                  } else {
                    alert('Could not parse cURL command. Please verify syntax.');
                  }
                }}
                className="px-4 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer"
              >
                Import into Load Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Inspector Modal */}
      <DebugInspectorModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        data={debugInspectorData}
        onRunBrowserFallback={() => handleRunLoadTest('browser')}
        fallbackLabel="Run In-Browser Multi-Fetch Engine"
      />

    </div>
  );
};
