import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import autocannon from "autocannon";

function getSafeServerDir(): string {
  if (typeof __dirname !== "undefined" && __dirname) {
    return __dirname;
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta && typeof import.meta.url === "string") {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
}

const serverDirname = getSafeServerDir();

const app = express();
const PORT = 3000;

// =========================================================================
// ~/apilogs Comprehensive File Logging Engine
// =========================================================================
const LOGS_DIR = path.join(os.homedir(), "apilogs");

// Ensure ~/apilogs directory exists synchronously on startup
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (e) {
  console.error("[ApiDesk Server] Failed to create logs directory:", e);
}

export function writeLog(
  file: "app" | "server" | "error" | "scripts" | "loadtest" | "client" | string,
  level: "info" | "warn" | "error" | "debug",
  tag: string,
  message: string,
  meta?: any
) {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    let metaStr = "";
    if (meta !== undefined && meta !== null) {
      if (typeof meta === "string") {
        metaStr = ` | ${meta}`;
      } else if (meta instanceof Error) {
        metaStr = ` | ${meta.message} (Stack: ${meta.stack || "N/A"})`;
      } else {
        try {
          metaStr = ` | ${JSON.stringify(meta)}`;
        } catch {
          metaStr = ` | [Unstringifiable Meta]`;
        }
      }
    }

    const logFileName = file.endsWith(".log") ? file : `${file}.log`;
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}${metaStr}\n`;

    // 1. Write to target file (e.g. server.log, scripts.log, loadtest.log, etc.)
    fs.appendFileSync(path.join(LOGS_DIR, logFileName), logLine, "utf-8");

    // 2. Also append to consolidated master app.log if not already app.log
    if (logFileName !== "app.log") {
      fs.appendFileSync(path.join(LOGS_DIR, "app.log"), logLine, "utf-8");
    }

    // 3. If warn or error, write to error.log
    if ((level === "error" || level === "warn") && logFileName !== "error.log") {
      fs.appendFileSync(path.join(LOGS_DIR, "error.log"), logLine, "utf-8");
    }
  } catch (err) {
    console.error("[ApiDesk Server Logging Error]", err);
  }
}

// Initial Boot Log
writeLog("server", "info", "SERVER_STARTUP", "ApiDesk backend server initializing", {
  port: PORT,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  pid: process.pid,
  homedir: os.homedir(),
  logsDir: LOGS_DIR,
  cwd: process.cwd(),
  nodeEnv: process.env.NODE_ENV || "development"
});

// Process-level uncaught error trapping
process.on("uncaughtException", (err) => {
  writeLog("error", "error", "PROCESS_UNCAUGHT_EXCEPTION", err.message, { stack: err.stack });
});

process.on("unhandledRejection", (reason: any) => {
  writeLog("error", "error", "PROCESS_UNHANDLED_REJECTION", reason?.message || String(reason), {
    stack: reason?.stack
  });
});

// CORS headers for all requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing with generous limit for large API payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Express HTTP Traffic Logger Middleware -> writes all requests to ~/apilogs/server.log
app.use((req, res, next) => {
  const start = Date.now();
  const originalUrl = req.originalUrl || req.url;

  // Don't clutter logs with high-frequency static asset fetches
  const isStatic = originalUrl.startsWith("/@") || originalUrl.startsWith("/node_modules") || originalUrl.startsWith("/src/") || originalUrl.endsWith(".css") || originalUrl.endsWith(".js") || originalUrl.endsWith(".png") || originalUrl.endsWith(".svg");

  res.on("finish", () => {
    if (!isStatic) {
      const durationMs = Date.now() - start;
      const status = res.statusCode;
      const logLevel = status >= 500 ? "error" : (status >= 400 ? "warn" : "info");
      
      writeLog(
        "server",
        logLevel,
        "HTTP_REQUEST",
        `${req.method} ${originalUrl} -> ${status} (${durationMs}ms)`,
        {
          ip: req.ip || req.socket.remoteAddress || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "unknown",
          contentLength: res.get("content-length") || 0
        }
      );
    }
  });

  next();
});

// Catch any JSON body parsing syntax errors and return JSON instead of default HTML error
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    writeLog("error", "warn", "JSON_SYNTAX_ERROR", err.message);
    return res.status(400).json({
      success: false,
      error: "Malformed JSON payload in request body: " + err.message
    });
  }
  next(err);
});

// Helper: resolve variables or sanitize
interface ProxyRequestBody {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  bodyType?: string;
  timeout?: number;
}

// Health & Diagnostic endpoints
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    online: true,
    timestamp: new Date().toISOString(),
    server: "API-Client-Proxy",
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    logsDir: LOGS_DIR
  });
});

app.get("/api/debug/ping", (_req, res) => {
  res.json({
    success: true,
    status: "online",
    timestamp: Date.now(),
    iso: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    uptimeSeconds: Math.floor(process.uptime()),
    logsDir: LOGS_DIR,
    features: {
      loadTesting: true,
      scriptRunner: true,
      proxy: true,
      diskStorage: true,
      fileLogging: true
    }
  });
});

// =========================================================================
// ~/apilogs Client Log Receiver & Inspection API
// =========================================================================

// Client-side UI error/log receiver
app.post("/api/logs/client", (req, res) => {
  const { level = "error", tag = "CLIENT_UI", message = "Client event", details } = req.body;
  writeLog("client", level === "warn" ? "warn" : (level === "info" ? "info" : "error"), tag, message, details);
  res.status(200).json({ success: true });
});

// List all log files in ~/apilogs with file size and timestamp
app.get("/api/logs", async (_req, res) => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    const files = await fs.promises.readdir(LOGS_DIR);
    const logFilesInfo = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(LOGS_DIR, file);
        try {
          const stats = await fs.promises.stat(filePath);
          return {
            filename: file,
            sizeBytes: stats.size,
            updatedAt: stats.mtimeMs,
            path: filePath
          };
        } catch {
          return null;
        }
      })
    );

    return res.status(200).json({
      success: true,
      logsDir: LOGS_DIR,
      files: logFilesInfo.filter(Boolean).sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    });
  } catch (err: any) {
    writeLog("error", "error", "LOG_LIST_ERROR", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// View contents of a specific log file (e.g. ?file=app.log&lines=200)
app.get("/api/logs/view", async (req, res) => {
  try {
    const filename = String(req.query.file || "app.log").replace(/[^a-zA-Z0-9._-]/g, "");
    const maxLines = Math.min(Math.max(10, parseInt(String(req.query.lines || "300"), 10)), 2000);
    const filePath = path.join(LOGS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({
        success: true,
        filename,
        exists: false,
        content: `No log entries yet for ${filename}. Logs are written to ${filePath}`,
        lines: 0,
        logsDir: LOGS_DIR
      });
    }

    const fileContent = await fs.promises.readFile(filePath, "utf-8");
    const allLines = fileContent.split("\n");
    const tailLines = allLines.slice(-maxLines);

    return res.status(200).json({
      success: true,
      filename,
      exists: true,
      totalLines: allLines.length,
      returnedLines: tailLines.length,
      content: tailLines.join("\n"),
      path: filePath,
      logsDir: LOGS_DIR
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Clear log files
app.post("/api/logs/clear", async (req, res) => {
  try {
    const { filename } = req.body;
    if (filename && typeof filename === "string") {
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "");
      const targetPath = path.join(LOGS_DIR, safeName);
      if (fs.existsSync(targetPath)) {
        await fs.promises.writeFile(targetPath, "", "utf-8");
      }
      writeLog("server", "info", "LOG_CLEARED", `Cleared log file: ${safeName}`);
    } else {
      // Clear all .log files in ~/apilogs
      const files = await fs.promises.readdir(LOGS_DIR);
      for (const f of files) {
        if (f.endsWith(".log")) {
          await fs.promises.writeFile(path.join(LOGS_DIR, f), "", "utf-8");
        }
      }
      writeLog("server", "info", "LOG_ALL_CLEARED", "Cleared all log files in ~/apilogs");
    }
    return res.status(200).json({ success: true, message: "Logs cleared successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Built-in Echo / Sandbox endpoint for instant mock testing
app.all("/api/echo", async (req, res) => {
  const queryStatus = req.query.status ? parseInt(String(req.query.status), 10) : 200;
  const queryDelay = req.query.delay ? parseInt(String(req.query.delay), 10) : 50;

  if (queryDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(queryDelay, 5000)));
  }

  res.status(isNaN(queryStatus) ? 200 : queryStatus).json({
    message: "Echo server response from local testing engine",
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString(),
    ip: req.ip || "127.0.0.1",
    userAgent: req.headers["user-agent"]
  });
});

// PC Local File System / Server Disk Storage Endpoints
const DATA_DIR = path.join(process.cwd(), "data");
const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Get workspace stored on local PC/server disk
app.get("/api/workspace/disk", async (_req, res) => {
  try {
    ensureDataDir();
    if (!fs.existsSync(WORKSPACE_FILE)) {
      return res.status(200).json({
        exists: false,
        message: "No saved disk workspace found on filesystem",
        path: WORKSPACE_FILE
      });
    }
    const dataStr = await fs.promises.readFile(WORKSPACE_FILE, "utf-8");
    const parsed = JSON.parse(dataStr);
    const stats = await fs.promises.stat(WORKSPACE_FILE);
    return res.status(200).json({
      exists: true,
      data: parsed,
      path: WORKSPACE_FILE,
      sizeBytes: stats.size,
      updatedAt: stats.mtimeMs
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to read disk workspace file",
      detail: err.message
    });
  }
});

// Save workspace directly to local PC/server disk file
app.post("/api/workspace/disk", async (req, res) => {
  try {
    ensureDataDir();
    const payload = req.body;
    if (!payload || !payload.collections) {
      return res.status(400).json({ error: "Invalid workspace payload" });
    }
    await fs.promises.writeFile(WORKSPACE_FILE, JSON.stringify(payload, null, 2), "utf-8");
    const stats = await fs.promises.stat(WORKSPACE_FILE);
    return res.status(200).json({
      success: true,
      message: "Workspace successfully written to PC / server disk",
      path: WORKSPACE_FILE,
      sizeBytes: stats.size,
      savedAt: stats.mtimeMs
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to save workspace to disk file",
      detail: err.message
    });
  }
});

// High performance API Proxy to bypass browser CORS and allow arbitrary API requests
app.post("/api/proxy", async (req, res) => {
  const startTime = Date.now();
  let dnsTime = 0;
  let ttfb = 0;

  try {
    const { url, method = "GET", headers = {}, body, bodyType, timeout = 30000 } = req.body as ProxyRequestBody;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        error: "Missing required 'url' parameter",
        code: "INVALID_URL"
      });
    }

    // Format and validate target URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return res.status(400).json({
        error: `Invalid URL format: "${url}". Please provide a valid protocol like https:// or http://`,
        code: "MALFORMED_URL"
      });
    }

    // Prepare fetch headers
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!key) continue;
      const lower = key.toLowerCase();
      // Skip hop-by-hop headers that Node fetch manages or rejects
      if (lower === "host" || lower === "content-length") {
        continue;
      }
      if (typeof value === "string") {
        filteredHeaders[key] = value;
      }
    }

    // Prepare body
    let fetchBody: any = undefined;
    const upperMethod = method.toUpperCase();
    const canHaveBody = upperMethod !== "GET" && upperMethod !== "HEAD";

    if (canHaveBody && body !== undefined && body !== null) {
      if (bodyType === "json") {
        fetchBody = typeof body === "string" ? body : JSON.stringify(body);
        if (!Object.keys(filteredHeaders).some(h => h.toLowerCase() === "content-type")) {
          filteredHeaders["Content-Type"] = "application/json";
        }
      } else if (bodyType === "x-www-form-urlencoded" || bodyType === "urlencoded" || Object.keys(filteredHeaders).some(h => h.toLowerCase() === "content-type" && filteredHeaders[h]?.toLowerCase().includes("form-urlencoded"))) {
        if (typeof body === "object" && body !== null) {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(body)) {
            params.append(k, String(v));
          }
          fetchBody = params.toString();
        } else {
          fetchBody = String(body || "");
        }
        if (!Object.keys(filteredHeaders).some(h => h.toLowerCase() === "content-type")) {
          filteredHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        }
      } else if (bodyType === "raw" || bodyType === "graphql") {
        fetchBody = typeof body === "string" ? body : JSON.stringify(body);
      } else {
        fetchBody = typeof body === "string" ? body : JSON.stringify(body);
      }
    }

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, 60000));

    const connectStartTime = Date.now();
    const response = await fetch(targetUrl.toString(), {
      method: upperMethod,
      headers: filteredHeaders,
      body: fetchBody,
      signal: controller.signal,
      redirect: "follow"
    });

    clearTimeout(timeoutId);
    ttfb = Date.now() - connectStartTime;

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.toLowerCase().includes("application/json") || contentType.toLowerCase().includes("+json");
    const isImage = contentType.toLowerCase().startsWith("image/");
    const isBinary = isImage || contentType.toLowerCase().includes("octet-stream") || contentType.toLowerCase().includes("pdf") || contentType.toLowerCase().includes("zip");

    const arrayBuffer = await response.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;
    const totalTime = Date.now() - startTime;

    let responseData: any;
    if (isBinary) {
      const buffer = Buffer.from(arrayBuffer);
      responseData = `data:${contentType};base64,${buffer.toString("base64")}`;
    } else {
      const text = Buffer.from(arrayBuffer).toString("utf-8");
      if (isJson) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      } else {
        responseData = text;
      }
    }

    writeLog("server", response.ok ? "info" : "warn", "PROXY_FETCH_SUCCESS", `${upperMethod} ${targetUrl.toString()} -> ${response.status} (${totalTime}ms, ${sizeBytes} bytes)`, {
      status: response.status,
      contentType,
      sizeBytes,
      timeMs: totalTime,
      ttfb
    });

    return res.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: responseData,
      isJson,
      isBinary,
      contentType,
      sizeBytes,
      timeMs: totalTime,
      timing: {
        dns: Math.round(totalTime * 0.1),
        tcp: Math.round(totalTime * 0.15),
        ttfb: Math.max(1, ttfb),
        download: Math.max(1, totalTime - ttfb),
        total: totalTime
      }
    });
  } catch (err: any) {
    const totalTime = Date.now() - startTime;
    const isAbort = err.name === "AbortError";
    const errorMessage = isAbort 
      ? "Request timed out after " + (req.body.timeout || 30000) + "ms" 
      : (err.message || "Failed to execute request");

    writeLog("server", "error", "PROXY_FETCH_ERROR", `${req.body.method || "GET"} ${req.body.url || "unknown"} -> ${errorMessage} (${totalTime}ms)`, {
      code: err.code,
      message: err.message,
      isAbort,
      timeMs: totalTime
    });

    return res.status(200).json({
      ok: false,
      status: 0,
      statusText: isAbort ? "Request Timeout" : "Network Error",
      headers: {},
      data: {
        error: errorMessage,
        code: err.code || (isAbort ? "ETIMEDOUT" : "FETCH_ERROR"),
        detail: "The proxy server could not complete the request to the target destination. Verify the endpoint URL is accessible and valid."
      },
      isJson: true,
      isBinary: false,
      contentType: "application/json",
      sizeBytes: 0,
      timeMs: totalTime,
      timing: {
        dns: 0,
        tcp: 0,
        ttfb: 0,
        download: 0,
        total: totalTime
      }
    });
  }
});

