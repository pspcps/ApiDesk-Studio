import React from 'react';
import { Activity, Flame, Globe, Square, Zap, Clock } from 'lucide-react';

interface LoadTesterLiveBannerProps {
  isRunning: boolean;
  elapsedSec: number;
  totalDuration: number;
  connections: number;
  engineMode: 'backend' | 'browser';
  liveRequestsCount: number;
  liveRps: number;
  onAbort: () => void;
}

export const LoadTesterLiveBanner: React.FC<LoadTesterLiveBannerProps> = ({
  isRunning,
  elapsedSec,
  totalDuration,
  connections,
  engineMode,
  liveRequestsCount,
  liveRps,
  onAbort
}) => {
  if (!isRunning) return null;

  const progressPercent = Math.min(100, Math.round((elapsedSec / Math.max(1, totalDuration)) * 100));

  return (
    <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-4 flex flex-col gap-3 shadow-xl shadow-amber-500/10 animate-fade-in mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8">
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 animate-ping" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-md">
              <Activity className="w-4 h-4 animate-spin" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Stress Test in Progress
              </span>
              <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {engineMode === 'backend' ? 'Autocannon Socket Daemon' : 'In-Browser Multi-Fetch'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {connections} Concurrent Virtual Clients • {totalDuration}s Target Duration
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onAbort}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition shadow cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 fill-white" />
          <span>Stop Run</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800 flex">
          <div
            style={{ width: `${progressPercent}%` }}
            className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 h-full transition-all duration-300 rounded-full"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-amber-300 font-bold">
            <Clock className="w-3 h-3" />
            {elapsedSec}s / {totalDuration}s elapsed ({progressPercent}%)
          </span>
          <span className="text-slate-300">
            {totalDuration - elapsedSec}s remaining
          </span>
        </div>
      </div>

      {/* Live Telemetry Tickers */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-900">
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">Live RPS Velocity</span>
          <span className="text-base font-black font-mono text-amber-400">
            {liveRps > 0 ? liveRps.toFixed(1) : 'Profiling...'}
          </span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">Total Requests Sent</span>
          <span className="text-base font-black font-mono text-emerald-400">
            {liveRequestsCount.toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">Active Workers</span>
          <span className="text-base font-black font-mono text-sky-400">
            {connections} Sockets
          </span>
        </div>
      </div>
    </div>
  );
};
