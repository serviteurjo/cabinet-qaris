/**
 * Client Supabase - Cabinet QARIS (initialisation minimale)
 * Utilise la version ESM du SDK via CDN. N'expose que le client public.
 */

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  TABLES,
  TABLE_ALIASES,
} from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabaseClient = null;

export function initSupabase() {
  if (supabaseClient) return supabaseClient;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || SUPABASE_URL === 'https://votre-projet.supabase.co') {
    console.warn('Supabase: Configuration non définie. Configurez SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY dans js/config.js');
    return null;
  }

  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch (err) {
    console.error('Supabase: Initialization failed', err);
    supabaseClient = null;
  }

  return supabaseClient;
}

export function getSupabase() {
  return supabaseClient || initSupabase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveTableKeyFromName(tableName) {
  const entries = Object.entries(TABLES);
  const match = entries.find(([, value]) => value === tableName);
  return match ? match[0] : null;
}

export function getTableCandidates(tableKeyOrName) {
  if (!tableKeyOrName) return [];

  // Cas 1: on passe la clé logique (ex: "registrations")
  if (TABLE_ALIASES[tableKeyOrName]) {
    return unique(TABLE_ALIASES[tableKeyOrName]);
  }

  // Cas 2: on passe le nom de table réel (ex: "registrations")
  const logicalKey = resolveTableKeyFromName(tableKeyOrName);
  if (logicalKey && TABLE_ALIASES[logicalKey]) {
    return unique(TABLE_ALIASES[logicalKey]);
  }

  // Cas 3: nom brut
  return [tableKeyOrName];
}

export function isMissingTableOrColumnError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  // 42P01: table inexistante, 42703: colonne inexistante
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('not found')
  );
}

export function isNoRowsError(error) {
  const code = error?.code || '';
  return code === 'PGRST116';
}

export async function runOnFirstAvailableTable(client, tableCandidates, operation) {
  let fallbackError = null;

  for (const tableName of unique(tableCandidates)) {
    const result = await operation(tableName);

    if (!result?.error) {
      return { ...result, tableName };
    }

    if (isMissingTableOrColumnError(result.error)) {
      fallbackError = result.error;
      continue;
    }

    return { ...result, tableName };
  }

  return {
    data: null,
    error: fallbackError || new Error('Aucune table compatible trouvée.'),
    tableName: null,
  };
}

export async function isAuthenticated() {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data: { session } } = await client.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Supabase: Erreur lors de la vérification de session', error);
    return false;
  }
}

export async function getCurrentUser() {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch (error) {
    console.error('Supabase: Erreur lors de la récupération de l\'utilisateur', error);
    return null;
  }
}

// Exports de config tables/aliases (interface partagée)
export { TABLES };
export { TABLE_ALIASES };

// Initialiser au chargement (silencieux)
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
