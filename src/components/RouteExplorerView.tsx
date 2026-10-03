import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Upload, 
  Search, 
  Send, 
  Terminal, 
  Trash2, 
  FileJson, 
  Plus, 
  Sparkles, 
  Check, 
  Copy,
  Globe
} from 'lucide-react';
import { ApiRequest, HttpMethod } from '../types';
import { MethodBadge } from './MethodBadge';
import { copyToClipboard } from '../utils/clipboard';

export interface CatalogRouteItem {
  id: string;
  specName: string;
  method: HttpMethod;
  path: string;
  baseUrl: string;
  summary: string;
  tags: string[];
  sampleBody?: string;
  headers?: Record<string, string>;
}

interface CustomSpecRecord {
  id: string;
  name: string;
  baseUrl: string;
  uploadedAt: number;
  routes: CatalogRouteItem[];
}

interface RouteExplorerViewProps {
  onSendRouteToClient: (partialReq: Partial<ApiRequest>) => void;
}

const CUSTOM_SPECS_STORAGE_KEY = 'apidesk_custom_specs_v1';

const STARTER_CUSTOM_SPEC: CustomSpecRecord = {
  id: 'spec_starter_sample',
  name: 'Sample Customer REST API (OpenAPI 3.0)',
  baseUrl: 'https://jsonplaceholder.typicode.com',
  uploadedAt: Date.now(),
  routes: [
    {
      id: 'r_users_list',
      specName: 'Sample Customer REST API (OpenAPI 3.0)',
      method: 'GET',
      path: '/users',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      summary: 'List all registered customer profiles',
      tags: ['Users']
    },
    {
      id: 'r_users_create',
      specName: 'Sample Customer REST API (OpenAPI 3.0)',
      method: 'POST',
      path: '/users',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      summary: 'Create a new customer account record',
      tags: ['Users'],
      sampleBody: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com', role: 'customer' }, null, 2)
    },
    {
      id: 'r_posts_list',
      specName: 'Sample Customer REST API (OpenAPI 3.0)',
      method: 'GET',
      path: '/posts',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      summary: 'Fetch paginated customer activity posts',
      tags: ['Posts']
    },
    {
      id: 'r_todos_get',
      specName: 'Sample Customer REST API (OpenAPI 3.0)',
      method: 'GET',
      path: '/todos/1',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      summary: 'Get a specific customer task item by ID',
      tags: ['Tasks']
    }
  ]
};

function parseOpenApiSpecToRoutes(rawText: string, fallbackName: string): CustomSpecRecord {
  const parsed = JSON.parse(rawText);
  const specTitle = parsed?.info?.title || fallbackName || 'Custom OpenAPI Spec';
  const baseUrl = parsed?.servers?.[0]?.url || (parsed?.host ? `https://${parsed.host}${parsed.basePath || ''}` : 'https://api.example.com');
  const routes: CatalogRouteItem[] = [];

  if (parsed?.paths && typeof parsed.paths === 'object') {
    for (const [routePath, pathObj] of Object.entries<any>(parsed.paths)) {
      if (!pathObj || typeof pathObj !== 'object') continue;
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      for (const m of methods) {
        const op = pathObj[m.toLowerCase()];
        if (op) {
          let sampleBody: string | undefined;
          const jsonSchema = op?.requestBody?.content?.['application/json'];
          if (jsonSchema?.example) {
            sampleBody = JSON.stringify(jsonSchema.example, null, 2);
          } else if (jsonSchema?.schema?.example) {
            sampleBody = JSON.stringify(jsonSchema.schema.example, null, 2);
          }

          routes.push({
            id: `route_${Math.random().toString(36).substring(2, 9)}`,
            specName: specTitle,
            method: m,
            path: routePath,
            baseUrl,
            summary: op.summary || op.description || `${m} ${routePath}`,
            tags: Array.isArray(op.tags) ? op.tags : ['General'],
            sampleBody
          });
        }
      }
    }
  }

  return {
    id: `spec_${Date.now()}`,
    name: specTitle,
    baseUrl,
    uploadedAt: Date.now(),
    routes
  };
}

