/**
 * Tableau de bord Admin - Cabinet QARIS
 * Dashboard dynamique (contacts, inscriptions formations, inscriptions événements, catalogue)
 */

import {
  getSupabase,
  getTableCandidates,
  isMissingTableOrColumnError,
} from './supabaseClient.js';
import { isAuthenticated } from './adminAuth.js';
import { ADMIN_SECURITY_CONFIG } from './config.js';

const ROWS_PER_PAGE = 10;
const MAX_FETCH_ROWS = 2000;
const LIVE_REFRESH_INTERVAL_MS = 25000;

const CATALOG_STORAGE_BUCKET = ADMIN_SECURITY_CONFIG.catalog?.storageBucket || 'event-images';
const MAX_EVENT_IMAGE_SIZE_BYTES = Number(ADMIN_SECURITY_CONFIG.catalog?.maxImageSizeMB || 5) * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

const CONTACT_TABLE_CANDIDATES = unique([
  ...getTableCandidates('contactMessages'),
  'contacts',
  'messages',
]);

const FORMATION_REG_TABLE_CANDIDATES = unique([
  'registrations_formations',
  'formation_registrations',
  'training_registrations',
  ...getTableCandidates('registrations'),
]);

const EVENT_REG_TABLE_CANDIDATES = unique([
  'registrations_events',
  'event_registrations',
  ...getTableCandidates('registrations'),
]);

const TRAINING_TABLE_CANDIDATES = unique(getTableCandidates('trainings'));

const state = {
  initialized: false,
  listenersBound: false,
  renderFrame: null,
  liveRefreshIntervalId: null,
  liveRefreshBusy: false,
  lastLiveRefreshAt: 0,
  pendingRenders: new Set(),
  sections: {
    contacts: {
      rows: [],
      filteredRows: [],
      page: 1,
      perPage: ROWS_PER_PAGE,
      search: '',
      sort: 'date_desc',
      loading: false,
      tableName: null,
    },
    formations: {
      rows: [],
      filteredRows: [],
      page: 1,
      perPage: ROWS_PER_PAGE,
      search: '',
      filter: 'all',
      sort: 'date_desc',
      loading: false,
      tableName: null,
    },
    eventRegistrations: {
      rows: [],
      filteredRows: [],
      page: 1,
      perPage: ROWS_PER_PAGE,
      search: '',
      filter: 'all',
      sort: 'date_desc',
      loading: false,
      tableName: null,
    },
    catalog: {
      rows: [],
      loading: false,
      tableName: null,
    },
  },
};

const dom = {
  contactsSearch: null,
  contactsSort: null,
  contactsTbody: null,
  contactsPrev: null,
  contactsNext: null,
  contactsPageInfo: null,

  formationsSearch: null,
  formationsFilter: null,
  formationsSort: null,
  formationsExportBtn: null,
  formationsTbody: null,
  formationsPrev: null,
  formationsNext: null,
  formationsPageInfo: null,

  eventsSearch: null,
  eventsFilter: null,
  eventsSort: null,
  eventsExportBtn: null,
  eventsRegistrationsTbody: null,
  eventsPrev: null,
  eventsNext: null,
  eventsPageInfo: null,

  refreshCatalogBtn: null,
  addEventBtn: null,
  catalogEventsTbody: null,

  statContacts: null,
  statFormations: null,
  statEventRegistrations: null,
  statCatalogEvents: null,

  connectionBadge: null,
  adminEmail: null,
  navLinks: [],

  eventModal: null,
  eventModalTitle: null,
  eventForm: null,
  eventIdField: null,
  eventTitleField: null,
  eventTypeField: null,
  eventPriceField: null,
  eventStartDateField: null,
  eventEndDateField: null,
  eventDescriptionField: null,
  eventStatusField: null,
  eventImageFileField: null,
  eventImageUrlField: null,
  eventImagePreviewWrapper: null,
  eventImagePreview: null,
  cancelEventBtn: null,
};

/**
 * Initialise le dashboard admin
 */
export async function initDashboard() {
  if (state.initialized) return;

  cacheDomReferences();

  const canAccessDashboard = await guardDashboardAccess();
  if (!canAccessDashboard) return;

  hydrateAdminIdentity();
  setConnectionBadge(true);
  setupEventListeners();

  state.initialized = true;

  await loadAllData();
  startLiveRefreshLoop();
}

async function guardDashboardAccess() {
  const sessionFlagBefore = sessionStorage.getItem('admin_logged_in') === 'true';
  const authenticated = await isAuthenticated();
  const sessionFlagAfter = sessionStorage.getItem('admin_logged_in') === 'true';

  if (!authenticated || (!sessionFlagBefore && !sessionFlagAfter)) {
    redirectToLogin();
    return false;
  }

  return true;
}

async function requireWriteAuthentication() {
  const authenticated = await isAuthenticated();
  const sessionFlag = sessionStorage.getItem('admin_logged_in') === 'true';

  if (!authenticated || !sessionFlag) {
    showToast('Session admin expirée. Veuillez vous reconnecter.', 'error');
    redirectToLogin();
    throw new Error('Session admin invalide');
  }
}

function redirectToLogin() {
  window.location.href = 'login.html';
}

function cacheDomReferences() {
  dom.contactsSearch = document.getElementById('contacts-search');
  dom.contactsSort = document.getElementById('contacts-sort');
  dom.contactsTbody = document.getElementById('contacts-tbody');
  dom.contactsPrev = document.getElementById('contacts-prev');
  dom.contactsNext = document.getElementById('contacts-next');
  dom.contactsPageInfo = document.getElementById('contacts-page-info');

  dom.formationsSearch = document.getElementById('formations-search');
  dom.formationsFilter = document.getElementById('formations-filter');
  dom.formationsSort = document.getElementById('formations-sort');
  dom.formationsExportBtn = document.getElementById('formations-export-csv');
  dom.formationsTbody = document.getElementById('formations-tbody');
  dom.formationsPrev = document.getElementById('formations-prev');
  dom.formationsNext = document.getElementById('formations-next');
  dom.formationsPageInfo = document.getElementById('formations-page-info');

  dom.eventsSearch = document.getElementById('events-search');
  dom.eventsFilter = document.getElementById('events-filter');
  dom.eventsSort = document.getElementById('events-sort');
  dom.eventsExportBtn = document.getElementById('events-export-csv');
  dom.eventsRegistrationsTbody = document.getElementById('events-registrations-tbody');
  dom.eventsPrev = document.getElementById('events-prev');
  dom.eventsNext = document.getElementById('events-next');
  dom.eventsPageInfo = document.getElementById('events-page-info');

  dom.refreshCatalogBtn = document.getElementById('refresh-catalog-btn');
  dom.addEventBtn = document.getElementById('add-event-btn');
  dom.catalogEventsTbody = document.getElementById('catalog-events-tbody');

  dom.statContacts = document.getElementById('stat-contacts');
  dom.statFormations = document.getElementById('stat-formations');
  dom.statEventRegistrations = document.getElementById('stat-event-registrations');
  dom.statCatalogEvents = document.getElementById('stat-catalog-events');

  dom.connectionBadge = document.getElementById('admin-connection-badge');
  dom.adminEmail = document.getElementById('admin-email');
  dom.navLinks = Array.from(document.querySelectorAll('[data-admin-nav-link]'));

  dom.eventModal = document.getElementById('event-modal');
  dom.eventModalTitle = document.getElementById('event-modal-title');
  dom.eventForm = document.getElementById('event-form');
  dom.eventIdField = document.getElementById('event-id');
  dom.eventTitleField = document.getElementById('event-title');
  dom.eventTypeField = document.getElementById('event-type');
  dom.eventPriceField = document.getElementById('event-price');
  dom.eventStartDateField = document.getElementById('event-start-date');
  dom.eventEndDateField = document.getElementById('event-end-date');
  dom.eventDescriptionField = document.getElementById('event-description');
  dom.eventStatusField = document.getElementById('event-status');
  dom.eventImageFileField = document.getElementById('event-image-file');
  dom.eventImageUrlField = document.getElementById('event-image-url');
  dom.eventImagePreviewWrapper = document.getElementById('event-image-preview-wrapper');
  dom.eventImagePreview = document.getElementById('event-image-preview');
  dom.cancelEventBtn = document.getElementById('cancel-event-btn');
}