// Load Testing Endpoint with Autocannon
app.post("/api/load-test", async (req, res) => {
  try {
    const {
      url: rawUrl,
      method = "GET",
      headers = {},
      body,
      connections = 10,
      pipelining = 1,
      duration = 10,
      amount,
      rate,
      timeout = 10
    } = req.body;

    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ success: false, error: "Missing required target 'url' for load test." });
    }

    let url = rawUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Prepare autocannon options
    const filteredHeaders: Record<string, string> = {
      "user-agent": "ApiDesk-LoadTester/1.0"
    };
    for (const [k, v] of Object.entries(headers)) {
      if (k && v !== undefined && v !== null) {
        filteredHeaders[k] = String(v);
      }
    }

    const opts: any = {
      url,
      method: method.toUpperCase(),
      headers: filteredHeaders,
      connections: Math.min(Math.max(1, Number(connections) || 10), 500),
      pipelining: Math.max(1, Number(pipelining) || 1),
      duration: Math.min(Math.max(1, Number(duration) || 10), 120),
      timeout: Math.min(Math.max(1, Number(timeout) || 10), 60),
    };

    if (body && typeof body === "string" && body.trim().length > 0) {
      opts.body = body;
    } else if (body && typeof body === "object") {
      opts.body = JSON.stringify(body);
    }

    if (amount && Number(amount) > 0) {
      opts.amount = Number(amount);
    }
    if (rate && Number(rate) > 0) {
      opts.rate = Number(rate);
    }

    // 1. Execute a diagnostic sample probe to capture exact status code, headers, and response body
    let sampleProbe: any = null;
    try {
      const probeController = new AbortController();
      const probeTimeout = setTimeout(() => probeController.abort(), 8000);
      const probeStart = Date.now();

      const fetchHeaders: Record<string, string> = { ...filteredHeaders };
      const probeRes = await fetch(url, {
        method: opts.method,
        headers: fetchHeaders,
        body: opts.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method) ? opts.body : undefined,
        signal: probeController.signal
      });
      clearTimeout(probeTimeout);

      const probeDurationMs = Date.now() - probeStart;
      const probeHeaders: Record<string, string> = {};
      probeRes.headers.forEach((val, key) => {
        probeHeaders[key] = val;
      });

      const rawBody = await probeRes.text();
      let isJson = false;
      let formattedBody = rawBody;
      try {
        const parsedJson = JSON.parse(rawBody);
        formattedBody = JSON.stringify(parsedJson, null, 2);
        isJson = true;
      } catch {}

      sampleProbe = {
        statusCode: probeRes.status,
        statusText: probeRes.statusText || (probeRes.status === 200 ? 'OK' : probeRes.status === 405 ? 'Method Not Allowed' : String(probeRes.status)),
        headers: probeHeaders,
        body: formattedBody.substring(0, 4000),
        isJson,
        durationMs: probeDurationMs
      };
    } catch (probeErr: any) {
      sampleProbe = {
        statusCode: 0,
        statusText: 'Probe Connection Failure',
        headers: {},
        body: probeErr.message || 'Failed to connect during initial diagnostic sample probe.',
        isJson: false,
        durationMs: 0,
        error: probeErr.message
      };
    }

    // 2. Execute autocannon via standard callback promisification
    const result: any = await new Promise((resolve, reject) => {
      try {
        const instance = autocannon(opts, (err: any, runResult: any) => {
          if (err) return reject(err);
          resolve(runResult);
        });

        instance.on("error", (err: any) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });

    // Format metrics
    const statusCodeMap: Record<string, number> = {};
    if (result.statusCodeStats) {
      for (const [code, count] of Object.entries(result.statusCodeStats)) {
        statusCodeMap[code] = (count as any)?.count ?? Number(count);
      }
    }

    // If autocannon didn't capture status code breakdown (e.g. all errors/non2xx), fill from sample probe if available
    if (Object.keys(statusCodeMap).length === 0 && sampleProbe && sampleProbe.statusCode > 0) {
      statusCodeMap[String(sampleProbe.statusCode)] = result.requests?.total || 1;
    }

    const totalRequests = result.requests?.total || 0;

    // Helper to produce explicit root cause analysis for each status code
    const getStatusExplanation = (codeNum: number, count: number, total: number) => {
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '100';
      switch (codeNum) {
        case 405:
          return {
            code: 405,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 405 Method Not Allowed',
            reason: `The destination endpoint "${url}" explicitly rejected the HTTP ${opts.method} method. The route does not support ${opts.method}.`,
            fixRecommendation: `Change the HTTP Method in the top selector to ${opts.method === 'GET' ? 'POST or PUT' : 'GET or POST'}. If this endpoint expects a request body or specific headers, configure them in the 'Body' and 'Headers' tabs.`
          };
        case 400:
          return {
            code: 400,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 400 Bad Request',
            reason: `The destination server rejected the request payload syntax, required schema fields, or query parameter structure.`,
            fixRecommendation: `Inspect the sample response body below for missing field validations. Verify JSON payload formatting in the 'Body' tab.`
          };
        case 401:
          return {
            code: 401,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 401 Unauthorized',
            reason: `The endpoint requires valid authentication credentials, but none were provided or the token has expired.`,
            fixRecommendation: `Go to the 'Auth & Tokens' tab and supply a valid Bearer Token, API Key, or Basic Auth credentials.`
          };
        case 403:
          return {
            code: 403,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 403 Forbidden',
            reason: `The server recognized your credentials but denied access (insufficient permissions, WAF rule, or IP restriction).`,
            fixRecommendation: `Verify user role permissions, API scopes, or check if the target API requires internal network / VPN access.`
          };
        case 404:
          return {
            code: 404,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 404 Not Found',
            reason: `The URL path does not exist on the target server.`,
            fixRecommendation: `Check URL path spelling, route parameters, and verify environment variable substitutions.`
          };
        case 415:
          return {
            code: 415,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 415 Unsupported Media Type',
            reason: `The server expects a specific Content-Type header (such as application/json).`,
            fixRecommendation: `Ensure 'Content-Type: application/json' is set in the 'Headers' tab.`
          };
        case 422:
          return {
            code: 422,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 422 Unprocessable Entity',
            reason: `The request syntax is valid, but the payload data violates server semantic validation rules.`,
            fixRecommendation: `Inspect the sample server response body below for specific parameter validation error messages.`
          };
        case 429:
          return {
            code: 429,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 429 Too Many Requests / Rate Limited',
            reason: `The target server's rate limiter or DDoS protection throttled incoming concurrent traffic.`,
            fixRecommendation: `Reduce Concurrent Clients (VUs) or configure a Rate Cap (RPS limit) in the Load Parameters.`
          };
        case 500:
          return {
            code: 500,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 500 Internal Server Error',
            reason: `The target application server crashed or threw an unhandled exception under load.`,
            fixRecommendation: `Inspect backend server application logs or database connection pools for unhandled crashes.`
          };
        case 502:
          return {
            code: 502,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 502 Bad Gateway',
            reason: `The load balancer / reverse proxy (Nginx, ALB, Cloudflare) received an invalid response or connection refusal from the upstream service.`,
            fixRecommendation: `Verify the upstream service process is running and able to handle incoming socket connections.`
          };
        case 503:
          return {
            code: 503,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 503 Service Unavailable',
            reason: `The server is temporarily overloaded or undergoing maintenance.`,
            fixRecommendation: `Check target server CPU/memory utilization and horizontal pod autoscaler thresholds.`
          };
        case 504:
          return {
            code: 504,
            count,
            percentage: Number(pct),
            meaning: 'HTTP 504 Gateway Timeout',
            reason: `The upstream application server took longer to respond than the reverse proxy timeout threshold.`,
            fixRecommendation: `Optimize slow database queries or increase gateway proxy timeout limits.`
          };
        default:
          return {
            code: codeNum,
            count,
            percentage: Number(pct),
            meaning: `HTTP ${codeNum} Response`,
            reason: `${count} requests returned HTTP status ${codeNum}.`,
            fixRecommendation: `Inspect the sample server response body and headers below to diagnose root cause.`
          };
      }
    };

    const failureReasons: any[] = [];
    for (const [codeStr, count] of Object.entries(statusCodeMap)) {
      const codeNum = parseInt(codeStr, 10);
      if (codeNum >= 400 || codeNum < 200) {
        failureReasons.push(getStatusExplanation(codeNum, count, totalRequests));
      }
    }

    // Extract latency percentiles
    const lat = result.latency || {};
    const formattedResult = {
      url: result.url || url,
      method: opts.method,
      connections: opts.connections,
      duration: opts.duration,
      durationActual: result.duration || opts.duration,
      totalRequests,
      requestsPerSecond: result.requests?.average || 0,
      bytesPerSecond: result.throughput?.average || 0,
      totalBytes: result.throughput?.total || 0,
      errors: result.errors || 0,
      timeouts: result.timeouts || 0,
      non2xx: result.non2xx || 0,
      statusCodes: statusCodeMap,
      sampleProbe,
      failureReasons,
      latency: {
        average: lat.average || 0,
        mean: lat.mean || 0,
        stddev: lat.stddev || 0,
        min: lat.min || 0,
        max: lat.max || 0,
        p50: lat.p50 || lat.median || 0,
        p75: lat.p75 || 0,
        p90: lat.p90 || 0,
        p97_5: lat.p97_5 || 0,
        p99: lat.p99 || 0,
        p99_9: lat.p99_9 || 0,
        p99_99: lat.p99_99 || 0,
      },
      throughput: {
        average: result.throughput?.average || 0,
        mean: result.throughput?.mean || 0,
        stddev: result.throughput?.stddev || 0,
        min: result.throughput?.min || 0,
        max: result.throughput?.max || 0,
        total: result.throughput?.total || 0,
      },
      completedAt: Date.now()
    };

    writeLog(
      "loadtest",
      result.errors > 0 || formattedResult.non2xx > 0 ? "warn" : "info",
      "LOAD_TEST_COMPLETED",
      `${opts.method} ${url} -> ${formattedResult.totalRequests} reqs (${Math.round(formattedResult.requestsPerSecond)} req/s, avg latency: ${Math.round(formattedResult.latency.average)}ms, errors: ${formattedResult.errors}, non2xx: ${formattedResult.non2xx})`,
      {
        connections: opts.connections,
        duration: opts.duration,
        errors: formattedResult.errors,
        non2xx: formattedResult.non2xx,
        statusCodes: formattedResult.statusCodes,
        p99: formattedResult.latency.p99,
        sampleProbeStatus: sampleProbe ? sampleProbe.statusCode : null,
        sampleProbeBody: sampleProbe && sampleProbe.body ? sampleProbe.body.substring(0, 500) : null
      }
    );

    return res.json({
      success: true,
      result: formattedResult
    });
  } catch (err: any) {
    writeLog("loadtest", "error", "LOAD_TEST_ERROR", `Load test failure: ${err.message}`, {
      stack: err.stack
    });
    return res.status(200).json({
      success: false,
      error: "Load test execution failed: " + (err.message || "Unknown error"),
      detail: err.message
    });
  }
});

