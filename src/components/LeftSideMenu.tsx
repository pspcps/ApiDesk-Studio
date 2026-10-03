import React, { useState, useEffect } from 'react';
import { 
  SendHorizontal, 
  Flame, 
  Code2, 
  Terminal, 
  FileText, 
  HardDrive, 
  Share2, 
  Variable, 
  ChevronRight, 
  ChevronLeft,
  Layers,
  Globe,
  Compass,
  Radio,
  Workflow,
  ToggleRight
} from 'lucide-react';
import { AppViewMode } from './Navbar';

interface LeftSideMenuProps {
  activeViewMode: AppViewMode;
  onSelectViewMode: (mode: AppViewMode) => void;
  openTabsCount?: number;
  collectionsCount?: number;
  environmentsCount?: number;
  onOpenLogsModal: () => void;
  onOpenStorageModal: () => void;
  onOpenImportModal: () => void;
  onOpenTeamSyncModal: () => void;
  onOpenEnvironmentModal: () => void;
}

export const LeftSideMenu: React.FC<LeftSideMenuProps> = ({
  activeViewMode,
  onSelectViewMode,
  openTabsCount = 0,
  environmentsCount = 0,
  onOpenLogsModal,
  onOpenStorageModal,
  onOpenImportModal,
  onOpenTeamSyncModal,
  onOpenEnvironmentModal
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('apidesk_left_menu_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('apidesk_left_menu_expanded', JSON.stringify(isExpanded));
    } catch {}
  }, [isExpanded]);

  const primaryMenuItems: {
    id: AppViewMode;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    activeBg: string;
    activeBorder: string;
    badge?: string | number;
    tag?: string;
  }[] = [
    {
      id: 'api_client',
      label: 'API Client',
      description: 'REST, GraphQL & Collections',
      icon: SendHorizontal,
      accentColor: 'text-sky-400',
      activeBg: 'bg-sky-950/80',
      activeBorder: 'border-sky-500',
      badge: openTabsCount > 0 ? openTabsCount : undefined
    },
    {
      id: 'load_testing',
      label: 'Load Testing',
      description: 'Concurrency & Stress Benchmarks',
      icon: Flame,
      accentColor: 'text-amber-400',
      activeBg: 'bg-amber-950/80',
      activeBorder: 'border-amber-500',
      tag: 'Engine'
    },
    {
      id: 'script_runner',
      label: 'Script Automation',
      description: 'Regression Suites & Live Logs',
      icon: Code2,
      accentColor: 'text-indigo-400',
      activeBg: 'bg-indigo-950/80',
      activeBorder: 'border-indigo-500',
      tag: 'CLI'
    }
  ];

  const platformDevToolsItems: {
    id: AppViewMode;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    activeBg: string;
    activeBorder: string;
  }[] = [
    {
      id: 'service_atlas',
      label: 'Service Atlas',
      description: 'Version checker & CAB generator',
      icon: Globe,
      accentColor: 'text-sky-400',
      activeBg: 'bg-sky-950/80',
      activeBorder: 'border-sky-500'
    },
    {
      id: 'route_explorer',
      label: 'Route Explorer',
      description: 'Custom OpenAPI spec routes',
      icon: Compass,
      accentColor: 'text-emerald-400',
      activeBg: 'bg-emerald-950/80',
      activeBorder: 'border-emerald-500'
    },
    {
      id: 'datapulse_publish',
      label: 'DataPulse Publish',
      description: 'Kafka msg fetch & publish',
      icon: Radio,
      accentColor: 'text-purple-400',
      activeBg: 'bg-purple-950/80',
      activeBorder: 'border-purple-500'
    },
    {
      id: 'datapulse_workflow',
      label: 'DataPulse Workflow',
      description: 'API, Kafka, Mongo & Redis flows',
      icon: Workflow,
      accentColor: 'text-amber-400',
      activeBg: 'bg-amber-950/80',
      activeBorder: 'border-amber-500'
    },
    {
      id: 'feature_toggles',
      label: 'Feature Toggles',
      description: 'Browse FT state & overrides',
      icon: ToggleRight,
      accentColor: 'text-teal-400',
      activeBg: 'bg-teal-950/80',
      activeBorder: 'border-teal-500'
    }
  ];

  const quickTools = [
    {
      id: 'logs',
      label: 'System Logs',
      sublabel: '~/apilogs Tracing',
      icon: FileText,
      iconColor: 'text-sky-400',
      onClick: onOpenLogsModal
    },
    {
      id: 'curl_import',
      label: 'Import cURL / Postman',
      sublabel: 'Raw commands & JSON',
      icon: Terminal,
      iconColor: 'text-emerald-400',
      onClick: onOpenImportModal
    },
    {
      id: 'environments',
      label: 'Environments',
      sublabel: `${environmentsCount} profiles configured`,
      icon: Variable,
      iconColor: 'text-purple-400',
      onClick: onOpenEnvironmentModal
    },
    {
      id: 'storage_sync',
      label: 'Storage & Disk Sync',
      sublabel: 'Direct file & Server backup',
      icon: HardDrive,
      iconColor: 'text-teal-400',
      onClick: onOpenStorageModal
    },
    {
      id: 'team_sync',
      label: 'Team Sync & Export',
      sublabel: 'Share workspace & suites',
      icon: Share2,
      iconColor: 'text-cyan-400',
      onClick: onOpenTeamSyncModal
    }
  ];

  return (
    <aside 
      id="left-side-navigation-menu"
      className={`bg-slate-950 border-r border-slate-800/90 flex flex-col shrink-0 select-none transition-all duration-200 z-20 ${
        isExpanded ? 'w-56' : 'w-14'
      }`}
    >
      {/* Header & Collapse Toggle */}
      <div className="h-11 border-b border-slate-800/80 px-2 flex items-center justify-between">
        {isExpanded ? (
          <>
            <div className="flex items-center gap-1.5 pl-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Modules &amp; Menu
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition cursor-pointer"
              title="Collapse left menu to icons"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded transition cursor-pointer"
            title="Expand left menu"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {/* Core Workspaces */}
        {isExpanded && (
          <div className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspaces
          </div>
        )}

        {primaryMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeViewMode === item.id;

          return (
            <button
              key={item.id}
              type="button"
              id={`left-menu-item-${item.id}`}
              onClick={() => onSelectViewMode(item.id)}
              className={`relative flex items-center gap-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
                isExpanded ? 'p-2 w-full text-left' : 'p-2.5 justify-center w-full'
              } ${
                isActive
                  ? `${item.activeBg} border ${item.activeBorder} text-white shadow-sm shadow-black/40`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/90 border border-transparent'
              }`}
              title={!isExpanded ? `${item.label} - ${item.description}` : undefined}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                isActive 
                  ? 'bg-slate-900/80 text-white shadow-inner' 
                  : 'bg-slate-900/60 text-slate-400'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? item.accentColor : ''}`} />
              </div>

              {isExpanded && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate ${isActive ? 'text-white font-bold' : 'text-slate-300'}`}>
                      {item.label}
                    </span>
                    {item.tag && (
                      <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {item.tag}
                      </span>
                    )}
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-sky-900/80 text-sky-200 border border-sky-700/60">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {item.description}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        <div className="my-1 border-t border-slate-800/80" />

        {/* Platform Dev Tools */}
        {isExpanded && (
          <div className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Platform Dev Tools
          </div>
        )}

        {platformDevToolsItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeViewMode === item.id;

          return (
            <button
              key={item.id}
              type="button"
              id={`left-menu-item-${item.id}`}
              onClick={() => onSelectViewMode(item.id)}
              className={`relative flex items-center gap-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
                isExpanded ? 'p-2 w-full text-left' : 'p-2.5 justify-center w-full'
              } ${
                isActive
                  ? `${item.activeBg} border ${item.activeBorder} text-white shadow-sm shadow-black/40`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/90 border border-transparent'
              }`}
              title={!isExpanded ? `${item.label} - ${item.description}` : undefined}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                isActive 
                  ? 'bg-slate-900/80 text-white shadow-inner' 
                  : 'bg-slate-900/60 text-slate-400'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? item.accentColor : ''}`} />
              </div>

              {isExpanded && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-white font-bold' : 'text-slate-300'}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {item.description}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        <div className="my-1 border-t border-slate-800/80" />

        {/* Quick Tools & Utilities */}
        {isExpanded && (
          <div className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Tools &amp; Utilities
          </div>
        )}

        {quickTools.map((tool) => {
          const ToolIcon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={tool.onClick}
              className={`flex items-center gap-2.5 rounded-lg transition text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent cursor-pointer ${
                isExpanded ? 'p-2 w-full text-left' : 'p-2.5 justify-center w-full'
              }`}
              title={!isExpanded ? `${tool.label} (${tool.sublabel})` : undefined}
            >
              <div className="w-6 h-6 rounded-md bg-slate-900/50 flex items-center justify-center shrink-0">
                <ToolIcon className={`w-3.5 h-3.5 ${tool.iconColor}`} />
              </div>

              {isExpanded && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {tool.label}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate leading-tight">
                    {tool.sublabel}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer / Quick Status */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950/80">
        {isExpanded ? (
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span className="font-mono">ApiDesk v1.0</span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ready
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="ApiDesk Ready" />
          </div>
        )}
      </div>
    </aside>
  );
};
