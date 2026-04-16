document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'transitions-list') setupTransitionsListPage();
  if (page === 'transitions-form') setupTransitionFormPage();
  if (page === 'transitions-trash') setupTransitionsTrashPage();
});

async function setupTransitionsListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('transitions');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-transition-link').hidden = !permissions.has('transitions.create');
  document.getElementById('trash-link').hidden = !permissions.has('transitions.restore');

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/transitions/list.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('transitions-table-body');
  renderTransitionsTable(tbody, rows, permissions);
  bindTransitionListActions(tbody);

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/transitions/list.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

async function setupTransitionFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('transitions');
  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  const endpoint = '/transitions/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  let data = getEmptyTransitionContext(patientId);
  let loadError = null;

  try {
    data = await SISELO.apiRequest(endpoint || '/transitions/form.php');
  } catch (error) {
    loadError = error;
  }

  if (id && (loadError || !data || !data.row)) {
    document.getElementById('form-title').textContent = 'Editar Transicao';
    SISELO.showAlert(
      'page-alert',
      loadError && loadError.message
        ? loadError.message
        : 'Nao foi possivel carregar a transicao selecionada.',
      'error'
    );
    disableTransitionForm();
    return;
  }

  const row = data.row || getEmptyTransitionContext(patientId).row;
  document.getElementById('form-title').textContent = id || data.editing ? 'Editar Transicao' : 'Nova Transicao';
  fillTransitionPatientSelect(Array.isArray(data.patients) ? data.patients : [], row.patient_id);
  fillTransitionStatusSelect(Array.isArray(data.statuses) && data.statuses.length ? data.statuses : getDefaultTransitionStatuses(), row.status);
  document.getElementById('transition_date').value = row.transition_date || '';
  document.getElementById('from_service').value = row.from_service || '';
  document.getElementById('to_service').value = row.to_service || '';
  document.getElementById('notes').value = row.notes || '';
  configureTransitionDateInput();

  document.getElementById('transition-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!SISELO.validateEnhancedDateInputs(event.currentTarget, { alertId: 'page-alert' })) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint || '/transitions/form.php', {
        method: 'POST',
        body: Object.fromEntries(formData.entries()),
      });
      location.href = '/transitions/list.html';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}

async function setupTransitionsTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('transitions');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/transitions/trash.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('transitions-table-body');
  renderTransitionsTrashTable(tbody, rows);
  bindTransitionTrashActions(tbody);

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/transitions/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

function renderTransitionsTable(tbody, rows, permissions) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">Nenhuma transicao carregada.</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconLink('view', '/patients/show.html?id=0&tab=transicoes', 'Paciente 360')}
            ${permissions.has('transitions.update') ? SISELO.iconButton('edit', 'Editar transicao', { 'data-empty-edit': true }) : ''}
            ${permissions.has('transitions.delete') ? SISELO.iconButton('delete', 'Apagar transicao', { 'data-empty-delete': true }) : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${renderTransitionCellDate(row.transition_date)}</td>
      <td><span class="patient-name">${SISELO.escapeHtml(row.full_name || '-')}</span></td>
      <td>${renderTransitionCellValue(row.ses)}</td>
      <td>${renderTransitionCellValue(row.cpf)}</td>
      <td>${renderTransitionRoute(row)}</td>
      <td>${renderTransitionStatusBadge(row.status)}</td>
      <td>
        <div class="table-actions">
          ${renderTransitionViewAction(row)}
          ${renderTransitionEditAction(row, permissions)}
          ${renderTransitionDeleteAction(row, permissions)}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTransitionsTrashTable(tbody, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">Nenhuma transicao na lixeira.</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconButton('restore', 'Restaurar transicao', { 'data-empty-restore': true })}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${renderTransitionCellValue(row.deleted_at)}</td>
      <td>${renderTransitionCellDate(row.transition_date)}</td>
      <td><span class="patient-name">${SISELO.escapeHtml(row.full_name || '-')}</span></td>
      <td>${renderTransitionCellValue(row.ses)}</td>
      <td>${renderTransitionCellValue(row.cpf)}</td>
      <td>${renderTransitionRoute(row)}</td>
      <td>${renderTransitionStatusBadge(row.status)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton('restore', 'Restaurar transicao', { 'data-restore-id': row.id })}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTransitionCellValue(value) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue ? SISELO.escapeHtml(normalizedValue) : '<span class="muted">-</span>';
}

function renderTransitionCellDate(value) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '<span class="muted">-</span>';
  }

  const parsedDate = SISELO.parseDateInputValue(normalizedValue);
  if (!parsedDate) {
    return SISELO.escapeHtml(normalizedValue);
  }

  return SISELO.escapeHtml(new Intl.DateTimeFormat('pt-BR').format(parsedDate));
}

