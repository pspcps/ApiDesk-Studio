import React, { useState } from 'react';
import { BodyConfig, BodyType, KeyValuePair, RawType } from '../types';
import { KeyValueEditor } from './KeyValueEditor';
import { HighlightedJsonTextarea } from './HighlightedJsonTextarea';
import { Check, Sparkles, FileCode, AlertTriangle } from 'lucide-react';

interface BodyTabProps {
  body: BodyConfig;
  onChange: (body: BodyConfig) => void;
}

export const BodyTab: React.FC<BodyTabProps> = ({ body, onChange }) => {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleTypeChange = (type: BodyType) => {
    onChange({
      ...body,
      type
    });
  };

  const handleFormatJson = () => {
    if (!body.json) return;
    try {
      const parsed = JSON.parse(body.json);
      onChange({
        ...body,
        json: JSON.stringify(parsed, null, 2)
      });
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  };

  const handleMinifyJson = () => {
    if (!body.json) return;
    try {
      const parsed = JSON.parse(body.json);
      onChange({
        ...body,
        json: JSON.stringify(parsed)
      });
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  };

  const handleJsonChange = (val: string) => {
    onChange({ ...body, json: val });
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      // Check if syntax is valid JSON (ignoring {{variables}})
      const sanitized = val.replace(/\{\{\s*[\w$.-]+\s*\}\}/g, '"__VAR__"');
      JSON.parse(sanitized);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Syntax error');
    }
  };

  const handleInsertTemplate = (templateType: string) => {
    let sample = '';
    if (templateType === 'user') {
      sample = JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'engineer',
        tags: ['api', 'development'],
        active: true
      }, null, 2);
    } else if (templateType === 'auth') {
      sample = JSON.stringify({
        username: 'admin',
        password: 'supersecretpassword',
        rememberMe: true
      }, null, 2);
    } else if (templateType === 'pagination') {
      sample = JSON.stringify({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        order: 'desc'
      }, null, 2);
    }

    onChange({
      ...body,
      type: 'json',
      json: sample
    });
    setJsonError(null);
  };

  const bodyTypes: { id: BodyType; label: string }[] = [
    { id: 'none', label: 'none' },
    { id: 'json', label: 'JSON' },
    { id: 'form-data', label: 'form-data' },
    { id: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
    { id: 'raw', label: 'raw' },
    { id: 'graphql', label: 'GraphQL' },
    { id: 'binary', label: 'binary' }
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Body Type Selector Radio Bar */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-400 border-b border-slate-800 pb-2 flex-wrap">
        {bodyTypes.map((t) => (
          <label
            key={t.id}
            className={`flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded transition ${
              body.type === t.id ? 'bg-sky-500/10 text-sky-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            <input
              type="radio"
              name="bodyType"
              checked={body.type === t.id}
              onChange={() => handleTypeChange(t.id)}
              className="text-sky-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span>{t.label}</span>
          </label>
        ))}

        {body.type === 'raw' && (
          <select
            value={body.rawType || 'text'}
            onChange={(e) => onChange({ ...body, rawType: e.target.value as RawType })}
            className="ml-auto bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none"
          >
            <option value="text">Text (text/plain)</option>
            <option value="javascript">JavaScript (application/javascript)</option>
            <option value="json">JSON (application/json)</option>
            <option value="html">HTML (text/html)</option>
            <option value="xml">XML (application/xml)</option>
          </select>
        )}
      </div>

      {/* Body Content Area */}
      {body.type === 'none' && (
        <div className="p-8 text-center text-slate-500 text-xs">
          This request does not include a body payload. Select <span className="text-sky-400 cursor-pointer" onClick={() => handleTypeChange('json')}>JSON</span> or another format above if needed.
        </div>
      )}

      {body.type === 'json' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">JSON Payload</span>
              {jsonError ? (
                <span className="text-[11px] text-rose-400 flex items-center gap-1 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                  <AlertTriangle className="w-3 h-3" />
                  {jsonError}
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  <Check className="w-3 h-3" />
                  Valid JSON
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[11px]">Templates:</span>
                <button
                  type="button"
                  onClick={() => handleInsertTemplate('user')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTemplate('auth')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  Auth
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTemplate('pagination')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  Query
                </button>
              </div>

              <button
                type="button"
                onClick={handleFormatJson}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-medium flex items-center gap-1"
                title="Format & Beautify JSON"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Format JSON
              </button>
              <button
                type="button"
                onClick={handleMinifyJson}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Minify JSON"
              >
                Minify
              </button>
            </div>
          </div>

          <HighlightedJsonTextarea
            value={body.json || ''}
            onChange={(val) => handleJsonChange(val)}
            rows={12}
            placeholder={'{\n  "key": "value"\n}'}
          />
        </div>
      )}

      {body.type === 'form-data' && (
        <KeyValueEditor
          pairs={body.formData || []}
          onChange={(formData: KeyValuePair[]) => onChange({ ...body, formData })}
          keyPlaceholder="Field Name"
          valuePlaceholder="Field Value or select file"
          allowFiles={true}
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          pairs={body.urlencoded || []}
          onChange={(urlencoded: KeyValuePair[]) => onChange({ ...body, urlencoded })}
          keyPlaceholder="Param Name"
          valuePlaceholder="Param Value"
        />
      )}

      {body.type === 'raw' && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Raw Text Payload</span>
          <textarea
            value={body.raw || ''}
            onChange={(e) => onChange({ ...body, raw: e.target.value })}
            rows={10}
            placeholder="Enter raw request body..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed resize-y"
            spellCheck={false}
          />
        </div>
      )}

      {body.type === 'graphql' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Query / Mutation</span>
            <textarea
              value={body.graphqlQuery || ''}
              onChange={(e) => onChange({ ...body, graphqlQuery: e.target.value })}
              rows={10}
              placeholder="query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}"
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed resize-y"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">GraphQL Variables (JSON)</span>
            <textarea
              value={body.graphqlVariables || ''}
              onChange={(e) => onChange({ ...body, graphqlVariables: e.target.value })}
              rows={10}
              placeholder='{\n  "id": "123"\n}'
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg p-3 font-mono text-xs text-slate-100 focus:outline-none leading-relaxed resize-y"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {body.type === 'binary' && (
        <div className="p-6 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg flex flex-col items-center justify-center gap-3 bg-slate-900/30 text-center">
          <FileCode className="w-8 h-8 text-sky-400" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-200">
              {body.binaryFileName ? `Selected: ${body.binaryFileName}` : 'Select a binary file for upload'}
            </span>
            <span className="text-[11px] text-slate-500">Files are sent directly in the HTTP request payload</span>
          </div>
          <label className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium cursor-pointer transition">
            Browse File
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onChange({
                    ...body,
                    binaryFileName: file.name,
                    binaryFileSize: file.size
                  });
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
};
