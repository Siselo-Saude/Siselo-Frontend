const CADH_HISTORY_SEARCH_KEY = 'siselo_cadh_search';

const CADH_HISTORY_SPECIALTIES = [
  { key: 'tecnico', label: 'Técnico de Enfermagem', storageKey: 'siselo_cadh_tecnico_records', path: '/cadh/tecnico.html' },
  { key: 'gestor', label: 'Gestor do Cuidado', storageKey: 'siselo_cadh_gestor_records', path: '/cadh/gestor.html' },
  { key: 'psicologia', label: 'Psicologia', storageKey: 'siselo_cadh_psicologia_records', path: '/cadh/psicologia.html' },
  { key: 'enfermagem', label: 'Enfermagem', storageKey: 'siselo_cadh_enfermagem_records', path: '/cadh/enfermagem.html' },
  { key: 'nutricao', label: 'Nutrição', storageKey: 'siselo_cadh_nutricao_records', path: '/cadh/nutricao.html' },
  { key: 'endocrino', label: 'Endocrinologia', storageKey: 'siselo_cadh_endocrino_records', path: '/cadh/endocrino.html' },
  { key: 'cardiologia', label: 'Cardiologia', storageKey: 'siselo_cadh_cardiologia_records', path: '/cadh/cardiologia.html' },
  { key: 'oftalmo', label: 'Oftalmologia', storageKey: 'siselo_cadh_oftalmo_records', path: '/cadh/oftalmologia.html' },
  { key: 'fisioterapia', label: 'Fisioterapia', storageKey: 'siselo_cadh_fisioterapia_records', path: '/cadh/fisioterapia.html' },
  { key: 'social', label: 'Serviço Social', storageKey: 'siselo_cadh_social_records', path: '/cadh/servico-social.html' },
  { key: 'farmacia', label: 'Farmácia Clínica', storageKey: 'siselo_cadh_farmacia_records', path: '/cadh/farmacia.html' },
];

const CADH_HISTORY_METADATA_FIELDS = new Set([
  'id',
  'record_id',
  'patient_id',
  'full_name',
  'cpf',
  'team_ref',
  'birth_date',
  'first_cadh_date',
  'age_label',
  'race',
  'consultation_date',
  'consultation_number',
  'encounter_date',
  'specialty',
  'record_type',
  'summary',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by_user_id',
]);

const CADH_HISTORY_FIELD_LABELS = {
  notes: 'Observações',
  observations: 'Observações',
  observacoes: 'Observações',
  descricao: 'Descrição',
  description: 'Descrição',
  anamnese: 'Anamnese',
  assessment: 'Avaliação',
  avaliacao: 'Avaliação',
  conduct: 'Conduta',
  conduta: 'Conduta',
  peso: 'Peso',
  altura: 'Altura',
  imc: 'IMC',
  risk_correct: 'Estratificação de risco correta?',
  health_condition: 'Condição de saúde',
  risk_classification: 'Estratificação de risco',
  other_conditions: 'Outras condições de saúde',
  needs_oftalmo: 'Necessário avaliação da oftalmologia?',
  oftalmo_schedule_date: 'Data de regulação/agendamento — Oftalmologia',
  oftalmo_execution_date: 'Data da execução — Oftalmologia',
  needs_angio: 'Necessário avaliação da angiologia?',
  angio_schedule_date: 'Data de regulação/agendamento — Angiologia',
  angio_execution_date: 'Data da execução — Angiologia',
  needs_nefro: 'Necessário avaliação da nefrologia?',
  nefro_schedule_date: 'Data de regulação/agendamento — Nefrologia',
  nefro_execution_date: 'Data da execução — Nefrologia',
  needs_neuro: 'Necessário avaliação da neurologia?',
  needs_stress_test: 'Necessário regulação para teste ergométrico?',
  needs_mapa_holter: 'Necessário regulação para MAPA/Holter?',
  needs_echo: 'Necessário regulação para ecocardiograma?',
};

