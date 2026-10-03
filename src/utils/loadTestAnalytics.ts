import { LoadTestResult, SlaThresholds, SlaAuditResult, LatencyBucket, LoadTestConfig } from '../types/loadTesting';

export const DEFAULT_SLA_THRESHOLDS: SlaThresholds = {
  maxP95Ms: 400,
  maxP99Ms: 800,
  maxErrorPercent: 1.0,
  minRps: 50,
  maxTimeouts: 0,
  targetApdexMs: 250
};

/**
 * Calculates Apdex Score and performs an SLA Audit on the test results
 */
export function computeSlaAndApdexAudit(
  result: LoadTestResult,
  thresholds: SlaThresholds = DEFAULT_SLA_THRESHOLDS
): SlaAuditResult {
  const total = Math.max(1, result.totalRequests);
  const p95 = result.latency.p97_5 || result.latency.p90 || result.latency.average;
  const p99 = result.latency.p99 || result.latency.max;
  const errorRate = (result.errors / total) * 100;
  const rps = result.requestsPerSecond;
  const targetT = thresholds.targetApdexMs;
  const tolerating4T = targetT * 4;

  // Approximate satisfaction counts based on average and percentiles
  let satisfiedRatio = 0.8;
  if (result.latency.p50 <= targetT) {
    if (result.latency.p90 <= targetT) {
      satisfiedRatio = 0.95;
    } else {
      satisfiedRatio = 0.75;
    }
  } else if (result.latency.p50 <= tolerating4T) {
    satisfiedRatio = 0.35;
  } else {
    satisfiedRatio = 0.05;
  }

  // Account for errors
  if (errorRate > 0) {
    satisfiedRatio = Math.max(0, satisfiedRatio - (errorRate / 100));
  }

  let toleratingRatio = Math.max(0, Math.min(1 - satisfiedRatio, 0.4));
  if (result.latency.p99 > tolerating4T) {
    toleratingRatio = Math.max(0.1, toleratingRatio * 0.7);
  }

  const satisfiedCount = Math.round(total * satisfiedRatio);
  const toleratingCount = Math.round(total * toleratingRatio);
  const frustratedCount = Math.max(0, total - satisfiedCount - toleratingCount);

  // Apdex = (Satisfied + (Tolerating / 2)) / Total
  const apdexScore = Number(Math.min(1, Math.max(0, (satisfiedCount + toleratingCount / 2) / total)).toFixed(2));

  let apdexRating: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Poor';
  if (apdexScore >= 0.94) apdexRating = 'Excellent';
  else if (apdexScore >= 0.85) apdexRating = 'Good';
  else if (apdexScore >= 0.70) apdexRating = 'Fair';

  // SLA Checks
  const checks: SlaAuditResult['checks'] = [
    {
      id: 'p95',
      label: 'p95 Latency Threshold',
      target: `< ${thresholds.maxP95Ms} ms`,
      actual: `${Math.round(p95)} ms`,
      passed: p95 <= thresholds.maxP95Ms,
      critical: true
    },
    {
      id: 'p99',
      label: 'p99 Tail Latency Threshold',
      target: `< ${thresholds.maxP99Ms} ms`,
      actual: `${Math.round(p99)} ms`,
      passed: p99 <= thresholds.maxP99Ms,
      critical: false
    },
    {
      id: 'error_rate',
      label: 'Maximum Error Rate',
      target: `< ${thresholds.maxErrorPercent}%`,
      actual: `${errorRate.toFixed(2)}% (${result.errors} errors)`,
      passed: errorRate <= thresholds.maxErrorPercent,
      critical: true
    },
    {
      id: 'min_rps',
      label: 'Throughput Capacity',
      target: `≥ ${thresholds.minRps} req/s`,
      actual: `${Math.round(rps)} req/s`,
      passed: rps >= thresholds.minRps,
      critical: false
    },
    {
      id: 'timeouts',
      label: 'Zero Timeout Guarantee',
      target: `≤ ${thresholds.maxTimeouts} timeouts`,
      actual: `${result.timeouts} timeouts`,
      passed: result.timeouts <= thresholds.maxTimeouts,
      critical: true
    }
  ];

  const passedCount = checks.filter(c => c.passed).length;
  const criticalPassed = checks.filter(c => c.critical).every(c => c.passed);
  const overallPassed = criticalPassed && (passedCount >= 4);

  // Overall Score (0 - 100)
  let computedScore = Math.round(
    (apdexScore * 40) +
    (checks.filter(c => c.passed).length / checks.length * 40) +
    (Math.max(0, 100 - errorRate * 5) * 0.2)
  );
  computedScore = Math.max(5, Math.min(100, computedScore));

  // Diagnostics & Root Cause Advice
  const diagnostics: SlaAuditResult['diagnostics'] = [];

  // 1. Status Code Specific Diagnostics & Failure Reasons
  // Check if sample response contains JSON root $ validation error
  const sampleProbeBody = result.sampleProbe?.body || '';
  const isRootDollarError = sampleProbeBody.includes('value for $ is invalid') || sampleProbeBody.includes('BadRequestError');

  if (isRootDollarError) {
    diagnostics.push({
      type: 'critical',
      title: 'JSON Root ($) Validation Error',
      message: 'The target server rejected the request body with "The provided value for $ is invalid." The symbol "$" represents the root JSON document in schema validators. This happens when the request is sent with HTTP GET (which sends no body), or when the server expects a single JSON Object { ... } instead of an Array [ ... ] (or vice-versa).',
      recommendation: 'Ensure the HTTP Method is set to POST, and check whether the endpoint expects a single JSON object instead of an array.'
    });
  }

  if (result.failureReasons && result.failureReasons.length > 0) {
    result.failureReasons.forEach(fr => {
      diagnostics.push({
        type: Number(fr.code) >= 500 ? 'critical' : Number(fr.code) === 405 || Number(fr.code) === 401 || Number(fr.code) === 403 ? 'critical' : 'warning',
        title: `${fr.meaning} (${fr.count} requests • ${fr.percentage}%)`,
        message: fr.reason,
        recommendation: fr.fixRecommendation
      });
    });
  } else if (result.statusCodes && Object.keys(result.statusCodes).length > 0) {
    for (const [codeStr, count] of Object.entries(result.statusCodes)) {
      const codeNum = parseInt(codeStr, 10);
      const pct = ((count / Math.max(1, result.totalRequests)) * 100).toFixed(1);
      if (codeNum === 405) {
        diagnostics.push({
          type: 'critical',
          title: `HTTP 405 Method Not Allowed (${count} reqs • ${pct}%)`,
          message: `The target server explicitly rejected HTTP ${result.method}. The endpoint does not accept ${result.method} requests.`,
          recommendation: `Change the HTTP Method selector to ${result.method === 'GET' ? 'POST or PUT' : 'GET or POST'} and configure the required payload in the Body tab.`
        });
      } else if (codeNum === 401 || codeNum === 403) {
        diagnostics.push({
          type: 'critical',
          title: `HTTP ${codeNum} ${codeNum === 401 ? 'Unauthorized' : 'Forbidden'} (${count} reqs • ${pct}%)`,
          message: `Authentication or permission check failed on ${count} requests.`,
          recommendation: `Go to 'Auth & Tokens' tab and supply a valid Bearer Token, API Key, or Basic Auth credentials.`
        });
      } else if (codeNum === 400 || codeNum === 422) {
        diagnostics.push({
          type: 'warning',
          title: `HTTP ${codeNum} ${codeNum === 400 ? 'Bad Request' : 'Unprocessable Entity'} (${count} reqs • ${pct}%)`,
          message: `Request payload or parameter validation failed on ${count} requests.`,
          recommendation: `Inspect the sample server response body and verify your JSON payload in the Body tab.`
        });
      } else if (codeNum === 429) {
        diagnostics.push({
          type: 'warning',
          title: `HTTP 429 Rate Limited (${count} reqs • ${pct}%)`,
          message: `Target endpoint rate limiting or WAF triggered by high concurrency.`,
          recommendation: `Decrease Concurrent Clients (VUs) or add a Rate Cap (RPS) limit in Load Parameters.`
        });
      } else if (codeNum >= 500) {
        diagnostics.push({
          type: 'critical',
          title: `HTTP ${codeNum} Server Exception (${count} reqs • ${pct}%)`,
          message: `Backend application service or gateway proxy returned error status ${codeNum}.`,
          recommendation: `Check backend application logs and database queries for unhandled server crashes under load.`
        });
      }
    }
  }

  if (result.errors === 0 && result.non2xx === 0 && p95 <= thresholds.maxP95Ms && apdexScore >= 0.85) {
    diagnostics.push({
      type: 'success',
      title: 'High-Resilience Endpoint',
      message: `The endpoint maintained flawless zero-error 2xx performance under ${result.connections} concurrent clients with stable response time.`
    });
  }

  if (result.errors > 0 && (!result.failureReasons || result.failureReasons.length === 0)) {
    diagnostics.push({
      type: 'critical',
      title: 'Active Network Socket Failures',
      message: `${result.errors} requests encountered socket connection reset, DNS, or gateway network drops (${errorRate.toFixed(1)}% error rate).`,
      recommendation: 'Verify target host reachability, SSL certificate validity, and proxy timeout settings.'
    });
  }

  if (result.timeouts > 0) {
    diagnostics.push({
      type: 'critical',
      title: 'Socket Connection Timeouts Detected',
      message: `${result.timeouts} requests exceeded client socket timeout limits.`,
      recommendation: 'Verify backend thread pool starvation, event loop lag, or slow downstream external microservices.'
    });
  }

  if (p99 > p95 * 2.5 && p99 > 300) {
    diagnostics.push({
      type: 'warning',
      title: 'High Tail Latency Jitter (p99 Spikes)',
      message: `p99 latency (${Math.round(p99)}ms) is significantly elevated compared to median (${Math.round(result.latency.p50)}ms).`,
      recommendation: 'Tail latency spikes commonly indicate Garbage Collection (GC) pauses, cache misses, or lock contention in transactional databases.'
    });
  }

  if (rps < thresholds.minRps && result.connections >= 20 && result.non2xx === 0) {
    diagnostics.push({
      type: 'info',
      title: 'Throughput Saturation Plateau',
      message: `RPS averaged ${Math.round(rps)} req/s across ${result.connections} concurrent sockets.`,
      recommendation: 'Consider horizontal pod autoscaling, enabling HTTP/2 keep-alive reuse, or offloading compute to asynchronous worker queues.'
    });
  }

  return {
    passed: overallPassed,
    score: computedScore,
    apdex: {
      score: apdexScore,
      rating: apdexRating,
      satisfiedCount,
      toleratingCount,
      frustratedCount,
      targetMs: targetT
    },
    checks,
    diagnostics
  };
}

