const CADH_SEARCH_KEY = 'siselo_cadh_search';

const CADH_MANAGEMENT_TABS = {
  users: 'cadh-patients-card',
  careplans: 'cadh-careplans-card',
  encounters: 'cadh-encounters-card',
  transitions: 'cadh-transitions-card',
};

const CADH_DEFAULT_CARE_PLAN_ITEMS = [
  { item_type: 'dificuldade', title: 'Psicologia', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 1 },
  { item_type: 'dificuldade', title: 'Enfermagem', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 2 },
  { item_type: 'dificuldade', title: 'Endocrinologia', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 3 },
  { item_type: 'dificuldade', title: 'Cardiologia', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 4 },
  { item_type: 'dificuldade', title: 'Oftalmologia', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 5 },
  { item_type: 'dificuldade', title: 'Nutrição', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 6 },
  { item_type: 'dificuldade', title: 'Serviço Social', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 7 },
  { item_type: 'dificuldade', title: 'Fisioterapia', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 8 },
  { item_type: 'recomendacao', title: 'Intervenções medicamentosas e não medicamentosas', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 9 },
  { item_type: 'alerta', title: 'Sinais de alerta', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 10 },
  { item_type: 'meta', title: 'Prioridades e recomendações da equipe especializada', situation: '', difficulty: '', recommendation: '', goal: '', sort_order: 11 },
];

const CADH_TRANSITION_ORIGIN = 'CADH — Centro de Atenção Domiciliar Hospitalar';

const CADH_DEFAULT_UBS_OPTIONS = [
  'UBS Central',
  'UBS Norte',
  'UBS Sul',
  'UBS Leste',
  'UBS Oeste',
];

const CADH_ESF_OPTIONS = [
  { value: 'safira', label: 'Equipe Safira' },
  { value: 'ametista', label: 'Equipe Ametista' },
  { value: 'esmeralda', label: 'Equipe Esmeralda' },
  { value: 'diamante', label: 'Equipe Diamante' },
  { value: 'sem_equipe', label: 'Sem equipe definida' },
];

let cadhPermissions = new Set();
let cadhCurrentPatient = null;
let cadhClinicalContext = null;
let cadhActiveTab = 'users';

document.addEventListener('DOMContentLoaded', () => {
  if (!['cadh', 'ubs'].includes(document.body.dataset.page)) {
    return;
  }
  setupCadhPage();
});

async function setupCadhPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  cadhPermissions = SISELO.getUiPermissions(user);
  const shellKey = document.body.dataset.page === 'ubs' ? 'ubs' : 'cadh';
  SISELO.bindShell(shellKey);
  applyCadhModulePermissions(cadhPermissions);
  bindCadhManagementTabs();
  bindCadhPatientSearch(cadhPermissions);
  setupCadhHeaderDate();
  setupCadhSidebar(user);

  if (!await restoreCadhPatientSearch(cadhPermissions)) {
    setCadhPatientCardsUnlocked(false);
    syncCadhPendingIndicators([]);
    renderCadhEmptyManagementState();
  }
}

function setupCadhHeaderDate() {
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
}

function setupCadhSidebar(user) {
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

function bindCadhManagementTabs() {
  Object.entries(CADH_MANAGEMENT_TABS).forEach(([tabKey, id]) => {
    const tab = document.getElementById(id);
    if (!tab) return;

    tab.dataset.cadhManagementTab = tabKey;
    tab.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      if (tabKey !== 'users' && tab.getAttribute('aria-disabled') === 'true') {
        renderCadhPatientMessage('Busque um usuário existente para liberar este módulo.', 'error');
        document.getElementById('cadh-cpf-input')?.focus();
        return;
      }

      activateCadhManagementTab(tabKey);
    });
  });
}

