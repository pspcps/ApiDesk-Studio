import React, { useState } from 'react';
import { ApiRequest, Collection } from '../types';
import { parseCurlCommand, isCurlCommand } from '../utils/curlParser';
import { parseTeamImport } from '../utils/postmanConverter';
import { Terminal, Upload, FileJson, Sparkles, Check, AlertCircle, X } from 'lucide-react';

interface CurlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCurl: (parsedRequest: Partial<ApiRequest>) => void;
  onImportCollections: (imported: { collections: Collection[]; environments: any[]; globalVariables: any[] }) => void;
}

export const CurlImportModal: React.FC<CurlImportModalProps> = ({
  isOpen,
  onClose,
  onImportCurl,
  onImportCollections
}) => {
  const [activeTab, setActiveTab] = useState<'curl' | 'file' | 'json'>('curl');
  const [curlText, setCurlText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProcessCurl = () => {
    setErrorMsg(null);
    if (!curlText.trim()) {
      setErrorMsg('Please paste a cURL command first.');
      return;
    }

    try {
      const parsed = parseCurlCommand(curlText);
      if (!parsed) {
        setErrorMsg('Could not parse cURL command. Ensure the command starts with "curl" and has valid arguments.');
        return;
      }
      onImportCurl(parsed);
      onClose();
    } catch (err: any) {
      setErrorMsg(`cURL parse error: ${err.message}`);
    }
  };

  const handleProcessJson = (raw: string) => {
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(raw);
      const result = parseTeamImport(parsed);
      onImportCollections(result);
      setSuccessMsg(`Successfully imported ${result.collections.length} collection(s)!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(`JSON parse error: ${err.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessJson(content);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
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
              <Terminal className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Import cURL or Postman / OpenAPI Collection</h2>
              <span className="text-[11px] text-slate-400">Auto-detects format, endpoints, headers, and request body</span>
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

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('curl')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'curl' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Paste cURL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'file' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2.5 flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'json' ? 'border-sky-500 text-sky-400 bg-slate-900' : 'border-transparent hover:text-slate-200'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Raw Collection JSON</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'curl' && (
            <div className="flex flex-col gap-3">
              <span className="text-xs text-slate-300">
                Paste your complete <code className="text-sky-400 font-mono">curl</code> command below. It will immediately populate the request builder.
              </span>
              <textarea
                value={curlText}
                onChange={(e) => setCurlText(e.target.value)}
                placeholder={"curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer token123' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\": \"Alice\", \"email\": \"alice@example.com\"}'"}
                rows={8}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed"
                spellCheck={false}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessCurl}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Import cURL
                </button>
              </div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl bg-slate-950/40 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-200">
                  Select a Postman Collection or OpenAPI Specification file
                </span>
                <span className="text-xs text-slate-500">
                  Supported formats: Postman v2.1 JSON, OpenAPI 3.0 / Swagger JSON, or Team Workspace JSON
                </span>
              </div>
              <label className="mt-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow">
                Browse Files
                <input
                  type="file"
                  accept=".json,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="flex flex-col gap-3">
              <span className="text-xs text-slate-300">
                Paste raw Postman Collection v2.1 JSON or OpenAPI Spec JSON:
              </span>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{\n  "info": { "name": "My API Collection", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },\n  "item": [ ... ]\n}'
                rows={8}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed"
                spellCheck={false}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessJson(jsonText)}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Import Collection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
