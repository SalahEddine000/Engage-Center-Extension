/**
 * Session Manager - In-memory authentication context management
 * 
 * Stores captured auth context (Authorization + x-eh-scope) in memory only.
 * Session is cleared on browser restart (service worker restart), logout, or auth failure.
 * 
 * @module session-manager
 */

import { HEADER_AUTH, HEADER_SCOPE, SESSION_MAX_AGE_MS, DEBUG_MODE } from './constants.js';

/**
 * @typedef {Object} SessionContext
 * @property {string} authorization - Bearer token (masked in logs)
 * @property {string} scope - x-eh-scope header value
 * @property {string} capturedAt - ISO timestamp
 * @property {string} sourceHost - Origin host
 * @property {string} status - 'connected' | 'expired'
 */

/** @type {SessionContext|null} */
let currentSession = null;

/**
 * Get the current session context
 * @returns {SessionContext|null} Session object or null if no valid session
 */
export function getSession() {
  if (!currentSession) {
    return null;
  }

  if (currentSession.status === 'expired') {
    return null;
  }

  const age = Date.now() - new Date(currentSession.capturedAt).getTime();
  if (age > SESSION_MAX_AGE_MS) {
    currentSession.status = 'expired';
    return null;
  }

  return currentSession;
}

/**
 * Set the session context from observed request headers
 * @param {string} authorization - Authorization header value (Bearer token)
 * @param {string} scope - x-eh-scope header value
 * @param {string} sourceHost - Origin host of the request
 */
export function setSession(authorization, scope, sourceHost) {
  currentSession = {
    authorization,
    scope,
    capturedAt: new Date().toISOString(),
    sourceHost,
    status: 'connected'
  };
  if (DEBUG_MODE) {
    console.log('[SessionManager] Session captured from:', sourceHost);
  }
}

/**
 * Clear the current session (e.g., on logout or auth failure)
 */
export function clearSession() {
  if (currentSession) {
    if (DEBUG_MODE) {
      console.log('[SessionManager] Session cleared');
    }
  }
  currentSession = null;
}

/**
 * Mark session as expired (e.g., after 401/403 response)
 */
export function expireSession() {
  if (currentSession) {
    currentSession.status = 'expired';
    if (DEBUG_MODE) {
      console.log('[SessionManager] Session marked as expired');
    }
  }
}

/**
 * Check if we have a valid session
 * @returns {boolean}
 */
export function hasSession() {
  return getSession() !== null;
}

/**
 * Get masked authorization for logging
 * @returns {string}
 */
export function getMaskedAuth() {
  if (!currentSession) {
    return 'None';
  }
  return 'Bearer [REDACTED]';
}
