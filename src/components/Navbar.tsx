import React, { useState, useEffect } from 'react';
import { Environment, StorageStatus } from '../types';
import { 
  SendHorizontal, 
  Download, 
  Upload, 
  Share2, 
  Variable, 
  HardDrive, 
  Sparkles, 
  Laptop, 
  Check, 
  Terminal,
  ShieldCheck,
  FileCheck,
  Server,
  Flame,
  Code2,
  FileText
} from 'lucide-react';

export type AppViewMode =
  | 'api_client'
  | 'load_testing'
  | 'script_runner'
  | 'service_atlas'
  | 'route_explorer'
  | 'datapulse_publish'
  | 'datapulse_workflow'
  | 'feature_toggles';

interface NavbarProps {
  activeViewMode: AppViewMode;
  onSelectViewMode: (mode: AppViewMode) => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  storageStatus: StorageStatus;
  onSelectEnvironment: (envId: string | null) => void;
  onOpenEnvironmentModal: () => void;
  onOpenImportModal: () => void;
  onOpenTeamSyncModal: () => void;
  onOpenStorageModal: () => void;
  onOpenLogsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeViewMode,
  onSelectViewMode,
  environments,
  activeEnvironmentId,
  storageStatus,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  onOpenImportModal,
  onOpenTeamSyncModal,
  onOpenStorageModal,
  onOpenLogsModal
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Detect macOS & Electron desktop environment for native traffic light safe margins
  const isMacDesktop = typeof window !== 'undefined' && (
    (/Macintosh|Mac OS X|MacIntel/.test(navigator.userAgent) || /Mac/.test(navigator.platform || '')) &&
    (/Electron/.test(navigator.userAgent) || (window as any).process?.type === 'renderer' || !!(window as any).electron)
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const activeEnv = environments.find(e => e.id === activeEnvironmentId);

  return (
    <header 
      className={`h-12 bg-slate-950 border-b border-slate-800/80 px-3 flex items-center justify-between select-none shrink-0 ${
        isMacDesktop ? 'pl-20' : 'pl-3'
      }`}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Brand & App Title */}
      <div className="flex items-center gap-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center gap-2.5">
          <img 
            src="/app_icon.png" 
            alt="ApiDesk Icon" 
            className="w-7 h-7 rounded-lg shadow-md shadow-sky-500/20 object-cover border border-sky-500/30"
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black tracking-tight text-white bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              ApiDesk
            </span>
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/60">
              Desktop
            </span>
          </div>
        </div>

        {/* PC Storage Mode Indicator Button */}
        <button
          type="button"
          onClick={onOpenStorageModal}
          className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
            storageStatus.mode === 'pc_file_handle'
              ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60'
              : storageStatus.mode === 'server_disk'
              ? 'bg-purple-950/60 border-purple-600/50 text-purple-300 hover:bg-purple-900/60'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
          title="Configure PC Hard Drive / File System Storage"
        >
          {storageStatus.mode === 'pc_file_handle' ? (
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : storageStatus.mode === 'server_disk' ? (
            <Server className="w-3.5 h-3.5 text-purple-400" />
          ) : (
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span className="font-mono text-[11px]">
            {storageStatus.mode === 'pc_file_handle'
              ? `PC File: ${storageStatus.fileName || 'Linked'}`
              : storageStatus.mode === 'server_disk'
              ? 'PC Server Disk'
              : 'PC Storage / Disk Sync'}
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
            ⚙️
          </span>
        </button>
      </div>

      {/* Center Active Mode & Breadcrumb */}
      <div 
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-medium">
          {activeViewMode === 'api_client' ? (
            <>
              <SendHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-200 font-semibold">API Client Workspace</span>
            </>
          ) : activeViewMode === 'load_testing' ? (
            <>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-200 font-semibold">High-Concurrency Load Testing</span>
            </>
          ) : (
            <>
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-200 font-semibold">Script &amp; Test Suite Automation</span>
            </>
          )}
        </div>
      </div>

      {/* Right Action Buttons */}
      <div 
        className="flex items-center gap-2 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Environment Quick Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden text-xs">
          <div className="pl-2.5 pr-1 text-slate-400 flex items-center">
            <Variable className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <select
            value={activeEnvironmentId || ''}
            onChange={(e) => onSelectEnvironment(e.target.value ? e.target.value : null)}
            className="bg-transparent py-1.5 pr-3 pl-1 text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-300">No Environment (Globals)</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id} className="bg-slate-900 text-slate-200">
                {env.name} ({env.variables.filter(v => v.enabled && v.key).length})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenEnvironmentModal}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-l border-slate-800 transition"
            title="Manage Environments"
          >
            ⚙️
          </button>
        </div>

        {/* Logs Viewer Button */}
        <button
          type="button"
          onClick={onOpenLogsModal}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 hover:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          title="Open System & API Tracing Logs (~/apilogs)"
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>Logs (~/apilogs)</span>
        </button>

        {/* Import cURL / Postman Button */}
        <button
          type="button"
          onClick={onOpenImportModal}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          <span>Import cURL / JSON</span>
        </button>

        {/* Team Sync & PC Export Button */}
        <button
          type="button"
          onClick={onOpenTeamSyncModal}
          className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Share2 className="w-3.5 h-3.5 text-sky-400" />
          <span>Team Sync & Export</span>
        </button>

        {/* PWA Install Button (shows when installable) */}
        {isInstallable && (
          <button
            type="button"
            onClick={handleInstallApp}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}
      </div>
    </header>
  );
};

