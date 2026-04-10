/**
 * Gestion des formations et événements - Cabinet QARIS
 * Affichage et filtrage des formations, ateliers et événements
 */

import {
  getSupabase,
  getTableCandidates,
  runOnFirstAvailableTable,
} from './supabaseClient.js';

// Perf/fiabilité: drapeau global pour éviter l'initialisation concurrente du fallback inline.
if (typeof window !== 'undefined') {
  window.__qarisEventsTabsManagedByModule = true;
}

// État de l'application
const state = {
  activeTab: 'all',
  events: [],
  loading: false,
  eventCards: [],
  initialized: false,
  registrationListenerBound: false,
};

/**
 * Initialise la page des événements
 */
export function initEventsPage() {
  if (state.initialized) return;
  state.initialized = true;
  setupTabs();
  loadEvents();
  setupRegistrationButtons();
}

/**
 * Configure les onglets de navigation et le filtrage des cartes
 */
function setupTabs() {
  const tabsContainer = document.querySelector('.events-tabs');
  const eventGrid = document.querySelector('.events-grid');

  if (!tabsContainer || !eventGrid || tabsContainer.dataset.tabsBound === 'true') return;

  tabsContainer.dataset.tabsBound = 'true';
  state.eventCards = Array.from(eventGrid.querySelectorAll('.event-card'));

  // Perf: délégation d'événements pour éviter N listeners sur les onglets.
  tabsContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.tab-btn');
    if (!button || !tabsContainer.contains(button)) return;

    const filterValue = button.getAttribute('data-filter') || 'all';
    const tabButtons = tabsContainer.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
    });
    button.classList.add('is-active');
    button.setAttribute('aria-selected', 'true');

    filterEventCards(filterValue);
    state.activeTab = filterValue;
  });
}

/**
 * Filtre les cartes d'événements selon le type sélectionné
 * @param {string} filterType - Type de filtre ('all', 'formation', 'evenement')
 */
function filterEventCards(filterType) {
  const cards = state.eventCards.length
    ? state.eventCards
    : Array.from(document.querySelectorAll('.events-grid .event-card'));
  
  cards.forEach(card => {
    const cardType = card.getAttribute('data-type');
    
    // Afficher si 'all' est sélectionné ou si le type correspond
    if (filterType === 'all' || cardType === filterType) {
      // Fiabilité visuelle: restaurer le display CSS d'origine (flex) au lieu de forcer block.
      card.style.display = '';
      card.classList.add('fade-in');
    } else {
      card.style.display = 'none';
      card.classList.remove('fade-in');
    }
  });
}

/**
 * Charge les événements depuis Supabase
 */
