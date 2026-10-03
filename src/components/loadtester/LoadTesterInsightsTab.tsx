import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  ShieldCheck, 
  Sliders, 
  Sparkles, 
  Check, 
  ChevronRight,
  Zap,
  Gauge
} from 'lucide-react';
import { LoadTestResult, SlaThresholds, SlaAuditResult } from '../../types/loadTesting';
import { LoadTesterFailureDiagnosticsCard } from './LoadTesterFailureDiagnosticsCard';

interface LoadTesterInsightsTabProps {
  result: LoadTestResult;
  audit: SlaAuditResult;
  slaThresholds: SlaThresholds;
  onUpdateThresholds: (thresholds: SlaThresholds) => void;
  onSwitchMethod?: (newMethod: string) => void;
}

export const LoadTesterInsightsTab: React.FC<LoadTesterInsightsTabProps> = ({
  result,
  audit,
  slaThresholds,
  onUpdateThresholds,
  onSwitchMethod
}) => {
  const [isEditingSla, setIsEditingSla] = useState(false);
  const [tempThresholds, setTempThresholds] = useState<SlaThresholds>(slaThresholds);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
    if (score >= 75) return 'text-amber-400 border-amber-500/50 bg-amber-500/10';
    if (score >= 60) return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
  };

  const getApdexColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40';
      case 'Good': return 'text-sky-400 bg-sky-500/15 border-sky-500/40';
      case 'Fair': return 'text-amber-400 bg-amber-500/15 border-amber-500/40';
      default: return 'text-rose-400 bg-rose-500/15 border-rose-500/40';
    }
  };

  const handleSaveSla = () => {
    onUpdateThresholds(tempThresholds);
    setIsEditingSla(false);
  };

  const rpsPerVU = (result.requestsPerSecond / Math.max(1, result.connections)).toFixed(1);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Root-Cause Failure & Status Diagnostics */}
      <LoadTesterFailureDiagnosticsCard
        result={result}
        onSwitchMethod={onSwitchMethod}
      />

      {/* Top Banner: Health Score & Apdex Index */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Overall System Health Score */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              SLA Health Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono px-2 py-0.5 rounded-lg border ${getScoreColor(audit.score)}`}>
                {audit.score}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              {audit.passed ? '✅ All critical SLAs satisfied' : '⚠️ Critical SLA criteria violated'}
            </span>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              audit.passed 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              {audit.passed ? 'PASSED' : 'SLA BREACH'}
            </span>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">
              {audit.checks.filter(c => c.passed).length}/{audit.checks.length} checks pass
            </span>
          </div>
        </div>

        {/* Apdex User Experience Index */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              Apdex Index Score
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getApdexColor(audit.apdex.rating)}`}>
              {audit.apdex.rating}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-3xl font-black font-mono text-indigo-400">
              {audit.apdex.score}
            </span>
            <span className="text-[11px] text-slate-500">(Target T: {audit.apdex.targetMs}ms)</span>
          </div>

          {/* Proportional breakdown bar */}
          <div className="flex flex-col gap-1">
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex">
              <div 
                style={{ width: `${(audit.apdex.satisfiedCount / Math.max(1, result.totalRequests)) * 100}%` }} 
                className="bg-emerald-500 h-full"
                title={`Satisfied: ${audit.apdex.satisfiedCount}`}
              />
              <div 
                style={{ width: `${(audit.apdex.toleratingCount / Math.max(1, result.totalRequests)) * 100}%` }} 
                className="bg-amber-500 h-full"
                title={`Tolerating: ${audit.apdex.toleratingCount}`}
              />
              <div 
                style={{ width: `${(audit.apdex.frustratedCount / Math.max(1, result.totalRequests)) * 100}%` }} 
                className="bg-rose-500 h-full"
                title={`Frustrated: ${audit.apdex.frustratedCount}`}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span className="text-emerald-400 font-bold">{Math.round((audit.apdex.satisfiedCount / Math.max(1, result.totalRequests)) * 100)}% Fast</span>
              <span className="text-amber-400 font-bold">{Math.round((audit.apdex.toleratingCount / Math.max(1, result.totalRequests)) * 100)}% Tolerate</span>
              <span className="text-rose-400 font-bold">{Math.round((audit.apdex.frustratedCount / Math.max(1, result.totalRequests)) * 100)}% Slow</span>
            </div>
          </div>
        </div>

        {/* Concurrency Multiplier / Efficiency */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Socket Efficiency
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{result.connections} Clients</span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="text-3xl font-black font-mono text-amber-400">
              {rpsPerVU}
            </span>
            <span className="text-xs text-slate-400">RPS per VU</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-850 pt-1.5">
            <span>Transfer Rate:</span>
            <span className="font-mono text-slate-200 font-bold">
              {(result.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
            </span>
          </div>
        </div>
      </div>

      {/* SLA Checks Matrix */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              SLA Threshold Assertions
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Automated verification matrix</span>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingSla(!isEditingSla)}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded bg-slate-900 border border-slate-800 transition cursor-pointer"
          >
            <Sliders className="w-3 h-3" />
            <span>{isEditingSla ? 'Cancel Edit' : 'Configure SLA Targets'}</span>
          </button>
        </div>

        {/* SLA Threshold Config Form */}
        {isEditingSla && (
          <div className="p-3 bg-slate-900/80 border border-amber-500/30 rounded-lg flex flex-col gap-3 animate-fade-in">
            <span className="text-xs font-bold text-amber-300">Customize SLA Target Requirements</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-slate-400">Max p95 (ms)</label>
                <input
                  type="number"
                  value={tempThresholds.maxP95Ms}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, maxP95Ms: Number(e.target.value) }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-slate-400">Max p99 (ms)</label>
                <input
                  type="number"
                  value={tempThresholds.maxP99Ms}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, maxP99Ms: Number(e.target.value) }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-slate-400">Max Error (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempThresholds.maxErrorPercent}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, maxErrorPercent: Number(e.target.value) }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-slate-400">Min RPS</label>
                <input
                  type="number"
                  value={tempThresholds.minRps}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, minRps: Number(e.target.value) }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-slate-400">Target Apdex T (ms)</label>
                <input
                  type="number"
                  value={tempThresholds.targetApdexMs}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, targetApdexMs: Number(e.target.value) }))}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveSla}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Apply SLA Thresholds
              </button>
            </div>
          </div>
        )}

        {/* Checks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3 font-semibold">Objective Metric</th>
                <th className="py-2 px-3 font-semibold">SLA Target Threshold</th>
                <th className="py-2 px-3 font-semibold">Observed Performance</th>
                <th className="py-2 px-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {audit.checks.map((check) => (
                <tr key={check.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-200 flex items-center gap-2">
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{check.label}</span>
                    {check.critical && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold uppercase">
                        Critical
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{check.target}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-200">{check.actual}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      check.passed
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}>
                      {check.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostics & Root Cause Advice */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white">Performance Diagnostics &amp; Bottleneck Analysis</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {audit.diagnostics.map((diag, index) => {
            let icon = <Info className="w-4 h-4 text-sky-400" />;
            let borderColor = 'border-slate-800';
            let bgClass = 'bg-slate-900/40';

            if (diag.type === 'critical') {
              icon = <AlertTriangle className="w-4 h-4 text-rose-400" />;
              borderColor = 'border-rose-900/60';
              bgClass = 'bg-rose-950/30';
            } else if (diag.type === 'warning') {
              icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
              borderColor = 'border-amber-900/60';
              bgClass = 'bg-amber-950/30';
            } else if (diag.type === 'success') {
              icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
              borderColor = 'border-emerald-900/60';
              bgClass = 'bg-emerald-950/30';
            }

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${borderColor} ${bgClass} flex flex-col gap-1.5`}
              >
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="text-xs font-bold text-slate-200">{diag.title}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-6">{diag.message}</p>
                {diag.recommendation && (
                  <div className="mt-1 pl-6 pt-1.5 border-t border-slate-800/60 flex items-start gap-1.5 text-[11px] text-amber-300/90">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-amber-200">Recommendation:</strong> {diag.recommendation}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
