document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'patients-list') {
    setupPatientsListPage();
  }

  if (page === 'patients-trash') {
    setupPatientsTrashPage();
  }

  if (page === 'patients-form') {
    setupPatientFormPage();
  }

  if (page === 'patients-show') {
    setupPatientShowPage();
  }
});

async function setupPatientsListPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('patients');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-patient-link').hidden = !user.permissions.includes('patients.create');
  document.getElementById('trash-link').hidden = !user.permissions.includes('patients.restore');

  const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(query));
  renderPatientsTable('patients-table-body', data.rows, user.permissions, false);

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/patients/list.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

async function setupPatientsTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('patients');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;

  const data = await SISELO.apiRequest('/patients/trash.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('patients-table-body');

  tbody.innerHTML = data.rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.full_name)}</td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${SISELO.escapeHtml(row.ses)}</td>
      <td>${SISELO.escapeHtml(row.deleted_at)}</td>
      <td>
        <button class="btn btn-primary" data-restore-id="${row.id}">Restaurar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/patients/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/patients/trash.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

async function setupPatientFormPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('patients');

  const id = SISELO.queryParam('id');
  const endpoint = '/patients/form.php' + (id ? '?id=' + encodeURIComponent(id) : '');
  const data = await SISELO.apiRequest(endpoint);
  const row = data.row;
  const options = data.options;

  document.getElementById('form-title').textContent = data.editing ? 'Editar Paciente' : 'Novo Paciente';

  fillSelect('gender', options.gender_options, row.sex);
  fillSelect('race', options.race_options, row.race);
  fillSelect('blood_type', options.blood_type_options, row.blood_type, true);

  Object.keys(row).forEach((key) => {
    const field = document.querySelector(`[name="${key}"]`) || document.querySelector(`[data-field="${key}"]`);
    if (field) {
      field.value = row[key] ?? '';
    }
  });

  attachPatientMasks();

  document.getElementById('patient-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors();

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      await SISELO.apiRequest(endpoint, {
        method: 'POST',
        body: payload,
      });
      location.href = '/patients/list.html';
    } catch (error) {
      const payloadErrors = error.payload && error.payload.errors ? error.payload.errors : {};
      Object.keys(payloadErrors).forEach((field) => {
        const errorElement = document.querySelector(`[data-error-for="${field}"]`);
        if (errorElement) {
          errorElement.textContent = payloadErrors[field];
        }
      });

      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}

async function setupPatientShowPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('patients');

  const id = SISELO.queryParam('id');
  if (!id) {
    SISELO.showAlert('page-alert', 'Paciente invalido.', 'error');
    return;
  }

  const data = await SISELO.apiRequest('/patients/show.php?id=' + encodeURIComponent(id));
  const patient = data.patient;
  const permissions = new Set(user.permissions || []);

  document.getElementById('patient-summary').innerHTML = `
    <strong>${SISELO.escapeHtml(patient.full_name)}</strong><br>
    CPF: ${SISELO.escapeHtml(patient.cpf)} | SES: ${SISELO.escapeHtml(patient.ses)}<br>
    ${patient.age_label ? `Idade: ${SISELO.escapeHtml(patient.age_label)} | ` : ''}${patient.gender_label ? `Genero: ${SISELO.escapeHtml(patient.gender_label)} | ` : ''}Status: ${SISELO.escapeHtml(patient.status_label)}<br>
    Tel: ${SISELO.escapeHtml(patient.phone)} | Email: ${SISELO.escapeHtml(patient.email)}<br>
    Sangue: ${SISELO.escapeHtml(patient.blood_type)} | Convenio: ${SISELO.escapeHtml(patient.health_insurance)}<br>
    UBS: ${SISELO.escapeHtml(patient.ubs_ref)} | Equipe: ${SISELO.escapeHtml(patient.team_ref)}<br>
    Contato de emergencia: ${SISELO.escapeHtml(patient.emergency_contact)}
  `;

  document.getElementById('patient-notes').innerHTML = `
    ${patient.allergies ? `<p><strong>Alergias:</strong> ${SISELO.escapeHtml(patient.allergies)}</p>` : ''}
    ${patient.chronic_conditions ? `<p><strong>Condicoes cronicas:</strong> ${SISELO.escapeHtml(patient.chronic_conditions)}</p>` : ''}
  `;

  document.getElementById('patient-careplans-link').href = '/care-plans/list.html?patient_id=' + encodeURIComponent(id);
  document.getElementById('patient-encounters-link').href = '/encounters/list.html';
  document.getElementById('patient-transitions-link').href = '/transitions/list.html';

  document.getElementById('patient-actions').innerHTML = `
    ${permissions.has('careplans.create') ? `<a class="btn" href="/care-plans/form.html?patient_id=${id}">+ Novo plano</a>` : ''}
    ${permissions.has('encounters.create') ? `<a class="btn" href="/encounters/form.html?patient_id=${id}">+ Novo atendimento</a>` : ''}
    ${permissions.has('transitions.create') ? `<a class="btn" href="/transitions/form.html?patient_id=${id}">+ Nova transicao</a>` : ''}
  `;

  renderCarePlanRows('care-plans-table-body', data.care_plans, permissions);
  renderEncounterRows('encounters-table-body', data.encounters, permissions);
  renderTransitionRows('transitions-table-body', data.transitions, permissions);
}