let cadhHistoryPatient = null;
let cadhHistoryRecords = [];
let cadhHistoryPermissions = new Set();

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.cadhScreen === 'history') {
    setupCadhHistoryPage();
  }
});

async function setupCadhHistoryPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  cadhHistoryPermissions = SISELO.getUiPermissions(user);
  SISELO.bindShell('cadh');
  SISELO.syncCurrentDate?.();

  const patientId = getCadhHistoryPatientId();
  if (!patientId) {
    renderCadhHistoryError('Selecione um paciente no Acompanhamento do CADH para consultar o histórico.');
    return;
  }

  try {
    const [context, fieldLabels] = await Promise.all([
      SISELO.loadPatientClinicalContext(patientId),
      loadCadhHistoryFieldLabels(),
    ]);
    cadhHistoryPatient = context && context.patient ? context.patient : null;
    if (!cadhHistoryPatient) {
      throw new Error('Paciente não encontrado.');
    }

    const specialtyRecords = collectCadhSpecialtyRecords(patientId, fieldLabels);
    const clinicalRecords = collectCadhClinicalRecords(context && context.encounters);
    cadhHistoryRecords = [...specialtyRecords, ...clinicalRecords].sort(compareCadhHistoryRecords);

    renderCadhHistoryPatient(cadhHistoryPatient);
    renderCadhHistorySpecialtyOptions(cadhHistoryRecords);
    bindCadhHistoryFilters();
    renderCadhHistoryRecords();
  } catch (error) {
    renderCadhHistoryError(error.message || 'Não foi possível carregar o histórico de atendimentos.');
  }
}

function getCadhHistoryPatientId() {
  const queryId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  if (queryId) return queryId;

  try {
    const state = JSON.parse(sessionStorage.getItem(CADH_HISTORY_SEARCH_KEY) || 'null');
    return SISELO.normalizeEntityId(state && state.patient && state.patient.id);
  } catch (error) {
    return '';
  }
}

async function loadCadhHistoryFieldLabels() {
  const entries = await Promise.all(CADH_HISTORY_SPECIALTIES.map(async (specialty) => {
    try {
      const response = await fetch(specialty.path);
      if (!response.ok) return [specialty.key, {}];
      const html = await response.text();
      const documentNode = new DOMParser().parseFromString(html, 'text/html');
      const labels = {};

      documentNode.querySelectorAll('input[name], select[name], textarea[name]').forEach((control) => {
        const name = String(control.getAttribute('name') || '').trim();
        if (!name || CADH_HISTORY_METADATA_FIELDS.has(name)) return;
        const container = control.closest('.field, .field-full');
        const label = cleanCadhHistoryLabel(container?.querySelector('label')?.textContent || '');
        if (label) labels[name] = label;
      });
      return [specialty.key, labels];
    } catch (error) {
      return [specialty.key, {}];
    }
  }));

  return Object.fromEntries(entries);
}

function collectCadhSpecialtyRecords(patientId, fieldLabels) {
  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  return CADH_HISTORY_SPECIALTIES.flatMap((specialty) => (
    readCadhHistoryStorage(specialty.storageKey)
      .filter((record) => SISELO.normalizeEntityId(record && record.patient_id) === normalizedPatientId)
      .map((record) => {
        const details = buildCadhHistoryDetails(record, fieldLabels[specialty.key] || {});
        return {
          id: `${specialty.key}:${String(record.id || '')}`,
          recordId: String(record.id || ''),
          source: 'specialty',
          specialtyKey: specialty.key,
          specialty: specialty.label,
          date: String(record.consultation_date || record.encounter_date || '').trim(),
          consultation: String(record.consultation_number || 'Atendimento').trim(),
          updatedAt: String(record.updated_at || '').trim(),
          summary: getCadhHistorySummary(record, details),
          details,
          editHref: `${specialty.path}?patient_id=${encodeURIComponent(normalizedPatientId)}&record_id=${encodeURIComponent(record.id || '')}&return=history`,
        };
      })
  ));
}

