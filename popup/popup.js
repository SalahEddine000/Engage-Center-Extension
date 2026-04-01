/**
 * Popup Script - UI Logic for Engage Center Case Fetcher
 */

const ELEMENTS = {
  sessionStatus: document.getElementById('sessionStatus'),
  emptyState: document.getElementById('emptyState'),
  mainContent: document.getElementById('mainContent'),
  caseIdInput: document.getElementById('caseIdInput'),
  inputError: document.getElementById('inputError'),
  btnFetch: document.getElementById('btnFetch'),
  btnOpenPortalMain: document.getElementById('btnOpenPortalMain'),
  resultArea: document.getElementById('resultArea'),
  summaryCaseId: document.getElementById('summaryCaseId'),
  summaryStatus: document.getElementById('summaryStatus'),
  summaryStateAnnotation: document.getElementById('summaryStateAnnotation'),
  summaryStateAnnotationLastUpdatedOn: document.getElementById('summaryStateAnnotationLastUpdatedOn'),
  summarySeverity: document.getElementById('summarySeverity'),
  summaryCreated: document.getElementById('summaryCreated'),
  btnCopySummary: document.getElementById('btnCopySummary'),
  btnToggleJson: document.getElementById('btnToggleJson'),
  jsonView: document.getElementById('jsonView'),
  btnCopyJson: document.getElementById('btnCopyJson'),
  btnClear: document.getElementById('btnClear'),
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  btnOpenPortal: document.getElementById('btnOpenPortal')
};

const ERROR_MESSAGES = {
  NO_SESSION: 'Open Engage Center and sign in to begin.',
  SESSION_EXPIRED: 'Session expired or unauthorized. Please re-open Engage Center.',
  CASE_NOT_FOUND: 'Case not found. Please check the Case ID and try again.',
  NETWORK_ERROR: 'Request failed. Please check your connection and retry.',
  INVALID_INPUT: 'Please enter a valid numeric Case ID.'
};

let currentJson = null;
let jsonVisible = false;

async function init() {
  await checkSession();
  setupEventListeners();
}

async function checkSession() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    updateSessionBadge(response.hasSession, response.session);
    
    if (!response.hasSession) {
      ELEMENTS.emptyState.style.display = 'flex';
      ELEMENTS.mainContent.style.display = 'none';
    } else {
      ELEMENTS.emptyState.style.display = 'none';
      ELEMENTS.mainContent.style.display = 'block';
      ELEMENTS.btnFetch.disabled = false;
    }
  } catch (error) {
    console.error('Failed to check session:', error);
    updateSessionBadge(false, null);
  }
}

function updateSessionBadge(hasSession, session) {
  const badge = ELEMENTS.sessionStatus;
  badge.classList.remove('connected', 'not-detected', 'expired');
  
  if (!hasSession || !session) {
    badge.classList.add('not-detected');
    badge.querySelector('.status-text').textContent = 'Not detected';
  } else if (session.status === 'expired') {
    badge.classList.add('expired');
    badge.querySelector('.status-text').textContent = 'Expired';
  } else {
    badge.classList.add('connected');
    badge.querySelector('.status-text').textContent = 'Connected';
  }
}

function setupEventListeners() {
  ELEMENTS.caseIdInput.addEventListener('input', handleInputChange);
  ELEMENTS.caseIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleFetchCase();
    }
  });
  
  ELEMENTS.btnFetch.addEventListener('click', handleFetchCase);
  ELEMENTS.btnOpenPortalMain.addEventListener('click', handleOpenPortal);
  ELEMENTS.btnOpenPortal?.addEventListener('click', handleOpenPortal);
  ELEMENTS.btnCopySummary.addEventListener('click', copySummary);
  ELEMENTS.btnToggleJson.addEventListener('click', toggleJsonView);
  ELEMENTS.btnCopyJson.addEventListener('click', copyJson);
  ELEMENTS.btnClear.addEventListener('click', clearResults);
}

function handleInputChange() {
  const value = ELEMENTS.caseIdInput.value.trim();
  
  if (value && !/^\d+$/.test(value)) {
    ELEMENTS.caseIdInput.classList.add('error');
    ELEMENTS.inputError.textContent = 'Case ID must be numeric';
  } else {
    ELEMENTS.caseIdInput.classList.remove('error');
    ELEMENTS.inputError.textContent = '';
  }
}

