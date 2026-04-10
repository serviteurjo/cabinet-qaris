/**
 * Gestion du formulaire de contact - Cabinet QARIS
 * Soumission et validation du formulaire de contact
 */

import {
  getSupabase,
  getTableCandidates,
  runOnFirstAvailableTable,
} from './supabaseClient.js';

/**
 * Initialise le formulaire de contact
 */
export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  if (form.dataset.boundSubmit === 'true') return;
  // Fiabilité/perf: empêche l'ajout multiple du même listener submit.
  form.dataset.boundSubmit = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Récupérer les données du formulaire
    const formData = new FormData(form);
    const data = {
      first_name: formData.get('firstName'),
      last_name: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      consent: formData.get('consent') === 'on',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Validation
    if (!validateContactForm(data)) {
      return;
    }

    // Désactiver le bouton pendant l'envoi
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      await submitContactForm(data);
      showSuccessMessage('Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.');
      form.reset();
    } catch (error) {
      console.error('Contact: Erreur lors de l\'envoi du message', error);
      showErrorMessage('Une erreur est survenue lors de l\'envoi. Veuillez réessayer ou nous contacter par téléphone.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/**
 * Valide les données du formulaire de contact
 * @param {Object} data - Données du formulaire
 * @returns {boolean} True si valide
 */
function validateContactForm(data) {
  // Vérifier les champs obligatoires
  if (!data.first_name || !data.last_name) {
    alert('Veuillez indiquer votre nom et prénom.');
    return false;
  }

  if (!data.email) {
    alert('Veuillez indiquer votre adresse email.');
    return false;
  }

  // Valider le format de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    alert('Veuillez indiquer une adresse email valide.');
    return false;
  }

  if (!data.subject) {
    alert('Veuillez sélectionner un sujet.');
    return false;
  }

  if (!data.message || data.message.trim().length < 10) {
    alert('Veuillez écrire un message d\'au moins 10 caractères.');
    return false;
  }

  if (!data.consent) {
    alert('Vous devez accepter la politique de confidentialité pour envoyer votre message.');
    return false;
  }

  return true;
}

/**
 * Soumet le formulaire de contact à Supabase
 * @param {Object} data - Données du formulaire
 */
async function submitContactForm(data) {
  const client = getSupabase();

  // Si Supabase n'est pas disponible, simuler l'envoi
  if (!client) {
    return new Promise(resolve => setTimeout(resolve, 1500));
  }

  const candidates = getTableCandidates('contactMessages');
  const { error } = await runOnFirstAvailableTable(
    client,
    candidates,
    (tableName) => client.from(tableName).insert([data])
  );

  if (error) throw error;
}

/**
 * Affiche un message de succès
 * @param {string} message - Message à afficher
 */
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
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Affiche un message d'erreur
 * @param {string} message - Message à afficher
 */
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
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  initContactForm();
});

export default {
  initContactForm,
  submitContactForm,
};
