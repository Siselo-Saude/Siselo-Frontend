const UBS_PATIENT_SPECIALTIES = [
  {
    key: 'emut',
    label: 'EMUT (Equipe Multidisciplinar)',
    aliases: ['emut', 'emulti', 'equipe multidisciplinar'],
    tone: 'teal',
  },
  {
    key: 'enfermagem',
    label: 'Enfermeiro e Técnico de Enfermagem',
    aliases: ['enfermeiro', 'enfermagem', 'tecnico de enfermagem', 'técnico de enfermagem'],
    tone: 'blue',
  },
  {
    key: 'farmacia',
    label: 'Farmácia Clínica',
    aliases: ['farmacia clinica', 'farmácia clínica'],
    tone: 'amber',
  },
  {
    key: 'medicina_familia',
    label: 'Médico da Família e Comunidade',
    aliases: ['medico da familia', 'médico da família', 'medico de familia', 'médico de família'],
    tone: 'rose',
  },
];

const UBS_PATIENT_RECORD_TYPES = {
  diagnostico: { label: 'Diagnóstico', tone: 'rose' },
  exame: { label: 'Exame', tone: 'blue' },
  consulta: { label: 'Consulta', tone: 'teal' },
};

let ubsPatientPermissions = new Set();
let ubsPatientData = null;
let ubsPatientId = '';
let ubsPatientSelectedSpecialty = '';
let ubsPatientCurrentView = 'history';

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'ubs-patient') {
    setupUbsPatientPage();
  }
});

async function setupUbsPatientPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  ubsPatientPermissions = SISELO.getUiPermissions(user);
  ubsPatientId = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const requestedView = String(SISELO.queryParam('view') || '').trim();
  if (['history', 'specialties', 'referral'].includes(requestedView)) {
    ubsPatientCurrentView = requestedView;
  }
  SISELO.bindShell('ubs');
  syncUbsPatientShellHeading();
  bindUbsPatientActions();

  if (!ubsPatientId) {
    showUbsPatientError('Paciente inválido. Volte para a Lista de Pacientes e selecione um registro.');
    disableUbsPatientActions();
    return;
  }

  await loadUbsPatient();
}

function syncUbsPatientShellHeading() {
  const section = document.querySelector('[data-shell-section]');
  const title = document.querySelector('[data-shell-title]');
  if (section) section.textContent = 'Módulos › UBS';
  if (title) title.textContent = 'UBS – Unidade Básica de Saúde';
}

function bindUbsPatientActions() {
  document.querySelectorAll('[data-ubs-patient-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.ubsPatientView;
      if (view === 'specialties') {
        showUbsPatientSpecialties();
        return;
      }
      setUbsPatientView(view);
    });
  });
  document.querySelectorAll('[data-ubs-patient-specialties]').forEach((button) => {
    button.addEventListener('click', showUbsPatientSpecialties);
  });
  document.getElementById('ubs-patient-record-form')?.addEventListener('submit', saveUbsPatientRecord);
  document.getElementById('ubs-patient-referral-form')?.addEventListener('submit', referUbsPatientToCadh);
}

async function loadUbsPatient() {
  try {
    ubsPatientData = await SISELO.apiRequest(`/patients/show.php?id=${encodeURIComponent(ubsPatientId)}`);
    renderUbsPatientPage();
  } catch (error) {
    showUbsPatientError(error.message || 'Não foi possível carregar as informações do paciente.');
    disableUbsPatientActions();
  }
}

function renderUbsPatientPage() {
  const patient = ubsPatientData?.patient || {};
  const encounters = getSupportedUbsPatientEncounters();
  const transitions = Array.isArray(ubsPatientData?.transitions) ? ubsPatientData.transitions : [];

  renderUbsPatientSummary(patient);
  renderUbsPatientSpecialties(encounters);
  renderUbsPatientHistory(encounters);
  renderUbsPatientReferral(patient, transitions);

  const canCreateRecord = ubsPatientPermissions.has('encounters.create');
  const recordButton = document.getElementById('ubs-patient-new-record');
  if (recordButton) recordButton.hidden = !canCreateRecord;
  if (!canCreateRecord) {
    if (['specialties', 'record'].includes(ubsPatientCurrentView)) {
      ubsPatientCurrentView = 'history';
    }
    document.querySelectorAll('[data-ubs-specialty]').forEach((button) => {
      button.hidden = true;
    });
  }
  setUbsPatientView(ubsPatientCurrentView, false);
}

