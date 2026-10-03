# ApiDesk — Offline-First Local API Client & Engineering Suite

> **ApiDesk** is a modern, high-performance, offline-first developer suite combining an interactive REST/GraphQL API Client, a low-latency Autocannon-powered Load Testing engine, and an automated Node.js/Bash Script Regression Runner into a unified, zero-lock-in desktop & web workspace.

---

## Table of Contents

1. [Project Overview & Philosophy](#1-project-overview--philosophy)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Core Feature Modules](#3-core-feature-modules)
   - [3.1 API Client & Request Builder](#31-api-client--request-builder)
   - [3.2 Environment Overrides & Variables Engine](#32-environment-overrides--variables-engine)
   - [3.3 High-Performance Load Testing Engine](#33-high-performance-load-testing-engine)
   - [3.4 Script Regression Runner & Terminal Sandbox](#34-script-regression-runner--terminal-sandbox)
   - [3.5 Multi-Mode Storage & Persistence Engine](#35-multi-mode-storage--persistence-engine)
   - [3.6 Comprehensive Logging Engine (`~/apilogs`)](#36-comprehensive-logging-engine-apilogs)
   - [3.7 Native Desktop Distribution (Electron)](#37-native-desktop-distribution-electron)
   - [3.8 Service Atlas](#38-service-atlas)
   - [3.9 Route Explorer](#39-route-explorer)
   - [3.10 DataPulse Publish](#310-datapulse-publish)
   - [3.11 DataPulse Workflow](#311-datapulse-workflow)
   - [3.12 Feature Toggles](#312-feature-toggles)
4. [Codebase Map & Directory Structure](#4-codebase-map--directory-structure)
5. [Data Flow & Execution Lifecycle](#5-data-flow--execution-lifecycle)
6. [Backend API Reference (`server.ts`)](#6-backend-api-reference-serverts)
7. [Developer & AI Model Onboarding Guide](#7-developer--ai-model-onboarding-guide)
   - [7.1 Adding a New Request Feature or Tab](#71-adding-a-new-request-feature-or-tab)
   - [7.2 Adding a New Backend Route](#72-adding-a-new-backend-route)
   - [7.3 Critical Architectural Invariants & Pitfalls](#73-critical-architectural-invariants--pitfalls)
8. [Setup, Build, and Packaging Guide](#8-setup-build-and-packaging-guide)
9. [Complete Tab & View Reference](#9-complete-tab--view-reference)
   - [9.1 Left Sidebar Workspaces](#91-left-sidebar-workspaces)
   - [9.2 Request Builder Sub-Tabs](#92-request-builder-sub-tabs)
   - [9.3 Response Viewer Tabs](#93-response-viewer-tabs)
   - [9.4 Load Tester Sub-Tabs](#94-load-tester-sub-tabs)
   - [9.5 Sidebar Tabs](#95-sidebar-tabs)
10. [Recent UI/UX Enhancements](#10-recent-uiux-enhancements)
    - [10.1 Response Viewer: Copy, Download & Per-Field Copy](#101-response-viewer-copy-download--per-field-copy)
    - [10.2 Global Right-Click Copy/Paste Menu](#102-global-right-click-copypaste-menu)
    - [10.3 Debug Inspector Modal](#103-debug-inspector-modal)
    - [10.4 Smart Request Naming on Save](#104-smart-request-naming-on-save)
    - [10.5 Collection Runner with Pass/Fail Tracking](#105-collection-runner-with-passfail-tracking)
    - [10.6 Bulk Edit for Headers & Params](#106-bulk-edit-for-headers--params)
    - [10.7 Syntax-Highlighted JSON Editing](#107-syntax-highlighted-json-editing)
    - [10.8 Sidebar Search, Drag-and-Drop & Resize](#108-sidebar-search-drag-and-drop--resize)

---

## 1. Project Overview & Philosophy

Modern API development often suffers from cloud-enforced vendor lock-in, sluggish browser-based clients that struggle with CORS or large payloads, and fragmented toolchains where developers need one tool for request authoring (Postman/Insomnia), another for benchmarking (wrk/autocannon), and another for automated regression scripts.

**ApiDesk** unifies these developer workflows into a single offline-first, local-native application built with:
- **Zero Cloud Dependence**: 100% of collections, requests, credentials, and test results reside on your local machine.
- **Dual-Engine Execution**: Direct browser fetch for zero-latency local development or local Node.js proxying (`/api/proxy`) for full CORS bypass, custom SSL toggles, redirect inspection, and granular TCP/DNS/TTFB timing breakdowns.
- **Environment Profiles (Per-Endpoint Overrides)**: Instead of switching environments and manually altering payloads, ApiDesk supports scoped parameter and body profiles per endpoint.
- **Native Autocannon Load Generation**: Run load tests with hundreds of concurrent connections directly against local or remote targets with real-time percentile visualizations (p50, p90, p99, p99.9), Apdex score calculations, and SLA regression comparisons.
- **Interactive Script & Regression Runner**: Run automated tests in Node.js or Bash with live Server-Sent Events (SSE) log streaming, interactive STDIN input, and on-demand NPM package installations.

---

## 2. High-Level Architecture

ApiDesk operates as a full-stack desktop/web hybrid:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ApiDesk Application                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Presentation Layer (React 19)                     │  │
│  │  • RequestBuilder & Tabs (Params, Auth, Headers, Body, Scripts, Tests)│  │
│  │  • LoadTesterView (Autocannon, Recharts charts, SLA / Apdex audit)    │  │
│  │  • ScriptRegressionRunnerView (Node/Bash sandbox, Live SSE, STDIN)    │  │
│  │  • ResponseViewer (JSON/HTML/XML tree, Preview, Timing, Assertions)   │  │
│  │  • Platform Dev Tools: ServiceAtlas, RouteExplorer, DataPulse, FTs    │  │
│  │  • StorageManager, TeamSyncModal, EnvironmentModal, LogsViewerModal   │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                       │
│                         IPC / HTTP / SSE Interface                           │
│                                      │                                       │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                  Backend Runtime (Express 4 + Node.js)                │  │
│  │  • /api/proxy          -> Low-level HTTP/HTTPS agent + timing probes  │  │
│  │  • /api/load-test      -> Autocannon load testing harness             │  │
│  │  • /api/run-script*    -> Child process spawn + SSE streaming + STDIN │  │
│  │  • /api/workspace/disk -> Direct disk sync (~/.apidesk/workspace.json)│  │
│  │  • /api/packages/*     -> NPM package manager for sandbox scripts     │  │
│  │  • /api/logs/*         -> Structured multi-file logging engine        │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                       │
│               Local File System & OS Process Management                     │
│                                      │                                       │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                          Operating System                             │  │
│  │  • Disk Workspace:  ~/.apidesk/workspace.json                         │  │
│  │  • Structured Logs: ~/apilogs/ (app, server, error, scripts, loadtest)│  │
│  │  • Script Packages: ~/.apidesk/scripts/node_modules/                  │  │
│  │  • Native Shell:    Electron shell (macOS DMG/App, Windows NSIS/Exe)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Characteristics:
1. **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion animations + Recharts.
2. **Backend**: Express 4 server compiled via `esbuild` to a standalone, bundled CommonJS file (`dist/server.cjs`).
3. **Desktop Container**: Electron (`electron-main.cjs`) loading the local Express server and opening a native desktop window with macOS traffic light spacing and cross-platform process isolation.

---

## 3. Core Feature Modules

### 3.1 API Client & Request Builder

The primary interface provides a tabbed multi-request editor with support for:
- **HTTP Methods**: Full support for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **URL & Template Resolution**: Real-time double-curly variable interpolation (`{{baseUrl}}/api/v1/users/{{userId}}`) supporting Environment, Collection, and Global variables with dynamic preview.
- **cURL Auto-Detection & Two-Way Translation**:
  - Paste any raw cURL command into the URL bar or Import modal; the parser automatically breaks it down into Method, URL, Query Params, Headers, and Body.
  - Generates production-ready cURL commands (including `--data-urlencode` for urlencoded payloads) and client code in 10+ languages (Fetch, Axios, Python `requests`, Go `net/http`, Node.js, PHP, Ruby, etc.).
- **Authorization Types**:
  - `inherit`: Inherits auth configuration defined at the parent Collection level.
  - `bearer`: Bearer Token with variable resolution.
  - `basic`: Username & password with automatic Base64 encoding.
  - `apikey`: Key/value injected either into Headers or Query Parameters.
  - `oauth2`: OAuth 2.0 Bearer header with customizable prefix.
- **Rich Body Payloads**:
  - `none`: Empty request.
  - `json`: Monospaced JSON editor with auto-formatting, syntax validation, and variable resolution.
  - `form-data`: Key-value pairs supporting text and binary file attachments.
  - `x-www-form-urlencoded`: URL-encoded key-value pairs with automatic cURL `--data-urlencode` generation.
  - `raw`: Plain text, JavaScript, HTML, XML, JSON.
  - `graphql`: Dedicated Query and Variables editors.
  - `binary`: Raw file upload with Base64 preview and size calculation.
- **Assertion & Test Suite**:
  - Declarative assertions: `status_code`, `response_time`, `json_path`, `header_exists`, `body_contains`.
  - Operators: `equals`, `not_equals`, `less_than`, `greater_than`, `contains`, `exists`.
  - Custom JavaScript assertion scripts executed in a sandboxed context with a Chai-like `expect()` syntax.
- **Variable Extractors**: Automatically extracts values from response JSONPath (e.g. `$.data.token`), headers, or status code directly into active environment variables.
- **Pre-Request & Post-Response Scripts**:
  - Full Postman-compatible `pm.*` API (`pm.environment`, `pm.globals`, `pm.variables`, `pm.request`, `pm.response`, `pm.test`, `pm.expect`).
  - Pre-request scripts run before transmission to dynamically sign headers, compute timestamps, or hash payloads.
  - Post-response scripts run upon arrival to parse tokens, update session state, or chain calls.
- **Comprehensive Response Viewer**:
  - HTTP Status badge with standard descriptive text and color coding.
  - Precise network timing breakdowns: DNS lookup, TCP handshake, Time to First Byte (TTFB), content download, and total elapsed time.
  - Formatted, syntax-highlighted viewers for JSON (with interactive collapsible nodes), HTML, XML, raw text, and visual iframe previews.
  - Filterable response headers and downloadable response body.

### 3.2 Environment Overrides & Variables Engine

ApiDesk introduces **Environment-Scoped Request Profiles**:
- When working across `Development`, `Staging`, and `Production`, endpoints often require different query parameters, headers, or body schemas (e.g., mock IDs in dev vs. real UUIDs in prod).
- Rather than duplicating requests into multiple copies, any request can specify `environmentOverrides`:
  ```ts
  request.environmentOverrides[environmentId] = {
    url?: string,
    params?: KeyValuePair[],
    headers?: KeyValuePair[],
    auth?: AuthConfig,
    body?: BodyConfig
  }
  ```
- **Fallback Resolution**: If a field is not overridden for the active environment, it seamlessly inherits from the base default request.
- **Management UI**: The `EnvironmentOverridesModal` provides a dedicated overview to create, inspect, promote to default, or revert overrides across all environments.

### 3.3 High-Performance Load Testing Engine

Accessible via the left menu under **Load Tester** (`LoadTesterView.tsx`):
- **Powered by `autocannon`**: Runs directly inside the local Node.js server to avoid browser networking bottlenecks.
- **Configurable Parameters**: Concurrency, test duration, request pipelining, warm-up intervals, custom request rate limits, and custom payload bodies.
- **Real-Time Visuals**:
  - Live requests/sec (RPS) and bytes/sec throughput graphs.
  - Interactive latency distribution histogram (0ms to 5000ms+).
  - High-precision percentile metrics: min, p50, p75, p90, p99, p99.9, max, standard deviation.
- **Automated SLA & Apdex Score Auditing**:
  - Define max p95 latency thresholds and allowed error rate percentages.
  - Calculates standard Apdex (Application Performance Index) rating: *Satisfied*, *Tolerating*, or *Frustrated*.
- **Historical Comparison & Regression Tracking**: Save test runs to compare latency degradation across builds.

### 3.4 Script Regression Runner & Terminal Sandbox

Accessible via the left menu under **Script Runner** (`ScriptRegressionRunnerView.tsx`):
- **Dual Runtime Support**: Executes either **Node.js** or **Bash** test scripts.
- **Server-Sent Events (SSE) Live Streaming**: Emits real-time `stdout` and `stderr` chunks to the UI via `/api/run-script-stream`.
- **Interactive STDIN Input**: Supports interactive CLI scripts (e.g., `readline`, `prompt()`, bash `read -p`) allowing users to type input into a terminal bar that pipes directly into the running process stdin via `/api/run-script/stdin`.
- **Integrated NPM Package Manager**:
  - Search and install npm packages (`axios`, `lodash`, `jsonwebtoken`, `zod`, etc.) directly into the sandbox directory (`~/.apidesk/scripts`).
  - Scan scripts to detect required modules and auto-install missing packages.
- **Regression Suite Builder**: Group scripts into regression test runs, measure execution times, assert exit codes, and export test reports.

### 3.5 Multi-Mode Storage & Persistence Engine

ApiDesk protects developer data with a 3-tier persistence hierarchy (`/src/utils/storage.ts` and `pcStorage.ts`):
1. **Server Disk (`~/.apidesk/workspace.json`)**: Default storage mode when running the local backend or desktop app. Automatically synchronizes the workspace to disk.
2. **PC File Handle (HTML5 File System Access API)**: In compatible browsers, allows users to bind their workspace directly to a local JSON file of their choice (`my-team-workspace.json`) for seamless Git tracking and auto-saving.
3. **Browser LocalStorage**: Fallback mode for sandboxed web environments or quick ephemeral sessions.

### 3.6 Comprehensive Logging Engine (`~/apilogs`)

Every operational event, HTTP request proxy, load test execution, and script execution is written to structured log files in `~/apilogs/`:
- `server.log`: Inbound HTTP request routes, proxy calls, response times, and status codes.
- `app.log`: Master unified log consolidating all system events.
- `error.log`: All warnings, uncaught exceptions, and rejected promises.
- `scripts.log`: Script execution lifecycles, exit codes, and STDIN/STDOUT activities.
- `loadtest.log`: Load testing startup configurations, progress, and benchmark results.
- `client.log`: Frontend UI errors, storage sync events, and client-side assertions forwarded to the server.

The integrated **Logs Viewer Modal** (`LogsViewerModal.tsx`) allows developers to inspect, filter by level (`info`, `warn`, `error`, `debug`), search, and clear logs directly within the UI.

### 3.7 Native Desktop Distribution (Electron)

ApiDesk ships with a ready-to-run Electron container (`electron-main.cjs`):
- Automatically boots the local Node.js backend on an available port.
- Augments `process.env.PATH` across macOS/Linux to resolve system binaries (`node`, `npm`, `nvm`, `fnm`, `bun`, `brew`, `cargo`).
- Provides native macOS traffic light window spacing and cross-platform desktop menu integration.
- Packaged into `.dmg` and `.app` for macOS, and `.exe` (NSIS installer and portable) for Windows.

### 3.8 Service Atlas

Accessible via the left menu under **Platform Dev Tools → Service Atlas** (`ServiceAtlasView.tsx`) — "Version checker & CAB generator":
- **Live Version Checking**: Looks up a service's deployed version in `dev`/`stg`/`prod` by calling `POST /api/service-version` against each environment's configured host pattern.
- **Search by Service, Team, or Issue Ticket**: Pick a single microservice, select an engineering team (Core Platform, Commerce & Orders, Data & Telemetry, Infrastructure & SRE) to scan every service at once, or search by ticket key.
- **Automatic CAB Paperwork Generation**: Diffs the current production version tag against the staging candidate tag and auto-drafts copy-to-clipboard text blocks for **Basic/Full CAB Details**, **Deployment Changes & Plan**, and **Rollback Process**.
- **Dependency Scope Lookup**: Flags multi-service releases when a ticket spans multiple repositories.
- **Auth**: Uses a personal GitHub PAT (stored locally in `localStorage` under `apidesk_gh_token`) for GitHub release comparisons.

### 3.9 Route Explorer

Accessible via the left menu under **Platform Dev Tools → Route Explorer** (`RouteExplorerView.tsx`) — "Custom OpenAPI spec routes":
- **Custom OpenAPI / Swagger Specs**: Upload any JSON OpenAPI 3.0+ or Swagger 2.0 specification file (or paste raw OpenAPI JSON directly). Specs are parsed, indexed, and persisted locally (`apidesk_custom_specs_v1`).
- **Search, Filter & Send**: Full-text search across paths, summaries, tags, and spec names with HTTP method filters (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`). Any route can be opened directly in the **API Client** workspace or copied as a ready-to-run cURL command.

### 3.10 DataPulse Publish

Accessible via the left menu under **Platform Dev Tools → DataPulse Publish** (`DataPulsePublishView.tsx`) — "Kafka msg fetch & publish":
- **Purpose**: Fetch a real sample message off a Kafka topic, or craft one from scratch, then publish it to a Kafka topic in `dev`/`stage` for seeding test events.
- **Fetch Sample**: `POST /api/kafka/fetch-sample` reads a sample message off the configured topic and populates the editor.
- **Edit & Publish**: Splits the message into an editable partition `Key`, a row-based `Value` editor (or raw syntax-highlighted JSON), and a `Headers` editor; `POST /api/kafka/publish` publishes the envelope and logs broker acknowledgements.
- **Quick-Fill Helpers**: Per-field "Now" (ISO timestamp) and "UUID" (v4 generator) buttons for rapid event seeding.
- **Auth**: Supports custom bootstrap broker hosts and SASL username/password credentials.

### 3.11 DataPulse Workflow

Accessible via the left menu under **Platform Dev Tools → DataPulse Workflow** (`DataPulseWorkflowView.tsx`) — "Template-driven multi-step orchestrator":
- **Purpose**: Create, upload, export, and execute reusable JSON workflow templates that chain **REST API calls (`api_call`)**, **Kafka message publishes (`kafka_publish`)**, **MongoDB operations (`mongodb_op`)**, **Redis commands (`redis_op`)**, **SQL queries (`sql_op`)**, and **Delays (`delay`)** in a single coordinated run.
- **Upload & Export Templates**: Upload a `.json` workflow template file or edit/paste the template JSON directly in the modal to dynamically build the multi-step pipeline (`apidesk_workflow_templates_v1`).
- **Shared Template Variables**: Define shared context variables (e.g., `{{entityId}}`, `{{customerId}}`, `{{apiHost}}`, `{{$isoTimestamp}}`) at the top of the workflow that automatically interpolate into every step's URL, payload, Kafka message, MongoDB filter/document, Redis key, and SQL statement.
- **Independent Step Toggles & "Run Selected Steps"**: Enable or disable any step in the pipeline, execute all enabled steps sequentially via `POST /api/workflow/execute`, inspect live step-by-step execution logs, and copy the complete run summary JSON.

### 3.12 Feature Toggles

Accessible via the left menu under **Platform Dev Tools → Feature Toggles** (`FeatureToggleView.tsx`) — "Browse FT state & overrides":
- **Feature Toggles Tab**: Lists all feature toggles for the selected environment (`dev`/`stage`/`prod`) with search, service filter, and a "Global ON Only" filter; selecting a toggle displays its global state and the exact list of companies/tenants it is enabled for.
- **Companies / Tenants Tab**: Searchable catalog of tenant companies with tier, cloud region, account status, and active override counts.
- **Authentication**: Supports pasting a Bearer token per environment (`apidesk_ft_token_<env>`) or auto-generating one via `POST /api/proxy` against a configurable Token URL.

---

## 4. Codebase Map & Directory Structure

```
/
├── .env.example                  # Environment configuration template
├── package.json                  # NPM packages, build scripts, electron-builder config
├── tsconfig.json                 # TypeScript strict compiler configuration
├── vite.config.ts                # Vite frontend bundler + Tailwind CSS v4 plugin
├── server.ts                     # Local Express 4 backend server & proxy engine
├── electron-main.cjs             # Electron native desktop entry point
├── build-mac-app.sh              # 1-click macOS DMG & App packager
├── build-win-app.sh              # 1-click Windows EXE / NSIS packager
├── public/                       # Static public assets (icons, favicon, manifest)
│
├── src/                          # Frontend Application Root
│   ├── main.tsx                  # React entry point with ErrorBoundary
│   ├── App.tsx                   # Master Workspace orchestrator & state manager
│   ├── index.css                 # Global styling (@import "tailwindcss")
│   ├── types.ts                  # Core TypeScript types (ApiRequest, Workspace, etc.)
│   │
│   ├── components/               # React UI Components
│   │   ├── Navbar.tsx            # Header, environment switcher, view mode toggler
│   │   ├── LeftSideMenu.tsx      # Collapsible nav bar (API/Load/Scripts + Platform Dev Tools)
│   │   ├── TabBar.tsx            # Multi-tab request management & dirty tracking
│   │   ├── Sidebar.tsx           # Collections tree, requests, folders, and history
│   │   ├── RequestBuilder.tsx    # Method, URL, headers, params, body, scripts, tests
│   │   ├── ResponseViewer.tsx    # Response status, timing, body formatters, headers
│   │   ├── AuthTab.tsx           # Authentication configurator (Bearer, Basic, OAuth2)
│   │   ├── BodyTab.tsx           # JSON, Form-data, Form-urlencoded, GraphQL, Raw
│   │   ├── KeyValueEditor.tsx    # Key-value pair editor with autocomplete & toggles
│   │   ├── TestsTab.tsx          # Declarative test assertions & variable extractors
│   │   ├── ScriptsTab.tsx        # Pre-request & post-response script editor
│   │   ├── SettingsTab.tsx       # Per-request timeout, redirect, proxy toggles
│   │   ├── MethodBadge.tsx       # Standardized HTTP method color tags
│   │   ├── LoadTesterView.tsx    # Autocannon load testing interface
│   │   ├── ScriptRegressionRunnerView.tsx # Sandbox script runner & terminal
│   │   ├── EnvironmentModal.tsx  # Environment & Global variable editor
│   │   ├── EnvironmentOverridesModal.tsx # Per-endpoint environment overrides
│   │   ├── StorageManagerModal.tsx # Disk / PC file handle / LocalStorage manager
│   │   ├── TeamSyncModal.tsx     # JSON & Postman Collection import/export
│   │   ├── CurlImportModal.tsx   # cURL command parser & importer
│   │   ├── CodeSnippetModal.tsx  # Code generator (Fetch, Axios, Python, Go, etc.)
│   │   ├── LogsViewerModal.tsx   # Built-in ~/apilogs viewer
│   │   ├── PackageManagerModal.tsx # NPM package installer for scripts
│   │   ├── CollectionRunnerModal.tsx # Multi-request collection execution suite
│   │   ├── DebugInspectorModal.tsx # Diagnostic modal for raw payloads
│   │   ├── ServiceAtlasView.tsx  # Version checker, GitHub diff & CAB doc generator
│   │   ├── RouteExplorerView.tsx # Custom OpenAPI spec route catalog & sender
│   │   ├── DataPulsePublishView.tsx # Kafka sample fetch & manual message publisher
│   │   ├── DataPulseWorkflowView.tsx # Template-driven API, Kafka, MongoDB, Redis & SQL workflow runner
│   │   ├── FeatureToggleView.tsx # Feature toggle & tenant override browser
│   │   ├── GlobalCopyPasteMenu.tsx # Global right-click Copy/Cut/Paste context menu
│   │   ├── HighlightedJsonTextarea.tsx # Syntax-highlighted JSON editor
│   │   └── loadtester/           # Modular components for LoadTesterView
│   │       ├── LoadTesterPresets.tsx
│   │       └── LoadTesterInsightsTab.tsx
│   │
│   └── utils/                    # Core Business Logic & Helpers
│       ├── requestExecutor.ts    # End-to-end request dispatcher (proxy/browser)
│       ├── curlParser.ts         # cURL parser, code generator, and serializer
│       ├── variableResolver.ts   # Double-curly {{var}} template interpolator
│       ├── environmentOverrideHelper.ts # Request override merger & promoter
│       ├── assertionRunner.ts    # Chai-like test assertion evaluation engine
│       ├── scriptEngine.ts       # Postman pm.* sandboxed script runner
│       ├── storage.ts            # High-level workspace load/save dispatcher
│       ├── pcStorage.ts          # File System Access API (live disk binding)
│       ├── postmanConverter.ts   # Postman v2.1 import/export transformer
│       ├── clientLogger.ts       # Frontend client-to-server log forwarder
│       ├── loadTestAnalytics.ts  # Histogram, percentile, and Apdex calculators
│       └── nodeSandboxPolyfill.ts# Safe globals & polyfills for script runner
```

---

## 5. Data Flow & Execution Lifecycle

When a developer clicks **Send** on an API request:

```
[User Clicks "Send"]
         │
         ▼
[getEffectiveRequest(request, activeEnvironmentId)]
  └─ Merges any environmentOverrides (params, body, headers, auth)
         │
         ▼
[runPreRequestScript(effectiveRequest, variableContext)]
  └─ Evaluates pre-request JS; can mutate pm.environment or pm.request
         │
         ▼
[resolveTemplateString on URL, Headers, Params, Body]
  └─ Evaluates double-curly templates: {{baseUrl}}, {{token}}, etc.
         │
         ▼
[Request Settings Check: proxyMode?]
  ├─ TRUE  ──► POST /api/proxy (server-side fetch with raw TCP timing & CORS bypass)
  └─ FALSE ──► Direct window.fetch (in-browser direct call)
         │
         ▼
[Receive HTTP Response + Timing Breakdown]
  └─ Capture status, statusText, headers, raw body, size, and DNS/TCP/TTFB ms
         │
         ▼
[runPostResponseScript(response, variableContext)]
  └─ Evaluates post-response JS; handles tests, token saves, pm.environment
         │
         ▼
[runAssertions(response, request.tests)]
  └─ Evaluates declarative assertions (status, latency, JSONPath, contains)
         │
         ▼
[Variable Extractions]
  └─ Extracts JSONPath, headers, or status code into active Environment variables
         │
         ▼
[Update ResponseViewer & Auto-Save Workspace]
  └─ Displays formatted response, sets dirty state, updates disk/localStorage
```

---

## 6. Backend API Reference (`server.ts`)

The Express server binds to `0.0.0.0:3000` and provides these foundational endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck returning `{ status: "ok", timestamp }`. |
| `GET` | `/api/debug/ping` | Diagnostic check reporting system OS, uptime, and memory. |
| `POST` | `/api/proxy` | **Core HTTP proxy**. Forwards headers, body, cookies; bypasses CORS; measures exact DNS, TCP, TTFB timing; supports gzip decompression and SSL toggle. |
| `ALL` | `/api/echo` | Request inspection endpoint; returns received method, headers, query, and parsed body. |
| `GET` | `/api/workspace/disk` | Reads the active workspace from `~/.apidesk/workspace.json`. |
| `POST` | `/api/workspace/disk` | Saves the active workspace to `~/.apidesk/workspace.json`. |
| `POST` | `/api/load-test` | Spawns an `autocannon` load test run against a target URL with specified duration, connections, headers, and body. |
| `POST` | `/api/run-script` | Executes a Node.js or Bash script synchronously; returns stdout, stderr, and exit code. |
| `POST` | `/api/run-script-stream`| Executes a script with **Server-Sent Events (SSE)** streaming live stdout/stderr chunks. |
| `POST` | `/api/run-script/stdin` | Pipes user input string directly into the standard input (stdin) of an active script. |
| `POST` | `/api/run-script/kill` | Terminates a running script process via `SIGTERM` or `SIGKILL`. |
| `GET` | `/api/packages` | Lists installed NPM packages in `~/.apidesk/scripts/package.json`. |
| `POST` | `/api/packages/install` | Installs an NPM package into `~/.apidesk/scripts` via `npm install`. |
| `POST` | `/api/packages/uninstall` | Removes an NPM package from `~/.apidesk/scripts`. |
| `POST` | `/api/packages/scan-dependencies` | Analyzes script text and returns required packages with installation status. |
| `GET` | `/api/logs` | Lists log files available in `~/apilogs/` with sizes and last modified times. |
| `GET` | `/api/logs/view` | Reads lines from a specific log file with filtering and tail limits. |
| `POST` | `/api/logs/clear` | Truncates or deletes logs in `~/apilogs/`. |
| `POST` | `/api/logs/client` | Ingestion endpoint for frontend log events into `~/apilogs/client.log`. |

---

## 7. Developer & AI Model Onboarding Guide

When modifying or extending ApiDesk, follow these conventions to maintain clean architecture:

### 7.1 Adding a New Request Feature or Tab

1. **Update Data Types (`src/types.ts`)**:
   - Add new attributes to `ApiRequest` or `EnvironmentRequestOverride`.
   - Never use `any` for core request fields; define specific union types.
2. **Handle Environment Overrides (`src/utils/environmentOverrideHelper.ts`)**:
   - If the new feature should support per-environment customization, add the field to `EnvironmentRequestOverride` and update `getEffectiveRequest()` and `updateRequestField()`.
3. **Expose Subtab in RequestBuilder (`src/components/RequestBuilder.tsx`)**:
   - Add the subtab identifier to the tab button list.
   - Create a dedicated component in `src/components/YourTab.tsx` instead of bloating `RequestBuilder.tsx`.
4. **Update Request Executor (`src/utils/requestExecutor.ts`)**:
   - Pass the resolved parameter into `executeApiRequest()` or the proxy payload.

### 7.2 Adding a New Backend Route

1. Open `server.ts`.
2. Register the endpoint before the Vite middleware block:
   ```ts
   app.post("/api/my-feature", async (req, res) => {
     try {
       writeLog("server", "info", "MY_FEATURE", "Executing feature action");
       // logic here
       res.json({ success: true, data: result });
     } catch (err: any) {
       writeLog("error", "error", "MY_FEATURE_ERROR", err.message);
       res.status(500).json({ success: false, error: err.message });
     }
   });
   ```
3. Always wrap file operations or process spawns in `try/catch` blocks and log via `writeLog()`.

### 7.3 Critical Architectural Invariants & Pitfalls

- **Port 3000 Mandate**: The development server and Express backend **MUST** run on port `3000` and bind to `0.0.0.0` for container and reverse-proxy compatibility.
- **Template Literal String Escapes**: When dynamically generating script files or helper wrappers (like `bootstrap-preload.cjs`), **never** output raw unescaped newlines `\n` inside string literals, as this causes Node syntax errors (`Invalid or unexpected token`). Use regex checks (e.g. `/\s$/.test(...)`) or `\\n` escaping.
- **Vite SPA Fallback**: The server uses `app.use(vite.middlewares)` in dev mode and serves `dist/index.html` via `app.get("*")` in production. Any API route MUST start with `/api/` to avoid colliding with the SPA fallback.
- **Single Global CSS**: All styles must be managed via Tailwind CSS utility classes; avoid creating independent `.css` files.

---

## 8. Setup, Build, and Packaging Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ or v22 LTS recommended).
- **npm** or **bun**: For dependency management.

### Development Mode
Start the Vite dev server with the Express backend integrated:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
Compile both the frontend React application and bundle the backend TypeScript server into a single CommonJS executable (`dist/server.cjs`):
```bash
npm run build
npm start
```

### Type Checking & Linting
Validate TypeScript types across the entire client and server:
```bash
npm run lint
```

### Packaging Desktop Applications

#### macOS (.dmg and .app):
Run the automated builder script:
```bash
./build-mac-app.sh
```
Or directly with npm:
```bash
npm run package:mac
```
Output artifacts will be generated in `dist/` (e.g., `ApiDesk-1.0.0.dmg`).

#### Windows (.exe / NSIS Installer / Portable):
Run the Windows builder script or command:
```bash
npm run package:win
```
Output artifacts will be placed in `dist/` (e.g., `ApiDesk Setup 1.0.0.exe`).

---

## 9. Complete Tab & View Reference

ApiDesk has tabs at three nested levels: the **left sidebar** switches between whole workspaces, the **request builder** has sub-tabs per request, and the **response viewer** has sub-tabs per response. This section is a flat, one-stop cheat sheet for all of them.

### 9.1 Left Sidebar Workspaces

| Tab | Component | What it does |
| --- | --- | --- |
| **API Client** | `RequestBuilder.tsx` + `TabBar.tsx` | Default workspace. Multi-tab REST/GraphQL request editor with collections, environments, and the full response viewer. See [3.1](#31-api-client--request-builder). |
| **Load Testing** | `LoadTesterView.tsx` | Autocannon-powered concurrency/stress benchmarking against any endpoint, with live RPS/latency charts and SLA/Apdex scoring. See [3.3](#33-high-performance-load-testing-engine). |
| **Script Automation** | `ScriptRegressionRunnerView.tsx` | Runs Node.js/Bash scripts in a sandbox with live SSE log streaming, interactive STDIN, and an npm package manager. See [3.4](#34-script-regression-runner--terminal-sandbox). |
| **Service Atlas** *(Platform Dev Tools)* | `ServiceAtlasView.tsx` | Checks a service's deployed version per environment and auto-drafts CAB deployment paperwork from a ticket + GitHub diff. See [3.8](#38-service-atlas). |
| **Route Explorer** *(Platform Dev Tools)* | `RouteExplorerView.tsx` | Searchable catalog built from uploaded custom OpenAPI/Swagger specs; send or export any route as a request/cURL. See [3.9](#39-route-explorer). |
| **DataPulse Publish** *(Platform Dev Tools)* | `DataPulsePublishView.tsx` | Fetch a sample Kafka message or craft one by hand, then publish it to a topic in dev/stage. See [3.10](#310-datapulse-publish). |
| **DataPulse Workflow** *(Platform Dev Tools)* | `DataPulseWorkflowView.tsx` | Template-driven workflow orchestrator chaining REST API calls, Kafka publishes, MongoDB, Redis, and SQL steps. See [3.11](#311-datapulse-workflow). |
| **Feature Toggles** *(Platform Dev Tools)* | `FeatureToggleView.tsx` | Browse feature-toggle state (global vs. per-tenant) and look up companies, per environment. See [3.12](#312-feature-toggles). |

The sidebar also has a collapsible **Tools & Utilities** drawer (not a workspace tab) with one-click shortcuts to System Logs, cURL/Postman Import, Environments, Storage & Disk Sync, and Team Sync — each opens a modal rather than switching the main view.

### 9.2 Request Builder Sub-Tabs

Each open request tab in the **API Client** workspace exposes these sub-tabs (`RequestBuilder.tsx`):

| Sub-Tab | Component | What it does |
| --- | --- | --- |
| **Params** | inline in `RequestBuilder.tsx` | Query string key-value pairs, synced bidirectionally with the URL bar. |
| **Auth** | `AuthTab.tsx` | Chooses auth strategy: `Inherit` (from parent collection), `None`, `Bearer Token`, `Basic Auth`, `API Key` (header or query param), or `OAuth 2.0`. |
| **Headers** | inline in `RequestBuilder.tsx` | Request header key-value pairs with enable/disable toggles and variable interpolation. |
| **Body** | `BodyTab.tsx` | Request payload editor: `none`, `JSON`, `form-data` (text + file), `x-www-form-urlencoded`, `raw` (text/JS/HTML/XML), `GraphQL` (query + variables), or `binary` (file upload with Base64 preview). |
| **Scripts** | `ScriptsTab.tsx` | Pre-request and post-response JavaScript editors with a full Postman-compatible `pm.*` API and built-in snippet library. |
| **Tests** | `TestsTab.tsx` | Declarative assertions (`status_code`, `response_time`, `json_path`, `header_exists`, `body_contains`) with quick-add presets, plus custom Chai-like `pm.expect()` scripts. |
| **Settings** | `SettingsTab.tsx` | Per-request toggles: Backend Proxy (CORS bypass), auto-follow redirects, and request timeout (ms). |

### 9.3 Response Viewer Tabs

Once a request completes, `ResponseViewer.tsx` exposes these tabs:

| Tab | What it does |
| --- | --- |
| **Pretty** | Syntax-highlighted, collapsible tree view for JSON/XML/HTML responses. |
| **Raw** | Unformatted raw response text. |
| **Table** | Tabular view, shown only when the JSON response body is an array of objects. |
| **Preview** | Rendered iframe preview, for HTML responses. |
| **Headers** | Filterable list of all response headers. |
| **Tests** | Pass/fail results of the request's assertions (from the **Tests** sub-tab), shown only when assertions exist. |
| **Console** | Captured `console.*` output from pre-request/post-response scripts. |
| **Timing** | Network timing breakdown: DNS lookup, TCP handshake, TTFB, content download, and total elapsed time. |

### 9.4 Load Tester Sub-Tabs

The **Load Testing** workspace (`LoadTesterView.tsx`) has its own two sets of sub-tabs:

**Configuration tabs** (mirrors the request builder, scoped to the load test target): `Settings`, `Headers`, `Auth`, `Params`, `Body`.

**Results tabs** (populated after a run or while one is in progress):

| Tab | What it does |
| --- | --- |
| **Insights** | SLA/Apdex audit summary, percentile breakdown (p50/p75/p90/p99/p99.9), and failure diagnostics. |
| **Charts** | Live/final RPS, throughput, and latency-distribution histograms (Recharts). |
| **History** | Saved past test runs for side-by-side regression comparison. |
| **Export** | Export the current test result/audit as a report. |

### 9.5 Sidebar Tabs

The left **Sidebar** (`Sidebar.tsx`, independent from the left-side workspace menu) has its own two sub-tabs:

| Tab | What it does |
| --- | --- |
| **Collections** | Tree view of all saved collections, folders, and requests. Supports search filtering, drag-and-drop to move requests between collections/folders, and right-click context actions (rename, duplicate, delete, move). |
| **History** | Chronological log of every request sent, independent of whether it was saved. Supports the same search filter and a "Restore from history" action to reopen a past request, plus a "Clear history" action. |

The sidebar panel itself has a drag handle on its edge to resize its width, and the width is persisted across sessions.

---

## 10. Recent UI/UX Enhancements

A running log of notable usability improvements layered on top of the core feature set. Unlike Sections 3 and 9 (what each tab/view *is*), this section tracks *how the day-to-day experience of using them has been refined*.

### 10.1 Response Viewer: Copy, Download & Per-Field Copy

- **Copy Full Response**: A toolbar button in `ResponseViewer.tsx` copies the entire serialized response body to the clipboard in one click, with a transient checkmark confirmation.
- **Download Full Response**: A toolbar button saves the response body to a local file (`response_<timestamp>.json` or `.txt` depending on content type) — useful for large payloads that are impractical to copy/paste.
- **Per-Field Copy in the JSON Tree**: In the **Pretty** tab, hovering any node in the collapsible JSON tree reveals a small inline copy icon that copies just that value (or that subtree as JSON) — no need to copy the whole response to grab one field.

### 10.2 Global Right-Click Copy/Paste Menu

`GlobalCopyPasteMenu.tsx` is mounted once at the app root and replaces the native browser right-click context menu with a minimal **Copy / Paste** menu on every text input and textarea in the app — URL bar, headers, body editors, scripts, everything. It listens globally so no per-component wiring is needed, and respects read-only/disabled fields (hides Paste where it wouldn't apply).

### 10.3 Debug Inspector Modal

`DebugInspectorModal.tsx` is a dedicated diagnostic modal (used across Load Testing, Script Runner, and Platform Dev Tools workflows) that lays out:
- A step-by-step timeline of log entries, each tagged `info` / `warn` / `error` / `success` with a timestamp.
- The exact outbound request (endpoint, method, headers, payload) and the resulting response (status, status text).
- A `CopyButton` next to every section so any part of the request/response/log trail can be copied independently for a bug report or Slack thread.

### 10.4 Smart Request Naming on Save

`SaveRequestModal.tsx` auto-derives a sensible default name from the request URL when saving — e.g. `https://user-profile-service-dev.api.example.com/v1/groupOptions` becomes `v1/groupOptions-dev`. It detects the environment (`-dev`/`-stg`/`-stage`/`-prod`) from the hostname using the same convention used across the rest of the app, and takes the last two meaningful path segments (skipping path parameters like `{id}`) so saved requests stay identifiable in a crowded collection without manual renaming.

### 10.5 Collection Runner with Pass/Fail Tracking

`CollectionRunnerModal.tsx` runs every request in a collection (or a single folder) sequentially against the active environment, tracking each request's state as `pending` → `running` → `passed` / `failed` / `error`. Failed or errored requests can be retried individually, and any assigned test assertions determine pass/fail (not just HTTP status), making it a lightweight regression suite for a whole collection in one click.

### 10.6 Bulk Edit for Headers & Params

The shared `KeyValueEditor.tsx` (used by Params, Headers, and form bodies) has a **Bulk Edit** toggle that switches from the row-by-row key/value UI to a plain `key: value`-per-line textarea — much faster for pasting in a large header set or editing many rows at once, then switching back to the structured view.

### 10.7 Syntax-Highlighted JSON Editing

`HighlightedJsonTextarea.tsx` (used in the Body tab's JSON editor and elsewhere) layers a colorized, read-only `<pre>` behind a real, transparent `<textarea>` so typing, caret movement, and native text selection all behave exactly like a normal textarea — while what the user visually sees is fully syntax-highlighted JSON. Scroll position and font metrics are kept pixel-aligned between the two layers.

### 10.8 Sidebar Search, Drag-and-Drop & Resize

Beyond the Collections/History tabs described in [9.5](#95-sidebar-tabs), the sidebar supports live search filtering across both tabs, drag-and-drop to reorganize requests between collections and folders, and a draggable edge handle to resize the panel — all with the resulting layout persisted across app restarts.

---

## License

MIT License. Free and open source for developers and engineering teams.