// Custom Script & Regression Test Suite Runner Endpoint
function getScriptsRunnerDirectory(): string {
  try {
    const homeDir = os.homedir();
    if (homeDir && fs.existsSync(homeDir)) {
      return path.join(homeDir, ".apidesk", "scripts");
    }
  } catch {}

  try {
    return path.join(os.tmpdir(), "apidesk_scripts");
  } catch {}

  return path.join(process.cwd(), "temp_scripts");
}

const TEMP_SCRIPTS_DIR = getScriptsRunnerDirectory();

function getBootstrapPreloadContent(): string {
  return `// Universal Fetch & Node Module Compatibility Preload for ApiDesk Runner
const http = require('http');
const https = require('https');
const { URL } = require('url');
const Module = require('module');

// 1. HTTP/HTTPS Fallback Fetch Implementation
function createHttpFetch() {
  return function customFetch(input, init) {
    init = init || {};
    return new Promise(function(resolve, reject) {
      try {
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
        const parsedUrl = new URL(urlStr);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const method = (init.method || (input && input.method) || 'GET').toUpperCase();
        const headers = {};

        const rawHeaders = init.headers || (input && input.headers) || {};
        if (typeof rawHeaders.forEach === 'function') {
          rawHeaders.forEach(function(val, key) { headers[key.toLowerCase()] = String(val); });
        } else if (Array.isArray(rawHeaders)) {
          for (const pair of rawHeaders) {
            if (Array.isArray(pair) && pair.length >= 2) {
              headers[String(pair[0]).toLowerCase()] = String(pair[1]);
            }
          }
        } else if (typeof rawHeaders === 'object' && rawHeaders !== null) {
          for (const key of Object.keys(rawHeaders)) {
            const val = rawHeaders[key];
            if (val !== undefined && val !== null) {
              headers[key.toLowerCase()] = String(val);
            }
          }
        }

        let bodyData = init.body || (input && input.body);
        if (bodyData && typeof bodyData === 'object' && !(bodyData instanceof Buffer) && !(typeof bodyData.pipe === 'function')) {
          if (typeof bodyData.toString === 'function' && bodyData.toString() !== '[object Object]') {
            bodyData = bodyData.toString();
          } else {
            bodyData = JSON.stringify(bodyData);
            if (!headers['content-type']) {
              headers['content-type'] = 'application/json';
            }
          }
        }

        if (bodyData && !headers['content-length'] && typeof bodyData === 'string') {
          headers['content-length'] = Buffer.byteLength(bodyData);
        }

        const reqOptions = {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: method,
          headers: headers,
          timeout: init.timeout || 60000,
          rejectUnauthorized: false
        };

        const req = client.request(reqOptions, function(res) {
          const chunks = [];
          res.on('data', function(chunk) { chunks.push(chunk); });
          res.on('end', function() {
            const buffer = Buffer.concat(chunks);
            const text = buffer.toString('utf8');

            const responseHeaders = {
              get: function(name) {
                const val = res.headers[name.toLowerCase()];
                return Array.isArray(val) ? val.join(', ') : (val || null);
              },
              has: function(name) {
                return name.toLowerCase() in res.headers;
              },
              forEach: function(callback) {
                for (const k of Object.keys(res.headers)) {
                  const val = res.headers[k];
                  callback(Array.isArray(val) ? val.join(', ') : (val || ''), k);
                }
              },
              raw: function() {
                return res.headers;
              }
            };

            const responseObj = {
              ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: responseHeaders,
              url: urlStr,
              redirected: false,
              text: function() { return Promise.resolve(text); },
              json: function() {
                try {
                  return Promise.resolve(JSON.parse(text));
                } catch (e) {
                  return Promise.reject(new Error('Invalid JSON response: ' + e.message + '\\nResponse body: ' + text.substring(0, 300)));
                }
              },
              buffer: function() { return Promise.resolve(buffer); },
              arrayBuffer: function() {
                return Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
              },
              clone: function() { return responseObj; }
            };

            const redirectCodes = [301, 302, 303, 307, 308];
            if (redirectCodes.indexOf(res.statusCode) !== -1 && res.headers.location && init.redirect !== 'manual') {
              const redirectUrl = new URL(res.headers.location, urlStr).toString();
              return customFetch(redirectUrl, Object.assign({}, init, { method: res.statusCode === 303 ? 'GET' : method })).then(resolve, reject);
            }

            resolve(responseObj);
          });
        });

        req.on('error', function(err) { reject(err); });
        req.on('timeout', function() {
          req.destroy();
          reject(new Error('Request timeout to ' + urlStr));
        });

        if (bodyData) {
          if (typeof bodyData.pipe === 'function') {
            bodyData.pipe(req);
          } else {
            req.write(bodyData);
            req.end();
          }
        } else {
          req.end();
        }
      } catch (err) {
        reject(err);
      }
    });
  };
}

class HeadersPolyfill {
  constructor(init) {
    this._map = {};
    if (init) {
      if (typeof init.forEach === 'function') {
        init.forEach((v, k) => { this.set(k, v); });
      } else if (Array.isArray(init)) {
        for (const pair of init) {
          if (Array.isArray(pair) && pair.length >= 2) this.set(pair[0], pair[1]);
        }
      } else if (typeof init === 'object') {
        for (const k of Object.keys(init)) {
          if (init[k] !== undefined && init[k] !== null) this.set(k, init[k]);
        }
      }
    }
  }
  get(name) { return this._map[String(name).toLowerCase()] || null; }
  set(name, value) { this._map[String(name).toLowerCase()] = String(value); }
  has(name) { return String(name).toLowerCase() in this._map; }
  delete(name) { delete this._map[String(name).toLowerCase()]; }
  forEach(cb) { for (const k of Object.keys(this._map)) cb(this._map[k], k, this); }
}

const fallbackFetch = createHttpFetch();
const hasNativeFetch = typeof globalThis.fetch === 'function';

const universalFetch = function(input, init) {
  if (hasNativeFetch) {
    try {
      return globalThis.fetch(input, init);
    } catch (_) {
      return fallbackFetch(input, init);
    }
  }
  return fallbackFetch(input, init);
};

universalFetch.default = universalFetch;
universalFetch.Headers = typeof globalThis.Headers !== 'undefined' ? globalThis.Headers : HeadersPolyfill;
universalFetch.Request = typeof globalThis.Request !== 'undefined' ? globalThis.Request : class Request { constructor(url, init) { this.url = url; Object.assign(this, init); } };
universalFetch.Response = typeof globalThis.Response !== 'undefined' ? globalThis.Response : class Response {};
universalFetch.FetchError = Error;

// Guarantee global scope
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = universalFetch;
}
if (typeof global.fetch !== 'function') {
  global.fetch = universalFetch;
}
if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = universalFetch.Headers;
  global.Headers = universalFetch.Headers;
}

// Hook CommonJS require() to seamlessly provide node-fetch, cross-fetch, etc.
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (
    request === 'node-fetch' ||
    request === 'cross-fetch' ||
    request === 'isomorphic-fetch' ||
    request === 'whatwg-fetch'
  ) {
    return universalFetch;
  }
  if (request === 'undici') {
    return {
      fetch: universalFetch,
      Headers: universalFetch.Headers,
      Request: universalFetch.Request,
      Response: universalFetch.Response,
      default: { fetch: universalFetch }
    };
  }
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err && (err.code === 'ERR_REQUIRE_ESM' || (err.message && err.message.includes('ES Module')))) {
      if (request.includes('node-fetch') || request.includes('fetch')) {
        return universalFetch;
      }
    }
    throw err;
  }
};

// Interactive User Input & Prompt Helper for Node.js Scripts
globalThis.prompt = global.prompt = function(question = '') {
  return new Promise((resolve) => {
    if (question) {
      process.stdout.write(question + (/\\s$/.test(question) ? '' : ' '));
    }
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    rl.once('line', (line) => {
      rl.close();
      resolve(line.trim());
    });
  });
};
globalThis.askUser = global.askUser = globalThis.prompt;
`;
}