function renderUbsPatientSummary(patient) {
  const target = document.getElementById('ubs-patient-summary');
  if (!target) return;

  const meta = [
    ['CPF', patient.cpf || '—'],
    ['Nascimento', formatUbsPatientDate(patient.birth_date)],
    ['Idade', patient.age_label || '—'],
    ['Gênero', patient.gender_label || '—'],
    ['Telefone', patient.phone || '—'],
    ['E-mail', patient.email || '—'],
    ['UBS', patient.ubs_ref || '—'],
    ['Equipe', SISELO.formatTeamName(patient.team_ref) || '—'],
    ['Contato de emergência', patient.emergency_contact || '—'],
  ];
  const active = normalizeUbsPatientText(patient.status || 'ativo') !== 'inativo';
  document.title = `${patient.full_name || 'Paciente'} | SISELO`;

  target.innerHTML = `
    <div class="ubs-patient-context-profile">
      <span class="ubs-patient-avatar" aria-hidden="true">${SISELO.escapeHtml(getUbsPatientInitials(patient.full_name))}</span>
      <div>
        <div class="ubs-patient-name-row">
          <h2>${SISELO.escapeHtml(patient.full_name || 'Paciente')}</h2>
          <span class="ubs-patient-status ${active ? 'is-active' : 'is-inactive'}">${active ? 'Ativo' : 'Inativo'}</span>
        </div>
        <span class="ubs-patient-context-cpf">${SISELO.escapeHtml(patient.cpf || 'CPF não informado')}</span>
      </div>
    </div>
    <span class="ubs-patient-context-selected">Perfil selecionado</span>
    <details class="ubs-patient-context-details">
      <summary>Informações do paciente</summary>
      <div class="ubs-patient-context-meta">
        ${meta.map(([label, value]) => `
          <div>
            <span>${SISELO.escapeHtml(label)}</span>
            <strong>${SISELO.escapeHtml(value)}</strong>
          </div>
        `).join('')}
        <div>
          <span>Alergias</span>
          <strong>${SISELO.escapeHtml(patient.allergies || 'Nenhuma informação registrada.')}</strong>
        </div>
        <div>
          <span>Condições crônicas</span>
          <strong>${SISELO.escapeHtml(patient.chronic_conditions || 'Nenhuma informação registrada.')}</strong>
        </div>
      </div>
    </details>
  `;
}

function renderUbsPatientSpecialties(encounters) {
  const target = document.getElementById('ubs-patient-specialties');
  if (!target) return;

  target.innerHTML = `
    <div class="ubs-patient-specialty-table-header">
      <span>Especialidade</span>
      <span>Nº de registros</span>
      <span>Novo registro</span>
    </div>
    ${UBS_PATIENT_SPECIALTIES.map((specialty) => {
      const count = encounters.filter((row) => row.ubsSpecialty.key === specialty.key).length;
      return `
        <article class="ubs-patient-specialty-row">
          <div>
            <span class="ubs-patient-specialty-icon is-${specialty.tone}" aria-hidden="true">＋</span>
            <strong>${SISELO.escapeHtml(specialty.label)}</strong>
          </div>
          <span class="ubs-patient-specialty-count">${count} ${count === 1 ? 'registro' : 'registros'}</span>
          <button class="btn" type="button" data-ubs-specialty="${specialty.key}">+ Cadastrar</button>
        </article>
      `;
    }).join('')}
  `;

  target.querySelectorAll('[data-ubs-specialty]').forEach((button) => {
    button.addEventListener('click', () => openUbsPatientRecordForm(button.dataset.ubsSpecialty));
  });
}