function collectCadhClinicalRecords(rows) {
  return (Array.isArray(rows) ? rows : []).map((record) => {
    const summary = String(record.summary || '').trim();
    const details = summary ? [{ label: 'Resumo', value: summary }] : [];
    return {
      id: `clinical:${String(record.id || '')}`,
      recordId: String(record.id || ''),
      source: 'clinical',
      specialtyKey: normalizeCadhHistoryText(record.specialty || 'registro-clinico'),
      specialty: String(record.specialty || 'Registro clínico').trim(),
      date: String(record.encounter_date || '').trim(),
      consultation: formatCadhHistoryRecordType(record.record_type),
      updatedAt: String(record.updated_at || record.created_at || '').trim(),
      summary: summary || 'Registro clínico realizado.',
      details,
      editHref: '',
    };
  });
}

function buildCadhHistoryDetails(record, specialtyLabels) {
  return Object.entries(record || {})
    .filter(([name, value]) => (
      !CADH_HISTORY_METADATA_FIELDS.has(name) &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
    ))
    .map(([name, value]) => ({
      label: specialtyLabels[name] || CADH_HISTORY_FIELD_LABELS[name] || humanizeCadhHistoryField(name),
      value: formatCadhHistoryValue(name, value),
    }));
}

function getCadhHistorySummary(record, details) {
  const preferredFields = ['summary', 'anamnese', 'descricao', 'description', 'observacoes', 'notes', 'assessment', 'avaliacao', 'conduta'];
  for (const field of preferredFields) {
    const value = String(record && record[field] || '').trim();
    if (value) return value;
  }
  return details.length
    ? `${details.length} ${details.length === 1 ? 'informação clínica registrada' : 'informações clínicas registradas'}.`
    : 'Atendimento registrado sem descrição adicional.';
}

function renderCadhHistoryPatient(patient) {
  const container = document.getElementById('cadh-history-patient');
  if (!container) return;

  const name = String(patient.full_name || 'Paciente');
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'P';
  container.innerHTML = `
    <span class="cadh-history-avatar" aria-hidden="true">${SISELO.escapeHtml(initials)}</span>
    <div>
      <span>Paciente selecionado</span>
      <strong>${SISELO.escapeHtml(name)}</strong>
      <small>CPF ${SISELO.escapeHtml(patient.cpf || '-')} · ${SISELO.escapeHtml(patient.ubs_ref || 'UBS não informada')} · ${SISELO.escapeHtml(SISELO.formatTeamName(patient.team_ref))}</small>
    </div>
  `;
}

