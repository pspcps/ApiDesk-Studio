import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Check,
  Copy,
  AlertTriangle,
  RotateCw,
  Search,
  X,
  Sparkles,
  Terminal,
  ShieldCheck,
  ExternalLink,
  Layers,
  Code
} from 'lucide-react';

export interface InstalledPackageInfo {
  name: string;
  version: string;
  location: string;
  description?: string;
}

interface PackageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScriptContent?: string;
  onPackagesUpdated?: () => void;
}

const RECOMMENDED_PACKAGES = [
  {
    name: 'lodash',
    category: 'Utilities',
    description: 'Modular utilities for arrays, objects, deep cloning, and data formatting.',
    snippet: `const _ = require('lodash');`
  },
  {
    name: 'dayjs',
    category: 'Date & Time',
    description: 'Fast 2KB date/timestamp library for formatting, diffs, and relative times.',
    snippet: `const dayjs = require('dayjs');`
  },
  {
    name: 'uuid',
    category: 'Identity',
    description: 'RFC4122 UUID generator for unique request IDs, correlation IDs, and keys.',
    snippet: `const { v4: uuidv4 } = require('uuid');`
  },
  {
    name: 'jsonwebtoken',
    category: 'Auth & Security',
    description: 'Sign, verify, and decode JWT authentication bearer tokens.',
    snippet: `const jwt = require('jsonwebtoken');`
  },
  {
    name: 'zod',
    category: 'Validation',
    description: 'TypeScript-first schema validation for API response payloads.',
    snippet: `const { z } = require('zod');`
  },
  {
    name: '@faker-js/faker',
    category: 'Mock Data',
    description: 'Generate realistic mock data: names, emails, addresses, VIN numbers.',
    snippet: `const { faker } = require('@faker-js/faker');`
  },
  {
    name: 'cheerio',
    category: 'HTML / Parsing',
    description: 'Fast, flexible parsing and jQuery-like manipulation for HTML responses.',
    snippet: `const cheerio = require('cheerio');`
  },
  {
    name: 'crypto-js',
    category: 'Cryptography',
    description: 'MD5, SHA-256, HMAC, and AES encryption for security header tests.',
    snippet: `const CryptoJS = require('crypto-js');`
  },
  {
    name: 'qs',
    category: 'Network',
    description: 'A querystring parsing and stringifying library with nested object support.',
    snippet: `const qs = require('qs');`
  },
  {
    name: 'p-limit',
    category: 'Concurrency',
    description: 'Run multiple asynchronous API requests with custom concurrency limits.',
    snippet: `const pLimit = require('p-limit');`
  },
  {
    name: 'dotenv',
    category: 'Config',
    description: 'Parse and load custom configuration and environment variables from .env files.',
    snippet: `const dotenv = require('dotenv');`
  },
  {
    name: 'chalk',
    category: 'CLI Styling',
    description: 'Terminal string styling with bright ANSI colors for test output.',
    snippet: `const chalk = require('chalk');`
  }
];

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({
  isOpen,
  onClose,
  currentScriptContent = '',
  onPackagesUpdated
}) => {
  const [packages, setPackages] = useState<InstalledPackageInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installInput, setInstallInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'installed' | 'recommended'>('installed');
  
  // Terminal logs
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalError, setTerminalError] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Script dependency scan state
  const [detectedPackages, setDetectedPackages] = useState<string[]>([]);
  const [installedDeps, setInstalledDeps] = useState<string[]>([]);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);

  // Fetch installed packages from server
  const fetchPackages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.packages)) {
          setPackages(data.packages);
        }
      }
    } catch (e) {
      console.error('Failed to fetch installed packages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Scan current script for dependencies
  const scanScriptDependencies = async () => {
    if (!currentScriptContent || !currentScriptContent.trim()) {
      setDetectedPackages([]);
      setInstalledDeps([]);
      setMissingDeps([]);
      return;
    }

    try {
      const res = await fetch('/api/packages/scan-dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptContent: currentScriptContent })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDetectedPackages(data.detectedPackages || []);
          setInstalledDeps(data.installedPackages || []);
          setMissingDeps(data.missingPackages || []);
        }
      }
    } catch (e) {
      console.error('Failed to scan dependencies:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPackages();
      scanScriptDependencies();
      setNotification(null);
    }
  }, [isOpen, currentScriptContent]);

  // Install package(s)
  const handleInstall = async (pkgNames: string[] | string) => {
    setIsInstalling(true);
    setShowTerminal(true);
    setTerminalOutput(`⚡ Starting npm install for: ${Array.isArray(pkgNames) ? pkgNames.join(', ') : pkgNames}...\n`);
    setTerminalError('');
    setNotification(null);

    try {
      const res = await fetch('/api/packages/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: pkgNames })
      });

      const data = await res.json();
      if (data.success) {
        setTerminalOutput(prev => prev + (data.stdout || '') + `\n✅ ${data.message} (${data.executionTimeMs}ms)`);
        setNotification({ type: 'success', message: data.message });
        if (data.packages) {
          setPackages(data.packages);
        } else {
          fetchPackages();
        }
        setInstallInput('');
        scanScriptDependencies();
        onPackagesUpdated?.();
      } else {
        setTerminalError(data.detail || data.error || 'Installation failed');
        setNotification({ type: 'error', message: data.error || 'Installation failed' });
      }
    } catch (err: any) {
      setTerminalError(err.message || 'Network error during installation');
      setNotification({ type: 'error', message: 'Failed to connect to package installer server' });
    } finally {
      setIsInstalling(false);
    }
  };

  // Uninstall package
  const handleUninstall = async (packageName: string) => {
    if (!window.confirm(`Are you sure you want to uninstall "${packageName}"?`)) {
      return;
    }

    setIsInstalling(true);
    setShowTerminal(true);
    setTerminalOutput(`🗑️ Starting npm uninstall for ${packageName}...\n`);
    setTerminalError('');

    try {
      const res = await fetch('/api/packages/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName })
      });

      const data = await res.json();
      if (data.success) {
        setTerminalOutput(prev => prev + (data.stdout || '') + `\n✅ ${data.message}`);
        setNotification({ type: 'success', message: data.message });
        if (data.packages) {
          setPackages(data.packages);
        } else {
          fetchPackages();
        }
        scanScriptDependencies();
        onPackagesUpdated?.();
      } else {
        setTerminalError(data.detail || data.error || 'Uninstall failed');
        setNotification({ type: 'error', message: data.error || 'Uninstall failed' });
      }
    } catch (err: any) {
      setTerminalError(err.message || 'Network error during uninstall');
      setNotification({ type: 'error', message: 'Failed to uninstall package' });
    } finally {
      setIsInstalling(false);
    }
  };

  // Copy snippet
  const handleCopySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  // Filtered packages
  const filteredPackages = useMemo(() => {
    if (!searchFilter.trim()) return packages;
    const query = searchFilter.toLowerCase();
    return packages.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        p.version.toLowerCase().includes(query)
    );
  }, [packages, searchFilter]);

  const installedNamesSet = useMemo(() => {
    return new Set(packages.map(p => p.name));
  }, [packages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  NPM Package Manager for Test Scripts
                </h2>
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                  {packages.length} installed
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Install and manage npm libraries directly in your test execution environment for use with <code className="text-sky-300">require(&apos;package&apos;)</code> or <code className="text-sky-300">import</code>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Script Dependency Detector Banner */}
        {detectedPackages.length > 0 && (
          <div className={`px-5 py-3 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
            missingDeps.length > 0 
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' 
              : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold">
                {missingDeps.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>Active Script Dependencies:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {detectedPackages.map(pkg => {
                  const isMissing = missingDeps.includes(pkg);
                  return (
                    <span
                      key={pkg}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium flex items-center gap-1 border ${
                        isMissing
                          ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                      }`}
                    >
                      {isMissing ? '❌' : '✅'} {pkg}
                    </span>
                  );
                })}
              </div>
            </div>

            {missingDeps.length > 0 && (
              <button
                type="button"
                onClick={() => handleInstall(missingDeps)}
                disabled={isInstalling}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isInstalling ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Install Missing ({missingDeps.length})</span>
              </button>
            )}
          </div>
        )}

        {/* Notification Toast */}
        {notification && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Install Input Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/30">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
            Install NPM Packages
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (installInput.trim() && !isInstalling) {
                handleInstall(installInput);
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Package className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={installInput}
                onChange={(e) => setInstallInput(e.target.value)}
                placeholder="e.g. lodash, dayjs@latest, jsonwebtoken, zod, @faker-js/faker"
                disabled={isInstalling}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isInstalling || !installInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isInstalling ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Install</span>
                </>
              )}
            </button>
          </form>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Supports single or multiple comma-separated packages with optional version tags (e.g. <code className="text-slate-400">lodash, dayjs@^1.11.0, zod</code>).
          </p>
        </div>

        {/* Navigation Tabs & Search */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('installed')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'installed'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Installed Packages ({packages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recommended')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'recommended'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Popular Testing Packages ({RECOMMENDED_PACKAGES.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'installed' && (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
                <input
                  type="text"
                  placeholder="Filter installed..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none w-44 sm:w-56"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchPackages()}
              disabled={isLoading}
              title="Refresh package catalog"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'installed' && (
            <div>
              {isLoading && packages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <RotateCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
                  <p className="text-xs">Loading installed packages catalog...</p>
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="text-center py-16 text-slate-500 flex flex-col items-center">
                  <Package className="w-12 h-12 text-slate-700 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No packages found</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    {searchFilter
                      ? `No installed packages matched "${searchFilter}".`
                      : 'You haven’t installed any extra packages yet. Use the install bar above or pick from Popular Testing Packages.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredPackages.map((pkg) => {
                    const isCustom = pkg.location.includes('custom');
                    const requireCode = `const ${pkg.name.replace(/[^a-zA-Z0-9_$]/g, '_')} = require('${pkg.name}');`;
                    return (
                      <div
                        key={pkg.name}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:border-slate-700 transition group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="font-mono text-xs font-bold text-white truncate">
                                {pkg.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-800/80 shrink-0">
                                v{pkg.version}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                isCustom
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                  : 'bg-slate-850 text-slate-400 border border-slate-750'
                              }`}>
                                {isCustom ? 'Runner Custom' : 'Core Workspace'}
                              </span>

                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleUninstall(pkg.name)}
                                  disabled={isInstalling}
                                  title="Uninstall package"
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {pkg.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                              {pkg.description}
                            </p>
                          )}
                        </div>

                        {/* Code snippet helper */}
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                          <code className="text-[10px] font-mono text-slate-400 truncate bg-slate-900 px-2 py-1 rounded flex-1">
                            {requireCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopySnippet(requireCode, pkg.name)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-medium text-slate-300 border border-slate-800 transition shrink-0 cursor-pointer"
                            title="Copy require statement"
                          >
                            {copiedSnippet === pkg.name ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommended' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {RECOMMENDED_PACKAGES.map((rec) => {
                const isInstalled = installedNamesSet.has(rec.name);
                return (
                  <div
                    key={rec.name}
                    className={`rounded-xl p-4 border flex flex-col justify-between gap-3 transition ${
                      isInstalled
                        ? 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {rec.name}
                          </span>
                          <span className="text-[10px] bg-slate-850 text-slate-400 border border-slate-750 px-1.5 py-0.2 rounded font-medium">
                            {rec.category}
                          </span>
                        </div>

                        {isInstalled ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            Installed
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstall(rec.name)}
                            disabled={isInstalling}
                            className="flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Install</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">
                        {rec.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                      <code className="text-[10px] font-mono text-slate-400 truncate bg-slate-900 px-2 py-1 rounded flex-1">
                        {rec.snippet}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(rec.snippet, rec.name)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-medium text-slate-300 border border-slate-800 transition shrink-0 cursor-pointer"
                      >
                        {copiedSnippet === rec.name ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapsible Terminal Output Drawer */}
        {(showTerminal || terminalOutput || terminalError) && (
          <div className="border-t border-slate-800 bg-slate-950 p-3 max-h-48 overflow-y-auto font-mono text-[11px]">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-slate-400 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>NPM Command Output</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminal(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Hide
              </button>
            </div>
            {terminalOutput && (
              <pre className="text-emerald-400/90 whitespace-pre-wrap leading-relaxed mt-1">
                {terminalOutput}
              </pre>
            )}
            {terminalError && (
              <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed mt-1">
                {terminalError}
              </pre>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950/70 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>NPM Runner Runtime Ready (Node v22)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
