// In-Browser Node.js Environment & Module Polyfill for Script Regression Runner
// Provides comprehensive compatibility for CommonJS require(), standard built-in modules, and globals

// Virtual In-Memory File System for sandbox scripts
const virtualFilesystem: Record<string, string> = {
  '/workspace/data.json': JSON.stringify({ message: 'Virtual file system sample data' }, null, 2),
  '/workspace/config.env': 'ENV=test\nDEBUG=true'
};

// 1. Buffer Polyfill
export class SandboxBuffer {
  uint8: Uint8Array;

  constructor(data: Uint8Array | number[] | ArrayBuffer | string | number, encoding: string = 'utf8') {
    if (typeof data === 'string') {
      if (encoding === 'base64') {
        const bin = atob(data);
        this.uint8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) this.uint8[i] = bin.charCodeAt(i);
      } else if (encoding === 'hex') {
        const matches = data.match(/.{1,2}/g) || [];
        this.uint8 = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
      } else {
        const encoder = new TextEncoder();
        this.uint8 = encoder.encode(data);
      }
    } else if (data instanceof ArrayBuffer) {
      this.uint8 = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      this.uint8 = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      this.uint8 = new Uint8Array(data);
    } else {
      this.uint8 = new Uint8Array(Number(data) || 0);
    }
  }

  get length(): number {
    return this.uint8.length;
  }

  static from(data: any, encoding?: string): SandboxBuffer {
    return new SandboxBuffer(data, encoding);
  }

  static alloc(size: number, fill: number = 0): SandboxBuffer {
    const buf = new SandboxBuffer(size);
    if (fill !== 0) buf.uint8.fill(fill);
    return buf;
  }

  static isBuffer(obj: any): boolean {
    return obj instanceof SandboxBuffer || obj instanceof Uint8Array;
  }

  static concat(list: (SandboxBuffer | Uint8Array)[]): SandboxBuffer {
    const totalLength = list.reduce((acc, item) => acc + item.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const item of list) {
      const arr = item instanceof SandboxBuffer ? item.uint8 : item;
      result.set(arr, offset);
      offset += arr.length;
    }
    return new SandboxBuffer(result);
  }

  toString(encoding: string = 'utf8'): string {
    if (encoding === 'base64') {
      let bin = '';
      for (let i = 0; i < this.uint8.length; i++) {
        bin += String.fromCharCode(this.uint8[i]);
      }
      return btoa(bin);
    }
    if (encoding === 'hex') {
      return Array.from(this.uint8)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    const decoder = new TextDecoder();
    return decoder.decode(this.uint8);
  }

  toJSON(): { type: 'Buffer'; data: number[] } {
    return {
      type: 'Buffer',
      data: Array.from(this.uint8)
    };
  }
}

// 2. EventEmitter Polyfill
export class SandboxEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return this;
  }

  addListener(event: string, listener: Function): this {
    return this.on(event, listener);
  }

  once(event: string, listener: Function): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  removeListener(event: string, listener: Function): this {
    return this.off(event, listener);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event] || this.events[event].length === 0) return false;
    const listeners = [...this.events[event]];
    listeners.forEach(fn => fn(...args));
    return true;
  }

  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }
}

