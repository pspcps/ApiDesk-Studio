import { Environment, KeyValuePair } from '../types';

export interface VariableContext {
  activeEnvironment?: Environment | null;
  globalVariables?: KeyValuePair[];
  collectionVariables?: KeyValuePair[];
  environment?: KeyValuePair[];
  globals?: KeyValuePair[];
  collection?: KeyValuePair[];
}

export function getAllVariablesMap(context: VariableContext): Record<string, string> {
  const map: Record<string, string> = {};

  // 1. Global variables (lowest precedence among user variables)
  const gList = context.globalVariables || context.globals || [];
  for (const v of gList) {
    if (v.enabled && v.key) {
      map[v.key] = v.value;
    }
  }

  // 2. Collection variables
  const cList = context.collectionVariables || context.collection || [];
  for (const v of cList) {
    if (v.enabled && v.key) {
      map[v.key] = v.value;
    }
  }

  // 3. Active environment variables (highest precedence)
  const envList = context.activeEnvironment?.variables || context.environment || [];
  for (const v of envList) {
    if (v.enabled && v.key) {
      map[v.key] = v.value;
    }
  }

  return map;
}

export function resolveDynamicVariable(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower === '$guid' || lower === '$uuid') {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  if (lower === '$timestamp') {
    return Math.floor(Date.now() / 1000).toString();
  }
  if (lower === '$isotimestamp' || lower === '$isodate') {
    return new Date().toISOString();
  }
  if (lower === '$randomint' || lower === '$randomnumber') {
    return Math.floor(Math.random() * 1000).toString();
  }
  if (lower === '$randomemail') {
    return `user_${Math.random().toString(36).substring(2, 7)}@example.com`;
  }
  return null;
}

export function resolveTemplateString(str: string, context: VariableContext): string {
  if (!str || typeof str !== 'string') return str;

  const vars = getAllVariablesMap(context);

  return str.replace(/\{\{\s*([\w$.-]+)\s*\}\}/g, (match, varName) => {
    // Check dynamic built-ins
    const dynamicVal = resolveDynamicVariable(varName);
    if (dynamicVal !== null) {
      return dynamicVal;
    }

    if (Object.prototype.hasOwnProperty.call(vars, varName)) {
      return vars[varName];
    }
    // Return original match if not found so user can spot unresolved variables
    return match;
  });
}

export function getUnresolvedVariables(str: string, context: VariableContext): string[] {
  if (!str || typeof str !== 'string') return [];
  const vars = getAllVariablesMap(context);
  const matches = str.match(/\{\{\s*([\w$.-]+)\s*\}\}/g) || [];
  const unresolved: string[] = [];

  for (const m of matches) {
    const varName = m.replace(/\{\{\s*|\s*\}\}/g, '');
    if (resolveDynamicVariable(varName) === null && !Object.prototype.hasOwnProperty.call(vars, varName)) {
      unresolved.push(varName);
    }
  }

  return unresolved;
}
