/**
 * Background Service Worker - MV3 Service Worker for Engage Center Case Fetcher
 * 
 * Responsibilities:
 * - Listen for outbound requests to Engage Hub endpoints
 * - Capture Authorization and x-eh-scope headers in memory
 * - Handle popup messages for session status and case fetching
 * - Execute case fetch API calls
 */

import { HEADER_AUTH, HEADER_SCOPE, API_BASE_URL, CASE_ENDPOINT, ERROR_CODES, DEBUG_MODE } from '../modules/constants.js';
import * as SessionManager from '../modules/session-manager.js';
import * as CaseApiClient from '../modules/case-api-client.js';

if (DEBUG_MODE) {
  console.log('[ServiceWorker] Starting...');
}

let isListening = false;

/**
 * webRequest listener to capture auth headers from observed requests
 */
function setupWebRequestListener() {
  if (isListening) {
    return;
  }

  chrome.webRequest.onSendHeaders.addListener(
    (details) => {
      const url = new URL(details.url);
      const host = url.host;

      if (!host.includes('engagehub.azure.com') && !host.includes('reactblade.portal.azure.net')) {
        return;
      }

      const authHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === HEADER_AUTH.toLowerCase());
      const scopeHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === HEADER_SCOPE.toLowerCase());

      if (authHeader && scopeHeader) {
        SessionManager.setSession(authHeader.value, scopeHeader.value, host);
        if (DEBUG_MODE) {
          console.log('[ServiceWorker] Auth context captured from:', host);
        }
      }
    },
    {
      urls: [
        'https://gateway.engagehub.azure.com/*',
        'https://*.reactblade.portal.azure.net/*'
      ]
    },
    ['requestHeaders']
  );

  isListening = true;
  if (DEBUG_MODE) {
    console.log('[ServiceWorker] webRequest listener active');
  }
}

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (DEBUG_MODE) {
    console.log('[ServiceWorker] Message received:', message.type);
  }

  switch (message.type) {
    case 'GET_SESSION':
      const session = SessionManager.getSession();
      sendResponse({ 
        hasSession: SessionManager.hasSession(),
        session: session ? {
          status: session.status,
          capturedAt: session.capturedAt,
          sourceHost: session.sourceHost
        } : null
      });
      break;

    case 'FETCH_CASE':
      if (DEBUG_MODE) {
        console.log('[ServiceWorker] Fetch attempted:', message.caseId);
      }
      handleFetchCase(message.caseId)
        .then(result => {
          if (DEBUG_MODE) {
            console.log('[ServiceWorker] Fetch succeeded:', message.caseId);
          }
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          if (DEBUG_MODE) {
            console.log('[ServiceWorker] Fetch failed:', error.code);
          }
          sendResponse({ success: false, error: error.message, code: error.code });
        });
      return true;

    case 'CLEAR_SESSION':
      SessionManager.clearSession();
      sendResponse({ success: true });
      break;

    case 'OPEN_PORTAL':
      chrome.tabs.create({ url: 'https://engagecenter.microsoft.com/#home' });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Fetch case with error handling and session invalidation
 */
async function handleFetchCase(caseId) {
  const session = SessionManager.getSession();
  
  if (!session) {
    const error = new Error('No session available');
    error.code = ERROR_CODES.NO_SESSION;
    throw error;
  }

  try {
    const result = await CaseApiClient.fetchCase(caseId, session);
    return result;
  } catch (err) {
    if (err.code === ERROR_CODES.SESSION_EXPIRED) {
      SessionManager.expireSession();
    }
    throw err;
  }
}

setupWebRequestListener();
if (DEBUG_MODE) {
  console.log('[ServiceWorker] Initialized');
}