/**
 * Builds latency buckets for a histogram visualization
 */
export function generateLatencyHistogram(
  latencies: number[] = [],
  result: LoadTestResult
): LatencyBucket[] {
  const buckets: { range: string; minMs: number; maxMs: number; count: number }[] = [
    { range: '< 50ms', minMs: 0, maxMs: 50, count: 0 },
    { range: '50-100ms', minMs: 50, maxMs: 100, count: 0 },
    { range: '100-250ms', minMs: 100, maxMs: 250, count: 0 },
    { range: '250-500ms', minMs: 250, maxMs: 500, count: 0 },
    { range: '500ms-1s', minMs: 500, maxMs: 1000, count: 0 },
    { range: '1s-2s', minMs: 1000, maxMs: 2000, count: 0 },
    { range: '> 2s', minMs: 2000, maxMs: Infinity, count: 0 }
  ];

  if (latencies.length > 0) {
    latencies.forEach(lat => {
      for (const b of buckets) {
        if (lat >= b.minMs && lat < b.maxMs) {
          b.count++;
          break;
        }
      }
    });
  } else {
    // Model from percentiles
    const total = Math.max(1, result.totalRequests);
    const p50 = result.latency.p50 || result.latency.average || 50;
    const p90 = result.latency.p90 || p50 * 1.5;
    const p99 = result.latency.p99 || p90 * 2;

    buckets.forEach(b => {
      const mid = (b.minMs + Math.min(b.maxMs, 2500)) / 2;
      let weight = 0.05;
      if (mid <= p50) weight = 0.5 / 2;
      else if (mid <= p90) weight = 0.4 / 2;
      else if (mid <= p99) weight = 0.08;
      else weight = 0.02;

      b.count = Math.round(total * weight);
    });
  }

  const totalCount = Math.max(1, buckets.reduce((sum, b) => sum + b.count, 0));
  return buckets.map(b => ({
    ...b,
    percentage: Number(((b.count / totalCount) * 100).toFixed(1))
  }));
}

