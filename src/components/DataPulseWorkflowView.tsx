import React, { useState } from 'react';
import { 
  Workflow, 
  Play, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  Database, 
  Radio, 
  Globe, 
  Server, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Bug, 
  FileJson,
  Sparkles,
  Copy
} from 'lucide-react';
import { HighlightedJsonTextarea } from './HighlightedJsonTextarea';
import { CopyButton } from './CopyButton';
import { DebugInspectorModal, DebugInspectorData } from './DebugInspectorModal';

export type WorkflowStepType = 'api_call' | 'kafka_publish' | 'mongodb_op' | 'redis_op' | 'sql_op' | 'delay';

export interface WorkflowStepItem {
  id: string;
  name: string;
  type: WorkflowStepType;
  enabled: boolean;
  config: {
    // api_call
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    // kafka_publish
    topic?: string;
    key?: string;
    message?: any;
    // mongodb_op
    uri?: string;
    database?: string;
    collection?: string;
    operation?: 'insertOne' | 'updateOne' | 'findOne' | 'deleteOne';
    filter?: any;
    document?: any;
    // redis_op
    redisHost?: string;
    command?: 'SET' | 'GET' | 'DEL' | 'HSET' | 'PUBLISH';
    redisKey?: string;
    redisValue?: string;
    ttlSeconds?: number;
    // sql_op
    connectionString?: string;
    query?: string;
    // delay
    delayMs?: number;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  sharedVariables: Record<string, string>;
  steps: WorkflowStepItem[];
}

const WORKFLOW_TEMPLATES_STORAGE_KEY = 'apidesk_workflow_templates_v1';

const STARTER_WORKFLOW_TEMPLATE: WorkflowTemplate = {
  id: 'wf_template_e2e_order',
  name: 'Multi-Step Order & Data Pipeline Template',
  description: 'End-to-end workflow combining REST API call, Kafka event publish, MongoDB document insert, and Redis cache update',
  sharedVariables: {
    environment: 'dev',
    entityId: 'ord_90124',
    customerId: 'cust_5581',
    apiHost: 'https://httpbin.org'
  },
  steps: [
    {
      id: 'step_1_api',
      name: '1. Create Order via REST API Call',
      type: 'api_call',
      enabled: true,
      config: {
        method: 'POST',
        url: '{{apiHost}}/post',
        headers: { 'Content-Type': 'application/json', 'X-Entity-ID': '{{entityId}}' },
        body: {
          orderId: '{{entityId}}',
          customerId: '{{customerId}}',
          status: 'INITIATED',
          amount: 249.5
        }
      }
    },
    {
      id: 'step_2_kafka',
      name: '2. Publish Order Created Event to Kafka',
      type: 'kafka_publish',
      enabled: true,
      config: {
        topic: 'domain.orders.events',
        key: '{{entityId}}',
        message: {
          eventType: 'ORDER_CREATED',
          orderId: '{{entityId}}',
          customerId: '{{customerId}}',
          timestamp: '{{$isoTimestamp}}'
        }
      }
    },
    {
      id: 'step_3_mongo',
      name: '3. Upsert Audit Document in MongoDB',
      type: 'mongodb_op',
      enabled: true,
      config: {
        uri: 'mongodb://localhost:27017',
        database: 'orders_db',
        collection: 'order_audit_trail',
        operation: 'updateOne',
        filter: { orderId: '{{entityId}}' },
        document: {
          $set: {
            customerId: '{{customerId}}',
            pipelineState: 'KAFKA_PUBLISHED',
            updatedAt: '{{$isoTimestamp}}'
          }
        }
      }
    },
    {
      id: 'step_4_redis',
      name: '4. Cache Order State in Redis',
      type: 'redis_op',
      enabled: true,
      config: {
        redisHost: 'redis://localhost:6379',
        command: 'SET',
        redisKey: 'order:status:{{entityId}}',
        redisValue: '{"status":"PROCESSING","customerId":"{{customerId}}"}',
        ttlSeconds: 3600
      }
    },
    {
      id: 'step_5_sql',
      name: '5. Insert Ledger Entry in SQL Database',
      type: 'sql_op',
      enabled: true,
      config: {
        connectionString: 'postgresql://localhost:5432/ledger',
        query: "INSERT INTO ledger_entries (order_id, customer_id, status) VALUES ('{{entityId}}', '{{customerId}}', 'COMMITTED') ON CONFLICT (order_id) DO UPDATE SET status = 'COMMITTED';"
      }
    }
  ]
};

export const DataPulseWorkflowView: React.FC = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(WORKFLOW_TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [STARTER_WORKFLOW_TEMPLATE];
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string>(templates[0].id);
  const activeTemplate = templates.find(t => t.id === activeTemplateId) || templates[0];

  const [selectedStepId, setSelectedStepId] = useState<string>(activeTemplate.steps[0]?.id || '');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionLogs, setExecutionLogs] = useState<{ timestamp: string; stepName: string; status: 'info' | 'success' | 'error'; message: string; details?: any }[]>([]);
  const [runSummaryJson, setRunSummaryJson] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [rawTemplateJson, setRawTemplateJson] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugInspectorData>({
    title: 'Workflow Execution Diagnostics',
    endpoint: '/api/workflow/execute',
    method: 'POST',
    executionLogs: []
  });

