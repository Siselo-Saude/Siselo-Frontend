const CADH_SEARCH_KEY = 'siselo_cadh_search';

document.addEventListener('DOMContentLoaded', () => {
  if (!['cadh', 'ubs'].includes(document.body.dataset.page)) {
    return;
  }
  setupCadhPage();
});

async function setupCadhPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  const shellKey = document.body.dataset.page === 'ubs' ? 'ubs' : 'cadh';
  SISELO.bindShell(shellKey);
  applyCadhModulePermissions(permissions);
  bindCadhPatientSearch(permissions);

  // Initialize date element
  const dateElement = document.getElementById('cadh-current-date');
  const updateCurrentDate = () => {
    if (!dateElement) return;
    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    dateElement.dateTime = localDate;
    dateElement.textContent = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(now);
  };
  updateCurrentDate();
  window.setInterval(updateCurrentDate, 60 * 1000);

  // Initialize sidebar toggle
  const sidebarToggle = document.getElementById('cadh-sidebar-toggle');
  const collapsedKey = 'siselo_home_sidebar_collapsed';
  const setSidebarCollapsed = (collapsed) => {
    document.body.classList.toggle('home-sidebar-is-collapsed', collapsed);
    if (sidebarToggle) {
      sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      sidebarToggle.setAttribute('aria-label', collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral');
    }
  };

  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = localStorage.getItem(collapsedKey) === 'true';
  } catch (error) {
  }
  setSidebarCollapsed(sidebarCollapsed);

  sidebarToggle?.addEventListener('click', () => {
    sidebarCollapsed = !document.body.classList.contains('home-sidebar-is-collapsed');
    setSidebarCollapsed(sidebarCollapsed);
    try {
      localStorage.setItem(collapsedKey, String(sidebarCollapsed));
    } catch (error) {
    }
  });

  // Reformat user profile & logout button in sidebar footer
  const sidebarFooter = document.querySelector('.home-sidebar-footer');
  const logoutButton = document.getElementById('logout-button');
  if (sidebarFooter && logoutButton) {
    sidebarFooter.appendChild(logoutButton);
    logoutButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg><span>Sair</span>';
  }

  const accountLink = document.getElementById('topbar-account-link');
  if (accountLink) {
    accountLink.textContent = '';
    const icon = document.createElement('span');
    icon.className = 'home-sidebar-user-icon';
    icon.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
    const copy = document.createElement('span');
    copy.className = 'home-sidebar-user-copy';
    const name = document.createElement('strong');
    name.textContent = user.name || 'Meu perfil';
    const email = document.createElement('small');
    email.textContent = user.email || 'Acessar perfil';
    copy.append(name, email);
    accountLink.append(icon, copy);
  }

  if (!await restoreCadhPatientSearch(permissions)) {
    setCadhPatientCardsUnlocked(false);
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

function bindCadhPatientSearch(permissions) {
  const form = document.getElementById('cadh-cpf-search');
  const input = document.getElementById('cadh-cpf-input');
  if (!form || !input) {
    return;
  }

  document.querySelectorAll('[data-requires-patient="true"]').forEach((card) => {
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
    setCadhPatientCardPatient('');
    setCadhPatientCardsUnlocked(false);
    syncCadhPendingIndicators([]);
    const result = document.getElementById('cadh-patient-result');
    if (result) {
      result.innerHTML = '';
    }

    const detail = document.getElementById('cadh-patient-detail');
    if (detail) {
      detail.innerHTML = `
        <div class="cadh-empty-state">
          <span class="cadh-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#cadh-icon-users"></use></svg></span>
          <strong>Nenhum usuário selecionado</strong>
          <p>Busque e selecione um usuário ao lado para visualizar e gerenciar suas informações de cuidado.</p>
        </div>
      `;
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
        renderPatientSuggestions(query);
      } catch (error) {
        currentPatients = [];
        renderPatientSuggestions(query);
      }
    }, 300);
  });

  function renderPatientSuggestions(query) {
    const result = document.getElementById('cadh-patient-result');
    if (!result) return;

    const matching = SISELO.filterPatientsForSearch(currentPatients, query).slice(0, 10);
    
    if (!matching.length) {
      result.innerHTML = '<div class="cadh-patient-message is-error">Nenhum usuário encontrado.</div>';
      return;
    }

    result.innerHTML = matching.map(p => `
      <button type="button" class="cadh-patient-option" data-patient-id="${p.id}">
        <span class="cadh-patient-option-name">${SISELO.escapeHtml(p.full_name || 'Usuário sem nome')}</span>
        <span class="cadh-patient-option-meta">CPF: ${SISELO.escapeHtml(p.cpf || '-')} | Equipe: ${SISELO.escapeHtml(formatCadhTeamName(p.team_ref))}</span>
      </button>
    `).join('');

    result.querySelectorAll('.cadh-patient-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const patientId = btn.dataset.patientId;
        const patient = currentPatients.find(p => p.id == patientId);
        if (patient) {
          saveCadhSearchState(patient, patient.cpf); 
          setCadhPatientCardPatient(patient.id);
          setCadhPatientCardsUnlocked(true);
          input.value = patient.full_name; 
          result.innerHTML = '';
          await renderCadhPatientFromContext(patient, permissions);
        }
      });
    });
  }
}

async function restoreCadhPatientSearch(permissions) {
  const state = readCadhSearchState();
  const patient = state && state.patient ? state.patient : null;
  const patientId = SISELO.normalizeEntityId(patient && patient.id);
  const input = document.getElementById('cadh-cpf-input');

  if (!patientId || !input) {
    clearCadhSearchState();
    return false;
  }

  input.value = patient.full_name || '';
  setCadhPatientCardPatient(patientId);
  setCadhPatientCardsUnlocked(true);
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
      team_ref: patient.team_ref || '',
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

function setCadhPatientCardsUnlocked(unlocked) {
  document.querySelectorAll('[data-requires-patient="true"]').forEach((card) => {
    const baseHref = card.dataset.baseHref || '#';
    const patientId = card.dataset.patientId || '';
    if (card instanceof HTMLAnchorElement) {
      card.href = unlocked && patientId ? `${baseHref}?patient_id=${encodeURIComponent(patientId)}` : '#';
    }
    card.classList.toggle('is-locked', !unlocked);
    card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    card.tabIndex = unlocked ? 0 : -1;
  });
}

function setCadhPatientCardPatient(patientId) {
  document.querySelectorAll('[data-requires-patient="true"]').forEach((card) => {
    card.dataset.patientId = patientId ? String(patientId) : '';
  });
}

function renderCadhPatient(patient, careSummary = null) {
  const result = document.getElementById('cadh-patient-detail');
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
        <div class="cadh-patient-pill"><span class="cadh-patient-pill-label">Equipe</span><strong>${renderCadhTeamBadge(patient.team_ref)}</strong></div>
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

function formatCadhTeamName(value) {
  return SISELO.formatTeamName(value);
}

function renderCadhTeamBadge(value) {
  return SISELO.renderTeamBadge(value);
}