function bindCadhPatientSearch(permissions) {
  const form = document.getElementById('cadh-cpf-search');
  const input = document.getElementById('cadh-cpf-input');
  if (!form || !input) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

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
    clearCadhSelectedPatient({ keepInput: true });

    if (query.length < 1) {
      renderCadhPatientMessage('Digite o nome ou CPF para localizar o usuário.');
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

    result.innerHTML = matching.map((patient) => `
      <button type="button" class="cadh-patient-option" data-patient-id="${patient.id}">
        <span class="cadh-patient-option-name">${SISELO.escapeHtml(patient.full_name || 'Usuário sem nome')}</span>
        <span class="cadh-patient-option-meta">CPF: ${SISELO.escapeHtml(patient.cpf || '-')} | Equipe: ${SISELO.escapeHtml(formatCadhTeamName(patient.team_ref))}</span>
      </button>
    `).join('');

    result.querySelectorAll('.cadh-patient-option').forEach((button) => {
      button.addEventListener('click', async () => {
        const patientId = button.dataset.patientId;
        const patient = currentPatients.find((row) => String(row.id) === String(patientId));
        if (patient) {
          saveCadhSearchState(patient, patient.cpf);
          setCadhPatientCardPatient(patient.id);
          setCadhPatientCardsUnlocked(true);
          input.value = patient.full_name || '';
          result.innerHTML = '<div class="cadh-patient-message">Carregando dados do usuário...</div>';
          cadhActiveTab = 'users';
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
    patient: normalizeCadhPatient(patient),
  }));
}

function clearCadhSearchState() {
  sessionStorage.removeItem(CADH_SEARCH_KEY);
}

function clearCadhSelectedPatient(options = {}) {
  cadhCurrentPatient = null;
  cadhClinicalContext = null;
  cadhActiveTab = 'users';
  clearCadhSearchState();
  setCadhPatientCardPatient('');
  setCadhPatientCardsUnlocked(false);
  syncCadhPendingIndicators([]);

  const result = document.getElementById('cadh-patient-result');
  if (result) {
    result.innerHTML = '';
  }

  const input = document.getElementById('cadh-cpf-input');
  if (input && !options.keepInput) {
    input.value = '';
  }

  renderCadhEmptyManagementState();
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

async function renderCadhPatientFromContext(patient, permissions) {
  const normalizedId = SISELO.normalizeEntityId(patient && patient.id);
  if (!normalizedId) {
    syncCadhPendingIndicators([]);
    renderCadhEmptyManagementState();
    return;
  }

  try {
    const clinicalContext = await SISELO.loadPatientClinicalContext(normalizedId);
    cadhClinicalContext = clinicalContext || null;
    const contextPatient = clinicalContext && clinicalContext.patient
      ? normalizeCadhPatient(clinicalContext.patient)
      : normalizeCadhPatient(patient);
    cadhCurrentPatient = contextPatient;
    const careSummary = buildCadhCareSummary(clinicalContext, permissions);
    syncCadhPendingIndicators(careSummary && Array.isArray(careSummary.missingModules) ? careSummary.missingModules : []);
    saveCadhSearchState(contextPatient, patient && patient.cpf);
    renderCadhSelectedPatientSummary(contextPatient);
    await activateCadhManagementTab(cadhActiveTab || 'users');
  } catch (error) {
    cadhClinicalContext = null;
    cadhCurrentPatient = normalizeCadhPatient(patient);
    syncCadhPendingIndicators([]);
    renderCadhSelectedPatientSummary(cadhCurrentPatient);
    await activateCadhManagementTab('users');
  }
}

async function activateCadhManagementTab(tabKey) {
  const normalizedTab = CADH_MANAGEMENT_TABS[tabKey] ? tabKey : 'users';
  cadhActiveTab = normalizedTab;

  Object.entries(CADH_MANAGEMENT_TABS).forEach(([key, id]) => {
    const tab = document.getElementById(id);
    if (!tab) return;
    const isActive = key === normalizedTab;
    tab.classList.toggle('active', isActive);
    if (isActive) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });

  if (!cadhCurrentPatient) {
    renderCadhEmptyManagementState();
    return;
  }

  if (normalizedTab === 'users') {
    renderCadhUserDetailsTab(cadhCurrentPatient);
    return;
  }

  if (normalizedTab === 'careplans') {
    await renderCadhCarePlanTab(cadhCurrentPatient);
    return;
  }

  if (normalizedTab === 'encounters') {
    renderCadhEncountersTab(cadhCurrentPatient);
    return;
  }

  renderCadhTransitionTab(cadhCurrentPatient);
}

function renderCadhEmptyManagementState() {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail) return;

  detail.innerHTML = `
    <div class="cadh-empty-state">
      <span class="cadh-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#cadh-icon-users"></use></svg></span>
      <strong>Nenhum usuário selecionado</strong>
      <p>Busque e selecione um usuário ao lado para visualizar e gerenciar suas informações de cuidado.</p>
    </div>
  `;
}

function renderCadhSelectedPatientSummary(patient) {
  const result = document.getElementById('cadh-patient-result');
  if (!result) return;

  result.innerHTML = `
    <article class="cadh-selected-patient-card">
      <header class="cadh-selected-patient-header">
        <span class="cadh-selected-patient-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>
        </span>
        <div>
        <span>Paciente selecionado</span>
          <strong>${SISELO.escapeHtml(patient.full_name || '-')}</strong>
        </div>
        <button type="button" class="cadh-selected-patient-clear" aria-label="Remover paciente selecionado">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <dl class="cadh-selected-patient-list">
        ${renderCadhDefinition('CPF', patient.cpf)}
        ${renderCadhDefinition('Equipe', formatCadhTeamName(patient.team_ref), { strongClass: 'is-team' })}
        ${renderCadhDefinition('Nascimento', formatCadhDate(patient.birth_date))}
        ${renderCadhDefinition('Idade', patient.age_label)}
        ${renderCadhDefinition('Raça/Cor', formatCadhRace(patient.race))}
        ${renderCadhDefinition('Telefone', patient.phone)}
      </dl>
    </article>
    <a class="cadh-transition-cta" href="/transitions/form.html?patient_id=${encodeURIComponent(patient.id)}">
      <span class="cadh-transition-cta-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M5 19a8 8 0 0 0 13-3M19 5a8 8 0 0 0-13 3"/></svg>
      </span>
      <span><strong>Transição do Cuidado</strong><small>CADH &rarr; UBS</small></span>
      <svg class="cadh-transition-cta-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </a>
  `;

  result.querySelector('.cadh-selected-patient-clear')?.addEventListener('click', () => {
    clearCadhSelectedPatient();
    document.getElementById('cadh-cpf-input')?.focus();
  });
}

function renderCadhUserDetailsTab(patient) {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail) return;

  const status = String(patient.status_label || patient.status || 'Ativo');
  const statusClass = normalizeCadhText(status).includes('inativo') ? 'is-inactive' : 'is-active';
  detail.innerHTML = `
    <section class="cadh-user-panel">
      <div class="cadh-user-panel-header">
        <h3>Dados Cadastrais do Usuário do SUS</h3>
        <span class="cadh-user-status ${statusClass}">${SISELO.escapeHtml(status)}</span>
      </div>
      <div class="cadh-user-data-grid">
        <dl>
          ${renderCadhDefinition('Nome Completo', patient.full_name)}
          ${renderCadhDefinition('CPF', patient.cpf)}
          ${renderCadhDefinition('SES', patient.ses)}
          ${renderCadhDefinition('Data de Nascimento', formatCadhDate(patient.birth_date))}
          ${renderCadhDefinition('Idade', patient.age_label)}
          ${renderCadhDefinition('Raça/Cor', formatCadhRace(patient.race))}
          ${renderCadhDefinition('Sexo', formatCadhSex(patient.sex || patient.gender_label))}
        </dl>
        <dl>
          ${renderCadhDefinition('Telefone', patient.phone)}
          ${renderCadhDefinition('Endereço', patient.address)}
          ${renderCadhDefinition('UBS de Origem', patient.ubs_ref || formatCadhTeamName(patient.team_ref))}
          ${renderCadhDefinition('Equipe de Saúde da Família', formatCadhTeamName(patient.team_ref))}
          ${renderCadhDefinition('1º Atendimento no CADH', formatCadhDate(patient.first_cadh_date))}
          ${renderCadhDefinition('Apoio Familiar', patient.responsible_name)}
          ${renderCadhDefinition('Apoio Comunitário', patient.emergency_contact)}
        </dl>
      </div>
      <div class="cadh-tab-actions">
        <a class="btn" href="/patients/show.html?id=${encodeURIComponent(patient.id)}">Abrir Usuário 360</a>
        ${cadhPermissions.has('patients.update') ? `<a class="btn btn-primary" href="/patients/form.html?id=${encodeURIComponent(patient.id)}">Editar cadastro</a>` : ''}
      </div>
    </section>
  `;
}

async function renderCadhCarePlanTab(patient, options = {}) {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail) return;

  const patientId = SISELO.normalizeEntityId(patient.id);
  const rows = Array.isArray(cadhClinicalContext && cadhClinicalContext.care_plans) ? cadhClinicalContext.care_plans : [];
  const currentPlan = rows[0] || null;
  const planId = SISELO.normalizeEntityId(currentPlan && currentPlan.id);
  const canCreate = cadhPermissions.has('careplans.create');
  const canUpdate = cadhPermissions.has('careplans.update');
  const canEdit = planId ? canUpdate : canCreate;

  if (!canEdit) {
    detail.innerHTML = `
      <section class="cadh-inline-panel">
        <div class="cadh-inline-panel-header">
          <h3>Planos de Cuidado - ${SISELO.escapeHtml(patient.full_name || '-')}</h3>
          <a class="btn" href="/care-plans/list.html?patient_id=${encodeURIComponent(patientId)}">Abrir lista</a>
        </div>
        <p class="cadh-inline-empty">Você pode visualizar os planos pela lista, mas não tem permissão para criar ou editar nesta tela.</p>
      </section>
    `;
    return;
  }

  detail.innerHTML = `
    <section class="cadh-inline-panel">
      <div class="cadh-inline-panel-header">
        <h3>Plano de Cuidados - ${SISELO.escapeHtml(patient.full_name || '-')}</h3>
        <div class="cadh-inline-actions">
          <a class="btn" href="/care-plans/list.html?patient_id=${encodeURIComponent(patientId)}">Abrir lista</a>
          ${planId ? `<a class="btn" href="${SISELO.getApiBaseUrl()}/care_plans/pdf.php?id=${encodeURIComponent(planId)}" target="_blank" rel="noreferrer">PDF</a>` : ''}
          <button class="btn btn-primary" type="submit" form="cadh-care-plan-form">Salvar</button>
        </div>
      </div>
      <div id="cadh-care-plan-alert" class="alert ${options.success ? 'alert-success' : ''}" ${options.success ? '' : 'hidden'}>${options.success ? SISELO.escapeHtml(options.success) : ''}</div>
      <div class="cadh-inline-loading">Carregando plano de cuidado...</div>
    </section>
  `;

  let context = null;
  try {
    const endpoint = '/care_plans/form.php' + (planId
      ? `?id=${encodeURIComponent(planId)}&patient_id=${encodeURIComponent(patientId)}`
      : `?patient_id=${encodeURIComponent(patientId)}`);
    context = await SISELO.apiRequest(endpoint);
  } catch (error) {
    detail.querySelector('.cadh-inline-loading').outerHTML = `
      <p class="cadh-inline-empty is-error">${SISELO.escapeHtml(error.message || 'Não foi possível carregar o plano de cuidado.')}</p>
    `;
    return;
  }

  const plan = context.plan || {};
  const items = Array.isArray(context.items) && context.items.length
    ? context.items
    : CADH_DEFAULT_CARE_PLAN_ITEMS;

  detail.querySelector('.cadh-inline-loading').outerHTML = `
    <form id="cadh-care-plan-form" class="cadh-care-plan-form" data-plan-id="${planId || ''}">
      <input type="hidden" name="patient_id" value="${SISELO.escapeHtml(patientId)}">
      <section class="cadh-form-section">
        <header>Plano de Cuidado</header>
        <div class="cadh-care-plan-grid">
          <label>
            <span>Início</span>
            <input name="start_date" type="date" value="${SISELO.escapeHtml(plan.start_date || SISELO.todayDateInputValue())}">
          </label>
          <label>
            <span>Fim</span>
            <input name="end_date" type="date" value="${SISELO.escapeHtml(plan.end_date || '')}">
          </label>
          <label class="is-wide">
            <span>Condutas terapêuticas</span>
            <textarea name="interventions" rows="3">${SISELO.escapeHtml(plan.interventions || '')}</textarea>
          </label>
        </div>
      </section>

      <section class="cadh-form-section">
        <header>Identificação dos fatores dificultadores e recomendações</header>
        <div id="cadh-care-plan-items" class="cadh-care-plan-items">
          ${items.map((item, index) => renderCadhCarePlanItem(item, index)).join('')}
        </div>
        <div class="cadh-care-plan-add">
          <button type="button" class="btn" data-cadh-add-care-item="dificuldade">+ Dificuldade</button>
          <button type="button" class="btn" data-cadh-add-care-item="recomendacao">+ Recomendação</button>
          <button type="button" class="btn" data-cadh-add-care-item="alerta">+ Alerta</button>
          <button type="button" class="btn" data-cadh-add-care-item="meta">+ Meta</button>
        </div>
      </section>
    </form>
  `;

  bindCadhCarePlanForm(patient);
}

function renderCadhCarePlanItem(item, index) {
  const type = item.item_type || 'dificuldade';
  const sortOrder = Number(item.sort_order || index + 1);
  return `
    <article class="cadh-care-plan-item">
      <input type="hidden" name="item_type[]" value="${SISELO.escapeHtml(type)}">
      <input type="hidden" name="sort_order[]" value="${SISELO.escapeHtml(sortOrder)}">
      <label class="cadh-care-plan-item-title">
        <span>Especialidade / título</span>
        <input name="title[]" value="${SISELO.escapeHtml(item.title || '')}" placeholder="Ex.: Enfermagem">
      </label>
      <label>
        <span>Situação</span>
        <textarea name="situation[]" rows="2">${SISELO.escapeHtml(item.situation || '')}</textarea>
      </label>
      <label>
        <span>Fatores dificultadores</span>
        <textarea name="difficulty[]" rows="2">${SISELO.escapeHtml(item.difficulty || '')}</textarea>
      </label>
      <label>
        <span>Recomendação</span>
        <textarea name="recommendation[]" rows="2">${SISELO.escapeHtml(item.recommendation || '')}</textarea>
      </label>
      <label>
        <span>Meta</span>
        <textarea name="goal[]" rows="2">${SISELO.escapeHtml(item.goal || '')}</textarea>
      </label>
      <button type="button" class="cadh-care-plan-remove" data-cadh-remove-care-item aria-label="Remover item">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </article>
  `;
}

function bindCadhCarePlanForm(patient) {
  const form = document.getElementById('cadh-care-plan-form');
  if (!form) return;

  enhanceCadhCarePlanDates(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!SISELO.validateEnhancedDateInputs(form, { alertId: 'cadh-care-plan-alert' })) {
      return;
    }
    await saveCadhCarePlanForm(patient, form);
  });

  form.querySelectorAll('[data-cadh-remove-care-item]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.cadh-care-plan-item')?.remove();
      syncCadhCarePlanSortOrder(form);
    });
  });

  document.querySelectorAll('[data-cadh-add-care-item]').forEach((button) => {
    button.addEventListener('click', () => {
      const container = document.getElementById('cadh-care-plan-items');
      if (!container) return;
      const nextIndex = container.querySelectorAll('.cadh-care-plan-item').length;
      const template = document.createElement('template');
      template.innerHTML = renderCadhCarePlanItem({
        item_type: button.dataset.cadhAddCareItem || 'dificuldade',
        title: '',
        situation: '',
        difficulty: '',
        recommendation: '',
        goal: '',
        sort_order: nextIndex + 1,
      }, nextIndex).trim();
      const item = template.content.firstElementChild;
      if (item) {
        container.appendChild(item);
        item.querySelector('[data-cadh-remove-care-item]')?.addEventListener('click', () => {
          item.remove();
          syncCadhCarePlanSortOrder(form);
        });
      }
    });
  });
}