function renderUbsPatientHistory(encounters) {
  const target = document.getElementById('ubs-patient-history');
  const count = document.getElementById('ubs-patient-record-count');
  if (!target || !count) return;

  count.textContent = `${encounters.length} ${encounters.length === 1 ? 'registro' : 'registros'}`;
  if (!ubsPatientPermissions.has('encounters.view')) {
    target.innerHTML = '<div class="ubs-patient-empty-state"><strong>Acesso restrito</strong><p>Seu perfil não possui permissão para visualizar registros clínicos.</p></div>';
    return;
  }
  if (!encounters.length) {
    target.innerHTML = '<div class="ubs-patient-empty-state"><strong>Nenhum registro clínico</strong><p>Os atendimentos cadastrados aparecerão aqui em ordem cronológica.</p></div>';
    return;
  }

  target.innerHTML = `<div class="ubs-patient-history-list">${encounters.map((row) => {
    const type = UBS_PATIENT_RECORD_TYPES[row.record_type] || UBS_PATIENT_RECORD_TYPES.consulta;
    return `
      <article class="ubs-patient-history-item">
        <span class="ubs-patient-history-marker is-${type.tone}" aria-hidden="true"></span>
        <div class="ubs-patient-history-content">
          <header>
            <div>
              <span class="ubs-patient-record-type is-${type.tone}">${SISELO.escapeHtml(type.label)}</span>
              <strong>${SISELO.escapeHtml(row.ubsSpecialty.label)}</strong>
            </div>
            <time datetime="${SISELO.escapeHtml(row.encounter_date || '')}">${SISELO.escapeHtml(formatUbsPatientDate(row.encounter_date))}</time>
          </header>
          <p>${SISELO.escapeHtml(row.summary || 'Registro sem descrição.')}</p>
          <small>Profissional: ${SISELO.escapeHtml(row.professional_name || 'Não informado')}</small>
        </div>
      </article>
    `;
  }).join('')}</div>`;
}

function renderUbsPatientReferral(patient, transitions) {
  const person = document.getElementById('ubs-patient-referral-person');
  const risk = document.getElementById('ubs-patient-risk');
  const status = document.getElementById('ubs-patient-referral-status');
  const submit = document.getElementById('ubs-patient-referral-submit');
  if (!person || !risk || !status || !submit) return;

  const referral = transitions.find(isActiveUbsPatientReferral);
  person.innerHTML = `
    <strong>${SISELO.escapeHtml(patient.full_name || 'Paciente')}</strong>
    <span>${SISELO.escapeHtml(patient.ubs_ref || 'UBS')} · ${SISELO.escapeHtml(SISELO.formatTeamName(patient.team_ref) || 'Sem equipe')}</span>
  `;
  risk.value = patient.risk_classification === 'muito_alto_risco' ? 'muito_alto_risco' : 'alto_risco';

  const canRefer = ubsPatientPermissions.has('careflow.update');
  if (referral) {
    status.className = 'is-referred';
    status.textContent = `Encaminhado em ${formatUbsPatientDate(referral.transition_date)}`;
    submit.textContent = 'Encaminhado';
    submit.disabled = true;
    risk.disabled = true;
  } else if (!canRefer) {
    status.className = '';
    status.textContent = 'Seu perfil não possui permissão para encaminhar.';
    submit.disabled = true;
    risk.disabled = true;
  } else {
    status.className = '';
    status.textContent = 'Aguardando encaminhamento';
    submit.textContent = 'Encaminhar';
    submit.disabled = false;
    risk.disabled = false;
  }
}

function showUbsPatientOverview() {
  setUbsPatientView('history');
}

function showUbsPatientSpecialties() {
  if (!ubsPatientPermissions.has('encounters.create')) return;
  setUbsPatientView('specialties');
}

function openUbsPatientRecordForm(specialtyKey) {
  const specialty = UBS_PATIENT_SPECIALTIES.find((item) => item.key === specialtyKey);
  if (!specialty || !ubsPatientPermissions.has('encounters.create')) return;

  ubsPatientSelectedSpecialty = specialty.key;
  document.getElementById('ubs-patient-record-title').textContent = specialty.label;
  document.getElementById('ubs-patient-record-specialty').value = specialty.label;
  document.getElementById('ubs-patient-record-summary').value = '';
  const consultation = document.querySelector('input[name="record_type"][value="consulta"]');
  if (consultation) consultation.checked = true;
  setUbsPatientView('record');
  document.getElementById('ubs-patient-record-summary')?.focus();
}

