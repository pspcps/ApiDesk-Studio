/**
 * Client-Side Logger for ApiDesk
 * Safely forwards browser logs, uncaught exceptions, and debug reports to ~/apilogs on the local system.
 */

interface LogPayload {
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  details?: any;
}

let isInitialized = false;
const queue: LogPayload[] = [];
let isFlushing = false;

async function flushQueue() {
  if (isFlushing || queue.length === 0) return;
  isFlushing = true;

  const item = queue.shift();
  if (item) {
    try {
      await fetch('/api/logs/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    } catch {
      // Silently discard to prevent recursive loops if offline
    }
  }

  isFlushing = false;
  if (queue.length > 0) {
    setTimeout(flushQueue, 100);
  }
}

export function reportClientLog(
  level: 'info' | 'warn' | 'error',
  tag: string,
  message: string,
  details?: any
) {
  // Prevent unbounded memory growth
  if (queue.length < 50) {
    queue.push({ level, tag, message, details });
    flushQueue();
  }
}

export function initGlobalClientErrorLogging() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Window error handler
  window.addEventListener('error', (event: ErrorEvent) => {
    reportClientLog('error', 'WINDOW_ERROR', event.message || 'Uncaught error in browser window', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || '');
    if (msg.includes('__PROCESS_EXIT_')) {
      // Synthetic process.exit(code) signal inside Node test/script runner, ignore
      return;
    }
    reportClientLog('error', 'UNHANDLED_PROMISE_REJECTION', msg, {
      stack: reason?.stack
    });
  });

  reportClientLog('info', 'CLIENT_INIT', 'ApiDesk Web Client initialized in browser / Electron webframe', {
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href
  });
}