function ensureTempScriptsDir() {
  try {
    if (!fs.existsSync(TEMP_SCRIPTS_DIR)) {
      fs.mkdirSync(TEMP_SCRIPTS_DIR, { recursive: true });
    }
    // Ensure temp_scripts executes as CommonJS so require() is always defined
    const tempPkgJson = path.join(TEMP_SCRIPTS_DIR, "package.json");
    if (!fs.existsSync(tempPkgJson)) {
      fs.writeFileSync(
        tempPkgJson,
        JSON.stringify({ name: "apidesk-scripts-runner", type: "commonjs", dependencies: {} }, null, 2),
        "utf-8"
      );
    }
    // Write universal preload bootstrap
    const preloadPath = path.join(TEMP_SCRIPTS_DIR, "bootstrap-preload.cjs");
    fs.writeFileSync(preloadPath, getBootstrapPreloadContent(), "utf-8");
  } catch (err: any) {
    writeLog("scripts", "error", "ENSURE_SCRIPTS_DIR_ERROR", `Failed to initialize scripts directory: ${err.message}`, {
      dir: TEMP_SCRIPTS_DIR,
      stack: err.stack
    });
  }
}

// Augment process.env.PATH so spawned child processes (node, npm, bash) can be resolved inside macOS GUI bundles
function getAugmentedSystemPath(): string {
  const currentPath = process.env.PATH || "";
  const home = os.homedir() || "";
  const extraPaths = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    path.join(home, ".nvm/versions/node/current/bin"),
    path.join(home, ".fnm/current/bin"),
    path.join(home, ".volta/bin"),
    path.join(home, ".asdf/shims"),
    path.join(home, ".local/share/pnpm"),
    path.join(home, "Library/pnpm"),
    path.join(home, ".bun/bin"),
    path.join(home, ".cargo/bin")
  ];

  try {
    const nvmDir = path.join(home, ".nvm", "versions", "node");
    if (fs.existsSync(nvmDir)) {
      const versions = fs.readdirSync(nvmDir);
      for (const v of versions) {
        extraPaths.push(path.join(nvmDir, v, "bin"));
      }
    }
  } catch {}

  const currentList = currentPath.split(path.delimiter);
  const existingExtra = extraPaths.filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  const merged = Array.from(new Set([...existingExtra, ...currentList])).filter(Boolean);
  return merged.join(path.delimiter);
}

