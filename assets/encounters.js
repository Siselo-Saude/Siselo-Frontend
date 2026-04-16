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
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const newEncounterLink = document.getElementById('new-encounter-link');
  const canCreateEncounter = permissions.has('encounters.create');
  const newEncounterHref = '/encounters/form.html' + (patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  searchInput.value = query;
  newEncounterLink.hidden = !canCreateEncounter;
  newEncounterLink.href = newEncounterHref;
  document.getElementById('trash-link').hidden = !permissions.has('encounters.restore');

  const url = '/encounters/list.php' + (patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  let rows = [];

  try {
    const data = await SISELO.apiRequest(url);
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('encounters-table-body');
  const applySearch = (value) => {
    const filteredRows = filterEncounterRows(rows, value);
    newEncounterLink.hidden = !canCreateEncounter || filteredRows.length === 0;
    renderEncountersTable(tbody, filteredRows, permissions, value, newEncounterHref);
    bindEncounterListActions(tbody);
    SISELO.syncSearchUrl('/encounters/list.html', value, patientId ? { patient_id: patientId } : {});
  };

  applySearch(query);

  searchInput.addEventListener('input', (event) => {
    applySearch(event.currentTarget.value);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applySearch(searchInput.value);
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
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  searchInput.value = query;

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/encounters/trash.php');
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('encounters-table-body');
  const applySearch = (value) => {
    renderEncountersTrashTable(tbody, filterEncounterRows(rows, value), value);
    bindEncounterTrashActions(tbody);
    SISELO.syncSearchUrl('/encounters/trash.html', value);
  };

  applySearch(query);

  searchInput.addEventListener('input', (event) => {
    applySearch(event.currentTarget.value);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applySearch(searchInput.value);
  });
}

function renderEncountersTable(tbody, rows, permissions, query = '', newEncounterHref = '/encounters/form.html') {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      5,
      'Nenhum atendimento encontrado.',
      permissions.has('encounters.create')
        ? { label: '+ Novo atendimento', href: newEncounterHref }
        : null
    );
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span><br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
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

function renderEncountersTrashTable(tbody, rows, query = '') {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(5, 'Nenhum atendimento na lixeira.');
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span><br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
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
      if (!await SISELO.confirmDeletion('o atendimento de', button.dataset.deleteLabel)) return;

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
}

function filterEncounterRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesLetters = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.full_name, search) || SISELO.matchesSearchText(row.specialty, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.cpf, search) || SISELO.matchesSearchDigits(row.ses, search)
      : true;

    return matchesLetters && matchesDigits;
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
  select.innerHTML = '<option value="">Selecione um paciente</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)}
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
