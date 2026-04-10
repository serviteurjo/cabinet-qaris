/**
 * Authentification Admin - Cabinet QARIS
 * Gestion de la connexion/déconnexion, vérification de rôle et garde pré-login.
 */

import {
  getSupabase,
  getTableCandidates,
  isMissingTableOrColumnError,
  isNoRowsError,
} from './supabaseClient.js';
import { ADMIN_SECURITY_CONFIG } from './config.js';

const ROUTES = {
  preLogin: ADMIN_SECURITY_CONFIG.preLogin.route || '/admin/pre-login.html',
  login: '/admin/login.html',
  dashboard: '/admin/dashboard.html',
};

const ADMIN_SESSION_KEYS = {
  loggedIn: 'admin_logged_in',
  email: 'admin_email',
  role: 'admin_role',
};

const PRELOGIN_STORAGE_KEY = ADMIN_SECURITY_CONFIG.preLogin.storageKey;
const PRELOGIN_MAX_AGE_MS = Number(ADMIN_SECURITY_CONFIG.preLogin.maxAgeMs || 0);

/**
 * Initialise l'authentification admin
 */
export function initAdminAuth() {
  setupLoginForm();
  setupLogoutButton();
  checkAuthStatus();
}

function isCurrentRoute(route) {
  return window.location.pathname.endsWith(route);
}

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

function hasValidPreLoginSession() {
  const state = getStoredPreLoginState();
  if (!state) return false;
  if (PRELOGIN_MAX_AGE_MS <= 0) return true;
  return Date.now() - state.createdAt <= PRELOGIN_MAX_AGE_MS;
}

function clearPreLoginSession() {
  sessionStorage.removeItem(PRELOGIN_STORAGE_KEY);
}

function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEYS.loggedIn);
  sessionStorage.removeItem(ADMIN_SESSION_KEYS.email);
  sessionStorage.removeItem(ADMIN_SESSION_KEYS.role);
}

function setAdminSession({ email, role }) {
  sessionStorage.setItem(ADMIN_SESSION_KEYS.loggedIn, 'true');
  sessionStorage.setItem(ADMIN_SESSION_KEYS.email, email || 'admin@qaris.fr');
  sessionStorage.setItem(ADMIN_SESSION_KEYS.role, role || 'admin');
}

function buildRouteTarget(route) {
  if (route === ROUTES.preLogin) return 'pre-login.html';
  if (route === ROUTES.dashboard) return 'dashboard.html';
  return 'login.html';
}

function redirectTo(route) {
  window.location.href = buildRouteTarget(route);
}

function getRequiredAdminRole() {
  return String(ADMIN_SECURITY_CONFIG.auth.requiredRole || 'admin').toLowerCase();
}

function isAdminRole(roleValue) {
  return String(roleValue || '').toLowerCase() === getRequiredAdminRole();
}

async function fetchRoleFromTable(client, tableName, roleColumn, filterColumn, filterValue) {
  if (!filterValue) return null;

  const { data, error } = await client
    .from(tableName)
    .select(roleColumn)
    .eq(filterColumn, filterValue)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isNoRowsError(error) || isMissingTableOrColumnError(error)) {
      return null;
    }
    throw error;
  }

  if (!data || data[roleColumn] === undefined || data[roleColumn] === null) {
    return null;
  }

  return String(data[roleColumn]).toLowerCase();
}

async function resolveAdminRole(client, user) {
  if (!user) return null;

  const metadataRole = user?.app_metadata?.role || user?.user_metadata?.role;
  if (metadataRole) {
    return String(metadataRole).toLowerCase();
  }

  const roleColumn = String(ADMIN_SECURITY_CONFIG.auth.roleColumn || 'role');
  const adminTableCandidates = getTableCandidates('adminUsers');

  for (const tableName of adminTableCandidates) {
    try {
      const roleFromId = await fetchRoleFromTable(client, tableName, roleColumn, 'id', user.id);
      if (roleFromId) return roleFromId;

      const roleFromUserId = await fetchRoleFromTable(client, tableName, roleColumn, 'user_id', user.id);
      if (roleFromUserId) return roleFromUserId;

      const roleFromEmail = await fetchRoleFromTable(client, tableName, roleColumn, 'email', user.email);
      if (roleFromEmail) return roleFromEmail;
    } catch (error) {
      if (isMissingTableOrColumnError(error)) {
        continue;
      }
      console.warn(`AdminAuth: lecture role échouée sur table ${tableName}`, error);
    }
  }

  return null;
}

async function notifyLoginAttempt({ email, success, reason }) {
  if (!ADMIN_SECURITY_CONFIG.notifications.enabled) return;

  const client = getSupabase();
  if (!client) return;

  const functionName = ADMIN_SECURITY_CONFIG.notifications.edgeFunctionName;
  if (!functionName) return;

  const payload = {
    email,
    success,
    reason: reason || '',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    pathname: window.location.pathname,
  };

  try {
    await client.functions.invoke(functionName, {
      body: payload,
    });
  } catch (error) {
    // Tolérant : ne jamais bloquer la connexion admin pour une erreur de notification.
    console.warn('AdminAuth: notification login non envoyée', error);
  }
}

/**
 * Configure le formulaire de connexion
 */
