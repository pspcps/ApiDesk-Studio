import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  RefreshCw, 
  Layers, 
  ArrowRight,
  Code,
  Globe,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { LoadTestResult } from '../../types/loadTesting';
import { ApiRequest } from '../../types';

interface LoadTesterFailureDiagnosticsCardProps {
  result: LoadTestResult;
  activeRequest?: ApiRequest | null;
  onSwitchMethod?: (newMethod: string) => void;
  onSyncFromActiveRequest?: () => void;
  onRunTest?: () => void;
}

export const LoadTesterFailureDiagnosticsCard: React.FC<LoadTesterFailureDiagnosticsCardProps> = ({
  result,
  activeRequest,
  onSwitchMethod,
  onSyncFromActiveRequest,
  onRunTest
}) => {
  const [isSampleBodyOpen, setIsSampleBodyOpen] = useState(true);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);

  const hasFailures = (result.non2xx > 0) || (result.errors > 0);
  if (!hasFailures && (!result.failureReasons || result.failureReasons.length === 0)) {
    return null;
  }

  const handleCopyBody = async () => {
    if (!result.sampleProbe?.body) return;
    try {
      await navigator.clipboard.writeText(result.sampleProbe.body);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    } catch {}
  };

  const handleCopyHeaders = async () => {
    if (!result.sampleProbe?.headers) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.sampleProbe.headers, null, 2));
      setCopiedHeaders(true);
      setTimeout(() => setCopiedHeaders(false), 2000);
    } catch {}
  };

  // Determine if there is a 405 Method Not Allowed error
  const has405 = result.statusCodes && (result.statusCodes['405'] > 0);
  const isMethodGet = result.method.toUpperCase() === 'GET';

  // Check if sample response contains JSON root $ validation error
  const sampleProbeBody = result.sampleProbe?.body || '';
  const isRootDollarError = sampleProbeBody.includes('value for $ is invalid') || sampleProbeBody.includes('BadRequestError');

  return (
    <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 flex flex-col gap-3.5 shadow-lg animate-fade-in">
      {/* Header Banner */}
      <div className="flex items-start justify-between gap-3 border-b border-rose-900/60 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-rose-200">
                Diagnostic Root Cause &amp; Failure Analysis
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {result.non2xx > 0 ? `${result.non2xx} non-2xx failures` : `${result.errors} socket errors`}
              </span>
            </div>
            <p className="text-xs text-rose-300/90 leading-relaxed">
              Target endpoint returned failure responses during load testing. Detailed status code breakdown, server diagnostics, and recommended fixes below:
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {(has405 || isRootDollarError) && isMethodGet && onSwitchMethod && (
            <button
              type="button"
              onClick={() => {
                onSwitchMethod('POST');
                if (onRunTest) onRunTest();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
              title="Change method from GET to POST and re-run load test"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Switch to POST &amp; Re-Test</span>
            </button>
          )}

          {activeRequest && onSyncFromActiveRequest && (
            <button
              type="button"
              onClick={onSyncFromActiveRequest}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title={`Sync full method (${activeRequest.method}), headers, auth, and body from API Client`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Sync from API Client</span>
            </button>
          )}
        </div>
      </div>

      {/* Special Root $ Error Callout */}
      {isRootDollarError && (
        <div className="p-3.5 bg-amber-950/50 border border-amber-500/60 rounded-lg flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                JSON Root ($) Error Detected
              </span>
              <span className="text-xs font-bold text-amber-200">
                "The provided value for $ is invalid."
              </span>
            </div>
            {isMethodGet && onSwitchMethod && (
              <button
                type="button"
                onClick={() => {
                  onSwitchMethod('POST');
                  if (onRunTest) onRunTest();
                }}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <span>Fix: Switch to POST &amp; Re-Test</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-amber-200">Why does it mention "$"?</strong> In API schema validators (ASP.NET Core / C#, Java Spring, JSONSchema), the symbol <code className="px-1 py-0.5 bg-slate-900 rounded font-mono text-amber-300">$</code> is the standard <strong>JSONPath root symbol</strong> representing the entire request payload model.
          </p>
          <div className="p-2.5 bg-slate-950/80 rounded border border-slate-800 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-amber-300">Common Causes &amp; Solutions:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300">
              <li>
                <strong>HTTP Method was GET:</strong> HTTP <code className="text-amber-300">GET</code> requests do not transmit a request body. The server received an empty body at the root <code className="text-amber-300">$</code>. Switching to <code className="text-emerald-400 font-bold">POST</code> transmits your JSON payload.
              </li>
              <li>
                <strong>Root JSON Type:</strong> If your JSON payload is an Array <code className="text-amber-300">[ &#123; ... &#125; ]</code>, the server may expect a single Object <code className="text-amber-300">&#123; ... &#125;</code> (or vice-versa).
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Failure Reasons Breakdown Cards */}
      <div className="flex flex-col gap-2.5">
        {result.failureReasons && result.failureReasons.length > 0 ? (
          result.failureReasons.map((fr, idx) => {
            const is405Item = Number(fr.code) === 405;
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  is405Item
                    ? 'bg-amber-950/40 border-amber-800/80'
                    : Number(fr.code) >= 500
                    ? 'bg-rose-950/60 border-rose-800'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                        is405Item
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : Number(fr.code) >= 500
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      }`}
                    >
                      {fr.meaning}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {fr.count.toLocaleString()} requests ({fr.percentage}% of total load)
                    </span>
                  </div>

                  {is405Item && isMethodGet && onSwitchMethod && (
                    <button
                      type="button"
                      onClick={() => onSwitchMethod('POST')}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 underline cursor-pointer"
                    >
                      <span>Fix: Change Method to POST</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-1">
                  <strong>Root Cause:</strong> {fr.reason}
                </p>

                <div className="pl-2 py-1.5 bg-slate-950/60 rounded border border-slate-800/80 flex items-start gap-1.5 text-xs text-amber-300/95">
                  <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-200">Actionable Fix:</strong> {fr.fixRecommendation}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          /* Fallback status code explanations */
          result.statusCodes && Object.entries(result.statusCodes).map(([code, count]) => {
            if (code.startsWith('2')) return null;
            const is405Code = code === '405';
            return (
              <div key={code} className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    HTTP {code}
                  </span>
                  <span className="text-xs text-slate-200 font-bold">{count} occurrences</span>
                </div>
                <p className="text-xs text-slate-300">
                  {is405Code 
                    ? `The destination endpoint "${result.url}" rejected HTTP ${result.method}. It requires a different method like POST or PUT.`
                    : `${count} requests returned HTTP status ${code}. Inspect server logs or response body below.`
                  }
                </p>
                {is405Code && isMethodGet && onSwitchMethod && (
                  <button
                    type="button"
                    onClick={() => onSwitchMethod('POST')}
                    className="w-fit text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 underline mt-1 cursor-pointer"
                  >
                    <span>Change Method to POST</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sample Server Response Inspector */}
      {result.sampleProbe && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={() => setIsSampleBodyOpen(!isSampleBodyOpen)}
            className="p-2.5 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs text-slate-300 font-semibold border-b border-slate-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample Server Response (Exact Endpoint Diagnostic Probe)</span>
              <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold border ${
                result.sampleProbe.statusCode === 200
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}>
                HTTP {result.sampleProbe.statusCode} {result.sampleProbe.statusText}
              </span>
              {result.sampleProbe.durationMs > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {result.sampleProbe.durationMs}ms probe
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-[10px]">{isSampleBodyOpen ? 'Collapse' : 'Expand Probe Body'}</span>
              {isSampleBodyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          </button>

          {isSampleBodyOpen && (
            <div className="p-3 flex flex-col gap-3 bg-slate-950 font-mono text-xs">
              {/* Response Headers */}
              {result.sampleProbe.headers && Object.keys(result.sampleProbe.headers).length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Server Response Headers:</span>
                    <button
                      type="button"
                      onClick={handleCopyHeaders}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedHeaders ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHeaders ? 'Copied' : 'Copy Headers'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-850 text-[11px] text-slate-300 max-h-28 overflow-y-auto space-y-0.5">
                    {Object.entries(result.sampleProbe.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-amber-400/90 font-semibold">{k}:</span>
                        <span className="text-slate-300 break-all">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Body */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    Server Response Body ({result.sampleProbe.isJson ? 'JSON' : 'Raw Text'}):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBody ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBody ? 'Copied Body' : 'Copy Body'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
                  {result.sampleProbe.body ? (
                    result.sampleProbe.body
                  ) : (
                    <span className="text-slate-500 italic">No response body returned by server (0 bytes).</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
