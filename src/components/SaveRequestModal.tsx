import React, { useState, useEffect } from 'react';
import { ApiRequest, Collection } from '../types';
import { FolderPlus, Layers, X, Plus, Sparkles } from 'lucide-react';

function deriveSmartRequestName(req: ApiRequest): string {
  if (req.name && req.name !== 'New Request' && req.name !== 'Untitled Request') {
    return req.name;
  }
  const rawUrl = (req.url || '').trim();
  if (!rawUrl) return 'New Request';

  try {
    const cleanUrl = rawUrl.replace(/\{\{[^}]+\}\}/g, 'api.service.local');
    const urlToParse = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    const parsed = new URL(urlToParse);

    // Detect environment suffix from hostname (-dev, -stg, -stage, -prod)
    let envSuffix = '';
    const hostMatch = parsed.hostname.match(/-(dev|stg|stage|prod|qa|uat)\b/i);
    if (hostMatch) {
      envSuffix = `-${hostMatch[1].toLowerCase()}`;
    }

    // Take last two meaningful path segments (skipping path params like {id} or numeric IDs)
    const segments = parsed.pathname
      .split('/')
      .map(s => s.trim())
      .filter(s => s && !/^\{.*\}$/.test(s) && !/^:\w+$/.test(s));

    if (segments.length >= 2) {
      return `${segments.slice(-2).join('/')}${envSuffix}`;
    } else if (segments.length === 1) {
      return `${segments[0]}${envSuffix}`;
    }
  } catch {}
  return req.name || 'New Request';
}

interface SaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
  collections: Collection[];
  onSave: (name: string, collectionId: string, folderId?: string) => void;
  onAddNewCollection: (name: string) => string; // returns new col id
}

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  collections,
  onSave,
  onAddNewCollection
}) => {
  const [requestName, setRequestName] = useState(() => deriveSmartRequestName(request));
  const [selectedColId, setSelectedColId] = useState(request.collectionId || collections[0]?.id || '');
  const [selectedFolderId, setSelectedFolderId] = useState(request.folderId || '');
  const [isCreatingCol, setIsCreatingCol] = useState(false);
  const [newColName, setNewColName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRequestName(deriveSmartRequestName(request));
      setSelectedColId(request.collectionId || collections[0]?.id || '');
      setSelectedFolderId(request.folderId || '');
    }
  }, [isOpen, request, collections]);

  if (!isOpen) return null;

  const currentSelectedCol = collections.find(c => c.id === selectedColId);

  const handleCreateCol = () => {
    if (newColName.trim()) {
      const newId = onAddNewCollection(newColName.trim());
      setSelectedColId(newId);
      setSelectedFolderId('');
      setIsCreatingCol(false);
      setNewColName('');
    }
  };

  const handleSave = () => {
    if (!requestName.trim() || !selectedColId) return;
    onSave(requestName.trim(), selectedColId, selectedFolderId || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-100">Save Request</h2>
              <span className="text-[11px] text-slate-400">Organize request in collections & folders</span>
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

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Request Name</label>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="e.g. Get User Profile"
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
            />
          </div>

          {/* Collection Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Target Collection</label>
              <button
                type="button"
                onClick={() => setIsCreatingCol(!isCreatingCol)}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                New Collection
              </button>
            </div>

            {isCreatingCol ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="New collection name"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCol}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium"
                >
                  Create
                </button>
              </div>
            ) : (
              <select
                value={selectedColId}
                onChange={(e) => {
                  setSelectedColId(e.target.value);
                  setSelectedFolderId('');
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Folder Selector (if collection has folders) */}
          {currentSelectedCol && currentSelectedCol.folders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Folder (Optional)</label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">(Root Collection Level)</option>
                {currentSelectedCol.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
            >
              Save to Collection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