/**
 * Generates synthetic timeline data if backend Autocannon only supplied aggregate statistics
 */
export function generateSyntheticTimeSeries(result: LoadTestResult) {
  const duration = Math.max(1, Math.round(result.durationActual || result.duration || 10));
  const avgRps = result.requestsPerSecond || (result.totalRequests / duration);
  const avgLatency = result.latency.average || 50;
  const p95 = result.latency.p97_5 || result.latency.p90 || avgLatency * 1.4;
  const totalErrors = result.errors;
  const connections = result.connections;

  const points = [];
  for (let s = 1; s <= duration; s++) {
    // Simulate slight natural variance around the mean
    const progress = s / duration;
    // Ramp up in first 10%
    const rampFactor = progress < 0.15 ? (progress / 0.15) : 1;
    const jitter = 0.9 + Math.sin(s * 1.2) * 0.12;
    const rps = Math.round(avgRps * rampFactor * jitter);
    const latJitter = 0.95 + Math.cos(s * 0.9) * 0.1;
    const secLatency = Math.round(avgLatency * latJitter);
    const secP95 = Math.round(p95 * latJitter * 1.05);
    const secErrors = (totalErrors > 0 && s > duration * 0.6) 
      ? Math.round((totalErrors / (duration * 0.4)) * (Math.random() > 0.5 ? 1.5 : 0.5))
      : 0;
    const activeUsers = Math.round(connections * rampFactor);

    points.push({
      second: s,
      rps: Math.max(1, rps),
      avgLatency: Math.max(1, secLatency),
      p95Latency: Math.max(1, secP95),
      errors: secErrors,
      activeUsers
    });
  }
  return points;
}

