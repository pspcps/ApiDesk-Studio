import React, { useState } from 'react';
import { 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Building2, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Sparkles,
  Globe
} from 'lucide-react';
import { CopyButton } from './CopyButton';

interface FeatureToggleItem {
  id: string;
  category: string;
  feature: string;
  service: string;
  description: string;
  globalEnabled: boolean;
  enabledTenants: string[];
  updatedAt: string;
}

interface TenantCompany {
  id: string;
  name: string;
  tier: 'Enterprise' | 'Growth' | 'Standard';
  region: string;
  status: 'Active' | 'Trial';
  activeOverridesCount: number;
}

const SAMPLE_TOGGLES: FeatureToggleItem[] = [
  {
    id: 'ft_1',
    category: 'checkout',
    feature: 'enable-instant-settlement-v2',
    service: 'payment-ledger-service',
    description: 'Enables real-time multi-currency settlement pipeline for eligible tenants',
    globalEnabled: false,
    enabledTenants: ['tenant_acme_01', 'tenant_globex_02'],
    updatedAt: '2026-10-01'
  },
  {
    id: 'ft_2',
    category: 'security',
    feature: 'enforce-strict-mtls-gateway',
    service: 'gateway-router-service',
    description: 'Enforces mutual TLS certificate verification on edge webhook routes',
    globalEnabled: true,
    enabledTenants: ['tenant_acme_01', 'tenant_globex_02', 'tenant_initech_03', 'tenant_umbrella_04'],
    updatedAt: '2026-09-28'
  },
  {
    id: 'ft_3',
    category: 'analytics',
    feature: 'stream-clickhouse-rollup',
    service: 'stream-aggregator',
    description: 'Routes high-volume telemetry events to real-time OLAP rollup tables',
    globalEnabled: false,
    enabledTenants: ['tenant_acme_01'],
    updatedAt: '2026-10-02'
  },
  {
    id: 'ft_4',
    category: 'identity',
    feature: 'passkey-webauthn-login',
    service: 'identity-auth-service',
    description: 'Allows passwordless FIDO2 WebAuthn passkey enrollment and sign-in',
    globalEnabled: true,
    enabledTenants: ['tenant_acme_01', 'tenant_globex_02', 'tenant_initech_03'],
    updatedAt: '2026-09-25'
  }
];

const SAMPLE_COMPANIES: TenantCompany[] = [
  { id: 'tenant_acme_01', name: 'Acme Global Industries', tier: 'Enterprise', region: 'us-east-1', status: 'Active', activeOverridesCount: 4 },
  { id: 'tenant_globex_02', name: 'Globex Corporation', tier: 'Enterprise', region: 'eu-west-1', status: 'Active', activeOverridesCount: 3 },
  { id: 'tenant_initech_03', name: 'Initech Cloud Systems', tier: 'Growth', region: 'us-west-2', status: 'Active', activeOverridesCount: 2 },
  { id: 'tenant_umbrella_04', name: 'Umbrella Logistics Group', tier: 'Standard', region: 'ap-southeast-1', status: 'Trial', activeOverridesCount: 1 }
];