function hydrateAdminIdentity() {
  const adminEmail = sessionStorage.getItem('admin_email') || 'admin@qaris.fr';
  if (dom.adminEmail) {
    dom.adminEmail.textContent = adminEmail;
  }
}

function setConnectionBadge(connected) {
  if (!dom.connectionBadge) return;

  dom.connectionBadge.classList.remove('status-active', 'status-inactive');
  dom.connectionBadge.classList.add(connected ? 'status-active' : 'status-inactive');
  dom.connectionBadge.textContent = connected ? 'Connecté' : 'Déconnecté';
}

function startLiveRefreshLoop() {
  if (state.liveRefreshIntervalId !== null) return;

  state.liveRefreshIntervalId = window.setInterval(() => {
    void runLiveRefresh();
  }, LIVE_REFRESH_INTERVAL_MS);

  document.addEventListener('visibilitychange', handleVisibilityRefresh);
  window.addEventListener('focus', handleWindowFocusRefresh);
  window.addEventListener('beforeunload', stopLiveRefreshLoop);
}

function stopLiveRefreshLoop() {
  if (state.liveRefreshIntervalId !== null) {
    window.clearInterval(state.liveRefreshIntervalId);
    state.liveRefreshIntervalId = null;
  }

  document.removeEventListener('visibilitychange', handleVisibilityRefresh);
  window.removeEventListener('focus', handleWindowFocusRefresh);
  window.removeEventListener('beforeunload', stopLiveRefreshLoop);
}

function handleVisibilityRefresh() {
  if (document.visibilityState === 'visible') {
    void runLiveRefresh(true);
  }
}

function handleWindowFocusRefresh() {
  void runLiveRefresh(true);
}

async function runLiveRefresh(force = false) {
  if (state.liveRefreshBusy) return;
  if (!force && document.visibilityState === 'hidden') return;
  if (sessionStorage.getItem('admin_logged_in') !== 'true') return;

  const elapsed = Date.now() - state.lastLiveRefreshAt;
  if (!force && elapsed > 0 && elapsed < LIVE_REFRESH_INTERVAL_MS - 1000) return;

  state.liveRefreshBusy = true;

  try {
    await Promise.all([
      loadContacts(),
      loadFormationRegistrations(),
      loadEventRegistrations(),
    ]);
    state.lastLiveRefreshAt = Date.now();
  } catch (error) {
    console.warn('Dashboard: auto-refresh partiellement indisponible', error);
  } finally {
    state.liveRefreshBusy = false;
  }
}

function setupEventListeners() {
  if (state.listenersBound) return;
  state.listenersBound = true;

  if (dom.contactsSearch) {
    dom.contactsSearch.addEventListener('input', (event) => {
      state.sections.contacts.search = String(event.target.value || '').trim().toLowerCase();
      state.sections.contacts.page = 1;
      scheduleRender('contacts');
    });
  }

  if (dom.contactsSort) {
    dom.contactsSort.addEventListener('change', (event) => {
      state.sections.contacts.sort = String(event.target.value || 'date_desc');
      state.sections.contacts.page = 1;
      scheduleRender('contacts');
    });
  }

  if (dom.contactsPrev) {
    dom.contactsPrev.addEventListener('click', () => {
      changePage('contacts', -1);
    });
  }

  if (dom.contactsNext) {
    dom.contactsNext.addEventListener('click', () => {
      changePage('contacts', 1);
    });
  }

  if (dom.formationsSearch) {
    dom.formationsSearch.addEventListener('input', (event) => {
      state.sections.formations.search = String(event.target.value || '').trim().toLowerCase();
      state.sections.formations.page = 1;
      scheduleRender('formations');
    });
  }

  if (dom.formationsFilter) {
    dom.formationsFilter.addEventListener('change', (event) => {
      state.sections.formations.filter = String(event.target.value || 'all');
      state.sections.formations.page = 1;
      scheduleRender('formations');
    });
  }

  if (dom.formationsSort) {
    dom.formationsSort.addEventListener('change', (event) => {
      state.sections.formations.sort = String(event.target.value || 'date_desc');
      state.sections.formations.page = 1;
      scheduleRender('formations');
    });
  }

  if (dom.formationsPrev) {
    dom.formationsPrev.addEventListener('click', () => {
      changePage('formations', -1);
    });
  }

  if (dom.formationsNext) {
    dom.formationsNext.addEventListener('click', () => {
      changePage('formations', 1);
    });
  }

  if (dom.formationsExportBtn) {
    dom.formationsExportBtn.addEventListener('click', () => {
      exportRegistrationsCsv('formations');
    });
  }

  if (dom.eventsSearch) {
    dom.eventsSearch.addEventListener('input', (event) => {
      state.sections.eventRegistrations.search = String(event.target.value || '').trim().toLowerCase();
      state.sections.eventRegistrations.page = 1;
      scheduleRender('eventRegistrations');
    });
  }

  if (dom.eventsFilter) {
    dom.eventsFilter.addEventListener('change', (event) => {
      state.sections.eventRegistrations.filter = String(event.target.value || 'all');
      state.sections.eventRegistrations.page = 1;
      scheduleRender('eventRegistrations');
    });
  }

  if (dom.eventsSort) {
    dom.eventsSort.addEventListener('change', (event) => {
      state.sections.eventRegistrations.sort = String(event.target.value || 'date_desc');
      state.sections.eventRegistrations.page = 1;
      scheduleRender('eventRegistrations');
    });
  }

  if (dom.eventsPrev) {
    dom.eventsPrev.addEventListener('click', () => {
      changePage('eventRegistrations', -1);
    });
  }

  if (dom.eventsNext) {
    dom.eventsNext.addEventListener('click', () => {
      changePage('eventRegistrations', 1);
    });
  }

  if (dom.eventsExportBtn) {
    dom.eventsExportBtn.addEventListener('click', () => {
      exportRegistrationsCsv('eventRegistrations');
    });
  }

  if (dom.contactsTbody) {
    dom.contactsTbody.addEventListener('click', handleContactsActionClick);
  }

  if (dom.formationsTbody) {
    dom.formationsTbody.addEventListener('click', handleFormationsActionClick);
  }

  if (dom.eventsRegistrationsTbody) {
    dom.eventsRegistrationsTbody.addEventListener('click', handleEventsRegistrationsActionClick);
  }

  if (dom.catalogEventsTbody) {
    dom.catalogEventsTbody.addEventListener('click', handleCatalogActionClick);
  }

  if (dom.refreshCatalogBtn) {
    dom.refreshCatalogBtn.addEventListener('click', handleCatalogRefresh);
  }

  if (dom.addEventBtn) {
    dom.addEventBtn.addEventListener('click', () => openEventModal());
  }

  if (dom.eventForm) {
    dom.eventForm.addEventListener('submit', handleEventSubmit);
  }

  if (dom.cancelEventBtn) {
    dom.cancelEventBtn.addEventListener('click', closeEventModal);
  }

  if (dom.eventImageFileField) {
    dom.eventImageFileField.addEventListener('change', handleImageFilePreview);
  }

  const modalCloseButtons = document.querySelectorAll('#event-modal .modal-close');
  modalCloseButtons.forEach((button) => {
    button.addEventListener('click', closeEventModal);
  });

  const modalOverlay = document.querySelector('#event-modal .modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeEventModal);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.eventModal && !dom.eventModal.classList.contains('hidden')) {
      closeEventModal();
    }
  });

  dom.navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      setActiveNavLink(link.getAttribute('href') || '');
    });
  });

  window.addEventListener('hashchange', () => {
    setActiveNavLink(window.location.hash);
  });

  setActiveNavLink(window.location.hash || '#contacts-section');
}

function setActiveNavLink(hash) {
  if (!hash) return;

  dom.navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === hash;
    link.classList.toggle('is-active', isActive);
  });
}

function changePage(sectionKey, direction) {
  const section = state.sections[sectionKey];
  if (!section) return;

  const totalPages = Math.max(1, Math.ceil(section.filteredRows.length / section.perPage));
  const nextPage = clamp(section.page + direction, 1, totalPages);

  if (nextPage === section.page) return;

  section.page = nextPage;
  scheduleRender(sectionKey);
}

