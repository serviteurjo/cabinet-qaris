/**
 * Gestion des inscriptions et demandes d'information - Cabinet QARIS
 * Formulaire d'inscription avancé (gratuit/payant + référence de paiement)
 */

import {
  getSupabase,
  getTableCandidates,
  runOnFirstAvailableTable,
  isMissingTableOrColumnError,
} from './supabaseClient.js';

const FORMATION_TABLE_CANDIDATES = unique([
  'registrations_formations',
  'formation_registrations',
  'training_registrations',
  ...getTableCandidates('registrations'),
]);

const EVENT_TABLE_CANDIDATES = unique([
  'registrations_events',
  'event_registrations',
  ...getTableCandidates('registrations'),
]);

const REGISTRATION_SELECTORS = [
  'a[data-training-id]',
  'a[data-event-id]',
  'a[data-workshop-id]',
  'button[data-training-id]',
  'button[data-event-id]',
  'button[data-workshop-id]',
].join(', ');

/**
 * Initialise les formulaires d'inscription et de demande d'info
 */
export function initRegistrationForms() {
  if (typeof window !== 'undefined') {
    window.__qarisRegistrationManagedByModule = true;
    window.openQarisRegistrationModal = openRegistrationModalFromTrigger;
  }

  setupRegistrationTriggers();
  setupRegistrationForm();
  setupInfoForm();
}

function setupRegistrationTriggers() {
  if (document.body.dataset.registrationTriggersBound === 'true') return;
  document.body.dataset.registrationTriggersBound = 'true';

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(REGISTRATION_SELECTORS);
    if (!trigger) return;

    event.preventDefault();
    openRegistrationModalFromTrigger(trigger);
  });
}