  const saveTemplates = (next: WorkflowTemplate[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(WORKFLOW_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const updateActiveTemplate = (updater: (t: WorkflowTemplate) => WorkflowTemplate) => {
    const next = templates.map(t => (t.id === activeTemplate.id ? updater(t) : t));
    saveTemplates(next);
  };

  const handleAddStep = (type: WorkflowStepType) => {
    const stepNum = activeTemplate.steps.length + 1;
    const defaultConfigs: Record<WorkflowStepType, WorkflowStepItem['config']> = {
      api_call: {
        method: 'POST',
        url: '{{apiHost}}/post',
        headers: { 'Content-Type': 'application/json' },
        body: { id: '{{entityId}}', action: 'sync' }
      },
      kafka_publish: {
        topic: 'events.domain.topic',
        key: '{{entityId}}',
        message: { id: '{{entityId}}', timestamp: '{{$isoTimestamp}}' }
      },
      mongodb_op: {
        uri: 'mongodb://localhost:27017',
        database: 'app_db',
        collection: 'records',
        operation: 'insertOne',
        document: { entityId: '{{entityId}}', createdAt: '{{$isoTimestamp}}' }
      },
      redis_op: {
        redisHost: 'redis://localhost:6379',
        command: 'SET',
        redisKey: 'cache:{{entityId}}',
        redisValue: 'ACTIVE',
        ttlSeconds: 1800
      },
      sql_op: {
        connectionString: 'postgresql://localhost:5432/app_db',
        query: "UPDATE entities SET updated_at = NOW() WHERE id = '{{entityId}}';"
      },
      delay: {
        delayMs: 1000
      }
    };

    const labels: Record<WorkflowStepType, string> = {
      api_call: `${stepNum}. HTTP / REST API Call`,
      kafka_publish: `${stepNum}. Kafka Topic Publish`,
      mongodb_op: `${stepNum}. MongoDB Insert / Update`,
      redis_op: `${stepNum}. Redis Cache Operation`,
      sql_op: `${stepNum}. SQL Database Query`,
      delay: `${stepNum}. Wait / Delay Step`
    };

    const newStep: WorkflowStepItem = {
      id: `step_${Date.now()}`,
      name: labels[type],
      type,
      enabled: true,
      config: defaultConfigs[type]
    };

    updateActiveTemplate(t => ({
      ...t,
      steps: [...t.steps, newStep]
    }));
    setSelectedStepId(newStep.id);
  };

  const handleDownloadTemplate = () => {
    const jsonStr = JSON.stringify(activeTemplate, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTemplate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadTemplateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.steps)) {
        setUploadError('Invalid workflow template: JSON must include a "steps" array.');
        return;
      }
      const imported: WorkflowTemplate = {
        id: `wf_${Date.now()}`,
        name: parsed.name || file.name.replace(/\.json$/i, ''),
        description: parsed.description || 'Imported custom workflow template',
        sharedVariables: parsed.sharedVariables || {},
        steps: parsed.steps
      };
      saveTemplates([imported, ...templates]);
      setActiveTemplateId(imported.id);
      setSelectedStepId(imported.steps[0]?.id || '');
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setUploadError(`Failed to parse workflow template JSON: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleImportPastedTemplate = () => {
    if (!rawTemplateJson.trim()) return;
    setUploadError(null);
    try {
      const parsed = JSON.parse(rawTemplateJson);
      if (!parsed || !Array.isArray(parsed.steps)) {
        setUploadError('Template JSON must contain a "steps" array.');
        return;
      }
      const imported: WorkflowTemplate = {
        id: `wf_${Date.now()}`,
        name: parsed.name || 'Custom Uploaded Workflow',
        description: parsed.description || 'Multi-step orchestration workflow',
        sharedVariables: parsed.sharedVariables || {},
        steps: parsed.steps
      };
      saveTemplates([imported, ...templates]);
      setActiveTemplateId(imported.id);
      setSelectedStepId(imported.steps[0]?.id || '');
      setRawTemplateJson('');
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setUploadError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleRunSelectedWorkflow = async () => {
    const enabledSteps = activeTemplate.steps.filter(s => s.enabled);
    if (enabledSteps.length === 0) return;

    setIsRunning(true);
    setExecutionLogs([
      {
        timestamp: new Date().toLocaleTimeString(),
        stepName: 'Workflow Engine',
        status: 'info',
        message: `Starting "${activeTemplate.name}" (${enabledSteps.length} enabled steps)...`
      }
    ]);

    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: activeTemplate.name,
          sharedVariables: activeTemplate.sharedVariables,
          steps: enabledSteps
        })
      });
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setExecutionLogs(data.logs);
      }
      setRunSummaryJson(JSON.stringify(data.summary || data, null, 2));
      setDebugData({
        title: `Workflow Run: ${activeTemplate.name}`,
        endpoint: '/api/workflow/execute',
        method: 'POST',
        responseStatus: res.status,
        responseStatusText: res.statusText,
        requestPayload: {
          templateName: activeTemplate.name,
          sharedVariables: activeTemplate.sharedVariables,
          steps: enabledSteps
        },
        responsePayload: data,
        executionLogs: (data.logs || []).map((l: any, i: number) => ({
          id: `wf_log_${i}`,
          timestamp: l.timestamp,
          level: l.status === 'error' ? 'error' : l.status === 'success' ? 'success' : 'info',
          title: l.stepName,
          message: l.message,
          details: l.details
        }))
      });
    } catch (err: any) {
      setExecutionLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stepName: 'Workflow Runner',
          status: 'error',
          message: `Execution failed: ${err.message}`
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const selectedStep = activeTemplate.steps.find(s => s.id === selectedStepId) || activeTemplate.steps[0];

  const getStepBadge = (type: WorkflowStepType) => {
    switch (type) {
      case 'api_call':
        return { label: 'REST API', color: 'bg-sky-950 text-sky-300 border-sky-800', icon: Globe };
      case 'kafka_publish':
        return { label: 'KAFKA', color: 'bg-purple-950 text-purple-300 border-purple-800', icon: Radio };
      case 'mongodb_op':
        return { label: 'MONGODB', color: 'bg-emerald-950 text-emerald-300 border-emerald-800', icon: Database };
      case 'redis_op':
        return { label: 'REDIS', color: 'bg-rose-950 text-rose-300 border-rose-800', icon: Server };
      case 'sql_op':
        return { label: 'SQL DB', color: 'bg-amber-950 text-amber-300 border-amber-800', icon: Database };
      case 'delay':
        return { label: 'DELAY', color: 'bg-slate-800 text-slate-300 border-slate-700', icon: Clock };
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">DataPulse Workflow Builder</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Template-Driven Multi-Step Orchestrator
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Create, upload, and execute workflow templates chaining REST API calls, Kafka events, MongoDB, Redis, and SQL operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeTemplate.id}
            onChange={(e) => {
              setActiveTemplateId(e.target.value);
              const found = templates.find(t => t.id === e.target.value);
              if (found && found.steps[0]) setSelectedStepId(found.steps[0].id);
            }}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              setRawTemplateJson(JSON.stringify(activeTemplate, null, 2));
              setIsUploadModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload / Edit Template JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export Template</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDebugOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Bug className="w-3.5 h-3.5 text-sky-400" />
            <span>Debug</span>
          </button>

          <button
            type="button"
            onClick={handleRunSelectedWorkflow}
            disabled={isRunning}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isRunning ? 'Running Workflow...' : 'Run Selected Steps'}</span>
          </button>
        </div>
      </div>

      {/* Shared Context Variables Bar */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
          Shared Template Variables:
        </span>
        {Object.entries(activeTemplate.sharedVariables).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="font-mono text-sky-400">{`{{${key}}}`}:</span>
            <input
              type="text"
              value={val}
              onChange={(e) => {
                updateActiveTemplate(t => ({
                  ...t,
                  sharedVariables: { ...t.sharedVariables, [key]: e.target.value }
                }));
              }}
              className="bg-transparent font-mono text-slate-200 w-32 focus:outline-none"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const varName = `var_${Object.keys(activeTemplate.sharedVariables).length + 1}`;
            updateActiveTemplate(t => ({
              ...t,
              sharedVariables: { ...t.sharedVariables, [varName]: 'value' }
            }));
          }}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Variable
        </button>
      </div>

      {/* Main 3-Column Workspace */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Columns: Step Pipeline Cards + Add Step Buttons */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Workflow Steps ({activeTemplate.steps.filter(s => s.enabled).length}/{activeTemplate.steps.length} Enabled)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {activeTemplate.steps.map((step) => {
              const badge = getStepBadge(step.type);
              const BadgeIcon = badge.icon;
              const isSelected = selectedStep?.id === step.id;

              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500/60 shadow-md'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  } ${!step.enabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateActiveTemplate(t => ({
                          ...t,
                          steps: t.steps.map(s => (s.id === step.id ? { ...s, enabled: e.target.checked } : s))
                        }));
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 cursor-pointer"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-100 truncate">{step.name}</span>
                      <span className={`inline-flex items-center gap-1 w-fit mt-1 text-[10px] font-mono px-1.5 py-0.2 rounded border ${badge.color}`}>
                        <BadgeIcon className="w-2.5 h-2.5" />
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateActiveTemplate(t => ({
                        ...t,
                        steps: t.steps.filter(s => s.id !== step.id)
                      }));
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400"
                    title="Delete Step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add Step Palette */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2 mt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              + Add Step to Template
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleAddStep('api_call')}
                className="px-2.5 py-1.5 rounded bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-800/60 font-medium flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>REST API Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddStep('kafka_publish')}
                className="px-2.5 py-1.5 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 font-medium flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Kafka Publish</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddStep('mongodb_op')}
                className="px-2.5 py-1.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 font-medium flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                <span>MongoDB Op</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddStep('redis_op')}
                className="px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-medium flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Redis Command</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddStep('sql_op')}
                className="px-2.5 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-medium flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                <span>SQL Query</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddStep('delay')}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Delay / Wait</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center 4 Columns: Active Step Configuration */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {selectedStep ? (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Step Configuration
                </span>
                <span className="text-[11px] font-mono text-slate-400">{selectedStep.type}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-semibold">Step Name</label>
                <input
                  type="text"
                  value={selectedStep.name}
                  onChange={(e) => {
                    updateActiveTemplate(t => ({
                      ...t,
                      steps: t.steps.map(s => (s.id === selectedStep.id ? { ...s, name: e.target.value } : s))
                    }));
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-semibold">
                  Step Action Configuration (JSON with {'{{variable}}'} interpolation)
                </label>
                <HighlightedJsonTextarea
                  value={JSON.stringify(selectedStep.config, null, 2)}
                  onChange={(val) => {
                    try {
                      const parsed = JSON.parse(val);
                      updateActiveTemplate(t => ({
                        ...t,
                        steps: t.steps.map(s => (s.id === selectedStep.id ? { ...s, config: parsed } : s))
                      }));
                    } catch {}
                  }}
                  rows={14}
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs border border-slate-800 rounded-xl">
              Select or add a step to configure its parameters.
            </div>
          )}
        </div>

        {/* Right 4 Columns: Live Execution Log & Summary JSON */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3 flex-1 min-h-[380px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Workflow Execution Output
              </span>
              {runSummaryJson && <CopyButton text={runSummaryJson} label="Copy Summary JSON" />}
            </div>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-y-auto flex flex-col gap-2">
              {executionLogs.length === 0 ? (
                <div className="text-slate-500 text-center my-auto">
                  Click <strong>Run Selected Steps</strong> to execute the workflow pipeline.
                </div>
              ) : (
                executionLogs.map((log, i) => (
                  <div key={i} className="p-2 rounded bg-slate-900/70 border border-slate-800/80 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-amber-300">{log.stepName}</span>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>
                    <div
                      className={
                        log.status === 'error'
                          ? 'text-rose-400'
                          : log.status === 'success'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }
                    >
                      {log.message}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload / Edit Full Workflow Template JSON Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">Upload or Edit Workflow Template JSON</h2>
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
              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700 text-rose-200">
                  {uploadError}
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-slate-200">Upload `.json` Workflow Template File</span>
                  <span className="text-[11px] text-slate-500">
                    Supports steps of type `api_call`, `kafka_publish`, `mongodb_op`, `redis_op`, `sql_op`, and `delay`
                  </span>
                </div>
                <label className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload JSON</span>
                  <input type="file" accept=".json" onChange={handleUploadTemplateFile} className="hidden" />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-300">Or Edit / Paste Template JSON Directly:</label>
                <HighlightedJsonTextarea
                  value={rawTemplateJson}
                  onChange={setRawTemplateJson}
                  rows={12}
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
                  onClick={handleImportPastedTemplate}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Create Workflow from Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DebugInspectorModal
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        data={debugData}
      />
    </div>
  );
};
