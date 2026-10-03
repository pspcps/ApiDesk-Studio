import React, { useState } from 'react';
import { Environment, KeyValuePair } from '../types';
import { KeyValueEditor } from './KeyValueEditor';
import { 
  Variable, 
  Plus, 
  Trash2, 
  Globe, 
  Layers, 
  Check, 
  HelpCircle, 
  X,
  Sparkles,
  Edit2
} from 'lucide-react';

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  globalVariables: KeyValuePair[];
  activeEnvironmentId: string | null;
  onUpdateEnvironments: (environments: Environment[]) => void;
  onUpdateGlobals: (globals: KeyValuePair[]) => void;
  onSelectActiveEnv: (envId: string | null) => void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  globalVariables,
  activeEnvironmentId,
  onUpdateEnvironments,
  onUpdateGlobals,
  onSelectActiveEnv
}) => {
  const [selectedTab, setSelectedTab] = useState<string>(environments[0]?.id || 'globals');
  const [editingEnvName, setEditingEnvName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  if (!isOpen) return null;

  const handleAddEnvironment = () => {
    const newEnv: Environment = {
      id: 'env_' + Math.random().toString(36).substring(2, 9),
      name: `New Environment ${environments.length + 1}`,
      variables: [
        { id: 'v_1', key: 'baseUrl', value: 'https://api.example.com', enabled: true }
      ]
    };
    onUpdateEnvironments([...environments, newEnv]);
    setSelectedTab(newEnv.id);
  };

  const handleDeleteEnvironment = (id: string) => {
    const remaining = environments.filter(e => e.id !== id);
    onUpdateEnvironments(remaining);
    if (activeEnvironmentId === id) {
      onSelectActiveEnv(null);
    }
    setSelectedTab(remaining[0]?.id || 'globals');
  };

  const handleUpdateCurrentEnvVars = (variables: KeyValuePair[]) => {
    const updated = environments.map(e => {
      if (e.id === selectedTab) {
        return { ...e, variables };
      }
      return e;
    });
    onUpdateEnvironments(updated);
  };

  const handleStartRename = (env: Environment) => {
    setEditingEnvName(env.id);
    setTempName(env.name);
  };

  const handleSaveRename = (id: string) => {
    if (tempName.trim()) {
      const updated = environments.map(e => e.id === id ? { ...e, name: tempName.trim() } : e);
      onUpdateEnvironments(updated);
    }
    setEditingEnvName(null);
  };

  const currentEnv = environments.find(e => e.id === selectedTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-4xl h-[600px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Variable className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Environment & Variable Manager</h2>
              <span className="text-[11px] text-slate-400">Configure scoped variables for Dev, Staging, and Production</span>
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

        {/* Modal Layout: Sidebar on Left + Variable Table on Right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Environments Sidebar */}
          <div className="w-56 border-r border-slate-800 bg-slate-950 p-2 flex flex-col gap-1 overflow-y-auto shrink-0 select-none">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Scopes</span>
              <button
                type="button"
                onClick={handleAddEnvironment}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded transition"
                title="Add Environment"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Global Variables Tab */}
            <button
              type="button"
              onClick={() => setSelectedTab('globals')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                selectedTab === 'globals'
                  ? 'bg-sky-600/20 text-sky-400 font-semibold border border-sky-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Global Variables</span>
              </div>
              <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                {globalVariables.filter(v => v.enabled && v.key).length}
              </span>
            </button>

            <div className="h-px bg-slate-800 my-1"></div>

            {/* Environment List */}
            {environments.map((env) => {
              const isSelected = selectedTab === env.id;
              const isActive = activeEnvironmentId === env.id;
              const isEditing = editingEnvName === env.id;

              return (
                <div
                  key={env.id}
                  onClick={() => setSelectedTab(env.id)}
                  className={`group relative w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-600/20 text-sky-400 font-semibold border border-sky-500/30'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => handleSaveRename(env.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(env.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-xs text-white focus:outline-none w-full"
                      />
                    ) : (
                      <span className="truncate">{env.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isActive && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartRename(env)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-200 transition"
                      title="Rename environment"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEnvironment(env.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Delete environment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Variables Table Content */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-slate-900">
            {selectedTab === 'globals' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="text-xs font-bold text-slate-100">Global Variables</h3>
                    <span className="text-[11px] text-slate-400">
                      Accessible in every request across all collections.
                    </span>
                  </div>
                </div>
                <KeyValueEditor
                  pairs={globalVariables}
                  onChange={onUpdateGlobals}
                  keyPlaceholder="Variable Name (e.g. appSecret)"
                  valuePlaceholder="Variable Value"
                />
              </div>
            ) : currentEnv ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-100">{currentEnv.name}</h3>
                      {activeEnvironmentId === currentEnv.id ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          Currently Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectActiveEnv(currentEnv.id)}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white font-medium transition"
                        >
                          Set as Active
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Variables specific to the {currentEnv.name} environment.
                    </span>
                  </div>
                </div>

                <KeyValueEditor
                  pairs={currentEnv.variables}
                  onChange={handleUpdateCurrentEnvVars}
                  keyPlaceholder="Variable Name (e.g. baseUrl or apiKey)"
                  valuePlaceholder="Variable Value"
                />
              </div>
            ) : null}

            {/* Dynamic Variables Cheatsheet */}
            <div className="mt-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col gap-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Dynamic Built-in Variables (No definition required)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-300">
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-sky-400">{'{{$timestamp}}'}</span>
                  <p className="text-[10px] text-slate-500 font-sans">Unix seconds</p>
                </div>
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-sky-400">{'{{$guid}}'}</span>
                  <p className="text-[10px] text-slate-500 font-sans">v4 UUID</p>
                </div>
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-sky-400">{'{{$randomInt}}'}</span>
                  <p className="text-[10px] text-slate-500 font-sans">0 - 1000</p>
                </div>
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-sky-400">{'{{$isodate}}'}</span>
                  <p className="text-[10px] text-slate-500 font-sans">ISO 8601 string</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