// Deep Equality Checker Helper for Assertions
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 3. Node.js `assert` module polyfill
export const createAssertModule = () => {
  const assertFn: any = (condition: any, message?: string) => {
    if (!condition) {
      throw new Error(message || 'Assertion failed: condition is falsy');
    }
  };

  assertFn.ok = (value: any, message?: string) => {
    if (!value) throw new Error(message || `Assertion failed: expected truthy value, got ${value}`);
  };

  assertFn.strictEqual = (actual: any, expected: any, message?: string) => {
    if (actual !== expected) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Expected strict equality\n  + Actual:   ${JSON.stringify(actual)}\n  - Expected: ${JSON.stringify(expected)}`);
    }
  };

  assertFn.equal = (actual: any, expected: any, message?: string) => {
    // eslint-disable-next-line eqeqeq
    if (actual != expected) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Expected equality\n  + Actual:   ${JSON.stringify(actual)}\n  - Expected: ${JSON.stringify(expected)}`);
    }
  };

  assertFn.notStrictEqual = (actual: any, expected: any, message?: string) => {
    if (actual === expected) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Expected values to NOT be strictly equal: ${JSON.stringify(actual)}`);
    }
  };

  assertFn.notEqual = (actual: any, expected: any, message?: string) => {
    // eslint-disable-next-line eqeqeq
    if (actual == expected) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Expected values to NOT be equal: ${JSON.stringify(actual)}`);
    }
  };

  assertFn.deepStrictEqual = (actual: any, expected: any, message?: string) => {
    if (!isDeepEqual(actual, expected)) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Deep strict equality failed\n  + Actual:   ${JSON.stringify(actual, null, 2)}\n  - Expected: ${JSON.stringify(expected, null, 2)}`);
    }
  };

  assertFn.deepEqual = (actual: any, expected: any, message?: string) => {
    if (!isDeepEqual(actual, expected)) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Deep equality failed\n  + Actual:   ${JSON.stringify(actual)}\n  - Expected: ${JSON.stringify(expected)}`);
    }
  };

  assertFn.throws = (block: () => void, error?: any, message?: string) => {
    let threw = false;
    let caughtErr: any = null;
    try {
      block();
    } catch (e) {
      threw = true;
      caughtErr = e;
    }
    if (!threw) {
      throw new Error(message || 'AssertionError [ERR_ASSERTION]: Missing expected exception');
    }
    if (error && typeof error === 'function' && !(caughtErr instanceof error)) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Expected error instance of ${error.name}, got ${caughtErr}`);
    }
  };

  assertFn.doesNotThrow = (block: () => void, message?: string) => {
    try {
      block();
    } catch (e: any) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: Got unwanted exception: ${e.message}`);
    }
  };

  assertFn.rejects = async (asyncBlock: () => Promise<any>, message?: string) => {
    let threw = false;
    try {
      await (typeof asyncBlock === 'function' ? asyncBlock() : asyncBlock);
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'AssertionError [ERR_ASSERTION]: Missing expected async rejection');
    }
  };

  assertFn.match = (string: string, regexp: RegExp, message?: string) => {
    if (!regexp.test(string)) {
      throw new Error(message || `AssertionError [ERR_ASSERTION]: The input string did not match regexp ${regexp}`);
    }
  };

  assertFn.fail = (message: string = 'Assertion failed') => {
    throw new Error(`AssertionError [ERR_ASSERTION]: ${message}`);
  };

  assertFn.ifError = (err: any) => {
    if (err) throw err;
  };

  return assertFn;
};

// 4. `axios` module polyfill
export const createAxiosModule = () => {
  const formatAxiosHeaders = (headers: Headers): Record<string, string> => {
    const res: Record<string, string> = {};
    headers.forEach((val, key) => {
      res[key.toLowerCase()] = val;
    });
    return res;
  };

  const executeAxiosRequest = async (urlOrConfig: any, optionalConfig: any = {}) => {
    let config = typeof urlOrConfig === 'string' ? { url: urlOrConfig, ...optionalConfig } : { ...urlOrConfig };
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const headers = config.headers || {};
    let body = config.data;

    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body
    };

    const res = await window.fetch(url, fetchOptions);
    const contentType = res.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
    } else {
      data = await res.text();
    }

    const response = {
      data,
      status: res.status,
      statusText: res.statusText,
      headers: formatAxiosHeaders(res.headers),
      config,
      request: {}
    };

    if (config.validateStatus ? !config.validateStatus(res.status) : (res.status < 200 || res.status >= 300)) {
      const err: any = new Error(`Request failed with status code ${res.status}`);
      err.response = response;
      err.isAxiosError = true;
      err.config = config;
      throw err;
    }

    return response;
  };

  const axiosInstance: any = (config: any) => executeAxiosRequest(config);
  axiosInstance.get = (url: string, config?: any) => executeAxiosRequest(url, { ...config, method: 'GET' });
  axiosInstance.post = (url: string, data?: any, config?: any) => executeAxiosRequest(url, { ...config, data, method: 'POST' });
  axiosInstance.put = (url: string, data?: any, config?: any) => executeAxiosRequest(url, { ...config, data, method: 'PUT' });
  axiosInstance.delete = (url: string, config?: any) => executeAxiosRequest(url, { ...config, method: 'DELETE' });
  axiosInstance.patch = (url: string, data?: any, config?: any) => executeAxiosRequest(url, { ...config, data, method: 'PATCH' });
  axiosInstance.head = (url: string, config?: any) => executeAxiosRequest(url, { ...config, method: 'HEAD' });
  axiosInstance.request = (config: any) => executeAxiosRequest(config);
  axiosInstance.create = (defaultConfig: any = {}) => {
    const sub = (cfg: any) => executeAxiosRequest({ ...defaultConfig, ...cfg });
    sub.get = (u: string, c?: any) => executeAxiosRequest(u, { ...defaultConfig, ...c, method: 'GET' });
    sub.post = (u: string, d?: any, c?: any) => executeAxiosRequest(u, { ...defaultConfig, ...c, data: d, method: 'POST' });
    sub.put = (u: string, d?: any, c?: any) => executeAxiosRequest(u, { ...defaultConfig, ...c, data: d, method: 'PUT' });
    sub.delete = (u: string, c?: any) => executeAxiosRequest(u, { ...defaultConfig, ...c, method: 'DELETE' });
    sub.patch = (u: string, d?: any, c?: any) => executeAxiosRequest(u, { ...defaultConfig, ...c, data: d, method: 'PATCH' });
    return sub;
  };

  return axiosInstance;
};

