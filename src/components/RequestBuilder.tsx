import React, { useState } from 'react';
import { ApiRequest, HttpMethod, KeyValuePair, Environment, AuthConfig, BodyConfig } from '../types';
import { METHOD_COLORS, MethodBadge } from './MethodBadge';
import { KeyValueEditor, COMMON_HEADER_SUGGESTIONS } from './KeyValueEditor';
import { AuthTab } from './AuthTab';
import { BodyTab } from './BodyTab';
import { TestsTab } from './TestsTab';
import { ScriptsTab } from './ScriptsTab';
import { SettingsTab } from './SettingsTab';
import { isCurlCommand, parseCurlCommand, generateCurl } from '../utils/curlParser';
import { resolveTemplateString, VariableContext } from '../utils/variableResolver';
import { 
  getEffectiveRequest, 
  hasEnvironmentOverride, 
  getOverriddenFields, 
  updateRequestField, 
  createEnvironmentOverride, 
  promoteEnvironmentToDefault, 
  removeEnvironmentOverride 
} from '../utils/environmentOverrideHelper';
import { EnvironmentOverridesModal } from './EnvironmentOverridesModal';
import { 
  Play, 
  Square, 
  Save, 
  Code, 
  Copy, 
  Check, 
  Sparkles, 
  Settings, 
  FolderPlus, 
  Edit2, 
  Layers, 
  Variable, 
  Globe, 
  Sliders, 
  Plus, 
  Upload, 
  Trash2,
  ChevronDown
} from 'lucide-react';

