/**
 * Configuration constants for Engage Center Case Fetcher
 * 
 * @module constants
 */

// API Configuration
/** @type {string} */
export const API_BASE_URL = 'https://gateway.engagehub.azure.com';
/** @type {string} */
export const CASE_ENDPOINT = '/support/cases';

// Header Names
/** @type {string} */
export const HEADER_AUTH = 'Authorization';
/** @type {string} */
export const HEADER_SCOPE = 'x-eh-scope';

// Error Codes
/** @type {Object} */
export const ERROR_CODES = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  CASE_NOT_FOUND: 'CASE_NOT_FOUND',
  NETWORK_ERROR: 'NETWORK_ERROR',
  NO_SESSION: 'NO_SESSION',
  INVALID_INPUT: 'INVALID_INPUT'
};

// Session Configuration
/** Session max age in milliseconds (30 minutes) @type {number} */
export const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

/** @type {string[]} */
export const PORTAL_HOSTS = [
  'gateway.engagehub.azure.com',
  '*.reactblade.portal.azure.net'
];

// Debug Mode (set to true for development)
export const DEBUG_MODE = false;

// Request Configuration
/** @type {number} */
export const REQUEST_TIMEOUT_MS = 15000;