// 5. Node `path` module polyfill
export const pathModule = {
  join: (...parts: string[]): string => {
    return parts
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');
  },
  resolve: (...parts: string[]): string => {
    const joined = parts.filter(Boolean).join('/');
    return ('/' + joined).replace(/\/+/g, '/');
  },
  basename: (p: string, ext?: string): string => {
    const base = p.split('/').filter(Boolean).pop() || '';
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  },
  dirname: (p: string): string => {
    const parts = p.split('/').filter(Boolean);
    parts.pop();
    return parts.length ? '/' + parts.join('/') : '/';
  },
  extname: (p: string): string => {
    const base = p.split('/').pop() || '';
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx) : '';
  },
  normalize: (p: string): string => p.replace(/\/+/g, '/'),
  parse: (p: string) => ({
    root: '/',
    dir: pathModule.dirname(p),
    base: pathModule.basename(p),
    ext: pathModule.extname(p),
    name: pathModule.basename(p, pathModule.extname(p))
  }),
  format: (pathObj: any): string => {
    return (pathObj.dir ? pathObj.dir + '/' : '') + (pathObj.base || pathObj.name + (pathObj.ext || ''));
  },
  sep: '/',
  delimiter: ':'
};

// 6. Node `crypto` module polyfill
export const createCryptoModule = () => {
  return {
    randomUUID: (): string => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    randomBytes: (size: number): SandboxBuffer => {
      const arr = new Uint8Array(size);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      } else {
        for (let i = 0; i < size; i++) arr[i] = Math.floor(Math.random() * 256);
      }
      return new SandboxBuffer(arr);
    },
    createHash: (algorithm: string = 'sha256') => {
      let data = '';
      return {
        update: (content: string | SandboxBuffer) => {
          data += typeof content === 'string' ? content : content.toString();
          return this;
        },
        digest: (encoding: string = 'hex'): string => {
          let hash = 0;
          for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
          }
          const hexStr = Math.abs(hash).toString(16).padStart(32, '0');
          if (encoding === 'base64') {
            return btoa(hexStr.slice(0, 16));
          }
          return `${algorithm}_${hexStr}`;
        }
      };
    }
  };
};

// 7. Node `fs` and `fs/promises` module polyfill
export const createFsModule = () => {
  const fsSync = {
    readFileSync: (filepath: string, encoding: string = 'utf8'): string | SandboxBuffer => {
      const content = virtualFilesystem[filepath] ?? virtualFilesystem['/' + filepath] ?? '';
      if (encoding) return content;
      return SandboxBuffer.from(content);
    },
    writeFileSync: (filepath: string, data: any): void => {
      virtualFilesystem[filepath] = typeof data === 'string' ? data : (data?.toString() || '');
    },
    existsSync: (filepath: string): boolean => {
      return filepath in virtualFilesystem || ('/' + filepath) in virtualFilesystem;
    },
    unlinkSync: (filepath: string): void => {
      delete virtualFilesystem[filepath];
      delete virtualFilesystem['/' + filepath];
    },
    mkdirSync: (_filepath: string): void => {},
    statSync: (filepath: string) => {
      const content = virtualFilesystem[filepath] || '';
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: content.length,
        mtimeMs: Date.now()
      };
    }
  };

  const fsPromises = {
    readFile: async (filepath: string, encoding: string = 'utf8') => fsSync.readFileSync(filepath, encoding),
    writeFile: async (filepath: string, data: any) => fsSync.writeFileSync(filepath, data),
    unlink: async (filepath: string) => fsSync.unlinkSync(filepath),
    stat: async (filepath: string) => fsSync.statSync(filepath)
  };

  return {
    ...fsSync,
    promises: fsPromises
  };
};

