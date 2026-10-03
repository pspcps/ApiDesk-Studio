import { ApiRequest, EnvironmentRequestOverride, KeyValuePair, AuthConfig, BodyConfig } from '../types';

/**
 * Deep clones KeyValuePair array
 */
function clonePairs(pairs?: KeyValuePair[]): KeyValuePair[] {
  if (!pairs) return [];
  return pairs.map(p => ({ ...p }));
}

/**
 * Deep clones BodyConfig
 */
function cloneBody(body: BodyConfig): BodyConfig {
  return {
    ...body,
    formData: body.formData ? clonePairs(body.formData) : [],
    urlencoded: body.urlencoded ? clonePairs(body.urlencoded) : []
  };
}

/**
 * Deep clones AuthConfig
 */
function cloneAuth(auth: AuthConfig): AuthConfig {
  return { ...auth };
}

/**
 * Checks if a specific environment has an active override configured for this request
 */
export function hasEnvironmentOverride(request: ApiRequest, envId?: string | null): boolean {
  if (!envId || !request.environmentOverrides) return false;
  const override = request.environmentOverrides[envId];
  if (!override) return false;
  return !!(
    override.params !== undefined ||
    override.headers !== undefined ||
    override.auth !== undefined ||
    override.body !== undefined ||
    override.url !== undefined
  );
}

/**
 * Returns which specific fields are overridden for the given environment
 */
export function getOverriddenFields(
  request: ApiRequest,
  envId?: string | null
): { url: boolean; params: boolean; headers: boolean; auth: boolean; body: boolean; count: number } {
  if (!envId || !request.environmentOverrides || !request.environmentOverrides[envId]) {
    return { url: false, params: false, headers: false, auth: false, body: false, count: 0 };
  }
  const o = request.environmentOverrides[envId];
  const url = o.url !== undefined;
  const params = o.params !== undefined;
  const headers = o.headers !== undefined;
  const auth = o.auth !== undefined;
  const body = o.body !== undefined;
  const count = [url, params, headers, auth, body].filter(Boolean).length;
  return { url, params, headers, auth, body, count };
}

/**
 * Resolves the effective request for execution or display in a specific environment.
 * If activeEnvironmentId is provided and an override exists for that environment,
 * those fields are applied over the base request.
 */
export function getEffectiveRequest(
  request: ApiRequest,
  activeEnvironmentId?: string | null
): ApiRequest {
  if (!activeEnvironmentId || !request.environmentOverrides) {
    return request;
  }

  const override = request.environmentOverrides[activeEnvironmentId];
  if (!override) {
    return request;
  }

  return {
    ...request,
    url: override.url !== undefined ? override.url : request.url,
    params: override.params !== undefined ? clonePairs(override.params) : request.params,
    headers: override.headers !== undefined ? clonePairs(override.headers) : request.headers,
    auth: override.auth !== undefined ? cloneAuth(override.auth) : request.auth,
    body: override.body !== undefined ? cloneBody(override.body) : request.body
  };
}

/**
 * Updates a specific field on the request.
 * If targetEnvId is provided and isOverrideActive is true, saves to request.environmentOverrides[targetEnvId].
 * Otherwise saves to the base default request.
 */
export function updateRequestField(
  request: ApiRequest,
  targetEnvId: string | null,
  isOverrideActive: boolean,
  field: 'url' | 'params' | 'headers' | 'auth' | 'body' | 'method' | 'name' | 'tests' | 'extractions' | 'settings' | 'preRequestScript' | 'postResponseScript',
  value: any
): ApiRequest {
  const isPerEnvField = ['url', 'params', 'headers', 'auth', 'body'].includes(field);

  if (targetEnvId && isOverrideActive && isPerEnvField) {
    const prevOverrides = request.environmentOverrides || {};
    const currentEnvOverride: EnvironmentRequestOverride = prevOverrides[targetEnvId] 
      ? { ...prevOverrides[targetEnvId] } 
      : {};

    currentEnvOverride[field as 'url' | 'params' | 'headers' | 'auth' | 'body'] = value;

    return {
      ...request,
      environmentOverrides: {
        ...prevOverrides,
        [targetEnvId]: currentEnvOverride
      },
      updatedAt: Date.now()
    };
  }

  // Update base request
  return {
    ...request,
    [field]: value,
    updatedAt: Date.now()
  };
}

/**
 * Creates/initializes an environment override by copying the current default values
 */
export function createEnvironmentOverride(
  request: ApiRequest,
  envId: string
): ApiRequest {
  const prevOverrides = request.environmentOverrides || {};
  const newOverride: EnvironmentRequestOverride = {
    url: request.url,
    params: clonePairs(request.params),
    headers: clonePairs(request.headers),
    auth: cloneAuth(request.auth),
    body: cloneBody(request.body)
  };

  return {
    ...request,
    environmentOverrides: {
      ...prevOverrides,
      [envId]: newOverride
    },
    updatedAt: Date.now()
  };
}

/**
 * Copies the base default request values into the environment override
 */
export function copyDefaultToEnvironment(
  request: ApiRequest,
  envId: string
): ApiRequest {
  return createEnvironmentOverride(request, envId);
}

/**
 * Promotes the environment override values to become the new base default request values
 */
export function promoteEnvironmentToDefault(
  request: ApiRequest,
  envId: string
): ApiRequest {
  if (!request.environmentOverrides || !request.environmentOverrides[envId]) {
    return request;
  }
  const override = request.environmentOverrides[envId];
  return {
    ...request,
    url: override.url !== undefined ? override.url : request.url,
    params: override.params !== undefined ? clonePairs(override.params) : request.params,
    headers: override.headers !== undefined ? clonePairs(override.headers) : request.headers,
    auth: override.auth !== undefined ? cloneAuth(override.auth) : request.auth,
    body: override.body !== undefined ? cloneBody(override.body) : request.body,
    updatedAt: Date.now()
  };
}

/**
 * Clears/removes the environment override for a specific environment
 */
export function removeEnvironmentOverride(
  request: ApiRequest,
  envId: string
): ApiRequest {
  if (!request.environmentOverrides || !request.environmentOverrides[envId]) {
    return request;
  }
  const updatedOverrides = { ...request.environmentOverrides };
  delete updatedOverrides[envId];

  return {
    ...request,
    environmentOverrides: Object.keys(updatedOverrides).length > 0 ? updatedOverrides : undefined,
    updatedAt: Date.now()
  };
}