async function loadEvents() {
  const client = getSupabase();
  if (!client) {
    console.warn('Trainings: Supabase non disponible, utilisation des données statiques');
    return;
  }

  state.loading = true;

  try {
    const candidates = getTableCandidates('trainings');
    const { data, error } = await runOnFirstAvailableTable(
      client,
      candidates,
      (tableName) => client
        .from(tableName)
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;

    state.events = data || [];
    renderEvents();
  } catch (error) {
    console.error('Trainings: Erreur lors du chargement des événements', error);
  } finally {
    state.loading = false;
  }
}

/**
 * Affiche les événements dans les grilles
 */
function renderEvents() {
  const container = document.querySelector('.events-grid');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!state.events.length) {
    const msg = document.createElement('p');
    msg.className = 'section-subtitle';
    msg.style.textAlign = 'center';
    msg.style.width = '100%';
    msg.textContent = 'Aucune formation publiée disponible pour le moment.';
    container.appendChild(msg);
    state.eventCards = [];
    return;
  }

  const fragment = document.createDocumentFragment();

  state.events.forEach((eventItem) => {
    const normalizedType = normalizeEventType(eventItem?.type);
    const article = document.createElement('article');
    article.className = 'event-card fade-in';
    article.setAttribute('data-type', normalizedType);

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'event-image-wrapper';

    const badge = document.createElement('span');
    badge.className = `event-badge ${normalizedType === 'evenement' ? 'event-badge-evenement' : 'event-badge-formation'}`;
    badge.textContent = normalizedType === 'evenement' ? 'Événement' : 'Formation';

    const image = document.createElement('img');
    image.className = 'event-image';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = eventItem?.title || 'Événement Cabinet QARIS';
    image.src = getEventImageUrl(eventItem);
    image.onerror = () => {
      image.onerror = null;
      image.src = '../assets/images/evenement-atelier.jpg';
    };

    imageWrapper.appendChild(badge);
    imageWrapper.appendChild(image);

    const content = document.createElement('div');
    content.className = 'event-content';

    const dateBlock = document.createElement('div');
    dateBlock.className = 'event-date';
    const dateIcon = document.createElement('span');
    dateIcon.setAttribute('aria-hidden', 'true');
    dateIcon.textContent = '📅';
    const timeEl = document.createElement('time');
    const isoDate = toIsoDate(eventItem?.start_date || eventItem?.created_at);
    if (isoDate) {
      timeEl.dateTime = isoDate;
      timeEl.textContent = formatDisplayDate(isoDate);
    } else {
      timeEl.textContent = 'Date à confirmer';
    }
    dateBlock.appendChild(dateIcon);
    dateBlock.appendChild(timeEl);

    const title = document.createElement('h4');
    title.className = 'event-title';
    title.textContent = eventItem?.title || 'Événement QARIS';

    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = truncateText(
      eventItem?.description || 'Formation et accompagnement relationnel par le Cabinet QARIS.',
      130
    );

    const details = document.createElement('p');
    details.className = 'event-text';
    details.textContent = eventItem?.description || '';

    const meta = document.createElement('div');
    meta.className = 'event-meta';

    const price = document.createElement('span');
    price.className = 'event-price';
    price.textContent = formatEventPrice(eventItem?.price);

    const registerLink = document.createElement('a');
    registerLink.className = 'btn btn-primary btn-sm';
    registerLink.href = '../contact.html#contact-form';
    registerLink.textContent = 'S\'inscrire';
    registerLink.setAttribute('data-event-category', normalizedType);
    registerLink.setAttribute('data-event-title', eventItem?.title || 'Événement QARIS');
    registerLink.setAttribute('data-event-price', String(Number.isFinite(Number(eventItem?.price)) ? Number(eventItem.price) : 0));
    if (normalizedType === 'evenement') {
      registerLink.setAttribute('data-event-id', String(eventItem?.id || ''));
    } else {
      registerLink.setAttribute('data-training-id', String(eventItem?.id || ''));
    }

    meta.appendChild(price);
    meta.appendChild(registerLink);

    content.appendChild(dateBlock);
    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(details);
    content.appendChild(meta);

    article.appendChild(imageWrapper);
    article.appendChild(content);
    fragment.appendChild(article);
  });

  container.appendChild(fragment);
  state.eventCards = Array.from(container.querySelectorAll('.event-card'));
  filterEventCards(state.activeTab);
}

function normalizeEventType(type) {
  const normalized = String(type || '').toLowerCase().trim();
  if (normalized === 'evenement' || normalized === 'event') return 'evenement';
  return 'formation';
}

function truncateText(text, maxLength) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
}

function toIsoDate(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return 'Date à confirmer';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Date à confirmer';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatEventPrice(price) {
  if (price === null || price === undefined || Number.isNaN(Number(price))) return 'Gratuit';
  const value = Number(price);
  if (value <= 0) return 'Gratuit';
  return `${value.toLocaleString('fr-FR')} €`;
}

function getEventImageUrl(eventItem) {
  const directUrl = String(eventItem?.image_url || '').trim();
  if (directUrl) return directUrl;
  return normalizeEventType(eventItem?.type) === 'evenement'
    ? '../assets/images/evenement-conference.jpg'
    : '../assets/images/formation-communication.jpg';
}

/**
 * Configure les boutons d'inscription
 */
function setupRegistrationButtons() {
  if (state.registrationListenerBound) return;
  state.registrationListenerBound = true;

  // Perf: un seul listener délégué pour tous les boutons dynamiques/statiques.
  document.addEventListener('click', (e) => {
    const button = e.target.closest(
      'a[data-training-id], a[data-workshop-id], a[data-event-id], button[data-training-id], button[data-workshop-id], button[data-event-id]'
    );
    if (!button) return;

    const href = button.getAttribute('href');

    // Si un lien explicite existe, laisser la navigation native se faire.
    if (button.tagName === 'A' && href && href !== '#') {
      return;
    }

    // Filet de sécurité pour les anciens boutons avec href="#".
    e.preventDefault();
    window.location.href = '../contact.html#contact-form';
  });
}