function setupLoginForm() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;
  if (form.dataset.boundSubmit === 'true') return;

  form.dataset.boundSubmit = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    if (!emailInput || !passwordInput) {
      console.error('AdminAuth: Champs email/mot de passe introuvables');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const errorDiv = document.getElementById('login-error');
    const loginText = document.getElementById('login-text');
    const loginLoading = document.getElementById('login-loading');

    if (!email || !password) {
      if (errorDiv) {
        errorDiv.textContent = 'Veuillez renseigner votre email et votre mot de passe.';
        errorDiv.classList.remove('hidden');
      }
      return;
    }

    if (errorDiv) errorDiv.classList.add('hidden');
    if (loginText) loginText.classList.add('hidden');
    if (loginLoading) loginLoading.classList.remove('hidden');

    try {
      await login(email, password);
      redirectTo(ROUTES.dashboard);
    } catch (error) {
      console.error('AdminAuth: Erreur de connexion', error);
      if (errorDiv) {
        errorDiv.textContent = error?.message || 'Connexion impossible. Vérifiez vos identifiants.';
        errorDiv.classList.remove('hidden');
      }
    } finally {
      if (loginText) loginText.classList.remove('hidden');
      if (loginLoading) loginLoading.classList.add('hidden');
    }
  });
}

/**
 * Configure le bouton de déconnexion
 */
function setupLogoutButton() {
  const logoutButtons = document.querySelectorAll('.admin-logout-action, #logout-btn');
  if (!logoutButtons.length) return;

  logoutButtons.forEach((logoutBtn) => {
    if (logoutBtn.dataset.boundClick === 'true') return;
    logoutBtn.dataset.boundClick = 'true';

    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();
        redirectTo(ROUTES.preLogin);
      } catch (error) {
        console.error('AdminAuth: Erreur de déconnexion', error);
      }
    });
  });
}

/**
 * Connecte un administrateur
 * @param {string} email - Email de l'admin
 * @param {string} password - Mot de passe
 */
export async function login(email, password) {
  const client = getSupabase();

  if (!client) {
    setAdminSession({ email, role: getRequiredAdminRole() });
    return { user: { email, role: getRequiredAdminRole() } };
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error('Email ou mot de passe incorrect.');
  }

  const user = data?.user;
  if (!user) {
    throw new Error('Impossible de récupérer le compte administrateur.');
  }

  const role = await resolveAdminRole(client, user);
  if (!isAdminRole(role)) {
    void notifyLoginAttempt({
      email: user.email || email,
      success: false,
      reason: `role_not_allowed:${role || 'none'}`,
    });

    await client.auth.signOut();
    clearAdminSession();
    throw new Error('Accès refusé. Votre compte n\'a pas les droits administrateur.');
  }

  setAdminSession({ email: user.email || email, role });

  void notifyLoginAttempt({
    email: user.email || email,
    success: true,
    reason: 'login_success',
  });

  return data;
}

/**
 * Déconnecte l'administrateur
 */
export async function logout() {
  const client = getSupabase();

  clearAdminSession();
  clearPreLoginSession();

  if (client) {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }
}

/**
 * Vérifie le statut d'authentification
 */
async function checkAuthStatus() {
  const onPreLoginPage = isCurrentRoute(ROUTES.preLogin);
  const onLoginPage = isCurrentRoute(ROUTES.login);
  const onDashboardPage = isCurrentRoute(ROUTES.dashboard);

  if (ADMIN_SECURITY_CONFIG.preLogin.enabled) {
    const hasPreLogin = hasValidPreLoginSession();

    if ((onLoginPage || onDashboardPage) && !hasPreLogin) {
      redirectTo(ROUTES.preLogin);
      return;
    }

    if (onPreLoginPage && hasPreLogin) {
      const alreadyAuth = await isAuthenticated();
      if (alreadyAuth) {
        redirectTo(ROUTES.dashboard);
      } else {
        redirectTo(ROUTES.login);
      }
      return;
    }
  }

  if (onDashboardPage) {
    const isAuth = await isAuthenticated();
    if (!isAuth) {
      redirectTo(ROUTES.login);
      return;
    }

    const adminEmail = sessionStorage.getItem(ADMIN_SESSION_KEYS.email) || 'admin@qaris.fr';
    const emailEl = document.getElementById('admin-email');
    if (emailEl) emailEl.textContent = adminEmail;
    return;
  }

  if (onLoginPage) {
    const isAuth = await isAuthenticated();
    if (isAuth) {
      redirectTo(ROUTES.dashboard);
    }
  }
}

/**
 * Vérifie si l'utilisateur est authentifié avec rôle admin
 * @returns {Promise<boolean>} True si authentifié et admin
 */
export async function isAuthenticated() {
  const client = getSupabase();

  // Fallback sans Supabase
  if (!client) {
    return sessionStorage.getItem(ADMIN_SESSION_KEYS.loggedIn) === 'true';
  }

  try {
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session || !session.user) {
      clearAdminSession();
      return false;
    }

    const role = await resolveAdminRole(client, session.user);
    if (!isAdminRole(role)) {
      clearAdminSession();
      await client.auth.signOut();
      return false;
    }

    setAdminSession({ email: session.user.email, role });
    return true;
  } catch (error) {
    console.error('AdminAuth: Erreur lors de la vérification de session', error);
    clearAdminSession();
    return false;
  }
}

/**
 * Récupère l'utilisateur actuel
 * @returns {Promise<Object|null>} Utilisateur connecté
 */
export async function getCurrentUser() {
  const client = getSupabase();
  if (!client) return null;

  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    return user;
  } catch (error) {
    console.error('AdminAuth: Erreur lors de la récupération de l\'utilisateur', error);
    return null;
  }
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
});

export default {
  initAdminAuth,
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
};
