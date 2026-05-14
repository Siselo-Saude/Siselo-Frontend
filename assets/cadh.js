const CADH_SEARCH_KEY = 'siselo_cadh_search';

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'cadh') {
    return;
  }
  setupCadhPage();
});

async function setupCadhPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('cadh');
  applyCadhModulePermissions(permissions);
  bindCadhSesSearch(permissions);
  if (!await restoreCadhSesSearch(permissions)) {
    setCadhSesCardsUnlocked(false);
    syncCadhPendingIndicators([]);
  }
}

function applyCadhModulePermissions(permissions) {
  const cards = {
    'cadh-patients-card': 'patients.view',
    'cadh-careplans-card': 'careplans.view',
    'cadh-encounters-card': 'encounters.view',
    'cadh-transitions-card': 'transitions.view',
  };

  Object.entries(cards).forEach(([id, permission]) => {
    const card = document.getElementById(id);
    if (card) {
      card.hidden = !permissions.has(permission);
    }
  });
}

function bindCadhSesSearch(permissions) {
  const form = document.getElementById('cadh-cpf-search');
  const input = document.getElementById('cadh-cpf-input');
  if (!form || !input) {
    return;
  }

  document.querySelectorAll('[data-requires-ses="true"]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (card.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        renderCadhPatientMessage('Busque um usuário existente para liberar este módulo.', 'error');
        input.focus();
      }
    });
  });

  let debounceTimer = 0;
  let currentPatients = [];

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearCadhSearchState();
    setCadhSesCardPatient('');
    setCadhSesCardsUnlocked(false);
    syncCadhPendingIndicators([]);
    const result = document.getElementById('cadh-patient-result');
    if (result) {
      result.innerHTML = '';
    }

    if (query.length < 1) {
      renderCadhPatientMessage('Digite o NOME ou CPF para localizar o usuário.');
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(query));
        currentPatients = Array.isArray(data.rows) ? data.rows : [];
        renderSesSuggestions(query);
      } catch (error) {
        currentPatients = [];
        renderSesSuggestions(query);
      }
    }, 300);
  });

  function renderSesSuggestions(query) {
    const result = document.getElementById('cadh-patient-result');
    if (!result) return;

    const matching = SISELO.filterPatientsForSearch(currentPatients, query).slice(0, 10);
    
    if (!matching.length) {
      result.innerHTML = '<div class="cadh-patient-message is-error">Nenhum usuário encontrado.</div>';
      return;
    }

    result.innerHTML = matching.map(p => `
      <button type="button" class="cadh-ses-option" data-patient-id="${p.id}">
        <span class="cadh-ses-option-name">${SISELO.escapeHtml(p.full_name || 'Usuário sem nome')}</span>
        <span class="cadh-ses-option-meta">CPF: ${SISELO.escapeHtml(p.cpf || '-')}</span>
      </button>
    `).join('');

    result.querySelectorAll('.cadh-ses-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const patientId = btn.dataset.patientId;
        const patient = currentPatients.find(p => p.id == patientId);
        if (patient) {
          saveCadhSearchState(patient, patient.cpf); 
          setCadhSesCardPatient(patient.id);
          setCadhSesCardsUnlocked(true);
          input.value = patient.full_name; 
          result.innerHTML = '';
          await renderCadhPatientFromContext(patient, permissions);
        }
      });
    });
  }
}