/**
 * Charger et afficher les sessions à la demande pour une formation
 * Recherche le conteneur cible existant :
 * - #sessions-<trainingId>
 * - [data-sessions-for="<trainingId>"]
 * - .sessions-list à l'intérieur du bloc parent contenant [data-training-id]
 */
async function loadSessions(trainingId) {
  const client = getSupabase();
  if (!client) {
    console.warn('Trainings: Supabase non disponible pour charger les sessions');
    return;
  }

  // Trouver un conteneur existant où injecter les sessions
  let target = document.querySelector(`#sessions-${trainingId}`) || document.querySelector(`[data-sessions-for="${trainingId}"]`);
  if (!target) {
    const parent = document.querySelector(`[data-training-id="${trainingId}"]`);
    if (parent) target = parent.querySelector('.sessions-list');
  }

  if (!target) {
    return;
  }

  // Afficher état de chargement léger
  const prev = target.textContent;
  target.textContent = 'Chargement des sessions...';

  try {
    const nowIso = new Date().toISOString();
    const candidates = getTableCandidates('sessions');
    const { data, error } = await runOnFirstAvailableTable(
      client,
      candidates,
      (tableName) => client
        .from(tableName)
        .select('*')
        .eq('training_id', trainingId)
        .eq('is_published', true)
        .gte('start_at', nowIso)
        .order('start_at', { ascending: true })
    );

    if (error) throw error;

    while (target.firstChild) target.removeChild(target.firstChild);

    if (!data || data.length === 0) {
      target.textContent = 'Aucune session prochaine.';
      return;
    }

    const ul = document.createElement('ul');
    data.forEach(s => {
      const li = document.createElement('li');
      const d = new Date(s.start_at);
      const when = isNaN(d) ? '' : ' — ' + d.toLocaleString();
      li.textContent = (s.title || s.name || 'Session') + when;
      ul.appendChild(li);
    });
    target.appendChild(ul);
  } catch (err) {
    console.error('Trainings: Erreur lors de la récupération des sessions', err);
    target.textContent = prev || 'Erreur lors du chargement des sessions.';
  }
}

/**
 * Ouvre la modal d'inscription
 * @param {string} eventId - ID de l'événement
 * @param {string} eventType - Type d'événement
 */
function openRegistrationModal(eventId, eventType) {
  const modal = document.getElementById('registration-modal');
  if (!modal) return;

  const regEventId = document.getElementById('reg-event-id');
  const regEventType = document.getElementById('reg-event-type');
  // Fiabilité: éviter une erreur JS si les champs cachés sont absents sur une page.
  if (regEventId) regEventId.value = eventId || '';
  if (regEventType) regEventType.value = eventType || '';

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/**
 * Ferme la modal d'inscription
 */
function closeRegistrationModal() {
  const modal = document.getElementById('registration-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

/**
 * Ouvre la modal de demande d'information
 * @param {string} eventId - ID de l'événement
 * @param {string} eventType - Type d'événement
 */
function openInfoModal(eventId, eventType) {
  const modal = document.getElementById('info-modal');
  if (!modal) return;

  const infoEventId = document.getElementById('info-event-id');
  const infoEventType = document.getElementById('info-event-type');
  // Fiabilité: éviter une erreur JS si les champs cachés sont absents sur une page.
  if (infoEventId) infoEventId.value = eventId || '';
  if (infoEventType) infoEventType.value = eventType || '';

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/**
 * Ferme la modal de demande d'information
 */
function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Configuration des modals au chargement
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.trainingsModalBound !== 'true') {
    document.body.dataset.trainingsModalBound = 'true';

    // Fiabilité: garde-fou pour éviter les listeners dupliqués si script réinjecté.
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', () => {
        closeRegistrationModal();
        closeInfoModal();
      });
    });

    // Fermeture avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeRegistrationModal();
        closeInfoModal();
      }
    });
  }

  // Initialiser la page si on est sur la page des événements
  if (document.querySelector('.events-tabs')) {
    initEventsPage();
  }
});

export default {
  initEventsPage,
  loadEvents,
};