function renderCadhHistorySpecialtyOptions(records) {
  const select = document.getElementById('cadh-history-specialty');
  if (!select) return;

  const specialties = [...new Set(records.map((record) => record.specialty).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
  select.innerHTML = `
    <option value="">Todas as especialidades</option>
    ${specialties.map((specialty) => `<option value="${SISELO.escapeHtml(specialty)}">${SISELO.escapeHtml(specialty)}</option>`).join('')}
  `;
}

function bindCadhHistoryFilters() {
  document.getElementById('cadh-history-query')?.addEventListener('input', renderCadhHistoryRecords);
  document.getElementById('cadh-history-specialty')?.addEventListener('change', renderCadhHistoryRecords);
  document.getElementById('cadh-history-filters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    renderCadhHistoryRecords();
  });
}

function renderCadhHistoryRecords() {
  const list = document.getElementById('cadh-history-list');
  const count = document.getElementById('cadh-history-count');
  if (!list || !count) return;

  const query = normalizeCadhHistoryText(document.getElementById('cadh-history-query')?.value || '');
  const specialty = String(document.getElementById('cadh-history-specialty')?.value || '');
  const filtered = cadhHistoryRecords.filter((record) => {
    if (specialty && record.specialty !== specialty) return false;
    if (!query) return true;
    const searchText = normalizeCadhHistoryText([
      record.specialty,
      record.consultation,
      record.date,
      record.summary,
      ...record.details.flatMap((detail) => [detail.label, detail.value]),
    ].join(' '));
    return searchText.includes(query);
  });

  count.textContent = `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`;
  if (!filtered.length) {
    list.innerHTML = `
      <div class="cadh-history-empty">
        <strong>Nenhum atendimento encontrado</strong>
        <p>${cadhHistoryRecords.length ? 'Ajuste os filtros para consultar outros registros.' : 'Ainda não existem registros clínicos para este paciente.'}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(renderCadhHistoryCard).join('');
}

function renderCadhHistoryCard(record) {
  const canEdit = record.source === 'specialty' &&
    record.editHref &&
    cadhHistoryPermissions.has('encounters.update');
  return `
    <article class="cadh-history-card" data-history-source="${SISELO.escapeHtml(record.source)}" data-history-specialty="${SISELO.escapeHtml(record.specialtyKey)}">
      <header>
        <div class="cadh-history-card-tags">
          <span>${SISELO.escapeHtml(record.specialty)}</span>
          <small>${SISELO.escapeHtml(record.consultation)}</small>
        </div>
        <time datetime="${SISELO.escapeHtml(record.date)}">${SISELO.escapeHtml(formatCadhHistoryDate(record.date))}</time>
      </header>
      <p class="cadh-history-card-summary">${SISELO.escapeHtml(record.summary)}</p>
      <div class="cadh-history-card-meta">
        <span>Atualizado em ${SISELO.escapeHtml(formatCadhHistoryDateTime(record.updatedAt))}</span>
        ${canEdit ? `<a href="${SISELO.escapeHtml(record.editHref)}">Editar atendimento</a>` : ''}
      </div>
      ${record.details.length ? `
        <details class="cadh-history-details">
          <summary>Ver informações do atendimento</summary>
          <dl>
            ${record.details.map((detail) => `
              <div>
                <dt>${SISELO.escapeHtml(detail.label)}</dt>
                <dd>${SISELO.escapeHtml(detail.value)}</dd>
              </div>
            `).join('')}
          </dl>
        </details>
      ` : ''}
    </article>
  `;
}

function renderCadhHistoryError(message) {
  const alert = document.getElementById('cadh-history-alert');
  const list = document.getElementById('cadh-history-list');
  if (alert) {
    alert.hidden = false;
    alert.className = 'alert alert-error';
    alert.textContent = message;
  }
  if (list) {
    list.innerHTML = `
      <div class="cadh-history-empty">
        <strong>Histórico indisponível</strong>
        <p>${SISELO.escapeHtml(message)}</p>
      </div>
    `;
  }
}

function readCadhHistoryStorage(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function compareCadhHistoryRecords(left, right) {
  const dateOrder = String(right.date || '').localeCompare(String(left.date || ''));
  if (dateOrder !== 0) return dateOrder;
  const updateOrder = String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  if (updateOrder !== 0) return updateOrder;
  return String(right.id || '').localeCompare(String(left.id || ''));
}

function cleanCadhHistoryLabel(value) {
  return String(value || '').replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').trim();
}

function humanizeCadhHistoryField(name) {
  const text = String(name || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Informação';
}

function formatCadhHistoryValue(name, value) {
  if (String(name).includes('date')) return formatCadhHistoryDate(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatCadhHistoryRecordType(value) {
  const labels = {
    diagnostico: 'Diagnóstico',
    exame: 'Exame',
    consulta: 'Consulta',
  };
  const key = normalizeCadhHistoryText(value).replace(/\s+/g, '_');
  return labels[key] || String(value || 'Atendimento');
}

function formatCadhHistoryDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) return value || 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatCadhHistoryDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeCadhHistoryText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
