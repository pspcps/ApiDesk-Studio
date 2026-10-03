import React from 'react';
import { Zap, Activity, Flame, ShieldAlert, TrendingUp, Clock } from 'lucide-react';

export interface TestProfile {
  id: string;
  name: string;
  description: string;
  connections: number;
  duration: number;
  pipelining: number;
  rateLimit: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
}

interface LoadTesterPresetsProps {
  currentConnections: number;
  currentDuration: number;
  onSelectProfile: (profile: TestProfile) => void;
  disabled?: boolean;
}

export const TEST_PROFILES: TestProfile[] = [
  {
    id: 'quick',
    name: 'Quick Probe',
    description: '5 connections for 5s to verify responsiveness & health',
    connections: 5,
    duration: 5,
    pipelining: 1,
    rateLimit: '',
    icon: <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
    badge: 'Smoke',
    badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  },
  {
    id: 'baseline',
    name: 'Baseline SLA',
    description: '15 connections for 10s for standard SLA assessment',
    connections: 15,
    duration: 10,
    pipelining: 1,
    rateLimit: '',
    icon: <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    badge: 'Standard',
    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  },
  {
    id: 'spike',
    name: 'Spike Burst',
    description: '75 connections for 10s sudden traffic burst',
    connections: 75,
    duration: 10,
    pipelining: 2,
    rateLimit: '',
    icon: <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
    badge: 'Spike',
    badgeColor: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
  },
  {
    id: 'stress',
    name: 'Stress Test',
    description: '150 connections for 20s to find breaking point',
    connections: 150,
    duration: 20,
    pipelining: 2,
    rateLimit: '',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
    badge: 'Stress',
    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30'
  },
  {
    id: 'soak',
    name: 'Soak / Leak',
    description: '30 connections for 45s to detect memory leaks & degradation',
    connections: 30,
    duration: 45,
    pipelining: 1,
    rateLimit: '',
    icon: <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
    badge: 'Soak',
    badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30'
  }
];

export const LoadTesterPresets: React.FC<LoadTesterPresetsProps> = ({
  currentConnections,
  currentDuration,
  onSelectProfile,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          Load Profile Presets
        </span>
        <span className="text-[10px] text-slate-400 font-medium">1-click automated profiles</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
        {TEST_PROFILES.map((profile) => {
          const isSelected =
            currentConnections === profile.connections && currentDuration === profile.duration;

          return (
            <button
              key={profile.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectProfile(profile)}
              title={`${profile.name}: ${profile.description}`}
              className={`p-2.5 rounded-lg border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer min-w-0 overflow-hidden ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/70 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/70 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700 text-slate-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between gap-1 w-full min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  {profile.icon}
                  <span className="truncate text-xs font-semibold text-slate-200 leading-tight">
                    {profile.name}
                  </span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${profile.badgeColor}`}>
                  {profile.badge}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 border-t border-slate-800/50">
                <span className="font-mono text-slate-300 text-[10px] font-medium whitespace-nowrap">
                  {profile.connections} VUs
                </span>
                <span className="font-mono text-slate-400 text-[10px] whitespace-nowrap">
                  {profile.duration}s
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