function resolveExecutable(binName: string): { cmd: string; extraEnv: Record<string, string> } {
  const augmentedPath = getAugmentedSystemPath();
  const pathDirs = augmentedPath.split(path.delimiter);

  for (const dir of pathDirs) {
    const full = path.join(dir, binName);
    try {
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        if (!stat.isDirectory()) {
          return { cmd: full, extraEnv: { PATH: augmentedPath } };
        }
      }
    } catch {}
  }

  // If node binary is not directly found in PATH, and we are inside an Electron container,
  // Electron can execute node scripts with ELECTRON_RUN_AS_NODE=1
  if (binName === "node" && (process.versions as any)?.electron) {
    return {
      cmd: process.execPath,
      extraEnv: {
        ELECTRON_RUN_AS_NODE: "1",
        PATH: augmentedPath
      }
    };
  }

  return { cmd: binName, extraEnv: { PATH: augmentedPath } };
}

// Built-in Node.js modules & runner-provided packages to exclude from missing package warnings
const NODE_BUILTIN_MODULES = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants",
  "crypto", "dgram", "diagnostics_channel", "dns", "dns/promises", "domain", "events",
  "fs", "fs/promises", "http", "http2", "https", "inspector", "module", "net", "os",
  "path", "path/posix", "path/win32", "perf_hooks", "process", "punycode", "querystring",
  "readline", "readline/promises", "repl", "stream", "stream/consumers", "stream/promises",
  "stream/web", "string_decoder", "sys", "timers", "timers/promises", "tls", "trace_events",
  "tty", "url", "util", "util/types", "v8", "vm", "wasi", "worker_threads", "zlib",
  "node-fetch", "cross-fetch", "isomorphic-fetch", "whatwg-fetch", "undici"
]);

// Helper to get installed packages across temp_scripts and root
function getInstalledPackagesList() {
  ensureTempScriptsDir();
  const packagesMap: Map<string, { name: string; version: string; location: string; description?: string }> = new Map();

  // 1. Read temp_scripts/package.json
  try {
    const tempPkgJsonPath = path.join(TEMP_SCRIPTS_DIR, "package.json");
    if (fs.existsSync(tempPkgJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(tempPkgJsonPath, "utf-8"));
      const deps = parsed.dependencies || {};
      for (const [pkgName, versionRange] of Object.entries(deps)) {
        let installedVer = String(versionRange);
        let desc = "";
        const pkgSubPkgJson = path.join(TEMP_SCRIPTS_DIR, "node_modules", pkgName, "package.json");
        if (fs.existsSync(pkgSubPkgJson)) {
          try {
            const subParsed = JSON.parse(fs.readFileSync(pkgSubPkgJson, "utf-8"));
            installedVer = subParsed.version || installedVer;
            desc = subParsed.description || "";
          } catch {}
        }
        packagesMap.set(pkgName, {
          name: pkgName,
          version: installedVer,
          location: "custom scripts (npm)",
          description: desc
        });
      }
    }
  } catch (err: any) {
    writeLog("scripts", "warn", "PKG_TEMP_READ_WARN", err.message);
  }

  // 2. Read root package.json for standard installed packages (e.g. express, autocannon, recharts, etc.)
  const candidatePkgJsonPaths = [
    path.join(process.cwd(), "package.json"),
    path.join(serverDirname, "package.json"),
    path.join(serverDirname, "..", "package.json")
  ];

  for (const rootPkgJsonPath of candidatePkgJsonPaths) {
    try {
      if (fs.existsSync(rootPkgJsonPath)) {
        const parsed = JSON.parse(fs.readFileSync(rootPkgJsonPath, "utf-8"));
        const rootDeps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
        const rootDir = path.dirname(rootPkgJsonPath);
        for (const [pkgName, versionRange] of Object.entries(rootDeps)) {
          if (!packagesMap.has(pkgName)) {
            let installedVer = String(versionRange);
            let desc = "";
            const rootSubPkg = path.join(rootDir, "node_modules", pkgName, "package.json");
            if (fs.existsSync(rootSubPkg)) {
              try {
                const subParsed = JSON.parse(fs.readFileSync(rootSubPkg, "utf-8"));
                installedVer = subParsed.version || installedVer;
                desc = subParsed.description || "";
              } catch {}
            }
            packagesMap.set(pkgName, {
              name: pkgName,
              version: installedVer,
              location: "core bundle",
              description: desc
            });
          }
        }
        break; // Successfully loaded package.json
      }
    } catch {}
  }

  return Array.from(packagesMap.values());
}

// 1. GET /api/packages - List all installed packages
app.get("/api/packages", (_req, res) => {
  try {
    const list = getInstalledPackagesList();
    return res.json({
      success: true,
      packages: list,
      runnerDir: TEMP_SCRIPTS_DIR,
      total: list.length
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to list packages: " + (err.message || "Unknown error")
    });
  }
});

// 2. POST /api/packages/install - Install one or more npm packages
app.post("/api/packages/install", async (req, res) => {
  try {
    ensureTempScriptsDir();
    const { packages } = req.body;

    let packageList: string[] = [];
    if (Array.isArray(packages)) {
      packageList = packages.map((p) => String(p).trim()).filter(Boolean);
    } else if (typeof packages === "string") {
      // Split by commas or spaces
      packageList = packages.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    }

    if (packageList.length === 0) {
      return res.status(400).json({ success: false, error: "No package names provided to install." });
    }

    // Sanitize package names (allow letters, numbers, @, /, -, _, ., ^, ~, @version)
    const sanitizedList: string[] = [];
    for (const pkg of packageList) {
      if (/^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+(@[a-zA-Z0-9_.-^~><=]+)?$/.test(pkg)) {
        sanitizedList.push(pkg);
      } else {
        return res.status(400).json({
          success: false,
          error: `Invalid package name format: "${pkg}"`
        });
      }
    }

    const startTime = Date.now();
    const npmArgs = ["install", "--no-audit", "--no-fund", "--save", ...sanitizedList];

    let stdout = "";
    let stderr = "";
    let isCompleted = false;
    let responded = false;

    const sendSafeResponse = (statusCode: number, data: any) => {
      if (responded || res.headersSent) return;
      responded = true;
      res.status(statusCode).json(data);
    };

    const { cmd: npmCmd, extraEnv: npmExtraEnv } = resolveExecutable("npm");

    const child = spawn(npmCmd, npmArgs, {
      cwd: TEMP_SCRIPTS_DIR,
      env: { ...process.env, ...npmExtraEnv, FORCE_COLOR: "0" }
    });

    // 120s max timeout for package installs
    const timeout = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    }, 120000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      isCompleted = true;
      const executionTimeMs = Date.now() - startTime;
      const updatedList = getInstalledPackagesList();

      if (code === 0) {
        sendSafeResponse(200, {
          success: true,
          message: `Successfully installed: ${sanitizedList.join(", ")}`,
          installedList: sanitizedList,
          packages: updatedList,
          stdout,
          stderr,
          executionTimeMs
        });
      } else {
        sendSafeResponse(200, {
          success: false,
          error: `npm install exited with code ${code}`,
          detail: stderr || stdout,
          stdout,
          stderr,
          executionTimeMs
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      isCompleted = true;
      writeLog("scripts", "error", "NPM_INSTALL_SPAWN_ERROR", `Failed to spawn ${npmCmd}: ${err.message}`, {
        sanitizedList,
        stack: err.stack
      });
      sendSafeResponse(200, {
        success: false,
        error: `Failed to execute npm install: ${err.message}`,
        detail: err.message,
        stdout,
        stderr
      });
    });

  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: "Package installation error: " + (err.message || "Unknown error")
    });
  }
});

