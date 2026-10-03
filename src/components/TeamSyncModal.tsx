import React, { useState } from 'react';
import { Collection, Environment, KeyValuePair } from '../types';
import { exportPostmanCollection, exportTeamWorkspace, parseTeamImport } from '../utils/postmanConverter';
import { 
  Share2, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  Layers, 
  HardDrive, 
  ShieldCheck, 
  FileJson, 
  Sparkles, 
  X,
  AlertCircle
} from 'lucide-react';

interface TeamSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  environments: Environment[];
  globalVariables: KeyValuePair[];
  onImportTeamData: (data: { collections: Collection[]; environments: Environment[]; globalVariables: KeyValuePair[] }, mode: 'merge' | 'replace') => void;
}

export const TeamSyncModal: React.FC<TeamSyncModalProps> = ({
  isOpen,
  onClose,
  collections,
  environments,
  globalVariables,
  onImportTeamData
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'shareLink'>('export');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(collections[0]?.id || 'all');
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Export handlers
  const handleExportWorkspace = () => {
    const bundle = exportTeamWorkspace(collections, environments, globalVariables);
    downloadJsonFile(bundle, `team_workspace_export_${Date.now()}.json`);
    setStatusMsg({ type: 'success', text: 'Full workspace exported successfully!' });
  };

  const handleExportCollection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    const postmanJson = exportPostmanCollection(col);
    const sanitizedName = col.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    downloadJsonFile(postmanJson, `${sanitizedName}.postman_collection.json`);
    setStatusMsg({ type: 'success', text: `Collection "${col.name}" exported in Postman v2.1 format!` });
  };

  const generateSharePayload = (): string => {
    if (selectedCollectionId === 'all') {
      const bundle = exportTeamWorkspace(collections, environments, globalVariables);
      return JSON.stringify(bundle);
    } else {
      const col = collections.find(c => c.id === selectedCollectionId);
      if (!col) return '';
      return JSON.stringify(exportPostmanCollection(col));
    }
  };

  const handleCopyShareData = () => {
    const payload = generateSharePayload();
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProcessImport = () => {
    setStatusMsg(null);
    if (!importJsonText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste JSON data to import.' });
      return;
    }
    try {
      const parsed = JSON.parse(importJsonText);
      const result = parseTeamImport(parsed);
      onImportTeamData(result, importMode);
      setStatusMsg({ type: 'success', text: `Successfully imported ${result.collections.length} collection(s)!` });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Invalid JSON format' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const result = parseTeamImport(parsed);
        onImportTeamData(result, importMode);
        setStatusMsg({ type: 'success', text: `Successfully imported ${result.collections.length} collection(s) from "${file.name}"!` });
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: `Failed to import file: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Team Collaboration & Local Sync</h2>
              <span className="text-[11px] text-slate-400">
                Share collections and environments seamlessly without any external database
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

        {/* Local-only Guarantee Callout */}
        <div className="bg-emerald-950/20 border-b border-emerald-800/30 px-5 py-2 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>100% Local Machine Storage:</strong> Zero cloud databases used. All collections remain strictly on your machine and can be shared via JSON.
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'export' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Download</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shareLink')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'shareLink' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Team Bundle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'import' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import from Team</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex flex-col gap-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === 'export' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Full Workspace Export */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-slate-100">Full Workspace Bundle</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Exports all {collections.length} collections, folders, environments ({environments.length}), and globals in a single portable JSON file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportWorkspace}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Workspace (.json)
                  </button>
                </div>

                {/* 2. Single Collection Export (Postman v2.1 format) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-slate-100">Postman v2.1 Collection</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Select a specific collection to export in Postman v2.1 compatible format.
                    </p>
                    <select
                      value={selectedCollectionId}
                      onChange={(e) => setSelectedCollectionId(e.target.value)}
                      className="mt-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none"
                    >
                      {collections.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.requests.length} reqs)</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportCollection(selectedCollectionId)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Download Collection (.json)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SHARE LINK / RAW COPY TAB */}
          {activeTab === 'shareLink' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  Select target to copy as raw JSON bundle for instant sharing:
                </span>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none"
                >
                  <option value="all">Entire Workspace (All Collections + Envs)</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <textarea
                readOnly
                value={generateSharePayload()}
                rows={7}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 focus:outline-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyShareData}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Raw Bundle JSON'}
                </button>
              </div>
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="flex flex-col gap-4">
              {/* File Upload Zone */}
              <div className="flex items-center justify-between p-4 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5 text-sky-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Upload JSON File</span>
                    <span className="text-[11px] text-slate-500">Supports Postman Collection, OpenAPI Spec, or Workspace Bundle</span>
                  </div>
                </div>
                <label className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer border border-slate-700 transition">
                  Browse File
                  <input
                    type="file"
                    accept=".json,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Paste JSON */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Or Paste JSON Data:</span>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Import Mode:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-sky-500 focus:ring-0"
                      />
                      Merge (Keep Existing)
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-sky-500 focus:ring-0"
                      />
                      Replace
                    </label>
                  </div>
                </div>

                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Paste collection or workspace JSON here..."
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none"
                  spellCheck={false}
                />

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessImport}
                    className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Import Collections
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function downloadJsonFile(data: any, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