interface RequestBuilderProps {
  request: ApiRequest;
  isLoading: boolean;
  variableContext: VariableContext;
  environments?: Environment[];
  activeEnvironmentId?: string | null;
  onSelectEnvironment?: (envId: string | null) => void;
  onUpdate: (updated: ApiRequest) => void;
  onSend: () => void;
  onAbort?: () => void;
  onSave: () => void;
  onOpenCodeSnippet: () => void;
  onSaveToCollection?: () => void;
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  request,
  isLoading,
  variableContext,
  environments = [],
  activeEnvironmentId = null,
  onSelectEnvironment,
  onUpdate,
  onSend,
  onAbort,
  onSave,
  onOpenCodeSnippet,
  onSaveToCollection
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'auth' | 'headers' | 'body' | 'scripts' | 'tests' | 'settings'>('params');
  const [curlNotice, setCurlNotice] = useState<{
    method: string;
    url: string;
    hasBody: boolean;
    headerCount: number;
  } | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isOverridesModalOpen, setIsOverridesModalOpen] = useState(false);

  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  // Calculate effective request for the active environment
  const effectiveRequest = getEffectiveRequest(request, activeEnvironmentId);
  const isEnvOverridden = hasEnvironmentOverride(request, activeEnvironmentId);
  const overriddenFields = getOverriddenFields(request, activeEnvironmentId);
  const activeEnv = environments.find(e => e.id === activeEnvironmentId);
  const totalOverridesCount = Object.keys(request.environmentOverrides || {}).length;

  // Apply parsed cURL request onto current request
  const applyParsedCurl = (curlString: string): boolean => {
    const parsed = parseCurlCommand(curlString);
    if (!parsed) return false;

    let updatedRequest: ApiRequest;
    if (activeEnvironmentId && isEnvOverridden) {
      // Apply parsed fields onto environment override
      let r = request;
      if (parsed.url) r = updateRequestField(r, activeEnvironmentId, true, 'url', parsed.url);
      if (parsed.headers) r = updateRequestField(r, activeEnvironmentId, true, 'headers', parsed.headers);
      if (parsed.body) r = updateRequestField(r, activeEnvironmentId, true, 'body', parsed.body);
      if (parsed.method) r = { ...r, method: parsed.method };
      updatedRequest = r;
    } else {
      updatedRequest = {
        ...request,
        ...parsed,
        id: request.id,
        name: request.name || (parsed.url ? `${parsed.method} ${parsed.url.split('?')[0].split('/').filter(Boolean).pop() || 'Request'}` : 'Imported Request'),
        updatedAt: Date.now()
      };
    }

    onUpdate(updatedRequest);

    // Auto switch active sub-tab to body if body exists, else headers if headers exist
    if (parsed.body && parsed.body.type !== 'none' && parsed.body.json && parsed.body.json.trim() !== '{\n  \n}') {
      setActiveSubTab('body');
    } else if (parsed.headers && parsed.headers.filter(h => h.key).length > 0) {
      setActiveSubTab('headers');
    }

    const headerCount = (parsed.headers || []).filter(h => h.key).length;
    const hasBody = !!(parsed.body && parsed.body.type !== 'none');

    setCurlNotice({
      method: parsed.method || 'GET',
      url: parsed.url || '',
      hasBody,
      headerCount
    });

    setTimeout(() => setCurlNotice(null), 6000);
    return true;
  };

  // Intercept paste event directly from clipboard to preserve raw multi-line string
  const handlePasteUrl = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (isCurlCommand(pastedText)) {
      e.preventDefault();
      applyParsedCurl(pastedText);
    }
  };

  // Handle URL change & fallback cURL detection
  const handleUrlChange = (value: string) => {
    if (isCurlCommand(value)) {
      if (applyParsedCurl(value)) {
        return;
      }
    }

    // Sync Query Parameters when user types ?key=val into URL
    if (value.includes('?')) {
      const qIndex = value.indexOf('?');
      const queryString = value.substring(qIndex + 1);
      const searchParams = new URLSearchParams(queryString);
      
      const newParams: KeyValuePair[] = [];
      searchParams.forEach((val, k) => {
        newParams.push({
          id: 'p_' + Math.random().toString(36).substring(2, 9),
          key: k,
          value: val,
          enabled: true
        });
      });

      if (newParams.length > 0) {
        let updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'url', value.substring(0, qIndex));
        updated = updateRequestField(updated, activeEnvironmentId, isEnvOverridden, 'params', newParams);
        onUpdate(updated);
        return;
      }
    }

    const updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'url', value);
    onUpdate(updated);
  };

  const handleCopyCurl = () => {
    const resolvedUrl = resolveTemplateString(effectiveRequest.url, variableContext);
    const resolvedHeaders: Record<string, string> = {};
    for (const h of effectiveRequest.headers.filter(x => x.enabled && x.key)) {
      resolvedHeaders[resolveTemplateString(h.key, variableContext)] = resolveTemplateString(h.value, variableContext);
    }
    const curl = generateCurl(effectiveRequest, resolvedUrl, resolvedHeaders);
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const activeParamsCount = (effectiveRequest.params || []).filter(p => p.enabled && p.key).length;
  const activeHeadersCount = (effectiveRequest.headers || []).filter(h => h.enabled && h.key).length;
  const activeTestsCount = (effectiveRequest.tests || []).filter(t => t.enabled).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      {/* cURL Auto-detection Notification Banner */}
      {curlNotice && (
        <div className="bg-sky-950/90 border-b border-sky-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-sky-200 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-white">cURL command auto-converted:</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-900 border border-sky-700 text-sky-300">
                {curlNotice.method}
              </span>
              <span className="text-slate-300 truncate max-w-xs font-mono text-[11px]">{curlNotice.url}</span>
              {curlNotice.headerCount > 0 && (
                <span className="text-sky-300 text-[11px] font-medium">({curlNotice.headerCount} header{curlNotice.headerCount > 1 ? 's' : ''})</span>
              )}
              {curlNotice.hasBody && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-700 text-emerald-300 font-medium">
                  Body extracted
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurlNotice(null)}
            className="text-sky-400 hover:text-white text-[11px] underline ml-2 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Request Title, Collection Path & Environment Scope Dock */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MethodBadge method={request.method} size="sm" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0 group">
            <input
              type="text"
              value={request.name}
              onChange={(e) => onUpdate({ ...request, name: e.target.value, updatedAt: Date.now() })}
              placeholder="Request Name (e.g. Get User Profile)"
              className="bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-700 focus:border-sky-500 rounded px-2 py-0.5 text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none transition w-full max-w-md"
            />
            <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
          </div>
        </div>

        {/* Environment-Scoped Request Controls */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 flex-wrap">
          {/* Quick Environment Switcher */}
          {environments.length > 0 && onSelectEnvironment && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden text-xs">
              <div className="pl-2 pr-1 text-slate-400 flex items-center">
                {activeEnv ? <Variable className="w-3.5 h-3.5 text-amber-400" /> : <Globe className="w-3.5 h-3.5 text-slate-400" />}
              </div>
              <select
                value={activeEnvironmentId || ''}
                onChange={(e) => onSelectEnvironment(e.target.value ? e.target.value : null)}
                className="bg-transparent py-1 pr-2.5 pl-1 text-[11px] font-medium text-slate-200 focus:outline-none cursor-pointer"
                title="Switch active environment profile"
              >
                <option value="" className="bg-slate-900 text-slate-300">Default (Global Shared)</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id} className="bg-slate-900 text-slate-200">
                    {env.name} {hasEnvironmentOverride(request, env.id) ? '⚡ (Customized)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Environment Override Status & Actions */}
          {activeEnv ? (
            isEnvOverridden ? (
              <div className="flex items-center gap-1 bg-amber-950/40 border border-amber-800/60 rounded-lg px-2 py-0.5 text-[11px] text-amber-300 font-medium">
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <span>⚡</span>
                  <span className="truncate max-w-[120px]">{activeEnv.name} Override</span>
                </span>
                <span className="text-[10px] text-amber-400/80 font-mono">({overriddenFields.count} fields)</span>
                <div className="h-3 w-px bg-amber-800/80 mx-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = createEnvironmentOverride(request, activeEnv.id);
                    onUpdate(updated);
                  }}
                  className="hover:text-white underline text-[10px]"
                  title="Copy current base default request values into this environment"
                >
                  Copy Default
                </button>
                <span className="text-amber-700">·</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = removeEnvironmentOverride(request, activeEnv.id);
                    onUpdate(updated);
                  }}
                  className="hover:text-rose-300 text-rose-400 underline text-[10px]"
                  title="Remove this environment's overrides and revert to inheriting default"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-slate-400">
                <Globe className="w-3 h-3 text-slate-500" />
                <span>Using Default Config</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = createEnvironmentOverride(request, activeEnv.id);
                    onUpdate(updated);
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/70 font-semibold text-[10px] flex items-center gap-0.5 cursor-pointer"
                  title={`Create specific Body, Params and Headers for ${activeEnv.name}`}
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Customize for {activeEnv.name}</span>
                </button>
              </div>
            )
          ) : null}

          {/* Manage All Environment Overrides Button */}
          <button
            type="button"
            onClick={() => setIsOverridesModalOpen(true)}
            className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-medium flex items-center gap-1 transition"
            title="View and manage environment-scoped body and params across all environments"
          >
            <Sliders className="w-3 h-3 text-sky-400" />
            <span>Env Profiles</span>
            {totalOverridesCount > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-950 border border-amber-800 text-amber-300 font-bold font-mono">
                {totalOverridesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Request Control Bar: Method + URL + Send + Action Buttons */}
      <div className="p-3 border-b border-slate-800/80 flex flex-col sm:flex-row items-center gap-2 bg-slate-900/40">
        <div className="flex items-center gap-0 w-full sm:flex-1 border border-slate-800 rounded-lg overflow-hidden bg-slate-950 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/30 transition">
          {/* Method Selector */}
          <div className="relative border-r border-slate-800">
            <select
              value={effectiveRequest.method}
              onChange={(e) => onUpdate({ ...request, method: e.target.value as HttpMethod, updatedAt: Date.now() })}
              className={`appearance-none bg-slate-900/90 font-mono text-xs font-bold pl-3 pr-7 py-2.5 cursor-pointer focus:outline-none ${
                METHOD_COLORS[effectiveRequest.method]?.text || 'text-emerald-400'
              }`}
            >
              {methods.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-slate-100 font-mono">
                  {m}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">
              ▼
            </div>
          </div>

          {/* URL Input with cURL onPaste support */}
          <input
            type="text"
            value={effectiveRequest.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onPaste={handlePasteUrl}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                onSend();
              }
            }}
            placeholder="Enter request URL (e.g. {{baseUrl}}/users or paste cURL command)"
            className="flex-1 bg-transparent px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Send / Abort Button */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {isLoading ? (
            <button
              type="button"
              onClick={onAbort}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition tracking-wide cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Send
            </button>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            className="p-2 sm:px-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition"
            title="Save Request changes"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Save to Collection */}
          {onSaveToCollection && (
            <button
              type="button"
              onClick={onSaveToCollection}
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition"
              title="Add or Move to Collection / Folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Save As</span>
            </button>
          )}

          {/* Copy cURL Button */}
          <button
            type="button"
            onClick={handleCopyCurl}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition"
            title="Copy as cURL command"
          >
            {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Code Snippet Button */}
          <button
            type="button"
            onClick={onOpenCodeSnippet}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition"
            title="Generate Client Code Snippets (JavaScript, Python, Go, etc.)"
          >
            <Code className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation: Params, Auth, Headers, Body, Tests, Settings */}
      <div className="flex items-center gap-1 px-3 border-b border-slate-800/80 bg-slate-900/30 overflow-x-auto select-none shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('params')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'params'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Params</span>
          {activeParamsCount > 0 && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
              {activeParamsCount}
            </span>
          )}
          {overriddenFields.params && (
            <span className="text-[10px] text-amber-400 font-bold" title={`Overridden for ${activeEnv?.name}`}>
              ⚡
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('auth')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'auth'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Authorization</span>
          {effectiveRequest.auth?.type !== 'none' && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          )}
          {overriddenFields.auth && (
            <span className="text-[10px] text-amber-400 font-bold" title={`Overridden for ${activeEnv?.name}`}>
              ⚡
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('headers')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'headers'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Headers</span>
          {activeHeadersCount > 0 && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
              {activeHeadersCount}
            </span>
          )}
          {overriddenFields.headers && (
            <span className="text-[10px] text-amber-400 font-bold" title={`Overridden for ${activeEnv?.name}`}>
              ⚡
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('body')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'body'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Body</span>
          {effectiveRequest.body?.type !== 'none' && (
            <span className="text-[10px] bg-sky-950 text-sky-300 px-1.5 py-0.2 rounded-full font-mono border border-sky-800/40">
              {effectiveRequest.body.type}
            </span>
          )}
          {overriddenFields.body && (
            <span className="text-[10px] text-amber-400 font-bold" title={`Overridden for ${activeEnv?.name}`}>
              ⚡
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('scripts')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'scripts'
              ? 'border-amber-500 text-amber-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>JS Scripts</span>
          {(effectiveRequest.preRequestScript?.trim() || effectiveRequest.postResponseScript?.trim()) && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tests')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
            activeSubTab === 'tests'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Visual Tests</span>
          {activeTestsCount > 0 && (
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono border border-emerald-800/40">
              {activeTestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-3 py-2 text-xs font-medium border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ml-auto ${
            activeSubTab === 'settings'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3 h-3" />
          <span>Settings</span>
        </button>
      </div>

      {/* Sub Tab Active Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeSubTab === 'params' && (
          <div className="space-y-3">
            {overriddenFields.params && activeEnv && (
              <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>⚡</span>
                  <span>Custom Query Parameters for <strong>{activeEnv.name}</strong></span>
                </span>
                <span className="text-[11px] text-amber-400/80">Changes apply specifically to this environment</span>
              </div>
            )}
            <KeyValueEditor
              pairs={effectiveRequest.params || []}
              onChange={(params) => {
                const updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'params', params);
                onUpdate(updated);
              }}
              keyPlaceholder="Query Parameter (e.g. page or status)"
              valuePlaceholder="Value (e.g. 1 or active)"
            />
          </div>
        )}

        {activeSubTab === 'auth' && (
          <div className="space-y-3">
            {overriddenFields.auth && activeEnv && (
              <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>⚡</span>
                  <span>Custom Authorization for <strong>{activeEnv.name}</strong></span>
                </span>
                <span className="text-[11px] text-amber-400/80">Changes apply specifically to this environment</span>
              </div>
            )}
            <AuthTab
              auth={effectiveRequest.auth}
              onChange={(auth) => {
                const updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'auth', auth);
                onUpdate(updated);
              }}
              hasParentCollection={!!effectiveRequest.collectionId}
            />
          </div>
        )}

        {activeSubTab === 'headers' && (
          <div className="space-y-3">
            {overriddenFields.headers && activeEnv && (
              <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>⚡</span>
                  <span>Custom Request Headers for <strong>{activeEnv.name}</strong></span>
                </span>
                <span className="text-[11px] text-amber-400/80">Changes apply specifically to this environment</span>
              </div>
            )}
            <KeyValueEditor
              pairs={effectiveRequest.headers || []}
              onChange={(headers) => {
                const updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'headers', headers);
                onUpdate(updated);
              }}
              keyPlaceholder="Header (e.g. Content-Type)"
              valuePlaceholder="Value (e.g. application/json)"
              suggestions={COMMON_HEADER_SUGGESTIONS}
            />
          </div>
        )}

        {activeSubTab === 'body' && (
          <div className="space-y-3">
            {overriddenFields.body && activeEnv && (
              <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-lg flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>⚡</span>
                  <span>Custom Request Body for <strong>{activeEnv.name}</strong></span>
                </span>
                <span className="text-[11px] text-amber-400/80">Changes apply specifically to this environment</span>
              </div>
            )}
            <BodyTab
              body={effectiveRequest.body}
              onChange={(body) => {
                const updated = updateRequestField(request, activeEnvironmentId, isEnvOverridden, 'body', body);
                onUpdate(updated);
              }}
            />
          </div>
        )}

        {activeSubTab === 'scripts' && (
          <ScriptsTab
            preRequestScript={effectiveRequest.preRequestScript || ''}
            postResponseScript={effectiveRequest.postResponseScript || ''}
            onPreRequestScriptChange={(preRequestScript) => onUpdate({ ...request, preRequestScript, updatedAt: Date.now() })}
            onPostResponseScriptChange={(postResponseScript) => onUpdate({ ...request, postResponseScript, updatedAt: Date.now() })}
          />
        )}

        {activeSubTab === 'tests' && (
          <TestsTab
            tests={effectiveRequest.tests || []}
            extractions={effectiveRequest.extractions || []}
            onTestsChange={(tests) => onUpdate({ ...request, tests, updatedAt: Date.now() })}
            onExtractionsChange={(extractions) => onUpdate({ ...request, extractions, updatedAt: Date.now() })}
          />
        )}

        {activeSubTab === 'settings' && (
          <SettingsTab
            settings={effectiveRequest.settings}
            onChange={(settings) => onUpdate({ ...request, settings, updatedAt: Date.now() })}
          />
        )}
      </div>

      {/* Environment Overrides Manager Modal */}
      <EnvironmentOverridesModal
        isOpen={isOverridesModalOpen}
        onClose={() => setIsOverridesModalOpen(false)}
        request={request}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={(envId) => {
          if (onSelectEnvironment) onSelectEnvironment(envId);
        }}
        onRequestUpdate={onUpdate}
      />
    </div>
  );
};

