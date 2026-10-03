const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Augment process.env.PATH so spawned child processes (node, npm, bash, git) can be resolved inside macOS GUI bundles
function augmentSystemPath() {
  const home = os.homedir() || '';
  const extraPaths = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    path.join(home, '.nvm/versions/node/current/bin'),
    path.join(home, '.fnm/current/bin'),
    path.join(home, '.volta/bin'),
    path.join(home, '.asdf/shims'),
    path.join(home, '.local/share/pnpm'),
    path.join(home, 'Library/pnpm'),
    path.join(home, '.bun/bin'),
    path.join(home, '.cargo/bin')
  ];

  try {
    const nvmDir = path.join(home, '.nvm', 'versions', 'node');
    if (fs.existsSync(nvmDir)) {
      const versions = fs.readdirSync(nvmDir);
      for (const v of versions) {
        extraPaths.push(path.join(nvmDir, v, 'bin'));
      }
    }
  } catch {}

  const currentPaths = (process.env.PATH || '').split(path.delimiter);
  const existingExtra = extraPaths.filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  const merged = Array.from(new Set([...existingExtra, ...currentPaths])).filter(Boolean);
  process.env.PATH = merged.join(path.delimiter);
}

augmentSystemPath();

const PORT = process.env.PORT || 3000;
const LOGS_DIR = path.join(os.homedir(), 'apilogs');

// Ensure ~/apilogs directory exists
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (e) {
  console.error('[ApiDesk] Failed to create ~/apilogs directory:', e);
}