export const FeatureToggleView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'toggles' | 'companies'>('toggles');
  const [environment, setEnvironment] = useState<'dev' | 'stage' | 'prod'>('dev');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [globalOnOnly, setGlobalOnOnly] = useState(false);

  const [toggles, setToggles] = useState<FeatureToggleItem[]>(SAMPLE_TOGGLES);
  const [selectedToggleId, setSelectedToggleId] = useState<string>(SAMPLE_TOGGLES[0].id);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(SAMPLE_COMPANIES[0].id);

  // Auth / Token Generator Drawer
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bearerToken, setBearerToken] = useState<string>(() => localStorage.getItem(`apidesk_ft_token_${environment}`) || '');
  const [tokenUrl, setTokenUrl] = useState<string>('https://api.example.com/v1/auth/token');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const servicesList = ['ALL', ...Array.from(new Set(toggles.map(t => t.service)))];

  const filteredToggles = toggles.filter(t => {
    if (serviceFilter !== 'ALL' && t.service !== serviceFilter) return false;
    if (globalOnOnly && !t.globalEnabled) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.feature.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.service.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredCompanies = SAMPLE_COMPANIES.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.region.toLowerCase().includes(q);
  });

  const selectedToggle = toggles.find(t => t.id === selectedToggleId) || toggles[0];
  const selectedCompany = SAMPLE_COMPANIES.find(c => c.id === selectedCompanyId) || SAMPLE_COMPANIES[0];

  const handleToggleGlobalState = (id: string) => {
    setToggles(prev =>
      prev.map(t => (t.id === id ? { ...t, globalEnabled: !t.globalEnabled } : t))
    );
  };

  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tokenUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
      });
      const json = await res.json();
      const extracted =
        json?.data?.token ||
        json?.data?.accessToken ||
        json?.data?.jwt ||
        `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ env: environment, user: username || 'dev', iat: Date.now() }))}`;
      setBearerToken(extracted);
      localStorage.setItem(`apidesk_ft_token_${environment}`, extracted);
    } catch {
      const fallback = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ env: environment, iat: Date.now() }))}`;
      setBearerToken(fallback);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ToggleRight className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Feature Toggles</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                Global Flags &amp; Tenant Overrides
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Inspect global feature flags and per-company/tenant overrides across DEV, STAGE, and PROD environments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Environment Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['dev', 'stage', 'prod'] as const).map(env => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                className={`px-3 py-1 rounded font-bold uppercase font-mono transition ${
                  environment === env ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {env}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAuthModal(!showAuthModal)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Bearer Token {bearerToken ? '✓' : ''}</span>
          </button>
        </div>
      </div>

      {/* Token Drawer */}
      {showAuthModal && (
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            value={bearerToken}
            onChange={(e) => {
              setBearerToken(e.target.value);
              localStorage.setItem(`apidesk_ft_token_${environment}`, e.target.value);
            }}
            placeholder="Paste Bearer Token or generate below..."
            className="flex-1 min-w-[240px] bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-200"
          />
          <input
            type="text"
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder="Token Endpoint URL"
            className="w-56 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-300"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-32 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-32 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
          />
          <button
            type="button"
            onClick={handleGenerateToken}
            disabled={isGeneratingToken}
            className="px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold"
          >
            {isGeneratingToken ? 'Generating...' : 'Auto-Generate Token'}
          </button>
        </div>
      )}

      {/* Sub-Tabs & Filters */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('toggles')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'toggles' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ToggleRight className="w-4 h-4" />
            <span>Feature Toggles ({toggles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'companies' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Companies / Tenants ({SAMPLE_COMPANIES.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'toggles' ? 'Search feature flags, categories, services...' : 'Search companies or tenant IDs...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {activeTab === 'toggles' && (
            <>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                {servicesList.map(s => (
                  <option key={s} value={s}>{s === 'ALL' ? 'All Services' : s}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={globalOnOnly}
                  onChange={(e) => setGlobalOnOnly(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-teal-500"
                />
                <span>Global ON Only</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'toggles' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Feature Toggles List */}
            <div className="lg:col-span-2 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 divide-y divide-slate-800">
              {filteredToggles.map(ft => (
                <div
                  key={ft.id}
                  onClick={() => setSelectedToggleId(ft.id)}
                  className={`p-4 hover:bg-slate-800/40 cursor-pointer transition flex items-center justify-between gap-4 ${
                    selectedToggleId === ft.id ? 'bg-teal-950/20' : ''
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                        {ft.category}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{ft.feature}</span>
                      <span className="text-[11px] text-slate-500 font-mono">({ft.service})</span>
                    </div>
                    <p className="text-xs text-slate-400">{ft.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {ft.enabledTenants.length} tenants
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleGlobalState(ft.id);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 border transition ${
                        ft.globalEnabled
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {ft.globalEnabled ? 'GLOBAL ON' : 'TENANT SCOPED'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Col: Selected Toggle Details & Enabled Companies */}
            {selectedToggle && (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-teal-400">{selectedToggle.category}</span>
                    <h3 className="text-sm font-bold text-white font-mono">{selectedToggle.feature}</h3>
                  </div>
                  <CopyButton text={JSON.stringify(selectedToggle, null, 2)} label="Copy JSON" />
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">{selectedToggle.description}</div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Enabled Companies / Tenants ({selectedToggle.enabledTenants.length})
                  </span>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    {selectedToggle.enabledTenants.map(tid => {
                      const comp = SAMPLE_COMPANIES.find(c => c.id === tid);
                      return (
                        <div key={tid} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">{comp?.name || tid}</span>
                            <span className="font-mono text-[10px] text-slate-500">{tid}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                            OVERRIDE ON
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 divide-y divide-slate-800">
              {filteredCompanies.map(comp => (
                <div
                  key={comp.id}
                  onClick={() => setSelectedCompanyId(comp.id)}
                  className={`p-4 hover:bg-slate-800/40 cursor-pointer transition flex items-center justify-between ${
                    selectedCompanyId === comp.id ? 'bg-teal-950/20' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{comp.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">ID: {comp.id} • Region: {comp.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {comp.tier}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                      {comp.activeOverridesCount} flags enabled
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedCompany && (
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-teal-400">{selectedCompany.tier} Tenant</span>
                    <h3 className="text-sm font-bold text-white">{selectedCompany.name}</h3>
                  </div>
                  <CopyButton text={JSON.stringify(selectedCompany, null, 2)} label="Copy" />
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Tenant ID:</span>
                    <span className="font-mono text-slate-200">{selectedCompany.id}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Cloud Region:</span>
                    <span className="font-mono text-slate-200">{selectedCompany.region}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Account Status:</span>
                    <span className="text-emerald-400 font-semibold">{selectedCompany.status}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
