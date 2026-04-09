document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'encounters-list') setupEncountersListPage();
  if (page === 'encounters-form') setupEncounterFormPage();
  if (page === 'encounters-trash') setupEncountersTrashPage();
});

async function setupEncountersListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('encounters');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-encounter-link').hidden = !user.permissions.includes('encounters.create');
  document.getElementById('trash-link').hidden = !user.permissions.includes('encounters.restore');

  const data = await SISELO.apiRequest('/encounters/list.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('encounters-table-body');
  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || '')}</td>
      <td>
        <a class="btn" href="/patients/show.html?id=${row.patient_id}">Paciente 360</a>
        ${user.permissions.includes('encounters.update') ? `<a class="btn" href="/encounters/form.html?id=${row.id}">Editar</a>` : ''}
        ${user.permissions.includes('encounters.delete') ? `<button class="btn btn-danger" data-delete-id="${row.id}">Apagar</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Apagar atendimento? (soft delete)')) return;
      await SISELO.apiRequest('/encounters/soft_delete.php', {
        method: 'POST',
        body: { id: Number(button.dataset.deleteId) },
      });
      location.reload();
    });
  });

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
  const id = SISELO.queryParam('id');
  const patientId = SISELO.queryParam('patient_id');
  const endpoint = '/encounters/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : patientId ? '?patient_id=' + encodeURIComponent(patientId) : '');
  const data = await SISELO.apiRequest(endpoint);

  document.getElementById('form-title').textContent = data.editing ? 'Editar Atendimento' : 'Novo Atendimento';
  fillEncounterPatientSelect(data.patients, data.row.patient_id);
  document.getElementById('encounter_date').value = data.row.encounter_date || '';
  document.getElementById('specialty').value = data.row.specialty || '';
  document.getElementById('summary').value = data.row.summary || '';

  document.getElementById('encounter-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await SISELO.apiRequest(endpoint, {
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

  const data = await SISELO.apiRequest('/encounters/trash.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('encounters-table-body');
  tbody.innerHTML = (data.rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.deleted_at || '')}</td>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.full_name)}<br><small>CPF: ${SISELO.escapeHtml(row.cpf)} | SES: ${SISELO.escapeHtml(row.ses)}</small></td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td><button class="btn btn-primary" data-restore-id="${row.id}">Restaurar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/encounters/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/encounters/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

function fillEncounterPatientSelect(patients, currentValue) {
  const select = document.getElementById('patient_id');
  select.innerHTML = '<option value="">-- selecione --</option>' + (patients || []).map((patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? 'selected' : ''}>
      ${SISELO.escapeHtml(patient.full_name)} (CPF: ${SISELO.escapeHtml(patient.cpf)} | SES: ${SISELO.escapeHtml(patient.ses)})
    </option>
  `).join('');
}
