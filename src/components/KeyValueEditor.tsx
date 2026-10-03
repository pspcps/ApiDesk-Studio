import React, { useState } from 'react';
import { KeyValuePair } from '../types';
import { Plus, Trash2, Eye, EyeOff, FileText, Check, AlertCircle, FileUp } from 'lucide-react';

interface KeyValueEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  allowFiles?: boolean;
  suggestions?: string[];
  title?: string;
}

export const COMMON_HEADER_SUGGESTIONS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Origin',
  'User-Agent',
  'X-API-Key',
  'X-Request-ID',
  'X-Requested-With',
  'If-None-Match',
  'Cookie'
];

export const COMMON_HEADER_VALUES: Record<string, string[]> = {
  'Content-Type': ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'application/xml', 'text/html'],
  'Accept': ['application/json', '*/*', 'text/html', 'application/xml', 'text/plain'],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'must-revalidate']
};

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  allowFiles = false,
  suggestions = []
}) => {
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleAddRow = () => {
    const newPair: KeyValuePair = {
      id: 'kv_' + Math.random().toString(36).substring(2, 9),
      key: '',
      value: '',
      enabled: true,
      type: 'text'
    };
    onChange([...pairs, newPair]);
  };

  const handleUpdate = (index: number, field: keyof KeyValuePair, value: any) => {
    const updated = [...pairs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = pairs.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleOpenBulk = () => {
    const text = pairs
      .filter(p => p.key)
      .map(p => `${p.key}: ${p.value}`)
      .join('\n');
    setBulkText(text);
    setShowBulkEdit(true);
  };

  const handleApplyBulk = () => {
    const lines = bulkText.split('\n');
    const newPairs: KeyValuePair[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        newPairs.push({
          id: 'kv_' + Math.random().toString(36).substring(2, 9),
          key: line.substring(0, colonIdx).trim(),
          value: line.substring(colonIdx + 1).trim(),
          enabled: true,
          type: 'text'
        });
      } else {
        newPairs.push({
          id: 'kv_' + Math.random().toString(36).substring(2, 9),
          key: line.trim(),
          value: '',
          enabled: true,
          type: 'text'
        });
      }
    }
    onChange(newPairs.length > 0 ? newPairs : [{ id: 'kv_1', key: '', value: '', enabled: true }]);
    setShowBulkEdit(false);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpdate(index, 'value', `[File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`);
      handleUpdate(index, 'type', 'file');
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full text-xs">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-slate-400 font-medium tracking-wide uppercase text-[11px]">
          {pairs.filter(p => p.enabled && p.key).length} Active Parameters
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBulk}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5"
            title="Bulk edit as raw key-value lines"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Bulk Edit
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>
      </div>

      {showBulkEdit ? (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col gap-2">
          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span>Enter key-value pairs formatted as <code className="text-sky-400 bg-slate-950 px-1 py-0.5 rounded">Key: Value</code> per line:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkEdit(false)}
                className="px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulk}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium"
              >
                Apply
              </button>
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder="Content-Type: application/json&#10;Authorization: Bearer {{token}}&#10;X-Client-ID: my-app"
            className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
      ) : (
        <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/50">
          <div className="grid grid-cols-[36px_1fr_1fr_36px] md:grid-cols-[36px_1.2fr_1.5fr_1fr_36px] bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5">
            <div className="text-center">#</div>
            <div>Key</div>
            <div>Value</div>
            <div className="hidden md:block">Description</div>
            <div className="text-center">Action</div>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto">
            {pairs.map((pair, idx) => {
              const isSecret = pair.type === 'secret';
              const isRevealed = showSecrets[pair.id];

              return (
                <div
                  key={pair.id || idx}
                  className={`grid grid-cols-[36px_1fr_1fr_36px] md:grid-cols-[36px_1.2fr_1.5fr_1fr_36px] items-center px-2 py-1 hover:bg-slate-800/30 transition group ${
                    !pair.enabled ? 'opacity-50' : ''
                  }`}
                >
                  {/* Enable/Disable checkbox */}
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={pair.enabled}
                      onChange={(e) => handleUpdate(idx, 'enabled', e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>

                  {/* Key */}
                  <div className="pr-1 relative">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(e) => handleUpdate(idx, 'key', e.target.value)}
                      placeholder={keyPlaceholder}
                      list={`suggestions_${idx}`}
                      className="w-full bg-transparent px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded font-mono"
                    />
                    {suggestions.length > 0 && (
                      <datalist id={`suggestions_${idx}`}>
                        {suggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    )}
                  </div>

                  {/* Value */}
                  <div className="pr-1 relative flex items-center">
                    <input
                      type={isSecret && !isRevealed ? 'password' : 'text'}
                      value={pair.value}
                      onChange={(e) => handleUpdate(idx, 'value', e.target.value)}
                      placeholder={valuePlaceholder}
                      list={`val_suggestions_${idx}`}
                      className="w-full bg-transparent px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded font-mono"
                    />

                    {COMMON_HEADER_VALUES[pair.key] && (
                      <datalist id={`val_suggestions_${idx}`}>
                        {COMMON_HEADER_VALUES[pair.key].map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    )}

                    {/* Secret toggle */}
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets(prev => ({ ...prev, [pair.id]: !prev[pair.id] }))}
                        className="absolute right-2 text-slate-500 hover:text-slate-300"
                        title={isRevealed ? 'Hide secret' : 'Show secret'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* File upload trigger */}
                    {allowFiles && pair.type === 'file' && (
                      <label className="ml-1 cursor-pointer p-1 text-slate-400 hover:text-sky-400">
                        <FileUp className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(idx, e)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Description (desktop) */}
                  <div className="hidden md:block pr-1">
                    <input
                      type="text"
                      value={pair.description || ''}
                      onChange={(e) => handleUpdate(idx, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full bg-transparent px-2 py-1 text-xs text-slate-400 placeholder-slate-700 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
                    />
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-slate-600 hover:text-rose-400 transition p-1 rounded opacity-60 group-hover:opacity-100"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {pairs.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs">
                No parameters configured. Click <span className="text-sky-400 cursor-pointer" onClick={handleAddRow}>Add Row</span> to create one.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
