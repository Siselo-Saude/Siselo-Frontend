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

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('patients');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;
  document.getElementById('new-patient-link').hidden = !permissions.has('patients.create');
  document.getElementById('trash-link').hidden = !permissions.has('patients.restore');

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  renderPatientsTable('patients-table-body', rows, permissions, false);

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

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/patients/trash.php?q=' + encodeURIComponent(query));
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById('patients-table-body');
  renderPatientsTrashTable(tbody, rows);
  bindPatientsTrashActions(tbody);

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

  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const endpoint = '/patients/form.php' + (id ? '?id=' + encodeURIComponent(id) : '');
  let data = getEmptyPatientFormContext();

  try {
    data = await SISELO.apiRequest(endpoint);
  } catch (error) {
  }

  const row = data.row || getEmptyPatientFormContext().row;
  const options = getPatientFormOptions(data.options);

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

  configurePatientDateInputs();
  syncPatientClinicalTextareas();
  attachPatientMasks();

  document.getElementById('patient-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors();

    if (!SISELO.validateEnhancedDateInputs(event.currentTarget, { alertId: 'page-alert' })) {
      return;
    }

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

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('patients');

  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  let data = null;

  if (id) {
    try {
      data = await SISELO.apiRequest('/patients/show.php?id=' + encodeURIComponent(id));
    } catch (error) {
      data = null;
    }
  }

  const patient = data && data.patient ? data.patient : getEmptyPatientSummary();
  const activeTab = normalizePatientTab(SISELO.queryParam('tab'));
  const actionPatientId = id || '0';

  if (!data || !data.patient) {
  }

  document.getElementById('patient-summary').innerHTML = `
    <strong>${SISELO.escapeHtml(patient.full_name || 'Cadastro em branco')}</strong><br>
    CPF: ${SISELO.escapeHtml(patient.cpf || '-')} | SES: ${SISELO.escapeHtml(patient.ses || '-')}<br>
    ${patient.age_label ? `Idade: ${SISELO.escapeHtml(patient.age_label)} | ` : ''}${patient.gender_label ? `Genero: ${SISELO.escapeHtml(patient.gender_label)} | ` : ''}Status: ${SISELO.escapeHtml(patient.status_label || 'Ativo')}<br>
    Tel: ${SISELO.escapeHtml(patient.phone || '-')} | Email: ${SISELO.escapeHtml(patient.email || '-')}<br>
    Sangue: ${SISELO.escapeHtml(patient.blood_type || '-')} | Convenio: ${SISELO.escapeHtml(patient.health_insurance || '-')}<br>
    UBS: ${SISELO.escapeHtml(patient.ubs_ref || '-')} | Equipe: ${SISELO.escapeHtml(patient.team_ref || '-')}<br>
    Contato de emergencia: ${SISELO.escapeHtml(patient.emergency_contact || '-')}
  `;

  document.getElementById('patient-notes').innerHTML = `
    ${patient.allergies ? `<p><strong>Alergias:</strong> ${SISELO.escapeHtml(patient.allergies)}</p>` : '<p class="muted">Nenhuma alergia carregada.</p>'}
    ${patient.chronic_conditions ? `<p><strong>Condicoes cronicas:</strong> ${SISELO.escapeHtml(patient.chronic_conditions)}</p>` : '<p class="muted">Nenhuma condicao cronica carregada.</p>'}
  `;

  configurePatientTabs(actionPatientId, activeTab, permissions);
  configurePatientBackLink(activeTab);

  document.getElementById('patient-actions').innerHTML = `
    ${permissions.has('careplans.create') ? `<a class="btn" href="/care-plans/form.html?patient_id=${encodeURIComponent(actionPatientId)}">+ Novo plano</a>` : ''}
    ${permissions.has('encounters.create') ? `<a class="btn" href="/encounters/form.html?patient_id=${encodeURIComponent(actionPatientId)}">+ Novo atendimento</a>` : ''}
    ${permissions.has('transitions.create') ? `<a class="btn" href="/transitions/form.html?patient_id=${encodeURIComponent(actionPatientId)}">+ Nova transicao</a>` : ''}
  `;

  renderCarePlanRows('care-plans-table-body', data && Array.isArray(data.care_plans) ? data.care_plans : [], permissions);
  renderEncounterRows('encounters-table-body', data && Array.isArray(data.encounters) ? data.encounters : [], permissions);
  renderTransitionRows('transitions-table-body', data && Array.isArray(data.transitions) ? data.transitions : [], permissions);
}

