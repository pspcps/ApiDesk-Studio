import { WorkspaceState, StorageStatus, StorageLocationMode } from '../types';

const STORAGE_MODE_KEY = 'api_client_storage_mode';
const STORAGE_AUTOSAVE_KEY = 'api_client_storage_autosave';

// In-memory active file handle (File System Access API)
let activeFileHandle: any = null;
let activeFileName: string = '';

export function getActiveFileHandle() {
  return activeFileHandle;
}

export function setActiveFileHandle(handle: any, name: string) {
  activeFileHandle = handle;
  activeFileName = name;
}

export function getSavedStorageMode(): StorageLocationMode {
  try {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved === 'pc_file_handle' || saved === 'server_disk' || saved === 'browser_local') {
      return saved as StorageLocationMode;
    }
  } catch {
    // fallback
  }
  return 'browser_local';
}

export function setSavedStorageMode(mode: StorageLocationMode) {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function getAutoSavePreference(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_AUTOSAVE_KEY);
    return saved !== 'false'; // default true
  } catch {
    return true;
  }
}

export function setAutoSavePreference(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_AUTOSAVE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

/**
 * Check if the browser supports the Native File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Prompt user to select an existing JSON file from their PC disk
 */
export async function openPcWorkspaceFile(): Promise<{ handle: any; data: any; fileName: string }> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. You can use standard JSON File Upload or Server Disk storage.');
  }

  // @ts-ignore
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: 'Postman / API Workspace JSON',
        accept: {
          'application/json': ['.json']
        }
      }
    ],
    multiple: false
  });

  const file = await handle.getFile();
  const text = await file.text();
  const data = JSON.parse(text);

  setActiveFileHandle(handle, file.name);
  setSavedStorageMode('pc_file_handle');

  return { handle, data, fileName: file.name };
}

/**
 * Prompt user to create / select a new file on their PC hard drive to save workspace
 */
export async function createPcWorkspaceFile(data: any): Promise<{ handle: any; fileName: string }> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }

  // @ts-ignore
  const handle = await window.showSaveFilePicker({
    suggestedName: 'postman-workspace.json',
    types: [
      {
        description: 'JSON Workspace File',
        accept: {
          'application/json': ['.json']
        }
      }
    ]
  });

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();

  const file = await handle.getFile();
  setActiveFileHandle(handle, file.name);
  setSavedStorageMode('pc_file_handle');

  return { handle, fileName: file.name };
}

/**
 * Save current state directly into the linked PC disk file
 */
export async function saveToLinkedPcFile(handle: any, data: any): Promise<{ success: boolean; error?: string }> {
  if (!handle) {
    return { success: false, error: 'No PC file handle linked' };
  }

  try {
    // Verify write permissions
    if (handle.queryPermission) {
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const req = await handle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') {
          return { success: false, error: 'Write permission not granted by user' };
        }
      }
    }

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return { success: true };
  } catch (err: any) {
    console.error('Failed to write to PC file:', err);
    return { success: false, error: err.message || 'Write to PC disk failed' };
  }
}

/**
 * Save workspace to server disk filesystem (/api/workspace/disk)
 */
export async function saveToServerDisk(data: any): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const res = await fetch('/api/workspace/disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || 'Server disk write failed' };
    }
    return { success: true, path: json.path };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to backend' };
  }
}

/**
 * Load workspace from server disk filesystem (/api/workspace/disk)
 */
export async function loadFromServerDisk(): Promise<{ exists: boolean; data?: any; path?: string; error?: string }> {
  try {
    const res = await fetch('/api/workspace/disk');
    const json = await res.json();
    if (!res.ok) {
      return { exists: false, error: json.error || 'Server disk read failed' };
    }
    return { exists: !!json.exists, data: json.data, path: json.path };
  } catch (err: any) {
    return { exists: false, error: err.message };
  }
}

/**
 * Export / Download workspace directly to a PC JSON file
 */
export function exportWorkspaceToPcFile(data: any, fileName = 'postman-workspace.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read JSON file uploaded from user's PC
 */
export function readUploadedJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON file format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsText(file);
  });
}