function enhanceCadhCarePlanDates(form) {
  const today = SISELO.todayDateInputValue();
  const maxPlanDate = SISELO.shiftDateInputValue(today, { years: 5 });
  const startInput = form.querySelector('input[name="start_date"]');
  const endInput = form.querySelector('input[name="end_date"]');

  if (!startInput || !endInput) {
    return;
  }

  startInput.id = startInput.id || 'cadh-plan-start-date';
  endInput.id = endInput.id || 'cadh-plan-end-date';
  startInput.dataset.dateLabel = 'Início';
  endInput.dataset.dateLabel = 'Fim';

  SISELO.enhanceDateInput(startInput, { min: '1900-01-01', max: maxPlanDate });
  SISELO.enhanceDateInput(endInput, { min: '1900-01-01', max: maxPlanDate });

  const syncCarePlanDates = () => {
    startInput.max = endInput.value || maxPlanDate;
    endInput.min = startInput.value && startInput.value > '1900-01-01' ? startInput.value : '1900-01-01';
    if (startInput.value && startInput.max && startInput.value > startInput.max) {
      startInput.value = startInput.max;
    }
    if (endInput.value && endInput.min && endInput.value < endInput.min) {
      endInput.value = endInput.min;
    }
    SISELO.syncEnhancedDateInput(startInput);
    SISELO.syncEnhancedDateInput(endInput);
  };

  startInput.addEventListener('change', syncCarePlanDates);
  endInput.addEventListener('change', syncCarePlanDates);
  syncCarePlanDates();
}

