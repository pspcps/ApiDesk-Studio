import React, { useState } from 'react';
import { ApiResponse } from '../types';
import { 
  Copy, 
  Check, 
  Download, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HardDrive, 
  ArrowDownUp, 
  Sparkles,
  Eye,
  FileCode,
  ListFilter,
  BarChart2,
  Trash2,
  Terminal,
  Table as TableIcon,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface ResponseViewerProps {
  response: ApiResponse | null;
  isLoading: boolean;
  onClear?: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, isLoading, onClear }) => {
  const [activeTab, setActiveTab] = useState<'pretty' | 'raw' | 'table' | 'preview' | 'headers' | 'tests' | 'console' | 'timing'>('pretty');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin"></div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-200">Sending Request...</span>
          <span className="text-[11px] text-slate-500">Awaiting server response via proxy</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-500">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
          <ArrowDownUp className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <span className="text-xs font-semibold text-slate-300">No Response Yet</span>
          <span className="text-[11px] text-slate-500 leading-relaxed">
            Click <strong>Send</strong> or press <code className="bg-slate-900 px-1 py-0.5 rounded text-sky-400">Enter</code> to execute the endpoint request.
          </span>
        </div>
      </div>
    );
  }

  // Format Status
  const is2xx = response.status >= 200 && response.status < 300;
  const is3xx = response.status >= 300 && response.status < 400;
  const is4xx = response.status >= 400 && response.status < 500;

  const statusBg = is2xx
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : is3xx
    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
    : is4xx
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  // Format Size
  const sizeFormatted = response.sizeBytes > 1024 * 1024
    ? `${(response.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : response.sizeBytes > 1024
    ? `${(response.sizeBytes / 1024).toFixed(2)} KB`
    : `${response.sizeBytes} B`;

  // Parse JSON object if possible for collapsible tree & table view
  let parsedJsonData: any = null;
  let formattedBodyString = '';
  if (response.isJson && response.data !== undefined) {
    try {
      if (typeof response.data === 'string') {
        parsedJsonData = JSON.parse(response.data);
        formattedBodyString = JSON.stringify(parsedJsonData, null, 2);
      } else {
        parsedJsonData = response.data;
        formattedBodyString = JSON.stringify(response.data, null, 2);
      }
    } catch {
      formattedBodyString = String(response.data);
    }
  } else if (typeof response.data === 'string') {
    formattedBodyString = response.data;
    try {
      parsedJsonData = JSON.parse(response.data);
    } catch {}
  } else {
    parsedJsonData = response.data;
    formattedBodyString = JSON.stringify(response.data, null, 2);
  }

  const isTableCompatible = Array.isArray(parsedJsonData) && parsedJsonData.length > 0 && typeof parsedJsonData[0] === 'object' && parsedJsonData[0] !== null;

  const handleCopy = async () => {
    await copyToClipboard(formattedBodyString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedBodyString], { type: response.contentType || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${Date.now()}.${response.isJson ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Test Results calculations
  const totalTests = response.testResults?.length || 0;
  const passedTests = response.testResults?.filter(t => t.passed).length || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 border-t border-slate-800">
      {/* Response Header Status Bar */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 flex-wrap gap-2">
        {/* Left: Response Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab('pretty')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'pretty' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pretty
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'raw' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Raw
          </button>

          {isTableCompatible && (
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                activeTab === 'table' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Table</span>
              <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
                {parsedJsonData.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'headers' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Headers</span>
            <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
              {Object.keys(response.headers || {}).length}
            </span>
          </button>

          {totalTests > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                activeTab === 'tests' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tests</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                passedTests === totalTests ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
              }`}>
                {passedTests}/{totalTests}
              </span>
            </button>
          )}

          {/* Console / Script Logs Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'console' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Console</span>
            {(response.scriptLogs && response.scriptLogs.length > 0) && (
              <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded-full font-mono font-bold border border-amber-800/60">
                {response.scriptLogs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timing')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              activeTab === 'timing' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Timing
          </button>
        </div>

        {/* Right: Status Badges, Latency, Size, Actions */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className={`px-2.5 py-1 rounded border text-xs font-mono font-bold flex items-center gap-1.5 ${statusBg}`}>
            <span>{response.status}</span>
            <span className="font-sans font-medium text-[11px]">{response.statusText}</span>
          </div>

          {/* Time Badge */}
          <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{response.timeMs} ms</span>
          </div>

          {/* Size Badge */}
          <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-slate-500" />
            <span>{sizeFormatted}</span>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 text-xs"
            title="Copy Full Response Body"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 text-xs"
            title="Download Full Response Body"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Clear Button */}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
              title="Clear Response"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-slate-950">
        {/* PRETTY VIEW */}
        {activeTab === 'pretty' && (
          <div className="flex flex-col gap-2">
            {/* Search filter in response */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Find in response..."
                  className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-sans"
                />
              </div>
              {parsedJsonData !== null && typeof parsedJsonData === 'object' && !searchTerm && (
                <span className="text-[10px] text-slate-500 font-sans">
                  Hover any field to copy its value or JSON subtree
                </span>
              )}
            </div>

            {parsedJsonData !== null && typeof parsedJsonData === 'object' && !searchTerm ? (
              <div className="p-2 bg-slate-900/30 border border-slate-800/60 rounded-lg overflow-x-auto">
                <JsonTreeNode value={parsedJsonData} isRoot />
              </div>
            ) : (
              <pre data-copyable="true" className="text-slate-200 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono selection:bg-sky-500/30">
                {searchTerm
                  ? highlightMatches(formattedBodyString, searchTerm)
                  : formattedBodyString}
              </pre>
            )}
          </div>
        )}

        {/* RAW VIEW */}
        {activeTab === 'raw' && (
          <textarea
            readOnly
            value={formattedBodyString}
            className="w-full h-full min-h-[300px] bg-slate-900 border border-slate-800 rounded p-3 font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
          />
        )}

        {/* TABLE VIEW (Array of Objects) */}
        {activeTab === 'table' && isTableCompatible && (
          <div className="border border-slate-800 rounded-lg overflow-auto bg-slate-900/30">
            {(() => {
              const rows = parsedJsonData as Record<string, any>[];
              const columns = Array.from(
                rows.slice(0, 50).reduce((acc, row) => {
                  if (row && typeof row === 'object') {
                    Object.keys(row).forEach(k => acc.add(k));
                  }
                  return acc;
                }, new Set<string>())
              );

              return (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-sans uppercase text-[10px]">
                      <th className="py-2 px-3 border-r border-slate-800 w-10">#</th>
                      {columns.map(col => (
                        <th key={col} className="py-2 px-3 border-r border-slate-800 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 border-r border-slate-800/60 text-slate-500">{idx + 1}</td>
                        {columns.map(col => {
                          const cellVal = row?.[col];
                          const strVal = typeof cellVal === 'object' && cellVal !== null
                            ? JSON.stringify(cellVal)
                            : String(cellVal ?? '');
                          return (
                            <td key={col} className="py-1.5 px-3 border-r border-slate-800/60 text-slate-200 max-w-xs truncate" title={strVal}>
                              {strVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}

        {/* PREVIEW VIEW */}
        {activeTab === 'preview' && (
          <div className="h-full min-h-[300px] bg-white rounded border border-slate-800 overflow-hidden">
            {response.isBinary && String(response.data).startsWith('data:image') ? (
              <div className="p-4 flex items-center justify-center h-full bg-slate-900">
                <img
                  src={response.data}
                  alt="Response preview"
                  className="max-h-[350px] max-w-full rounded shadow"
                />
              </div>
            ) : (
              <iframe
                title="Response HTML Preview"
                srcDoc={typeof response.data === 'string' ? response.data : formattedBodyString}
                sandbox="allow-same-origin"
                className="w-full h-full min-h-[350px] border-0"
              />
            )}
          </div>
        )}

        {/* HEADERS VIEW */}
        {activeTab === 'headers' && (
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
            <div className="grid grid-cols-[1.5fr_2fr] bg-slate-900 border-b border-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-sans">
              <div>Header</div>
              <div>Value</div>
            </div>
            <div className="divide-y divide-slate-800/60 font-mono text-xs">
              {Object.entries(response.headers || {}).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[1.5fr_2fr] px-3 py-1.5 hover:bg-slate-800/30 group items-center">
                  <div className="text-sky-400 font-medium break-all pr-2">{key}</div>
                  <div className="text-slate-300 break-all flex items-center justify-between gap-2">
                    <span>{value}</span>
                    <InlineFieldCopyButton value={String(value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEST RESULTS VIEW */}
        {activeTab === 'tests' && (
          <div className="flex flex-col gap-2 font-sans">
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300">
                Test Summary: {passedTests} of {totalTests} passed ({Math.round((passedTests / Math.max(1, totalTests)) * 100)}%)
              </span>
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                passedTests === totalTests ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {passedTests === totalTests ? 'ALL PASSED' : 'SOME FAILED'}
              </span>
            </div>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
              {response.testResults?.map((test, i) => (
                <div key={i} className="p-3 flex items-start gap-3 hover:bg-slate-800/20">
                  {test.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-xs font-semibold text-slate-200">{test.name}</span>
                    <span className={`text-[11px] ${test.passed ? 'text-slate-400' : 'text-rose-300'}`}>
                      {test.message}
                    </span>
                    {test.expected && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                        <span>Expected: {test.expected}</span>
                        <span>Actual: {test.actual}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {response.savedVariables && Object.keys(response.savedVariables).length > 0 && (
              <div className="mt-3 p-3 bg-sky-950/20 border border-sky-800/40 rounded-lg flex flex-col gap-2">
                <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Auto-Captured Environment Variables
                </span>
                <div className="flex flex-col gap-1 text-xs font-mono text-slate-300">
                  {Object.entries(response.savedVariables).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-sky-400 font-semibold">{`{{${k}}}`}</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-slate-200 truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONSOLE / SCRIPT LOGS VIEW */}
        {activeTab === 'console' && (
          <div className="flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                Script Execution Console ({response.scriptLogs?.length || 0} entries)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Pre-request & Post-response JS Sandbox
              </span>
            </div>

            {(!response.scriptLogs || response.scriptLogs.length === 0) ? (
              <div className="p-8 rounded-lg border border-slate-800 bg-slate-900/30 text-center flex flex-col items-center gap-2 text-slate-500">
                <Terminal className="w-6 h-6 text-slate-600" />
                <span className="text-xs">No console logs produced by scripts for this request.</span>
                <span className="text-[11px] text-slate-600">
                  Use <code className="text-amber-400 font-mono">console.log("hello", var)</code> in your JS Scripts tab to output logs here.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg overflow-hidden bg-slate-950 font-mono text-xs shadow-inner">
                {response.scriptLogs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`p-2.5 flex items-start gap-2.5 ${
                      log.type === 'error'
                        ? 'bg-rose-950/20 text-rose-300'
                        : log.type === 'warn'
                        ? 'bg-amber-950/20 text-amber-300'
                        : 'hover:bg-slate-900/40 text-slate-200'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono pt-0.5 select-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>

                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded shrink-0 ${
                      log.type === 'error'
                        ? 'bg-rose-900/60 text-rose-300 border border-rose-800'
                        : log.type === 'warn'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {log.type}
                    </span>

                    <div className="flex-1 flex flex-wrap items-center gap-1.5 break-all leading-relaxed">
                      {(log.messages || [log.message]).map((msg, mIdx) => (
                        <span 
                          key={mIdx}
                          className={typeof msg === 'object' ? 'text-sky-300' : ''}
                        >
                          {typeof msg === 'object' ? JSON.stringify(msg) : String(msg)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TIMING WATERFALL VIEW */}
        {activeTab === 'timing' && (
          <div className="flex flex-col gap-4 font-sans max-w-xl p-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-200">Network Latency Breakdown</span>
              <span className="text-[11px] text-slate-500">Total duration: {response.timeMs} milliseconds</span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <TimingRow label="DNS Lookup" value={response.timing.dns} total={response.timeMs} color="bg-emerald-500" />
              <TimingRow label="TCP Connection / TLS Handshake" value={response.timing.tcp} total={response.timeMs} color="bg-sky-500" />
              <TimingRow label="Time to First Byte (TTFB)" value={response.timing.ttfb} total={response.timeMs} color="bg-amber-500" />
              <TimingRow label="Content Download" value={response.timing.download} total={response.timeMs} color="bg-purple-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InlineFieldCopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyField = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopyField}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-700 transition text-[10px] font-sans ml-1.5 shrink-0"
      title={label ? `Copy ${label}` : 'Copy value'}
    >
      {copied ? (
        <>
          <Check className="w-2.5 h-2.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-2.5 h-2.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

const JsonTreeNode: React.FC<{
  fieldKey?: string;
  value: any;
  isRoot?: boolean;
  isLast?: boolean;
}> = ({ fieldKey, value, isRoot = false, isLast = true }) => {
  const [expanded, setExpanded] = useState(true);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const serializedValue = isObject
    ? JSON.stringify(value, null, 2)
    : typeof value === 'string'
    ? value
    : String(value);

  if (!isObject) {
    let valClass = 'text-amber-300';
    let formattedVal = JSON.stringify(value);
    if (typeof value === 'string') {
      valClass = 'text-emerald-300';
    } else if (typeof value === 'boolean') {
      valClass = 'text-purple-400 font-semibold';
    } else if (value === null) {
      valClass = 'text-rose-400 italic';
    }

    return (
      <div className="group flex items-center py-0.5 pl-4 hover:bg-slate-800/30 rounded leading-relaxed">
        {fieldKey !== undefined && (
          <>
            <span className="text-sky-400">"{fieldKey}"</span>
            <span className="text-slate-400 mr-1.5">:</span>
          </>
        )}
        <span className={`${valClass} break-all`}>{formattedVal}</span>
        {!isLast && <span className="text-slate-500">,</span>}
        <InlineFieldCopyButton value={serializedValue} label={fieldKey} />
      </div>
    );
  }

  const entries = isArray ? value.map((v: any, i: number) => [undefined, v]) : Object.entries(value);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className={isRoot ? '' : 'pl-4'}>
      <div
        onClick={() => setExpanded(!expanded)}
        className="group flex items-center py-0.5 hover:bg-slate-800/30 rounded cursor-pointer select-none leading-relaxed"
      >
        <span className="w-4 h-4 flex items-center justify-center text-slate-500 mr-0.5">
          {entries.length > 0 ? (
            expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : null}
        </span>
        {fieldKey !== undefined && (
          <>
            <span className="text-sky-400">"{fieldKey}"</span>
            <span className="text-slate-400 mr-1.5">:</span>
          </>
        )}
        <span className="text-slate-300">{openBracket}</span>
        {!expanded && (
          <span className="text-slate-500 text-[11px] mx-1">
            {isArray ? `${entries.length} items` : `${entries.length} keys`}
          </span>
        )}
        {(!expanded || entries.length === 0) && (
          <>
            <span className="text-slate-300">{closeBracket}</span>
            {!isLast && <span className="text-slate-500">,</span>}
          </>
        )}
        <InlineFieldCopyButton value={serializedValue} label={fieldKey || (isArray ? 'array' : 'object')} />
      </div>

      {expanded && entries.length > 0 && (
        <div className="border-l border-slate-800/70 ml-2 pl-2">
          {entries.map(([k, v]: [any, any], idx: number) => (
            <JsonTreeNode
              key={k ?? idx}
              fieldKey={k}
              value={v}
              isLast={idx === entries.length - 1}
            />
          ))}
        </div>
      )}

      {expanded && entries.length > 0 && (
        <div className="pl-4 text-slate-300 leading-relaxed">
          {closeBracket}
          {!isLast && <span className="text-slate-500">,</span>}
        </div>
      )}
    </div>
  );
};

function TimingRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = Math.min(100, Math.max(4, Math.round((value / Math.max(1, total)) * 100)));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{value} ms</span>
      </div>
      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

function highlightMatches(text: string, term: string) {
  if (!term.trim()) return text;
  const parts = text.split(new RegExp(`(${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="bg-amber-500/40 text-amber-200 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