function writeElectronLog(level, tag, message, meta) {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta !== undefined && meta !== null) {
      metaStr = typeof meta === 'string' ? ` | ${meta}` : ` | ${JSON.stringify(meta)}`;
    }
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}${metaStr}\n`;

    // Append to electron.log
    fs.appendFileSync(path.join(LOGS_DIR, 'electron.log'), logLine, 'utf-8');
    // Append to app.log
    fs.appendFileSync(path.join(LOGS_DIR, 'app.log'), logLine, 'utf-8');

    if (level === 'error' || level === 'warn') {
      fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), logLine, 'utf-8');
    }
  } catch (err) {
    console.error('[ApiDesk File Logger Error]', err);
  }
}

writeElectronLog('info', 'ELECTRON_BOOT', 'ApiDesk Electron process started', {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  homeDir: os.homedir(),
  logsDir: LOGS_DIR,
  cwd: process.cwd()
});

function findServerBundle() {
  const candidates = [
    path.join(__dirname, 'dist/server.cjs'),
    path.join(__dirname, 'server.cjs'),
    path.join(process.resourcesPath || '', 'app.asar/dist/server.cjs'),
    path.join(process.resourcesPath || '', 'app/dist/server.cjs'),
    path.join(__dirname, '../dist/server.cjs')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      writeElectronLog('info', 'SERVER_BUNDLE_FOUND', `Found server bundle at: ${c}`);
      return c;
    }
  }
  writeElectronLog('warn', 'SERVER_BUNDLE_NOT_FOUND', 'Searched candidate paths', candidates);
  return null;
}

function startBackendServer() {
  const serverPath = findServerBundle();

  if (serverPath) {
    try {
      process.env.PORT = String(PORT);
      process.env.NODE_ENV = 'production';
      writeElectronLog('info', 'SERVER_INIT', `Requiring backend server bundle: ${serverPath} on port ${PORT}`);
      require(serverPath);
      writeElectronLog('info', 'SERVER_STARTED', `Native Node.js backend loaded from ${serverPath} on port ${PORT}`);
      console.log(`[ApiDesk] Native Node.js backend running from ${serverPath} on port ${PORT}`);
    } catch (err) {
      writeElectronLog('error', 'SERVER_INIT_ERROR', `Failed to initialize backend server bundle: ${err.message}`, {
        stack: err.stack,
        serverPath
      });
      console.error('[ApiDesk] Failed to initialize backend server bundle:', err);
    }
  } else {
    writeElectronLog('warn', 'SERVER_FALLBACK', 'Backend bundle (dist/server.cjs) not found. Falling back to static assets.');
    console.warn('[ApiDesk] Backend bundle (dist/server.cjs) not found. Falling back to static assets.');
  }
}

function createWindow() {
  writeElectronLog('info', 'WINDOW_INIT', 'Creating main application window');
  const iconPath = path.join(__dirname, 'public/app_icon.png');
  const isMac = process.platform === 'darwin';

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'ApiDesk - Local API Client & Tester',
    backgroundColor: '#020617', // Match slate-950 to prevent white flash
    show: false, // Show only when content is ready
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 15 } : undefined,
    autoHideMenuBar: !isMac,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Facilitate local proxy and backend access
    }
  });

  win.once('ready-to-show', () => {
    writeElectronLog('info', 'WINDOW_READY', 'Main window ready-to-show fired');
    win.show();
  });

  win.webContents.on('did-finish-load', () => {
    writeElectronLog('info', 'WEB_FINISH_LOAD', `Page finished loading: ${win.webContents.getURL()}`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeElectronLog('error', 'WEB_FAIL_LOAD', `Page failed to load: ${validatedURL}`, {
      errorCode,
      errorDescription
    });
  });

  win.webContents.on('render-process-gone', (event, details) => {
    writeElectronLog('error', 'RENDERER_CRASHED', 'Renderer process gone', details);
  });

  win.on('unresponsive', () => {
    writeElectronLog('warn', 'WINDOW_UNRESPONSIVE', 'Main window became unresponsive');
  });

  win.on('responsive', () => {
    writeElectronLog('info', 'WINDOW_RESPONSIVE', 'Main window became responsive again');
  });

  let loadAttempts = 0;
  const maxAttempts = 10;

  const tryLoadServer = () => {
    loadAttempts++;
    const targetUrl = `http://127.0.0.1:${PORT}`;
    writeElectronLog('info', 'LOAD_ATTEMPT', `Attempting to connect to ${targetUrl} (attempt ${loadAttempts}/${maxAttempts})`);
    
    win.loadURL(targetUrl).catch((err) => {
      writeElectronLog('warn', 'LOAD_ATTEMPT_FAILED', `Attempt ${loadAttempts} failed: ${err.message}`);
      console.log(`[ApiDesk Mac] Connecting to backend attempt ${loadAttempts}/${maxAttempts}...`);
      if (loadAttempts < maxAttempts) {
        setTimeout(tryLoadServer, 250);
      } else {
        // Fallback: load dist/index.html directly
        const localHtml = path.join(__dirname, 'dist/index.html');
        if (fs.existsSync(localHtml)) {
          writeElectronLog('info', 'FALLBACK_LOAD_HTML', `Loading local static bundle directly from: ${localHtml}`);
          console.log('[ApiDesk Mac] Loading local static bundle directly from:', localHtml);
          win.loadFile(localHtml);
        } else {
          writeElectronLog('error', 'LOAD_CRITICAL_FAILURE', `Could not connect to backend and local index.html was not found at ${localHtml}`);
          console.error('[ApiDesk Mac] Could not connect to backend and local index.html was not found.');
        }
      }
    });
  };

  tryLoadServer();

  // DevTools shortcut (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows/Linux)
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'F12') || (input.control && input.shift && input.key.toLowerCase() === 'i') || (input.meta && input.alt && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(() => {
  writeElectronLog('info', 'APP_READY', 'Electron app ready event fired');
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    writeElectronLog('info', 'APP_ACTIVATE', 'Electron app activate event fired');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  writeElectronLog('info', 'APP_WINDOWS_CLOSED', 'All Electron windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (err) => {
  writeElectronLog('error', 'ELECTRON_UNCAUGHT_EXCEPTION', err.message, { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  writeElectronLog('error', 'ELECTRON_UNHANDLED_REJECTION', String(reason));
});