async function saveCadhCarePlanForm(patient, form) {
  const alert = document.getElementById('cadh-care-plan-alert');
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
    alert.className = 'alert';
  }

  const planId = SISELO.normalizeEntityId(form.dataset.planId);
  const endpoint = '/care_plans/form.php' + (planId ? `?id=${encodeURIComponent(planId)}` : '');
  const payload = objectFromFormData(new FormData(form));

  try {
    await SISELO.apiRequest(endpoint, {
      method: 'POST',
      body: payload,
    });
    await SISELO.refreshCachedPatientContext(patient.id);
    cadhClinicalContext = await SISELO.loadPatientClinicalContext(patient.id);
    const careSummary = buildCadhCareSummary(cadhClinicalContext, cadhPermissions);
    syncCadhPendingIndicators(careSummary && Array.isArray(careSummary.missingModules) ? careSummary.missingModules : []);
    await renderCadhCarePlanTab(patient, { success: 'Plano de cuidado salvo com sucesso.' });
  } catch (error) {
    if (alert) {
      alert.hidden = false;
      alert.className = 'alert alert-error';
      alert.textContent = error.message || 'Não foi possível salvar o plano de cuidado.';
    }
  }
}

function syncCadhCarePlanSortOrder(form) {
  form.querySelectorAll('input[name="sort_order[]"]').forEach((input, index) => {
    input.value = String(index + 1);
  });
}

