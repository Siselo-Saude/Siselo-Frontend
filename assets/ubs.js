const UBS_FOLLOWUP_KEY = 'siselo_ubs_followups';

const UBS_PROFESSIONAL_OPTIONS = [
  'Médico de Família e Comunidade',
  'Enfermeiro',
  'Técnico de Enfermagem',
  'EMUT',
  'Farmácia Clínica',
];

const UBS_CARE_TYPE_OPTIONS = [
  'Consulta',
  'Visita Domiciliar',
  'Acolhimento',
  'Monitoramento',
  'Revisão Farmacoterapêutica',
];

const UBS_STATUS_OPTIONS = [
  'Em Monitoramento',
  'Estável',
  'Necessita Reavaliação',
  'Alta',
];

let ubsPermissions = new Set();
let ubsTransitions = [];
let ubsFollowups = [];
let ubsActiveTab = 'transitioned';
let ubsFiltersOpen = false;
let ubsFollowupFormOpen = false;
let ubsSelectedTransitionId = '';
let ubsFilterState = {
  query: '',
  ubs: '',
  team: '',
  month: '',
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'ubs') {
    return;
  }

  setupUbsPage();
});

async function setupUbsPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  ubsPermissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('ubs');
  setupUbsHeaderDate();
  setupUbsSidebar(user);

  ubsFollowups = readUbsFollowups();
  await loadUbsTransitions();

  bindUbsTabs();
  updateUbsMetrics();
  activateUbsTab('transitioned');
}

function setupUbsHeaderDate() {
  const dateElement = document.getElementById('ubs-current-date');
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(now);
  };

  updateCurrentDate();
  window.setInterval(updateCurrentDate, 60 * 1000);
}

function setupUbsSidebar(user) {
  const sidebarToggle = document.getElementById('ubs-sidebar-toggle');
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

async function loadUbsTransitions() {
  try {
    const data = await SISELO.apiRequest('/transitions/list.php');
    ubsTransitions = (Array.isArray(data.rows) ? data.rows : [])
      .filter((row) => normalizeUbsText(row.status) !== 'cancelada')
      .sort((first, second) => compareUbsDateDesc(first.transition_date, second.transition_date));
  } catch (error) {
    ubsTransitions = [];
  }
}

function bindUbsTabs() {
  document.querySelectorAll('[data-ubs-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activateUbsTab(button.dataset.ubsTab || 'transitioned');
    });
  });
}

