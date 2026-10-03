import React, { useState } from 'react';
import { ApiRequest, TabItem } from '../types';
import { METHOD_COLORS } from './MethodBadge';
import { Plus, X, MoreVertical } from 'lucide-react';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  requestsMap: Record<string, ApiRequest>;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseOthers: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onRenameRequest?: (requestId: string, newName: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  requestsMap,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onCloseOthers,
  onDuplicateTab,
  onRenameRequest
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartRename = (tab: TabItem, currentName: string) => {
    setEditingTabId(tab.id);
    setEditingName(currentName);
  };

  const handleSaveRename = (tab: TabItem) => {
    if (editingName.trim() && onRenameRequest) {
      onRenameRequest(tab.requestId, editingName.trim());
    }
    setEditingTabId(null);
  };

  return (
    <div className="flex items-center bg-slate-950 border-b border-slate-800/80 px-2 pt-1 gap-1 overflow-x-auto select-none no-scrollbar h-10">
      {tabs.map((tab) => {
        const req = requestsMap[tab.requestId];
        const method = req?.method || 'GET';
        const name = req?.name || 'Untitled Request';
        const isActive = tab.id === activeTabId;
        const isEditing = tab.id === editingTabId;
        const color = METHOD_COLORS[method] || METHOD_COLORS.GET;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            onDoubleClick={() => handleStartRename(tab, name)}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x text-xs cursor-pointer max-w-[220px] min-w-[120px] transition shrink-0 ${
              isActive
                ? 'bg-slate-900 border-slate-800 text-slate-100 font-medium'
                : 'bg-slate-950 border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
            }`}
          >
            {/* Method mini badge */}
            <span className={`text-[10px] font-mono font-bold shrink-0 ${color.text}`}>
              {method}
            </span>

            {/* Request Name */}
            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename(tab);
                  if (e.key === 'Escape') setEditingTabId(null);
                }}
                onBlur={() => handleSaveRename(tab)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-slate-950 border border-sky-500 rounded px-1 text-xs text-white focus:outline-none"
              />
            ) : (
              <span className="truncate text-xs flex-1" title={`${name} (Double-click to rename)`}>
                {name}
              </span>
            )}

            {/* Dirty Indicator */}
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition shrink-0"
              title="Close tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* New Tab Button */}
      <button
        type="button"
        onClick={onNewTab}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition shrink-0 ml-1"
        title="Open new request tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