async function loadAllData() {
  setSectionLoading('contacts', true);
  setSectionLoading('formations', true);
  setSectionLoading('eventRegistrations', true);
  setSectionLoading('catalog', true);

  try {
    await Promise.all([
      loadContacts(),
      loadFormationRegistrations(),
      loadEventRegistrations(),
      loadCatalogEvents(),
    ]);
  } catch (error) {
    console.error('Dashboard: erreur chargement global', error);
    showToast('Une partie des données admin n\'a pas pu être chargée.', 'error');
  } finally {
    setSectionLoading('contacts', false);
    setSectionLoading('formations', false);
    setSectionLoading('eventRegistrations', false);
    setSectionLoading('catalog', false);
    scheduleRender('stats');
  }
}

function setSectionLoading(sectionKey, loading) {
  const section = state.sections[sectionKey];
  if (!section) return;

  section.loading = loading;
  scheduleRender(sectionKey);
}

async function loadContacts() {
  const client = getSupabase();

  if (!client) {
    state.sections.contacts.rows = [];
    state.sections.contacts.tableName = null;
    scheduleRender('contacts');
    scheduleRender('stats');
    return;
  }

  const { rows, tableName, error } = await fetchRowsFromCandidates(client, CONTACT_TABLE_CANDIDATES);
  if (error && !isMissingTableOrColumnError(error)) {
    console.error('Dashboard: erreur chargement contacts', error);
  }

  state.sections.contacts.rows = rows.map((row, index) => normalizeContactRow(row, tableName, index));
  state.sections.contacts.tableName = tableName;
  state.sections.contacts.page = 1;

  scheduleRender('contacts');
  scheduleRender('stats');
}

async function loadFormationRegistrations() {
  const client = getSupabase();

  if (!client) {
    state.sections.formations.rows = [];
    state.sections.formations.tableName = null;
    updateRegistrationFilterOptions('formations');
    scheduleRender('formations');
    scheduleRender('stats');
    return;
  }

  const { rows, tableName, error } = await fetchRowsFromCandidates(client, FORMATION_REG_TABLE_CANDIDATES);
  if (error && !isMissingTableOrColumnError(error)) {
    console.error('Dashboard: erreur chargement inscriptions formations', error);
  }

  const normalizedRows = rows
    .map((row, index) => normalizeRegistrationRow(row, tableName, index, 'formation'))
    .filter((item) => item.kind === 'formation' || item.kind === 'unknown');

  state.sections.formations.rows = normalizedRows;
  state.sections.formations.tableName = tableName;
  state.sections.formations.page = 1;

  updateRegistrationFilterOptions('formations');
  scheduleRender('formations');
  scheduleRender('stats');
}

async function loadEventRegistrations() {
  const client = getSupabase();

  if (!client) {
    state.sections.eventRegistrations.rows = [];
    state.sections.eventRegistrations.tableName = null;
    updateRegistrationFilterOptions('eventRegistrations');
    scheduleRender('eventRegistrations');
    scheduleRender('stats');
    return;
  }

  const { rows, tableName, error } = await fetchRowsFromCandidates(client, EVENT_REG_TABLE_CANDIDATES);
  if (error && !isMissingTableOrColumnError(error)) {
    console.error('Dashboard: erreur chargement inscriptions événements', error);
  }

  const normalizedRows = rows
    .map((row, index) => normalizeRegistrationRow(row, tableName, index, 'event'))
    .filter((item) => item.kind === 'event' || (item.kind === 'unknown' && isLabelMatchingKind(item.label, 'event')));

  state.sections.eventRegistrations.rows = normalizedRows;
  state.sections.eventRegistrations.tableName = tableName;
  state.sections.eventRegistrations.page = 1;

  updateRegistrationFilterOptions('eventRegistrations');
  scheduleRender('eventRegistrations');
  scheduleRender('stats');
}

async function loadCatalogEvents() {
  const client = getSupabase();

  if (!client) {
    state.sections.catalog.rows = [];
    state.sections.catalog.tableName = null;
    scheduleRender('catalog');
    scheduleRender('stats');
    return;
  }

  const candidates = getCatalogTableCandidates();
  const { rows, tableName, error } = await fetchRowsFromCandidates(client, candidates);
  if (error && !isMissingTableOrColumnError(error)) {
    console.error('Dashboard: erreur chargement catalogue', error);
  }

  state.sections.catalog.rows = rows.map((row, index) => normalizeCatalogEventRow(row, tableName, index));
  state.sections.catalog.tableName = tableName;

  scheduleRender('catalog');
  scheduleRender('stats');
}

function scheduleRender(sectionKey) {
  state.pendingRenders.add(sectionKey);

  if (state.renderFrame !== null) return;

  state.renderFrame = window.requestAnimationFrame(() => {
    state.pendingRenders.forEach((key) => {
      if (key === 'contacts') renderContactsSection();
      if (key === 'formations') renderFormationsSection();
      if (key === 'eventRegistrations') renderEventRegistrationsSection();
      if (key === 'catalog') renderCatalogSection();
      if (key === 'stats') renderStats();
    });

    state.pendingRenders.clear();
    state.renderFrame = null;
  });
}

function renderStats() {
  if (dom.statContacts) {
    dom.statContacts.textContent = String(state.sections.contacts.rows.length);
  }

  if (dom.statFormations) {
    dom.statFormations.textContent = String(state.sections.formations.rows.length);
  }

  if (dom.statEventRegistrations) {
    dom.statEventRegistrations.textContent = String(state.sections.eventRegistrations.rows.length);
  }

  if (dom.statCatalogEvents) {
    dom.statCatalogEvents.textContent = String(state.sections.catalog.rows.length);
  }
}

function renderContactsSection() {
  if (!dom.contactsTbody) return;

  const section = state.sections.contacts;

  if (section.loading) {
    renderSkeletonRows(dom.contactsTbody, 7);
    updatePaginationUI('contacts', 1, 1);
    return;
  }

  section.filteredRows = sortByDate(
    section.rows.filter((item) => {
      if (!section.search) return true;

      const query = section.search;
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
      );
    }),
    section.sort
  );

  const { pageRows, page, totalPages } = paginate(section.filteredRows, section.page, section.perPage);
  section.page = page;

  if (!pageRows.length) {
    renderEmptyRow(dom.contactsTbody, 7, 'Aucun message contact disponible.');
  } else {
    const fragment = document.createDocumentFragment();

    pageRows.forEach((item) => {
      const tr = document.createElement('tr');

      tr.appendChild(createTextCell(formatDateTime(item.date)));
      tr.appendChild(createTextCell(item.name));
      tr.appendChild(createTextCell(item.email));
      tr.appendChild(createTextCell(item.phone || '-'));
      tr.appendChild(createTextCell(truncate(item.message, 110)));

      const statusCell = document.createElement('td');
      statusCell.appendChild(createStatusBadge(item.status));
      tr.appendChild(statusCell);

      const actionsCell = document.createElement('td');
      actionsCell.appendChild(createRowActions([
        {
          label: item.status === 'processed' ? 'Traité' : 'Marquer traité',
          action: 'contact-mark-processed',
          id: item.id,
          disabled: item.status === 'processed',
          variant: 'secondary',
        },
        {
          label: 'Supprimer',
          action: 'contact-delete',
          id: item.id,
          variant: 'secondary',
        },
      ]));
      tr.appendChild(actionsCell);

      fragment.appendChild(tr);
    });

    dom.contactsTbody.replaceChildren(fragment);
  }

  updatePaginationUI('contacts', page, totalPages);
}

