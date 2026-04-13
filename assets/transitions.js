document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'transitions-list') setupTransitionsListPage();
  if (page === 'transitions-form') setupTransitionFormPage();
  if (page === 'transitions-trash') setupTransitionsTrashPage();
});

async function setupTransitionsListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('transitions');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-transition-link').hidden = !user.permissions.includes('transitions.create');
  document.getElementById('trash-link').hidden = !user.permissions.includes('transitions.restore');

  const data = await SISELO.apiRequest('/transitions/list.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('transitions-table-body');
  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.transition_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.from_service || '')}</td>
      <td>${SISELO.escapeHtml(row.to_service || '')}</td>
      <td>${SISELO.escapeHtml(row.status)}</td>
      <td>
        <a class="btn" href="/patients/show.html?id=${row.patient_id}&tab=transicoes">Paciente 360</a>
        ${user.permissions.includes('transitions.update') ? `<a class="btn" href="/transitions/form.html?id=${row.id}">Editar</a>` : ''}
        ${user.permissions.includes('transitions.delete') ? `<button class="btn btn-danger" data-delete-id="${row.id}">Apagar</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Apagar transicao? (soft delete)')) return;
      await SISELO.apiRequest('/transitions/soft_delete.php', {
        method: 'POST',
        body: { id: Number(button.dataset.deleteId) },
      });
      location.reload();
    });
  });

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
  const id = SISELO.queryParam('id');
  const patientId = SISELO.queryParam('patient_id');
  const endpoint = '/transitions/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  const data = await SISELO.apiRequest(endpoint);

  document.getElementById('form-title').textContent = data.editing ? 'Editar Transicao' : 'Nova Transicao';
  fillTransitionPatientSelect(data.patients, data.row.patient_id);
  fillTransitionStatusSelect(data.statuses, data.row.status);
  document.getElementById('transition_date').value = data.row.transition_date || '';
  document.getElementById('from_service').value = data.row.from_service || '';
  document.getElementById('to_service').value = data.row.to_service || '';
  document.getElementById('notes').value = data.row.notes || '';

  document.getElementById('transition-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint, {
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

  const data = await SISELO.apiRequest('/transitions/trash.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('transitions-table-body');
  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td>${SISELO.escapeHtml(row.transition_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.from_service || '')}</td>
      <td>${SISELO.escapeHtml(row.to_service || '')}</td>
      <td>${SISELO.escapeHtml(row.status)}</td>
      <td><button class="btn btn-primary" data-restore-id="${row.id}">Restaurar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/transitions/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/transitions/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
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
    <option value="${SISELO.escapeHtml(status)}" ${String(currentValue || '') === String(status) ? 'selected' : ''}>${SISELO.escapeHtml(status)}</option>
  `).join('');
}
