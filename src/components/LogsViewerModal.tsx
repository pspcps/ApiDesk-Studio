import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  RefreshCw,
  Trash2,
  Download,
  Copy,
  Check,
  Search,
  FolderOpen,
  Filter,
  AlertCircle,
  Clock,
  Terminal,
  Server,
  Layers,
  ArrowDown
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface LogFileInfo {
  filename: string;
  sizeBytes: number;
  updatedAt: number;
  path: string;
}

interface LogsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogsViewerModal: React.FC<LogsViewerModalProps> = ({ isOpen, onClose }) => {
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('app.log');
  const [logContent, setLogContent] = useState<string>('');
  const [totalLines, setTotalLines] = useState<number>(0);
  const [logsDir, setLogsDir] = useState<string>('~/apilogs');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO'>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch list of files
  const fetchLogFiles = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setLogFiles(json.files || []);
          if (json.logsDir) setLogsDir(json.logsDir);
        }
      }
    } catch {
      // Ignored
    }
  };

  // Fetch content of selected log file
  const fetchLogContent = async (file = selectedFile) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs/view?file=${encodeURIComponent(file)}&lines=500`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setLogContent(json.content || '');
          setTotalLines(json.totalLines || 0);
          if (json.logsDir) setLogsDir(json.logsDir);
        }
      }
    } catch {
      setLogContent('[Error loading log file content]');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogFiles();
      fetchLogContent(selectedFile);
    }
  }, [isOpen, selectedFile]);

  // Auto refresh interval
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogContent(selectedFile);
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, selectedFile]);

  // Auto scroll to bottom when content updates if autoScroll enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logContent, autoScroll]);

  if (!isOpen) return null;

  const handleClearCurrent = async () => {
    if (!window.confirm(`Clear contents of ${selectedFile} at ${logsDir}?`)) return;
    setClearing(true);
    try {
      await fetch('/api/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedFile })
      });
      await fetchLogContent(selectedFile);
      await fetchLogFiles();
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Clear all logs in ${logsDir}?`)) return;
    setClearing(true);
    try {
      await fetch('/api/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      await fetchLogContent(selectedFile);
      await fetchLogFiles();
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(logContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile || 'apilogs.log';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter lines
  const lines = logContent.split('\n').filter(Boolean);
  const filteredLines = lines.filter((line) => {
    if (levelFilter !== 'ALL') {
      if (!line.includes(`[${levelFilter}]`)) return false;
    }
    if (searchTerm.trim()) {
      return line.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const getBadgeColorForFile = (name: string) => {
    if (name.includes('error')) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (name.includes('server')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (name.includes('electron')) return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (name.includes('script')) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    if (name.includes('loadtest')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (name.includes('client')) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    return 'text-slate-300 bg-slate-800 border-slate-700';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">System & API Tracing Logs</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3 text-sky-400" />
                  {logsDir}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Live trace logs written directly to <code className="text-sky-300 font-mono">~/apilogs</code> for debugging server, proxy, scripts, and Electron.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                autoRefresh
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Toggle Live 2s Auto Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>{autoRefresh ? 'Live Streaming' : 'Auto Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLogContent(selectedFile)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
              title="Refresh now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
              title="Copy visible log lines to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
              title="Download selected log file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleClearCurrent}
              disabled={clearing}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs font-medium flex items-center gap-1.5 border border-red-800/40 transition"
              title="Clear current log file"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear File</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: Log Files in ~/apilogs */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 flex flex-col p-3 gap-2 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
              <span>Log Files</span>
              <span className="text-slate-500 font-mono text-[10px]">{logFiles.length} files</span>
            </span>

            <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
              {['app.log', 'server.log', 'error.log', 'scripts.log', 'loadtest.log', 'electron.log', 'client.log'].map((filename) => {
                const info = logFiles.find((f) => f.filename === filename);
                const isSelected = selectedFile === filename;
                return (
                  <button
                    key={filename}
                    type="button"
                    onClick={() => setSelectedFile(filename)}
                    className={`px-3 py-2 rounded-lg text-left transition flex items-center justify-between gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 font-semibold'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                      <span className="text-xs font-mono truncate">{filename}</span>
                    </div>
                    {info && (
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {formatFileSize(info.sizeBytes)}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Other discovered files */}
              {logFiles
                .filter(
                  (f) =>
                    !['app.log', 'server.log', 'error.log', 'scripts.log', 'loadtest.log', 'electron.log', 'client.log'].includes(
                      f.filename
                    )
                )
                .map((f) => (
                  <button
                    key={f.filename}
                    type="button"
                    onClick={() => setSelectedFile(f.filename)}
                    className={`px-3 py-2 rounded-lg text-left transition flex items-center justify-between gap-2 border cursor-pointer ${
                      selectedFile === f.filename
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 font-semibold'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span className="text-xs font-mono truncate">{f.filename}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{formatFileSize(f.sizeBytes)}</span>
                  </button>
                ))}
            </div>

            {/* Clear All Button */}
            <button
              type="button"
              onClick={handleClearAll}
              className="mt-auto w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-red-950/30 text-slate-400 hover:text-red-300 text-xs font-medium border border-slate-800 hover:border-red-900/40 transition flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All ~/apilogs</span>
            </button>
          </div>

          {/* Main Log Viewer Screen */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            {/* Filter Toolbar */}
            <div className="h-11 px-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Filter ${selectedFile}... (e.g. 500, error, proxy)`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Level filter tabs */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px] font-semibold">
                  {(['ALL', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevelFilter(lvl)}
                      className={`px-2 py-0.5 rounded transition ${
                        levelFilter === lvl
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Auto-scroll to bottom</span>
                </label>

                <span className="text-slate-500 font-mono text-[11px]">
                  {filteredLines.length} of {totalLines} lines
                </span>
              </div>
            </div>

            {/* Log Terminal Screen */}
            <div
              ref={logContainerRef}
              className="flex-1 p-4 font-mono text-[12px] leading-relaxed overflow-y-auto overflow-x-auto text-slate-300 select-text"
            >
              {filteredLines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Terminal className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">No matching log entries found for "{selectedFile}"</p>
                  <p className="text-[11px] text-slate-600">
                    File location on local computer: {logsDir}/{selectedFile}
                  </p>
                </div>
              ) : (
                filteredLines.map((line, idx) => {
                  const isError = line.includes('[ERROR]');
                  const isWarn = line.includes('[WARN]');
                  const isInfo = line.includes('[INFO]');

                  let lineStyle = 'text-slate-300 hover:bg-slate-900/60';
                  if (isError) lineStyle = 'text-red-400 bg-red-950/20 hover:bg-red-950/30';
                  else if (isWarn) lineStyle = 'text-amber-300 bg-amber-950/10 hover:bg-amber-950/20';
                  else if (isInfo) lineStyle = 'text-sky-200/90 hover:bg-slate-900/60';

                  return (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded transition font-mono whitespace-pre-wrap break-all ${lineStyle}`}
                    >
                      <span className="text-slate-600 select-none mr-3 inline-block w-8 text-right text-[10px]">
                        {idx + 1}
                      </span>
                      {line}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
