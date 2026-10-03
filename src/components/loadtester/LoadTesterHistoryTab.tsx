import React, { useState } from 'react';
import { 
  History, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Bookmark, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { LoadTestResult, LoadTestHistoryItem } from '../../types/loadTesting';

interface LoadTesterHistoryTabProps {
  history: LoadTestHistoryItem[];
  currentResult: LoadTestResult | null;
  baselineId: string | null;
  onSetBaseline: (id: string | null) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
}

export const LoadTesterHistoryTab: React.FC<LoadTesterHistoryTabProps> = ({
  history,
  currentResult,
  baselineId,
  onSetBaseline,
  onClearHistory,
  onDeleteHistoryItem
}) => {
  const baselineItem = history.find(h => h.id === baselineId) || (history.length > 1 ? history[1] : null);

  // Delta calculation helper
  const renderDelta = (currentVal: number, baselineVal: number, lowerIsBetter = false, unit = '') => {
    if (!baselineVal) return null;
    const diff = currentVal - baselineVal;
    const percent = ((diff / baselineVal) * 100).toFixed(1);
    const isZero = Math.abs(diff) < 0.001;

    if (isZero) {
      return <span className="text-[10px] text-slate-500 font-mono">0% (Same)</span>;
    }

    const isGood = lowerIsBetter ? diff < 0 : diff > 0;
    const colorClass = isGood ? 'text-emerald-400' : 'text-rose-400';
    const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;

    return (
      <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${colorClass}`}>
        <Icon className="w-3 h-3" />
        {diff > 0 ? '+' : ''}{percent}% ({diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit})
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 1. Baseline Run Comparison if current test exists */}
      {currentResult && baselineItem && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Current Run vs Baseline Comparison</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Baseline: {new Date(baselineItem.timestamp).toLocaleTimeString()} ({baselineItem.connections} VUs)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* RPS Comparison */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-medium">Throughput (RPS)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">
                  {currentResult.requestsPerSecond.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  base: {baselineItem.requestsPerSecond.toFixed(1)}
                </span>
              </div>
              {renderDelta(currentResult.requestsPerSecond, baselineItem.requestsPerSecond, false, ' rps')}
            </div>

            {/* Avg Latency Comparison */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-medium">Avg Latency</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">
                  {currentResult.latency.average.toFixed(1)}ms
                </span>
                <span className="text-xs font-mono text-slate-500">
                  base: {baselineItem.avgLatency.toFixed(1)}ms
                </span>
              </div>
              {renderDelta(currentResult.latency.average, baselineItem.avgLatency, true, 'ms')}
            </div>

            {/* p99 Tail Latency */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-medium">p99 Latency</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">
                  {currentResult.latency.p99}ms
                </span>
                <span className="text-xs font-mono text-slate-500">
                  base: {baselineItem.p99Latency}ms
                </span>
              </div>
              {renderDelta(currentResult.latency.p99, baselineItem.p99Latency, true, 'ms')}
            </div>

            {/* Error Rate */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-medium">Error Rate</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-white">
                  {((currentResult.errors / Math.max(1, currentResult.totalRequests)) * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-500">
                  base: {baselineItem.errorRatePercent.toFixed(1)}%
                </span>
              </div>
              {renderDelta(
                (currentResult.errors / Math.max(1, currentResult.totalRequests)) * 100,
                baselineItem.errorRatePercent,
                true,
                '%'
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Historical Test Runs Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Past Test Runs History</span>
            <span className="text-[10px] text-slate-500 font-mono">({history.length} saved runs)</span>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
            <History className="w-8 h-8 text-slate-700" />
            <span>No previous test runs recorded. Complete load tests to automatically build performance history.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-2.5 font-semibold">Timestamp</th>
                  <th className="py-2 px-2.5 font-semibold">Target &amp; Method</th>
                  <th className="py-2 px-2.5 font-semibold">Clients</th>
                  <th className="py-2 px-2.5 font-semibold">RPS</th>
                  <th className="py-2 px-2.5 font-semibold">Avg Latency</th>
                  <th className="py-2 px-2.5 font-semibold">p99 Latency</th>
                  <th className="py-2 px-2.5 font-semibold">Errors</th>
                  <th className="py-2 px-2.5 font-semibold">SLA Health</th>
                  <th className="py-2 px-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {history.map((item) => {
                  const isBaseline = item.id === baselineId;

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-2 px-2.5 text-slate-400 font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 font-mono">
                            {item.method}
                          </span>
                          <span className="font-mono text-slate-300 truncate max-w-[140px]" title={item.url}>
                            {item.url}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-slate-300">{item.connections} VUs</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-amber-400">{item.requestsPerSecond.toFixed(1)}</td>
                      <td className="py-2 px-2.5 font-mono text-slate-300">{item.avgLatency.toFixed(1)}ms</td>
                      <td className="py-2 px-2.5 font-mono text-sky-400">{item.p99Latency}ms</td>
                      <td className="py-2 px-2.5 font-mono">
                        <span className={item.errorRatePercent > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                          {item.errorRatePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.healthScore >= 80 
                            ? 'bg-emerald-500/15 text-emerald-300' 
                            : 'bg-rose-500/15 text-rose-300'
                        }`}>
                          {item.healthScore}/100
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSetBaseline(isBaseline ? null : item.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                            isBaseline
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                          title={isBaseline ? 'Current baseline' : 'Set as baseline for comparisons'}
                        >
                          {isBaseline ? '★ Baseline' : 'Set Baseline'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHistoryItem(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Delete run"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