function renderPatientsTable(targetId, rows, permissions, isTrash) {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td>
          <strong>Cadastro em branco</strong><br>
          <small class="muted">Sem usuario carregado</small>
        </td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconLink('view', '/patients/show.html?id=0&tab=planos', 'Usuario 360')}
            ${permissions.has('patients.update') ? SISELO.iconLink('edit', '/patients/form.html', 'Editar paciente') : ''}
            ${!isTrash && permissions.has('patients.delete') ? SISELO.iconButton('delete', 'Apagar paciente', { 'data-empty-delete': true }) : ''}
          </div>
        </td>
      </tr>
    `;
    bindPatientListActions(tbody);
    return;
  }

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
        <div class="table-actions">
          ${SISELO.iconLink('view', `/patients/show.html?id=${row.id}&tab=planos`, 'Usuario 360')}
          ${permissions.has('patients.update') ? SISELO.iconLink('edit', `/patients/form.html?id=${row.id}`, 'Editar paciente') : ''}
          ${!isTrash && permissions.has('patients.delete') ? SISELO.iconButton('delete', 'Apagar paciente', { 'data-delete-id': row.id, 'data-delete-label': row.full_name || '' }) : ''}
        </div>
      </td>
    </tr>
  `).join('');

  bindPatientListActions(tbody);
}