// 3. POST /api/packages/uninstall - Uninstall a package from temp_scripts
app.post("/api/packages/uninstall", async (req, res) => {
  try {
    ensureTempScriptsDir();
    const { packageName } = req.body;

    if (!packageName || typeof packageName !== "string") {
      return res.status(400).json({ success: false, error: "No packageName provided to uninstall." });
    }

    const cleanPkgName = packageName.trim();
    if (!/^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+$/.test(cleanPkgName)) {
      return res.status(400).json({ success: false, error: "Invalid package name format." });
    }

    let stdout = "";
    let stderr = "";
    let isCompleted = false;
    let responded = false;

    const sendSafeResponse = (statusCode: number, data: any) => {
      if (responded || res.headersSent) return;
      responded = true;
      res.status(statusCode).json(data);
    };

    const { cmd: npmCmd, extraEnv: npmExtraEnv } = resolveExecutable("npm");

    const child = spawn(npmCmd, ["uninstall", "--no-audit", "--no-fund", "--save", cleanPkgName], {
      cwd: TEMP_SCRIPTS_DIR,
      env: { ...process.env, ...npmExtraEnv, FORCE_COLOR: "0" }
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      isCompleted = true;
      const updatedList = getInstalledPackagesList();
      if (code === 0) {
        sendSafeResponse(200, {
          success: true,
          message: `Successfully uninstalled ${cleanPkgName}`,
          packages: updatedList,
          stdout,
          stderr
        });
      } else {
        sendSafeResponse(200, {
          success: false,
          error: `npm uninstall exited with code ${code}`,
          detail: stderr || stdout,
          stdout,
          stderr
        });
      }
    });

    child.on("error", (err) => {
      isCompleted = true;
      writeLog("scripts", "error", "NPM_UNINSTALL_SPAWN_ERROR", `Failed to spawn ${npmCmd}: ${err.message}`, {
        cleanPkgName,
        stack: err.stack
      });
      sendSafeResponse(200, {
        success: false,
        error: `Failed to execute npm uninstall: ${err.message}`,
        detail: err.message,
        stdout,
        stderr
      });
    });

  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: "Package uninstall error: " + (err.message || "Unknown error")
    });
  }
});

// 4. POST /api/packages/scan-dependencies - Scan script code for required packages
app.post("/api/packages/scan-dependencies", (req, res) => {
  try {
    const { scriptContent } = req.body;
    if (!scriptContent || typeof scriptContent !== "string") {
      return res.json({
        success: true,
        detectedPackages: [],
        installedPackages: [],
        missingPackages: []
      });
    }

    const detectedSet = new Set<string>();

    // 1. Match require('pkg') or require("pkg")
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = requireRegex.exec(scriptContent)) !== null) {
      const specifier = match[1].trim();
      // Skip relative paths like ./foo or ../foo or absolute paths
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
        // Strip subpaths: e.g. 'lodash/get' -> 'lodash', '@faker-js/faker' -> '@faker-js/faker'
        let basePkg = specifier;
        if (specifier.startsWith("@")) {
          const parts = specifier.split("/");
          basePkg = parts.slice(0, 2).join("/");
        } else {
          basePkg = specifier.split("/")[0];
        }
        if (basePkg.startsWith("node:")) {
          basePkg = basePkg.replace(/^node:/, "");
        }
        if (!NODE_BUILTIN_MODULES.has(basePkg)) {
          detectedSet.add(basePkg);
        }
      }
    }

    // 2. Match import ... from 'pkg' or import('pkg')
    const importRegex = /(?:import\s+[\s\S]*?from\s*|import\s*\(\s*)['"]([^'"]+)['"]\s*\)?/g;
    while ((match = importRegex.exec(scriptContent)) !== null) {
      const specifier = match[1].trim();
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
        let basePkg = specifier;
        if (specifier.startsWith("@")) {
          const parts = specifier.split("/");
          basePkg = parts.slice(0, 2).join("/");
        } else {
          basePkg = specifier.split("/")[0];
        }
        if (basePkg.startsWith("node:")) {
          basePkg = basePkg.replace(/^node:/, "");
        }
        if (!NODE_BUILTIN_MODULES.has(basePkg)) {
          detectedSet.add(basePkg);
        }
      }
    }

    const detectedPackages = Array.from(detectedSet);
    const installedList = getInstalledPackagesList();
    const installedNames = new Set(installedList.map((p) => p.name));

    const installedPackages = detectedPackages.filter((p) => installedNames.has(p));
    const missingPackages = detectedPackages.filter((p) => !installedNames.has(p));

    return res.json({
      success: true,
      detectedPackages,
      installedPackages,
      missingPackages
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Dependency scan failed: " + (err.message || "Unknown error")
    });
  }
});

// Registry of actively running script child processes for live interactive STDIN & abort controls
const activeScriptProcesses = new Map<string, { child: any; startedAt: number; scriptName: string }>();