function renderFormationsSection() {
  if (!dom.formationsTbody) return;

  const section = state.sections.formations;

  if (section.loading) {
    renderSkeletonRows(dom.formationsTbody, 8);
    updatePaginationUI('formations', 1, 1);
    return;
  }

  section.filteredRows = sortByDate(
    section.rows.filter((item) => {
      const query = section.search;
      const passesSearch = !query ||
        item.name.toLowerCase().includes(query) ||
        item.contact.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query);

      const passesFilter = section.filter === 'all' || item.label === section.filter;

      return passesSearch && passesFilter;
    }),
    section.sort
  );

  const { pageRows, page, totalPages } = paginate(section.filteredRows, section.page, section.perPage);
  section.page = page;

  if (!pageRows.length) {
    renderEmptyRow(dom.formationsTbody, 8, 'Aucune inscription formation disponible.');
  } else {
    const fragment = document.createDocumentFragment();

    pageRows.forEach((item) => {
      const isFinal = isRegistrationFinalStatus(item.status);
      const tr = document.createElement('tr');

      tr.appendChild(createTextCell(formatDateTime(item.date)));
      tr.appendChild(createTextCell(item.name));
      tr.appendChild(createTextCell(item.contact));
      tr.appendChild(createTextCell(item.phone || '-'));
      tr.appendChild(createTextCell(item.label || '-'));
      tr.appendChild(createTextCell(formatPaymentReference(item)));

      const statusCell = document.createElement('td');
      statusCell.appendChild(createStatusBadge(item.status));
      tr.appendChild(statusCell);

      const actionsCell = document.createElement('td');
      const actionsList = [];
      
      // Afficher les boutons Confirmer/Rejeter seulement si le statut n'est pas final
      if (!isFinal) {
        actionsList.push(
          {
            label: 'Confirmer',
            action: 'formation-confirm',
            id: item.id,
            variant: 'primary',
          },
          {
            label: 'Rejeter',
            action: 'formation-reject',
            id: item.id,
            variant: 'secondary',
          }
        );
      }
      
      // Toujours afficher le bouton Supprimer
      actionsList.push({
        label: 'Supprimer',
        action: 'formation-delete',
        id: item.id,
        variant: 'secondary',
      });
      
      actionsCell.appendChild(createRowActions(actionsList));
      tr.appendChild(actionsCell);

      fragment.appendChild(tr);
    });

    dom.formationsTbody.replaceChildren(fragment);
  }

  updatePaginationUI('formations', page, totalPages);
}

function renderEventRegistrationsSection() {
  if (!dom.eventsRegistrationsTbody) return;

  const section = state.sections.eventRegistrations;

  if (section.loading) {
    renderSkeletonRows(dom.eventsRegistrationsTbody, 8);
    updatePaginationUI('eventRegistrations', 1, 1);
    return;
  }

  section.filteredRows = sortByDate(
    section.rows.filter((item) => {
      const query = section.search;
      const passesSearch = !query ||
        item.name.toLowerCase().includes(query) ||
        item.contact.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query);

      const passesFilter = section.filter === 'all' || item.label === section.filter;

      return passesSearch && passesFilter;
    }),
    section.sort
  );

  const { pageRows, page, totalPages } = paginate(section.filteredRows, section.page, section.perPage);
  section.page = page;

  if (!pageRows.length) {
    renderEmptyRow(dom.eventsRegistrationsTbody, 8, 'Aucune inscription événement disponible.');
  } else {
    const fragment = document.createDocumentFragment();

    pageRows.forEach((item) => {
      const isFinal = isRegistrationFinalStatus(item.status);
      const tr = document.createElement('tr');

      tr.appendChild(createTextCell(formatDateTime(item.date)));
      tr.appendChild(createTextCell(item.name));
      tr.appendChild(createTextCell(item.contact));
      tr.appendChild(createTextCell(item.phone || '-'));
      tr.appendChild(createTextCell(item.label || '-'));
      tr.appendChild(createTextCell(formatPaymentReference(item)));

      const statusCell = document.createElement('td');
      statusCell.appendChild(createStatusBadge(item.status));
      tr.appendChild(statusCell);

      const actionsCell = document.createElement('td');
      const actionsList = [];
      
      // Afficher les boutons Confirmer/Rejeter seulement si le statut n'est pas final
      if (!isFinal) {
        actionsList.push(
          {
            label: 'Confirmer',
            action: 'event-registration-confirm',
            id: item.id,
            variant: 'primary',
          },
          {
            label: 'Rejeter',
            action: 'event-registration-reject',
            id: item.id,
            variant: 'secondary',
          }
        );
      }
      
      // Toujours afficher le bouton Supprimer
      actionsList.push({
        label: 'Supprimer',
        action: 'event-registration-delete',
        id: item.id,
        variant: 'secondary',
      });
      
      actionsCell.appendChild(createRowActions(actionsList));
      tr.appendChild(actionsCell);

      fragment.appendChild(tr);
    });

    dom.eventsRegistrationsTbody.replaceChildren(fragment);
  }

  updatePaginationUI('eventRegistrations', page, totalPages);
}

function renderCatalogSection() {
  if (!dom.catalogEventsTbody) return;

  const section = state.sections.catalog;

  if (section.loading) {
    renderSkeletonRows(dom.catalogEventsTbody, 6);
    return;
  }

  if (!section.rows.length) {
    renderEmptyRow(dom.catalogEventsTbody, 6, 'Aucun élément de catalogue disponible.');
    return;
  }

  const sortedRows = sortByDate(section.rows.slice(), 'date_desc');
  const fragment = document.createDocumentFragment();

  sortedRows.forEach((item) => {
    const tr = document.createElement('tr');

    tr.appendChild(createTextCell(item.title || 'Sans titre'));
    tr.appendChild(createTextCell(item.type || '-'));
    tr.appendChild(createTextCell(formatDate(item.startDate)));
    tr.appendChild(createTextCell(formatPrice(item.price)));

    const statusCell = document.createElement('td');
    statusCell.appendChild(createStatusBadge(item.status));
    tr.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.appendChild(createRowActions([
      {
        label: 'Modifier',
        action: 'catalog-edit',
        id: item.id,
        variant: 'primary',
      },
      {
        label: 'Supprimer',
        action: 'catalog-delete',
        id: item.id,
        variant: 'secondary',
      },
    ]));
    tr.appendChild(actionsCell);

    fragment.appendChild(tr);
  });

  dom.catalogEventsTbody.replaceChildren(fragment);
}

function renderSkeletonRows(tbody, columns, rows = 5) {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < rows; index += 1) {
    const tr = document.createElement('tr');
    tr.className = 'admin-skeleton-row';

    const td = document.createElement('td');
    td.colSpan = columns;

    const line = document.createElement('span');
    line.className = 'admin-skeleton-line';
    td.appendChild(line);

    tr.appendChild(td);
    fragment.appendChild(tr);
  }

  tbody.replaceChildren(fragment);
}

function renderEmptyRow(tbody, columns, message) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');

  td.colSpan = columns;
  td.className = 'admin-empty-state';
  td.textContent = message;

  tr.appendChild(td);
  tbody.replaceChildren(tr);
}

function createTextCell(value) {
  const td = document.createElement('td');
  td.textContent = value;
  return td;
}

function createStatusBadge(status) {
  const normalizedStatus = normalizeStatus(status);
  const span = document.createElement('span');

  span.className = `status-badge ${statusClassName(normalizedStatus)}`;
  span.textContent = statusLabel(normalizedStatus);

  return span;
}

