import React, { useState, useRef } from 'react';
import { ApiRequest, Collection, Environment, HistoryItem } from '../types';
import { MethodBadge } from './MethodBadge';
import { 
  Folder as FolderIcon, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search, 
  Layers, 
  Settings2, 
  History, 
  Trash2, 
  Play, 
  Download, 
  Copy, 
  Edit2, 
  Check, 
  Variable,
  FolderPlus,
  GripVertical
} from 'lucide-react';

interface SidebarProps {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: HistoryItem[];
  activeRequestId?: string;
  onSelectRequest: (req: ApiRequest) => void;
  onNewRequest: (collectionId?: string, folderId?: string) => void;
  onNewCollection: () => void;
  onUpdateCollection: (collection: Collection) => void;
  onDeleteCollection: (collectionId: string) => void;
  onExportCollection: (collection: Collection) => void;
  onRunCollection: (collectionId: string, folderId?: string) => void;
  onUpdateRequest?: (req: ApiRequest) => void;
  onDeleteRequest?: (collectionId: string, requestId: string) => void;
  onDuplicateRequest?: (collectionId: string, req: ApiRequest) => void;
  onMoveRequest?: (requestId: string, sourceColId: string, targetColId: string, targetFolderId?: string) => void;
  onAddFolder?: (collectionId: string, folderName?: string) => void;
  onUpdateFolder?: (collectionId: string, folderId: string, newName: string) => void;
  onDeleteFolder?: (collectionId: string, folderId: string) => void;
  onSelectEnvironment: (envId: string | null) => void;
  onOpenEnvironmentModal: () => void;
  onRestoreHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  environments,
  activeEnvironmentId,
  history,
  activeRequestId,
  onSelectRequest,
  onNewRequest,
  onNewCollection,
  onUpdateCollection,
  onDeleteCollection,
  onExportCollection,
  onRunCollection,
  onUpdateRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onMoveRequest,
  onAddFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  onRestoreHistory,
  onClearHistory
}) => {
  const [sidebarTab, setSidebarTab] = useState<'collections' | 'environments' | 'history'>('collections');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    col_echo: true,
    col_users: true
  });

  // Persisted sidebar width with drag handle resize
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apidesk_sidebar_width');
      return saved ? Math.min(520, Math.max(220, Number(saved))) : 288;
    } catch {
      return 288;
    }
  });
  const isResizingRef = useRef(false);

  // Drag-and-drop state for moving requests between collections/folders
  const [draggedItem, setDraggedItem] = useState<{ requestId: string; sourceColId: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Inline editing state for collections, folders, and requests
  const [editingItem, setEditingItem] = useState<{
    type: 'collection' | 'folder' | 'request';
    id: string;
    collectionId?: string;
    name: string;
  } | null>(null);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(520, Math.max(220, startW + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
      try {
        localStorage.setItem('apidesk_sidebar_width', String(newWidth));
      } catch {}
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartRename = (type: 'collection' | 'folder' | 'request', id: string, name: string, collectionId?: string) => {
    setEditingItem({ type, id, name, collectionId });
  };

  const handleSaveRename = () => {
    if (!editingItem || !editingItem.name.trim()) {
      setEditingItem(null);
      return;
    }
    const cleanName = editingItem.name.trim();

    if (editingItem.type === 'collection') {
      const col = collections.find(c => c.id === editingItem.id);
      if (col && col.name !== cleanName) {
        onUpdateCollection({ ...col, name: cleanName, updatedAt: Date.now() });
      }
    } else if (editingItem.type === 'folder' && editingItem.collectionId) {
      if (onUpdateFolder) {
        onUpdateFolder(editingItem.collectionId, editingItem.id, cleanName);
      } else {
        const col = collections.find(c => c.id === editingItem.collectionId);
        if (col) {
          const updatedFolders = col.folders.map(f => f.id === editingItem.id ? { ...f, name: cleanName } : f);
          onUpdateCollection({ ...col, folders: updatedFolders, updatedAt: Date.now() });
        }
      }
    } else if (editingItem.type === 'request') {
      for (const col of collections) {
        const req = col.requests.find(r => r.id === editingItem.id);
        if (req) {
          const updatedReq = { ...req, name: cleanName, updatedAt: Date.now() };
          if (onUpdateRequest) {
            onUpdateRequest(updatedReq);
          } else {
            const updatedReqs = col.requests.map(r => r.id === editingItem.id ? updatedReq : r);
            onUpdateCollection({ ...col, requests: updatedReqs, updatedAt: Date.now() });
          }
          break;
        }
      }
    }
    setEditingItem(null);
  };

  const handleDropOnTarget = (targetColId: string, targetFolderId?: string) => {
    if (!draggedItem) return;
    const { requestId, sourceColId } = draggedItem;
    setDraggedItem(null);
    setDragOverTarget(null);

    if (onMoveRequest) {
      onMoveRequest(requestId, sourceColId, targetColId, targetFolderId);
      return;
    }

    // Fallback move handler using onUpdateCollection
    const sourceCol = collections.find(c => c.id === sourceColId);
    const targetCol = collections.find(c => c.id === targetColId);
    if (!sourceCol || !targetCol) return;
    const req = sourceCol.requests.find(r => r.id === requestId);
    if (!req) return;

    const movedReq: ApiRequest = {
      ...req,
      collectionId: targetColId,
      folderId: targetFolderId,
      updatedAt: Date.now()
    };

    if (sourceColId === targetColId) {
      onUpdateCollection({
        ...sourceCol,
        requests: sourceCol.requests.map(r => r.id === requestId ? movedReq : r),
        updatedAt: Date.now()
      });
    } else {
      onUpdateCollection({
        ...sourceCol,
        requests: sourceCol.requests.filter(r => r.id !== requestId),
        updatedAt: Date.now()
      });
      onUpdateCollection({
        ...targetCol,
        requests: [...targetCol.requests, movedReq],
        updatedAt: Date.now()
      });
    }
  };

  // Filter collections
  const filteredCollections = collections.filter(col => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesCol = col.name.toLowerCase().includes(term);
    const hasMatchedReqs = col.requests.some(r => 
      r.name.toLowerCase().includes(term) || 
      r.url.toLowerCase().includes(term) || 
      r.method.toLowerCase().includes(term)
    );
    return matchesCol || hasMatchedReqs;
  });

  // Filter history
  const filteredHistory = history.filter(h => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      h.request.name.toLowerCase().includes(term) ||
      h.request.url.toLowerCase().includes(term) ||
      h.request.method.toLowerCase().includes(term)
    );
  });

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className="relative h-full flex flex-col bg-slate-900/90 border-r border-slate-800/80 shrink-0 select-none"
    >
      {/* Top Sidebar Tabs: Collections, Environments, History */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
        <button
          type="button"
          onClick={() => setSidebarTab('collections')}
          className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            sidebarTab === 'collections'
              ? 'border-sky-500 text-sky-400 bg-slate-900/50'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Collections</span>
        </button>

        <button
          type="button"
          onClick={() => setSidebarTab('environments')}
          className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            sidebarTab === 'environments'
              ? 'border-sky-500 text-sky-400 bg-slate-900/50'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <Variable className="w-3.5 h-3.5" />
          <span>Environments</span>
        </button>

        <button
          type="button"
          onClick={() => setSidebarTab('history')}
          className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
            sidebarTab === 'history'
              ? 'border-sky-500 text-sky-400 bg-slate-900/50'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="p-2 border-b border-slate-800 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              sidebarTab === 'collections'
                ? 'Search requests...'
                : sidebarTab === 'environments'
                ? 'Search variables...'
                : 'Search history...'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        {sidebarTab === 'collections' && (
          <button
            type="button"
            onClick={onNewCollection}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded border border-slate-700 transition"
            title="Create New Collection"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {sidebarTab === 'history' && history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded border border-slate-700 transition"
            title="Clear History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* COLLECTIONS VIEW */}
        {sidebarTab === 'collections' && (
          <div className="flex flex-col gap-1">
            {filteredCollections.map((col) => {
              const isColExpanded = expandedNodes[col.id] ?? true;
              const isColEditing = editingItem?.type === 'collection' && editingItem.id === col.id;
              const isColDropTarget = dragOverTarget === `col_${col.id}`;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTarget(`col_${col.id}`);
                  }}
                  onDragLeave={() => {
                    if (dragOverTarget === `col_${col.id}`) setDragOverTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnTarget(col.id, undefined);
                  }}
                  className={`flex flex-col rounded-md overflow-hidden text-xs transition ${
                    isColDropTarget ? 'ring-1 ring-sky-500 bg-sky-950/20' : ''
                  }`}
                >
                  {/* Collection Header */}
                  <div
                    onClick={() => {
                      if (!isColEditing) toggleExpand(col.id);
                    }}
                    className="group flex items-center justify-between px-2 py-1.5 hover:bg-slate-800/60 rounded cursor-pointer transition text-slate-300 font-semibold"
                  >
                    <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(col.id);
                        }}
                        className="p-0.5 hover:text-white"
                      >
                        {isColExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>
                      <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      
                      {isColEditing ? (
                        <div 
                          className="flex items-center gap-1 flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') setEditingItem(null);
                            }}
                            onBlur={handleSaveRename}
                            className="w-full bg-slate-950 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      ) : (
                        <span 
                          className="truncate hover:text-white"
                          title={`${col.name} (Double-click to rename)`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleStartRename('collection', col.id, col.name);
                          }}
                        >
                          {col.name}
                        </span>
                      )}
                    </div>

                    {/* Collection Quick Actions */}
                    {!isColEditing && (
                      <div
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartRename('collection', col.id, col.name)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-sky-300 rounded"
                          title="Rename Collection"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNewRequest(col.id)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-sky-300 rounded"
                          title="Add request to collection"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {onAddFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              const fName = `New Folder`;
                              onAddFolder(col.id, fName);
                              if (!expandedNodes[col.id]) {
                                setExpandedNodes(prev => ({ ...prev, [col.id]: true }));
                              }
                            }}
                            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded"
                            title="Add Folder"
                          >
                            <FolderPlus className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRunCollection(col.id)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-emerald-300 rounded"
                          title="Run collection (Runner)"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportCollection(col)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded"
                          title="Export Collection as Postman JSON"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCollection(col.id)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded"
                          title="Delete Collection"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Collection Folders & Requests */}
                  {isColExpanded && (
                    <div className="pl-3 flex flex-col gap-0.5 border-l border-slate-800 ml-3.5 my-0.5">
                      {/* Folders */}
                      {col.folders.map((folder) => {
                        const isFolderExpanded = expandedNodes[folder.id] ?? true;
                        const folderRequests = col.requests.filter((r) => r.folderId === folder.id);
                        const isFolderEditing = editingItem?.type === 'folder' && editingItem.id === folder.id;
                        const isFolderDropTarget = dragOverTarget === `folder_${folder.id}`;

                        return (
                          <div
                            key={folder.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverTarget(`folder_${folder.id}`);
                            }}
                            onDragLeave={(e) => {
                              e.stopPropagation();
                              if (dragOverTarget === `folder_${folder.id}`) setDragOverTarget(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDropOnTarget(col.id, folder.id);
                            }}
                            className={`flex flex-col rounded ${
                              isFolderDropTarget ? 'ring-1 ring-amber-400 bg-amber-950/20' : ''
                            }`}
                          >
                            {/* Folder Title */}
                            <div
                              onClick={() => {
                                if (!isFolderEditing) toggleExpand(folder.id);
                              }}
                              className="group flex items-center justify-between px-2 py-1 hover:bg-slate-800/40 rounded cursor-pointer text-slate-400"
                            >
                              <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(folder.id);
                                  }}
                                  className="p-0.5 hover:text-white"
                                >
                                  {isFolderExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-500" />
                                  )}
                                </button>
                                <FolderIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                
                                {isFolderEditing ? (
                                  <div 
                                    className="flex items-center gap-1 flex-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingItem.name}
                                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRename();
                                        if (e.key === 'Escape') setEditingItem(null);
                                      }}
                                      onBlur={handleSaveRename}
                                      className="w-full bg-slate-950 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <span 
                                    className="truncate font-medium hover:text-white"
                                    title={`${folder.name} (Double-click to rename)`}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRename('folder', folder.id, folder.name, col.id);
                                    }}
                                  >
                                    {folder.name}
                                  </span>
                                )}
                              </div>

                              {!isFolderEditing && (
                                <div
                                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename('folder', folder.id, folder.name, col.id)}
                                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-sky-300 rounded"
                                    title="Rename Folder"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onNewRequest(col.id, folder.id)}
                                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-sky-300 rounded"
                                    title="Add request to folder"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRunCollection(col.id, folder.id)}
                                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-emerald-300 rounded"
                                    title="Run folder requests"
                                  >
                                    <Play className="w-3 h-3" />
                                  </button>
                                  {onDeleteFolder && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteFolder(col.id, folder.id)}
                                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded"
                                      title="Delete folder"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Folder Requests */}
                            {isFolderExpanded && (
                              <div className="pl-3 flex flex-col gap-0.5 border-l border-slate-800 ml-3 my-0.5">
                                {folderRequests.map((req) => (
                                  <RequestTreeRow
                                    key={req.id}
                                    request={req}
                                    collectionId={col.id}
                                    isActive={req.id === activeRequestId}
                                    isEditing={editingItem?.type === 'request' && editingItem.id === req.id}
                                    editingName={editingItem?.id === req.id ? editingItem.name : ''}
                                    onSelect={() => onSelectRequest(req)}
                                    onStartRename={() => handleStartRename('request', req.id, req.name, col.id)}
                                    onChangeEditingName={(name) => setEditingItem(prev => prev ? { ...prev, name } : null)}
                                    onSaveRename={handleSaveRename}
                                    onCancelRename={() => setEditingItem(null)}
                                    onDuplicate={() => onDuplicateRequest && onDuplicateRequest(col.id, req)}
                                    onDelete={() => onDeleteRequest && onDeleteRequest(col.id, req.id)}
                                    onDragStart={() => setDraggedItem({ requestId: req.id, sourceColId: col.id })}
                                    onDragEnd={() => {
                                      setDraggedItem(null);
                                      setDragOverTarget(null);
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Root Requests (requests not inside any folder) */}
                      {col.requests
                        .filter((r) => !r.folderId || !col.folders.some((f) => f.id === r.folderId))
                        .map((req) => (
                          <RequestTreeRow
                            key={req.id}
                            request={req}
                            collectionId={col.id}
                            isActive={req.id === activeRequestId}
                            isEditing={editingItem?.type === 'request' && editingItem.id === req.id}
                            editingName={editingItem?.id === req.id ? editingItem.name : ''}
                            onSelect={() => onSelectRequest(req)}
                            onStartRename={() => handleStartRename('request', req.id, req.name, col.id)}
                            onChangeEditingName={(name) => setEditingItem(prev => prev ? { ...prev, name } : null)}
                            onSaveRename={handleSaveRename}
                            onCancelRename={() => setEditingItem(null)}
                            onDuplicate={() => onDuplicateRequest && onDuplicateRequest(col.id, req)}
                            onDelete={() => onDeleteRequest && onDeleteRequest(col.id, req.id)}
                            onDragStart={() => setDraggedItem({ requestId: req.id, sourceColId: col.id })}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverTarget(null);
                            }}
                          />
                        ))}

                      {col.requests.length === 0 && col.folders.length === 0 && (
                        <div className="py-2 px-2 text-slate-500 text-[11px] italic">
                          No requests in this collection yet. Drag requests here.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCollections.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs">
                No collections found matching "{searchTerm}".
              </div>
            )}
          </div>
        )}

        {/* ENVIRONMENTS VIEW */}
        {sidebarTab === 'environments' && (
          <div className="flex flex-col gap-3 p-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active Environment
              </span>
              <button
                type="button"
                onClick={onOpenEnvironmentModal}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Manage
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div
                onClick={() => onSelectEnvironment(null)}
                className={`p-2 rounded border cursor-pointer transition flex items-center justify-between text-xs ${
                  activeEnvironmentId === null
                    ? 'bg-sky-950/40 border-sky-500/40 text-sky-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <span>No Environment (Globals only)</span>
                {activeEnvironmentId === null && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </div>

              {environments.map((env) => (
                <div
                  key={env.id}
                  onClick={() => onSelectEnvironment(env.id)}
                  className={`p-2 rounded border cursor-pointer transition flex items-center justify-between text-xs ${
                    activeEnvironmentId === env.id
                      ? 'bg-sky-950/40 border-sky-500/40 text-sky-300 font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-semibold">{env.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {env.variables.filter((v) => v.enabled && v.key).length} variables
                    </span>
                  </div>
                  {activeEnvironmentId === env.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1.5">
              <span className="font-semibold text-slate-300">Quick Variable Syntax:</span>
              <span>Use <code className="text-sky-400">{'{{baseUrl}}'}</code> or <code className="text-sky-400">{'{{token}}'}</code> in URLs, headers, and request bodies.</span>
              <span className="text-slate-500">Built-ins: <code className="text-slate-400">{'{{$timestamp}}'}</code>, <code className="text-slate-400">{'{{$guid}}'}</code>, <code className="text-slate-400">{'{{$randomInt}}'}</code></span>
            </div>
          </div>
        )}

        {/* HISTORY VIEW */}
        {sidebarTab === 'history' && (
          <div className="flex flex-col gap-1">
            {filteredHistory.map((item) => {
              const is2xx = (item.response?.status || 0) >= 200 && (item.response?.status || 0) < 300;
              const dateStr = new Date(item.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div
                  key={item.id}
                  onClick={() => onRestoreHistory(item)}
                  className="p-2 rounded bg-slate-950/60 hover:bg-slate-800 border border-slate-800/60 hover:border-slate-700 cursor-pointer transition flex flex-col gap-1 group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <MethodBadge method={item.request.method} size="sm" />
                      <span className="truncate text-xs text-slate-200 font-medium">
                        {item.request.name || item.request.url}
                      </span>
                    </div>

                    {item.response && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          is2xx ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {item.response.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="truncate max-w-[140px]">{item.request.url}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.response && <span>{item.response.timeMs}ms</span>}
                      <span>{dateStr}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredHistory.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-xs">
                No request history yet. Executed requests will appear here for one-click restoration.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Edge Drag Handle for Resizing */}
      <div
        onMouseDown={handleMouseDownResize}
        title="Drag to resize sidebar"
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-sky-500/60 transition z-10"
      />
    </div>
  );
};

const RequestTreeRow: React.FC<{
  request: ApiRequest;
  collectionId?: string;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onStartRename: () => void;
  onChangeEditingName: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}> = ({
  request,
  isActive,
  isEditing,
  editingName,
  onSelect,
  onStartRename,
  onChangeEditingName,
  onSaveRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragEnd
}) => {
  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.();
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd?.();
      }}
      onClick={onSelect}
      className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition text-xs ${
        isActive
          ? 'bg-sky-600/20 text-sky-300 font-semibold border border-sky-500/30'
          : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
        <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
        <MethodBadge method={request.method} size="sm" />
        {isEditing ? (
          <div 
            className="flex items-center gap-1 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              autoFocus
              value={editingName}
              onChange={(e) => onChangeEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={onSaveRename}
              className="w-full bg-slate-950 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
          </div>
        ) : (
          <span 
            className="truncate hover:text-white"
            title={`${request.name} (Double-click to rename, drag to move)`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
          >
            {request.name}
          </span>
        )}
      </div>

      {!isEditing && (
        <div
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onStartRename}
            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-sky-300 rounded"
            title="Rename Request"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded"
              title="Duplicate Request"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded"
              title="Delete Request"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