function renderTransitionRoute(row) {
  const origin = String(row.from_service || '').trim();
  const destination = String(row.to_service || '').trim();

  if (!origin && !destination) {
    return '<span class="muted">-</span>';
  }

  return `
    <span class="transition-route">
      <span>${SISELO.escapeHtml(origin || '-')}</span>
      <span aria-hidden="true">&rarr;</span>
      <span>${SISELO.escapeHtml(destination || '-')}</span>
    </span>
  `;
}

function renderTransitionStatusBadge(status) {
  const config = getTransitionStatusConfig(status);
  return `<span class="status-badge status-badge-${config.kind}">${SISELO.escapeHtml(config.label)}</span>`;
}

function renderTransitionViewAction(row) {
  return SISELO.iconLink('view', `/patients/show.html?id=${row.patient_id}&tab=transicoes`, 'Paciente 360');
}

function renderTransitionEditAction(row, permissions) {
  if (!permissions.has('transitions.update')) {
    return '';
  }

  const id = SISELO.normalizeEntityId(row && row.id);
  if (!id) {
    return SISELO.iconButton('edit', 'Editar transicao', { 'data-empty-edit': true });
  }

  return SISELO.iconLink('edit', `/transitions/form.html?id=${encodeURIComponent(id)}`, 'Editar transicao');
}

function renderTransitionDeleteAction(row, permissions) {
  if (!permissions.has('transitions.delete')) {
    return '';
  }

  return SISELO.iconButton('delete', 'Apagar transicao', {
    'data-delete-id': row.id,
    'data-delete-label': row.full_name || '',
  });
}

function getTransitionStatusConfig(status) {
  const rawStatus = String(status || '').trim();
  const normalizedStatus = rawStatus
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['concluida', 'concluido'].includes(normalizedStatus)) {
    return { kind: 'done', label: 'Concluido' };
  }

  if (['em_andamento', 'andamento'].includes(normalizedStatus)) {
    return { kind: 'progress', label: 'Em andamento' };
  }

  if (normalizedStatus === 'pendente') {
    return { kind: 'pending', label: 'Pendente' };
  }

  if (['cancelada', 'cancelado'].includes(normalizedStatus)) {
    return { kind: 'canceled', label: 'Cancelada' };
  }

  return { kind: 'neutral', label: rawStatus || '-' };
}

function bindTransitionListActions(tbody) {
  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!SISELO.confirmDeletion('a transicao de', button.dataset.deleteLabel)) return;

      try {
        await SISELO.apiRequest('/transitions/soft_delete.php', {
          method: 'POST',
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(error.message || 'Nao foi possivel apagar a transicao.');
      }
    });
  });

  tbody.querySelectorAll('[data-empty-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha transicao carregada para apagar.');
    });
  });

  tbody.querySelectorAll('[data-empty-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha transicao carregada para editar.');
    });
  });
}

function bindTransitionTrashActions(tbody) {
  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/transitions/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  tbody.querySelectorAll('[data-empty-restore]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha transicao carregada para restaurar.');
    });
  });
}

function getEmptyTransitionContext(patientId) {
  return {
    editing: false,
    row: {
      patient_id: patientId || '',
      transition_date: '',
      from_service: '',
      to_service: '',
      status: 'pendente',
      notes: '',
    },
    patients: [],
    statuses: getDefaultTransitionStatuses(),
  };
}

function getDefaultTransitionStatuses() {
  return ['pendente', 'em_andamento', 'concluida', 'cancelada'];
}

function disableTransitionForm() {
  const form = document.getElementById('transition-form');
  if (!form) {
    return;
  }

  form.querySelectorAll('input, select, textarea, button').forEach((field) => {
    field.disabled = true;
  });
}

function fillTransitionPatientSelect(patients, currentValue) {
  const select = document.getElementById('patient_id');
  select.innerHTML = '<option value="">-- selecione --</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)} (CPF: ${SISELO.escapeHtml(patient.cpf)} | SES: ${SISELO.escapeHtml(patient.ses)})
    </option>
  `).join('');
}

function fillTransitionStatusSelect(statuses, currentValue) {
  const select = document.getElementById('status');
  select.innerHTML = (statuses || []).map((status) => `
    <option value="${SISELO.escapeHtml(status)}" ${String(currentValue || '') === String(status) ? 'selected' : ''}>${SISELO.escapeHtml(getTransitionStatusConfig(status).label)}</option>
  `).join('');
}

function configureTransitionDateInput() {
  const today = SISELO.todayDateInputValue();
  const input = SISELO.enhanceDateInput('transition_date', {
    min: '1900-01-01',
    max: today,
  });

  if (input && input.value) {
    input.value = SISELO.clampDateInputValue(input.value, input.min, input.max);
    SISELO.syncEnhancedDateInput(input);
  }
}