function createRowActions(actions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'admin-row-actions';

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-sm ${action.variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`;
    button.dataset.action = action.action;
    button.dataset.id = String(action.id);
    button.textContent = action.label;
    button.disabled = Boolean(action.disabled);
    wrapper.appendChild(button);
  });

  return wrapper;
}

function updatePaginationUI(sectionKey, page, totalPages) {
  if (sectionKey === 'contacts') {
    if (dom.contactsPageInfo) {
      dom.contactsPageInfo.textContent = `Page ${page} / ${totalPages}`;
    }
    if (dom.contactsPrev) dom.contactsPrev.disabled = page <= 1;
    if (dom.contactsNext) dom.contactsNext.disabled = page >= totalPages;
    return;
  }

  if (sectionKey === 'formations') {
    if (dom.formationsPageInfo) {
      dom.formationsPageInfo.textContent = `Page ${page} / ${totalPages}`;
    }
    if (dom.formationsPrev) dom.formationsPrev.disabled = page <= 1;
    if (dom.formationsNext) dom.formationsNext.disabled = page >= totalPages;
    return;
  }

  if (sectionKey === 'eventRegistrations') {
    if (dom.eventsPageInfo) {
      dom.eventsPageInfo.textContent = `Page ${page} / ${totalPages}`;
    }
    if (dom.eventsPrev) dom.eventsPrev.disabled = page <= 1;
    if (dom.eventsNext) dom.eventsNext.disabled = page >= totalPages;
  }
}

function updateRegistrationFilterOptions(sectionKey) {
  const section = state.sections[sectionKey];
  if (!section) return;

  const select = sectionKey === 'formations' ? dom.formationsFilter : dom.eventsFilter;
  if (!select) return;

  const previousValue = select.value;
  const optionsValues = unique(section.rows.map((item) => item.label).filter(Boolean)).sort((a, b) => a.localeCompare(b, 'fr'));

  const fragment = document.createDocumentFragment();

  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.textContent = sectionKey === 'formations' ? 'Toutes les formations' : 'Tous les événements';
  fragment.appendChild(defaultOption);

  optionsValues.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    fragment.appendChild(option);
  });

  select.replaceChildren(fragment);

  if (optionsValues.includes(previousValue)) {
    select.value = previousValue;
    section.filter = previousValue;
  } else {
    section.filter = 'all';
    select.value = 'all';
  }
}

function exportRegistrationsCsv(sectionKey) {
  const section = state.sections[sectionKey];
  if (!section) return;

  const rows = section.filteredRows.length ? section.filteredRows : section.rows;
  if (!rows.length) {
    showToast('Aucune donnée à exporter.', 'info');
    return;
  }

  const isFormation = sectionKey === 'formations';
  const fileSuffix = isFormation ? 'formations' : 'evenements';
  const labelHeader = isFormation ? 'Formation' : 'Evenement';

  const headers = ['Date', 'Nom', 'Contact', 'Telephone', labelHeader, 'ReferencePaiement', 'Statut'];
  const csvRows = rows.map((item) => [
    formatDateTime(item.date),
    item.name,
    item.contact,
    item.phone || '',
    item.label || '',
    item.paymentReference || (item.paymentRequired ? 'En attente' : 'Gratuit'),
    statusLabel(item.status),
  ]);

  const csvContent = [headers, ...csvRows]
    .map((line) => line.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');

  downloadLink.href = downloadUrl;
  downloadLink.download = `qaris-inscriptions-${fileSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);

  showToast('Export CSV généré avec succès.', 'success');
}

async function handleContactsActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const rowId = button.dataset.id;

  if (action === 'contact-mark-processed') {
    await markContactAsProcessed(rowId);
  }

  if (action === 'contact-delete') {
    await deleteContactMessage(rowId);
  }
}

async function handleFormationsActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const rowId = button.dataset.id;

  if (action === 'formation-confirm') {
    await updateRegistrationDecision('formations', rowId, 'confirm');
    return;
  }

  if (action === 'formation-reject') {
    await updateRegistrationDecision('formations', rowId, 'reject');
    return;
  }

  if (action === 'formation-delete') {
    await deleteFormationRegistration(rowId);
  }
}

async function handleEventsRegistrationsActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const rowId = button.dataset.id;

  if (action === 'event-registration-confirm') {
    await updateRegistrationDecision('eventRegistrations', rowId, 'confirm');
    return;
  }

  if (action === 'event-registration-reject') {
    await updateRegistrationDecision('eventRegistrations', rowId, 'reject');
    return;
  }

  if (action === 'event-registration-delete') {
    await deleteEventRegistration(rowId);
  }
}

async function handleCatalogActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const rowId = button.dataset.id;

  if (action === 'catalog-edit') {
    const targetRow = state.sections.catalog.rows.find((item) => String(item.id) === String(rowId));
    if (!targetRow) return;

    openEventModal(targetRow);
    return;
  }

  if (action === 'catalog-delete') {
    await deleteCatalogEvent(rowId);
  }
}

async function markContactAsProcessed(rowId) {
  const section = state.sections.contacts;
  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (targetRow.status === 'processed') {
    return;
  }

  const client = getSupabase();

  try {
    await requireWriteAuthentication();

    if (client && targetRow.sourceTable) {
      await updateRowWithFallback(
        client,
        targetRow.sourceTable,
        targetRow.sourceId,
        [
          { status: 'processed', processed_at: new Date().toISOString() },
          { status: 'processed' },
          { is_processed: true },
          { treated: true },
        ]
      );
    }

    targetRow.status = 'processed';
    scheduleRender('contacts');
    showToast('Message marqué comme traité.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur marquage contact', error);
    showToast(error?.message || 'Impossible de marquer ce message comme traité.', 'error');
  }
}

async function deleteContactMessage(rowId) {
  const section = state.sections.contacts;
  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (!window.confirm('Supprimer ce message de contact ?')) return;

  try {
    await deleteRowInDatabase(targetRow);

    section.rows = section.rows.filter((item) => String(item.id) !== String(rowId));
    scheduleRender('contacts');
    scheduleRender('stats');
    showToast('Message supprimé.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur suppression contact', error);
    showToast(error?.message || 'Suppression impossible.', 'error');
  }
}

async function deleteFormationRegistration(rowId) {
  const section = state.sections.formations;
  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (!window.confirm('Supprimer cette inscription formation ?')) return;

  try {
    await deleteRowInDatabase(targetRow);

    section.rows = section.rows.filter((item) => String(item.id) !== String(rowId));
    updateRegistrationFilterOptions('formations');
    scheduleRender('formations');
    scheduleRender('stats');
    showToast('Inscription formation supprimée.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur suppression inscription formation', error);
    showToast(error?.message || 'Suppression impossible.', 'error');
  }
}

async function deleteEventRegistration(rowId) {
  const section = state.sections.eventRegistrations;
  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (!window.confirm('Supprimer cette inscription événement ?')) return;

  try {
    await deleteRowInDatabase(targetRow);

    section.rows = section.rows.filter((item) => String(item.id) !== String(rowId));
    updateRegistrationFilterOptions('eventRegistrations');
    scheduleRender('eventRegistrations');
    scheduleRender('stats');
    showToast('Inscription événement supprimée.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur suppression inscription événement', error);
    showToast(error?.message || 'Suppression impossible.', 'error');
  }
}

async function updateRegistrationDecision(sectionKey, rowId, decision) {
  const section = state.sections[sectionKey];
  if (!section) return;

  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (isRegistrationFinalStatus(targetRow.status)) {
    return;
  }

  const decisionLabel = decision === 'confirm' ? 'confirmer' : 'rejeter';
  const confirmMessage = decision === 'confirm'
    ? 'Confirmer cette inscription après vérification de la référence de paiement ?'
    : 'Rejeter cette inscription ?';

  if (!window.confirm(confirmMessage)) return;

  const client = getSupabase();
  const nowIso = new Date().toISOString();

  const payloadAttempts = decision === 'confirm'
    ? [
      {
        status: 'confirmed',
        admin_review_status: 'confirmed',
        payment_status: targetRow.paymentRequired ? 'verified' : 'not_required',
        reviewed_at: nowIso,
      },
      {
        status: 'confirmed',
        payment_status: targetRow.paymentRequired ? 'verified' : 'not_required',
        reviewed_at: nowIso,
      },
      { status: 'confirmed' },
    ]
    : [
      {
        status: 'rejected',
        admin_review_status: 'rejected',
        payment_status: targetRow.paymentRequired ? 'rejected' : 'not_required',
        reviewed_at: nowIso,
      },
      {
        status: 'rejected',
        payment_status: targetRow.paymentRequired ? 'rejected' : 'not_required',
        reviewed_at: nowIso,
      },
      { status: 'cancelled' },
    ];

  try {
    await requireWriteAuthentication();

    if (client && targetRow.sourceTable) {
      await updateRowWithFallback(
        client,
        targetRow.sourceTable,
        targetRow.sourceId,
        payloadAttempts
      );
    }

    targetRow.status = decision === 'confirm' ? 'confirmed' : 'rejected';
    targetRow.paymentStatus = targetRow.paymentRequired
      ? (decision === 'confirm' ? 'verified' : 'rejected')
      : 'not_required';

    scheduleRender(sectionKey);
    showToast(`Inscription ${decisionLabel}e avec succès.`, 'success');
  } catch (error) {
    console.error(`Dashboard: erreur action ${decisionLabel} inscription`, error);
    showToast(error?.message || `Impossible de ${decisionLabel} cette inscription.`, 'error');
  }
}

async function deleteCatalogEvent(rowId) {
  const section = state.sections.catalog;
  const targetRow = section.rows.find((item) => String(item.id) === String(rowId));
  if (!targetRow) return;

  if (!window.confirm(`Supprimer l'élément de catalogue "${targetRow.title || 'sans titre'}" ?`)) return;

  try {
    await deleteRowInDatabase(targetRow, getCatalogTableCandidates());

    section.rows = section.rows.filter((item) => String(item.id) !== String(rowId));
    scheduleRender('catalog');
    scheduleRender('stats');
    showToast('Élément de catalogue supprimé.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur suppression catalogue', error);
    showToast(error?.message || 'Suppression impossible.', 'error');
  }
}

