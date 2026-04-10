/**
 * Pré-login admin - Cabinet QARIS
 * Étape mezzanine avant la page de connexion admin.
 */

import { ADMIN_SECURITY_CONFIG } from './config.js';

const PRELOGIN_STORAGE_KEY = ADMIN_SECURITY_CONFIG.preLogin.storageKey;
const PRELOGIN_MAX_AGE_MS = Number(ADMIN_SECURITY_CONFIG.preLogin.maxAgeMs || 0);

function getStoredPreLoginState() {
  const raw = sessionStorage.getItem(PRELOGIN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.ok !== true || typeof parsed.createdAt !== 'number') {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function hasValidPreLoginSession() {
  const state = getStoredPreLoginState();
  if (!state) return false;
  if (PRELOGIN_MAX_AGE_MS <= 0) return true;
  return Date.now() - state.createdAt <= PRELOGIN_MAX_AGE_MS;
}

export function markPreLoginPassed() {
  const payload = JSON.stringify({
    ok: true,
    createdAt: Date.now(),
  });
  sessionStorage.setItem(PRELOGIN_STORAGE_KEY, payload);
}

export function clearPreLoginSession() {
  sessionStorage.removeItem(PRELOGIN_STORAGE_KEY);
}

function getLoginPagePath() {
  return 'login.html';
}

function redirectToLogin() {
  window.location.href = getLoginPagePath();
}

function isConfiguredAccessCodeDefault() {
  return ADMIN_SECURITY_CONFIG.preLogin.accessCode === 'QARIS2026_CHANGE_ME';
}

export function initPreLogin() {
  if (!ADMIN_SECURITY_CONFIG.preLogin.enabled) {
    redirectToLogin();
    return;
  }

  if (hasValidPreLoginSession()) {
    redirectToLogin();
    return;
  }

  const form = document.getElementById('pre-login-form');
  const input = document.getElementById('access-code');
  const errorDiv = document.getElementById('pre-login-error');

  if (!form || !input) return;
  if (form.dataset.boundSubmit === 'true') return;

  if (isConfiguredAccessCodeDefault()) {
    console.warn('PreLogin: le code d\'accès est encore la valeur par défaut. Changez ADMIN_SECURITY_CONFIG.preLogin.accessCode.');
  }

  form.dataset.boundSubmit = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const enteredCode = String(input.value || '').trim();
    const expectedCode = String(ADMIN_SECURITY_CONFIG.preLogin.accessCode || '').trim();

    if (!enteredCode || enteredCode !== expectedCode) {
      if (errorDiv) errorDiv.classList.remove('hidden');
      input.focus();
      input.select();
      return;
    }

    if (errorDiv) errorDiv.classList.add('hidden');
    markPreLoginPassed();
    redirectToLogin();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initPreLogin();
});

export default {
  initPreLogin,
  hasValidPreLoginSession,
  markPreLoginPassed,
  clearPreLoginSession,
};
