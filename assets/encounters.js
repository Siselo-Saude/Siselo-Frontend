document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'encounters-list') setupEncountersListPage();
  if (page === 'encounters-form') setupEncounterFormPage();
  if (page === 'encounters-trash') setupEncountersTrashPage();
});

async function setupEncountersListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('encounters');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-encounter-link').hidden = !permissions.has('encounters.create');
  document.getElementById('trash-link').hidden = !permissions.has('encounters.restore');

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/encounters/list.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('encounters-table-body');
  renderEncountersTable(tbody, rows, permissions);
  bindEncounterListActions(tbody);

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/encounters/list.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

async function setupEncounterFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('encounters');
  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  const endpoint = '/encounters/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  let data = getEmptyEncounterContext(patientId);

  try {
    data = await SISELO.apiRequest(endpoint || '/encounters/form.php');
  } catch (error) {
  }

  const row = data.row || getEmptyEncounterContext(patientId).row;
  document.getElementById('form-title').textContent = data.editing ? 'Editar Atendimento' : 'Novo Atendimento';
  fillEncounterPatientSelect(Array.isArray(data.patients) ? data.patients : [], row.patient_id);
  document.getElementById('encounter_date').value = row.encounter_date || '';
  document.getElementById('specialty').value = row.specialty || '';
  document.getElementById('summary').value = row.summary || '';
  configureEncounterDateInput();

  document.getElementById('encounter-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!SISELO.validateEnhancedDateInputs(event.currentTarget, { alertId: 'page-alert' })) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint || '/encounters/form.php', {
        method: 'POST',
        body: Object.fromEntries(formData.entries()),
      });
      location.href = '/encounters/list.html';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}

async function setupEncountersTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('encounters');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/encounters/trash.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('encounters-table-body');
  renderEncountersTrashTable(tbody, rows);
  bindEncounterTrashActions(tbody);

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/encounters/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

function renderEncountersTable(tbody, rows, permissions) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">Nenhum atendimento carregado.</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconLink('view', '/patients/show.html?id=0&tab=atendimentos', 'Paciente 360')}
            ${permissions.has('encounters.update') ? SISELO.iconLink('edit', '/encounters/form.html', 'Editar atendimento') : ''}
            ${permissions.has('encounters.delete') ? SISELO.iconButton('delete', 'Apagar atendimento', { 'data-empty-delete': true }) : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || '')}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink('view', `/patients/show.html?id=${row.patient_id}&tab=atendimentos`, 'Paciente 360')}
          ${permissions.has('encounters.update') ? SISELO.iconLink('edit', `/encounters/form.html?id=${row.id}`, 'Editar atendimento') : ''}
          ${permissions.has('encounters.delete') ? SISELO.iconButton('delete', 'Apagar atendimento', { 'data-delete-id': row.id, 'data-delete-label': row.full_name || '' }) : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderEncountersTrashTable(tbody, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">Nenhum atendimento na lixeira.</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconButton('restore', 'Restaurar atendimento', { 'data-empty-restore': true })}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton('restore', 'Restaurar atendimento', { 'data-restore-id': row.id })}
        </div>
      </td>
    </tr>
  `).join('');
}

function bindEncounterListActions(tbody) {
  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!SISELO.confirmDeletion('o atendimento de', button.dataset.deleteLabel)) return;

      try {
        await SISELO.apiRequest('/encounters/soft_delete.php', {
          method: 'POST',
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(error.message || 'Nao foi possivel apagar o atendimento.');
      }
    });
  });

  tbody.querySelectorAll('[data-empty-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha atendimento carregado para apagar.');
    });
  });
}

function bindEncounterTrashActions(tbody) {
  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/encounters/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  tbody.querySelectorAll('[data-empty-restore]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha atendimento carregado para restaurar.');
    });
  });
}

function getEmptyEncounterContext(patientId) {
  return {
    editing: false,
    row: {
      patient_id: patientId || '',
      encounter_date: '',
      specialty: '',
      summary: '',
    },
    patients: [],
  };
}

function fillEncounterPatientSelect(patients, currentValue) {
  const select = document.getElementById('patient_id');
  select.innerHTML = '<option value="">-- selecione --</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)} (CPF: ${SISELO.escapeHtml(patient.cpf)} | SES: ${SISELO.escapeHtml(patient.ses)})
    </option>
  `).join('');
}

function configureEncounterDateInput() {
  const today = SISELO.todayDateInputValue();
  const input = SISELO.enhanceDateInput('encounter_date', {
    min: '1900-01-01',
    max: today,
  });

  if (input && input.value) {
    input.value = SISELO.clampDateInputValue(input.value, input.min, input.max);
    SISELO.syncEnhancedDateInput(input);
  }
}