function renderCadhEncountersTab(patient) {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail) return;

  const patientId = SISELO.normalizeEntityId(patient.id);
  const rows = getCadhEncounterRows();
  const canCreate = cadhPermissions.has('encounters.create');
  const canUpdate = cadhPermissions.has('encounters.update');
  const listHref = `/encounters/list.html?patient_id=${encodeURIComponent(patientId)}`;
  const createHref = `/encounters/form.html?patient_id=${encodeURIComponent(patientId)}`;

  detail.innerHTML = `
    <section class="cadh-inline-panel cadh-tab-screen cadh-encounters-screen">
      <div class="cadh-screen-header">
        <h3>Atendimentos &mdash; ${SISELO.escapeHtml(patient.full_name || '-')}</h3>
        <div class="cadh-screen-actions">
          <a class="btn" href="${SISELO.escapeHtml(listHref)}">Abrir lista</a>
          ${canCreate ? `<a class="btn btn-primary" href="${SISELO.escapeHtml(createHref)}">Novo atendimento</a>` : ''}
        </div>
      </div>

      <p class="cadh-guidance-alert">Cada especialidade possui roteiro de atendimento específico conforme o ciclo assistencial do CADH.</p>

      ${rows.length ? `
        <div class="cadh-encounter-list">
          ${rows.map((row) => renderCadhEncounterCard(row, { canUpdate })).join('')}
        </div>
        <p class="cadh-list-end-note">Nenhum outro atendimento registrado.</p>
      ` : `
        <div class="cadh-empty-module">
          <strong>Nenhum atendimento registrado.</strong>
          <p>Os registros criados nas especialidades do CADH aparecerão aqui para acompanhamento rápido.</p>
          ${canCreate ? `<a class="btn btn-primary" href="${SISELO.escapeHtml(createHref)}">Registrar atendimento</a>` : ''}
        </div>
      `}
    </section>
  `;
}