// 8. Node `util` module polyfill
export const utilModule = {
  promisify: (fn: Function) => {
    return (...args: any[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: any, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    };
  },
  format: (format: string, ...args: any[]): string => {
    let i = 0;
    return String(format).replace(/%[sjdifoO%]/g, (match) => {
      if (match === '%%') return '%';
      if (i >= args.length) return match;
      const arg = args[i++];
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    });
  },
  inspect: (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  },
  isDeepStrictEqual: isDeepEqual,
  types: {
    isPromise: (p: any) => p && typeof p.then === 'function',
    isDate: (d: any) => d instanceof Date,
    isRegExp: (r: any) => r instanceof RegExp
  }
};

// 9. Node `os` module polyfill
export const osModule = {
  platform: () => 'browser-sandbox',
  arch: () => 'javascript',
  hostname: () => 'localhost',
  homedir: () => '/home/sandbox',
  tmpdir: () => '/tmp',
  cpus: () => [{ model: 'Virtual Browser Core', speed: 2400 }],
  totalmem: () => 1024 * 1024 * 1024,
  freemem: () => 512 * 1024 * 1024,
  uptime: () => 3600,
  EOL: '\n'
};

// 10. Node `querystring` module polyfill
export const querystringModule = {
  parse: (str: string) => {
    const params = new URLSearchParams(str);
    const obj: Record<string, string> = {};
    params.forEach((v, k) => { obj[k] = v; });
    return obj;
  },
  stringify: (obj: Record<string, any>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) {
      params.append(k, String(v));
    }
    return params.toString();
  },
  escape: encodeURIComponent,
  unescape: decodeURIComponent
};

// 11. Stream Polyfill
export class SandboxReadable extends SandboxEventEmitter {
  readable: boolean = true;
  private _buffer: any[] = [];

  push(chunk: any) {
    if (chunk === null) {
      setTimeout(() => this.emit('end'), 0);
      return false;
    }
    this._buffer.push(chunk);
    setTimeout(() => this.emit('data', chunk), 0);
    return true;
  }

  pipe<T extends any>(dest: T): T {
    this.on('data', (chunk) => {
      if (typeof (dest as any).write === 'function') {
        (dest as any).write(chunk);
      }
    });
    this.on('end', () => {
      if (typeof (dest as any).end === 'function') {
        (dest as any).end();
      }
    });
    return dest;
  }

  destroy(err?: Error) {
    if (err) this.emit('error', err);
    this.emit('close');
    this.removeAllListeners();
  }
}

export class SandboxWritable extends SandboxEventEmitter {
  writable: boolean = true;

  write(chunk: any, _encoding?: any, cb?: any) {
    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  end(chunk?: any, _encoding?: any, cb?: any) {
    if (chunk) this.write(chunk);
    if (typeof cb === 'function') setTimeout(cb, 0);
    setTimeout(() => this.emit('finish'), 0);
    return this;
  }

  destroy(err?: Error) {
    if (err) this.emit('error', err);
    this.emit('close');
    this.removeAllListeners();
  }
}

export class SandboxTransform extends SandboxReadable {
  writable: boolean = true;

  write(chunk: any, _encoding?: any, cb?: any) {
    this.push(chunk);
    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  end(chunk?: any, _encoding?: any, cb?: any) {
    if (chunk) this.push(chunk);
    this.push(null);
    if (typeof cb === 'function') setTimeout(cb, 0);
    return this;
  }
}

export const streamModule = {
  Readable: SandboxReadable,
  Writable: SandboxWritable,
  Transform: SandboxTransform,
  PassThrough: SandboxTransform,
  Stream: SandboxReadable,
  pipeline: (...args: any[]) => {
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    if (cb) setTimeout(() => cb(null), 0);
  },
  finished: (_stream: any, cb: Function) => {
    if (cb) setTimeout(cb, 0);
  },
  promises: {
    pipeline: async (..._args: any[]) => Promise.resolve(),
    finished: async (_stream: any) => Promise.resolve()
  }
};

// 12. StringDecoder Polyfill
export class SandboxStringDecoder {
  encoding: string;
  constructor(encoding: string = 'utf8') {
    this.encoding = encoding;
  }
  write(buf: any): string {
    if (typeof buf === 'string') return buf;
    if (buf instanceof SandboxBuffer || buf instanceof Uint8Array) {
      return new TextDecoder(this.encoding).decode(buf instanceof SandboxBuffer ? (buf as any).uint8 : buf);
    }
    return String(buf);
  }
  end(): string {
    return '';
  }
}

// 13. HTTP & HTTPS Module & Agent Polyfill
export class SandboxAgent extends SandboxEventEmitter {
  options: any;
  defaultPort: number;
  protocol: string;
  maxSockets: number;
  maxFreeSockets: number;
  sockets: Record<string, any[]>;
  freeSockets: Record<string, any[]>;
  requests: Record<string, any[]>;

