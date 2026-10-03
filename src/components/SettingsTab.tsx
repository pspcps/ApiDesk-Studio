import React from 'react';
import { RequestSettings } from '../types';
import { ShieldCheck, ArrowRightLeft, Clock, Info } from 'lucide-react';

interface SettingsTabProps {
  settings: RequestSettings;
  onChange: (settings: RequestSettings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onChange }) => {
  return (
    <div className="flex flex-col gap-5 max-w-2xl p-4 bg-slate-900/30 rounded-lg border border-slate-800/80">
      {/* Backend Proxy Toggle */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">Backend Proxy (CORS Bypass)</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Recommended
            </span>
          </div>
          <span className="text-xs text-slate-400 leading-relaxed">
            Routes requests through the built-in local backend proxy to bypass browser Cross-Origin Resource Sharing (CORS) restrictions and allow inspecting any third-party or local service.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            checked={settings.proxyMode !== false}
            onChange={(e) => onChange({ ...settings, proxyMode: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
        </label>
      </div>

      {/* Follow Redirects Toggle */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-200">Automatically Follow HTTP Redirects</span>
          <span className="text-xs text-slate-400 leading-relaxed">
            Follows 301, 302, 307, and 308 HTTP redirect responses automatically.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            checked={settings.followRedirects !== false}
            onChange={(e) => onChange({ ...settings, followRedirects: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
        </label>
      </div>

      {/* Request Timeout */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-200">Request Timeout (Milliseconds)</span>
          <span className="text-xs text-slate-400">
            Maximum time to wait before aborting the request. Set to 0 or 30000 for standard timeout.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={settings.timeout || 30000}
            onChange={(e) => onChange({ ...settings, timeout: parseInt(e.target.value, 10) || 30000 })}
            className="w-28 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200 text-right focus:outline-none"
            min={1000}
            max={60000}
            step={1000}
          />
          <span className="text-xs text-slate-400">ms</span>
        </div>
      </div>
    </div>
  );
};
