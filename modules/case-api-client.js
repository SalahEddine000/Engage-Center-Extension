/**
 * Case API Client - Handles fetching case data from Engage Center API
 * 
 * @module case-api-client
 */

import { API_BASE_URL, CASE_ENDPOINT, HEADER_AUTH, HEADER_SCOPE, ERROR_CODES, DEBUG_MODE } from './constants.js';

const REQUEST_TIMEOUT_MS = 15000;

/**
 * @typedef {Object} CaseResult
 * @property {string} caseId - The case ID
 * @property {string} fetchedAt - ISO timestamp
 * @property {Object} payload - The case data payload
 */

/**
 * Fetch a case by ID using the provided session context
 * @param {string} caseId - The Case ID to fetch
 * @param {Object} session - Session object with authorization and scope
 * @returns {Promise<CaseResult>}
 * @throws {Error} Normalized error with code property
 */
export async function fetchCase(caseId, session) {
  if (!session) {
    const error = new Error('No session available');
    error.code = ERROR_CODES.NO_SESSION;
    throw error;
  }

  if (!caseId || typeof caseId !== 'string') {
    const error = new Error('Invalid Case ID');
    error.code = ERROR_CODES.INVALID_INPUT;
    throw error;
  }

  const trimmedId = caseId.trim();
  if (!/^\d+$/.test(trimmedId)) {
    const error = new Error('Case ID must be numeric');
    error.code = ERROR_CODES.INVALID_INPUT;
    throw error;
  }

  const url = `${API_BASE_URL}${CASE_ENDPOINT}/${trimmedId}`;
  
  const headers = {
    [HEADER_AUTH]: session.authorization,
    [HEADER_SCOPE]: session.scope
  };

  if (DEBUG_MODE) {
    console.log('[CaseApiClient] Fetching case:', trimmedId);
    console.log('[CaseApiClient] URL:', url);
    console.log('[CaseApiClient] Auth:', 'Bearer [REDACTED]');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      const error = new Error('Session expired or unauthorized');
      error.code = ERROR_CODES.SESSION_EXPIRED;
      throw error;
    }

    if (response.status === 404) {
      const error = new Error('Case not found');
      error.code = ERROR_CODES.CASE_NOT_FOUND;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.code = ERROR_CODES.NETWORK_ERROR;
      throw error;
    }

    const data = await response.json();
    
    if (DEBUG_MODE) {
      console.log('[CaseApiClient] Case fetched successfully');
    }
    
    return {
      caseId: trimmedId,
      fetchedAt: new Date().toISOString(),
      payload: data
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      const error = new Error('Request timed out');
      error.code = ERROR_CODES.NETWORK_ERROR;
      throw error;
    }
    
    if (err.code && Object.values(ERROR_CODES).includes(err.code)) {
      throw err;
    }
    
    const error = new Error('Network request failed');
    error.code = ERROR_CODES.NETWORK_ERROR;
    error.originalError = err;
    throw error;
  }
}