function activateUbsTab(tabKey) {
  ubsActiveTab = ['transitioned', 'followup', 'next'].includes(tabKey) ? tabKey : 'transitioned';

  document.querySelectorAll('[data-ubs-tab]').forEach((button) => {
    const isActive = button.dataset.ubsTab === ubsActiveTab;
    button.classList.toggle('active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (ubsActiveTab === 'followup') {
    renderUbsFollowupTab();
    return;
  }

  if (ubsActiveTab === 'next') {
    renderUbsNextContactsTab();
    return;
  }

  renderUbsTransitionedTab();
}

function renderUbsTransitionedTab() {
  const panel = document.getElementById('ubs-tab-panel');
  if (!panel) return;

  const rows = getFilteredUbsTransitions();
  const ubsOptions = getUbsDestinationOptions();
  const activeFilters = getUbsActiveFilterCount();

  panel.innerHTML = `
    <div class="ubs-toolbar">
      <label class="ubs-search-shell">
        <span class="search-input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
        <input id="ubs-transition-search" placeholder="Buscar por nome ou CPF..." value="${SISELO.escapeHtml(ubsFilterState.query)}">
      </label>
      <button id="ubs-filter-toggle" class="ubs-filter-button" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ubs-icon-filter"></use></svg>
        Filtros${activeFilters ? ` (${activeFilters})` : ''}
      </button>
      ${activeFilters ? '<button id="ubs-filter-clear" class="ubs-filter-clear" type="button">× Limpar</button>' : ''}
    </div>

    <div id="ubs-filter-panel" class="ubs-filter-panel" ${ubsFiltersOpen || activeFilters ? '' : 'hidden'}>
      <label>
        <span>UBS de destino</span>
        <select id="ubs-filter-destination">
          <option value="">Todas</option>
          ${ubsOptions.map((option) => `<option value="${SISELO.escapeHtml(option)}" ${ubsFilterState.ubs === option ? 'selected' : ''}>${SISELO.escapeHtml(option)}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>ESF / Equipe</span>
        <input id="ubs-filter-team" placeholder="Filtrar por equipe..." value="${SISELO.escapeHtml(ubsFilterState.team)}">
      </label>
      <label>
        <span>Período (mês)</span>
        <input id="ubs-filter-month" type="month" value="${SISELO.escapeHtml(ubsFilterState.month)}">
      </label>
    </div>

    <div class="ubs-table-card">
      ${rows.length ? renderUbsTransitionedTable(rows) : renderUbsEmptyState('transition', 'Nenhuma transição do cuidado registrada.', 'Ajuste os filtros ou registre uma transição no CADH.')}
    </div>
  `;

  bindUbsTransitionedControls();
}

function renderUbsTransitionedTable(rows) {
  return `
    <table class="ubs-table">
      <thead>
        <tr>
          <th>Usuário</th>
          <th>UBS / ESF</th>
          <th>Transição</th>
          <th>Acompanhamentos</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const destination = parseUbsDestination(row);
          const count = getUbsFollowupsForTransition(row).length;
          return `
            <tr>
              <td>
                <strong>${SISELO.escapeHtml(row.full_name || 'Usuário sem nome')}</strong>
                <small>${SISELO.escapeHtml(row.cpf || '')}</small>
              </td>
              <td>
                <strong>${SISELO.escapeHtml(destination.ubs || '—')}</strong>
                <small>${SISELO.escapeHtml(destination.esf || row.notes || '')}</small>
              </td>
              <td>${SISELO.escapeHtml(formatUbsDate(row.transition_date))}</td>
              <td>${renderUbsCountBadge(count)}</td>
              <td><button class="ubs-row-action" type="button" data-ubs-follow="${SISELO.escapeHtml(row.id)}">Acompanhar</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function bindUbsTransitionedControls() {
  const searchInput = document.getElementById('ubs-transition-search');
  searchInput?.addEventListener('input', () => {
    ubsFilterState.query = searchInput.value;
    renderUbsTransitionedTab();
  });

  document.getElementById('ubs-filter-toggle')?.addEventListener('click', () => {
    ubsFiltersOpen = !ubsFiltersOpen;
    renderUbsTransitionedTab();
  });

  document.getElementById('ubs-filter-clear')?.addEventListener('click', () => {
    ubsFilterState = { query: '', ubs: '', team: '', month: '' };
    ubsFiltersOpen = false;
    renderUbsTransitionedTab();
  });

  document.getElementById('ubs-filter-destination')?.addEventListener('change', (event) => {
    ubsFilterState.ubs = event.currentTarget.value;
    renderUbsTransitionedTab();
  });

  document.getElementById('ubs-filter-team')?.addEventListener('input', (event) => {
    ubsFilterState.team = event.currentTarget.value;
    renderUbsTransitionedTab();
  });

  document.getElementById('ubs-filter-month')?.addEventListener('change', (event) => {
    ubsFilterState.month = event.currentTarget.value;
    renderUbsTransitionedTab();
  });

  document.querySelectorAll('[data-ubs-follow]').forEach((button) => {
    button.addEventListener('click', () => {
      ubsSelectedTransitionId = button.dataset.ubsFollow || '';
      ubsFollowupFormOpen = true;
      activateUbsTab('followup');
    });
  });
}

function renderUbsFollowupTab() {
  const panel = document.getElementById('ubs-tab-panel');
  if (!panel) return;

  const selected = getSelectedUbsTransition();
  const records = selected ? getUbsFollowupsForTransition(selected) : [];

  panel.innerHTML = `
    <div class="ubs-followup-toolbar">
      <select id="ubs-followup-patient">
        <option value="">— Selecione o usuário —</option>
        ${ubsTransitions.map((row) => {
          const destination = parseUbsDestination(row);
          const label = `${row.full_name || 'Usuário sem nome'} · ${destination.ubs || 'Sem UBS'}`;
          return `<option value="${SISELO.escapeHtml(row.id)}" ${String(row.id) === String(ubsSelectedTransitionId) ? 'selected' : ''}>${SISELO.escapeHtml(label)}</option>`;
        }).join('')}
      </select>
      <button id="ubs-followup-new" class="btn btn-primary" type="button" ${selected ? '' : 'disabled'}>+ Novo Registro</button>
    </div>

    ${selected && ubsFollowupFormOpen ? renderUbsFollowupForm(selected) : ''}
    ${selected ? renderUbsFollowupList(records) : renderUbsEmptyState('users', 'Selecione um usuário para ver o histórico de acompanhamento.', '')}
  `;

  bindUbsFollowupControls();
}

function renderUbsFollowupForm(transition) {
  return `
    <form id="ubs-followup-form" class="ubs-followup-form">
      <h3>Registrar Acompanhamento &mdash; ${SISELO.escapeHtml(transition.full_name || '-')}</h3>
      <div class="ubs-followup-grid">
        ${renderUbsSelectField('professional', 'Profissional *', UBS_PROFESSIONAL_OPTIONS, '')}
        ${renderUbsSelectField('care_type', 'Tipo de atendimento', UBS_CARE_TYPE_OPTIONS, '')}
        <label>
          <span>Data</span>
          <input name="date" type="date" value="${SISELO.escapeHtml(SISELO.todayDateInputValue())}">
        </label>
        ${renderUbsSelectField('status', 'Status', UBS_STATUS_OPTIONS, 'Em Monitoramento')}
        <label>
          <span>Conduta definida</span>
          <textarea name="conduct" rows="2" placeholder="Conduta definida pela equipe..."></textarea>
        </label>
        <label>
          <span>Evolução / Observações</span>
          <textarea name="evolution" rows="2" placeholder="Evolução clínica e observações..."></textarea>
        </label>
        <label class="is-short">
          <span>Próximo contato</span>
          <input name="next_contact" type="date" placeholder="dd/mm/aaaa">
        </label>
      </div>
      <div class="ubs-followup-actions">
        <button class="btn btn-primary" type="submit">Salvar Registro</button>
        <button id="ubs-followup-cancel" class="btn" type="button">Cancelar</button>
      </div>
    </form>
  `;
}

function renderUbsSelectField(name, label, options, currentValue) {
  return `
    <label>
      <span>${SISELO.escapeHtml(label)}</span>
      <select name="${SISELO.escapeHtml(name)}" ${label.includes('*') ? 'required' : ''}>
        <option value="">Selecione...</option>
        ${options.map((option) => `<option value="${SISELO.escapeHtml(option)}" ${option === currentValue ? 'selected' : ''}>${SISELO.escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderUbsFollowupList(records) {
  if (!records.length) {
    return renderUbsEmptyState('file', 'Nenhum acompanhamento registrado.', '');
  }

  return `
    <div class="ubs-followup-list">
      ${records.map((record) => `
        <article class="ubs-followup-card">
          <div>
            <span class="ubs-chip is-green">${SISELO.escapeHtml(record.professional || '-')}</span>
            <span class="ubs-chip">${SISELO.escapeHtml(record.care_type || '-')}</span>
            <span class="ubs-chip ${getUbsStatusChipClass(record.status)}">${SISELO.escapeHtml(record.status || '-')}</span>
          </div>
          <time datetime="${SISELO.escapeHtml(record.date || '')}">${SISELO.escapeHtml(formatUbsDate(record.date))}</time>
          <strong>Conduta: ${SISELO.escapeHtml(record.conduct || '-')}</strong>
          <p>${SISELO.escapeHtml(record.evolution || '')}</p>
          ${record.next_contact ? `<small>Próximo contato: ${SISELO.escapeHtml(formatUbsDate(record.next_contact))}</small>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function bindUbsFollowupControls() {
  document.getElementById('ubs-followup-patient')?.addEventListener('change', (event) => {
    ubsSelectedTransitionId = event.currentTarget.value;
    ubsFollowupFormOpen = false;
    renderUbsFollowupTab();
  });

  document.getElementById('ubs-followup-new')?.addEventListener('click', () => {
    ubsFollowupFormOpen = true;
    renderUbsFollowupTab();
  });

  document.getElementById('ubs-followup-cancel')?.addEventListener('click', () => {
    ubsFollowupFormOpen = false;
    renderUbsFollowupTab();
  });

  document.getElementById('ubs-followup-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveUbsFollowup(new FormData(event.currentTarget));
  });
}

function saveUbsFollowup(formData) {
  const selected = getSelectedUbsTransition();
  if (!selected) return;

  const record = {
    id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
    transition_id: String(selected.id || ''),
    patient_id: String(selected.patient_id || ''),
    full_name: selected.full_name || '',
    cpf: selected.cpf || '',
    destination: parseUbsDestination(selected).ubs,
    professional: String(formData.get('professional') || ''),
    care_type: String(formData.get('care_type') || ''),
    date: String(formData.get('date') || SISELO.todayDateInputValue()),
    status: String(formData.get('status') || 'Em Monitoramento'),
    conduct: String(formData.get('conduct') || '').trim(),
    evolution: String(formData.get('evolution') || '').trim(),
    next_contact: String(formData.get('next_contact') || ''),
    created_at: new Date().toISOString(),
  };

  ubsFollowups.unshift(record);
  writeUbsFollowups();
  ubsFollowupFormOpen = false;
  updateUbsMetrics();
  renderUbsFollowupTab();
}

function renderUbsNextContactsTab() {
  const panel = document.getElementById('ubs-tab-panel');
  if (!panel) return;

  const records = getUbsNextContacts();
  panel.innerHTML = records.length ? `
    <div class="ubs-followup-list ubs-next-list">
      ${records.map((record) => `
        <article class="ubs-followup-card">
          <div>
            <span class="ubs-chip is-green">${SISELO.escapeHtml(record.full_name || '-')}</span>
            <span class="ubs-chip">${SISELO.escapeHtml(record.professional || '-')}</span>
          </div>
          <time datetime="${SISELO.escapeHtml(record.next_contact || '')}">${SISELO.escapeHtml(formatUbsDate(record.next_contact))}</time>
          <strong>${SISELO.escapeHtml(record.care_type || 'Acompanhamento')}</strong>
          <p>${SISELO.escapeHtml(record.evolution || record.conduct || 'Contato agendado para acompanhamento.')}</p>
        </article>
      `).join('')}
    </div>
  ` : renderUbsEmptyState('calendar', 'Nenhum contato agendado nos próximos 30 dias.', 'Registre um próximo contato ao adicionar um acompanhamento.');
}

function getFilteredUbsTransitions() {
  const search = SISELO.createSearchState(ubsFilterState.query);
  const teamSearch = SISELO.createSearchState(ubsFilterState.team);

  return ubsTransitions.filter((row) => {
    const destination = parseUbsDestination(row);
    const matchesQuery = search.hasLetters || search.hasDigits
      ? SISELO.matchesPersonNamePrefix(row.full_name, search) ||
        SISELO.matchesSearchDigits(row.cpf, search) ||
        SISELO.matchesSearchText(destination.ubs, search) ||
        SISELO.matchesSearchText(destination.esf, search)
      : true;
    const matchesUbs = ubsFilterState.ubs
      ? normalizeUbsText(destination.ubs) === normalizeUbsText(ubsFilterState.ubs)
      : true;
    const matchesTeam = teamSearch.hasLetters || teamSearch.hasDigits
      ? SISELO.matchesSearchText(destination.esf || row.team_ref, teamSearch)
      : true;
    const matchesMonth = ubsFilterState.month
      ? String(row.transition_date || '').startsWith(ubsFilterState.month)
      : true;

    return matchesQuery && matchesUbs && matchesTeam && matchesMonth;
  });
}

function getUbsDestinationOptions() {
  const options = [];
  ubsTransitions.forEach((row) => {
    const destination = parseUbsDestination(row).ubs;
    if (destination && !options.some((option) => normalizeUbsText(option) === normalizeUbsText(destination))) {
      options.push(destination);
    }
  });
  return options.sort((first, second) => first.localeCompare(second, 'pt-BR'));
}

function parseUbsDestination(row) {
  const rawDestination = String(row && row.to_service || '').trim();
  const parts = rawDestination.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  return {
    ubs: parts[0] || rawDestination || '',
    esf: parts.slice(1).join(' - ') || SISELO.formatTeamName(row && row.team_ref),
  };
}

function getSelectedUbsTransition() {
  return ubsTransitions.find((row) => String(row.id) === String(ubsSelectedTransitionId)) || null;
}

function getUbsFollowupsForTransition(row) {
  return ubsFollowups
    .filter((record) => String(record.transition_id) === String(row.id))
    .sort((first, second) => compareUbsDateDesc(first.date, second.date));
}

function getUbsNextContacts() {
  const today = SISELO.parseDateInputValue(SISELO.todayDateInputValue());
  const limit = new Date(today.getTime());
  limit.setDate(limit.getDate() + 30);

  return ubsFollowups
    .filter((record) => {
      const date = SISELO.parseDateInputValue(record.next_contact);
      return date && date >= today && date <= limit;
    })
    .sort((first, second) => compareUbsDateAsc(first.next_contact, second.next_contact));
}

function updateUbsMetrics() {
  setUbsMetric('ubs-metric-transitioned', ubsTransitions.length);
  setUbsMetric('ubs-metric-followups', ubsFollowups.length);
  setUbsMetric('ubs-metric-next', getUbsNextContacts().length);
}

function setUbsMetric(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value);
  }
}

function renderUbsCountBadge(count) {
  const label = count === 1 ? '1 registro' : `${count} registros`;
  return `<span class="ubs-count-badge ${count ? 'has-records' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${label}</span>`;
}

function renderUbsEmptyState(icon, title, description) {
  const symbol = icon === 'calendar' ? '#ubs-icon-calendar' : icon === 'transition' ? '#ubs-icon-transition' : '#ubs-icon-empty';
  return `
    <div class="ubs-empty-state">
      <span aria-hidden="true"><svg viewBox="0 0 24 24"><use href="${symbol}"></use></svg></span>
      <strong>${SISELO.escapeHtml(title)}</strong>
      ${description ? `<p>${SISELO.escapeHtml(description)}</p>` : ''}
    </div>
  `;
}

function getUbsActiveFilterCount() {
  return ['ubs', 'team', 'month'].reduce((total, key) => total + (ubsFilterState[key] ? 1 : 0), 0);
}

function getUbsStatusChipClass(status) {
  const normalized = normalizeUbsText(status);
  if (normalized.includes('reavaliacao')) return 'is-orange';
  if (normalized.includes('alta') || normalized.includes('estavel')) return 'is-green';
  return '';
}

function readUbsFollowups() {
  try {
    const rows = JSON.parse(localStorage.getItem(UBS_FOLLOWUP_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return [];
  }
}

function writeUbsFollowups() {
  try {
    localStorage.setItem(UBS_FOLLOWUP_KEY, JSON.stringify(ubsFollowups));
  } catch (error) {
  }
}

function compareUbsDateDesc(firstValue, secondValue) {
  return getUbsDateTime(secondValue) - getUbsDateTime(firstValue);
}

function compareUbsDateAsc(firstValue, secondValue) {
  return getUbsDateTime(firstValue) - getUbsDateTime(secondValue);
}

function getUbsDateTime(value) {
  const date = SISELO.parseDateInputValue(value);
  return date ? date.getTime() : 0;
}

function formatUbsDate(value) {
  const date = SISELO.parseDateInputValue(value);
  return date ? new Intl.DateTimeFormat('pt-BR').format(date) : value || '—';
}

function normalizeUbsText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
