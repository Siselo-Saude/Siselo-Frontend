document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'care-plans-list') {
    setupCarePlansListPage();
  }

  if (page === 'care-plans-form') {
    setupCarePlansFormPage();
  }

  if (page === 'care-plans-trash') {
    setupCarePlansTrashPage();
  }
});

async function setupCarePlansListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('careplans');
  const query = SISELO.queryParam('q') || '';
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const newPlanLink = document.getElementById('new-plan-link');
  const canCreatePlan = permissions.has('careplans.create');
  const newPlanHref = '/care-plans/form.html' + (patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  searchInput.value = query;
  newPlanLink.hidden = !canCreatePlan;
  document.getElementById('trash-link').hidden = !permissions.has('careplans.restore');
  newPlanLink.href = newPlanHref;

  const url = '/care_plans/list.php' + (patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  let rows = [];

  try {
    const data = await SISELO.apiRequest(url);
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('care-plans-table-body');
  const applySearch = (value) => {
    const filteredRows = filterCarePlanRows(rows, value);
    newPlanLink.hidden = !canCreatePlan || filteredRows.length === 0;
    renderCarePlansTable(tbody, filteredRows, permissions, value, newPlanHref);
    bindCarePlanListActions(tbody);
    SISELO.syncSearchUrl('/care-plans/list.html', value, patientId ? { patient_id: patientId } : {});
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

async function setupCarePlansFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('careplans');

  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  const endpoint = '/care_plans/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  let data = getEmptyCarePlanContext(patientId);

  try {
    data = await SISELO.apiRequest(endpoint || '/care_plans/form.php');
  } catch (error) {
  }

  const plan = data.plan || getEmptyCarePlanContext(patientId).plan;
  document.getElementById('form-title').textContent = data.editing ? 'Editar Plano de Cuidado' : 'Novo Plano de Cuidado';
  fillPatientSelect('patient_id', Array.isArray(data.patients) ? data.patients : [], plan.patient_id);
  document.getElementById('start_date').value = plan.start_date || '';
  document.getElementById('end_date').value = plan.end_date || '';
  document.getElementById('interventions').value = plan.interventions || '';
  configureCarePlanDateInputs();

  const itemsContainer = document.getElementById('items');
  const items = Array.isArray(data.items) && data.items.length ? data.items : [{
    item_type: 'meta',
    title: '',
    situation: '',
    recommendation: '',
    difficulty: '',
    goal: '',
    sort_order: 1,
  }];

  items.forEach((item) => addCarePlanItem(item));

  document.querySelectorAll('[data-add-item]').forEach((button) => {
    button.addEventListener('click', () => {
      addCarePlanItem({
        item_type: button.dataset.addItem,
        title: '',
        situation: '',
        recommendation: '',
        difficulty: '',
        goal: '',
        sort_order: itemsContainer.children.length + 1,
      });
    });
  });

  document.getElementById('care-plan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert('page-alert', '', 'info');

    if (!SISELO.validateEnhancedDateInputs(event.currentTarget, { alertId: 'page-alert' })) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint || '/care_plans/form.php', {
        method: 'POST',
        body: objectFromFormData(formData),
      });
      location.href = '/care-plans/list.html';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}

async function setupCarePlansTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('careplans');
  const query = SISELO.queryParam('q') || '';
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  searchInput.value = query;

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/care_plans/trash.php');
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('care-plans-table-body');
  const applySearch = (value) => {
    renderCarePlansTrashTable(tbody, filterCarePlanRows(rows, value), value);
    bindCarePlanTrashActions(tbody);
    SISELO.syncSearchUrl('/care-plans/trash.html', value);
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

function renderCarePlansTable(tbody, rows, permissions, query = '', newPlanHref = '/care-plans/form.html') {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      5,
      'Nenhum plano de cuidado encontrado.',
      permissions.has('careplans.create')
        ? { label: '+ Novo plano', href: newPlanHref }
        : null
    );
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink('pdf', `${SISELO.getApiBaseUrl()}/care_plans/pdf.php?id=${row.id}`, 'Gerar PDF', { target: '_blank', rel: 'noreferrer' })}
          ${permissions.has('careplans.update') ? SISELO.iconLink('edit', `/care-plans/form.html?id=${row.id}`, 'Editar plano') : ''}
          ${permissions.has('careplans.delete') ? SISELO.iconButton('delete', 'Apagar plano', { 'data-delete-id': row.id, 'data-delete-label': row.full_name || `Plano ${row.id}` }) : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCarePlansTrashTable(tbody, rows, query = '') {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(6, 'Nenhum plano na lixeira.');
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton('restore', 'Restaurar plano', { 'data-restore-id': row.id })}
        </div>
      </td>
    </tr>
  `).join('');
}

function bindCarePlanListActions(tbody) {
  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!SISELO.confirmDeletion('o plano de cuidado', button.dataset.deleteLabel)) return;

      try {
        await SISELO.apiRequest('/care_plans/soft_delete.php', {
          method: 'POST',
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(error.message || 'Nao foi possivel apagar o plano.');
      }
    });
  });
}

function filterCarePlanRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesName = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.full_name, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.cpf, search) || SISELO.matchesSearchDigits(row.ses, search)
      : true;

    return matchesName && matchesDigits;
  });
}

function bindCarePlanTrashActions(tbody) {
  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/care_plans/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });
}

function getEmptyCarePlanContext(patientId) {
  return {
    editing: false,
    plan: {
      patient_id: patientId || '',
      start_date: '',
      end_date: '',
      interventions: '',
    },
    items: [],
    patients: [],
  };
}

function addCarePlanItem(item) {
  const itemsContainer = document.getElementById('items');
  const wrapper = document.createElement('div');
  wrapper.className = 'card';
  wrapper.style.marginTop = '12px';
  wrapper.innerHTML = `
    <div class="form-grid">
      <div class="field">
        <label>Tipo</label>
        <select name="item_type[]">
          <option value="alerta" ${item.item_type === 'alerta' ? 'selected' : ''}>alerta</option>
          <option value="meta" ${item.item_type === 'meta' ? 'selected' : ''}>meta</option>
          <option value="dificuldade" ${item.item_type === 'dificuldade' ? 'selected' : ''}>dificuldade</option>
          <option value="recomendacao" ${item.item_type === 'recomendacao' ? 'selected' : ''}>recomendacao</option>
        </select>
      </div>
      <div class="field">
        <label>Titulo</label>
        <input name="title[]" value="${SISELO.escapeHtml(item.title || '')}">
      </div>
      <div class="field">
        <label>Ordem</label>
        <input name="sort_order[]" value="${SISELO.escapeHtml(item.sort_order || itemsContainer.children.length + 1)}">
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button type="button" class="btn" data-remove-item>Remover</button>
      </div>
      <div class="field-full">
        <label>Situacao</label>
        <textarea name="situation[]">${SISELO.escapeHtml(item.situation || '')}</textarea>
      </div>
      <div class="field-full">
        <label>Recomendacao</label>
        <textarea name="recommendation[]">${SISELO.escapeHtml(item.recommendation || '')}</textarea>
      </div>
      <div class="field-full">
        <label>Dificuldade</label>
        <textarea name="difficulty[]">${SISELO.escapeHtml(item.difficulty || '')}</textarea>
      </div>
      <div class="field-full">
        <label>Meta</label>
        <textarea name="goal[]">${SISELO.escapeHtml(item.goal || '')}</textarea>
      </div>
    </div>
  `;
  wrapper.querySelector('[data-remove-item]').addEventListener('click', () => wrapper.remove());
  itemsContainer.appendChild(wrapper);
}

function fillPatientSelect(id, patients, currentValue) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">Selecione um paciente</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)}
    </option>
  `).join('');
}

function objectFromFormData(formData) {
  const payload = {};
  formData.forEach((value, key) => {
    if (key.endsWith('[]')) {
      if (!payload[key.slice(0, -2)]) payload[key.slice(0, -2)] = [];
      payload[key.slice(0, -2)].push(value);
      return;
    }

    payload[key] = value;
  });
  return payload;
}

function configureCarePlanDateInputs() {
  const today = SISELO.todayDateInputValue();
  const maxPlanDate = SISELO.shiftDateInputValue(today, { years: 5 });
  const startInput = SISELO.enhanceDateInput('start_date', {
    min: '1900-01-01',
    max: maxPlanDate,
  });
  const endInput = SISELO.enhanceDateInput('end_date', {
    min: '1900-01-01',
    max: maxPlanDate,
  });

  if (!startInput || !endInput) {
    return;
  }

  const baseMin = '1900-01-01';
  const syncCarePlanDates = () => {
    startInput.max = endInput.value || maxPlanDate;
    endInput.min = startInput.value && startInput.value > baseMin
      ? startInput.value
      : baseMin;

    if (startInput.value) {
      startInput.value = SISELO.clampDateInputValue(startInput.value, baseMin, startInput.max);
    }

    if (endInput.value) {
      endInput.value = SISELO.clampDateInputValue(endInput.value, endInput.min, maxPlanDate);
    }

    SISELO.syncEnhancedDateInput(startInput);
    SISELO.syncEnhancedDateInput(endInput);
  };

  startInput.addEventListener('change', syncCarePlanDates);
  endInput.addEventListener('change', syncCarePlanDates);
  syncCarePlanDates();
}
