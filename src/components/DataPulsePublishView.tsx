import React, { useState } from 'react';
import { 
  Radio, 
  Send, 
  Download, 
  Clock, 
  Sparkles, 
  Key, 
  Plus, 
  Trash2, 
  Bug, 
  CheckCircle2,
  RefreshCw,
  FileCode
} from 'lucide-react';
import { HighlightedJsonTextarea } from './HighlightedJsonTextarea';
import { DebugInspectorModal, DebugInspectorData } from './DebugInspectorModal';
import { CopyButton } from './CopyButton';

interface FieldRow {
  id: string;
  key: string;
  value: string;
}

export const DataPulsePublishView: React.FC = () => {
  const [environment, setEnvironment] = useState<'dev' | 'stage'>('dev');
  const [brokers, setBrokers] = useState<string>('kafka-broker-1.internal.local:9092,kafka-broker-2.internal.local:9092');
  const [saslUsername, setSaslUsername] = useState<string>('');
  const [saslPassword, setSaslPassword] = useState<string>('');
  const [showAuthDrawer, setShowAuthDrawer] = useState<boolean>(false);

  const [topic, setTopic] = useState<string>('events.domain.orders');
  const [messageKey, setMessageKey] = useState<string>('ord_982341');
  const [editorMode, setEditorMode] = useState<'rows' | 'json'>('rows');

  const [valueRows, setValueRows] = useState<FieldRow[]>([
    { id: 'f1', key: 'eventId', value: '550e8400-e29b-41d4-a716-446655440000' },
    { id: 'f2', key: 'eventType', value: 'ORDER_CREATED' },
    { id: 'f3', key: 'timestamp', value: new Date().toISOString() },
    { id: 'f4', key: 'customerId', value: 'cust_10492' },
    { id: 'f5', key: 'totalAmount', value: '149.99' }
  ]);

  const [rawJsonValue, setRawJsonValue] = useState<string>(() =>
    JSON.stringify(
      {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        eventType: 'ORDER_CREATED',
        timestamp: new Date().toISOString(),
        customerId: 'cust_10492',
        totalAmount: 149.99
      },
      null,
      2
    )
  );

  const [headers, setHeaders] = useState<FieldRow[]>([
    { id: 'h1', key: 'correlation-id', value: 'corr-' + Math.random().toString(36).substring(2, 9) },
    { id: 'h2', key: 'source-service', value: 'apidesk-datapulse' }
  ]);

  const [isFetchingSample, setIsFetchingSample] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [streamLogs, setStreamLogs] = useState<{ timestamp: string; level: string; message: string }[]>([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugInspectorData>({
    title: 'DataPulse Publish Diagnostics',
    endpoint: '/api/kafka/publish',
    method: 'POST',
    executionLogs: []
  });

  const syncRowsToJson = (rows: FieldRow[]) => {
    const obj: Record<string, any> = {};
    rows.forEach(r => {
      if (!r.key.trim()) return;
      if (r.value === 'true') obj[r.key] = true;
      else if (r.value === 'false') obj[r.key] = false;
      else if (!isNaN(Number(r.value)) && r.value.trim() !== '') obj[r.key] = Number(r.value);
      else obj[r.key] = r.value;
    });
    setRawJsonValue(JSON.stringify(obj, null, 2));
  };

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleFetchSample = async () => {
    setIsFetchingSample(true);
    setStreamLogs([
      { timestamp: new Date().toLocaleTimeString(), level: 'info', message: `Connecting to Kafka brokers (${environment}) for topic "${topic}"...` }
    ]);

    try {
      const res = await fetch('/api/kafka/fetch-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment, brokers, topic, saslUsername })
      });
      const data = await res.json();
      if (data.success && data.sample) {
        setMessageKey(data.sample.key || 'msg_' + Date.now());
        const payloadObj = data.sample.value || {};
        setRawJsonValue(JSON.stringify(payloadObj, null, 2));
        const newRows: FieldRow[] = Object.entries(payloadObj).map(([k, v], i) => ({
          id: `row_${i}`,
          key: k,
          value: typeof v === 'object' ? JSON.stringify(v) : String(v)
        }));
        setValueRows(newRows);
        setStreamLogs(prev => [
          ...prev,
          ...(data.logs || []),
          { timestamp: new Date().toLocaleTimeString(), level: 'success', message: `Fetched latest sample message from topic "${topic}" (offset ${data.sample.offset || 1042}).` }
        ]);
      }
    } catch (err: any) {
      setStreamLogs(prev => [
        ...prev,
        { timestamp: new Date().toLocaleTimeString(), level: 'error', message: `Failed to fetch sample: ${err.message}` }
      ]);
    } finally {
      setIsFetchingSample(false);
    }
  };

  const handlePublishMessage = async () => {
    setIsPublishing(true);
    let parsedValue: any = {};
    try {
      parsedValue = JSON.parse(rawJsonValue);
    } catch {
      parsedValue = rawJsonValue;
    }

    const headerObj: Record<string, string> = {};
    headers.forEach(h => {
      if (h.key.trim()) headerObj[h.key.trim()] = h.value;
    });

    const envelope = {
      environment,
      brokers,
      topic,
      key: messageKey,
      value: parsedValue,
      headers: headerObj
    };

    setStreamLogs(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), level: 'info', message: `Publishing message key="${messageKey}" to topic "${topic}"...` }
    ]);

    try {
      const res = await fetch('/api/kafka/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      });
      const data = await res.json();
      setStreamLogs(prev => [
        ...prev,
        ...(data.logs || []),
        {
          timestamp: new Date().toLocaleTimeString(),
          level: 'success',
          message: `Published message to ${topic} [partition ${data.partition ?? 0}, offset ${data.offset ?? Date.now()}]`
        }
      ]);
      setDebugData({
        title: `Kafka Publish: ${topic}`,
        endpoint: '/api/kafka/publish',
        method: 'POST',
        responseStatus: res.status,
        responseStatusText: res.statusText,
        requestPayload: envelope,
        responsePayload: data,
        executionLogs: (data.logs || []).map((l: any, idx: number) => ({
          id: `k_${idx}`,
          timestamp: l.timestamp || new Date().toLocaleTimeString(),
          level: l.level || 'info',
          title: 'Kafka Broker Event',
          message: l.message
        }))
      });
    } catch (err: any) {
      setStreamLogs(prev => [
        ...prev,
        { timestamp: new Date().toLocaleTimeString(), level: 'error', message: `Publish failed: ${err.message}` }
      ]);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">DataPulse Publish</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Kafka Sample Fetch &amp; Publisher
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Fetch live sample events from a Kafka topic or craft custom envelopes with quick-fill UUID/timestamp helpers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAuthDrawer(!showAuthDrawer)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Broker &amp; SASL Credentials</span>
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

      {/* Credentials Drawer */}
      {showAuthDrawer && (
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Bootstrap Brokers:</label>
            <input
              type="text"
              value={brokers}
              onChange={(e) => setBrokers(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">SASL Username:</label>
            <input
              type="text"
              value={saslUsername}
              onChange={(e) => setSaslUsername(e.target.value)}
              placeholder="kafka-sasl-user"
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">SASL Password:</label>
            <input
              type="password"
              value={saslPassword}
              onChange={(e) => setSaslPassword(e.target.value)}
              placeholder="••••••••••••"
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Topic, Key, Value, Headers */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Topic & Controls */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase text-slate-400">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as 'dev' | 'stage')}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none"
              >
                <option value="dev">DEV Cluster</option>
                <option value="stage">STAGE Cluster</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[11px] font-semibold uppercase text-slate-400">Kafka Topic Name</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. events.domain.orders"
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-col gap-1 w-48">
              <label className="text-[11px] font-semibold uppercase text-slate-400">Partition Key</label>
              <input
                type="text"
                value={messageKey}
                onChange={(e) => setMessageKey(e.target.value)}
                placeholder="Message Key"
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="button"
              onClick={handleFetchSample}
              disabled={isFetchingSample}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>{isFetchingSample ? 'Fetching...' : 'Fetch Sample'}</span>
            </button>

            <button
              type="button"
              onClick={handlePublishMessage}
              disabled={isPublishing}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish Event'}</span>
            </button>
          </div>

          {/* Value Editor (Row-based with Quick-Fill or JSON) */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Message Value Payload
                </span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditorMode('rows')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      editorMode === 'rows' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Row Editor + Quick-Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('json')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      editorMode === 'json' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {editorMode === 'rows' && (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...valueRows, { id: 'f_' + Date.now(), key: '', value: '' }];
                    setValueRows(next);
                  }}
                  className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Field
                </button>
              )}
            </div>

            {editorMode === 'rows' ? (
              <div className="flex flex-col gap-2">
                {valueRows.map((row, idx) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...valueRows];
                        next[idx] = { ...row, key: e.target.value };
                        setValueRows(next);
                        syncRowsToJson(next);
                      }}
                      placeholder="Field Name"
                      className="w-44 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-sky-300 focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...valueRows];
                        next[idx] = { ...row, value: e.target.value };
                        setValueRows(next);
                        syncRowsToJson(next);
                      }}
                      placeholder="Value"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...valueRows];
                        next[idx] = { ...row, value: new Date().toISOString() };
                        setValueRows(next);
                        syncRowsToJson(next);
                      }}
                      title="Set to Now (ISO Timestamp)"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono flex items-center gap-1 shrink-0"
                    >
                      <Clock className="w-3 h-3" />
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...valueRows];
                        next[idx] = { ...row, value: generateUuid() };
                        setValueRows(next);
                        syncRowsToJson(next);
                      }}
                      title="Generate New UUID"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-mono flex items-center gap-1 shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      UUID
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = valueRows.filter((_, i) => i !== idx);
                        setValueRows(next);
                        syncRowsToJson(next);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <HighlightedJsonTextarea
                value={rawJsonValue}
                onChange={setRawJsonValue}
                rows={10}
              />
            )}
          </div>

          {/* Kafka Headers */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Kafka Record Headers
              </span>
              <button
                type="button"
                onClick={() => setHeaders([...headers, { id: 'h_' + Date.now(), key: '', value: '' }])}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Header
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {headers.map((h, i) => (
                <div key={h.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i] = { ...h, key: e.target.value };
                      setHeaders(next);
                    }}
                    placeholder="Header Key"
                    className="w-48 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...headers];
                      next[i] = { ...h, value: e.target.value };
                      setHeaders(next);
                    }}
                    placeholder="Header Value"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live NDJSON Stream Output */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3 h-full min-h-[420px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Broker Stream Logs
            </span>
            <CopyButton
              text={streamLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n')}
              label="Copy Logs"
            />
          </div>

          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-y-auto flex flex-col gap-2">
            {streamLogs.length === 0 ? (
              <div className="text-slate-500 text-center my-auto">
                Click <strong>Fetch Sample</strong> or <strong>Publish Event</strong> to stream broker progress logs.
              </div>
            ) : (
              streamLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 text-[10px] shrink-0">{log.timestamp}</span>
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-rose-400'
                        : log.level === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
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