async function handleFetchCase() {
  const caseId = ELEMENTS.caseIdInput.value.trim();
  
  if (!caseId) {
    showError('INVALID_INPUT');
    return;
  }
  
  if (!/^\d+$/.test(caseId)) {
    showError('INVALID_INPUT');
    return;
  }
  
  hideError();
  showLoading();
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_CASE',
      caseId: caseId
    });
    
    if (response.success) {
      displayResult(response.data);
      await checkSession();
    } else {
      showError(response.code || 'NETWORK_ERROR');
      
      if (response.code === 'SESSION_EXPIRED' || response.code === 'NO_SESSION') {
        await checkSession();
      }
    }
  } catch (error) {
    showError('NETWORK_ERROR');
  }
}

function displayResult(data) {
  hideLoading();
  hideError();
  
  currentJson = data.payload;
  jsonVisible = false;
  ELEMENTS.jsonView.style.display = 'none';
  ELEMENTS.btnToggleJson.textContent = 'Show Raw JSON';
  
  const caseData = data.payload;
  
  ELEMENTS.summaryCaseId.textContent = data.caseId;
  ELEMENTS.summaryStatus.textContent = caseData.status || caseData.state || '-';
  ELEMENTS.summaryStateAnnotation.textContent = caseData.stateAnnotation || caseData.state_annotation || '-';
  ELEMENTS.summaryStateAnnotationLastUpdatedOn.textContent = caseData.stateAnnotationLastUpdatedOn || caseData.state_annotation_last_updated_on || '-';
  ELEMENTS.summarySeverity.textContent = caseData.severity || caseData.priority || '-';
  ELEMENTS.summaryCreated.textContent = caseData.createdAt || caseData.createdDate || caseData.created || '-';
  
  ELEMENTS.resultArea.style.display = 'block';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return `<span class="${cls}">${escapeHtml(match)}</span>`;
  });
}

function toggleJsonView() {
  jsonVisible = !jsonVisible;
  ELEMENTS.jsonView.style.display = jsonVisible ? 'block' : 'none';
  ELEMENTS.btnToggleJson.textContent = jsonVisible ? 'Hide Raw JSON' : 'Show Raw JSON';
  
  if (jsonVisible) {
    ELEMENTS.jsonView.innerHTML = syntaxHighlight(currentJson);
  }
}

async function copyJson() {
  if (!currentJson) return;
  
  try {
    await navigator.clipboard.writeText(JSON.stringify(currentJson, null, 2));
    const originalText = ELEMENTS.btnCopyJson.textContent;
    ELEMENTS.btnCopyJson.textContent = 'Copied!';
    setTimeout(() => {
      ELEMENTS.btnCopyJson.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

async function copySummary() {
  const summary = `Case ID: ${ELEMENTS.summaryCaseId.textContent}
Status: ${ELEMENTS.summaryStatus.textContent}
State: ${ELEMENTS.summaryStateAnnotation.textContent}
State Updated: ${ELEMENTS.summaryStateAnnotationLastUpdatedOn.textContent}
Severity: ${ELEMENTS.summarySeverity.textContent}
Created: ${ELEMENTS.summaryCreated.textContent}`;
  
  try {
    await navigator.clipboard.writeText(summary);
    const originalText = ELEMENTS.btnCopySummary.textContent;
    ELEMENTS.btnCopySummary.textContent = 'Copied!';
    setTimeout(() => {
      ELEMENTS.btnCopySummary.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy summary:', err);
  }
}

function clearResults() {
  ELEMENTS.caseIdInput.value = '';
  ELEMENTS.resultArea.style.display = 'none';
  currentJson = null;
  jsonVisible = false;
  hideError();
  handleInputChange();
}

function showLoading() {
  ELEMENTS.resultArea.style.display = 'none';
  ELEMENTS.errorState.style.display = 'none';
  ELEMENTS.loadingState.style.display = 'flex';
  ELEMENTS.btnFetch.disabled = true;
}

function hideLoading() {
  ELEMENTS.loadingState.style.display = 'none';
  ELEMENTS.btnFetch.disabled = false;
}

function showError(code) {
  hideLoading();
  ELEMENTS.resultArea.style.display = 'none';
  ELEMENTS.errorState.style.display = 'block';
  ELEMENTS.errorMessage.textContent = ERROR_MESSAGES[code] || ERROR_MESSAGES.NETWORK_ERROR;
}

function hideError() {
  ELEMENTS.errorState.style.display = 'none';
}

async function handleOpenPortal() {
  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_PORTAL' });
    window.close();
  } catch (error) {
    console.error('Failed to open portal:', error);
  }
}

document.addEventListener('DOMContentLoaded', init);