  constructor(options: any = {}) {
    super();
    this.options = options || {};
    this.defaultPort = this.options.defaultPort || 80;
    this.protocol = this.options.protocol || 'http:';
    this.maxSockets = this.options.maxSockets || Infinity;
    this.maxFreeSockets = this.options.maxFreeSockets || 256;
    this.sockets = {};
    this.freeSockets = {};
    this.requests = {};
  }

  destroy() {
    this.removeAllListeners();
  }
}

export class SandboxHttpsAgent extends SandboxAgent {
  constructor(options: any = {}) {
    super({ ...options, defaultPort: 443, protocol: 'https:' });
  }
}

export class SandboxIncomingMessage extends SandboxEventEmitter {
  statusCode: number = 200;
  statusMessage: string = 'OK';
  headers: Record<string, string> = {};
  rawHeaders: string[] = [];
  url: string = '';
  method: string = 'GET';
  complete: boolean = true;
  private _body: string = '';

  constructor(res?: Response, bodyText?: string) {
    super();
    if (res) {
      this.statusCode = res.status;
      this.statusMessage = res.statusText || 'OK';
      this.url = res.url || '';
      res.headers.forEach((val, key) => {
        this.headers[key.toLowerCase()] = val;
        this.rawHeaders.push(key, val);
      });
    }
    this._body = bodyText || '';
  }

  setEncoding(_encoding: string) {
    return this;
  }

  pipe<T extends any>(destination: T): T {
    setTimeout(() => {
      this.emit('data', this._body);
      this.emit('end');
      if (typeof (destination as any).write === 'function') {
        (destination as any).write(this._body);
      }
      if (typeof (destination as any).end === 'function') {
        (destination as any).end();
      }
    }, 0);
    return destination;
  }
}

export class SandboxClientRequest extends SandboxEventEmitter {
  method: string = 'GET';
  path: string = '/';
  headers: Record<string, string> = {};
  private _bodyChunks: any[] = [];
  private _url: string = '';
  private _options: any = {};
  private _cb?: (res: SandboxIncomingMessage) => void;

  constructor(urlOrOptions: any, optionsOrCb?: any, cb?: any) {
    super();
    if (typeof urlOrOptions === 'string') {
      this._url = urlOrOptions;
      if (typeof optionsOrCb === 'function') {
        this._cb = optionsOrCb;
      } else {
        this._options = optionsOrCb || {};
        this._cb = cb;
      }
    } else {
      this._options = urlOrOptions || {};
      this._cb = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
      const protocol = this._options.protocol || 'http:';
      const host = this._options.hostname || this._options.host || 'localhost';
      const port = this._options.port ? `:${this._options.port}` : '';
      const path = this._options.path || '/';
      this._url = `${protocol}//${host}${port}${path}`;
    }
    this.method = (this._options.method || 'GET').toUpperCase();
    this.headers = this._options.headers || {};
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }

  removeHeader(name: string) {
    delete this.headers[name.toLowerCase()];
  }

  write(chunk: any, _encoding?: any, callback?: any) {
    if (chunk) this._bodyChunks.push(chunk);
    if (typeof callback === 'function') callback();
    return true;
  }

