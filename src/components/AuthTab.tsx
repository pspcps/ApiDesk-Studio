import React from 'react';
import { AuthConfig, AuthType } from '../types';
import { Shield, Key, Lock, User, Info } from 'lucide-react';

interface AuthTabProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  hasParentCollection?: boolean;
}

export const AuthTab: React.FC<AuthTabProps> = ({ auth, onChange, hasParentCollection = false }) => {
  const handleTypeChange = (type: AuthType) => {
    onChange({
      ...auth,
      type
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 bg-slate-900/30 rounded-lg border border-slate-800/80">
      {/* Left Sidebar for Auth Type Selection */}
      <div className="w-full md:w-48 flex flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-800 pb-4 md:pb-0 md:pr-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Auth Type</span>
        
        {hasParentCollection && (
          <button
            type="button"
            onClick={() => handleTypeChange('inherit')}
            className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
              auth.type === 'inherit' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Inherit from Collection
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTypeChange('none')}
          className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
            auth.type === 'none' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          No Auth
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('bearer')}
          className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
            auth.type === 'bearer' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Bearer Token
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('basic')}
          className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
            auth.type === 'basic' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Basic Auth
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('apikey')}
          className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
            auth.type === 'apikey' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          API Key
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('oauth2')}
          className={`text-left px-3 py-2 rounded text-xs transition flex items-center gap-2 ${
            auth.type === 'oauth2' ? 'bg-sky-600/20 text-sky-400 font-medium border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          OAuth 2.0 (Bearer)
        </button>
      </div>

      {/* Right Settings Configuration Area */}
      <div className="flex-1">
        {auth.type === 'none' && (
          <div className="flex items-center gap-3 p-4 bg-slate-950/40 rounded border border-slate-800/60 text-slate-400 text-xs">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>This request does not use any authentication credentials.</span>
          </div>
        )}

        {auth.type === 'inherit' && (
          <div className="flex items-center gap-3 p-4 bg-sky-950/20 rounded border border-sky-800/40 text-sky-300 text-xs">
            <Shield className="w-4 h-4 text-sky-400 shrink-0" />
            <span>This request will inherit the authorization headers and tokens configured on the parent Collection.</span>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div className="flex flex-col gap-4 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Bearer Token</label>
              <textarea
                value={auth.bearerToken || ''}
                onChange={(e) => onChange({ ...auth, bearerToken: e.target.value })}
                placeholder="eyJh... or {{token}}"
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded p-2.5 font-mono text-xs text-slate-200 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">
                Supports environment variables like <code className="text-sky-400">{'{{token}}'}</code> or <code className="text-sky-400">{'{{apiKey}}'}</code>.
              </span>
            </div>
          </div>
        )}

        {auth.type === 'basic' && (
          <div className="flex flex-col gap-3 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Username</label>
              <input
                type="text"
                value={auth.basicUser || ''}
                onChange={(e) => onChange({ ...auth, basicUser: e.target.value })}
                placeholder="admin or {{username}}"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <input
                type="password"
                value={auth.basicPass || ''}
                onChange={(e) => onChange({ ...auth, basicPass: e.target.value })}
                placeholder="•••••••• or {{password}}"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <span className="text-[11px] text-slate-500">
              Basic auth will encode the credentials to Base64 in the <code className="text-slate-400">Authorization: Basic ...</code> header.
            </span>
          </div>
        )}

        {auth.type === 'apikey' && (
          <div className="flex flex-col gap-3 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Key Name</label>
              <input
                type="text"
                value={auth.apiKeyName || ''}
                onChange={(e) => onChange({ ...auth, apiKeyName: e.target.value })}
                placeholder="X-API-Key or api_key"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Key Value</label>
              <input
                type="text"
                value={auth.apiKeyValue || ''}
                onChange={(e) => onChange({ ...auth, apiKeyValue: e.target.value })}
                placeholder="secret_key_... or {{apiKey}}"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Add To</label>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apiKeyLocation"
                    checked={auth.apiKeyLocation !== 'query'}
                    onChange={() => onChange({ ...auth, apiKeyLocation: 'header' })}
                    className="text-sky-500 focus:ring-0"
                  />
                  Header
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="apiKeyLocation"
                    checked={auth.apiKeyLocation === 'query'}
                    onChange={() => onChange({ ...auth, apiKeyLocation: 'query' })}
                    className="text-sky-500 focus:ring-0"
                  />
                  Query Params
                </label>
              </div>
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="flex flex-col gap-3 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Access Token</label>
              <textarea
                value={auth.oauthToken || ''}
                onChange={(e) => onChange({ ...auth, oauthToken: e.target.value })}
                placeholder="ya29.a0... or {{oauthToken}}"
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded p-2.5 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Header Prefix</label>
              <input
                type="text"
                value={auth.oauthHeaderPrefix || 'Bearer'}
                onChange={(e) => onChange({ ...auth, oauthHeaderPrefix: e.target.value })}
                placeholder="Bearer"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
