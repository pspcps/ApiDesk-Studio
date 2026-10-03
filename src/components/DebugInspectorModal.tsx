import React, { useState, useEffect } from 'react';
import {
  Bug,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Server,
  Layers,
  Terminal,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Zap,
  Activity
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { CopyButton } from './CopyButton';

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  title: string;
  message: string;
  details?: any;
}

export interface DebugInspectorData {
  title: string;
  endpoint: string;
  method: string;
  requestPayload?: any;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseStatusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  rawResponseText?: string;
  isHtmlResponse?: boolean;
  error?: string;
  executionLogs: DebugLogEntry[];
  engineMode?: 'backend' | 'browser';
}

interface DebugInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DebugInspectorData;
  onRunBrowserFallback?: () => void;
  fallbackLabel?: string;
}

export const DebugInspectorModal: React.FC<DebugInspectorModalProps> = ({
  isOpen,
  onClose,
  data,
  onRunBrowserFallback,
  fallbackLabel = 'Run in Browser Sandbox Engine'
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'request' | 'response' | 'server_health'>('timeline');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{
    status: 'success' | 'error' | 'idle';
    latencyMs: number;
    data?: any;
    errorMsg?: string;
  }>({ status: 'idle', latencyMs: 0 });

  const runHealthPing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/debug/ping', { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        if (text.startsWith('<')) {
          setPingResult({
            status: 'error',
            latencyMs: elapsed,
            errorMsg: 'Server returned HTML page (likely gateway/proxy initializing).',
            data: { rawResponse: text.substring(0, 300) }
          });
          return;
        }
      }

      if (res.ok && json?.status === 'online') {
        setPingResult({
          status: 'success',
          latencyMs: elapsed,
          data: json
        });
      } else {
        setPingResult({
          status: 'error',
          latencyMs: elapsed,
          errorMsg: json?.error || `HTTP ${res.status} ${res.statusText}`,
          data: json
        });
      }
    } catch (err: any) {
      setPingResult({
        status: 'error',
        latencyMs: Math.round(performance.now() - start),
        errorMsg: err.message || 'Failed to connect to local backend server.'
      });
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runHealthPing();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyBundle = async () => {
    const bundle = {
      inspectorTitle: data.title,
      timestamp: new Date().toISOString(),
      endpoint: data.endpoint,
      method: data.method,
      engineMode: data.engineMode,
      request: {
        headers: data.requestHeaders,
        payload: data.requestPayload
      },
      response: {
        status: data.responseStatus,
        statusText: data.responseStatusText,
        headers: data.responseHeaders,
        isHtml: data.isHtmlResponse,
        body: data.responseBody || data.rawResponseText
      },
      error: data.error,
      serverPing: pingResult,
      logs: data.executionLogs
    };

    const success = await copyToClipboard(JSON.stringify(bundle, null, 2));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">{data.title}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                  data.error || data.isHtmlResponse
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {data.error || data.isHtmlResponse ? 'DIAGNOSTIC ALERT' : 'STATUS OK'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {data.method} {data.endpoint} {data.responseStatus ? `• Status ${data.responseStatus}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-debug-bundle-btn"
              onClick={handleCopyBundle}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
              title="Copy JSON debug bundle"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Debug Bundle'}</span>
            </button>
            <button
              id="close-debug-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* HTML Response Alert Banner if detected */}
        {data.isHtmlResponse && (
          <div className="px-5 py-3 bg-amber-950/40 border-b border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-200">
              <span className="font-semibold text-amber-100">HTML Gateway Output Detected: </span>
              The request received an HTML page instead of a JSON response. This typically happens if the dev server is reloading,
              an upstream container proxy returned a 502/504 gateway message, or an invalid route was requested.
              {onRunBrowserFallback && (
                <div className="mt-2">
                  <button
                    id="run-browser-fallback-action-btn"
                    onClick={() => {
                      onClose();
                      onRunBrowserFallback();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-md shadow-xs transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    {fallbackLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              id="tab-debug-timeline-btn"
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Event Timeline ({data.executionLogs.length})
            </button>
            <button
              id="tab-debug-request-btn"
              onClick={() => setActiveTab('request')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'request'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Request Payload
            </button>
            <button
              id="tab-debug-response-btn"
              onClick={() => setActiveTab('response')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'response'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Server Response {data.responseStatus ? `(${data.responseStatus})` : ''}
            </button>
            <button
              id="tab-debug-health-btn"
              onClick={() => setActiveTab('server_health')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'server_health'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Backend Health
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Engine:</span>
            <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {data.engineMode === 'browser' ? 'In-Browser Sandbox' : 'Local Backend (Express/Node)'}
            </span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto font-sans">
          {/* 1. Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Execution Step-by-Step Trace</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">{data.executionLogs.length} events recorded</span>
                  {data.executionLogs.length > 0 && (
                    <CopyButton
                      textToCopy={data.executionLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.title}: ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`).join('\n')}
                      label="Copy All Logs"
                      className="text-[10px] px-2 py-0.5"
                    />
                  )}
                </div>
              </div>

              {data.executionLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No execution logs recorded for this operation.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.executionLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border text-xs ${
                        log.level === 'error'
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                          : log.level === 'warn'
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                          : log.level === 'success'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {log.level === 'error' ? (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : log.level === 'warn' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : log.level === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                          <span className="font-semibold">{log.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                          <CopyButton
                            textToCopy={`${log.title}\n${log.message}${log.details ? '\n' + JSON.stringify(log.details, null, 2) : ''}`}
                            showIconOnly
                            title="Copy log entry"
                            className="p-1 bg-slate-900/60 border-slate-800 hover:bg-slate-900"
                            iconSize="w-3 h-3"
                          />
                        </div>
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap ml-6">
                        {log.message}
                      </p>
                      {log.details && (
                        <div className="mt-2 ml-6 p-2 rounded bg-slate-950/60 border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto relative group">
                          <div className="absolute top-1.5 right-1.5">
                            <CopyButton
                              textToCopy={JSON.stringify(log.details, null, 2)}
                              label="Copy JSON"
                              className="text-[9px] px-1.5 py-0.5 bg-slate-900 border-slate-800"
                              iconSize="w-2.5 h-2.5"
                            />
                          </div>
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Request Payload Tab */}
          {activeTab === 'request' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-slate-300">Request URL & Method</div>
                  <CopyButton
                    textToCopy={`${data.method} ${data.endpoint}`}
                    label="Copy URL"
                    className="text-[10px] px-2 py-0.5"
                  />
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-400 mr-2">{data.method}</span>
                    <span>{data.endpoint}</span>
                  </div>
                </div>
              </div>

              {data.requestHeaders && Object.keys(data.requestHeaders).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-slate-300">Request Headers</div>
                    <CopyButton
                      textToCopy={JSON.stringify(data.requestHeaders, null, 2)}
                      label="Copy Headers"
                      className="text-[10px] px-2 py-0.5"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
                    {Object.entries(data.requestHeaders).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-100">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-slate-300">Request Body JSON</div>
                  <CopyButton
                    textToCopy={JSON.stringify(data.requestPayload || {}, null, 2)}
                    label="Copy Body"
                    className="text-[10px] px-2 py-0.5"
                  />
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto">
                  <pre>{JSON.stringify(data.requestPayload || {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {/* 3. Server Response Tab */}
          {activeTab === 'response' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Response Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    (data.responseStatus || 0) >= 200 && (data.responseStatus || 0) < 300
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {data.responseStatus || 'No HTTP Status'} {data.responseStatusText || ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {data.isHtmlResponse && (
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Content-Type: text/html
                    </span>
                  )}
                  <CopyButton
                    textToCopy={data.rawResponseText || (typeof data.responseBody === 'object' ? JSON.stringify(data.responseBody, null, 2) : String(data.responseBody || ''))}
                    label="Copy Response"
                    className="text-[10px] px-2 py-0.5"
                  />
                </div>
              </div>

              {data.responseHeaders && Object.keys(data.responseHeaders).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-slate-300">Response Headers</div>
                    <CopyButton
                      textToCopy={JSON.stringify(data.responseHeaders, null, 2)}
                      label="Copy Headers"
                      className="text-[10px] px-2 py-0.5"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-36 overflow-y-auto">
                    {Object.entries(data.responseHeaders).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-100">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-slate-300">
                    {data.isHtmlResponse ? 'Raw HTML Document Received' : 'Response Body Payload'}
                  </div>
                  <CopyButton
                    textToCopy={data.responseBody ? (typeof data.responseBody === 'object' ? JSON.stringify(data.responseBody, null, 2) : String(data.responseBody)) : (data.rawResponseText || '')}
                    label="Copy Content"
                    className="text-[10px] px-2 py-0.5"
                  />
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto">
                  {data.responseBody ? (
                    <pre>{typeof data.responseBody === 'object' ? JSON.stringify(data.responseBody, null, 2) : data.responseBody}</pre>
                  ) : data.rawResponseText ? (
                    <pre className="whitespace-pre-wrap">{data.rawResponseText}</pre>
                  ) : (
                    <span className="text-slate-500">No response body received</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Backend Health Tab */}
          {activeTab === 'server_health' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${
                    pingResult.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : pingResult.status === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">Backend Express Server Health</h4>
                    <p className="text-xs text-slate-400">Endpoint: /api/debug/ping</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {pingResult.status === 'success' && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                      ONLINE ({pingResult.latencyMs}ms)
                    </span>
                  )}
                  {pingResult.status === 'error' && (
                    <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                      OFFLINE / ERROR ({pingResult.latencyMs}ms)
                    </span>
                  )}
                  <button
                    id="trigger-health-ping-btn"
                    onClick={runHealthPing}
                    disabled={isPinging}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>Ping Server</span>
                  </button>
                </div>
              </div>

              {pingResult.errorMsg && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Server Ping Error:</span>
                    <CopyButton
                      textToCopy={pingResult.errorMsg}
                      label="Copy Error"
                      className="text-[10px] px-1.5 py-0.5"
                    />
                  </div>
                  <div>{pingResult.errorMsg}</div>
                </div>
              )}

              {pingResult.data && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-slate-300">Server Diagnostics Data</div>
                    <CopyButton
                      textToCopy={JSON.stringify(pingResult.data, null, 2)}
                      label="Copy Diagnostics JSON"
                      className="text-[10px] px-2 py-0.5"
                    />
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto">
                    <pre>{JSON.stringify(pingResult.data, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Troubleshooting Tips */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2 text-xs text-slate-300">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Quick Troubleshooting Reference
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>If server returns HTML doctype, the cloud container reverse proxy or dev server is still starting or recycling.</li>
                  <li>Use the <strong>In-Browser Sandbox</strong> mode to execute test scripts or load tests immediately with 100% reliability.</li>
                  <li>Verify that your script does not perform blocking synchronous loops without yielding.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div>
            ApiDesk Diagnostic System • Real-Time Protocol Inspector
          </div>
          <div className="flex items-center gap-2">
            {onRunBrowserFallback && (
              <button
                id="footer-fallback-runner-btn"
                onClick={() => {
                  onClose();
                  onRunBrowserFallback();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-medium transition-colors"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{fallbackLabel}</span>
              </button>
            )}
            <button
              id="footer-close-btn"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