  end(data?: any, _encoding?: any, callback?: any) {
    if (data) this._bodyChunks.push(data);
    if (typeof callback === 'function') callback();

    const body = ['GET', 'HEAD'].includes(this.method) 
      ? undefined 
      : this._bodyChunks.map(c => typeof c === 'string' ? c : (c?.toString() || '')).join('');

    setTimeout(async () => {
      try {
        const res = await window.fetch(this._url, {
          method: this.method,
          headers: this.headers,
          body
        });
        const text = await res.text();
        const incoming = new SandboxIncomingMessage(res, text);

        if (this._cb) {
          this._cb(incoming);
        }
        this.emit('response', incoming);

        setTimeout(() => {
          incoming.emit('data', text);
          incoming.emit('end');
        }, 1);
      } catch (err: any) {
        this.emit('error', err);
      }
    }, 0);

    return this;
  }

  abort() {
    this.emit('abort');
  }

  destroy(err?: Error) {
    if (err) this.emit('error', err);
    this.removeAllListeners();
  }

  setTimeout(_ms: number, cb?: Function) {
    if (cb) this.once('timeout', cb);
    return this;
  }
}

export const createHttpModule = () => {
  const globalAgent = new SandboxAgent();

  return {
    Agent: SandboxAgent,
    globalAgent,
    ClientRequest: SandboxClientRequest,
    IncomingMessage: SandboxIncomingMessage,
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'],
    STATUS_CODES: {
      100: 'Continue',
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    },
    request: (urlOrOptions: any, optionsOrCb?: any, cb?: any) => {
      const req = new SandboxClientRequest(urlOrOptions, optionsOrCb, cb);
      return req;
    },
    get: (urlOrOptions: any, optionsOrCb?: any, cb?: any) => {
      const req = new SandboxClientRequest(urlOrOptions, optionsOrCb, cb);
      req.end();
      return req;
    },
    createServer: () => {
      const server = new SandboxEventEmitter();
      (server as any).listen = (_port?: any, cb?: any) => {
        if (cb) setTimeout(cb, 0);
        return server;
      };
      (server as any).close = (cb?: any) => {
        if (cb) setTimeout(cb, 0);
        return server;
      };
      return server;
    }
  };
};

export const createHttpsModule = () => {
  const httpMod = createHttpModule();
  const globalHttpsAgent = new SandboxHttpsAgent();

  return {
    ...httpMod,
    Agent: SandboxHttpsAgent,
    globalAgent: globalHttpsAgent,
    request: (urlOrOptions: any, optionsOrCb?: any, cb?: any) => {
      let opts = typeof urlOrOptions === 'string' ? { url: urlOrOptions } : { ...urlOrOptions };
      opts.protocol = opts.protocol || 'https:';
      const req = new SandboxClientRequest(opts, optionsOrCb, cb);
      return req;
    },
    get: (urlOrOptions: any, optionsOrCb?: any, cb?: any) => {
      let opts = typeof urlOrOptions === 'string' ? { url: urlOrOptions } : { ...urlOrOptions };
      opts.protocol = opts.protocol || 'https:';
      const req = new SandboxClientRequest(opts, optionsOrCb, cb);
      req.end();
      return req;
    }
  };
};

// 14. TLS, Net, and Zlib Polyfills
export const tlsModule = {
  connect: (_opts: any, cb?: Function) => {
    const socket = new SandboxEventEmitter();
    if (cb) setTimeout(cb, 0);
    return socket;
  },
  createServer: () => new SandboxEventEmitter(),
  TLSSocket: SandboxEventEmitter,
  DEFAULT_ECDH_CURVE: 'auto',
  checkServerIdentity: () => undefined
};

export const netModule = {
  connect: (_opts: any, cb?: Function) => {
    const socket = new SandboxEventEmitter();
    if (cb) setTimeout(cb, 0);
    return socket;
  },
  createConnection: (_opts: any, cb?: Function) => {
    const socket = new SandboxEventEmitter();
    if (cb) setTimeout(cb, 0);
    return socket;
  },
  createServer: () => new SandboxEventEmitter(),
  Socket: SandboxEventEmitter,
  isIP: (input: string) => (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input) ? 4 : input.includes(':') ? 6 : 0),
  isIPv4: (input: string) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input),
  isIPv6: (input: string) => input.includes(':')
};

export const zlibModule = {
  gzipSync: (buf: any) => buf,
  gunzipSync: (buf: any) => buf,
  deflateSync: (buf: any) => buf,
  inflateSync: (buf: any) => buf,
  gzip: (buf: any, cb: Function) => cb?.(null, buf),
  gunzip: (buf: any, cb: Function) => cb?.(null, buf),
  deflate: (buf: any, cb: Function) => cb?.(null, buf),
  inflate: (buf: any, cb: Function) => cb?.(null, buf),
  createGzip: () => new SandboxTransform(),
  createGunzip: () => new SandboxTransform(),
  createDeflate: () => new SandboxTransform(),
  createInflate: () => new SandboxTransform(),
  constants: {
    Z_NO_FLUSH: 0,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4
  }
};

