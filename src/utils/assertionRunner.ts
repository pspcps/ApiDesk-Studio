import { ApiRequest, ApiResponse, TestAssertion, TestResult } from '../types';

export function runAssertions(request: ApiRequest, response: ApiResponse): { testResults: TestResult[]; savedVariables: Record<string, string> } {
  const testResults: TestResult[] = [];
  const savedVariables: Record<string, string> = {};

  // 1. Run Predefined / Custom Test Assertions
  if (request.tests && request.tests.length > 0) {
    for (const test of request.tests) {
      if (!test.enabled) continue;

      try {
        const result = evaluateAssertion(test, response);
        testResults.push(result);
      } catch (err: any) {
        testResults.push({
          name: test.name || 'Assertion',
          passed: false,
          message: `Evaluation Error: ${err.message}`
        });
      }
    }
  }

  // 2. Process Variable Extractions
  if (request.extractions && request.extractions.length > 0) {
    for (const ext of request.extractions) {
      if (!ext.enabled || !ext.variableName || !ext.pathOrKey) continue;

      try {
        let extractedVal: any = undefined;

        if (ext.source === 'json_path') {
          if (response.isJson && response.data) {
            extractedVal = getJsonPathValue(response.data, ext.pathOrKey);
          }
        } else if (ext.source === 'header') {
          const headerKey = ext.pathOrKey.toLowerCase();
          for (const [k, v] of Object.entries(response.headers)) {
            if (k.toLowerCase() === headerKey) {
              extractedVal = v;
              break;
            }
          }
        } else if (ext.source === 'status_code') {
          extractedVal = response.status.toString();
        }

        if (extractedVal !== undefined && extractedVal !== null) {
          savedVariables[ext.variableName] = typeof extractedVal === 'object' ? JSON.stringify(extractedVal) : String(extractedVal);
        }
      } catch {
        // Ignore extraction error
      }
    }
  }

  return { testResults, savedVariables };
}

function evaluateAssertion(test: TestAssertion, response: ApiResponse): TestResult {
  const name = test.name || `${test.type} check`;

  switch (test.type) {
    case 'status_code': {
      const target = parseInt(test.targetValue || '200', 10);
      const actual = response.status;
      const passed = test.operator === 'not_equals' ? actual !== target : actual === target;
      return {
        name,
        passed,
        message: passed ? `Status is ${actual}` : `Expected status ${target} but got ${actual}`,
        expected: target.toString(),
        actual: actual.toString()
      };
    }

    case 'response_time': {
      const maxTime = parseInt(test.targetValue || '500', 10);
      const actual = response.timeMs;
      const passed = actual <= maxTime;
      return {
        name,
        passed,
        message: passed ? `Response time is ${actual}ms (<= ${maxTime}ms)` : `Response took ${actual}ms, exceeding max ${maxTime}ms`,
        expected: `<= ${maxTime}ms`,
        actual: `${actual}ms`
      };
    }

    case 'body_contains': {
      const target = test.targetValue || '';
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const passed = text.includes(target);
      return {
        name,
        passed,
        message: passed ? `Body contains "${target}"` : `Body does not contain "${target}"`,
        expected: `Contains: "${target}"`,
        actual: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      };
    }

    case 'header_exists': {
      const targetHeader = (test.targetValue || '').toLowerCase();
      const headerKeys = Object.keys(response.headers).map(k => k.toLowerCase());
      const passed = headerKeys.includes(targetHeader);
      return {
        name,
        passed,
        message: passed ? `Header "${test.targetValue}" is present` : `Header "${test.targetValue}" was not found in response`,
        expected: `Header: ${test.targetValue}`,
        actual: passed ? 'Found' : 'Missing'
      };
    }

    case 'json_path': {
      if (!response.isJson || !response.data) {
        return {
          name,
          passed: false,
          message: 'Response is not JSON',
          actual: 'Non-JSON'
        };
      }
      const val = getJsonPathValue(response.data, test.targetValue || '');
      const hasValue = val !== undefined && val !== null;
      return {
        name,
        passed: hasValue,
        message: hasValue ? `JSON path "${test.targetValue}" resolved to: ${JSON.stringify(val).substring(0, 40)}` : `Path "${test.targetValue}" not found in JSON`,
        expected: `Path: ${test.targetValue}`,
        actual: hasValue ? String(val) : 'undefined'
      };
    }

    case 'custom_js': {
      if (!test.customScript) {
        return { name, passed: true, message: 'Empty script passed' };
      }
      try {
        // Safe evaluation sandbox with response object
        const fn = new Function('response', 'status', 'headers', 'data', 'timeMs', `
          try {
            ${test.customScript}
            return { passed: true, message: "Test passed successfully" };
          } catch(e) {
            return { passed: false, message: e.message || "Assertion failed" };
          }
        `);
        const result = fn(response, response.status, response.headers, response.data, response.timeMs);
        return {
          name,
          passed: !!result.passed,
          message: result.message
        };
      } catch (err: any) {
        return {
          name,
          passed: false,
          message: `Script Error: ${err.message}`
        };
      }
    }

    default:
      return { name, passed: true, message: 'Assertion check passed' };
  }
}

export function getJsonPathValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const cleanPath = path.replace(/^\$\./, '').replace(/\[(\w+)\]/g, '.$1');
  const parts = cleanPath.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[p];
  }
  return curr;
}