async function deleteRowInDatabase(row, candidateTables = null) {
  const client = getSupabase();

  await requireWriteAuthentication();

  if (!client) return;

  const tableCandidates = unique([
    ...(candidateTables || []),
    row.sourceTable,
  ].filter(Boolean));

  if (!tableCandidates.length) {
    throw new Error('Table source introuvable pour suppression.');
  }

  let lastError = null;

  for (const tableName of tableCandidates) {
    const { error } = await client
      .from(tableName)
      .delete()
      .eq('id', row.sourceId);

    if (!error) {
      return;
    }

    lastError = error;

    if (isMissingTableOrColumnError(error)) {
      continue;
    }

    throw error;
  }

  if (lastError) {
    throw lastError;
  }
}

async function updateRowWithFallback(client, tableName, rowId, payloadAttempts) {
  let lastError = null;

  for (const payload of payloadAttempts) {
    const { error } = await client
      .from(tableName)
      .update(payload)
      .eq('id', rowId);

    if (!error) {
      return;
    }

    lastError = error;

    if (isMissingTableOrColumnError(error)) {
      continue;
    }

    throw error;
  }

  if (lastError) {
    throw lastError;
  }
}

async function handleCatalogRefresh() {
  if (dom.refreshCatalogBtn) {
    dom.refreshCatalogBtn.disabled = true;
    dom.refreshCatalogBtn.textContent = 'Actualisation...';
  }

  try {
    await requireWriteAuthentication();
    await syncCatalogPublicationState();
    await loadCatalogEvents();
    showToast('Catalogue actualisé avec succès.', 'success');
  } catch (error) {
    console.error('Dashboard: erreur actualisation catalogue', error);
    showToast(error?.message || 'Actualisation catalogue impossible.', 'error');
  } finally {
    if (dom.refreshCatalogBtn) {
      dom.refreshCatalogBtn.disabled = false;
      dom.refreshCatalogBtn.innerHTML = '<span aria-hidden="true">⟳</span> Actualiser le catalogue';
    }
  }
}

async function syncCatalogPublicationState() {
  const client = getSupabase();
  if (!client) return;

  const tableCandidates = getCatalogTableCandidates();
  let synced = false;

  for (const tableName of tableCandidates) {
    let { data, error } = await client
      .from(tableName)
      .select('id, status, is_published')
      .limit(1000);

    if (error && isMissingTableOrColumnError(error)) {
      const fallback = await client
        .from(tableName)
        .select('id, is_published')
        .limit(1000);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (isMissingTableOrColumnError(error)) continue;
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];

    for (const row of rows) {
      const normalizedStatus = String(row?.status || '').toLowerCase();
      const shouldPublish = normalizedStatus
        ? normalizedStatus === 'active' || normalizedStatus === 'published'
        : row?.is_published === true;

      if (row?.is_published === shouldPublish) {
        continue;
      }

      const { error: updateError } = await client
        .from(tableName)
        .update({ is_published: shouldPublish })
        .eq('id', row.id);

      if (updateError && !isMissingTableOrColumnError(updateError)) {
        throw updateError;
      }
    }

    state.sections.catalog.tableName = tableName;
    synced = true;
    break;
  }

  if (!synced) {
    throw new Error('Aucune table catalogue compatible trouvée.');
  }
}

function openEventModal(eventRow = null) {
  if (!dom.eventModal || !dom.eventForm) return;

  if (eventRow) {
    if (dom.eventModalTitle) dom.eventModalTitle.textContent = 'Modifier un événement';

    if (dom.eventIdField) dom.eventIdField.value = String(eventRow.id || '');
    if (dom.eventTitleField) dom.eventTitleField.value = eventRow.title || '';
    if (dom.eventTypeField) dom.eventTypeField.value = eventRow.type || 'formation';
    if (dom.eventPriceField) dom.eventPriceField.value = Number.isFinite(Number(eventRow.price)) ? String(eventRow.price) : '0';
    if (dom.eventStartDateField) dom.eventStartDateField.value = formatInputDate(eventRow.startDate);
    if (dom.eventEndDateField) dom.eventEndDateField.value = formatInputDate(eventRow.endDate);
    if (dom.eventDescriptionField) dom.eventDescriptionField.value = eventRow.description || '';
    if (dom.eventStatusField) dom.eventStatusField.value = eventRow.status === 'inactive' ? 'inactive' : 'active';
    if (dom.eventImageUrlField) dom.eventImageUrlField.value = eventRow.imageUrl || '';
    if (dom.eventImageFileField) dom.eventImageFileField.value = '';

    setEventImagePreview(eventRow.imageUrl || '');
  } else {
    if (dom.eventModalTitle) dom.eventModalTitle.textContent = 'Ajouter un événement';

    dom.eventForm.reset();
    if (dom.eventIdField) dom.eventIdField.value = '';
    if (dom.eventImageUrlField) dom.eventImageUrlField.value = '';
    if (dom.eventImageFileField) dom.eventImageFileField.value = '';
    clearEventImagePreview();
  }

  dom.eventModal.classList.remove('hidden');
}

function closeEventModal() {
  if (!dom.eventModal) return;

  dom.eventModal.classList.add('hidden');

  if (dom.eventForm) {
    dom.eventForm.reset();
  }

  if (dom.eventIdField) dom.eventIdField.value = '';
  if (dom.eventImageUrlField) dom.eventImageUrlField.value = '';
  if (dom.eventImageFileField) dom.eventImageFileField.value = '';
  clearEventImagePreview();
}

async function handleEventSubmit(event) {
  event.preventDefault();

  if (!dom.eventForm) return;

  const submitButton = dom.eventForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Enregistrement...';
  }

  try {
    await requireWriteAuthentication();

    const formData = new FormData(dom.eventForm);
    const title = String(formData.get('title') || '').trim();
    const type = String(formData.get('type') || 'formation');
    const price = Number.parseFloat(String(formData.get('price') || '0'));
    const startDate = String(formData.get('startDate') || '');
    const endDate = String(formData.get('endDate') || '');
    const description = String(formData.get('description') || '').trim();
    const status = String(formData.get('status') || 'active');
    const eventId = String(formData.get('eventId') || '').trim();

    if (!title) {
      throw new Error('Le titre est obligatoire.');
    }

    if (!startDate) {
      throw new Error('La date de début est obligatoire.');
    }

    let resolvedImageUrl = String(dom.eventImageUrlField?.value || '').trim();
    const selectedFile = dom.eventImageFileField?.files?.[0] || null;

    if (selectedFile) {
      const client = getSupabase();
      if (!client) {
        throw new Error('Upload image indisponible sans connexion Supabase.');
      }

      const validationError = validateEventImageFile(selectedFile);
      if (validationError) {
        throw new Error(validationError);
      }

      resolvedImageUrl = await uploadEventImage(client, selectedFile);
      if (dom.eventImageUrlField) {
        dom.eventImageUrlField.value = resolvedImageUrl;
      }
    }

    const fullPayload = {
      title,
      type,
      price: Number.isFinite(price) ? price : 0,
      start_date: startDate,
      end_date: endDate || null,
      description,
      image_url: resolvedImageUrl || null,
      status,
      is_published: status === 'active',
    };

    const fallbackPayload = {
      title,
      type,
      start_date: startDate,
      end_date: endDate || null,
      description,
      is_published: status === 'active',
    };

    if (eventId) {
      await updateCatalogEvent(eventId, fullPayload, fallbackPayload);
      showToast('Événement mis à jour avec succès.', 'success');
    } else {
      await createCatalogEvent(fullPayload, fallbackPayload);
      showToast('Événement ajouté avec succès.', 'success');
    }

    closeEventModal();
    await loadCatalogEvents();
    scheduleRender('stats');
  } catch (error) {
    console.error('Dashboard: erreur sauvegarde événement', error);
    showToast(error?.message || 'Impossible d\'enregistrer cet événement.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Enregistrer';
    }
  }
}