/**
 * Generates k6 load testing script
 */
export function generateK6Script(config: LoadTestConfig): string {
  const headersJson = JSON.stringify(config.headers || {}, null, 4);
  const bodyString = config.body ? JSON.stringify(config.body) : 'null';

  return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: ${config.connections} },
    { duration: '${config.duration}s', target: ${config.connections} },
    { duration: '3s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = '${config.url}';
  const payload = ${bodyString};
  const params = {
    headers: ${headersJson},
    timeout: '${config.timeout}s'
  };

  const res = http.${config.method.toLowerCase()}(url, payload, params);

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.1);
}`;
}

/**
 * Generates Autocannon CLI command
 */
export function generateAutocannonCli(config: LoadTestConfig): string {
  let cmd = `autocannon -c ${config.connections} -d ${config.duration} -m ${config.method.toUpperCase()}`;
  if (config.pipelining > 1) cmd += ` -p ${config.pipelining}`;
  if (config.rate) cmd += ` --rate ${config.rate}`;
  if (config.timeout) cmd += ` -t ${config.timeout}`;

  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      if (k.toLowerCase() !== 'user-agent') {
        cmd += ` -H "${k}: ${v}"`;
      }
    }
  }

  if (config.body) {
    cmd += ` -b '${config.body.replace(/'/g, "\\'")}'`;
  }

  cmd += ` "${config.url}"`;
  return cmd;
}

/**
 * Generates Artillery YAML script
 */
export function generateArtilleryScript(config: LoadTestConfig): string {
  return `config:
  target: "${config.url}"
  phases:
    - duration: ${config.duration}
      arrivalRate: ${Math.round(config.connections / 2)}
      rampTo: ${config.connections}
      name: "Load Phase"
scenarios:
  - name: "${config.method} Test"
    flow:
      - ${config.method.toLowerCase()}:
          url: "/"
          headers:
${Object.entries(config.headers || {}).map(([k, v]) => `            ${k}: "${v}"`).join('\n')}
${config.body ? `          json: ${config.body}` : ''}`;
}

/**
 * Generates wrk command
 */