function renderPatientsTrashTable(tbody, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">Nenhum paciente na lixeira.</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconButton('restore', 'Restaurar paciente', { 'data-empty-restore': true })}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.full_name)}</td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${SISELO.escapeHtml(row.ses)}</td>
      <td>${SISELO.escapeHtml(row.deleted_at)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton('restore', 'Restaurar paciente', { 'data-restore-id': row.id })}
        </div>
      </td>
    </tr>
  `).join('');
}

function bindPatientListActions(tbody) {
  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!SISELO.confirmDeletion('o paciente', button.dataset.deleteLabel)) {
        return;
      }

      try {
        await SISELO.apiRequest('/patients/soft_delete.php', {
          method: 'POST',
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(error.message || 'Nao foi possivel apagar o paciente.');
      }
    });
  });

  tbody.querySelectorAll('[data-empty-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha paciente carregado para apagar.');
    });
  });
}

function bindPatientsTrashActions(tbody) {
  tbody.querySelectorAll('[data-restore-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/patients/restore.php', {
        method: 'POST',
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  tbody.querySelectorAll('[data-empty-restore]').forEach((button) => {
    button.addEventListener('click', () => {
      SISELO.showUnavailableAction('Nao ha paciente carregado para restaurar.');
    });
  });
}

function renderCarePlanRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconButton('pdf', 'Gerar PDF', { 'data-empty-pdf': true })}
            ${permissions.has('careplans.update') ? SISELO.iconLink('edit', '/care-plans/form.html', 'Editar plano') : ''}
          </div>
        </td>
      </tr>
    `;

    tbody.querySelectorAll('[data-empty-pdf]').forEach((button) => {
      button.addEventListener('click', () => {
        SISELO.showUnavailableAction('Nao ha plano carregado para gerar PDF.');
      });
    });
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || '')}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink('pdf', `${SISELO.getApiBaseUrl()}/care_plans/pdf.php?id=${row.id}`, 'Gerar PDF', { target: '_blank', rel: 'noreferrer' })}
          ${permissions.has('careplans.update') ? SISELO.iconLink('edit', `/care-plans/form.html?id=${row.id}`, 'Editar plano') : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderEncounterRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">Nenhum atendimento carregado.</td>
        <td>
          <div class="table-actions">
            ${permissions.has('encounters.update') ? SISELO.iconLink('edit', '/encounters/form.html', 'Editar atendimento') : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || '')}</td>
      <td>
        <div class="table-actions">
          ${permissions.has('encounters.update') ? SISELO.iconLink('edit', `/encounters/form.html?id=${row.id}`, 'Editar atendimento') : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTransitionRows(targetId, rows, permissions) {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">-</td>
        <td class="muted">Nenhuma transicao carregada.</td>
        <td>
          <div class="table-actions">
            ${permissions.has('transitions.update') ? SISELO.iconLink('edit', '/transitions/form.html', 'Editar transicao') : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.transition_date)}</td>
      <td>${SISELO.escapeHtml(row.from_service || '')}</td>
      <td>${SISELO.escapeHtml(row.to_service || '')}</td>
      <td>${SISELO.escapeHtml(row.status)}</td>
      <td>${SISELO.escapeHtml(row.notes || '')}</td>
      <td>
        <div class="table-actions">
          ${permissions.has('transitions.update') ? SISELO.iconLink('edit', `/transitions/form.html?id=${row.id}`, 'Editar transicao') : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function normalizePatientTab(value) {
  return ['planos', 'atendimentos', 'transicoes'].includes(String(value || '')) ? String(value) : 'planos';
}

function configurePatientTabs(id, activeTab, permissions) {
  const tabs = [
    {
      key: 'planos',
      permission: 'careplans.view',
      linkId: 'patient-careplans-link',
      panelId: 'patient-panel-planos',
    },
    {
      key: 'atendimentos',
      permission: 'encounters.view',
      linkId: 'patient-encounters-link',
      panelId: 'patient-panel-atendimentos',
    },
    {
      key: 'transicoes',
      permission: 'transitions.view',
      linkId: 'patient-transitions-link',
      panelId: 'patient-panel-transicoes',
    },
  ];

  tabs.forEach((tab) => {
    const link = document.getElementById(tab.linkId);
    const panel = document.getElementById(tab.panelId);
    const allowed = permissions.has(tab.permission);

    if (link) {
      link.href = '/patients/show.html?id=' + encodeURIComponent(id) + '&tab=' + tab.key;
      link.hidden = !allowed;
      link.classList.toggle('is-active', allowed && tab.key === activeTab);
    }

    if (panel) {
      panel.hidden = !allowed || tab.key !== activeTab;
    }
  });
}

function configurePatientBackLink(activeTab) {
  const link = document.getElementById('patient-back-link');
  if (!link) {
    return;
  }

  const destinations = {
    planos: '/patients/list.html',
    atendimentos: '/encounters/list.html',
    transicoes: '/transitions/list.html',
  };

  const fallback = destinations[activeTab] || '/patients/list.html';
  link.href = fallback;
  link.dataset.fallback = fallback;
}

function getPatientFormOptions(options) {
  const safeOptions = options || {};

  return {
    gender_options: safeOptions.gender_options || {
      masculino: 'Masculino',
      feminino: 'Feminino',
      outro: 'Outro',
    },
    race_options: safeOptions.race_options || {
      branca: 'Branca',
      preta: 'Preta',
      parda: 'Parda',
      amarela: 'Amarela',
      indigena: 'Indigena',
      nao_informado: 'Nao informado',
    },
    blood_type_options: safeOptions.blood_type_options || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  };
}

function getEmptyPatientFormContext() {
  return {
    editing: false,
    row: {
      first_cadh_date: '',
      full_name: '',
      ses: '',
      cpf: '',
      birth_date: '',
      sex: '',
      race: '',
      responsible_name: '',
      phone: '',
      address: '',
      email: '',
      emergency_contact: '',
      health_insurance: '',
      blood_type: '',
      allergies: '',
      chronic_conditions: '',
      status: 'ativo',
      ubs_ref: '',
      team_ref: '',
    },
    options: getPatientFormOptions({}),
  };
}

function getEmptyPatientSummary() {
  return {
    full_name: '',
    cpf: '',
    ses: '',
    age_label: '',
    gender_label: '',
    status_label: 'Ativo',
    phone: '',
    email: '',
    blood_type: '',
    health_insurance: '',
    ubs_ref: '',
    team_ref: '',
    emergency_contact: '',
    allergies: '',
    chronic_conditions: '',
  };
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

function configurePatientDateInputs() {
  const today = SISELO.todayDateInputValue();
  const oldestBirthDate = SISELO.shiftDateInputValue(today, { years: -130 });
  const attendanceFloor = '1900-01-01';
  const birthInput = SISELO.enhanceDateInput('birth_date', {
    min: oldestBirthDate,
    max: today,
  });
  const attendanceInput = SISELO.enhanceDateInput('attendance_date', {
    min: attendanceFloor,
    max: today,
  });

  if (!birthInput || !attendanceInput) {
    return;
  }

  const syncPatientDates = () => {
    birthInput.max = attendanceInput.value || today;
    attendanceInput.min = birthInput.value && birthInput.value > attendanceFloor
      ? birthInput.value
      : attendanceFloor;

    if (birthInput.value) {
      birthInput.value = SISELO.clampDateInputValue(birthInput.value, oldestBirthDate, birthInput.max);
    }

    if (attendanceInput.value) {
      attendanceInput.value = SISELO.clampDateInputValue(attendanceInput.value, attendanceInput.min, today);
    }

    SISELO.syncEnhancedDateInput(birthInput);
    SISELO.syncEnhancedDateInput(attendanceInput);
  };

  birthInput.addEventListener('change', syncPatientDates);
  attendanceInput.addEventListener('change', syncPatientDates);
  syncPatientDates();
}

function syncPatientClinicalTextareas() {
  const textareas = ['allergies', 'chronic_conditions']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (textareas.length < 2) {
    return;
  }

  const syncHeights = () => {
    textareas.forEach((textarea) => {
      textarea.style.resize = 'none';
      textarea.style.height = 'auto';
    });

    const nextHeight = Math.max(
      160,
      ...textareas.map((textarea) => textarea.scrollHeight)
    );

    textareas.forEach((textarea) => {
      textarea.style.height = `${nextHeight}px`;
    });
  };

  textareas.forEach((textarea) => {
    textarea.addEventListener('input', syncHeights);
  });

  syncHeights();
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
