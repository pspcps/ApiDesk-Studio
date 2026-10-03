import React from 'react';
import { TestAssertion, VariableExtraction } from '../types';
import { Plus, Trash2, CheckCircle2, Variable, Sparkles, Code2 } from 'lucide-react';

interface TestsTabProps {
  tests: TestAssertion[];
  extractions: VariableExtraction[];
  onTestsChange: (tests: TestAssertion[]) => void;
  onExtractionsChange: (extractions: VariableExtraction[]) => void;
}

export const TestsTab: React.FC<TestsTabProps> = ({
  tests,
  extractions,
  onTestsChange,
  onExtractionsChange
}) => {
  const handleAddTest = (preset?: { name: string; type: any; targetValue: string }) => {
    const newTest: TestAssertion = {
      id: 't_' + Math.random().toString(36).substring(2, 9),
      name: preset?.name || 'Status code is 200',
      type: preset?.type || 'status_code',
      targetValue: preset?.targetValue || '200',
      operator: 'equals',
      enabled: true
    };
    onTestsChange([...tests, newTest]);
  };

  const handleUpdateTest = (index: number, field: keyof TestAssertion, val: any) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], [field]: val };
    onTestsChange(updated);
  };

  const handleRemoveTest = (index: number) => {
    onTestsChange(tests.filter((_, i) => i !== index));
  };

  const handleAddExtraction = () => {
    const newExt: VariableExtraction = {
      id: 'ext_' + Math.random().toString(36).substring(2, 9),
      variableName: 'token',
      source: 'json_path',
      pathOrKey: 'token',
      enabled: true
    };
    onExtractionsChange([...extractions, newExt]);
  };

  const handleUpdateExtraction = (index: number, field: keyof VariableExtraction, val: any) => {
    const updated = [...extractions];
    updated[index] = { ...updated[index], [field]: val };
    onExtractionsChange(updated);
  };

  const handleRemoveExtraction = (index: number) => {
    onExtractionsChange(extractions.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Predefined Assertions & Snippets */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              Test Assertions ({tests.filter(t => t.enabled).length} active)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Snippets */}
            <div className="hidden lg:flex items-center gap-1">
              <span className="text-[11px] text-slate-500 mr-1">Quick Add:</span>
              <button
                type="button"
                onClick={() => handleAddTest({ name: 'Status code is 200', type: 'status_code', targetValue: '200' })}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] border border-slate-700 transition"
              >
                + Status 200
              </button>
              <button
                type="button"
                onClick={() => handleAddTest({ name: 'Response time < 500ms', type: 'response_time', targetValue: '500' })}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] border border-slate-700 transition"
              >
                + Time &lt; 500ms
              </button>
              <button
                type="button"
                onClick={() => handleAddTest({ name: 'Content-Type header exists', type: 'header_exists', targetValue: 'content-type' })}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] border border-slate-700 transition"
              >
                + Has Header
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleAddTest()}
              className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Test
            </button>
          </div>
        </div>

        {/* Assertions List */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40 divide-y divide-slate-800/60">
          {tests.map((test, idx) => (
            <div
              key={test.id}
              className={`p-3 flex flex-col gap-2 hover:bg-slate-800/20 transition ${
                !test.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={test.enabled}
                  onChange={(e) => handleUpdateTest(idx, 'enabled', e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                />

                <input
                  type="text"
                  value={test.name}
                  onChange={(e) => handleUpdateTest(idx, 'name', e.target.value)}
                  placeholder="Test Description / Name"
                  className="flex-1 bg-transparent border-b border-transparent focus:border-emerald-500 text-xs font-medium text-slate-200 focus:outline-none px-1"
                />

                <select
                  value={test.type}
                  onChange={(e) => handleUpdateTest(idx, 'type', e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none"
                >
                  <option value="status_code">Status Code</option>
                  <option value="response_time">Response Time (ms)</option>
                  <option value="body_contains">Body Contains</option>
                  <option value="json_path">JSON Path Exists</option>
                  <option value="header_exists">Header Exists</option>
                  <option value="custom_js">Custom JavaScript</option>
                </select>

                {test.type !== 'custom_js' && (
                  <input
                    type="text"
                    value={test.targetValue || ''}
                    onChange={(e) => handleUpdateTest(idx, 'targetValue', e.target.value)}
                    placeholder={
                      test.type === 'status_code' ? '200' :
                      test.type === 'response_time' ? '500' :
                      test.type === 'body_contains' ? 'success' :
                      test.type === 'json_path' ? 'data.id' : 'content-type'
                    }
                    className="w-36 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none"
                  />
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveTest(idx)}
                  className="text-slate-600 hover:text-rose-400 p-1 transition"
                  title="Remove test"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {test.type === 'custom_js' && (
                <div className="pl-6 pt-1">
                  <textarea
                    value={test.customScript || ''}
                    onChange={(e) => handleUpdateTest(idx, 'customScript', e.target.value)}
                    placeholder="// Available objects: response, status, headers, data, timeMs&#10;if (status !== 200) throw new Error('Expected 200');&#10;if (!data.id) throw new Error('Missing ID');"
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded p-2 font-mono text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ))}

          {tests.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-xs">
              No assertions configured. Add a test to verify status codes, payload content, or latency automatically.
            </div>
          )}
        </div>
      </div>

      {/* 2. Auto Variable Extractions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Variable className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              Auto-Extract Response Variables
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddExtraction}
            className="px-3 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-xs font-medium flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Extraction
          </button>
        </div>

        <span className="text-[11px] text-slate-500">
          Automatically captures values from this response and updates your active environment variables (e.g. saving an auth token or new entity ID for chained requests).
        </span>

        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40 divide-y divide-slate-800/60">
          {extractions.map((ext, idx) => (
            <div key={ext.id} className="p-3 flex items-center gap-3 hover:bg-slate-800/20 transition">
              <input
                type="checkbox"
                checked={ext.enabled}
                onChange={(e) => handleUpdateExtraction(idx, 'enabled', e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />

              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-slate-400">Save</span>
                <input
                  type="text"
                  value={ext.pathOrKey}
                  onChange={(e) => handleUpdateExtraction(idx, 'pathOrKey', e.target.value)}
                  placeholder="token or data.token"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none"
                />
                <span className="text-xs text-slate-400">from</span>
                <select
                  value={ext.source}
                  onChange={(e) => handleUpdateExtraction(idx, 'source', e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none"
                >
                  <option value="json_path">JSON Path</option>
                  <option value="header">Header</option>
                  <option value="status_code">Status Code</option>
                </select>
                <span className="text-xs text-slate-400">as</span>
                <div className="flex items-center gap-1">
                  <span className="text-sky-400 font-mono text-xs font-semibold">{`{{`}</span>
                  <input
                    type="text"
                    value={ext.variableName}
                    onChange={(e) => handleUpdateExtraction(idx, 'variableName', e.target.value)}
                    placeholder="token"
                    className="w-32 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded px-2 py-1 font-mono text-xs text-sky-300 focus:outline-none"
                  />
                  <span className="text-sky-400 font-mono text-xs font-semibold">{`}}`}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveExtraction(idx)}
                className="text-slate-600 hover:text-rose-400 p-1 transition"
                title="Remove extraction"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {extractions.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-xs">
              No extractions configured. You can auto-populate environment variables from the response payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