export function generateWrkCli(config: LoadTestConfig): string {
  const threads = Math.min(Math.max(2, Math.floor(config.connections / 4)), 16);
  return `wrk -t${threads} -c${config.connections} -d${config.duration}s --latency "${config.url}"`;
}

/**
 * Generates standalone styled HTML Executive Report
 */
export function generateHtmlReport(
  result: LoadTestResult,
  audit: SlaAuditResult,
  config: LoadTestConfig
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ApiDesk Performance &amp; Load Test Report - ${result.method} ${result.url}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; margin: 0; padding: 32px; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #f59e0b; margin: 0; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge-pass { background: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-fail { background: #4c0519; color: #fb7185; border: 1px solid #e11d48; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; }
    .card-label { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
    .card-value { font-size: 24px; font-weight: 800; font-family: monospace; color: #f8fafc; }
    .card-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #1e293b; font-size: 13px; }
    .table th { background: #0f172a; color: #94a3b8; font-weight: 600; }
    .highlight { color: #f59e0b; font-weight: 700; }
    .section-title { font-size: 16px; font-weight: 700; margin: 24px 0 12px 0; color: #e2e8f0; }
    .check-pass { color: #34d399; font-weight: 700; }
    .check-fail { color: #fb7185; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">ApiDesk Load &amp; Stress Performance Report</h1>
        <div class="subtitle">Target: [${result.method}] ${result.url} • Executed at ${new Date(result.completedAt).toLocaleString()}</div>
      </div>
      <div>
        <span class="badge ${audit.passed ? 'badge-pass' : 'badge-fail'}">
          ${audit.passed ? 'SLA Passed (Score ' + audit.score + '/100)' : 'SLA Breached (Score ' + audit.score + '/100)'}
        </span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Requests Per Second</div>
        <div class="card-value highlight">${result.requestsPerSecond.toFixed(1)}</div>
        <div class="card-sub">${result.totalRequests.toLocaleString()} total requests</div>
      </div>
      <div class="card">
        <div class="card-label">Average Latency</div>
        <div class="card-value" style="color: #34d399;">${result.latency.average.toFixed(1)} ms</div>
        <div class="card-sub">p50 median: ${result.latency.p50} ms</div>
      </div>
      <div class="card">
        <div class="card-label">p99 Tail Latency</div>
        <div class="card-value" style="color: #38bdf8;">${result.latency.p99} ms</div>
        <div class="card-sub">Max: ${result.latency.max} ms</div>
      </div>
      <div class="card">
        <div class="card-label">Apdex User Score</div>
        <div class="card-value" style="color: #a855f7;">${audit.apdex.score} <span style="font-size: 14px;">(${audit.apdex.rating})</span></div>
        <div class="card-sub">Target T: ${audit.apdex.targetMs}ms</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="section-title" style="margin-top: 0;">SLA Compliance Threshold Matrix</div>
      <table class="table">
        <thead>
          <tr>
            <th>Audit Objective</th>
            <th>Required SLA Target</th>
            <th>Observed Metric</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${audit.checks.map(c => `
            <tr>
              <td><strong>${c.label}</strong></td>
              <td>${c.target}</td>
              <td><code>${c.actual}</code></td>
              <td><span class="${c.passed ? 'check-pass' : 'check-fail'}">${c.passed ? 'PASS' : 'FAIL'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="section-title" style="margin-top: 0;">Latency Percentiles Distribution</div>
      <table class="table">
        <thead>
          <tr>
            <th>p50 (Median)</th>
            <th>p75</th>
            <th>p90</th>
            <th>p95 / p97.5</th>
            <th>p99</th>
            <th>p99.9</th>
            <th>Max Peak</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${result.latency.p50} ms</td>
            <td>${result.latency.p75} ms</td>
            <td>${result.latency.p90} ms</td>
            <td>${result.latency.p97_5} ms</td>
            <td class="highlight">${result.latency.p99} ms</td>
            <td>${result.latency.p99_9} ms</td>
            <td style="color: #fb7185;">${result.latency.max} ms</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="subtitle" style="text-align: center; margin-top: 32px;">
      Generated by ApiDesk Client Suite • High-Performance Stress Testing Engine
    </div>
  </div>
</body>
</html>`;
}
