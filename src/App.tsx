import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ApiRequest, 
  ApiResponse, 
  Collection, 
  Environment, 
  Folder, 
  HistoryItem, 
  KeyValuePair, 
  TabItem, 
  WorkspaceState,
  StorageStatus
} from './types';
import { 
  loadWorkspaceState, 
  saveWorkspaceState, 
  createNewRequest, 
  createNewCollection, 
  addToHistory, 
  clearHistoryStorage 
} from './utils/storage';
import { 
  getSavedStorageMode, 
  getAutoSavePreference, 
  getActiveFileHandle, 
  saveToLinkedPcFile, 
  saveToServerDisk, 
  loadFromServerDisk 
} from './utils/pcStorage';
import { executeApiRequest } from './utils/requestExecutor';
import { VariableContext } from './utils/variableResolver';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';
import { CurlImportModal } from './components/CurlImportModal';
import { TeamSyncModal } from './components/TeamSyncModal';
import { EnvironmentModal } from './components/EnvironmentModal';
import { CodeSnippetModal } from './components/CodeSnippetModal';
import { CollectionRunnerModal } from './components/CollectionRunnerModal';
import { SaveRequestModal } from './components/SaveRequestModal';
import { StorageManagerModal } from './components/StorageManagerModal';
import { LogsViewerModal } from './components/LogsViewerModal';
import { LoadTesterView } from './components/LoadTesterView';
import { ScriptRegressionRunnerView } from './components/ScriptRegressionRunnerView';
import { ServiceAtlasView } from './components/ServiceAtlasView';
import { RouteExplorerView } from './components/RouteExplorerView';
import { DataPulsePublishView } from './components/DataPulsePublishView';
import { DataPulseWorkflowView } from './components/DataPulseWorkflowView';
import { FeatureToggleView } from './components/FeatureToggleView';
import { GlobalCopyPasteMenu } from './components/GlobalCopyPasteMenu';
import { LeftSideMenu } from './components/LeftSideMenu';
import { AppViewMode } from './components/Navbar';

