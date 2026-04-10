/**
 * Configuration du Cabinet QARIS
 * Fichier de configuration pour l'application
 */

// Configuration Supabase (à remplir avec vos informations)
export const SUPABASE_CONFIG = {
  url: 'https://wnfvubxnynlhwifanicl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZnZ1YnhueW5saHdpZmFuaWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODM1MTIsImV4cCI6MjA5MTE1OTUxMn0.23NBaxH7FtPn_VLfW3w6H1MPjpirR1CvwrE0kF_CL6A',
};

// Équivalents nommés demandés par l'intégration (clé publishable seulement)
export const SUPABASE_URL = 'https://wnfvubxnynlhwifanicl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZnZ1YnhueW5saHdpZmFuaWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODM1MTIsImV4cCI6MjA5MTE1OTUxMn0.23NBaxH7FtPn_VLfW3w6H1MPjpirR1CvwrE0kF_CL6A';

// Configuration de l'application
export const APP_CONFIG = {
  name: 'Cabinet QARIS',
  version: '1.0.0',
  contact: {
    email: 'contact@qaris.fr',
    phone: '+33 1 23 45 67 89',
    address: '123 Avenue de la Paix, 75000 Paris',
  },
  social: {
    facebook: '#',
    instagram: '#',
    linkedin: '#',
    whatsapp: '#',
  },
};

// Configuration des tables Supabase
export const TABLES = {
  trainings: 'trainings',
  sessions: 'training_sessions',
  registrations: 'registrations',
  infoRequests: 'info_requests',
  adminUsers: 'profiles',
  contactMessages: 'contact_messages',
};

// Tables alternatives acceptées (utile si l'instance Supabase a des anciens noms)
export const TABLE_ALIASES = {
  trainings: ['trainings'],
  sessions: ['training_sessions'],
  registrations: ['registrations', 'training_registrations'],
  infoRequests: ['info_requests', 'training_info_requests'],
  adminUsers: ['profiles', 'admin_users'],
  contactMessages: ['contact_messages'],
};

// Sécurité admin (adapter ces valeurs avant production)
export const ADMIN_SECURITY_CONFIG = {
  preLogin: {
    enabled: true,
    route: '/admin/pre-login.html',
    storageKey: 'qaris_admin_prelogin_passed',
    maxAgeMs: 1000 * 60 * 30, // 30 min
    accessCode: 'QARIS2026NEW',
  },
  auth: {
    requiredRole: 'admin',
    roleColumn: 'role',
  },
  notifications: {
    enabled: true,
    edgeFunctionName: 'notify-admin-login',
  },
  catalog: {
    storageBucket: 'event-images',
    maxImageSizeMB: 5,
  },
};

// Export par défaut
export default {
  supabase: SUPABASE_CONFIG,
  app: APP_CONFIG,
  tables: TABLES,
  tableAliases: TABLE_ALIASES,
  adminSecurity: ADMIN_SECURITY_CONFIG,
};