// Create the complete sandbox environment for in-browser JavaScript execution
export function buildSandboxEnvironment(options: {
  scriptName: string;
  envVars: Record<string, string>;
  cliArgsStr: string;
  capturedLog: (...args: any[]) => void;
  capturedError: (...args: any[]) => void;
  onRequireInput?: (promptText: string) => Promise<string>;
}) {
  const { scriptName, envVars, cliArgsStr, capturedLog, capturedError, onRequireInput } = options;

  const assertMod = createAssertModule();
  const axiosMod = createAxiosModule();
  const cryptoMod = createCryptoModule();
  const fsMod = createFsModule();
  const httpMod = createHttpModule();
  const httpsMod = createHttpsModule();

  // Interactive user prompt handler for in-browser sandbox
  const askUserFn = async (query: string = '') => {
    if (query) {
      capturedLog(query + (query.endsWith(' ') || query.endsWith('\n') ? '' : ' '));
    }
    if (onRequireInput) {
      return await onRequireInput(query);
    }
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const res = window.prompt(query || 'Enter input for script:');
      const val = res !== null ? res : '';
      capturedLog(val);
      return val;
    }
    return '';
  };

  // Node.js Readline polyfill for terminal questions and inputs
  const readlineModule = {
    createInterface: (rlOptions: any) => {
      return {
        question: (query: string, callback: (answer: string) => void) => {
          askUserFn(query).then(ans => {
            if (typeof callback === 'function') callback(ans);
          });
        },
        close: () => {},
        pause: () => {},
        resume: () => {},
        on: (event: string, listener: Function) => {},
        once: (event: string, listener: Function) => {}
      };
    },
    promises: {
      createInterface: (rlOptions: any) => {
        return {
          question: async (query: string) => {
            return await askUserFn(query);
          },
          close: () => {}
        };
      }
    }
  };

  // Universal sandbox fetch function with .default and constructor properties
  const universalSandboxFetch: any = function(input: any, init?: any) {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch(input, init);
    }
    return Promise.reject(new Error('Window fetch is unavailable in this environment'));
  };
  universalSandboxFetch.default = universalSandboxFetch;
  universalSandboxFetch.Headers = typeof window !== 'undefined' ? window.Headers : class Headers {};
  universalSandboxFetch.Request = typeof window !== 'undefined' ? window.Request : class Request {};
  universalSandboxFetch.Response = typeof window !== 'undefined' ? window.Response : class Response {};
  universalSandboxFetch.FetchError = Error;

  // Registry of modules resolvable by require()
  const moduleRegistry: Record<string, any> = {
    'assert': assertMod,
    'node:assert': assertMod,
    'axios': axiosMod,
    'node-fetch': universalSandboxFetch,
    'cross-fetch': universalSandboxFetch,
    'isomorphic-fetch': universalSandboxFetch,
    'whatwg-fetch': universalSandboxFetch,
    'undici': {
      fetch: universalSandboxFetch,
      Headers: universalSandboxFetch.Headers,
      Request: universalSandboxFetch.Request,
      Response: universalSandboxFetch.Response,
      default: { fetch: universalSandboxFetch }
    },
    'readline': readlineModule,
    'node:readline': readlineModule,
    'readline/promises': readlineModule.promises,
    'node:readline/promises': readlineModule.promises,
    'path': pathModule,
    'node:path': pathModule,
    'crypto': cryptoMod,
    'node:crypto': cryptoMod,
    'fs': fsMod,
    'node:fs': fsMod,
    'fs/promises': fsMod.promises,
    'events': { EventEmitter: SandboxEventEmitter, default: { EventEmitter: SandboxEventEmitter } },
    'node:events': { EventEmitter: SandboxEventEmitter, default: { EventEmitter: SandboxEventEmitter } },
    'util': utilModule,
    'node:util': utilModule,
    'os': osModule,
    'node:os': osModule,
    'buffer': { Buffer: SandboxBuffer, default: { Buffer: SandboxBuffer } },
    'node:buffer': { Buffer: SandboxBuffer, default: { Buffer: SandboxBuffer } },
    'querystring': querystringModule,
    'node:querystring': querystringModule,
    'url': {
      URL: window.URL,
      URLSearchParams: window.URLSearchParams,
      parse: (u: string) => new URL(u, window.location.origin)
    },
    'http': httpMod,
    'node:http': httpMod,
    'https': httpsMod,
    'node:https': httpsMod,
    'stream': streamModule,
    'node:stream': streamModule,
    'stream/promises': streamModule.promises,
    'tls': tlsModule,
    'node:tls': tlsModule,
    'net': netModule,
    'node:net': netModule,
    'zlib': zlibModule,
    'node:zlib': zlibModule,
    'string_decoder': { StringDecoder: SandboxStringDecoder, default: { StringDecoder: SandboxStringDecoder } },
    'node:string_decoder': { StringDecoder: SandboxStringDecoder, default: { StringDecoder: SandboxStringDecoder } },
    'timers': {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
      setImmediate: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
      clearImmediate: (id: any) => clearTimeout(id)
    },
    // Common popular utilities available in browser sandbox
    'uuid': {
      v4: () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      },
      v1: () => Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9),
      default: {
        v4: () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).substring(2, 10))
      }
    },
    'qs': {
      parse: (str: string) => {
        const params = new URLSearchParams(str);
        const obj: Record<string, string> = {};
        params.forEach((v, k) => { obj[k] = v; });
        return obj;
      },
      stringify: (obj: Record<string, any>) => new URLSearchParams(obj).toString()
    },
    'chalk': {
      red: (s: string) => `\x1b[31m${s}\x1b[0m`,
      green: (s: string) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
      blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
      cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
      gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
      bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
      dim: (s: string) => `\x1b[2m${s}\x1b[0m`
    }
  };

  // Custom require function
  const sandboxRequire = (moduleName: string) => {
    if (moduleRegistry[moduleName]) {
      return moduleRegistry[moduleName];
    }
    // If submodule like require('assert/strict')
    if (moduleName.startsWith('assert')) {
      return assertMod;
    }
    if (moduleName.startsWith('fs')) {
      return fsMod;
    }
    if (moduleName.startsWith('path')) {
      return pathModule;
    }
    if (moduleName.startsWith('crypto')) {
      return cryptoMod;
    }
    if (moduleName.startsWith('http')) {
      return httpMod;
    }
    if (moduleName.startsWith('https')) {
      return httpsMod;
    }
    if (moduleName.startsWith('stream')) {
      return streamModule;
    }
    // Return empty stub with warning
    capturedLog(`⚠️ Notice: Sandbox resolved external module stub for "${moduleName}".`);
    return {};
  };

  // Process Mock
  const sandboxProcess = {
    env: {
      ...envVars,
      NODE_ENV: 'test',
      FORCE_COLOR: '1'
    },
    argv: ['node', scriptName, ...(cliArgsStr ? cliArgsStr.split(/\s+/).filter(Boolean) : [])],
    cwd: () => '/workspace',
    platform: 'browser',
    version: 'v20.10.0',
    versions: { node: '20.10.0', v8: '11.3', uv: '1.44.2' },
    nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
    exit: (code: number = 0) => {
      throw new Error(`__PROCESS_EXIT_${code}__`);
    },
    stdout: {
      write: (str: string) => capturedLog(str)
    },
    stderr: {
      write: (str: string) => capturedError(str)
    }
  };

  const customConsole = {
    log: capturedLog,
    info: capturedLog,
    warn: capturedLog,
    error: capturedError,
    table: capturedLog,
    dir: capturedLog,
    time: () => {},
    timeEnd: () => {}
  };

  const sandboxModule = { exports: {} };
  const sandboxExports = sandboxModule.exports;

  return {
    require: sandboxRequire,
    process: sandboxProcess,
    console: customConsole,
    Buffer: SandboxBuffer,
    EventEmitter: SandboxEventEmitter,
    module: sandboxModule,
    exports: sandboxExports,
    __dirname: '/workspace',
    __filename: `/workspace/${scriptName}`,
    setImmediate: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0),
    clearImmediate: (id: any) => clearTimeout(id),
    fetch: universalSandboxFetch,
    Headers: universalSandboxFetch.Headers,
    Request: universalSandboxFetch.Request,
    Response: universalSandboxFetch.Response,
    prompt: askUserFn,
    askUser: askUserFn,
    readline: readlineModule,
    global: window,
    globalThis: window
  };
}