async function updateCatalogEvent(eventId, fullPayload, fallbackPayload) {
  const client = getSupabase();

  if (!client) {
    const localRow = state.sections.catalog.rows.find((item) => String(item.id) === String(eventId));
    if (localRow) {
      localRow.title = fullPayload.title;
      localRow.type = fullPayload.type;
      localRow.price = fullPayload.price;
      localRow.startDate = fullPayload.start_date;
      localRow.endDate = fullPayload.end_date;
      localRow.description = fullPayload.description;
      localRow.imageUrl = fullPayload.image_url;
      localRow.status = fullPayload.status;
      localRow.isPublished = fullPayload.is_published;
      scheduleRender('catalog');
    }
    return;
  }

  const tableCandidates = getCatalogTableCandidates();
  let lastError = null;

  for (const tableName of tableCandidates) {
    const updateAttempts = [fullPayload, fallbackPayload];

    for (const payload of updateAttempts) {
      const { error } = await client
        .from(tableName)
        .update(payload)
        .eq('id', eventId);

      if (!error) {
        state.sections.catalog.tableName = tableName;
        return;
      }

      lastError = error;

      if (isMissingTableOrColumnError(error)) {
        continue;
      }

      throw error;
    }

    if (lastError && isMissingTableOrColumnError(lastError)) {
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

async function createCatalogEvent(fullPayload, fallbackPayload) {
  const client = getSupabase();

  if (!client) {
    const localId = `local-${Date.now()}`;
    state.sections.catalog.rows.unshift({
      id: localId,
      sourceId: localId,
      sourceTable: null,
      title: fullPayload.title,
      type: fullPayload.type,
      price: fullPayload.price,
      startDate: fullPayload.start_date,
      endDate: fullPayload.end_date,
      description: fullPayload.description,
      imageUrl: fullPayload.image_url,
      status: fullPayload.status,
      isPublished: fullPayload.is_published,
      date: new Date().toISOString(),
    });

    scheduleRender('catalog');
    return;
  }

  const tableCandidates = getCatalogTableCandidates();
  let lastError = null;

  for (const tableName of tableCandidates) {
    const createdAt = new Date().toISOString();
    const insertAttempts = [
      { ...fullPayload, created_at: createdAt },
      { ...fallbackPayload, created_at: createdAt },
    ];

    for (const payload of insertAttempts) {
      const { error } = await client
        .from(tableName)
        .insert([payload]);

      if (!error) {
        state.sections.catalog.tableName = tableName;
        return;
      }

      lastError = error;

      if (isMissingTableOrColumnError(error)) {
        continue;
      }

      throw error;
    }

    if (lastError && isMissingTableOrColumnError(lastError)) {
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function handleImageFilePreview(event) {
  const file = event?.target?.files?.[0];

  if (!file) {
    clearEventImagePreview();
    return;
  }

  const validationError = validateEventImageFile(file);
  if (validationError) {
    showToast(validationError, 'error');
    event.target.value = '';
    clearEventImagePreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setEventImagePreview(String(reader.result || ''));
  };
  reader.readAsDataURL(file);
}

function setEventImagePreview(imageUrl) {
  if (!dom.eventImagePreviewWrapper || !dom.eventImagePreview) return;

  if (!imageUrl) {
    clearEventImagePreview();
    return;
  }

  dom.eventImagePreview.src = imageUrl;
  dom.eventImagePreviewWrapper.classList.remove('hidden');
}

function clearEventImagePreview() {
  if (!dom.eventImagePreviewWrapper || !dom.eventImagePreview) return;

  dom.eventImagePreview.src = '';
  dom.eventImagePreviewWrapper.classList.add('hidden');
}

function validateEventImageFile(file) {
  if (!file) return null;

  if (file.size > MAX_EVENT_IMAGE_SIZE_BYTES) {
    const maxSizeMb = Number(ADMIN_SECURITY_CONFIG.catalog?.maxImageSizeMB || 5);
    return `Image trop volumineuse. Taille max : ${maxSizeMb} MB.`;
  }

  if (file.type && !SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    return 'Format image non supporté. Utilisez JPG, PNG, WEBP ou GIF.';
  }

  return null;
}

async function uploadEventImage(client, file) {
  const validationError = validateEventImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const filePath = buildEventImageStoragePath(file);
  const { error: uploadError } = await client
    .storage
    .from(CATALOG_STORAGE_BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    if (String(uploadError.message || '').toLowerCase().includes('bucket')) {
      throw new Error(`Bucket Supabase introuvable. Crée le bucket "${CATALOG_STORAGE_BUCKET}".`);
    }

    throw new Error(`Upload image impossible : ${uploadError.message || 'erreur inconnue'}`);
  }

  const { data } = client.storage
    .from(CATALOG_STORAGE_BUCKET)
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Image uploadée mais URL publique introuvable.');
  }

  return data.publicUrl;
}

function buildEventImageStoragePath(file) {
  const safeBaseName = sanitizeFileBaseName(file?.name);
  const extensionFromType = String(file?.type || '').split('/')[1] || 'jpg';
  const extensionFromName = String(file?.name || '').split('.').pop() || extensionFromType;
  const extension = extensionFromName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  return `events/${timestamp}-${safeBaseName}-${randomSuffix}.${extension}`;
}

function sanitizeFileBaseName(fileName) {
  const withoutExtension = String(fileName || 'event-image').replace(/\.[^.]+$/, '');

  return withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'event-image';
}

async function fetchRowsFromCandidates(client, candidates) {
  let lastError = null;

  for (const tableName of unique(candidates)) {
    const attempts = [
      () => client.from(tableName).select('*').order('created_at', { ascending: false }).limit(MAX_FETCH_ROWS),
      () => client.from(tableName).select('*').order('date', { ascending: false }).limit(MAX_FETCH_ROWS),
      () => client.from(tableName).select('*').order('id', { ascending: false }).limit(MAX_FETCH_ROWS),
      () => client.from(tableName).select('*').limit(MAX_FETCH_ROWS),
    ];

    for (const runQuery of attempts) {
      const { data, error } = await runQuery();

      if (!error) {
        return {
          rows: Array.isArray(data) ? data : [],
          tableName,
          error: null,
        };
      }

      lastError = error;

      if (!isMissingTableOrColumnError(error)) {
        return { rows: [], tableName, error };
      }

      if (isMissingTableError(error)) {
        break;
      }
    }
  }

  return {
    rows: [],
    tableName: null,
    error: lastError,
  };
}

function normalizeContactRow(row, sourceTable, index) {
  const sourceId = getRowPrimaryId(row, `${sourceTable || 'contact'}-${index}`);

  return {
    id: String(sourceId),
    sourceId,
    sourceTable,
    name: normalizePersonName(row),
    email: normalizeEmail(row),
    phone: normalizePhone(row),
    message: normalizeMessage(row),
    status: normalizeStatus(
      firstNonEmpty(row.status, row.processing_status, row.state) ||
      (row.is_processed === true ? 'processed' : 'pending')
    ),
    date: normalizeDate(row),
  };
}

function normalizeRegistrationRow(row, sourceTable, index, targetKind) {
  const sourceId = getRowPrimaryId(row, `${sourceTable || 'registration'}-${index}`);
  const label = normalizeRegistrationLabel(row, targetKind);
  const inferredKind = inferRegistrationKind(row, sourceTable, label, targetKind);
  const contact = String(firstNonEmpty(
    row.contact_info,
    row.contact,
    row.email,
    row.mail,
    row.email_address,
    row.phone,
    row.telephone
  ) || '-').trim();
  const phone = normalizePhone(row);
  const paymentReference = String(firstNonEmpty(
    row.payment_reference,
    row.reference_paiement,
    row.payment_ref,
    row.transaction_reference,
    row.reference
  ) || '').trim();
  const explicitPaymentRequired = toBooleanish(firstNonEmpty(row.payment_required));
  const explicitIsFree = toBooleanish(firstNonEmpty(row.is_free));
  const amountValue = Number.parseFloat(String(firstNonEmpty(row.amount, row.price, row.cost, '0') || '0'));
  const paymentRequired = explicitPaymentRequired !== null
    ? explicitPaymentRequired
    : explicitIsFree === true
      ? false
      : (Number.isFinite(amountValue) && amountValue > 0) || Boolean(paymentReference);
  const status = normalizeStatus(firstNonEmpty(row.status, row.registration_status, row.admin_review_status) || 'pending');
  const paymentStatus = normalizeStatus(
    firstNonEmpty(row.payment_status, row.payment_verification_status) ||
    (paymentRequired ? 'pending_verification' : 'not_required')
  );

  return {
    id: String(sourceId),
    sourceId,
    sourceTable,
    name: normalizePersonName(row),
    contact,
    email: normalizeEmail(row),
    phone,
    label,
    kind: inferredKind,
    paymentReference,
    paymentRequired,
    paymentStatus,
    status,
    date: normalizeDate(row),
  };
}

function normalizeCatalogEventRow(row, sourceTable, index) {
  const sourceId = getRowPrimaryId(row, `${sourceTable || 'catalog'}-${index}`);
  const rawStatus = firstNonEmpty(row.status, row.publication_status);
  const status = rawStatus
    ? normalizeStatus(rawStatus)
    : (row.is_published === true ? 'active' : 'inactive');

  return {
    id: String(sourceId),
    sourceId,
    sourceTable,
    title: firstNonEmpty(row.title, row.name, row.event_name, row.training_name) || 'Sans titre',
    type: normalizeCatalogType(firstNonEmpty(row.type, row.event_type, row.category)),
    price: firstNonEmpty(row.price, row.amount, row.cost),
    startDate: firstNonEmpty(row.start_date, row.start_at, row.date, row.created_at),
    endDate: firstNonEmpty(row.end_date, row.end_at),
    description: firstNonEmpty(row.description, row.details),
    imageUrl: firstNonEmpty(row.image_url, row.image, row.cover_url),
    status,
    isPublished: row.is_published === true,
    date: normalizeDate(row),
  };
}

function normalizePersonName(row) {
  const directName = firstNonEmpty(
    row.nom,
    row.name,
    row.full_name,
    row.fullname,
    row.display_name
  );

  if (directName) return String(directName).trim();

  const firstName = firstNonEmpty(row.first_name, row.firstname, row.prenom, row.given_name);
  const lastName = firstNonEmpty(row.last_name, row.lastname, row.surname, row.family_name);
  const combined = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

  return combined || 'Non renseigné';
}

function normalizeEmail(row) {
  return String(firstNonEmpty(row.email, row.mail, row.email_address) || '-').trim();
}

function normalizePhone(row) {
  const value = firstNonEmpty(
    row.phone,
    row.telephone,
    row.tel,
    row.phone_number,
    row.mobile
  );

  return value ? String(value).trim() : '';
}

function normalizeMessage(row) {
  const value = firstNonEmpty(row.message, row.content, row.body, row.note);
  return value ? String(value).trim() : '-';
}

function normalizeDate(row) {
  const rawDate = firstNonEmpty(
    row.created_at,
    row.date,
    row.submitted_at,
    row.inserted_at,
    row.updated_at
  );

  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function normalizeRegistrationLabel(row, targetKind) {
  if (targetKind === 'formation') {
    return String(firstNonEmpty(
      row.formation,
      row.training,
      row.training_name,
      row.program,
      row.event_title,
      row.event_name,
      row.title,
      row.event_type,
      row.type
    ) || 'Formation non renseignée').trim();
  }

  return String(firstNonEmpty(
    row.event,
    row.event_name,
    row.event_title,
    row.event_type,
    row.type,
    row.title
  ) || 'Événement non renseigné').trim();
}

function inferRegistrationKind(row, sourceTable, label, targetKind) {
  const source = String(sourceTable || '').toLowerCase();
  if (source.includes('formation')) return 'formation';
  if (source.includes('event') || source.includes('evenement')) return 'event';

  const probe = `${
    firstNonEmpty(row.event_type, row.type, row.category, row.registration_type, label) || ''
  }`.toLowerCase();

  if (
    probe.includes('formation') ||
    probe.includes('atelier') ||
    probe.includes('training')
  ) {
    return 'formation';
  }

  if (
    probe.includes('event') ||
    probe.includes('evenement') ||
    probe.includes('événement') ||
    probe.includes('conference')
  ) {
    return 'event';
  }

  return targetKind === 'formation' ? 'unknown' : 'unknown';
}

function normalizeCatalogType(value) {
  const type = String(value || '').toLowerCase().trim();

  if (type.includes('atelier')) return 'atelier';
  if (type.includes('event') || type.includes('evenement') || type.includes('événement')) return 'evenement';
  return 'formation';
}

function getRowPrimaryId(row, fallback) {
  return firstNonEmpty(row.id, row.uuid, row._id) || fallback;
}

function getCatalogTableCandidates() {
  return unique([
    state.sections.catalog.tableName,
    ...TRAINING_TABLE_CANDIDATES,
  ].filter(Boolean));
}

function paginate(rows, page, perPage) {
  const safePerPage = Math.max(1, Number(perPage || ROWS_PER_PAGE));
  const totalPages = Math.max(1, Math.ceil(rows.length / safePerPage));
  const safePage = clamp(page, 1, totalPages);

  const start = (safePage - 1) * safePerPage;
  const end = start + safePerPage;

  return {
    pageRows: rows.slice(start, end),
    page: safePage,
    totalPages,
  };
}

function sortByDate(rows, sortMode) {
  return rows.sort((a, b) => {
    const dateA = toTimestamp(a.date);
    const dateB = toTimestamp(b.date);

    if (dateA === dateB) return 0;

    if (sortMode === 'date_asc') {
      return dateA - dateB;
    }

    return dateB - dateA;
  });
}

function isLabelMatchingKind(label, kind) {
  const probe = String(label || '').toLowerCase().trim();
  if (!probe) return false;

  if (kind === 'formation') {
    return ['formation', 'training', 'atelier', 'coaching'].some((token) => probe.includes(token));
  }

  return ['event', 'evenement', 'événement', 'conference', 'séminaire', 'seminaire'].some((token) => probe.includes(token));
}

function toTimestamp(value) {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;

  return timestamp;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return value;
  }

  return null;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeStatus(value) {
  const normalized = String(value || '').toLowerCase().trim();

  if (!normalized) return 'pending';
  if (normalized.includes('process') || normalized.includes('traite') || normalized.includes('traité') || normalized === 'done') {
    return 'processed';
  }
  if (normalized.includes('reject') || normalized.includes('refus')) return 'rejected';
  if (normalized.includes('active') || normalized.includes('publish')) return 'active';
  if (normalized.includes('inactive') || normalized.includes('archive')) return 'inactive';
  if (normalized.includes('confirm')) return 'confirmed';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('pending') && normalized.includes('verif')) return 'pending_verification';
  if (normalized === 'verified' || normalized.includes('verify')) return 'verified';
  if (normalized.includes('not_required') || normalized.includes('not required') || normalized.includes('non requis')) return 'not_required';

  return normalized;
}

function statusClassName(status) {
  if (status === 'processed') return 'status-confirmed';
  if (status === 'verified') return 'status-confirmed';
  if (status === 'active') return 'status-active';
  if (status === 'inactive') return 'status-inactive';
  if (status === 'confirmed') return 'status-confirmed';
  if (status === 'rejected') return 'status-cancelled';
  if (status === 'cancelled') return 'status-cancelled';
  if (status === 'not_required') return 'status-inactive';
  return 'status-pending';
}

function statusLabel(status) {
  if (status === 'processed') return 'Traité';
  if (status === 'verified') return 'Vérifié';
  if (status === 'active') return 'Actif';
  if (status === 'inactive') return 'Inactif';
  if (status === 'confirmed') return 'Confirmé';
  if (status === 'rejected') return 'Rejeté';
  if (status === 'cancelled') return 'Annulé';
  if (status === 'pending_verification') return 'En vérification';
  if (status === 'not_required') return 'Non requis';
  return 'En attente';
}

function formatPaymentReference(item) {
  if (!item.paymentRequired) return 'Gratuit';
  if (item.paymentReference) return item.paymentReference;
  return 'En attente';
}

function isRegistrationFinalStatus(status) {
  return status === 'confirmed' || status === 'rejected' || status === 'cancelled';
}

function toBooleanish(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'oui', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'non', 'n'].includes(normalized)) return false;

  return null;
}

function truncate(value, maxLength = 110) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatInputDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '-';

  const amount = Number(value);
  if (Number.isNaN(amount)) return '-';

  return `${amount.toLocaleString('fr-FR')} €`;
}

function csvEscape(value) {
  const text = String(value ?? '');

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();

  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'admin-toast';

  if (type === 'success') {
    toast.classList.add('is-success');
  } else if (type === 'error') {
    toast.classList.add('is-error');
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

export default {
  initDashboard,
};