function openRegistrationModalFromTrigger(trigger) {
  const modal = document.getElementById('registration-modal');
  if (!modal) return;

  const card = trigger.closest('.event-card');

  const eventType = resolveEventType(trigger, card);
  const eventId = resolveEventId(trigger);
  const eventTitle = resolveEventTitle(trigger, card);
  const priceLabel = resolveEventPriceLabel(trigger, card);
  const eventPrice = parsePrice(priceLabel);
  const isFree = eventPrice <= 0;

  setInputValue('reg-event-id', eventId);
  setInputValue('reg-event-type', eventType);
  setInputValue('reg-event-title', eventTitle);
  setInputValue('reg-event-price', String(eventPrice));
  setInputValue('reg-is-free', isFree ? 'true' : 'false');

  const selectedTitle = document.getElementById('reg-selected-title');
  if (selectedTitle) {
    selectedTitle.textContent = eventTitle;
  }

  const selectedType = document.getElementById('reg-selected-type');
  if (selectedType) {
    selectedType.classList.remove('status-active', 'status-confirmed');
    selectedType.classList.add(eventType === 'formation' ? 'status-active' : 'status-confirmed');
    selectedType.textContent = eventType === 'formation' ? 'Formation' : 'Événement';
  }

  const selectedPrice = document.getElementById('reg-selected-price');
  if (selectedPrice) {
    selectedPrice.textContent = isFree ? 'Gratuit' : formatPrice(eventPrice);
  }

  togglePaymentSection({ isFree });

  const form = document.getElementById('registration-form');
  if (form) {
    form.reset();
    // Restaurer les métadonnées car form.reset() réinitialise aussi les champs cachés.
    setInputValue('reg-event-id', eventId);
    setInputValue('reg-event-type', eventType);
    setInputValue('reg-event-title', eventTitle);
    setInputValue('reg-event-price', String(eventPrice));
    setInputValue('reg-is-free', isFree ? 'true' : 'false');
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function togglePaymentSection({ isFree }) {
  const paymentSection = document.getElementById('reg-payment-section');
  const paymentReferenceInput = document.getElementById('reg-payment-reference');
  const freeNote = document.getElementById('reg-free-note');

  if (paymentSection) {
    paymentSection.classList.toggle('hidden', isFree);
  }

  if (freeNote) {
    freeNote.classList.toggle('hidden', !isFree);
  }

  if (paymentReferenceInput) {
    paymentReferenceInput.required = !isFree;
    if (isFree) {
      paymentReferenceInput.value = '';
    }
  }
}

function resolveEventId(trigger) {
  return String(
    trigger.getAttribute('data-training-id') ||
    trigger.getAttribute('data-event-id') ||
    trigger.getAttribute('data-workshop-id') ||
    ''
  ).trim();
}

function resolveEventType(trigger, card) {
  const explicitType = String(trigger.getAttribute('data-event-category') || '').trim().toLowerCase();
  if (explicitType === 'formation' || explicitType === 'evenement') {
    return explicitType;
  }

  if (trigger.hasAttribute('data-training-id') || trigger.hasAttribute('data-workshop-id')) {
    return 'formation';
  }

  if (trigger.hasAttribute('data-event-id')) {
    return 'evenement';
  }

  const cardType = String(card?.getAttribute('data-type') || '').trim().toLowerCase();
  if (cardType === 'formation' || cardType === 'evenement') {
    return cardType;
  }

  return 'formation';
}

function resolveEventTitle(trigger, card) {
  const explicitTitle = String(trigger.getAttribute('data-event-title') || '').trim();
  if (explicitTitle) return explicitTitle;

  const titleFromCard = String(card?.querySelector('.event-title')?.textContent || '').trim();
  if (titleFromCard) return titleFromCard;

  return 'Événement Cabinet QARIS';
}

function resolveEventPriceLabel(trigger, card) {
  const explicitPrice = String(trigger.getAttribute('data-event-price') || '').trim();
  if (explicitPrice) return explicitPrice;

  return String(card?.querySelector('.event-price')?.textContent || '').trim() || 'Gratuit';
}

/**
 * Configure le formulaire d'inscription
 */
function setupRegistrationForm() {
  const form = document.getElementById('registration-form');
  if (!form) return;
  if (form.dataset.boundSubmit === 'true') return;

  form.dataset.boundSubmit = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const contactInfo = String(formData.get('contactInfo') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const message = String(formData.get('message') || '').trim();
    const eventId = String(formData.get('eventId') || '').trim();
    const eventType = String(formData.get('eventType') || 'formation').trim().toLowerCase();
    const eventTitle = String(formData.get('eventTitle') || '').trim();
    const paymentReference = String(formData.get('paymentReference') || '').trim();
    const isFree = String(formData.get('isFree') || 'false') === 'true';
    const eventPrice = Number.parseFloat(String(formData.get('eventPrice') || '0'));
    const consent = formData.get('consent') === 'on';

    if (!firstName || !lastName) {
      alert('Veuillez renseigner votre nom et votre prénom.');
      return;
    }

    if (!contactInfo) {
      alert('Veuillez renseigner le champ Email/Téléphone.');
      return;
    }

    if (!consent) {
      alert('Vous devez accepter la politique de confidentialité pour vous inscrire.');
      return;
    }

    if (!isFree && !paymentReference) {
      alert('Veuillez renseigner la référence du paiement.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';
    }

    const nowIso = new Date().toISOString();

    // Créer deux payloads distincts selon le type d'événement
    let fullPayload = {
      first_name: firstName,
      last_name: lastName,
      email: contactInfo,
      phone: phone || null,
      contact_info: contactInfo,
      message: message || null,
      event_id: eventId || null,
      event_type: eventType,
      event_title: eventTitle || null,
      amount: Number.isFinite(eventPrice) ? eventPrice : 0,
      is_free: isFree,
      payment_required: !isFree,
      payment_reference: isFree ? null : paymentReference,
      payment_status: isFree ? 'not_required' : 'pending_verification',
      status: 'pending',
      admin_review_status: 'pending',
      consent,
      created_at: nowIso,
    };

    // Ajouter la colonne spécifique au type
    if (eventType === 'formation') {
      fullPayload.formation = eventTitle || null;
    } else if (eventType === 'evenement') {
      fullPayload.event = eventTitle || null;
    }

    const fallbackPayload = {
      first_name: firstName,
      last_name: lastName,
      email: contactInfo,
      phone: phone || null,
      event_id: eventId || null,
      event_type: eventType,
      status: 'pending',
      consent,
      created_at: nowIso,
    };

    try {
      await submitRegistration({
        eventType,
        fullPayload,
        fallbackPayload,
      });

      showSuccessMessage(
        isFree
          ? 'Inscription enregistrée avec succès. Merci pour votre confiance !'
          : 'Inscription enregistrée. Votre dossier sera confirmé après vérification de la référence de paiement.'
      );

      form.reset();
      closeModal('registration-modal');
    } catch (error) {
      console.error('Registration: Erreur lors de l\'inscription', error);
      showErrorMessage('Une erreur est survenue. Veuillez réessayer ou nous contacter directement.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

/**
 * Configure le formulaire de demande d'information
 */
function setupInfoForm() {
  const form = document.getElementById('info-form');
  if (!form) return;
  if (form.dataset.boundSubmit === 'true') return;

  form.dataset.boundSubmit = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {
      first_name: formData.get('firstName'),
      last_name: formData.get('lastName'),
      email: formData.get('email'),
      message: formData.get('message'),
      event_id: formData.get('eventId'),
      event_type: formData.get('eventType'),
      consent: formData.get('consent') === 'on',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    if (!data.consent) {
      alert('Vous devez accepter la politique de confidentialité pour envoyer votre demande.');
      return;
    }

    try {
      await submitInfoRequest(data);
      showSuccessMessage('Votre demande a été envoyée avec succès ! Nous vous répondrons dans les plus brefs délais.');
      form.reset();
      closeModal('info-modal');
    } catch (error) {
      console.error('Registration: Erreur lors de la demande d\'info', error);
      showErrorMessage('Une erreur est survenue. Veuillez réessayer ou nous contacter directement.');
    }
  });
}

/**
 * Soumet une inscription à Supabase
 */
export async function submitRegistration({ eventType, fullPayload, fallbackPayload }) {
  const client = getSupabase();

  if (!client) {
    return new Promise((resolve) => setTimeout(resolve, 900));
  }

  const targetCandidates = eventType === 'evenement'
    ? EVENT_TABLE_CANDIDATES
    : FORMATION_TABLE_CANDIDATES;

  let lastError = null;

  for (const tableName of targetCandidates) {
    const attempts = [fullPayload, fallbackPayload];

    for (const payload of attempts) {
      const { error } = await client
        .from(tableName)
        .insert([payload]);

      if (!error) {
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

  throw new Error('Aucune table d\'inscription compatible trouvée.');
}

/**
 * Soumet une demande d'information à Supabase
 */
async function submitInfoRequest(data) {
  const client = getSupabase();

  if (!client) {
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  const candidates = getTableCandidates('infoRequests');
  const { error } = await runOnFirstAvailableTable(
    client,
    candidates,
    (tableName) => client.from(tableName).insert([data])
  );

  if (error) throw error;
}

/**
 * Ferme une modal
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function showSuccessMessage(message) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--accent-soft-green);
    color: var(--color-neutral);
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function showErrorMessage(message) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--accent-soft-red);
    color: var(--color-primary-dark);
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function parsePrice(rawPrice) {
  const priceText = String(rawPrice || '').trim().toLowerCase();
  if (!priceText || priceText.includes('gratuit')) return 0;

  const numericCandidate = priceText
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  const parsed = Number.parseFloat(numericCandidate);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function formatPrice(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 'Gratuit';
  return `${amount.toLocaleString('fr-FR')} €`;
}

function setInputValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = value;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  initRegistrationForms();
});

export default {
  initRegistrationForms,
  submitRegistration,
  submitInfoRequest,
};