async function restoreCadhSesSearch(permissions) {
  const state = readCadhSearchState();
  const patient = state && state.patient ? state.patient : null;
  const patientId = SISELO.normalizeEntityId(patient && patient.id);
  const input = document.getElementById('cadh-cpf-input');

  if (!patientId || !input) {
    clearCadhSearchState();
    return false;
  }

  input.value = patient.full_name || '';
  setCadhSesCardPatient(patientId);
  setCadhSesCardsUnlocked(true);
  await renderCadhPatientFromContext(patient, permissions);
  return true;
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

function saveCadhSearchState(patient, cpf) {
  const patientId = SISELO.normalizeEntityId(patient && patient.id);
  if (!patientId) {
    clearCadhSearchState();
    return;
  }

  sessionStorage.setItem(CADH_SEARCH_KEY, JSON.stringify({
    cpf: String(cpf || patient.cpf || '').trim(),
    patient: {
      id: patientId,
      full_name: patient.full_name || '',
      cpf: patient.cpf || '',
      ses: patient.ses || '',
      birth_date: patient.birth_date || '',
      first_cadh_date: patient.first_cadh_date || '',
      age_label: patient.age_label || '',
      race: patient.race || '',
    },
  }));
}

function clearCadhSearchState() {
  sessionStorage.removeItem(CADH_SEARCH_KEY);
}

function setCadhSesCardsUnlocked(unlocked) {
  document.querySelectorAll('[data-requires-ses="true"]').forEach((card) => {
    const baseHref = card.dataset.baseHref || '#';
    const patientId = card.dataset.patientId || '';
    card.href = unlocked && patientId ? `${baseHref}?patient_id=${encodeURIComponent(patientId)}` : '#';
    card.classList.toggle('is-locked', !unlocked);
    card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    card.tabIndex = unlocked ? 0 : -1;
  });
}

function setCadhSesCardPatient(patientId) {
  document.querySelectorAll('[data-requires-ses="true"]').forEach((card) => {
    card.dataset.patientId = patientId ? String(patientId) : '';
  });
}

function renderCadhPatient(patient, careSummary = null) {
  const result = document.getElementById('cadh-patient-result');
  if (!result) {
    return;
  }

  const careSummaryHtml = careSummary && Array.isArray(careSummary.missingModules) && careSummary.missingModules.length
    ? `
      <section class="cadh-clinical-note" role="status" aria-live="polite">
        <div class="cadh-clinical-note-header">
          <span class="cadh-clinical-note-icon" aria-hidden="true">!</span>
          <div>
            <p class="cadh-clinical-note-title">Documentação pendente:</p>
          </div>
        </div>
        <div class="cadh-clinical-note-list" aria-label="Itens pendentes">
          ${careSummary.missingModules.map((module) => `
            ${module.href
              ? `<a class="cadh-clinical-note-tag cadh-clinical-note-link" href="${SISELO.escapeHtml(module.href)}">${SISELO.escapeHtml(module.label)}</a>`
              : `<span class="cadh-clinical-note-tag">${SISELO.escapeHtml(module.label)}</span>`}
          `).join('')}
        </div>
      </section>
    `
    : '';

  result.innerHTML = `
    <div class="cadh-patient-card">
      <div class="cadh-patient-card-header">
        <p class="cadh-patient-card-kicker">Usuário localizado</p>
        <h2 class="cadh-patient-card-name">${SISELO.escapeHtml(patient.full_name || '-')}</h2>
      </div>
      <div class="cadh-patient-info">
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">CPF</span><strong>${SISELO.escapeHtml(patient.cpf || '-')}</strong></div>
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">SES</span><strong>${SISELO.escapeHtml(patient.ses || '-')}</strong></div>
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">Nascimento</span><strong>${SISELO.escapeHtml(formatCadhDate(patient.birth_date))}</strong></div>
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">Idade</span><strong>${SISELO.escapeHtml(patient.age_label || '-')}</strong></div>
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">Raça/Cor</span><strong>${SISELO.escapeHtml(formatCadhRace(patient.race))}</strong></div>
      </div>
      ${careSummaryHtml}
    </div>
  `;
}

async function renderCadhPatientFromContext(patient, permissions) {
  const normalizedId = SISELO.normalizeEntityId(patient && patient.id);
  if (!normalizedId) {
    syncCadhPendingIndicators([]);
    renderCadhPatient(patient, null);
    return;
  }

  try {
    const clinicalContext = await SISELO.loadPatientClinicalContext(normalizedId);
    const contextPatient = clinicalContext && clinicalContext.patient
      ? clinicalContext.patient
      : patient;
    const careSummary = buildCadhCareSummary(clinicalContext, permissions);
    syncCadhPendingIndicators(careSummary && Array.isArray(careSummary.missingModules) ? careSummary.missingModules : []);
    renderCadhPatient(contextPatient, careSummary);
    saveCadhSearchState(contextPatient, patient && patient.cpf);
  } catch (error) {
    syncCadhPendingIndicators([]);
    renderCadhPatient(patient, null);
  }
}

function buildCadhCareSummary(clinicalContext, permissions) {
  if (!clinicalContext || !clinicalContext.patient) {
    return null;
  }

  const patientId = SISELO.normalizeEntityId(clinicalContext.patient.id);
  const modules = [
    {
      key: 'careplans',
      permission: 'careplans.view',
      label: 'Plano de cuidado',
      href: patientId ? `/care-plans/list.html?patient_id=${encodeURIComponent(patientId)}` : '',
      rows: Array.isArray(clinicalContext.care_plans) ? clinicalContext.care_plans : [],
    },
    {
      key: 'encounters',
      permission: 'encounters.view',
      label: 'Atendimento',
      href: patientId ? `/encounters/list.html?patient_id=${encodeURIComponent(patientId)}` : '',
      rows: Array.isArray(clinicalContext.encounters) ? clinicalContext.encounters : [],
    },
    {
      key: 'transitions',
      permission: 'transitions.view',
      label: 'Transição do cuidado',
      href: patientId ? `/transitions/list.html?patient_id=${encodeURIComponent(patientId)}` : '',
      rows: Array.isArray(clinicalContext.transitions) ? clinicalContext.transitions : [],
    },
  ];

  const missingModules = modules
    .filter((module) => permissions.has(module.permission) && module.rows.length === 0)
    .map((module) => ({
      key: module.key,
      label: module.label,
      href: module.href,
    }));

  if (!missingModules.length) {
    return null;
  }

  return {
    missingModules,
  };
}

function renderCadhPatientMessage(message, type = 'info') {
  const result = document.getElementById('cadh-patient-result');
  if (!result) {
    return;
  }

  result.innerHTML = `<p class="cadh-patient-message ${type === 'error' ? 'is-error' : ''}">${SISELO.escapeHtml(message)}</p>`;
}

function syncCadhPendingIndicators(missingModules) {
  const pendingKeys = new Set(
    (Array.isArray(missingModules) ? missingModules : []).map((module) => String(module.key || ''))
  );

  document.querySelectorAll('[data-module-key]').forEach((card) => {
    const key = card.getAttribute('data-module-key') || '';
    const isPending = pendingKeys.has(key);
    card.classList.toggle('is-pending', isPending);

    const badge = card.querySelector('[data-pending-badge]');
    if (badge instanceof HTMLElement) {
      badge.hidden = !isPending;
    }
  });
}

function formatCadhDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || '-';
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatCadhRace(value) {
  const labels = {
    branca: 'Branco',
    preta: 'Preto',
    parda: 'Pardo',
    amarela: 'Amarelo',
    indigena: 'Indígena',
    nao_informado: 'Não informado',
  };
  const key = String(value || '').trim().toLowerCase();
  return labels[key] || value || '-';
}