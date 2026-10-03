import React, { useState } from 'react';
import { 
  Code2, 
  Sparkles, 
  Play, 
  Variable, 
  CheckCircle2, 
  Copy, 
  HelpCircle, 
  Layers, 
  Clock, 
  ShieldCheck, 
  FileCode,
  Terminal
} from 'lucide-react';

interface ScriptsTabProps {
  preRequestScript?: string;
  postResponseScript?: string;
  onPreRequestScriptChange: (script: string) => void;
  onPostResponseScriptChange: (script: string) => void;
}

export const ScriptsTab: React.FC<ScriptsTabProps> = ({
  preRequestScript = '',
  postResponseScript = '',
  onPreRequestScriptChange,
  onPostResponseScriptChange
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pre' | 'post'>('pre');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const currentScript = activeSubTab === 'pre' ? preRequestScript : postResponseScript;
  const currentSetter = activeSubTab === 'pre' ? onPreRequestScriptChange : onPostResponseScriptChange;

  const preRequestSnippets = [
    {
      title: 'Set an environment variable',
      desc: 'Saves a dynamic value to active environment',
      code: `pm.environment.set("variable_key", "variable_value");`
    },
    {
      title: 'Get an environment variable',
      desc: 'Reads a variable value from environment',
      code: `const myVar = pm.environment.get("variable_key");\nconsole.log("Current variable:", myVar);`
    },
    {
      title: 'Set dynamic timestamp',
      desc: 'Generates ISO date and millisecond timestamp',
      code: `pm.environment.set("currentTimestamp", Date.now());\npm.environment.set("isoDate", new Date().toISOString());`
    },
    {
      title: 'Generate dynamic UUID / GUID',
      desc: 'Creates a random UUIDv4 string',
      code: `const uuid = crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).substring(2, 10);\npm.environment.set("requestId", uuid);\nconsole.log("Generated Request ID:", uuid);`
    },
    {
      title: 'Add custom dynamic Header',
      desc: 'Injects a header into the outgoing request',
      code: `pm.request.headers.add({\n  key: "X-Request-Timestamp",\n  value: Date.now().toString()\n});`
    },
    {
      title: 'Compute Base64 Auth / Token',
      desc: 'Encodes credentials or tokens on the fly',
      code: `const username = "api_user";\nconst secret = "token_" + Date.now();\nconst basicAuth = btoa(username + ":" + secret);\npm.environment.set("authHeader", "Basic " + basicAuth);`
    }
  ];

  const postResponseSnippets = [
    {
      title: 'Status code is 200',
      desc: 'Validates that the HTTP response code is 200 OK',
      code: `pm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});`
    },
    {
      title: 'Extract JSON token to Environment',
      desc: 'Captures auth token or entity ID from JSON response',
      code: `const responseData = pm.response.json();\nif (responseData.token) {\n  pm.environment.set("authToken", responseData.token);\n  console.log("Saved authToken to environment:", responseData.token);\n}`
    },
    {
      title: 'Response time is less than 200ms',
      desc: 'Validates response latency',
      code: `pm.test("Response time is less than 200ms", function () {\n  pm.expect(pm.response.responseTime).to.be.below(200);\n});`
    },
    {
      title: 'Response body contains string',
      desc: 'Verifies the response payload has a specific keyword',
      code: `pm.test("Body contains success string", function () {\n  pm.expect(pm.response.text()).to.include("success");\n});`
    },
    {
      title: 'Check JSON property value',
      desc: 'Asserts a deep property inside response JSON',
      code: `pm.test("Check user object status", function () {\n  const jsonData = pm.response.json();\n  pm.expect(jsonData).to.have.property("id");\n  // pm.expect(jsonData.active).to.be.true;\n});`
    },
    {
      title: 'Verify Header presence',
      desc: 'Checks if a response header exists',
      code: `pm.test("Content-Type header is present", function () {\n  pm.response.to.have.header("content-type");\n});`
    },
    {
      title: 'Successful POST status (201 Created)',
      desc: 'Validates resource creation',
      code: `pm.test("Successful POST request", function () {\n  pm.expect(pm.response.code).to.be.oneOf([201, 202, 200]);\n});`
    }
  ];

  const activeSnippets = activeSubTab === 'pre' ? preRequestSnippets : postResponseSnippets;

  const handleInsertSnippet = (code: string, title: string) => {
    const updated = currentScript ? currentScript + '\n\n' + code : code;
    currentSetter(updated);
    setCopiedSnippet(title);
    setTimeout(() => setCopiedSnippet(null), 1500);
  };

  const lineCount = (currentScript || '').split('\n').length;
  const lines = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Subtab Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('pre')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'pre'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pre-request Script</span>
            {preRequestScript?.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('post')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'post'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Post-response / Tests Script</span>
            {postResponseScript?.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline">Runtime:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-400 font-mono text-[11px]">
            Postman JS Sandbox (pm.*)
          </span>
          <button
            type="button"
            onClick={() => currentSetter('')}
            className="text-[11px] text-slate-500 hover:text-rose-400 transition ml-2"
            title="Clear script"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Editor & Snippets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Code Editor Container */}
        <div className="lg:col-span-8 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>
              {activeSubTab === 'pre' 
                ? 'JavaScript to execute before the HTTP request is built and sent:'
                : 'JavaScript test assertions to execute immediately after response arrives:'}
            </span>
            <span className="font-mono text-slate-500">
              {lineCount} {lineCount === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <div className="relative rounded-lg border border-slate-800 bg-slate-950 overflow-hidden font-mono text-xs shadow-inner flex">
            {/* Line numbers gutter */}
            <div className="bg-slate-900/60 select-none py-3 px-2 text-right text-slate-600 font-mono text-[11px] border-r border-slate-800/80 min-w-[2.5rem]">
              {lines.map((num) => (
                <div key={num} className="leading-5 h-5">
                  {num}
                </div>
              ))}
            </div>

            {/* Textarea Code Area */}
            <div className="flex-1 relative">
              <textarea
                value={currentScript}
                onChange={(e) => currentSetter(e.target.value)}
                placeholder={
                  activeSubTab === 'pre'
                    ? '// Pre-request Script\n// Executes before the request is sent\npm.environment.set("timestamp", Date.now());\npm.request.headers.add({ key: "X-Trace-Id", value: crypto.randomUUID() });\nconsole.log("Pre-request executed successfully");'
                    : '// Post-response / Tests Script\n// Executes after the response is received\npm.test("Status code is 200", function () {\n  pm.response.to.have.status(200);\n});\n\nconst jsonData = pm.response.json();\npm.environment.set("extractedId", jsonData.id || "123");'
                }
                rows={16}
                spellCheck={false}
                className="w-full h-full min-h-[300px] p-3 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none font-mono text-xs leading-5 resize-y focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
          </div>

          {/* Quick Sandbox Help Guide */}
          <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/70 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Available Sandbox Global Objects:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
              <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                <span className="text-sky-300 font-bold">pm.environment</span>
                <p className="text-slate-400 text-[10px] mt-0.5">.set(k, v), .get(k), .unset(k)</p>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                <span className="text-emerald-300 font-bold">pm.test(name, fn)</span>
                <p className="text-slate-400 text-[10px] mt-0.5">pm.expect(val).to.equal(x) / .to.be.below(x)</p>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                <span className="text-amber-300 font-bold">pm.response</span>
                <p className="text-slate-400 text-[10px] mt-0.5">.json(), .text(), .code, .responseTime, .to.have.status()</p>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                <span className="text-purple-300 font-bold">pm.request & Utilities</span>
                <p className="text-slate-400 text-[10px] mt-0.5">.headers.add(), console.log(), crypto, btoa()</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Snippets Library */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-sky-400" />
              Code Snippets
            </span>
            <span className="text-[10px] text-slate-500">Click to insert</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
            {activeSnippets.map((snippet, idx) => (
              <div
                key={idx}
                onClick={() => handleInsertSnippet(snippet.code, snippet.title)}
                className="p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 cursor-pointer transition flex flex-col gap-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition">
                    {snippet.title}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-sky-400 font-mono transition">
                    {copiedSnippet === snippet.title ? '✓ Added' : '+ Insert'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {snippet.desc}
                </p>
                <div className="mt-1 bg-slate-950 p-1.5 rounded border border-slate-900 font-mono text-[10px] text-slate-400 overflow-x-hidden text-ellipsis whitespace-nowrap">
                  {snippet.code.split('\n')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
