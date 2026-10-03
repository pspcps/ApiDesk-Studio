import { ApiRequest, ApiResponse, TestResult, ScriptLogItem, KeyValuePair } from '../types';
import { VariableContext } from './variableResolver';

export interface PreRequestScriptResult {
  updatedEnvironmentVariables: Record<string, string>;
  updatedGlobalVariables: Record<string, string>;
  dynamicHeaders: Record<string, string>;
  dynamicParams: Record<string, string>;
  logs: ScriptLogItem[];
  error?: string;
}

export interface PostResponseScriptResult {
  testResults: TestResult[];
  updatedEnvironmentVariables: Record<string, string>;
  updatedGlobalVariables: Record<string, string>;
  logs: ScriptLogItem[];
  error?: string;
}

/**
 * Creates an expect assertion wrapper matching Chai.js / Postman pm.expect
 */
function createExpectWrapper(actualValue: any) {
  let isNegated = false;

  const getTargetDesc = () => {
    try {
      if (typeof actualValue === 'object') return JSON.stringify(actualValue);
      return String(actualValue);
    } catch {
      return String(actualValue);
    }
  };

  const assert = (condition: boolean, passMsg: string, failMsg: string) => {
    const finalCond = isNegated ? !condition : condition;
    if (!finalCond) {
      const msg = isNegated ? `Expected NOT to satisfy: ${passMsg}` : failMsg;
      throw new Error(msg);
    }
  };

  const chainable = {
    get not() {
      isNegated = !isNegated;
      return chainable;
    },
    get to() {
      return chainable;
    },
    get be() {
      return chainable;
    },
    get have() {
      return chainable;
    },
    get is() {
      return chainable;
    },
    get that() {
      return chainable;
    },
    get which() {
      return chainable;
    },
    get at() {
      return chainable;
    },

    equal(expected: any, message?: string) {
      assert(
        actualValue === expected,
        `equal ${expected}`,
        message || `Expected ${getTargetDesc()} to equal ${expected}`
      );
      return chainable;
    },
    eql(expected: any, message?: string) {
      const isEq = JSON.stringify(actualValue) === JSON.stringify(expected);
      assert(
        isEq,
        `deep equal ${JSON.stringify(expected)}`,
        message || `Expected ${getTargetDesc()} to deeply equal ${JSON.stringify(expected)}`
      );
      return chainable;
    },
    equals(expected: any, message?: string) {
      return chainable.equal(expected, message);
    },
    above(val: number, message?: string) {
      assert(
        Number(actualValue) > val,
        `be above ${val}`,
        message || `Expected ${actualValue} to be above ${val}`
      );
      return chainable;
    },
    greaterThan(val: number, message?: string) {
      return chainable.above(val, message);
    },
    below(val: number, message?: string) {
      assert(
        Number(actualValue) < val,
        `be below ${val}`,
        message || `Expected ${actualValue} to be below ${val}`
      );
      return chainable;
    },
    lessThan(val: number, message?: string) {
      return chainable.below(val, message);
    },
    least(val: number, message?: string) {
      assert(
        Number(actualValue) >= val,
        `be at least ${val}`,
        message || `Expected ${actualValue} to be at least ${val}`
      );
      return chainable;
    },
    most(val: number, message?: string) {
      assert(
        Number(actualValue) <= val,
        `be at most ${val}`,
        message || `Expected ${actualValue} to be at most ${val}`
      );
      return chainable;
    },
    include(val: any, message?: string) {
      let contains = false;
      if (typeof actualValue === 'string') {
        contains = actualValue.includes(String(val));
      } else if (Array.isArray(actualValue)) {
        contains = actualValue.includes(val);
      } else if (typeof actualValue === 'object' && actualValue !== null) {
        contains = val in actualValue;
      }
      assert(
        contains,
        `include ${val}`,
        message || `Expected ${getTargetDesc()} to include ${val}`
      );
      return chainable;
    },
    contain(val: any, message?: string) {
      return chainable.include(val, message);
    },
    property(propName: string, value?: any, message?: string) {
      const hasProp = actualValue !== null && actualValue !== undefined && propName in actualValue;
      assert(
        hasProp,
        `have property ${propName}`,
        message || `Expected object to have property "${propName}"`
      );
      if (value !== undefined) {
        const valMatches = actualValue[propName] === value;
        assert(
          valMatches,
          `property "${propName}" to equal ${value}`,
          message || `Expected property "${propName}" to equal ${value}, but got ${actualValue[propName]}`
        );
      }
      return chainable;
    },
    lengthOf(len: number, message?: string) {
      const actualLen = actualValue?.length ?? actualValue?.size;
      assert(
        actualLen === len,
        `have length ${len}`,
        message || `Expected length to be ${len} but got ${actualLen}`
      );
      return chainable;
    },
    a(typeString: string, message?: string) {
      const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue;
      assert(
        actualType.toLowerCase() === typeString.toLowerCase(),
        `be a ${typeString}`,
        message || `Expected ${getTargetDesc()} to be a ${typeString}, got ${actualType}`
      );
      return chainable;
    },
    an(typeString: string, message?: string) {
      return chainable.a(typeString, message);
    },
    match(regex: RegExp, message?: string) {
      assert(
        regex.test(String(actualValue)),
        `match pattern ${regex}`,
        message || `Expected "${actualValue}" to match pattern ${regex}`
      );
      return chainable;
    },
    get true() {
      assert(actualValue === true, `be true`, `Expected ${getTargetDesc()} to be true`);
      return chainable;
    },
    get false() {
      assert(actualValue === false, `be false`, `Expected ${getTargetDesc()} to be false`);
      return chainable;
    },
    get ok() {
      assert(!!actualValue, `be truthy`, `Expected ${getTargetDesc()} to be truthy`);
      return chainable;
    },
    get null() {
      assert(actualValue === null, `be null`, `Expected ${getTargetDesc()} to be null`);
      return chainable;
    },
    get undefined() {
      assert(actualValue === undefined, `be undefined`, `Expected ${getTargetDesc()} to be undefined`);
      return chainable;
    },
    get empty() {
      const isEmpty =
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0) ||
        (typeof actualValue === 'object' && actualValue !== null && Object.keys(actualValue).length === 0);
      assert(isEmpty, `be empty`, `Expected ${getTargetDesc()} to be empty`);
      return chainable;
    }
  };

  return chainable;
}

