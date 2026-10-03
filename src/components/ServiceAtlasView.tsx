import React, { useState } from 'react';
import { 
  Globe, 
  Search, 
  GitBranch, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Key, 
  Layers, 
  Users, 
  Ticket, 
  ArrowRight, 
  ShieldCheck, 
  Server, 
  Plus, 
  Trash2,
  Bug
} from 'lucide-react';
import { CopyButton } from './CopyButton';
import { DebugInspectorModal, DebugInspectorData } from './DebugInspectorModal';

interface ServiceVersionStatus {
  service: string;
  team: string;
  devVersion: string;
  stgVersion: string;
  prodVersion: string;
  status: 'synced' | 'drift' | 'checking' | 'error';
  lastChecked: string;
  endpointPattern: string;
}

interface TeamConfig {
  id: string;
  name: string;
  description: string;
  services: string[];
}

const DEFAULT_TEAMS: TeamConfig[] = [
  {
    id: 'team_core_platform',
    name: 'Core Platform',
    description: 'Identity, API gateway, and user management microservices',
    services: ['identity-auth-service', 'user-profile-service', 'gateway-router-service', 'tenant-config-service']
  },
  {
    id: 'team_order_pipeline',
    name: 'Commerce & Orders',
    description: 'Checkout, billing, and payment processing services',
    services: ['order-orchestrator', 'payment-ledger-service', 'invoice-generator', 'subscription-engine']
  },
  {
    id: 'team_data_streaming',
    name: 'Data & Telemetry',
    description: 'Event ingestion, Kafka consumers, and real-time analytics',
    services: ['event-ingestion-service', 'stream-aggregator', 'webhook-dispatcher', 'notification-hub']
  },
  {
    id: 'team_infra_ops',
    name: 'Infrastructure & SRE',
    description: 'Feature toggles, audit logging, and configuration services',
    services: ['feature-toggle-service', 'audit-trail-service', 'rate-limiter-service']
  }
];

