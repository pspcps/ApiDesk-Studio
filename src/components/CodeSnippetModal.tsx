import React, { useState } from 'react';
import { ApiRequest } from '../types';
import { generateCodeSnippet } from '../utils/curlParser';
import { resolveTemplateString, VariableContext } from '../utils/variableResolver';
import { getEffectiveRequest } from '../utils/environmentOverrideHelper';
import { Code2, Copy, Check, X, Terminal } from 'lucide-react';

interface CodeSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
  variableContext: VariableContext;
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({
  isOpen,
  onClose,
  request: rawRequest,
  variableContext
}) => {
  const [selectedLang, setSelectedLang] = useState<string>('curl');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const effectiveRequest = getEffectiveRequest(rawRequest, variableContext.activeEnvironment?.id || null);

  // Resolve headers and full URL for code snippet
  const resolvedUrl = resolveTemplateString(effectiveRequest.url, variableContext);
  const resolvedHeaders: Record<string, string> = {};
  for (const h of (effectiveRequest.headers || []).filter(x => x.enabled && x.key)) {
    resolvedHeaders[resolveTemplateString(h.key, variableContext)] = resolveTemplateString(h.value, variableContext);
  }

  const snippet = generateCodeSnippet(selectedLang, effectiveRequest, resolvedUrl, resolvedHeaders);

  const languages = [
    { id: 'curl', label: 'cURL' },
    { id: 'javascript-fetch', label: 'JavaScript (Fetch)' },
    { id: 'javascript-axios', label: 'JavaScript (Axios)' },
    { id: 'python-requests', label: 'Python (Requests)' },
    { id: 'go', label: 'Go (net/http)' }
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Generate Code Snippet</h2>
              <span className="text-[11px] text-slate-400">Ready-to-use client code for {effectiveRequest.name}</span>
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

        {/* Language Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
          {languages.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedLang(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                selectedLang === l.id
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Code View Area */}
        <div className="p-4 flex flex-col gap-3 bg-slate-900">
          <div className="relative">
            <textarea
              readOnly
              value={snippet}
              rows={14}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed resize-none"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-3 top-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied!' : 'Copy Snippet'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