function renderCadhEncounterCard(row, options = {}) {
  const editHref = `/encounters/form.html?id=${encodeURIComponent(row.id)}&patient_id=${encodeURIComponent(cadhCurrentPatient.id)}`;
  const professional = formatCadhEncounterProfessional(row);
  return `
    <article class="cadh-encounter-card">
      <div class="cadh-encounter-card-copy">
        <strong>${SISELO.escapeHtml(row.specialty || 'Atendimento')}</strong>
        <span>${SISELO.escapeHtml(professional)}</span>
        <p>${SISELO.escapeHtml(row.summary || 'Sem resumo registrado.')}</p>
      </div>
      <div class="cadh-encounter-card-side">
        <time datetime="${SISELO.escapeHtml(row.encounter_date || '')}">${SISELO.escapeHtml(formatCadhDate(row.encounter_date))}</time>
        ${options.canUpdate ? `<a class="icon-btn" href="${editHref}" title="Editar atendimento" aria-label="Editar atendimento"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.3V20h2.7L18.9 7.8l-2.7-2.7L4 17.3Z"/><path d="m16.2 5.1 2.7 2.7"/></svg></a>` : ''}
      </div>
    </article>
  `;
}

function renderCadhTransitionTab(patient, options = {}) {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail) return;

  const patientId = SISELO.normalizeEntityId(patient.id);
  const canCreate = cadhPermissions.has('transitions.create');
  const listHref = `/transitions/list.html?patient_id=${encodeURIComponent(patientId)}`;
  const ubsOptions = getCadhUbsOptions(patient);
  const teamValue = normalizeCadhTeamValue(patient.team_ref);

  if (!canCreate) {
    detail.innerHTML = `
      <section class="cadh-inline-panel cadh-tab-screen">
        <div class="cadh-screen-header">
          <h3>Transição do Cuidado &mdash; ${SISELO.escapeHtml(patient.full_name || '-')}</h3>
          <div class="cadh-screen-actions">
            <a class="btn" href="${SISELO.escapeHtml(listHref)}">Abrir histórico</a>
          </div>
        </div>
        <p class="cadh-inline-empty">Você pode visualizar o histórico, mas não tem permissão para registrar uma nova transição nesta tela.</p>
      </section>
    `;
    return;
  }

  detail.innerHTML = `
    <section class="cadh-inline-panel cadh-tab-screen cadh-transition-screen">
      <div class="cadh-screen-header">
        <h3>Transição do Cuidado &mdash; ${SISELO.escapeHtml(patient.full_name || '-')}</h3>
        <div class="cadh-screen-actions">
          <a class="btn" href="${SISELO.escapeHtml(listHref)}">Abrir histórico</a>
        </div>
      </div>

      <div id="cadh-transition-alert" class="alert ${options.success ? 'alert-success' : ''}" ${options.success ? '' : 'hidden'}>${options.success ? SISELO.escapeHtml(options.success) : ''}</div>
      ${options.warning ? `<p class="cadh-inline-empty is-warning">${SISELO.escapeHtml(options.warning)}</p>` : ''}

      <p class="cadh-info-alert">A transição ocorre quando o usuário está estabilizado. A origem é sempre o <strong>CADH</strong>. Após o registro, o usuário será inativado no CADH e vinculado à equipe de referência da UBS quando o perfil tiver permissão para editar o cadastro.</p>

      <form id="cadh-transition-form" class="cadh-transition-form">
        <input type="hidden" name="patient_id" value="${SISELO.escapeHtml(patientId)}">
        <input type="hidden" name="transition_date" value="${SISELO.escapeHtml(SISELO.todayDateInputValue())}">
        <input type="hidden" name="status" value="concluida">

        <label class="cadh-transition-field">
          <span>Unidade de origem</span>
          <input name="from_service" value="${SISELO.escapeHtml(CADH_TRANSITION_ORIGIN)}" readonly>
        </label>

        <label class="cadh-transition-field">
          <span>UBS de destino *</span>
          <select name="destination_ubs" required>
            <option value="">Selecione a UBS...</option>
            ${ubsOptions.map((option) => `<option value="${SISELO.escapeHtml(option.value)}">${SISELO.escapeHtml(option.label)}</option>`).join('')}
          </select>
        </label>

        <label class="cadh-transition-field">
          <span>Equipe de Saúde da Família (ESF)</span>
          <select name="destination_team" data-preferred-team="${SISELO.escapeHtml(teamValue)}" disabled>
            <option value="">Selecione a eSF...</option>
            ${CADH_ESF_OPTIONS.map((option) => `<option value="${SISELO.escapeHtml(option.value)}">${SISELO.escapeHtml(option.label)}</option>`).join('')}
          </select>
        </label>

        <label class="cadh-transition-field is-wide">
          <span>Observações</span>
          <textarea name="notes" rows="4" placeholder="Observações sobre a transição..."></textarea>
        </label>

        <button class="cadh-transition-submit" type="submit" disabled>Registrar Transição do Cuidado</button>
      </form>
    </section>
  `;

  bindCadhTransitionForm(patient);
}

function bindCadhTransitionForm(patient) {
  const form = document.getElementById('cadh-transition-form');
  if (!form) return;

  const ubsSelect = form.elements.destination_ubs;
  const teamSelect = form.elements.destination_team;
  const submitButton = form.querySelector('.cadh-transition-submit');

  const syncTransitionFormState = () => {
    const hasUbs = Boolean(ubsSelect && ubsSelect.value);
    if (teamSelect instanceof HTMLSelectElement) {
      teamSelect.disabled = !hasUbs;
      if (!hasUbs) {
        teamSelect.value = '';
      } else if (!teamSelect.value) {
        teamSelect.value = teamSelect.dataset.preferredTeam || '';
      }
    }
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = !hasUbs;
    }
  };

  ubsSelect?.addEventListener('change', syncTransitionFormState);
  syncTransitionFormState();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveCadhTransitionForm(patient, form);
  });
}

async function saveCadhTransitionForm(patient, form) {
  const alert = document.getElementById('cadh-transition-alert');
  const ubsSelect = form.elements.destination_ubs;
  const teamSelect = form.elements.destination_team;
  const submitButton = form.querySelector('.cadh-transition-submit');
  const patientId = SISELO.normalizeEntityId(patient.id);
  const ubsLabel = getCadhSelectedOptionLabel(ubsSelect);
  const teamValue = teamSelect instanceof HTMLSelectElement ? teamSelect.value || 'sem_equipe' : 'sem_equipe';
  const teamLabel = teamValue && teamValue !== 'sem_equipe' ? getCadhSelectedOptionLabel(teamSelect) : '';

  setCadhInlineAlert(alert, '', 'info');

  if (!ubsLabel) {
    setCadhInlineAlert(alert, 'Selecione a UBS de destino antes de registrar a transição.', 'error');
    ubsSelect?.focus();
    return;
  }

  const payload = {
    patient_id: patientId,
    transition_date: SISELO.todayDateInputValue(),
    from_service: CADH_TRANSITION_ORIGIN,
    to_service: teamLabel ? `${ubsLabel} - ${teamLabel}` : ubsLabel,
    status: 'concluida',
    notes: String(form.elements.notes?.value || '').trim(),
  };

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';
  }

  try {
    await SISELO.apiRequest(`/transitions/form.php?patient_id=${encodeURIComponent(patientId)}`, {
      method: 'POST',
      body: payload,
    });

    const updateResult = await updateCadhPatientAfterTransition(patient, {
      ubsRef: ubsLabel,
      teamRef: teamValue,
    });

    await SISELO.refreshCachedPatientContext(patientId);
    cadhClinicalContext = await SISELO.loadPatientClinicalContext(patientId);
    if (cadhClinicalContext && cadhClinicalContext.patient) {
      cadhCurrentPatient = normalizeCadhPatient(cadhClinicalContext.patient);
      saveCadhSearchState(cadhCurrentPatient, cadhCurrentPatient.cpf);
      renderCadhSelectedPatientSummary(cadhCurrentPatient);
    }
    const careSummary = buildCadhCareSummary(cadhClinicalContext, cadhPermissions);
    syncCadhPendingIndicators(careSummary && Array.isArray(careSummary.missingModules) ? careSummary.missingModules : []);

    await renderCadhTransitionTab(cadhCurrentPatient || patient, {
      success: updateResult.updated
        ? 'Transição registrada e cadastro atualizado com sucesso.'
        : 'Transição registrada com sucesso.',
      warning: updateResult.warning || '',
    });
  } catch (error) {
    setCadhInlineAlert(alert, error.message || 'Não foi possível registrar a transição do cuidado.', 'error');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.textContent = 'Registrar Transição do Cuidado';
    }
  }
}

async function updateCadhPatientAfterTransition(patient, transitionData) {
  if (!cadhPermissions.has('patients.update')) {
    return {
      updated: false,
      warning: 'Transição salva. O cadastro do usuário não foi alterado porque este perfil não possui permissão de edição.',
    };
  }

  const patientId = SISELO.normalizeEntityId(patient.id);
  try {
    const context = await SISELO.apiRequest(`/patients/form.php?id=${encodeURIComponent(patientId)}`);
    const row = context && context.row ? context.row : patient;
    await SISELO.apiRequest(`/patients/form.php?id=${encodeURIComponent(patientId)}`, {
      method: 'POST',
      body: buildCadhPatientTransitionPayload(row, patient, transitionData),
    });
    return { updated: true, warning: '' };
  } catch (error) {
    return {
      updated: false,
      warning: error.message || 'Transição salva, mas não foi possível atualizar o cadastro do usuário automaticamente.',
    };
  }
}

function buildCadhPatientTransitionPayload(row, patient, transitionData) {
  const source = { ...(patient || {}), ...(row || {}) };
  const firstCadhDate = source.first_cadh_date || SISELO.todayDateInputValue();
  const teamRef = transitionData.teamRef || 'sem_equipe';

  return {
    first_cadh_date: firstCadhDate,
    attendance_date: firstCadhDate,
    full_name: source.full_name || '',
    ses: source.ses || '',
    cpf: source.cpf || '',
    birth_date: source.birth_date || '',
    sex: source.sex || source.gender || '',
    gender: source.sex || source.gender || '',
    race: source.race || '',
    responsible_name: source.responsible_name || source.responsible || '',
    responsible: source.responsible_name || source.responsible || '',
    phone: source.phone || '',
    address: source.address || '',
    email: source.email || '',
    emergency_contact: source.emergency_contact || '',
    allergies: source.allergies || '',
    chronic_conditions: source.chronic_conditions || '',
    status: 'inativo',
    ubs_ref: transitionData.ubsRef || '',
    uds_reference: transitionData.ubsRef || '',
    team_ref: teamRef,
    team_reference: teamRef,
  };
}

function renderCadhRecordsTab(config) {
  const detail = document.getElementById('cadh-patient-detail');
  if (!detail || !cadhCurrentPatient) return;

  const rows = Array.isArray(config.rows) ? config.rows : [];
  detail.innerHTML = `
    <section class="cadh-inline-panel">
      <div class="cadh-inline-panel-header">
        <h3>${SISELO.escapeHtml(config.title)} - ${SISELO.escapeHtml(cadhCurrentPatient.full_name || '-')}</h3>
        <div class="cadh-inline-actions">
          <a class="btn" href="${SISELO.escapeHtml(config.listHref)}">Abrir lista</a>
          ${cadhPermissions.has(config.createPermission) ? `<a class="btn btn-primary" href="${SISELO.escapeHtml(config.createHref)}">Novo registro</a>` : ''}
        </div>
      </div>
      ${rows.length ? `
        <div class="cadh-record-list">
          ${rows.map((row) => config.renderRow(row, config)).join('')}
        </div>
      ` : `<p class="cadh-inline-empty">${SISELO.escapeHtml(config.emptyText)}</p>`}
    </section>
  `;
}

function renderCadhEncounterRecord(row, config) {
  const editHref = `/encounters/form.html?id=${encodeURIComponent(row.id)}&patient_id=${encodeURIComponent(cadhCurrentPatient.id)}`;
  return `
    <article class="cadh-record-card">
      <div>
        <strong>${SISELO.escapeHtml(row.specialty || 'Atendimento')}</strong>
        <span>${SISELO.escapeHtml(formatCadhDate(row.encounter_date))}</span>
        <p>${SISELO.escapeHtml(row.summary || 'Sem resumo registrado.')}</p>
      </div>
      ${cadhPermissions.has(config.updatePermission) ? `<a class="icon-btn" href="${editHref}" title="Editar atendimento" aria-label="Editar atendimento"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.3V20h2.7L18.9 7.8l-2.7-2.7L4 17.3Z"/><path d="m16.2 5.1 2.7 2.7"/></svg></a>` : ''}
    </article>
  `;
}

function renderCadhTransitionRecord(row, config) {
  const editHref = `/transitions/form.html?id=${encodeURIComponent(row.id)}&patient_id=${encodeURIComponent(cadhCurrentPatient.id)}`;
  return `
    <article class="cadh-record-card">
      <div>
        <strong>${SISELO.escapeHtml(row.status_label || row.status || 'Transição')}</strong>
        <span>${SISELO.escapeHtml(formatCadhDate(row.transition_date))}</span>
        <p>${SISELO.escapeHtml(row.from_service || '-')} -> ${SISELO.escapeHtml(row.to_service || '-')}</p>
      </div>
      ${cadhPermissions.has(config.updatePermission) ? `<a class="icon-btn" href="${editHref}" title="Editar transição" aria-label="Editar transição"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.3V20h2.7L18.9 7.8l-2.7-2.7L4 17.3Z"/><path d="m16.2 5.1 2.7 2.7"/></svg></a>` : ''}
    </article>
  `;
}

function getCadhEncounterRows() {
  const rows = Array.isArray(cadhClinicalContext && cadhClinicalContext.encounters)
    ? cadhClinicalContext.encounters
    : [];
  return [...rows].sort((first, second) => compareCadhDateDesc(first.encounter_date, second.encounter_date));
}

function compareCadhDateDesc(firstValue, secondValue) {
  const firstDate = SISELO.parseDateInputValue(firstValue);
  const secondDate = SISELO.parseDateInputValue(secondValue);
  const firstTime = firstDate ? firstDate.getTime() : 0;
  const secondTime = secondDate ? secondDate.getTime() : 0;
  return secondTime - firstTime;
}

function formatCadhEncounterProfessional(row) {
  return row.professional_name ||
    row.professional ||
    row.created_by_name ||
    row.responsible_professional ||
    'Equipe CADH';
}

function getCadhUbsOptions(patient) {
  const labels = [];
  const addLabel = (value) => {
    const label = String(value || '').trim();
    if (!label || normalizeCadhText(label) === 'sem equipe') {
      return;
    }
    if (!labels.some((item) => normalizeCadhText(item) === normalizeCadhText(label))) {
      labels.push(label);
    }
  };

  addLabel(patient && patient.ubs_ref);
  (Array.isArray(cadhClinicalContext && cadhClinicalContext.transitions) ? cadhClinicalContext.transitions : [])
    .forEach((row) => {
      const destination = String(row.to_service || '').split(' - ')[0];
      if (normalizeCadhText(destination).includes('ubs')) {
        addLabel(destination);
      }
    });
  CADH_DEFAULT_UBS_OPTIONS.forEach(addLabel);

  return labels.map((label) => ({ value: label, label }));
}

function normalizeCadhTeamValue(value) {
  const normalized = normalizeCadhText(value).replace(/\s+/g, '_');
  if (normalized.includes('safira')) return 'safira';
  if (normalized.includes('ametista')) return 'ametista';
  if (normalized.includes('esmeralda')) return 'esmeralda';
  if (normalized.includes('diamante')) return 'diamante';
  return 'sem_equipe';
}

function getCadhSelectedOptionLabel(select) {
  if (!(select instanceof HTMLSelectElement) || !select.value) {
    return '';
  }
  const option = select.selectedOptions && select.selectedOptions[0];
  return option ? String(option.textContent || '').trim() : String(select.value || '').trim();
}

function setCadhInlineAlert(element, message, type = 'info') {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (!message) {
    element.hidden = true;
    element.textContent = '';
    element.className = 'alert';
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.className = `alert alert-${type || 'info'}`;
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

function normalizeCadhPatient(patient) {
  const source = patient || {};
  return {
    id: SISELO.normalizeEntityId(source.id),
    full_name: source.full_name || '',
    ses: source.ses || '',
    cpf: source.cpf || '',
    team_ref: source.team_ref || '',
    birth_date: source.birth_date || '',
    first_cadh_date: source.first_cadh_date || '',
    age_label: source.age_label || '',
    race: source.race || '',
    sex: source.sex || source.gender_label || '',
    phone: source.phone || '',
    address: source.address || '',
    email: source.email || source.contact_email || '',
    allergies: source.allergies || '',
    chronic_conditions: source.chronic_conditions || '',
    status: source.status || '',
    status_label: source.status_label || '',
    ubs_ref: source.ubs_ref || '',
    responsible_name: source.responsible_name || '',
    emergency_contact: source.emergency_contact || '',
  };
}

function renderCadhDefinition(label, value, options = {}) {
  const normalizedValue = value === null || value === undefined || value === '' ? '-' : value;
  return `
    <div>
      <dt>${SISELO.escapeHtml(label)}</dt>
      <dd class="${options.strongClass || ''}">${SISELO.escapeHtml(normalizedValue)}</dd>
    </div>
  `;
}

function objectFromFormData(formData) {
  const payload = {};
  formData.forEach((value, key) => {
    if (key.endsWith('[]')) {
      const cleanKey = key.slice(0, -2);
      if (!payload[cleanKey]) {
        payload[cleanKey] = [];
      }
      payload[cleanKey].push(value);
      return;
    }

    payload[key] = value;
  });
  return payload;
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
    branca: 'Branca',
    preta: 'Preta',
    parda: 'Parda',
    amarela: 'Amarela',
    indigena: 'Indígena',
    nao_informado: 'Não informado',
  };
  const key = String(value || '').trim().toLowerCase();
  return labels[key] || value || '-';
}

function formatCadhSex(value) {
  const labels = {
    masculino: 'Masculino',
    feminino: 'Feminino',
    outro: 'Outro',
  };
  const key = String(value || '').trim().toLowerCase();
  return labels[key] || value || '-';
}

function formatCadhTeamName(value) {
  return SISELO.formatTeamName(value);
}

function normalizeCadhText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