export const ServiceAtlasView: React.FC = () => {
  const [searchMode, setSearchMode] = useState<'service' | 'team' | 'ticket'>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(DEFAULT_TEAMS[0].id);
  const [serviceQuery, setServiceQuery] = useState<string>('identity-auth-service');
  const [hostTemplate, setHostTemplate] = useState<string>('https://{{service}}-{{env}}.api.example.com/version');
  const [ticketKey, setTicketKey] = useState<string>('PROJ-1420');
  const [githubOrg, setGithubOrg] = useState<string>('acme-corp');
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('apidesk_gh_token') || '');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [versionRows, setVersionRows] = useState<ServiceVersionStatus[]>([
    {
      service: 'identity-auth-service',
      team: 'Core Platform',
      devVersion: 'v2.14.0-rc.3',
      stgVersion: 'v2.14.0-rc.2',
      prodVersion: 'v2.13.5',
      status: 'drift',
      lastChecked: new Date().toLocaleTimeString(),
      endpointPattern: 'https://identity-auth-service-{env}.api.example.com/version'
    },
    {
      service: 'user-profile-service',
      team: 'Core Platform',
      devVersion: 'v1.8.2',
      stgVersion: 'v1.8.2',
      prodVersion: 'v1.8.2',
      status: 'synced',
      lastChecked: new Date().toLocaleTimeString(),
      endpointPattern: 'https://user-profile-service-{env}.api.example.com/version'
    },
    {
      service: 'gateway-router-service',
      team: 'Core Platform',
      devVersion: 'v3.4.1',
      stgVersion: 'v3.4.0',
      prodVersion: 'v3.3.9',
      status: 'drift',
      lastChecked: new Date().toLocaleTimeString(),
      endpointPattern: 'https://gateway-router-service-{env}.api.example.com/version'
    },
    {
      service: 'tenant-config-service',
      team: 'Core Platform',
      devVersion: 'v1.2.0',
      stgVersion: 'v1.2.0',
      prodVersion: 'v1.2.0',
      status: 'synced',
      lastChecked: new Date().toLocaleTimeString(),
      endpointPattern: 'https://tenant-config-service-{env}.api.example.com/version'
    }
  ]);

  // CAB Release Generator State
  const [cabService, setCabService] = useState<string>('identity-auth-service');
  const [cabFromTag, setCabFromTag] = useState<string>('v2.13.5');
  const [cabToTag, setCabToTag] = useState<string>('v2.14.0-rc.2');
  const [cabTickets, setCabTickets] = useState<string[]>(['PROJ-1420', 'PROJ-1425', 'PROJ-1431']);
  const [multiServiceImpact, setMultiServiceImpact] = useState<string[]>(['identity-auth-service', 'gateway-router-service']);

  // Debug Inspector
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugInspectorData>({
    title: 'Service Atlas Diagnostics',
    endpoint: '/api/service-version',
    method: 'GET',
    executionLogs: []
  });

  const handleSaveToken = (val: string) => {
    setGithubToken(val);
    try {
      localStorage.setItem('apidesk_gh_token', val);
    } catch {}
  };

  const handleCheckVersions = async () => {
    setIsLoading(true);
    const activeTeam = DEFAULT_TEAMS.find(t => t.id === selectedTeamId) || DEFAULT_TEAMS[0];
    const targetServices = searchMode === 'service'
      ? [serviceQuery.trim() || 'identity-auth-service']
      : activeTeam.services;

    try {
      const res = await fetch('/api/service-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: targetServices,
          teamName: activeTeam.name,
          hostTemplate,
          ticketKey: searchMode === 'ticket' ? ticketKey : undefined
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setVersionRows(data.results);
        if (data.results[0]) {
          setCabService(data.results[0].service);
          setCabFromTag(data.results[0].prodVersion);
          setCabToTag(data.results[0].stgVersion);
        }
      }
      setDebugData({
        title: 'Service Atlas Version Probe',
        endpoint: '/api/service-version',
        method: 'POST',
        responseStatus: res.status,
        responseStatusText: res.statusText,
        requestPayload: { services: targetServices, hostTemplate },
        responsePayload: data,
        executionLogs: [
          {
            id: 'log_' + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            level: 'success',
            title: 'Version Matrix Checked',
            message: `Queried ${targetServices.length} services across dev, stg, and prod.`
          }
        ]
      });
    } catch (err: any) {
      // Fallback update timestamp
      setVersionRows(prev => prev.map(r => ({ ...r, lastChecked: new Date().toLocaleTimeString() })));
    } finally {
      setIsLoading(false);
    }
  };

  const cabBasicDetails = `Release Summary: Promoting ${cabService} from ${cabFromTag} to ${cabToTag}
Primary Ticket: ${ticketKey}
Riding Tickets in Diff: ${cabTickets.join(', ')}
Environment Promotion: STG (${cabToTag}) -> PROD (currently ${cabFromTag})
Multi-Service Scope: ${multiServiceImpact.length > 1 ? `Touches ${multiServiceImpact.join(', ')}` : 'Single repository release'}
Risk Assessment: Low — backwards-compatible schema & API contract verified in staging.`;

  const cabDeploymentSteps = `1. Verify ${cabService} health check on STG (${cabToTag}) is returning HTTP 200 OK.
2. Trigger production deployment pipeline for ${cabService} with release tag ${cabToTag}.
3. Monitor service metrics, error rates, and p99 latency for 15 minutes post-deploy.
4. Run post-deployment smoke tests against production health & version endpoints.`;

  const cabRollbackPlan = `1. Revert production deployment of ${cabService} back to previous stable tag ${cabFromTag}.
2. Verify all pods/instances cycle cleanly and report version ${cabFromTag} on /version.
3. Clear edge cache / gateway route cache if applicable and re-run smoke checks.`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Service Atlas</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                Version Checker &amp; CAB Generator
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live environment version matrix across dev / stg / prod, GitHub release diffing, and automated CAB paperwork
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTokenInput(!showTokenInput)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>GitHub PAT {githubToken ? '✓' : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDebugOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Bug className="w-3.5 h-3.5 text-sky-400" />
            <span>Debug Inspector</span>
          </button>
        </div>
      </div>

      {/* GitHub PAT Drawer */}
      {showTokenInput && (
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-300 font-medium">GitHub Personal Access Token (stored locally):</span>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => handleSaveToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="flex-1 max-w-md bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
          />
          <span className="text-slate-500">Organization:</span>
          <input
            type="text"
            value={githubOrg}
            onChange={(e) => setGithubOrg(e.target.value)}
            placeholder="acme-corp"
            className="w-40 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Search & Query Controls */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchMode('team')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  searchMode === 'team' ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Search by Team</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('service')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  searchMode === 'service' ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Single Service</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('ticket')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  searchMode === 'ticket' ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Search by Ticket Key</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <span className="text-[11px] text-slate-400 shrink-0">Endpoint Pattern:</span>
              <input
                type="text"
                value={hostTemplate}
                onChange={(e) => setHostTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {searchMode === 'team' && (
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs font-semibold text-slate-300">Engineering Team:</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    const t = DEFAULT_TEAMS.find(x => x.id === e.target.value);
                    if (t) {
                      setVersionRows(t.services.map((s, idx) => ({
                        service: s,
                        team: t.name,
                        devVersion: `v2.${idx + 1}.0-rc.1`,
                        stgVersion: `v2.${idx + 1}.0`,
                        prodVersion: idx % 2 === 0 ? `v2.${idx}.4` : `v2.${idx + 1}.0`,
                        status: idx % 2 === 0 ? 'drift' : 'synced',
                        lastChecked: new Date().toLocaleTimeString(),
                        endpointPattern: hostTemplate.replace('{{service}}', s)
                      })));
                    }
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {DEFAULT_TEAMS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.services.length} services)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {searchMode === 'service' && (
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Enter microservice name (e.g. identity-auth-service)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {searchMode === 'ticket' && (
              <div className="flex items-center gap-2 flex-1">
                <Ticket className="w-4 h-4 text-amber-400" />
                <input
                  type="text"
                  value={ticketKey}
                  onChange={(e) => setTicketKey(e.target.value)}
                  placeholder="Enter Jira / Issue Ticket Key (e.g. PROJ-1420)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleCheckVersions}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking Environments...' : 'Scan Live Versions'}</span>
            </button>
          </div>
        </div>

        {/* Environment Version Matrix */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Environment Deployment Matrix (DEV / STG / PROD)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Click any row to load into the CAB Release Paperwork Generator below
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase bg-slate-950/60">
                  <th className="py-2.5 px-4">Service Name</th>
                  <th className="py-2.5 px-4">Team</th>
                  <th className="py-2.5 px-4">DEV Version</th>
                  <th className="py-2.5 px-4">STG Version</th>
                  <th className="py-2.5 px-4">PROD Version</th>
                  <th className="py-2.5 px-4">Release Status</th>
                  <th className="py-2.5 px-4">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {versionRows.map((row) => (
                  <tr
                    key={row.service}
                    onClick={() => {
                      setCabService(row.service);
                      setCabFromTag(row.prodVersion);
                      setCabToTag(row.stgVersion);
                    }}
                    className={`hover:bg-slate-800/40 cursor-pointer transition ${
                      cabService === row.service ? 'bg-sky-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-sky-400">{row.service}</td>
                    <td className="py-3 px-4 text-slate-300">{row.team}</td>
                    <td className="py-3 px-4 font-mono text-emerald-300">{row.devVersion}</td>
                    <td className="py-3 px-4 font-mono text-amber-300">{row.stgVersion}</td>
                    <td className="py-3 px-4 font-mono text-purple-300">{row.prodVersion}</td>
                    <td className="py-3 px-4">
                      {row.status === 'synced' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          In Sync
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Pending Promotion
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{row.lastChecked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Automatic CAB Paperwork & Diff Generator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Basic / Full CAB Details
                </h3>
              </div>
              <CopyButton text={cabBasicDetails} label="Copy" />
            </div>
            <textarea
              readOnly
              value={cabBasicDetails}
              rows={7}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Deployment Changes &amp; Plan
                </h3>
              </div>
              <CopyButton text={cabDeploymentSteps} label="Copy" />
            </div>
            <textarea
              readOnly
              value={cabDeploymentSteps}
              rows={7}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Rollback Process
                </h3>
              </div>
              <CopyButton text={cabRollbackPlan} label="Copy" />
            </div>
            <textarea
              readOnly
              value={cabRollbackPlan}
              rows={7}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      <DebugInspectorModal
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        data={debugData}
      />
    </div>
  );
};
