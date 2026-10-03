import React, { useState, useEffect } from 'react';
import { WorkspaceState, StorageLocationMode, StorageStatus } from '../types';
import { 
  HardDrive, 
  FolderOpen, 
  Download, 
  Upload, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  FileJson, 
  Server, 
  Laptop, 
  Sparkles, 
  ShieldCheck,
  X,
  FileCheck,
  Save
} from 'lucide-react';
import { 
  isFileSystemAccessSupported, 
  openPcWorkspaceFile, 
  createPcWorkspaceFile, 
  saveToLinkedPcFile, 
  getActiveFileHandle,
  saveToServerDisk, 
  loadFromServerDisk, 
  exportWorkspaceToPcFile, 
  readUploadedJsonFile,
  getSavedStorageMode,
  setSavedStorageMode,
  getAutoSavePreference,
  setAutoSavePreference
} from '../utils/pcStorage';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceState: WorkspaceState;
  onRestoreWorkspace: (newState: WorkspaceState) => void;
  storageStatus: StorageStatus;
  onStorageStatusChange: (status: StorageStatus) => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  onClose,
  workspaceState,
  onRestoreWorkspace,
  storageStatus,
  onStorageStatusChange
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const isFsSupported = isFileSystemAccessSupported();

  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Link to a file on PC hard drive (Open existing)
  const handleOpenPcFile = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const { handle, data, fileName } = await openPcWorkspaceFile();
      if (data && Array.isArray(data.collections)) {
        onRestoreWorkspace(data);
        onStorageStatusChange({
          mode: 'pc_file_handle',
          fileName,
          lastSavedAt: Date.now(),
          autoSaveEnabled: storageStatus.autoSaveEnabled
        });
        setStatusMessage({
          type: 'success',
          text: `Successfully linked and loaded workspace from PC file: "${fileName}". Auto-sync is active.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Selected file is not a valid workspace JSON structure.'
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to open PC file' });
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Create new file on PC hard drive (Save new file)
  const handleCreatePcFile = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const { handle, fileName } = await createPcWorkspaceFile(workspaceState);
      onStorageStatusChange({
        mode: 'pc_file_handle',
        fileName,
        lastSavedAt: Date.now(),
        autoSaveEnabled: storageStatus.autoSaveEnabled
      });
      setStatusMessage({
        type: 'success',
        text: `Workspace saved and linked to PC file: "${fileName}". Future changes will sync to this disk file.`
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to create PC file' });
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Save directly to linked PC file now
  const handleSaveNowToPcFile = async () => {
    const handle = getActiveFileHandle();
    if (!handle) {
      handleCreatePcFile();
      return;
    }

    setLoading(true);
    try {
      const result = await saveToLinkedPcFile(handle, workspaceState);
      if (result.success) {
        onStorageStatusChange({
          ...storageStatus,
          lastSavedAt: Date.now()
        });
        setStatusMessage({
          type: 'success',
          text: `Saved current workspace directly to PC file "${storageStatus.fileName || 'disk file'}"!`
        });
      } else {
        setStatusMessage({ type: 'error', text: result.error || 'Failed to save to PC file' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Save error' });
    } finally {
      setLoading(false);
    }
  };

  // 4. Save to Server Disk (./data/workspace.json)
  const handleSaveToServerDisk = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await saveToServerDisk(workspaceState);
      if (res.success) {
        setSavedStorageMode('server_disk');
        onStorageStatusChange({
          mode: 'server_disk',
          fileName: 'data/workspace.json',
          lastSavedAt: Date.now(),
          autoSaveEnabled: storageStatus.autoSaveEnabled,
          serverDiskAvailable: true
        });
        setStatusMessage({
          type: 'success',
          text: `Workspace saved to Server Disk filesystem (${res.path})!`
        });
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to write to server disk' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 5. Load from Server Disk
  const handleLoadFromServerDisk = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await loadFromServerDisk();
      if (res.exists && res.data) {
        onRestoreWorkspace(res.data);
        setSavedStorageMode('server_disk');
        onStorageStatusChange({
          mode: 'server_disk',
          fileName: 'data/workspace.json',
          lastSavedAt: Date.now(),
          autoSaveEnabled: storageStatus.autoSaveEnabled,
          serverDiskAvailable: true
        });
        setStatusMessage({
          type: 'success',
          text: 'Loaded workspace from Server Disk filesystem!'
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'No saved workspace file found on server disk yet. Click "Save to Server Disk" to create one.'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 6. Download / Export JSON directly to PC
  const handleDownloadPcJson = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    exportWorkspaceToPcFile(workspaceState, `api-client-workspace-${timestamp}.json`);
    setStatusMessage({
      type: 'success',
      text: 'Workspace JSON file downloaded to your computer!'
    });
  };

  // 7. Upload JSON file from PC
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const parsed = await readUploadedJsonFile(file);
      if (parsed && Array.isArray(parsed.collections)) {
        onRestoreWorkspace(parsed);
        setStatusMessage({
          type: 'success',
          text: `Successfully imported workspace from "${file.name}"!`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Uploaded file is not a valid workspace JSON structure.'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to read uploaded file' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // 8. Revert to standard browser localStorage
  const handleUseBrowserLocalStorage = () => {
    setSavedStorageMode('browser_local');
    onStorageStatusChange({
      mode: 'browser_local',
      fileName: undefined,
      lastSavedAt: Date.now(),
      autoSaveEnabled: true
    });
    setStatusMessage({
      type: 'info',
      text: 'Storage location set to Browser LocalStorage.'
    });
  };

  const handleToggleAutoSave = (checked: boolean) => {
    setAutoSavePreference(checked);
    onStorageStatusChange({
      ...storageStatus,
      autoSaveEnabled: checked
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Storage & PC Hard Drive Sync
              </h2>
              <p className="text-xs text-slate-400">
                Store your API collections directly on your computer instead of browser local storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-sky-950/60 border-sky-500/40 text-sky-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {/* Current Active Storage Target Pill */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                storageStatus.mode === 'pc_file_handle'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : storageStatus.mode === 'server_disk'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              }`}>
                {storageStatus.mode === 'pc_file_handle' ? (
                  <FileCheck className="w-5 h-5" />
                ) : storageStatus.mode === 'server_disk' ? (
                  <Server className="w-5 h-5" />
                ) : (
                  <HardDrive className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Active Storage Target:
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                    storageStatus.mode === 'pc_file_handle'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : storageStatus.mode === 'server_disk'
                      ? 'bg-purple-950 text-purple-300 border border-purple-700'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {storageStatus.mode === 'pc_file_handle'
                      ? `PC Disk File: ${storageStatus.fileName || 'Linked'}`
                      : storageStatus.mode === 'server_disk'
                      ? 'Local Server Disk File'
                      : 'Browser LocalStorage'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {storageStatus.lastSavedAt
                    ? `Last saved: ${new Date(storageStatus.lastSavedAt).toLocaleTimeString()}`
                    : 'Changes are automatically saved'}
                </p>
              </div>
            </div>

            {/* Auto Save Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={storageStatus.autoSaveEnabled}
                onChange={(e) => handleToggleAutoSave(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span>Auto-Save on Change</span>
            </label>
          </div>

          {/* Option 1: Native PC Hard Drive Link (File System Access API) */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Option 1: Link Directly to a File on your PC Hard Drive
                </h3>
              </div>
              {storageStatus.mode === 'pc_file_handle' && (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  ACTIVE
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Pick or create any <code className="text-emerald-300 font-mono">.json</code> file on your computer disk (e.g. in your Documents or Project folder). All collections, environments, and requests will be saved directly into that physical PC file.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={loading || !isFsSupported}
                onClick={handleOpenPcFile}
                className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Open File on PC Disk
              </button>

              <button
                type="button"
                disabled={loading || !isFsSupported}
                onClick={handleCreatePcFile}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                Create New PC Disk File
              </button>

              {storageStatus.mode === 'pc_file_handle' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveNowToPcFile}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition ml-auto shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Now to PC
                </button>
              )}
            </div>

            {!isFsSupported && (
              <p className="text-[11px] text-amber-400/90 bg-amber-950/40 p-2 rounded border border-amber-800/40">
                Note: Native File System Access API is not active in this browser context. You can use Server Disk storage or One-Click Download/Upload below.
              </p>
            )}
          </div>

          {/* Option 2: Server / Local Disk Storage File */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Option 2: Local Server Disk Storage (<span className="font-mono text-purple-300">./data/workspace.json</span>)
                </h3>
              </div>
              {storageStatus.mode === 'server_disk' && (
                <span className="text-[10px] text-purple-400 font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                  ACTIVE
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Saves the entire workspace state directly to the server's disk storage file at <code className="text-purple-300 font-mono">./data/workspace.json</code>.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveToServerDisk}
                className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Save to Server Disk
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleLoadFromServerDisk}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                Load from Server Disk
              </button>
            </div>
          </div>

          {/* Option 3: Export & Import JSON Files */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                Option 3: Download & Upload Workspace File (.json)
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              Quickly backup or restore workspace data to your computer's Downloads folder at any time.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadPcJson}
                className="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON to PC
              </button>

              <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload JSON from PC</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {storageStatus.mode !== 'browser_local' && (
                <button
                  type="button"
                  onClick={handleUseBrowserLocalStorage}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs font-medium transition ml-auto"
                >
                  Use Browser LocalStorage
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zero external cloud databases • 100% private to your machine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