/**
 * Runs JavaScript Pre-Request script before sending HTTP request
 */
function getEnvList(ctx: VariableContext) {
  return ctx.activeEnvironment?.variables || ctx.environment || [];
}

function getGlobList(ctx: VariableContext) {
  return ctx.globalVariables || ctx.globals || [];
}

export function runPreRequestScript(
  script: string | undefined,
  request: ApiRequest,
  variableContext: VariableContext
): PreRequestScriptResult {
  const logs: ScriptLogItem[] = [];
  const updatedEnvironmentVariables: Record<string, string> = {};
  const updatedGlobalVariables: Record<string, string> = {};
  const dynamicHeaders: Record<string, string> = {};
  const dynamicParams: Record<string, string> = {};

  if (!script || !script.trim()) {
    return { updatedEnvironmentVariables, updatedGlobalVariables, dynamicHeaders, dynamicParams, logs };
  }

  // Intercept logging
  const customConsole = {
    log: (...args: any[]) => {
      logs.push({ type: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    info: (...args: any[]) => {
      logs.push({ type: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    warn: (...args: any[]) => {
      logs.push({ type: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    error: (...args: any[]) => {
      logs.push({ type: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    }
  };

  // Build pm object
  const pm = {
    environment: {
      get: (key: string) => {
        if (key in updatedEnvironmentVariables) return updatedEnvironmentVariables[key];
        const match = getEnvList(variableContext).find(v => v.key === key && v.enabled);
        return match ? match.value : undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedEnvironmentVariables[key] = valStr;
        customConsole.log(`[pm.environment.set] ${key} = ${valStr}`);
      },
      unset: (key: string) => {
        delete updatedEnvironmentVariables[key];
      }
    },
    globals: {
      get: (key: string) => {
        if (key in updatedGlobalVariables) return updatedGlobalVariables[key];
        const match = getGlobList(variableContext).find(v => v.key === key && v.enabled);
        return match ? match.value : undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedGlobalVariables[key] = valStr;
        customConsole.log(`[pm.globals.set] ${key} = ${valStr}`);
      },
      unset: (key: string) => {
        delete updatedGlobalVariables[key];
      }
    },
    variables: {
      get: (key: string) => {
        if (key in updatedEnvironmentVariables) return updatedEnvironmentVariables[key];
        if (key in updatedGlobalVariables) return updatedGlobalVariables[key];
        const envMatch = getEnvList(variableContext).find(v => v.key === key && v.enabled);
        if (envMatch) return envMatch.value;
        const gMatch = getGlobList(variableContext).find(v => v.key === key && v.enabled);
        if (gMatch) return gMatch.value;
        return undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedEnvironmentVariables[key] = valStr;
      }
    },
    request: {
      url: request.url,
      method: request.method,
      headers: {
        add: (headerObj: { key: string; value: string }) => {
          if (headerObj && headerObj.key) {
            dynamicHeaders[headerObj.key] = String(headerObj.value);
            customConsole.log(`[pm.request.headers.add] ${headerObj.key}: ${headerObj.value}`);
          }
        },
        upsert: (headerObj: { key: string; value: string }) => {
          if (headerObj && headerObj.key) {
            dynamicHeaders[headerObj.key] = String(headerObj.value);
          }
        },
        get: (key: string) => {
          if (key in dynamicHeaders) return dynamicHeaders[key];
          const found = (request.headers || []).find(h => h.key.toLowerCase() === key.toLowerCase() && h.enabled);
          return found ? found.value : undefined;
        },
        remove: (key: string) => {
          delete dynamicHeaders[key];
        }
      },
      params: {
        add: (key: string, value: string) => {
          dynamicParams[key] = String(value);
        }
      },
      body: request.body
    },
    expect: createExpectWrapper,
    log: customConsole.log
  };

  try {
    const fn = new Function('pm', 'console', 'environment', 'globals', 'request', `
      "use strict";
      ${script}
    `);
    fn(pm, customConsole, pm.environment, pm.globals, pm.request);
  } catch (err: any) {
    customConsole.error(`Pre-request script error: ${err.message}`);
    return {
      updatedEnvironmentVariables,
      updatedGlobalVariables,
      dynamicHeaders,
      dynamicParams,
      logs,
      error: err.message
    };
  }

  return {
    updatedEnvironmentVariables,
    updatedGlobalVariables,
    dynamicHeaders,
    dynamicParams,
    logs
  };
}

/**
 * Runs JavaScript Post-Response / Test script after receiving HTTP response
 */
export function runPostResponseScript(
  script: string | undefined,
  request: ApiRequest,
  response: ApiResponse,
  variableContext: VariableContext
): PostResponseScriptResult {
  const logs: ScriptLogItem[] = [];
  const testResults: TestResult[] = [];
  const updatedEnvironmentVariables: Record<string, string> = {};
  const updatedGlobalVariables: Record<string, string> = {};

  if (!script || !script.trim()) {
    return { testResults, updatedEnvironmentVariables, updatedGlobalVariables, logs };
  }

  // Logging capture
  const customConsole = {
    log: (...args: any[]) => {
      logs.push({ type: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    info: (...args: any[]) => {
      logs.push({ type: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    warn: (...args: any[]) => {
      logs.push({ type: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    },
    error: (...args: any[]) => {
      logs.push({ type: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    }
  };

  // Test Runner function: pm.test("name", function() { ... })
  const runPmTest = (testName: string, testFn: () => void) => {
    try {
      testFn();
      testResults.push({
        name: testName,
        passed: true,
        message: 'PASS: Test passed successfully'
      });
      customConsole.log(`✓ PASS: ${testName}`);
    } catch (err: any) {
      testResults.push({
        name: testName,
        passed: false,
        message: `FAIL: ${err.message || 'Assertion failed'}`
      });
      customConsole.warn(`✗ FAIL: ${testName} - ${err.message}`);
    }
  };

  // Response helper object
  const responseHelper = {
    code: response.status,
    status: response.status,
    statusText: response.statusText,
    responseTime: response.timeMs,
    time: response.timeMs,
    headers: {
      get: (key: string) => {
        const lower = key.toLowerCase();
        for (const [k, v] of Object.entries(response.headers || {})) {
          if (k.toLowerCase() === lower) return v;
        }
        return undefined;
      },
      has: (key: string) => {
        const lower = key.toLowerCase();
        return Object.keys(response.headers || {}).some(k => k.toLowerCase() === lower);
      }
    },
    json: () => {
      if (typeof response.data === 'object' && response.data !== null) {
        return response.data;
      }
      try {
        return JSON.parse(response.data);
      } catch {
        throw new Error('Response body is not valid JSON');
      }
    },
    text: () => {
      if (typeof response.data === 'string') return response.data;
      return JSON.stringify(response.data);
    },
    to: {
      have: {
        status: (code: number) => {
          if (response.status !== code) {
            throw new Error(`Expected status code ${code} but got ${response.status}`);
          }
        },
        header: (headerName: string, expectedVal?: string) => {
          const lower = headerName.toLowerCase();
          const hasIt = Object.keys(response.headers || {}).some(k => k.toLowerCase() === lower);
          if (!hasIt) {
            throw new Error(`Expected response to have header "${headerName}"`);
          }
          if (expectedVal !== undefined) {
            const actualVal = responseHelper.headers.get(headerName);
            if (actualVal !== expectedVal) {
              throw new Error(`Expected header "${headerName}" to equal "${expectedVal}" but got "${actualVal}"`);
            }
          }
        }
      },
      be: {
        get ok() {
          if (!response.ok) throw new Error(`Expected response to be OK (status 2xx), got ${response.status}`);
          return true;
        },
        get json() {
          if (!response.isJson) throw new Error(`Expected response content-type to be JSON, got ${response.contentType}`);
          return true;
        }
      }
    }
  };

  const pm = {
    test: runPmTest,
    expect: createExpectWrapper,
    response: responseHelper,
    environment: {
      get: (key: string) => {
        if (key in updatedEnvironmentVariables) return updatedEnvironmentVariables[key];
        const match = getEnvList(variableContext).find(v => v.key === key && v.enabled);
        return match ? match.value : undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedEnvironmentVariables[key] = valStr;
        customConsole.log(`[pm.environment.set] ${key} = ${valStr}`);
      },
      unset: (key: string) => {
        delete updatedEnvironmentVariables[key];
      }
    },
    globals: {
      get: (key: string) => {
        if (key in updatedGlobalVariables) return updatedGlobalVariables[key];
        const match = getGlobList(variableContext).find(v => v.key === key && v.enabled);
        return match ? match.value : undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedGlobalVariables[key] = valStr;
        customConsole.log(`[pm.globals.set] ${key} = ${valStr}`);
      },
      unset: (key: string) => {
        delete updatedGlobalVariables[key];
      }
    },
    variables: {
      get: (key: string) => {
        if (key in updatedEnvironmentVariables) return updatedEnvironmentVariables[key];
        if (key in updatedGlobalVariables) return updatedGlobalVariables[key];
        const envMatch = getEnvList(variableContext).find(v => v.key === key && v.enabled);
        if (envMatch) return envMatch.value;
        const gMatch = getGlobList(variableContext).find(v => v.key === key && v.enabled);
        if (gMatch) return gMatch.value;
        return undefined;
      },
      set: (key: string, value: any) => {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        updatedEnvironmentVariables[key] = valStr;
      }
    },
    request: {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body
    },
    log: customConsole.log
  };

  try {
    const fn = new Function('pm', 'console', 'response', 'environment', 'globals', `
      "use strict";
      ${script}
    `);
    fn(pm, customConsole, pm.response, pm.environment, pm.globals);
  } catch (err: any) {
    customConsole.error(`Post-response script error: ${err.message}`);
    return {
      testResults,
      updatedEnvironmentVariables,
      updatedGlobalVariables,
      logs,
      error: err.message
    };
  }

  return {
    testResults,
    updatedEnvironmentVariables,
    updatedGlobalVariables,
    logs
  };
}