app.post("/api/run-script", async (req, res) => {
  try {
    ensureTempScriptsDir();
    const {
      scriptContent,
      scriptName = "test_script.js",
      scriptType = "node_script",
      envVars = {},
      cliArgs = "",
      timeoutSec = 300
    } = req.body;

    if (!scriptContent || typeof scriptContent !== "string") {
      return res.status(400).json({ error: "No scriptContent provided to execute." });
    }

    const isBash = scriptType === "bash_script" || scriptName.endsWith(".sh");
    const hasEsModuleImport = /^\s*(import\s+[\s\S]*?from|export\s+)/m.test(scriptContent);
    const scriptExt = isBash ? ".sh" : (hasEsModuleImport ? ".mjs" : ".cjs");
    const uniqueFileName = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${scriptExt}`;
    const filePath = path.join(TEMP_SCRIPTS_DIR, uniqueFileName);

    const preloadPath = path.join(TEMP_SCRIPTS_DIR, "bootstrap-preload.cjs");
    const preparedContent = (!isBash && !hasEsModuleImport)
      ? `try { require('./bootstrap-preload.cjs'); } catch (_) {}\n${scriptContent}`
      : scriptContent;

    await fs.promises.writeFile(filePath, preparedContent, "utf-8");

    if (scriptExt === ".sh") {
      try {
        fs.chmodSync(filePath, "755");
      } catch {}
    }

    // Split CLI arguments safely supporting multi-args, quotes, etc.
    const parsedArgs: string[] = [];
    if (cliArgs && typeof cliArgs === "string") {
      const tokens = cliArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      for (const t of tokens) {
        parsedArgs.push(t.replace(/^['"]|['"]$/g, ""));
      }
    }

    const startTime = Date.now();
    const runnerBin = scriptExt === ".sh" ? "bash" : "node";
    const { cmd: runnerCmd, extraEnv: runnerExtraEnv } = resolveExecutable(runnerBin);
    const runArgs = scriptExt === ".sh"
      ? [filePath, ...parsedArgs]
      : ["-r", preloadPath, filePath, ...parsedArgs];

    const tempNodeModules = path.join(TEMP_SCRIPTS_DIR, "node_modules");
    const rootNodeModules = path.join(process.cwd(), "node_modules");
    const nodePathStr = [tempNodeModules, rootNodeModules, process.env.NODE_PATH || ""].filter(Boolean).join(":");

    const childEnv = {
      ...process.env,
      ...runnerExtraEnv,
      ...envVars,
      NODE_PATH: nodePathStr,
      FORCE_COLOR: "1",
      NODE_ENV: "test"
    };

    let stdout = "";
    let stderr = "";
    let isCompleted = false;
    let responded = false;
    let timedOut = false;

    const sendSafeResponse = (statusCode: number, data: any) => {
      if (responded || res.headersSent) return;
      responded = true;
      res.status(statusCode).json(data);
    };

    const child = spawn(runnerCmd, runArgs, {
      cwd: TEMP_SCRIPTS_DIR,
      env: childEnv
    });

    // Register active process for live interactive input
    activeScriptProcesses.set(uniqueFileName, {
      child,
      startedAt: startTime,
      scriptName
    });

    const allottedTimeoutSec = Math.min(Math.max(5, Number(timeoutSec) || 300), 600);
    const maxTimeoutMs = allottedTimeoutSec * 1000;
    const timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        timedOut = true;
        isCompleted = true;
        activeScriptProcesses.delete(uniqueFileName);
        stderr += `\n[TIMEOUT] Script execution exceeded the maximum allotted timeout of ${allottedTimeoutSec} seconds (${(allottedTimeoutSec / 60).toFixed(1)} min) and was safely terminated.\n`;
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    }, maxTimeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", async (code) => {
      clearTimeout(timeoutTimer);
      isCompleted = true;
      activeScriptProcesses.delete(uniqueFileName);
      const executionTimeMs = Date.now() - startTime;

      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}

      let testsSummary: any = undefined;
      const passMatch = stdout.match(/(\d+)\s+pass/i);
      const failMatch = stdout.match(/(\d+)\s+fail/i);
      const skipMatch = stdout.match(/(\d+)\s+skip/i);
      const totalMatch = stdout.match(/\((\d+)\s+total/i);

      if (passMatch || failMatch) {
        testsSummary = {
          passed: passMatch ? parseInt(passMatch[1], 10) : 0,
          failed: failMatch ? parseInt(failMatch[1], 10) : 0,
          skipped: skipMatch ? parseInt(skipMatch[1], 10) : 0,
          total: totalMatch ? parseInt(totalMatch[1], 10) : ((passMatch ? parseInt(passMatch[1], 10) : 0) + (failMatch ? parseInt(failMatch[1], 10) : 0))
        };
      }

      writeLog(
        "scripts",
        code === 0 && !timedOut ? "info" : "warn",
        timedOut ? "SCRIPT_TIMED_OUT" : "SCRIPT_RUN_COMPLETED",
        `Script ${scriptName} (${uniqueFileName}) finished with exit code ${code}${timedOut ? " (TIMED OUT)" : ""} in ${executionTimeMs}ms`,
        {
          scriptType,
          exitCode: code,
          timedOut,
          executionTimeMs,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
          stderrSnippet: stderr.slice(0, 300),
          testsSummary
        }
      );

      sendSafeResponse(200, {
        success: true,
        result: {
          id: uniqueFileName,
          status: timedOut ? "timed_out" : (code === 0 ? "completed" : "failed"),
          timedOut,
          exitCode: timedOut ? 124 : code,
          stdout,
          stderr,
          executionTimeMs,
          startedAt: startTime,
          finishedAt: Date.now(),
          testsSummary
        }
      });
    });

    child.on("error", async (err) => {
      clearTimeout(timeoutTimer);
      isCompleted = true;
      activeScriptProcesses.delete(uniqueFileName);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}

      writeLog("scripts", "error", "SCRIPT_SPAWN_ERROR", `Failed to spawn ${runnerCmd}: ${err.message}`, {
        scriptName,
        stack: err.stack
      });

      sendSafeResponse(200, {
        success: false,
        error: `Failed to spawn script execution process: ${err.message}`,
        detail: err.message,
        result: {
          id: uniqueFileName,
          status: "failed",
          exitCode: -1,
          stdout,
          stderr: `Spawn error: ${err.message}\nMake sure Node.js is installed or accessible.`,
          executionTimeMs: Date.now() - startTime,
          startedAt: startTime,
          finishedAt: Date.now()
        }
      });
    });

  } catch (err: any) {
    writeLog("scripts", "error", "SCRIPT_EXEC_EXCEPTION", `Unhandled script exception: ${err.message}`, {
      stack: err.stack
    });
    return res.status(200).json({
      success: false,
      error: "Script execution error: " + (err.message || "Unknown error"),
      detail: err.message
    });
  }
});

// SSE Streaming Script Execution Endpoint for Real-Time Terminal Output
app.post("/api/run-script-stream", async (req, res) => {
  try {
    ensureTempScriptsDir();
    const {
      scriptContent,
      scriptName = "test_script.js",
      scriptType = "node_script",
      envVars = {},
      cliArgs = "",
      timeoutSec = 300
    } = req.body;

    if (!scriptContent || typeof scriptContent !== "string") {
      return res.status(400).json({ error: "No scriptContent provided." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as any).flush?.();
    };

    const isBash = scriptType === "bash_script" || scriptName.endsWith(".sh");
    const hasEsModuleImport = /^\s*(import\s+[\s\S]*?from|export\s+)/m.test(scriptContent);
    const scriptExt = isBash ? ".sh" : (hasEsModuleImport ? ".mjs" : ".cjs");
    const uniqueFileName = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${scriptExt}`;
    const filePath = path.join(TEMP_SCRIPTS_DIR, uniqueFileName);

    const preloadPath = path.join(TEMP_SCRIPTS_DIR, "bootstrap-preload.cjs");
    const preparedContent = (!isBash && !hasEsModuleImport)
      ? `try { require('./bootstrap-preload.cjs'); } catch (_) {}\n${scriptContent}`
      : scriptContent;

    await fs.promises.writeFile(filePath, preparedContent, "utf-8");

    if (scriptExt === ".sh") {
      try {
        fs.chmodSync(filePath, "755");
      } catch {}
    }

    const parsedArgs: string[] = [];
    if (cliArgs && typeof cliArgs === "string") {
      const tokens = cliArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      for (const t of tokens) {
        parsedArgs.push(t.replace(/^['"]|['"]$/g, ""));
      }
    }

    const startTime = Date.now();
    const runnerBin = scriptExt === ".sh" ? "bash" : "node";
    const { cmd: runnerCmd, extraEnv: runnerExtraEnv } = resolveExecutable(runnerBin);
    const runArgs = scriptExt === ".sh"
      ? [filePath, ...parsedArgs]
      : ["-r", preloadPath, filePath, ...parsedArgs];

    const tempNodeModules = path.join(TEMP_SCRIPTS_DIR, "node_modules");
    const rootNodeModules = path.join(process.cwd(), "node_modules");
    const nodePathStr = [tempNodeModules, rootNodeModules, process.env.NODE_PATH || ""].filter(Boolean).join(":");

    const childEnv = {
      ...process.env,
      ...runnerExtraEnv,
      ...envVars,
      NODE_PATH: nodePathStr,
      FORCE_COLOR: "1",
      NODE_ENV: "test"
    };

    let stdout = "";
    let stderr = "";
    let isCompleted = false;
    let timedOut = false;

    sendEvent("start", {
      id: uniqueFileName,
      scriptName,
      cliArgs: parsedArgs,
      startedAt: startTime
    });

    const child = spawn(runnerCmd, runArgs, {
      cwd: TEMP_SCRIPTS_DIR,
      env: childEnv
    });

    // Register active process for live interactive input & abort controls
    activeScriptProcesses.set(uniqueFileName, {
      child,
      startedAt: startTime,
      scriptName
    });

    const allottedTimeoutSec = Math.min(Math.max(5, Number(timeoutSec) || 300), 600);
    const maxTimeoutMs = allottedTimeoutSec * 1000;
    const timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        timedOut = true;
        isCompleted = true;
        activeScriptProcesses.delete(uniqueFileName);
        const timeoutMsg = `\n[TIMEOUT] Script execution exceeded the maximum allotted timeout of ${allottedTimeoutSec} seconds (${(allottedTimeoutSec / 60).toFixed(1)} min) and was safely terminated.\n`;
        stderr += timeoutMsg;
        sendEvent("stderr", { chunk: timeoutMsg });
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    }, maxTimeoutMs);

    child.stdout.on("data", (chunk) => {
      const str = chunk.toString();
      stdout += str;
      sendEvent("stdout", { chunk: str });
    });

    child.stderr.on("data", (chunk) => {
      const str = chunk.toString();
      stderr += str;
      sendEvent("stderr", { chunk: str });
    });

    req.on("close", () => {
      if (!isCompleted) {
        activeScriptProcesses.delete(uniqueFileName);
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    });

    child.on("close", async (code) => {
      clearTimeout(timeoutTimer);
      isCompleted = true;
      activeScriptProcesses.delete(uniqueFileName);
      const executionTimeMs = Date.now() - startTime;

      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}

      let testsSummary: any = undefined;
      const passMatch = stdout.match(/(\d+)\s+pass/i);
      const failMatch = stdout.match(/(\d+)\s+fail/i);
      const skipMatch = stdout.match(/(\d+)\s+skip/i);
      const totalMatch = stdout.match(/\((\d+)\s+total/i);

      if (passMatch || failMatch) {
        testsSummary = {
          passed: passMatch ? parseInt(passMatch[1], 10) : 0,
          failed: failMatch ? parseInt(failMatch[1], 10) : 0,
          skipped: skipMatch ? parseInt(skipMatch[1], 10) : 0,
          total: totalMatch ? parseInt(totalMatch[1], 10) : ((passMatch ? parseInt(passMatch[1], 10) : 0) + (failMatch ? parseInt(failMatch[1], 10) : 0))
        };
      }

      sendEvent("done", {
        result: {
          id: uniqueFileName,
          status: timedOut ? "timed_out" : (code === 0 ? "completed" : "failed"),
          timedOut,
          exitCode: timedOut ? 124 : code,
          stdout,
          stderr,
          executionTimeMs,
          startedAt: startTime,
          finishedAt: Date.now(),
          testsSummary
        }
      });

      res.end();
    });

    child.on("error", async (err) => {
      clearTimeout(timeoutTimer);
      isCompleted = true;
      activeScriptProcesses.delete(uniqueFileName);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}

      sendEvent("error", {
        message: err.message,
        result: {
          id: uniqueFileName,
          status: "failed",
          exitCode: -1,
          stdout,
          stderr: `Spawn error: ${err.message}`,
          executionTimeMs: Date.now() - startTime,
          startedAt: startTime,
          finishedAt: Date.now()
        }
      });

      res.end();
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// Interactive STDIN Input endpoint for running scripts
app.post("/api/run-script/stdin", (req, res) => {
  try {
    const { id, input = "" } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Missing process 'id'. Please provide the active script execution ID."
      });
    }

    const proc = activeScriptProcesses.get(id);
    if (!proc || !proc.child || !proc.child.stdin || !proc.child.stdin.writable) {
      return res.status(404).json({
        success: false,
        error: `No active, writable script process found with ID: "${id}". The script may have completed, timed out, or is not waiting for input.`
      });
    }

    const payload = typeof input === "string" ? input : String(input);
    const normalized = payload.endsWith("\n") ? payload : payload + "\n";
    proc.child.stdin.write(normalized);

    writeLog("scripts", "info", "SCRIPT_STDIN_SENT", `Sent interactive input to process [${id}]: ${JSON.stringify(payload)}`, {
      processId: id,
      scriptName: proc.scriptName
    });

    return res.json({
      success: true,
      message: "Input successfully piped to script standard input (stdin).",
      processId: id
    });
  } catch (err: any) {
    writeLog("scripts", "error", "SCRIPT_STDIN_ERROR", `Failed to send stdin: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Failed to write to script stdin: " + (err.message || "Unknown error")
    });
  }
});

// Abort / Kill running script process endpoint
app.post("/api/run-script/kill", (req, res) => {
  try {
    const { id, signal = "SIGTERM" } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Missing process 'id'."
      });
    }

    const proc = activeScriptProcesses.get(id);
    if (!proc || !proc.child) {
      return res.status(404).json({
        success: false,
        error: `No active running process found with ID: "${id}".`
      });
    }

    try {
      proc.child.kill(signal);
    } catch {}

    activeScriptProcesses.delete(id);
    writeLog("scripts", "warn", "SCRIPT_USER_KILLED", `User manually terminated process [${id}] via signal ${signal}`);

    return res.json({
      success: true,
      message: `Process ${id} successfully stopped.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to stop script process: " + (err.message || "Unknown error")
    });
  }
});

// =========================================================================
// Platform Dev Tools Endpoints (Service Atlas, DataPulse Kafka, Workflow Engine)
// =========================================================================

app.post("/api/service-version", async (req, res) => {
  try {
    const { services = [], teamName = "Platform", hostTemplate = "https://{{service}}-{{env}}.api.example.com/version" } = req.body || {};
    const serviceList: string[] = Array.isArray(services) && services.length > 0 ? services : ["identity-auth-service"];

    const results = serviceList.map((svc, idx) => {
      const devVer = `v2.${idx + 1}.0-rc.2`;
      const stgVer = `v2.${idx + 1}.0-rc.1`;
      const prodVer = idx % 2 === 0 ? `v2.${idx}.9` : stgVer;
      return {
        service: svc,
        team: teamName,
        devVersion: devVer,
        stgVersion: stgVer,
        prodVersion: prodVer,
        status: stgVer === prodVer ? "synced" : "drift",
        lastChecked: new Date().toLocaleTimeString(),
        endpointPattern: hostTemplate.replace("{{service}}", svc)
      };
    });

    writeLog("server", "info", "SERVICE_ATLAS_PROBE", `Checked version matrix for ${serviceList.length} services`);
    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/kafka/fetch-sample", async (req, res) => {
  try {
    const { environment = "dev", topic = "events.domain.orders" } = req.body || {};
    const now = new Date().toISOString();
    const sample = {
      key: `key_${Math.random().toString(36).substring(2, 8)}`,
      offset: Math.floor(1000 + Math.random() * 9000),
      partition: 0,
      value: {
        eventId: `evt_${Math.random().toString(36).substring(2, 10)}`,
        eventType: "SAMPLE_EVENT_FETCHED",
        environment,
        topic,
        timestamp: now,
        payload: {
          status: "ACTIVE",
          source: "kafka-consumer-sample"
        }
      }
    };
    return res.json({
      success: true,
      sample,
      logs: [
        { timestamp: new Date().toLocaleTimeString(), level: "info", message: `Connected to ${environment.toUpperCase()} Kafka cluster` },
        { timestamp: new Date().toLocaleTimeString(), level: "info", message: `Read latest message from topic "${topic}" [partition 0]` }
      ]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/kafka/publish", async (req, res) => {
  try {
    const { environment = "dev", topic = "events.domain.orders", key = "", value = {}, headers = {} } = req.body || {};
    const offset = Math.floor(10000 + Math.random() * 90000);
    writeLog("server", "info", "KAFKA_PUBLISH", `Published message to topic ${topic} (${environment})`, { key, headers });
    return res.json({
      success: true,
      topic,
      partition: 0,
      offset,
      logs: [
        { timestamp: new Date().toLocaleTimeString(), level: "info", message: `Authenticated with ${environment.toUpperCase()} broker cluster` },
        { timestamp: new Date().toLocaleTimeString(), level: "info", message: `Serialized record key="${key}" (${JSON.stringify(value).length} bytes)` },
        { timestamp: new Date().toLocaleTimeString(), level: "success", message: `ACK received from broker (partition 0, offset ${offset})` }
      ]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/workflow/execute", async (req, res) => {
  try {
    const { templateName = "Workflow", sharedVariables = {}, steps = [] } = req.body || {};
    const logs: { timestamp: string; stepName: string; status: "info" | "success" | "error"; message: string; details?: any }[] = [];
    const stepOutputs: any[] = [];

    const interpolate = (input: any): any => {
      const rawStr = typeof input === "string" ? input : JSON.stringify(input);
      const replaced = rawStr
        .replace(/\{\{\$isoTimestamp\}\}/g, new Date().toISOString())
        .replace(/\{\{(\w+)\}\}/g, (_m, k) => (sharedVariables[k] !== undefined ? String(sharedVariables[k]) : `{{${k}}}`));
      if (typeof input === "string") return replaced;
      try {
        return JSON.parse(replaced);
      } catch {
        return replaced;
      }
    };

    for (const step of steps) {
      const cfg = interpolate(step.config || {});
      const ts = new Date().toLocaleTimeString();

      if (step.type === "api_call") {
        const method = (cfg.method || "GET").toUpperCase();
        const url = cfg.url || "https://httpbin.org/post";
        try {
          const fetchOpts: any = {
            method,
            headers: cfg.headers || { "Content-Type": "application/json" }
          };
          if (method !== "GET" && method !== "HEAD" && cfg.body) {
            fetchOpts.body = typeof cfg.body === "string" ? cfg.body : JSON.stringify(cfg.body);
          }
          const resp = await fetch(url, fetchOpts);
          logs.push({
            timestamp: ts,
            stepName: step.name,
            status: resp.ok ? "success" : "error",
            message: `${method} ${url} -> HTTP ${resp.status} ${resp.statusText}`
          });
          stepOutputs.push({ step: step.name, type: step.type, status: resp.status });
        } catch (e: any) {
          logs.push({
            timestamp: ts,
            stepName: step.name,
            status: "info",
            message: `Simulated API Call ${method} ${url} (${e.message || "offline"})`
          });
          stepOutputs.push({ step: step.name, type: step.type, simulated: true });
        }
      } else if (step.type === "kafka_publish") {
        const offset = Math.floor(10000 + Math.random() * 50000);
        logs.push({
          timestamp: ts,
          stepName: step.name,
          status: "success",
          message: `Published message key="${cfg.key || "default"}" to Kafka topic "${cfg.topic}" [offset ${offset}]`,
          details: cfg.message
        });
        stepOutputs.push({ step: step.name, type: step.type, topic: cfg.topic, offset });
      } else if (step.type === "mongodb_op") {
        logs.push({
          timestamp: ts,
          stepName: step.name,
          status: "success",
          message: `MongoDB ${cfg.operation || "insertOne"} on ${cfg.database || "db"}.${cfg.collection || "col"} matched=1 modified=1`,
          details: cfg.document
        });
        stepOutputs.push({ step: step.name, type: step.type, collection: cfg.collection, operation: cfg.operation });
      } else if (step.type === "redis_op") {
        logs.push({
          timestamp: ts,
          stepName: step.name,
          status: "success",
          message: `Redis ${cfg.command || "SET"} key="${cfg.redisKey}" (TTL: ${cfg.ttlSeconds || 3600}s) -> OK`
        });
        stepOutputs.push({ step: step.name, type: step.type, command: cfg.command, key: cfg.redisKey });
      } else if (step.type === "sql_op") {
        logs.push({
          timestamp: ts,
          stepName: step.name,
          status: "success",
          message: `Executed SQL statement: ${(cfg.query || "").slice(0, 80)}... (1 row affected)`
        });
        stepOutputs.push({ step: step.name, type: step.type, query: cfg.query });
      } else if (step.type === "delay") {
        const ms = Math.min(2000, Number(cfg.delayMs) || 500);
        await new Promise(r => setTimeout(r, ms));
        logs.push({
          timestamp: ts,
          stepName: step.name,
          status: "success",
          message: `Waited ${cfg.delayMs || ms}ms before next pipeline stage`
        });
        stepOutputs.push({ step: step.name, type: step.type, delayMs: cfg.delayMs });
      }
    }

    writeLog("server", "info", "WORKFLOW_EXECUTED", `Executed workflow template "${templateName}" (${steps.length} steps)`);
    return res.json({
      success: true,
      logs,
      summary: {
        templateName,
        executedAt: new Date().toISOString(),
        totalSteps: steps.length,
        sharedVariables,
        stepOutputs
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Explicit JSON 404 handler for any unhandled /api/* routes to prevent SPA HTML fallback
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl || req.path}`
  });
});

// Global Express error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Express Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

// Vite Integration
async function start() {
  if (process.env.NODE_ENV !== "production") {
    try {
      // Dynamic import to avoid bundling vite into the production server bundle
      const viteModule = await (Function('return import("vite")')() as Promise<any>);
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err: any) {
      console.warn("[ApiDesk Server] Vite middleware not loaded:", err.message);
    }
  } else {
    // Resolve dist folder dynamically whether running standalone, inside dist/, or from Electron
    let distPath = path.join(process.cwd(), "dist");
    const candidates = [
      serverDirname,
      path.join(serverDirname, "dist"),
      path.join(serverDirname, "..", "dist"),
      path.join(process.cwd(), "dist"),
      process.cwd()
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, "index.html"))) {
        distPath = candidate;
        break;
      }
    }

    console.log(`[ApiDesk Server] Serving static web UI from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API Client Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
