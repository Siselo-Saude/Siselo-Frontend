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

  SISELO.bindShell('careplans');
  const query = SISELO.queryParam('q') || '';
  const patientId = SISELO.queryParam('patient_id') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-plan-link').hidden = !user.permissions.includes('careplans.create');
  document.getElementById('trash-link').hidden = !user.permissions.includes('careplans.restore');
  document.getElementById('new-plan-link').href = '/care-plans/form.html' + (patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');

  const url = '/care_plans/list.php?q=' + encodeURIComponent(query) + (patientId ? '&patient_id=' + encodeURIComponent(patientId) : '');
  const data = await SISELO.apiRequest(url);

  if (patientId && Array.isArray(data.rows) && data.rows.length === 0 && user.permissions.includes('careplans.create')) {
    location.href = '/care-plans/form.html?patient_id=' + encodeURIComponent(patientId);
    return;
  }

  const tbody = document.getElementById('care-plans-table-body');
  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.full_name)}</td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>
        <a class="btn" href="${SISELO.getLegacyBaseUrl()}/care_plans/pdf.php?id=${row.id}" target="_blank" rel="noreferrer">PDF</a>
        ${user.permissions.includes('careplans.update') ? `<a class="btn" href="/care-plans/form.html?id=${row.id}">Editar</a>` : ''}
        ${user.permissions.includes('careplans.delete') ? `<button class="btn btn-danger" data-delete-id="${row.id}">Apagar</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Apagar plano? (soft delete)')) return;
      await SISELO.apiRequest('/care_plans/soft_delete.php', {
        method: 'POST',
        body: { id: Number(button.dataset.deleteId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    if (patientId) params.set('patient_id', patientId);
    location.href = '/care-plans/list.html' + (params.toString() ? '?' + params.toString() : '');
  });
}

async function setupCarePlansFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('careplans');

  const id = SISELO.queryParam('id');
  const patientId = SISELO.queryParam('patient_id');
  const endpoint = '/care_plans/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  const data = await SISELO.apiRequest(endpoint);

  document.getElementById('form-title').textContent = data.editing ? 'Editar Plano de Cuidado' : 'Novo Plano de Cuidado';
  fillPatientSelect('patient_id', data.patients, data.plan.patient_id);
  document.getElementById('start_date').value = data.plan.start_date || '';
  document.getElementById('end_date').value = data.plan.end_date || '';
  document.getElementById('interventions').value = data.plan.interventions || '';

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

    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint, {
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
  document.getElementById('search-input').value = query;

  const data = await SISELO.apiRequest('/care_plans/trash.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('care-plans-table-body');

  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.full_name)}</td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td><button class="btn btn-primary" data-restore-id="${row.id}">Restaurar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/care_plans/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/care-plans/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
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
  select.innerHTML = '<option value="">-- selecione --</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)} (CPF: ${SISELO.escapeHtml(patient.cpf)} | SES: ${SISELO.escapeHtml(patient.ses)})
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