function setUbsPatientView(view, shouldScroll = true) {
  const history = document.getElementById('ubs-patient-history-view');
  const specialties = document.getElementById('ubs-patient-specialty-view');
  const record = document.getElementById('ubs-patient-record-view');
  const referral = document.getElementById('ubs-patient-referral-view');
  if (!history || !specialties || !record || !referral) return;

  const safeView = ['history', 'specialties', 'record', 'referral'].includes(view) ? view : 'history';
  ubsPatientCurrentView = safeView;
  history.hidden = safeView !== 'history';
  specialties.hidden = safeView !== 'specialties';
  record.hidden = safeView !== 'record';
  referral.hidden = safeView !== 'referral';

  const selectedNavigationView = safeView === 'record' ? 'specialties' : safeView;
  document.querySelectorAll('[data-ubs-patient-view]').forEach((button) => {
    const active = button.dataset.ubsPatientView === selectedNavigationView;
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (safeView !== 'record') {
    const url = new URL(window.location.href);
    url.searchParams.set('view', safeView);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  if (shouldScroll) {
    document.querySelector('.ubs-patient-followup-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function saveUbsPatientRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.getElementById('ubs-patient-record-submit');
  const specialty = UBS_PATIENT_SPECIALTIES.find((item) => item.key === ubsPatientSelectedSpecialty);
  const summary = String(document.getElementById('ubs-patient-record-summary')?.value || '').trim();
  const recordType = form.querySelector('input[name="record_type"]:checked')?.value || 'consulta';

  if (!specialty || !summary) {
    SISELO.showAlert('ubs-patient-alert', 'Selecione a especialidade e preencha a descrição do registro.', 'error');
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Salvando...';
  try {
    await SISELO.apiRequest(`/encounters/form.php?patient_id=${encodeURIComponent(ubsPatientId)}`, {
      method: 'POST',
      body: {
        patient_id: Number(ubsPatientId),
        encounter_date: SISELO.todayDateInputValue(),
        specialty: specialty.label,
        record_type: recordType,
        summary,
      },
    });
    await loadUbsPatient();
    setUbsPatientView('history');
    SISELO.showAlert('ubs-patient-alert', 'Registro clínico salvo no Acompanhamento.', 'success');
  } catch (error) {
    SISELO.showAlert('ubs-patient-alert', error.message || 'Não foi possível salvar o registro clínico.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Salvar registro';
  }
}

async function referUbsPatientToCadh(event) {
  event.preventDefault();
  const submit = document.getElementById('ubs-patient-referral-submit');
  const risk = document.getElementById('ubs-patient-risk')?.value || '';
  submit.disabled = true;
  submit.textContent = 'Encaminhando...';

  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: {
        action: 'refer',
        patient_id: Number(ubsPatientId),
        risk_classification: risk,
      },
    });
    await loadUbsPatient();
    SISELO.showAlert('ubs-patient-alert', 'Paciente encaminhado para o CADH com sucesso.', 'success');
  } catch (error) {
    submit.disabled = false;
    submit.textContent = 'Encaminhar';
    SISELO.showAlert('ubs-patient-alert', error.message || 'Não foi possível encaminhar o paciente.', 'error');
  }
}

function getSupportedUbsPatientEncounters() {
  const encounters = Array.isArray(ubsPatientData?.encounters) ? ubsPatientData.encounters : [];
  return encounters
    .map((row) => ({ ...row, ubsSpecialty: matchUbsPatientSpecialty(row.specialty) }))
    .filter((row) => Boolean(row.ubsSpecialty))
    .map((row) => ({
      ...row,
      record_type: UBS_PATIENT_RECORD_TYPES[row.record_type] ? row.record_type : 'consulta',
    }))
    .sort((first, second) => {
      const dateOrder = String(second.encounter_date || '').localeCompare(String(first.encounter_date || ''));
      return dateOrder || Number(second.id || 0) - Number(first.id || 0);
    });
}

function matchUbsPatientSpecialty(value) {
  const normalized = normalizeUbsPatientText(value);
  return UBS_PATIENT_SPECIALTIES.find((specialty) => (
    specialty.aliases.some((alias) => normalized.includes(normalizeUbsPatientText(alias)))
  )) || null;
}

function isActiveUbsPatientReferral(row) {
  const destination = normalizeUbsPatientText(row?.to_service);
  const status = normalizeUbsPatientText(row?.status);
  return destination.startsWith('cadh') && !['cancelada', 'concluida'].includes(status);
}

function disableUbsPatientActions() {
  ['ubs-patient-new-record', 'ubs-patient-referral-submit'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.disabled = true;
  });
}

function showUbsPatientError(message) {
  SISELO.showAlert('ubs-patient-alert', message, 'error');
  const target = document.getElementById('ubs-patient-summary');
  if (target) {
    target.innerHTML = '<div class="ubs-patient-empty-state"><strong>Paciente não encontrado</strong><p>Volte para a Lista de Pacientes e selecione outro registro.</p></div>';
  }
}

function getUbsPatientInitials(name) {
  return String(name || 'P')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function formatUbsPatientDate(value) {
  if (!value) return '—';
  const date = SISELO.parseDateInputValue(value);
  return date ? new Intl.DateTimeFormat('pt-BR').format(date) : String(value);
}

function normalizeUbsPatientText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
