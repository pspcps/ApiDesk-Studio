import React, { useState, useRef } from 'react';
import { ApiRequest, ApiResponse, Collection } from '../types';
import { executeApiRequest } from '../utils/requestExecutor';
import { VariableContext } from '../utils/variableResolver';
import { MethodBadge } from './MethodBadge';
import { 
  Play, 
  Square, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  HardDrive, 
  X, 
  Sparkles,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface CollectionRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  folderId?: string;
  variableContext: VariableContext;
  onUpdateVariable?: (key: string, val: string) => void;
}

interface RunnerItemResult {
  request: ApiRequest;
  response?: ApiResponse;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  error?: string;
}

export const CollectionRunnerModal: React.FC<CollectionRunnerModalProps> = ({
  isOpen,
  onClose,
  collection,
  folderId,
  variableContext,
  onUpdateVariable
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [delayMs, setDelayMs] = useState(200);
  const [results, setResults] = useState<RunnerItemResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isAbortedRef = useRef(false);

  if (!isOpen || !collection) return null;

  // Filter requests to run
  const targetRequests = folderId
    ? collection.requests.filter(r => r.folderId === folderId)
    : collection.requests;

  const handleStartRun = async () => {
    setIsRunning(true);
    isAbortedRef.current = false;

    const initialResults: RunnerItemResult[] = targetRequests.map(r => ({
      request: r,
      status: 'pending'
    }));
    setResults(initialResults);

    let localContext: VariableContext = { ...variableContext };

    for (let i = 0; i < targetRequests.length; i++) {
      if (isAbortedRef.current) {
        break;
      }

      setCurrentIndex(i);
      setResults(prev => {
        const copy = [...prev];
        copy[i] = { ...copy[i], status: 'running' };
        return copy;
      });

      const req = targetRequests[i];
      try {
        const response = await executeApiRequest(req, localContext);

        // If extractions saved variables, update local context for subsequent requests
        if (response.savedVariables && Object.keys(response.savedVariables).length > 0) {
          for (const [k, v] of Object.entries(response.savedVariables)) {
            if (onUpdateVariable) onUpdateVariable(k, v);
          }
          if (localContext.activeEnvironment) {
            const updatedVars = [...localContext.activeEnvironment.variables];
            for (const [k, v] of Object.entries(response.savedVariables)) {
              const existing = updatedVars.find(x => x.key === k);
              if (existing) existing.value = v;
              else updatedVars.push({ id: 'v_' + Math.random(), key: k, value: v, enabled: true });
            }
            localContext = {
              ...localContext,
              activeEnvironment: {
                ...localContext.activeEnvironment,
                variables: updatedVars
              }
            };
          }
        }

        const allTestsPassed = (response.testResults || []).every(t => t.passed);
        const hasTests = (response.testResults || []).length > 0;
        const passed = hasTests ? (allTestsPassed && response.ok) : response.ok;

        setResults(prev => {
          const copy = [...prev];
          copy[i] = {
            request: req,
            response,
            status: passed ? 'passed' : 'failed'
          };
          return copy;
        });
      } catch (err: any) {
        setResults(prev => {
          const copy = [...prev];
          copy[i] = {
            request: req,
            status: 'error',
            error: err.message || 'Execution error'
          };
          return copy;
        });
      }

      // Delay between requests
      if (delayMs > 0 && i < targetRequests.length - 1 && !isAbortedRef.current) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }

    setIsRunning(false);
    setCurrentIndex(-1);
  };

  const handleStopRun = () => {
    isAbortedRef.current = true;
    setIsRunning(false);
  };

  const totalRuns = results.length;
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  const progressPercent = totalRuns > 0 ? Math.round(((passedCount + failedCount) / totalRuns) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-3xl h-[650px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Collection Runner</h2>
              <span className="text-[11px] text-slate-400">
                Running {targetRequests.length} request(s) from "{collection.name}"
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Delay between requests:</span>
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 text-right focus:outline-none"
                min={0}
                max={5000}
                step={50}
              />
              <span className="text-slate-500">ms</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStopRun}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Execution
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRun}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                {results.length > 0 ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {results.length > 0 ? 'Run Again' : 'Start Run'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Stat Summary */}
        {results.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-300">
                Progress: {passedCount + failedCount} of {totalRuns} ({progressPercent}%)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {passedCount} Passed
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {failedCount} Failed
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(passedCount / Math.max(1, totalRuns)) * 100}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${(failedCount / Math.max(1, totalRuns)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Live List of Execution Steps */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-slate-950">
          {(results.length > 0 ? results : targetRequests.map(r => ({ request: r, status: 'pending' as const }))).map((item, idx) => {
            const isCurrent = currentIndex === idx;

            return (
              <div
                key={item.request.id || idx}
                className={`p-3 rounded-lg border flex items-center justify-between transition ${
                  isCurrent
                    ? 'bg-sky-950/40 border-sky-500/50 ring-1 ring-sky-500/30'
                    : item.status === 'passed'
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    : item.status === 'failed' || item.status === 'error'
                    ? 'bg-rose-950/20 border-rose-800/40'
                    : 'bg-slate-900/30 border-slate-800/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3 truncate flex-1">
                  {item.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {(item.status === 'failed' || item.status === 'error') && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {item.status === 'running' && (
                    <div className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin shrink-0"></div>
                  )}
                  {item.status === 'pending' && <Clock className="w-4 h-4 text-slate-600 shrink-0" />}

                  <MethodBadge method={item.request.method} size="sm" />

                  <div className="flex flex-col truncate">
                    <span className="text-xs font-semibold text-slate-200 truncate">{item.request.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono truncate">{item.request.url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono shrink-0 pl-3">
                  {item.response && (
                    <>
                      <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        item.response.ok ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {item.response.status}
                      </span>
                      <span className="text-slate-400 text-[11px]">{item.response.timeMs}ms</span>
                    </>
                  )}
                  {item.error && (
                    <span className="text-rose-400 text-[11px] max-w-[160px] truncate">{item.error}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
