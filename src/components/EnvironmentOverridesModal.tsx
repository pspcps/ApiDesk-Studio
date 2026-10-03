import React from 'react';
import { ApiRequest, Environment, KeyValuePair, BodyConfig } from '../types';
import { 
  X, 
  Layers, 
  Check, 
  Copy, 
  Upload, 
  Trash2, 
  Plus, 
  Variable, 
  Globe, 
  Sparkles,
  ArrowRight,
  Shield,
  FileCode,
  Sliders
} from 'lucide-react';
import { MethodBadge } from './MethodBadge';
import { 
  hasEnvironmentOverride, 
  getOverriddenFields, 
  createEnvironmentOverride, 
  promoteEnvironmentToDefault, 
  removeEnvironmentOverride 
} from '../utils/environmentOverrideHelper';

interface EnvironmentOverridesModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (envId: string | null) => void;
  onRequestUpdate: (updated: ApiRequest) => void;
}

export const EnvironmentOverridesModal: React.FC<EnvironmentOverridesModalProps> = ({
  isOpen,
  onClose,
  request,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onRequestUpdate
}) => {
  if (!isOpen) return null;

  const defaultParamsCount = (request.params || []).filter(p => p.enabled && p.key).length;
  const defaultHeadersCount = (request.headers || []).filter(h => h.enabled && h.key).length;
  const defaultBodyType = request.body?.type || 'none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Environment-Scoped Request Profiles</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-950 border border-sky-800 text-sky-300 font-mono font-normal">
                  Per-Endpoint Body &amp; Params
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure distinct Query Params, Headers, and Body payloads for each environment without retyping them.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Request Target Sub-header */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MethodBadge method={request.method} size="sm" />
            <span className="font-semibold text-slate-200 truncate">{request.name}</span>
            <span className="text-slate-500 font-mono text-[11px] truncate max-w-md">{request.url}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
            <span>Active Env:</span>
            <span className="font-semibold text-sky-400 font-mono">
              {environments.find(e => e.id === activeEnvironmentId)?.name || 'Default (No Env)'}
            </span>
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Default / Base Shared Profile Card */}
          <div className={`border rounded-xl p-4 transition ${
            activeEnvironmentId === null
              ? 'bg-sky-950/30 border-sky-500/50 ring-1 ring-sky-500/20'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-300">
                  <Globe className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-2">
                    <span>Default / Base Configuration</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                      Global Shared
                    </span>
                    {activeEnvironmentId === null && (
                      <span className="px-2 py-0.2 rounded-full text-[10px] bg-sky-900/80 text-sky-300 font-bold border border-sky-700 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Active in Workspace
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Used as the default request and fallback whenever an environment does not have custom overrides.
                  </div>
                </div>
              </div>

              {activeEnvironmentId !== null && (
                <button
                  type="button"
                  onClick={() => onSelectEnvironment(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                >
                  Switch Workspace to Default
                </button>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
              <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">Query Params:</span>
                <span className="font-mono text-slate-200 font-medium">{defaultParamsCount} params active</span>
              </div>
              <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">Headers:</span>
                <span className="font-mono text-slate-200 font-medium">{defaultHeadersCount} headers</span>
              </div>
              <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">Body Type:</span>
                <span className="font-mono text-sky-300 font-medium">{defaultBodyType}</span>
              </div>
              <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">Auth Type:</span>
                <span className="font-mono text-emerald-400 font-medium">{request.auth?.type || 'none'}</span>
              </div>
            </div>
          </div>

          {/* Environment-Specific Profiles Header */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Variable className="w-3.5 h-3.5 text-sky-400" />
                <span>Environment Profiles ({environments.length})</span>
              </span>
            </h3>
          </div>

          {/* List of Environments */}
          {environments.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-xs">
              No environments found. Create an environment (like Development, Staging, Production) to start overriding parameters.
            </div>
          ) : (
            <div className="space-y-3">
              {environments.map((env) => {
                const isOverridden = hasEnvironmentOverride(request, env.id);
                const fields = getOverriddenFields(request, env.id);
                const override = request.environmentOverrides?.[env.id];
                const isActive = activeEnvironmentId === env.id;

                const envParamsCount = override?.params !== undefined 
                  ? override.params.filter(p => p.enabled && p.key).length 
                  : defaultParamsCount;
                const envBodyType = override?.body !== undefined 
                  ? override.body.type 
                  : defaultBodyType;
                const envAuthType = override?.auth !== undefined 
                  ? override.auth.type 
                  : (request.auth?.type || 'none');

                return (
                  <div
                    key={env.id}
                    className={`border rounded-xl p-4 transition ${
                      isActive
                        ? 'bg-sky-950/30 border-sky-500/60 ring-1 ring-sky-500/30'
                        : isOverridden
                        ? 'bg-slate-950/70 border-slate-700/80'
                        : 'bg-slate-950/40 border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                          isOverridden
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isOverridden ? '⚡' : '🌐'}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>{env.name}</span>
                            {isOverridden ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-700/60 font-semibold flex items-center gap-1">
                                <span>⚡ Overridden</span>
                                <span className="font-mono text-[9px] opacity-80">({fields.count} fields)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700">
                                Inherits Default
                              </span>
                            )}
                            {isActive && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] bg-sky-900/80 text-sky-300 font-bold border border-sky-700 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Active in Workspace
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {isOverridden
                              ? `Customized: ${[fields.params ? 'Params' : null, fields.headers ? 'Headers' : null, fields.body ? 'Body' : null, fields.auth ? 'Auth' : null, fields.url ? 'URL' : null].filter(Boolean).join(', ')}`
                              : 'Using base default request configuration'}
                          </div>
                        </div>
                      </div>

                      {/* Top Right Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => onSelectEnvironment(env.id)}
                            className="px-2.5 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                            title="Set as active environment in workspace"
                          >
                            <Variable className="w-3 h-3 text-sky-400" />
                            <span>Select Env</span>
                          </button>
                        )}

                        {!isOverridden ? (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = createEnvironmentOverride(request, env.id);
                              onRequestUpdate(updated);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700/80 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shadow-sm"
                            title="Create environment-specific params & body override"
                          >
                            <Plus className="w-3 h-3 text-amber-400" />
                            <span>Create Override</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = createEnvironmentOverride(request, env.id);
                                onRequestUpdate(updated);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Overwrite with current default values"
                            >
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy Default</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = promoteEnvironmentToDefault(request, env.id);
                                onRequestUpdate(updated);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Promote these overrides to be the base default request"
                            >
                              <Upload className="w-3 h-3 text-slate-400" />
                              <span>Promote to Default</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = removeEnvironmentOverride(request, env.id);
                                onRequestUpdate(updated);
                              }}
                              className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[10px] transition cursor-pointer"
                              title="Delete override and revert to default"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Env Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                      <div className={`px-2.5 py-1.5 rounded-lg border ${
                        fields.params ? 'bg-amber-950/20 border-amber-800/50 text-amber-200' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                      }`}>
                        <span className="text-slate-500 block text-[10px] flex items-center justify-between">
                          <span>Params:</span>
                          {fields.params && <span className="text-[9px] text-amber-400 font-bold">Override</span>}
                        </span>
                        <span className="font-mono font-medium">{envParamsCount} params</span>
                      </div>
                      <div className={`px-2.5 py-1.5 rounded-lg border ${
                        fields.headers ? 'bg-amber-950/20 border-amber-800/50 text-amber-200' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                      }`}>
                        <span className="text-slate-500 block text-[10px] flex items-center justify-between">
                          <span>Headers:</span>
                          {fields.headers && <span className="text-[9px] text-amber-400 font-bold">Override</span>}
                        </span>
                        <span className="font-mono font-medium">{override?.headers ? override.headers.filter(h => h.enabled && h.key).length : defaultHeadersCount} headers</span>
                      </div>
                      <div className={`px-2.5 py-1.5 rounded-lg border ${
                        fields.body ? 'bg-amber-950/20 border-amber-800/50 text-amber-200' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                      }`}>
                        <span className="text-slate-500 block text-[10px] flex items-center justify-between">
                          <span>Body:</span>
                          {fields.body && <span className="text-[9px] text-amber-400 font-bold">Override</span>}
                        </span>
                        <span className="font-mono font-medium">{envBodyType}</span>
                      </div>
                      <div className={`px-2.5 py-1.5 rounded-lg border ${
                        fields.auth ? 'bg-amber-950/20 border-amber-800/50 text-amber-200' : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                      }`}>
                        <span className="text-slate-500 block text-[10px] flex items-center justify-between">
                          <span>Auth:</span>
                          {fields.auth && <span className="text-[9px] text-amber-400 font-bold">Override</span>}
                        </span>
                        <span className="font-mono font-medium">{envAuthType}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Tip: Switch environments directly from the Request Builder to automatically test with that environment&apos;s custom payload.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