export const RouteExplorerView: React.FC<RouteExplorerViewProps> = ({ onSendRouteToClient }) => {
  const [customSpecs, setCustomSpecs] = useState<CustomSpecRecord[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SPECS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [STARTER_CUSTOM_SPEC];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedSpecId, setSelectedSpecId] = useState<string>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [rawSpecInput, setRawSpecInput] = useState('');
  const [specNameInput, setSpecNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const saveSpecs = (next: CustomSpecRecord[]) => {
    setCustomSpecs(next);
    try {
      localStorage.setItem(CUSTOM_SPECS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const allRoutes = useMemo(() => {
    return customSpecs.flatMap(spec =>
      spec.routes.map(r => ({
        ...r,
        specId: spec.id,
        specName: spec.name
      }))
    );
  }, [customSpecs]);

  const filteredRoutes = useMemo(() => {
    return allRoutes.filter(r => {
      if (selectedSpecId !== 'ALL' && r.specId !== selectedSpecId) return false;
      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPath = r.path.toLowerCase().includes(q);
        const matchSummary = r.summary.toLowerCase().includes(q);
        const matchSpec = r.specName.toLowerCase().includes(q);
        const matchTags = r.tags.some(t => t.toLowerCase().includes(q));
        return matchPath || matchSummary || matchSpec || matchTags;
      }
      return true;
    });
  }, [allRoutes, selectedSpecId, methodFilter, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const record = parseOpenApiSpecToRoutes(text, file.name.replace(/\.json$/i, ''));
      if (record.routes.length === 0) {
        setErrorMsg('No valid OpenAPI paths found in the uploaded file.');
        return;
      }
      saveSpecs([record, ...customSpecs]);
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setErrorMsg(`Failed to parse OpenAPI JSON spec: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handlePasteSpecImport = () => {
    if (!rawSpecInput.trim()) return;
    setErrorMsg(null);
    try {
      const record = parseOpenApiSpecToRoutes(rawSpecInput, specNameInput || 'Uploaded Customer Spec');
      if (record.routes.length === 0) {
        setErrorMsg('No valid paths object found in OpenAPI JSON.');
        return;
      }
      saveSpecs([record, ...customSpecs]);
      setRawSpecInput('');
      setSpecNameInput('');
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setErrorMsg(`Invalid JSON OpenAPI Spec: ${err.message}`);
    }
  };

  const handleDeleteSpec = (specId: string) => {
    const next = customSpecs.filter(s => s.id !== specId);
    saveSpecs(next);
    if (selectedSpecId === specId) setSelectedSpecId('ALL');
  };

  const handleCopyCurl = async (route: CatalogRouteItem) => {
    const fullUrl = `${route.baseUrl.replace(/\/$/, '')}${route.path}`;
    const bodyPart = route.sampleBody ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${route.sampleBody}'` : '';
    const curl = `curl -X ${route.method} '${fullUrl}'${bodyPart}`;
    await copyToClipboard(curl);
    setCopiedId(route.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleOpenInClient = (route: CatalogRouteItem) => {
    const fullUrl = `${route.baseUrl.replace(/\/$/, '')}${route.path}`;
    onSendRouteToClient({
      name: `${route.method} ${route.path}`,
      method: route.method,
      url: fullUrl,
      headers: [
        { id: 'h_1', key: 'Accept', value: 'application/json', enabled: true },
        ...(route.sampleBody ? [{ id: 'h_2', key: 'Content-Type', value: 'application/json', enabled: true }] : [])
      ],
      body: route.sampleBody
        ? { type: 'json', rawType: 'json', json: route.sampleBody }
        : { type: 'none' }
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Route Explorer</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Custom OpenAPI / Swagger Specs
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Upload your own OpenAPI / Swagger specifications to index, search, filter, and send routes directly to the API Client
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setIsUploadModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Custom OpenAPI Spec</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Spec Chips */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search routes by path, summary, tag, or spec name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono transition ${
                  methodFilter === m
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Uploaded Spec Selector Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Specs:</span>
          <button
            type="button"
            onClick={() => setSelectedSpecId('ALL')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              selectedSpecId === 'ALL'
                ? 'bg-sky-950 text-sky-300 border-sky-700'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            All Specs ({allRoutes.length})
          </button>

          {customSpecs.map(spec => (
            <div
              key={spec.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                selectedSpecId === spec.id
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedSpecId(spec.id)}
                className="flex items-center gap-1.5"
              >
                <FileJson className="w-3 h-3 text-emerald-400" />
                <span>{spec.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({spec.routes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSpec(spec.id)}
                className="text-slate-500 hover:text-rose-400 ml-1"
                title="Remove Spec"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Route Catalog List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 divide-y divide-slate-800/70">
          {filteredRoutes.map(route => (
            <div
              key={route.id}
              className="p-3.5 hover:bg-slate-800/40 transition flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <MethodBadge method={route.method} />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-100 break-all">
                      {route.path}
                    </span>
                    {route.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{route.summary}</span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {route.baseUrl}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyCurl(route)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  {copiedId === route.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied cURL</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy cURL</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenInClient(route)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open in API Client</span>
                </button>
              </div>
            </div>
          ))}

          {filteredRoutes.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center gap-3 text-slate-500">
              <Compass className="w-8 h-8 text-slate-600" />
              <div className="text-xs font-semibold text-slate-300">No matching routes found</div>
              <p className="text-xs text-slate-500 max-w-md">
                Upload your custom OpenAPI / Swagger JSON specification to explore and send endpoints directly.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Custom OpenAPI Spec Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Upload Custom OpenAPI / Swagger Spec</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700 text-rose-200">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-between p-4 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-200">Upload OpenAPI `.json` File from Computer</span>
                  <span className="text-[11px] text-slate-500">Supports OpenAPI 3.0+ and Swagger 2.0 JSON specifications</span>
                </div>
                <label className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-slate-300">Or Paste OpenAPI JSON Directly:</label>
                <input
                  type="text"
                  value={specNameInput}
                  onChange={(e) => setSpecNameInput(e.target.value)}
                  placeholder="Optional Spec Display Name (e.g. Payment Gateway API)"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <textarea
                  value={rawSpecInput}
                  onChange={(e) => setRawSpecInput(e.target.value)}
                  rows={8}
                  placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "Customer API", "version": "1.0.0" },\n  "servers": [{ "url": "https://api.example.com" }],\n  "paths": {\n    "/v1/customers": {\n      "get": { "summary": "List customers" }\n    }\n  }\n}'}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasteSpecImport}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Import Spec Routes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