function renderPatientsTable(targetId, rows, permissions, isTrash) {
  const tbody = document.getElementById(targetId);

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <strong>${SISELO.escapeHtml(row.full_name)}</strong><br>
        <small>${SISELO.escapeHtml(row.age_label || '')}${row.age_label && row.gender_label ? ' | ' : ''}${SISELO.escapeHtml(row.gender_label || '')}</small>
      </td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${SISELO.escapeHtml(row.ses)}</td>
      <td>${SISELO.escapeHtml(row.phone || '')}<br><small>${SISELO.escapeHtml(row.email || '')}</small></td>
      <td>${SISELO.escapeHtml(row.blood_type || '')}</td>
      <td>${SISELO.escapeHtml(row.status_label || '')}</td>
      <td>
        <a class="btn" href="/patients/show.html?id=${row.id}">Usuario 360</a>
        ${permissions.includes('patients.update') ? `<a class="btn" href="/patients/form.html?id=${row.id}">Editar</a>` : ''}
        ${!isTrash && permissions.includes('patients.delete') ? `<button class="btn btn-danger" data-delete-id="${row.id}">Apagar</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Confirma apagar? (soft delete)')) {
        return;
      }

      await SISELO.apiRequest('/patients/soft_delete.php', {
        method: 'POST',
        body: { id: Number(button.dataset.deleteId) },
      });
      location.reload();
    });
  });
}

function renderSimpleRows(targetId, rows, keys) {
  const tbody = document.getElementById(targetId);
  tbody.innerHTML = rows.map((row) => `
    <tr>${keys.map((key) => `<td>${SISELO.escapeHtml(row[key] || '')}</td>`).join('')}</tr>
  `).join('');
}

function renderCarePlanRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);
  tbody.innerHTML = (rows || []).map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>
        <a class="btn" href="${SISELO.getLegacyBaseUrl()}/care_plans/pdf.php?id=${row.id}" target="_blank" rel="noreferrer">PDF</a>
        ${permissions.has('careplans.update') ? `<a class="btn" href="/care-plans/form.html?id=${row.id}">Editar</a>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderEncounterRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);
  tbody.innerHTML = (rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || '')}</td>
      <td>${permissions.has('encounters.update') ? `<a class="btn" href="/encounters/form.html?id=${row.id}">Editar</a>` : ''}</td>
    </tr>
  `).join('');
}

function renderTransitionRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);
  tbody.innerHTML = (rows || []).map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.transition_date)}</td>
      <td>${SISELO.escapeHtml(row.from_service || '')}</td>
      <td>${SISELO.escapeHtml(row.to_service || '')}</td>
      <td>${SISELO.escapeHtml(row.status)}</td>
      <td>${SISELO.escapeHtml(row.notes || '')}</td>
      <td>${permissions.has('transitions.update') ? `<a class="btn" href="/transitions/form.html?id=${row.id}">Editar</a>` : ''}</td>
    </tr>
  `).join('');
}

function fillSelect(id, options, currentValue, allowBlank) {
  const select = document.getElementById(id);
  if (!select) {
    return;
  }

  const entries = Array.isArray(options)
    ? options.map((value) => [value, value])
    : Object.entries(options || {});

  select.innerHTML = `${allowBlank ? '<option value="">Selecione</option>' : '<option value="">Selecione</option>'}` +
    entries.map(([value, label]) => `
      <option value="${SISELO.escapeHtml(value)}" ${String(currentValue || '') === String(value) ? 'selected' : ''}>${SISELO.escapeHtml(label)}</option>
    `).join('');
}

function clearFieldErrors() {
  document.querySelectorAll('[data-error-for]').forEach((element) => {
    element.textContent = '';
  });
  SISELO.showAlert('page-alert', '', 'info');
}

function attachPatientMasks() {
  const sesInput = document.getElementById('ses');
  const cpfInput = document.getElementById('cpf');
  const phoneInput = document.getElementById('phone');
  const emergencyInput = document.getElementById('emergency_contact');

  if (sesInput) {
    sesInput.addEventListener('input', () => {
      sesInput.value = digitsOnly(sesInput.value).slice(0, 9);
    });
    sesInput.value = digitsOnly(sesInput.value).slice(0, 9);
  }

  if (cpfInput) {
    cpfInput.addEventListener('input', () => {
      cpfInput.value = formatCpf(cpfInput.value);
    });
    cpfInput.value = formatCpf(cpfInput.value);
  }

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = formatPhone(phoneInput.value);
    });
    phoneInput.value = formatPhone(phoneInput.value);
  }

  if (emergencyInput) {
    emergencyInput.addEventListener('input', () => {
      emergencyInput.value = formatPhone(emergencyInput.value);
    });
    emergencyInput.value = formatPhone(emergencyInput.value);
  }
}

function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '');
}

function formatCpf(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + '.' + digits.slice(3);
  if (digits.length <= 9) return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6);
  return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-' + digits.slice(9);
}

function formatPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
  if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
}