export function App() {
  // Active App View Mode (API Client, Load Testing, Script Automation)
  const [activeViewMode, setActiveViewMode] = useState<AppViewMode>('api_client');

  // Load workspace state from LocalStorage
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspaceState());
  const [activeTabId, setActiveTabId] = useState<string>(() => workspace.activeTabId || workspace.tabs[0]?.id || 'tab_default');
  
  // Storage Location & PC Disk Sync State
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(() => ({
    mode: getSavedStorageMode(),
    autoSaveEnabled: getAutoSavePreference(),
    lastSavedAt: Date.now()
  }));
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  // Responses and loading state keyed by request ID
  const [responses, setResponses] = useState<Record<string, ApiResponse>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTeamSyncModalOpen, setIsTeamSyncModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [runnerConfig, setRunnerConfig] = useState<{ isOpen: boolean; collectionId: string | null; folderId?: string }>({
    isOpen: false,
    collectionId: null
  });

  // Split pane height state
  const [splitPercent, setSplitPercent] = useState<number>(55);
  const isDraggingSplitter = useRef(false);

  // Sync workspace state to LocalStorage and/or PC Disk / Server Disk
  useEffect(() => {
    const stateToPersist = { ...workspace, activeTabId };
    
    // Always keep browser local storage updated as instant safety fallback
    saveWorkspaceState(stateToPersist);

    // If Auto-Save is enabled and PC disk handle or server disk is active
    if (storageStatus.autoSaveEnabled) {
      if (storageStatus.mode === 'pc_file_handle') {
        const handle = getActiveFileHandle();
        if (handle) {
          saveToLinkedPcFile(handle, stateToPersist).then((res) => {
            if (res.success) {
              setStorageStatus(prev => ({ ...prev, lastSavedAt: Date.now() }));
            }
          });
        }
      } else if (storageStatus.mode === 'server_disk') {
        saveToServerDisk(stateToPersist).then((res) => {
          if (res.success) {
            setStorageStatus(prev => ({ ...prev, lastSavedAt: Date.now() }));
          }
        });
      }
    }
  }, [workspace, activeTabId, storageStatus.mode, storageStatus.autoSaveEnabled]);

  // Current Active Tab & Request
  const openRequests = workspace.openRequests || {};
  const activeTab = workspace.tabs?.find(t => t.id === activeTabId) || workspace.tabs?.[0];
  const activeRequest = (activeTab && openRequests[activeTab.requestId]) 
    ? openRequests[activeTab.requestId] 
    : (workspace.collections?.[0]?.requests?.[0] || null);
  const currentResponse = activeRequest ? responses[activeRequest.id] || null : null;
  const isCurrentLoading = activeRequest ? !!loadingMap[activeRequest.id] : false;

  // Active Environment & Variables Context
  const activeEnv = workspace.environments.find(e => e.id === workspace.activeEnvironmentId) || null;
  const variableContext: VariableContext = {
    activeEnvironment: activeEnv,
    globalVariables: workspace.globalVariables
  };

  // Helper to update a request
  const handleUpdateRequest = useCallback((updatedReq: ApiRequest) => {
    setWorkspace(prev => {
      // Mark tab as dirty if changed
      const updatedTabs = prev.tabs.map(t => {
        if (t.requestId === updatedReq.id) {
          return { ...t, isDirty: true, title: updatedReq.name };
        }
        return t;
      });

      // Update in collection if request belongs to one
      const updatedCols = prev.collections.map(col => {
        if (col.id === updatedReq.collectionId || col.requests.some(r => r.id === updatedReq.id)) {
          const reqIndex = col.requests.findIndex(r => r.id === updatedReq.id);
          if (reqIndex >= 0) {
            const newReqs = [...col.requests];
            newReqs[reqIndex] = { ...newReqs[reqIndex], ...updatedReq };
            return { ...col, requests: newReqs, updatedAt: Date.now() };
          }
        }
        return col;
      });

      return {
        ...prev,
        collections: updatedCols,
        tabs: updatedTabs,
        openRequests: {
          ...prev.openRequests,
          [updatedReq.id]: updatedReq
        }
      };
    });
  }, []);

  // Execute Request (Send button or Cmd+Enter)
  const handleSendRequest = useCallback(async () => {
    if (!activeRequest) return;

    const reqId = activeRequest.id;
    const abortController = new AbortController();
    abortControllersRef.current[reqId] = abortController;

    setLoadingMap(prev => ({ ...prev, [reqId]: true }));

    try {
      const response = await executeApiRequest(activeRequest, variableContext, abortController.signal);
      setResponses(prev => ({ ...prev, [reqId]: response }));

      // Add to History
      const updatedHistory = addToHistory(activeRequest, response);
      setWorkspace(prev => ({ ...prev, history: updatedHistory }));

      // If response extracted variables, persist them to active environment / globals
      if (response.savedVariables && Object.keys(response.savedVariables).length > 0) {
        setWorkspace(prev => {
          if (prev.activeEnvironmentId) {
            const updatedEnvs = prev.environments.map(env => {
              if (env.id === prev.activeEnvironmentId) {
                const vars = [...env.variables];
                for (const [k, v] of Object.entries(response.savedVariables!)) {
                  const exist = vars.find(x => x.key === k);
                  if (exist) exist.value = v;
                  else vars.push({ id: 'v_' + Math.random(), key: k, value: v, enabled: true });
                }
                return { ...env, variables: vars };
              }
              return env;
            });
            return { ...prev, environments: updatedEnvs };
          } else {
            const vars = [...prev.globalVariables];
            for (const [k, v] of Object.entries(response.savedVariables!)) {
              const exist = vars.find(x => x.key === k);
              if (exist) exist.value = v;
              else vars.push({ id: 'v_' + Math.random(), key: k, value: v, enabled: true });
            }
            return { ...prev, globalVariables: vars };
          }
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errorResponse: ApiResponse = {
          status: 0,
          statusText: 'Client / Network Error',
          headers: {},
          data: `Request failed: ${err.message}`,
          timeMs: 0,
          sizeBytes: 0,
          ok: false,
          contentType: 'text/plain',
          timing: { dns: 0, tcp: 0, ttfb: 0, download: 0, total: 0 },
          isJson: false,
          isBinary: false,
          timestamp: Date.now()
        };
        setResponses(prev => ({ ...prev, [reqId]: errorResponse }));
      }
    } finally {
      setLoadingMap(prev => ({ ...prev, [reqId]: false }));
      delete abortControllersRef.current[reqId];
    }
  }, [activeRequest, variableContext]);

  // Cancel Request
  const handleAbortRequest = useCallback(() => {
    if (!activeRequest) return;
    const controller = abortControllersRef.current[activeRequest.id];
    if (controller) {
      controller.abort();
    }
    setLoadingMap(prev => ({ ...prev, [activeRequest.id]: false }));
  }, [activeRequest]);

  // Tab Operations
  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleNewTab = (collectionId?: string, folderId?: string) => {
    const newReq = createNewRequest(collectionId, folderId);
    const newTab: TabItem = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      requestId: newReq.id,
      title: newReq.name,
      isDirty: false
    };

    setWorkspace(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      openRequests: { ...prev.openRequests, [newReq.id]: newReq }
    }));
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string) => {
    setWorkspace(prev => {
      const remainingTabs = prev.tabs.filter(t => t.id !== tabId);
      if (remainingTabs.length === 0) {
        // If all closed, create one fresh tab
        const freshReq = createNewRequest();
        const freshTab: TabItem = {
          id: 'tab_' + Math.random().toString(36).substring(2, 9),
          requestId: freshReq.id,
          title: freshReq.name,
          isDirty: false
        };
        setActiveTabId(freshTab.id);
        return {
          ...prev,
          tabs: [freshTab],
          openRequests: { [freshReq.id]: freshReq }
        };
      } else {
        if (activeTabId === tabId) {
          const closedIndex = prev.tabs.findIndex(t => t.id === tabId);
          const nextActive = remainingTabs[Math.max(0, closedIndex - 1)];
          setActiveTabId(nextActive.id);
        }
        return { ...prev, tabs: remainingTabs };
      }
    });
  };

  const handleCloseOthers = (tabId: string) => {
    setWorkspace(prev => ({
      ...prev,
      tabs: prev.tabs.filter(t => t.id === tabId)
    }));
    setActiveTabId(tabId);
  };

  const handleDuplicateTab = (tabId: string) => {
    const tabToDup = workspace.tabs.find(t => t.id === tabId);
    if (!tabToDup) return;
    const reqToDup = workspace.openRequests[tabToDup.requestId];
    if (!reqToDup) return;

    const dupReq: ApiRequest = {
      ...reqToDup,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: `${reqToDup.name} (Copy)`,
      updatedAt: Date.now()
    };
    const dupTab: TabItem = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      requestId: dupReq.id,
      title: dupReq.name,
      isDirty: true
    };

    setWorkspace(prev => ({
      ...prev,
      tabs: [...prev.tabs, dupTab],
      openRequests: { ...prev.openRequests, [dupReq.id]: dupReq }
    }));
    setActiveTabId(dupTab.id);
  };

  // Open Request from Collections
  const handleSelectRequestFromTree = (req: ApiRequest) => {
    // Check if tab already exists for this request
    const existingTab = workspace.tabs.find(t => t.requestId === req.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: TabItem = {
        id: 'tab_' + Math.random().toString(36).substring(2, 9),
        requestId: req.id,
        title: req.name,
        isDirty: false
      };
      setWorkspace(prev => ({
        ...prev,
        tabs: [...prev.tabs, newTab],
        openRequests: { ...prev.openRequests, [req.id]: { ...req } }
      }));
      setActiveTabId(newTab.id);
    }
  };

  // Save changes to collection
  const handleSaveActiveRequest = () => {
    if (!activeRequest) return;

    if (!activeRequest.collectionId) {
      // If it doesn't belong to any collection, open Save As modal
      setIsSaveModalOpen(true);
      return;
    }

    setWorkspace(prev => {
      const updatedCols = prev.collections.map(col => {
        if (col.id === activeRequest.collectionId) {
          const reqIndex = col.requests.findIndex(r => r.id === activeRequest.id);
          let newReqs = [...col.requests];
          if (reqIndex >= 0) {
            newReqs[reqIndex] = { ...activeRequest };
          } else {
            newReqs.push({ ...activeRequest });
          }
          return { ...col, requests: newReqs, updatedAt: Date.now() };
        }
        return col;
      });

      const updatedTabs = prev.tabs.map(t => {
        if (t.requestId === activeRequest.id) {
          return { ...t, isDirty: false, title: activeRequest.name };
        }
        return t;
      });

      return {
        ...prev,
        collections: updatedCols,
        tabs: updatedTabs
      };
    });
  };

  // Save to specific collection/folder from modal
  const handleSaveRequestToCollection = (name: string, collectionId: string, folderId?: string) => {
    if (!activeRequest) return;

    const savedReq: ApiRequest = {
      ...activeRequest,
      name,
      collectionId,
      folderId,
      updatedAt: Date.now()
    };

    setWorkspace(prev => {
      const updatedCols = prev.collections.map(col => {
        if (col.id === collectionId) {
          const existIdx = col.requests.findIndex(r => r.id === savedReq.id);
          const reqs = [...col.requests];
          if (existIdx >= 0) {
            reqs[existIdx] = savedReq;
          } else {
            reqs.push(savedReq);
          }
          return { ...col, requests: reqs, updatedAt: Date.now() };
        }
        return col;
      });

      const updatedTabs = prev.tabs.map(t => {
        if (t.requestId === savedReq.id) {
          return { ...t, isDirty: false, title: name };
        }
        return t;
      });

      return {
        ...prev,
        collections: updatedCols,
        tabs: updatedTabs,
        openRequests: { ...prev.openRequests, [savedReq.id]: savedReq }
      };
    });
  };

  // Collection CRUD
  const handleNewCollection = () => {
    const col = createNewCollection(`New Collection ${workspace.collections.length + 1}`);
    setWorkspace(prev => ({
      ...prev,
      collections: [...prev.collections, col]
    }));
  };

  const handleAddNewCollectionWithName = (name: string): string => {
    const col = createNewCollection(name);
    setWorkspace(prev => ({
      ...prev,
      collections: [...prev.collections, col]
    }));
    return col.id;
  };

  const handleUpdateCollection = (updated: Collection) => {
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(c => c.id === updated.id ? updated : c)
    }));
  };

  const handleDeleteCollection = (collectionId: string) => {
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.filter(c => c.id !== collectionId)
    }));
  };

  const handleDeleteRequestFromCollection = (collectionId: string, requestId: string) => {
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(col => {
        if (col.id === collectionId) {
          return {
            ...col,
            requests: col.requests.filter(r => r.id !== requestId),
            updatedAt: Date.now()
          };
        }
        return col;
      })
    }));
  };

  const handleDuplicateRequestInCollection = (collectionId: string, req: ApiRequest) => {
    const dupReq: ApiRequest = {
      ...req,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: `${req.name} (Copy)`,
      updatedAt: Date.now()
    };
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(col => {
        if (col.id === collectionId) {
          return {
            ...col,
            requests: [...col.requests, dupReq],
            updatedAt: Date.now()
          };
        }
        return col;
      })
    }));
  };

  const handleAddFolderToCollection = (collectionId: string, folderName: string = 'New Folder') => {
    const newFolder: Folder = {
      id: 'folder_' + Math.random().toString(36).substring(2, 9),
      name: folderName,
      collectionId
    };
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(col => {
        if (col.id === collectionId) {
          return {
            ...col,
            folders: [...col.folders, newFolder],
            updatedAt: Date.now()
          };
        }
        return col;
      })
    }));
  };

  const handleUpdateFolderInCollection = (collectionId: string, folderId: string, newName: string) => {
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(col => {
        if (col.id === collectionId) {
          return {
            ...col,
            folders: col.folders.map(f => f.id === folderId ? { ...f, name: newName } : f),
            updatedAt: Date.now()
          };
        }
        return col;
      })
    }));
  };

  const handleDeleteFolderFromCollection = (collectionId: string, folderId: string) => {
    setWorkspace(prev => ({
      ...prev,
      collections: prev.collections.map(col => {
        if (col.id === collectionId) {
          return {
            ...col,
            folders: col.folders.filter(f => f.id !== folderId),
            // Unlink requests in that folder or keep them in root collection
            requests: col.requests.map(r => r.folderId === folderId ? { ...r, folderId: undefined } : r),
            updatedAt: Date.now()
          };
        }
        return col;
      })
    }));
  };

  // Import cURL command
  const handleImportCurl = (parsed: Partial<ApiRequest>) => {
    const newReq = {
      ...createNewRequest(),
      ...parsed,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      name: parsed.url ? `cURL: ${parsed.url.split('?')[0].split('/').pop() || 'Request'}` : 'Imported cURL',
      updatedAt: Date.now()
    };
    const newTab: TabItem = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      requestId: newReq.id,
      title: newReq.name,
      isDirty: true
    };
    setWorkspace(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      openRequests: { ...prev.openRequests, [newReq.id]: newReq }
    }));
    setActiveTabId(newTab.id);
  };

  // Import team data bundle
  const handleImportTeamData = (
    data: { collections: Collection[]; environments: Environment[]; globalVariables: KeyValuePair[] },
    mode: 'merge' | 'replace'
  ) => {
    setWorkspace(prev => {
      if (mode === 'replace') {
        return {
          ...prev,
          collections: data.collections,
          environments: data.environments,
          globalVariables: data.globalVariables
        };
      } else {
        // Merge collections
        const mergedCols = [...prev.collections];
        data.collections.forEach(newCol => {
          const idx = mergedCols.findIndex(c => c.name === newCol.name);
          if (idx >= 0) {
            mergedCols[idx] = newCol;
          } else {
            mergedCols.push(newCol);
          }
        });

        // Merge environments
        const mergedEnvs = [...prev.environments];
        data.environments.forEach(newEnv => {
          const idx = mergedEnvs.findIndex(e => e.name === newEnv.name);
          if (idx >= 0) {
            mergedEnvs[idx] = newEnv;
          } else {
            mergedEnvs.push(newEnv);
          }
        });

        return {
          ...prev,
          collections: mergedCols,
          environments: mergedEnvs,
          globalVariables: [...prev.globalVariables, ...data.globalVariables.filter(g => !prev.globalVariables.some(x => x.key === g.key))]
        };
      }
    });
  };

  // Restore request from History
  const handleRestoreHistory = (item: HistoryItem) => {
    const restoredReq: ApiRequest = {
      ...item.request,
      id: 'req_' + Math.random().toString(36).substring(2, 9),
      updatedAt: Date.now()
    };
    const newTab: TabItem = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      requestId: restoredReq.id,
      title: restoredReq.name,
      isDirty: false
    };
    setWorkspace(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      openRequests: { ...prev.openRequests, [restoredReq.id]: restoredReq }
    }));
    if (item.response) {
      setResponses(prev => ({ ...prev, [restoredReq.id]: item.response! }));
    }
    setActiveTabId(newTab.id);
  };

  const handleClearHistory = () => {
    clearHistoryStorage();
    setWorkspace(prev => ({ ...prev, history: [] }));
  };

  // Keyboard shortcut listener: Cmd/Ctrl + Enter to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveActiveRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSendRequest, handleSaveActiveRequest]);

  // Mouse drag handler for split pane
  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    isDraggingSplitter.current = true;
    const startY = e.clientY;
    const container = document.getElementById('main-editor-split-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const offset = moveEvent.clientY - containerRect.top;
      const percent = Math.min(80, Math.max(20, (offset / containerRect.height) * 100));
      setSplitPercent(percent);
    };

    const handleMouseUp = () => {
      isDraggingSplitter.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top Navbar */}
      <Navbar
        activeViewMode={activeViewMode}
        onSelectViewMode={setActiveViewMode}
        environments={workspace.environments}
        activeEnvironmentId={workspace.activeEnvironmentId}
        storageStatus={storageStatus}
        onSelectEnvironment={(envId) => setWorkspace(prev => ({ ...prev, activeEnvironmentId: envId }))}
        onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenTeamSyncModal={() => setIsTeamSyncModalOpen(true)}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenLogsModal={() => setIsLogsModalOpen(true)}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Menu (Extensible Workspace Rails & Tools) */}
        <LeftSideMenu
          activeViewMode={activeViewMode}
          onSelectViewMode={setActiveViewMode}
          openTabsCount={workspace.tabs?.length || 0}
          collectionsCount={workspace.collections?.length || 0}
          environmentsCount={workspace.environments?.length || 0}
          onOpenLogsModal={() => setIsLogsModalOpen(true)}
          onOpenStorageModal={() => setIsStorageModalOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenTeamSyncModal={() => setIsTeamSyncModalOpen(true)}
          onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
        />

        {activeViewMode === 'load_testing' ? (
          <LoadTesterView
            activeRequest={activeRequest}
            activeEnvironment={activeEnv}
            globalVariables={workspace.globalVariables}
          />
        ) : activeViewMode === 'script_runner' ? (
          <ScriptRegressionRunnerView
            environments={workspace.environments}
            activeEnvironmentId={workspace.activeEnvironmentId}
            globalVariables={workspace.globalVariables}
          />
        ) : activeViewMode === 'service_atlas' ? (
          <ServiceAtlasView />
        ) : activeViewMode === 'route_explorer' ? (
          <RouteExplorerView
            onSendRouteToClient={(partialReq) => {
              handleImportCurl(partialReq);
              setActiveViewMode('api_client');
            }}
          />
        ) : activeViewMode === 'datapulse_publish' ? (
          <DataPulsePublishView />
        ) : activeViewMode === 'datapulse_workflow' ? (
          <DataPulseWorkflowView />
        ) : activeViewMode === 'feature_toggles' ? (
          <FeatureToggleView />
        ) : (
          <>
            {/* Left Collections / History Sidebar */}
            <Sidebar
              collections={workspace.collections}
              environments={workspace.environments}
              activeEnvironmentId={workspace.activeEnvironmentId}
              history={workspace.history}
              activeRequestId={activeRequest?.id}
              onSelectRequest={handleSelectRequestFromTree}
              onNewRequest={(colId, folderId) => handleNewTab(colId, folderId)}
              onNewCollection={handleNewCollection}
              onUpdateCollection={handleUpdateCollection}
              onDeleteCollection={handleDeleteCollection}
              onExportCollection={() => setIsTeamSyncModalOpen(true)}
              onRunCollection={(colId, folderId) => setRunnerConfig({ isOpen: true, collectionId: colId, folderId })}
              onUpdateRequest={handleUpdateRequest}
              onDeleteRequest={handleDeleteRequestFromCollection}
              onDuplicateRequest={handleDuplicateRequestInCollection}
              onAddFolder={handleAddFolderToCollection}
              onUpdateFolder={handleUpdateFolderInCollection}
              onDeleteFolder={handleDeleteFolderFromCollection}
              onSelectEnvironment={(envId) => setWorkspace(prev => ({ ...prev, activeEnvironmentId: envId }))}
              onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
              onRestoreHistory={handleRestoreHistory}
              onClearHistory={handleClearHistory}
            />

            {/* Center Main Editor & Response Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
              {/* Open Tabs Bar */}
              <TabBar
                tabs={workspace.tabs}
                activeTabId={activeTabId}
                requestsMap={openRequests}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                onNewTab={() => handleNewTab()}
                onCloseOthers={handleCloseOthers}
                onDuplicateTab={handleDuplicateTab}
                onRenameRequest={(reqId, newName) => {
                  const req = openRequests[reqId];
                  if (req) {
                    handleUpdateRequest({ ...req, name: newName });
                  }
                }}
              />

              {/* Split Pane: Request Builder (top) + Response Viewer (bottom) */}
              {activeRequest ? (
                <div id="main-editor-split-container" className="flex-1 flex flex-col overflow-hidden relative">
                  {/* Top: Request Builder */}
                  <div style={{ height: `${splitPercent}%` }} className="overflow-hidden flex flex-col">
                    <RequestBuilder
                      request={activeRequest}
                      isLoading={isCurrentLoading}
                      variableContext={variableContext}
                      environments={workspace.environments}
                      activeEnvironmentId={workspace.activeEnvironmentId}
                      onSelectEnvironment={(envId) => setWorkspace(prev => ({ ...prev, activeEnvironmentId: envId }))}
                      onUpdate={handleUpdateRequest}
                      onSend={handleSendRequest}
                      onAbort={handleAbortRequest}
                      onSave={handleSaveActiveRequest}
                      onSaveToCollection={() => setIsSaveModalOpen(true)}
                      onOpenCodeSnippet={() => setIsCodeModalOpen(true)}
                    />
                  </div>

                  {/* Draggable Divider */}
                  <div
                    onMouseDown={handleMouseDownSplitter}
                    className="h-1.5 bg-slate-900 hover:bg-sky-500 cursor-row-resize transition flex items-center justify-center border-y border-slate-800 shrink-0"
                  >
                    <div className="w-10 h-0.5 bg-slate-600 rounded"></div>
                  </div>

                  {/* Bottom: Response Viewer */}
                  <div style={{ height: `${100 - splitPercent}%` }} className="overflow-hidden flex flex-col">
                    <ResponseViewer
                      response={currentResponse}
                      isLoading={isCurrentLoading}
                      onClear={() => {
                        if (activeRequest) {
                          setResponses(prev => {
                            const copy = { ...prev };
                            delete copy[activeRequest.id];
                            return copy;
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                  No active request. Click + to create a request.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      <CurlImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportCurl={handleImportCurl}
        onImportCollections={(imported) => handleImportTeamData(imported, 'merge')}
      />

      <TeamSyncModal
        isOpen={isTeamSyncModalOpen}
        onClose={() => setIsTeamSyncModalOpen(false)}
        collections={workspace.collections}
        environments={workspace.environments}
        globalVariables={workspace.globalVariables}
        onImportTeamData={handleImportTeamData}
      />

      <StorageManagerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        workspaceState={{ ...workspace, activeTabId }}
        onRestoreWorkspace={(newState) => {
          setWorkspace(newState);
          if (newState.tabs && newState.tabs.length > 0) {
            setActiveTabId(newState.tabs[0].id);
          }
        }}
        storageStatus={storageStatus}
        onStorageStatusChange={setStorageStatus}
      />

      <LogsViewerModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      />

      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        environments={workspace.environments}
        globalVariables={workspace.globalVariables}
        activeEnvironmentId={workspace.activeEnvironmentId}
        onUpdateEnvironments={(envs) => setWorkspace(prev => ({ ...prev, environments: envs }))}
        onUpdateGlobals={(globals) => setWorkspace(prev => ({ ...prev, globalVariables: globals }))}
        onSelectActiveEnv={(envId) => setWorkspace(prev => ({ ...prev, activeEnvironmentId: envId }))}
      />

      {activeRequest && (
        <CodeSnippetModal
          isOpen={isCodeModalOpen}
          onClose={() => setIsCodeModalOpen(false)}
          request={activeRequest}
          variableContext={variableContext}
        />
      )}

      {activeRequest && (
        <SaveRequestModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          request={activeRequest}
          collections={workspace.collections}
          onSave={handleSaveRequestToCollection}
          onAddNewCollection={handleAddNewCollectionWithName}
        />
      )}

      <CollectionRunnerModal
        isOpen={runnerConfig.isOpen}
        onClose={() => setRunnerConfig({ isOpen: false, collectionId: null })}
        collection={workspace.collections.find(c => c.id === runnerConfig.collectionId) || null}
        folderId={runnerConfig.folderId}
        variableContext={variableContext}
        onUpdateVariable={(key, val) => {
          setWorkspace(prev => {
            if (prev.activeEnvironmentId) {
              const updatedEnvs = prev.environments.map(env => {
                if (env.id === prev.activeEnvironmentId) {
                  const vars = [...env.variables];
                  const ex = vars.find(v => v.key === key);
                  if (ex) ex.value = val;
                  else vars.push({ id: 'v_' + Math.random(), key, value: val, enabled: true });
                  return { ...env, variables: vars };
                }
                return env;
              });
              return { ...prev, environments: updatedEnvs };
            }
            return prev;
          });
        }}
      />
      {/* Global right-click Copy/Paste context menu */}
      <GlobalCopyPasteMenu />
    </div>
  );
}

export default App;
