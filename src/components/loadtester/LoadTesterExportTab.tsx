import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  FileSpreadsheet, 
  FileText,
  Sparkles,
  Code
} from 'lucide-react';
import { LoadTestResult, LoadTestConfig, SlaAuditResult } from '../../types/loadTesting';
import { 
  generateK6Script, 
  generateAutocannonCli, 
  generateArtilleryScript, 
  generateWrkCli, 
  generateHtmlReport 
} from '../../utils/loadTestAnalytics';
import { copyToClipboard } from '../../utils/clipboard';

interface LoadTesterExportTabProps {
  result: LoadTestResult;
  audit: SlaAuditResult;
  config: LoadTestConfig;
}

type ExportType = 'k6' | 'autocannon' | 'artillery' | 'wrk';

export const LoadTesterExportTab: React.FC<LoadTesterExportTabProps> = ({
  result,
  audit,
  config
}) => {
  const [activeExport, setActiveExport] = useState<ExportType>('k6');
  const [copied, setCopied] = useState(false);

  const getExportCode = () => {
    switch (activeExport) {
      case 'k6':
        return generateK6Script(config);
      case 'autocannon':
        return generateAutocannonCli(config);
      case 'artillery':
        return generateArtilleryScript(config);
      case 'wrk':
        return generateWrkCli(config);
    }
  };

  const handleCopy = async () => {
    const code = getExportCode();
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadHtml = () => {
    const html = generateHtmlReport(result, audit, config);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apidesk-performance-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Target URL', result.url],
      ['HTTP Method', result.method],
      ['Concurrent Connections', String(result.connections)],
      ['Duration (s)', String(result.durationActual)],
      ['Total Requests', String(result.totalRequests)],
      ['Requests Per Second (RPS)', result.requestsPerSecond.toFixed(2)],
      ['Bytes Per Second', String(result.bytesPerSecond)],
      ['Total Bytes (MB)', (result.totalBytes / 1024 / 1024).toFixed(2)],
      ['Total Errors', String(result.errors)],
      ['Timeouts', String(result.timeouts)],
      ['Non-2xx Responses', String(result.non2xx)],
      ['Avg Latency (ms)', result.latency.average.toFixed(2)],
      ['p50 Median (ms)', String(result.latency.p50)],
      ['p75 Latency (ms)', String(result.latency.p75)],
      ['p90 Latency (ms)', String(result.latency.p90)],
      ['p97.5 Latency (ms)', String(result.latency.p97_5)],
      ['p99 Latency (ms)', String(result.latency.p99)],
      ['p99.9 Latency (ms)', String(result.latency.p99_9)],
      ['Max Latency (ms)', String(result.latency.max)],
      ['Apdex Score', String(audit.apdex.score)],
      ['SLA Health Score', String(audit.score)],
      ['SLA Status', audit.passed ? 'PASSED' : 'FAILED']
    ];

    const csvContent = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apidesk-load-metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 1. Downloadable Reports Grid */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Export Performance Reports</span>
          </div>
          <span className="text-[10px] text-slate-500">Standalone offline reports</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* HTML Executive Summary */}
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="p-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 flex flex-col gap-1.5 text-left transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" />
                HTML Executive Report
              </span>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition" />
            </div>
            <span className="text-[11px] text-slate-400 leading-snug">
              Complete styled HTML report with SLA audit tables and executive summary.
            </span>
          </button>

          {/* CSV Metrics Spreadsheet */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="p-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 flex flex-col gap-1.5 text-left transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                CSV Data Spreadsheet
              </span>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition" />
            </div>
            <span className="text-[11px] text-slate-400 leading-snug">
              Raw latency percentiles, throughput, and error metrics for Excel/BI.
            </span>
          </button>

          {/* JSON Telemetry Payload */}
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `apidesk-loadtest-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-3.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-sky-500/40 flex flex-col gap-1.5 text-left transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-sky-400" />
                JSON Telemetry Blob
              </span>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition" />
            </div>
            <span className="text-[11px] text-slate-400 leading-snug">
              Full machine-readable JSON object with percentiles and status codes.
            </span>
          </button>
        </div>
      </div>

      {/* 2. Load Generator CLI & Script Code */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Generate Production Load Scripts</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-slate-700 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Script Selection Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-900 pb-2">
          <button
            type="button"
            onClick={() => setActiveExport('k6')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              activeExport === 'k6'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            k6 JavaScript Script
          </button>
          <button
            type="button"
            onClick={() => setActiveExport('autocannon')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              activeExport === 'autocannon'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Autocannon CLI
          </button>
          <button
            type="button"
            onClick={() => setActiveExport('artillery')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              activeExport === 'artillery'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Artillery YAML
          </button>
          <button
            type="button"
            onClick={() => setActiveExport('wrk')}
            className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
              activeExport === 'wrk'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            wrk Benchmark
          </button>
        </div>

        {/* Code Snippet Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 overflow-x-auto max-h-[260px] leading-relaxed select-all">
          <pre>{getExportCode()}</pre>
        </div>
      </div>
    </div>
  );
};
