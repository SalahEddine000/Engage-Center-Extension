/**
 * Content Script - Fallback auth context capture
 * 
 * This content script can be used if webRequest proves insufficient.
 * It injects a page-context script to monitor fetch/XHR calls and
 * relays auth headers back to the extension via window.postMessage.
 * 
 * NOTE: This is a fallback option. Primary auth capture uses webRequest.
 */

(function() {
  'use strict';

  const PORTAL_HOSTS = [
    'engagehub.azure.com',
    'reactblade.portal.azure.net'
  ];

  function isEngageCenterPage() {
    const hostname = window.location.hostname;
    return PORTAL_HOSTS.some(host => hostname.includes(host));
  }

  if (!isEngageCenterPage()) {
    return;
  }

  console.log('[ContentScript] Engage Center detected, setting up bridge');

  const originalFetch = window.fetch;
  const originalXHR = window.XMLHttpRequest;

  function captureAndRelay(url, headers) {
    if (!url.includes('/support/cases')) {
      return;
    }

    const authHeader = headers?.['Authorization'] || headers?.['authorization'];
    const scopeHeader = headers?.['x-eh-scope'] || headers?.['X-Eh-Scope'];

    if (authHeader && scopeHeader) {
      window.postMessage({
        type: 'ENGAGE_CENTER_AUTH',
        authorization: authHeader,
        scope: scopeHeader,
        sourceUrl: url
      }, '*');
    }
  }

  window.fetch = function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    const options = args[1] || {};
    const headers = options.headers || {};
    
    captureAndRelay(url, headers);
    
    return originalFetch.apply(this, args);
  };

  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    const headers = this._headers || {};
    captureAndRelay(this._url, headers);
    
    return send.apply(this, arguments);
  };

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._url = url;
    this._headers = {};
    
    const setRequestHeader = this.setRequestHeader;
    this.setRequestHeader = function(name, value) {
      this._headers[name] = value;
      return setRequestHeader.apply(this, arguments);
    };
    
    return open.apply(this, arguments);
  };

  console.log('[ContentScript] Bridge active');
})();