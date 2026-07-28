const CADH_FLOW_COLUMNS = [
  { key: 'aguardando_agendamento', label: 'Aguardando Agendamento', withoutAppointment: true },
  { key: 'agendado', label: 'Agendados' },
  { key: 'atendido', label: 'Atendidos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'ausente', label: 'Ausentes' },
];

const CADH_SPECIALTY_RECORD_ROUTES = {
  'tecnico de enfermagem': '/cadh/tecnico.html',
  'gestor do cuidado': '/cadh/gestor.html',
  psicologia: '/cadh/psicologia.html',
  psicologo: '/cadh/psicologia.html',
  enfermagem: '/cadh/enfermagem.html',
  enfermeiro: '/cadh/enfermagem.html',
  nutricao: '/cadh/nutricao.html',
  endocrinologia: '/cadh/endocrino.html',
  cardiologia: '/cadh/cardiologia.html',
  oftalmologia: '/cadh/oftalmologia.html',
  fisioterapia: '/cadh/fisioterapia.html',
  'servico social': '/cadh/servico-social.html',
  'farmacia clinica': '/cadh/farmacia.html',
};

const CADH_DEFAULT_OUTCOME_REASONS = {
  patient_absent: 'Ausência do paciente',
  professional_absent: 'Ausência do profissional',
  internal_cancellation: 'Cancelamento interno',
  unit_impediment: 'Impedimento da unidade',
  other: 'Outro impedimento',
};

let cadhFlowRows = [];
let cadhScheduleRows = [];
let cadhFinalizedRows = [];
let cadhFlowPermissions = new Set();
let cadhFlowTab = 'received';
let cadhFlowQuery = '';
let cadhFlowRisk = '';
let cadhFlowWeekday = 'all';
let cadhFlowReferralDetailPatientId = '';
let cadhFlowSharingPatientId = '';
let cadhFlowOutcomeAppointmentId = '';
let cadhFlowOutcomeReasons = { ...CADH_DEFAULT_OUTCOME_REASONS };

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'cadh') {
    setupCadhFlow();
  }
});

async function setupCadhFlow() {
  const user = await SISELO.requireSession();
  if (!user) return;

  cadhFlowPermissions = SISELO.getUiPermissions(user);
  const initialFlow = SISELO.queryParam('flow') || 'received';
  if (initialFlow === 'sharing') {
    cadhFlowSharingPatientId = SISELO.normalizeEntityId(SISELO.queryParam('patient_id'));
  }
  bindCadhFlowTabs();
  await loadCadhFlow();
  activateCadhFlowTab(initialFlow);
}

function bindCadhFlowTabs() {
  document.querySelectorAll('[data-cadh-flow-tab]').forEach((button) => {
    button.addEventListener('click', () => activateCadhFlowTab(button.dataset.cadhFlowTab));
  });
}

function activateCadhFlowTab(tab) {
  cadhFlowTab = ['received', 'schedule', 'followup', 'sharing', 'finalized'].includes(tab)
    ? tab
    : 'received';

  document.querySelectorAll('[data-cadh-flow-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.cadhFlowTab === cadhFlowTab);
  });

  const url = new URL(window.location.href);
  if (cadhFlowTab === 'received') {
    url.searchParams.delete('flow');
  } else {
    url.searchParams.set('flow', cadhFlowTab);
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

  const clinicalWorkspace = document.getElementById('cadh-clinical-workspace');
  const flowWorkspace = document.getElementById('cadh-flow-workspace');
  const flowTabs = document.querySelector('.cadh-flow-tabs');
  if (clinicalWorkspace) {
    clinicalWorkspace.hidden = cadhFlowTab !== 'followup';
  }
  if (flowWorkspace) {
    flowWorkspace.hidden = cadhFlowTab === 'followup';
  }
  if (flowTabs) {
    flowTabs.hidden = !['received', 'schedule'].includes(cadhFlowTab);
  }
  document.body.dataset.cadhView = cadhFlowTab;
  renderCadhFlowPanel();
}

async function loadCadhFlow() {
  try {
    const [activeData, scheduleData, finalizedData] = await Promise.all([
      SISELO.apiRequest('/care_flow/list.php?care_status=active'),
      SISELO.apiRequest('/care_flow/list.php?care_status=active&appointment_scope=all'),
      SISELO.apiRequest('/care_flow/list.php?care_status=finalizado'),
    ]);
    cadhFlowRows = Array.isArray(activeData.rows) ? activeData.rows : [];
    cadhScheduleRows = Array.isArray(scheduleData.rows) ? scheduleData.rows : [];
    cadhFinalizedRows = Array.isArray(finalizedData.rows) ? finalizedData.rows : [];
    cadhFlowOutcomeReasons = activeData.options?.appointment_outcome_reasons || { ...CADH_DEFAULT_OUTCOME_REASONS };
    updateCadhFlowIndicators();
    renderCadhFlowPanel();
  } catch (error) {
    renderCadhFlowError(error.message || 'Não foi possível carregar o fluxo assistencial.');
  }
}

function renderCadhFlowPanel() {
  const panel = document.getElementById('cadh-flow-panel');
  if (!panel) return;

  if (cadhFlowTab === 'received') {
    renderCadhReceived(panel);
  } else if (cadhFlowTab === 'schedule') {
    renderCadhKanban(panel);
  } else if (cadhFlowTab === 'sharing') {
    renderCadhSharing(panel);
  } else if (cadhFlowTab === 'finalized') {
    renderCadhFinalized(panel);
  } else {
    panel.innerHTML = `
      <div class="cadh-flow-context">
        <strong>Acompanhamentos e prontuário</strong>
        <p>Selecione o paciente abaixo para acessar histórico, registros clínicos e módulos por especialidade.</p>
      </div>
    `;
  }
  SISELO.applyUiComponents(panel);
}

function renderCadhReceived(panel) {
  const rows = filterCadhFlowRows(cadhFlowRows);
  panel.innerHTML = `
    <form id="cadh-received-filters" class="cadh-flow-filters">
      <label>
        <span>Nome do paciente</span>
        <input name="query" value="${SISELO.escapeHtml(cadhFlowQuery)}" placeholder="Buscar por nome ou CPF..." autocomplete="off">
      </label>
      <label>
        <span>Classificação de risco</span>
        <select name="risk">
          <option value="">Todos os riscos</option>
          <option value="alto_risco" ${cadhFlowRisk === 'alto_risco' ? 'selected' : ''}>Alto Risco</option>
          <option value="muito_alto_risco" ${cadhFlowRisk === 'muito_alto_risco' ? 'selected' : ''}>Muito Alto Risco</option>
        </select>
      </label>
      <button class="btn" type="button" data-cadh-clear-filters>Limpar</button>
    </form>

    <div class="cadh-received-list">
      ${rows.length ? rows.map(renderCadhReceivedCard).join('') : renderCadhFlowEmpty('Nenhum paciente corresponde aos filtros informados.')}
    </div>
    ${cadhFlowReferralDetailPatientId
      ? renderCadhReferralDetail(findCadhFlowPatient(cadhFlowReferralDetailPatientId))
      : ''}
  `;
  bindCadhReceivedControls(panel);
}

function renderCadhReceivedCard(row) {
  const veryHigh = row.risk_classification === 'muito_alto_risco';
  const received = Boolean(row.referral_received_at);
  return `
    <article class="cadh-received-card ${veryHigh ? 'is-very-high-risk' : ''}">
      <div class="cadh-received-main">
        <div>
          <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
          <span>${SISELO.escapeHtml(row.ubs_ref || 'UBS não informada')} · ${SISELO.escapeHtml(SISELO.formatTeamName(row.team_ref) || 'Equipe não informada')}</span>
        </div>
        <span class="cadh-risk-chip ${veryHigh ? 'is-critical' : 'is-high'}">
          ${veryHigh ? '⚠ ' : ''}${SISELO.escapeHtml(row.risk_label || 'Alto Risco')}
        </span>
      </div>
      <div class="cadh-received-actions">
        ${received
          ? `<span class="cadh-receipt-status"><span aria-hidden="true">✓</span>Recebido</span>`
          : canCadhFlow('careflow.update')
            ? `<button class="btn btn-primary cadh-confirm-receipt" type="button" data-cadh-confirm-receipt="${row.id}">Confirmar recebimento</button>`
            : '<span class="cadh-receipt-pending">Aguardando confirmação</span>'}
        <button class="btn cadh-referral-view" type="button" data-cadh-referral-detail="${row.id}" aria-label="Visualizar informações do encaminhamento de ${SISELO.escapeHtml(row.full_name || 'paciente')}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </article>
  `;
}

function renderCadhReferralDetail(row) {
  if (!row) return '';
  const received = Boolean(row.referral_received_at);
  const origin = row.referral_from_service || row.ubs_ref || 'UBS não informada';
  const destination = row.referral_to_service || 'CADH';
  return `
    <div class="cadh-referral-modal-backdrop" data-cadh-close-referral>
      <section
        class="cadh-referral-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadh-referral-modal-title"
        tabindex="-1"
      >
        <header>
          <div>
            <span>Encaminhamento UBS → CADH</span>
            <h3 id="cadh-referral-modal-title">${SISELO.escapeHtml(row.full_name || 'Paciente')}</h3>
          </div>
          <button type="button" data-cadh-close-referral aria-label="Fechar detalhes do encaminhamento">×</button>
        </header>

        <div class="cadh-referral-route">
          <strong>${SISELO.escapeHtml(origin)}</strong>
          <span aria-hidden="true">→</span>
          <strong>${SISELO.escapeHtml(destination)}</strong>
        </div>

        <dl class="cadh-referral-detail-grid">
          <div>
            <dt>Equipe de origem</dt>
            <dd>${SISELO.escapeHtml(SISELO.formatTeamName(row.team_ref) || 'Não informada')}</dd>
          </div>
          <div>
            <dt>Data do encaminhamento</dt>
            <dd>${SISELO.escapeHtml(formatCadhFlowDate(row.referral_date || row.first_cadh_date))}</dd>
          </div>
          <div>
            <dt>Classificação de risco</dt>
            <dd>${SISELO.escapeHtml(row.risk_label || 'Não informada')}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>${received ? 'Recebido pelo CADH' : 'Aguardando recebimento'}</dd>
          </div>
          ${received ? `
            <div>
              <dt>Data de recebimento pelo CADH</dt>
              <dd>${SISELO.escapeHtml(formatCadhFlowDate(row.referral_received_at))}</dd>
            </div>
          ` : ''}
        </dl>
      </section>
    </div>
  `;
}

function bindCadhReceivedControls(panel) {
  const filterForm = panel.querySelector('#cadh-received-filters');
  filterForm?.querySelector('[name="query"]')?.addEventListener('input', (event) => {
    cadhFlowQuery = event.currentTarget.value;
    renderCadhReceived(panel);
  });
  filterForm?.querySelector('[name="risk"]')?.addEventListener('change', (event) => {
    cadhFlowRisk = event.currentTarget.value;
    renderCadhReceived(panel);
  });
  filterForm?.querySelector('[data-cadh-clear-filters]')?.addEventListener('click', () => {
    cadhFlowQuery = '';
    cadhFlowRisk = '';
    renderCadhReceived(panel);
  });

  panel.querySelectorAll('[data-cadh-confirm-receipt]').forEach((button) => {
    button.addEventListener('click', () => confirmCadhReceipt(button.dataset.cadhConfirmReceipt, button));
  });
  panel.querySelectorAll('[data-cadh-referral-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      cadhFlowReferralDetailPatientId = button.dataset.cadhReferralDetail;
      renderCadhReceived(panel);
      panel.querySelector('.cadh-referral-modal')?.focus();
    });
  });
  panel.querySelectorAll('[data-cadh-close-referral]').forEach((control) => {
    control.addEventListener('click', (event) => {
      if (control.classList.contains('cadh-referral-modal-backdrop') && event.target !== control) {
        return;
      }
      cadhFlowReferralDetailPatientId = '';
      renderCadhReceived(panel);
    });
  });
  panel.querySelector('.cadh-referral-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cadhFlowReferralDetailPatientId = '';
      renderCadhReceived(panel);
    }
  });
}

async function confirmCadhReceipt(patientId, button) {
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Confirmando...';
  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: {
        action: 'confirm_receipt',
        patient_id: Number(patientId),
      },
    });
    showCadhFlowAlert('Recebimento confirmado com sucesso.', 'success');
    await loadCadhFlow();
    activateCadhFlowTab('schedule');
  } catch (error) {
    button.disabled = false;
    button.textContent = previousLabel;
    showCadhFlowAlert(error.message || 'Não foi possível confirmar o recebimento.', 'error');
  }
}

function renderCadhKanban(panel) {
  const rows = cadhScheduleRows
    .filter((row) => Boolean(row.referral_received_at))
    .filter(matchesCadhFlowWeekday);
  panel.innerHTML = `
    <div class="cadh-kanban-toolbar">
      <div>
        <strong>Agenda de pacientes</strong>
        <span>Fluxo operacional sem duplicar o registro clínico.</span>
      </div>
      <label>
        <span>Dia da semana</span>
        <select id="cadh-weekday-filter">
          <option value="all">Todos os dias</option>
          <option value="1" ${cadhFlowWeekday === '1' ? 'selected' : ''}>Segunda-feira</option>
          <option value="2" ${cadhFlowWeekday === '2' ? 'selected' : ''}>Terça-feira</option>
          <option value="3" ${cadhFlowWeekday === '3' ? 'selected' : ''}>Quarta-feira</option>
          <option value="4" ${cadhFlowWeekday === '4' ? 'selected' : ''}>Quinta-feira</option>
          <option value="5" ${cadhFlowWeekday === '5' ? 'selected' : ''}>Sexta-feira</option>
          <option value="6" ${cadhFlowWeekday === '6' ? 'selected' : ''}>Sábado</option>
          <option value="0" ${cadhFlowWeekday === '0' ? 'selected' : ''}>Domingo</option>
        </select>
      </label>
    </div>
    <div class="cadh-kanban">
      ${CADH_FLOW_COLUMNS.map((column) => renderCadhKanbanColumn(column, rows)).join('')}
    </div>
    ${cadhFlowOutcomeAppointmentId ? renderCadhAppointmentOutcomeModal(findCadhFlowAppointment(cadhFlowOutcomeAppointmentId)) : ''}
  `;
  panel.querySelector('#cadh-weekday-filter')?.addEventListener('change', (event) => {
    cadhFlowWeekday = event.currentTarget.value;
    renderCadhKanban(panel);
  });
  panel.querySelectorAll('[data-cadh-kanban-schedule]').forEach((button) => {
    button.addEventListener('click', () => {
      openCadhClinicalScheduling(button.dataset.cadhKanbanSchedule);
    });
  });
  panel.querySelectorAll('[data-cadh-reschedule]').forEach((button) => {
    button.addEventListener('click', () => {
      openCadhClinicalScheduling(
        button.dataset.cadhReschedule,
        button.dataset.cadhRescheduleSpecialty || ''
      );
    });
  });
  panel.querySelectorAll('[data-cadh-register-appointment]').forEach((button) => {
    button.addEventListener('click', () => openCadhAppointmentRecord(button.dataset.cadhRegisterAppointment));
  });
  panel.querySelectorAll('[data-cadh-open-outcome]').forEach((button) => {
    button.addEventListener('click', () => {
      cadhFlowOutcomeAppointmentId = button.dataset.cadhOpenOutcome;
      renderCadhKanban(panel);
      panel.querySelector('.cadh-outcome-modal')?.focus();
    });
  });
  bindCadhAppointmentOutcomeModal(panel);
}

function renderCadhKanbanColumn(column, rows) {
  const columnRows = rows.filter((row) => {
    if (column.withoutAppointment) {
      return !row.appointment_id;
    }
    return Boolean(row.appointment_id) && normalizeCadhAppointmentStatus(row.appointment_status) === column.key;
  });
  return `
    <section class="cadh-kanban-column" data-kanban-column="${column.key}">
      <header><strong>${column.label}</strong><span>${columnRows.length}</span></header>
      <div>
        ${columnRows.length ? columnRows.map((row) => renderCadhKanbanCard(row, column.key)).join('') : '<p class="cadh-kanban-empty">Nenhum paciente</p>'}
      </div>
    </section>
  `;
}

function renderCadhKanbanCard(row, status) {
  const veryHigh = row.risk_classification === 'muito_alto_risco';
  const normalizedStatus = normalizeCadhAppointmentStatus(status);
  const canRegister = normalizedStatus === 'agendado' && canCadhFlow('encounters.create');
  const canResolve = normalizedStatus === 'agendado' && canCadhFlow('careflow.update');
  const canReschedule = ['pendente', 'ausente'].includes(normalizedStatus)
    && canCadhFlow('careflow.schedule');
  const outcomeLabel = row.appointment_outcome_reason_label || '';
  return `
    <article class="cadh-kanban-card ${veryHigh ? 'is-critical' : ''}">
      <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
      <span>${SISELO.escapeHtml(row.scheduled_at ? formatCadhFlowDateTime(row.scheduled_at) : 'Sem data definida')}</span>
      <small>${SISELO.escapeHtml(row.appointment_specialty || row.ubs_ref || '')}</small>
      <span class="cadh-risk-chip ${veryHigh ? 'is-critical' : 'is-high'}">${SISELO.escapeHtml(row.risk_label || 'Alto Risco')}</span>
      ${normalizedStatus === 'agendado' ? `
        <div class="cadh-kanban-card-actions">
          ${canRegister ? `<button class="btn btn-primary" type="button" data-cadh-register-appointment="${row.appointment_id}">Registrar atendimento</button>` : ''}
          ${canResolve ? `<button class="btn" type="button" data-cadh-open-outcome="${row.appointment_id}">Não realizado</button>` : ''}
        </div>
      ` : row.appointment_id ? `
        <div class="cadh-kanban-outcome">
          <strong>${SISELO.escapeHtml(outcomeLabel || row.appointment_status_label || CADH_FLOW_COLUMNS.find((column) => column.key === normalizedStatus)?.label || '')}</strong>
          ${row.appointment_outcome_notes ? `<span>${SISELO.escapeHtml(row.appointment_outcome_notes)}</span>` : ''}
          ${row.appointment_resolved_at ? `<time>${SISELO.escapeHtml(formatCadhFlowDateTime(row.appointment_resolved_at))}</time>` : ''}
        </div>
        ${canReschedule ? `
          <div class="cadh-kanban-card-actions">
            <button
              class="btn btn-primary"
              type="button"
              data-cadh-reschedule="${row.id}"
              data-cadh-reschedule-specialty="${SISELO.escapeHtml(row.appointment_specialty || '')}"
            >Reagendar</button>
          </div>
        ` : ''}
      ` : canCadhFlow('careflow.schedule') ? `<button class="btn" type="button" data-cadh-kanban-schedule="${row.id}">Definir data</button>` : ''}
    </article>
  `;
}

function openCadhClinicalScheduling(patientId, specialty = '') {
  const patient = findCadhFlowPatient(patientId);
  if (!patient) {
    showCadhFlowAlert('Paciente não encontrado para agendamento.', 'error');
    return;
  }

  saveCadhSearchState(patient, patient.cpf);
  const url = new URL('/cadh/index.html', window.location.origin);
  url.searchParams.set('flow', 'followup');
  url.searchParams.set('view', 'encounters');
  url.searchParams.set('patient_id', String(patient.id));
  if (specialty) {
    url.searchParams.set('schedule_specialty', specialty);
  }
  window.location.assign(`${url.pathname}${url.search}`);
}

function openCadhAppointmentRecord(appointmentId) {
  const row = findCadhFlowAppointment(appointmentId);
  if (!row) {
    showCadhFlowAlert('Agendamento não encontrado.', 'error');
    return;
  }

  const route = CADH_SPECIALTY_RECORD_ROUTES[normalizeCadhSpecialty(row.appointment_specialty)];
  if (!route) {
    showCadhFlowAlert('O módulo clínico deste agendamento não foi identificado.', 'error');
    return;
  }

  saveCadhSearchState(row, row.cpf);
  const url = new URL(route, window.location.origin);
  url.searchParams.set('patient_id', String(row.id));
  url.searchParams.set('appointment_id', String(row.appointment_id));
  url.searchParams.set('return_to', '/cadh/index.html?flow=schedule');
  window.location.assign(`${url.pathname}${url.search}`);
}

function renderCadhAppointmentOutcomeModal(row) {
  if (!row) return '';
  return `
    <div class="cadh-outcome-modal-backdrop" data-cadh-close-outcome>
      <section class="cadh-outcome-modal" role="dialog" aria-modal="true" aria-labelledby="cadh-outcome-title" tabindex="-1">
        <header>
          <div>
            <span>Desfecho do agendamento</span>
            <h3 id="cadh-outcome-title">${SISELO.escapeHtml(row.full_name || 'Paciente')}</h3>
          </div>
          <button type="button" data-cadh-close-outcome aria-label="Fechar">×</button>
        </header>
        <div class="cadh-outcome-appointment">
          <div>
            <span>Consulta agendada</span>
            <strong>${SISELO.escapeHtml(formatCadhFlowDateTime(row.scheduled_at))}</strong>
          </div>
          <div>
            <span>Módulo clínico</span>
            <strong>${SISELO.escapeHtml(row.appointment_specialty || 'Não informado')}</strong>
          </div>
          <div>
            <span>Profissional</span>
            <strong>${SISELO.escapeHtml(row.appointment_professional || 'Não informado')}</strong>
          </div>
        </div>
        <form id="cadh-outcome-form">
          <label>
            <span>Motivo da não realização</span>
            <select name="reason" required>
              <option value="">Selecione...</option>
              ${Object.entries(cadhFlowOutcomeReasons).map(([value, label]) => `<option value="${SISELO.escapeHtml(value)}">${SISELO.escapeHtml(label)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Observações</span>
            <textarea name="notes" rows="3" placeholder="Informe detalhes relevantes para o histórico."></textarea>
          </label>
          <p class="cadh-outcome-hint">
            Ausência do paciente será classificada como <strong>Ausente</strong>. Os demais impedimentos serão classificados como <strong>Pendente</strong>.
          </p>
          <div id="cadh-outcome-alert" class="alert" hidden></div>
          <footer>
            <button class="btn" type="button" data-cadh-close-outcome>Cancelar</button>
            <button class="btn btn-primary" type="submit">Confirmar desfecho</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

function bindCadhAppointmentOutcomeModal(panel) {
  panel.querySelectorAll('[data-cadh-close-outcome]').forEach((control) => {
    control.addEventListener('click', (event) => {
      if (control.classList.contains('cadh-outcome-modal-backdrop') && event.target !== control) return;
      cadhFlowOutcomeAppointmentId = '';
      renderCadhKanban(panel);
    });
  });
  panel.querySelector('.cadh-outcome-modal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cadhFlowOutcomeAppointmentId = '';
      renderCadhKanban(panel);
    }
  });
  panel.querySelector('#cadh-outcome-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCadhAppointmentOutcome(event.currentTarget);
  });
}

async function saveCadhAppointmentOutcome(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const reason = String(formData.get('reason') || '');
  const notes = String(formData.get('notes') || '').trim();
  if (!reason) {
    SISELO.showAlert('cadh-outcome-alert', 'Selecione o motivo da não realização.', 'error');
    return;
  }
  if (reason === 'other' && !notes) {
    SISELO.showAlert('cadh-outcome-alert', 'Descreva o impedimento ocorrido.', 'error');
    return;
  }

  submitButton.disabled = true;
  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: {
        action: 'mark_not_performed',
        appointment_id: Number(cadhFlowOutcomeAppointmentId),
        reason,
        notes,
      },
    });
    cadhFlowOutcomeAppointmentId = '';
    showCadhFlowAlert('Desfecho registrado e Kanban atualizado.', 'success');
    await loadCadhFlow();
    activateCadhFlowTab('schedule');
  } catch (error) {
    submitButton.disabled = false;
    SISELO.showAlert('cadh-outcome-alert', error.message || 'Não foi possível registrar o desfecho.', 'error');
  }
}

function renderCadhSharing(panel) {
  const selected = findCadhFlowPatient(cadhFlowSharingPatientId);
  panel.innerHTML = `
    <div class="cadh-sharing-layout">
      <aside>
        <label>
          <span>Paciente</span>
          <select id="cadh-sharing-patient">
            <option value="">Selecione um paciente...</option>
            ${cadhFlowRows.map((row) => `<option value="${row.id}" ${selected && String(selected.id) === String(row.id) ? 'selected' : ''}>${SISELO.escapeHtml(row.full_name || '-')}</option>`).join('')}
          </select>
        </label>
        <p>Toda informação registrada no CADH compõe o histórico compartilhado e o Plano de Cuidado.</p>
      </aside>
      <div id="cadh-sharing-detail">
        ${selected ? '<div class="cadh-inline-loading">Carregando compartilhamento...</div>' : renderCadhFlowEmpty('Selecione um paciente para consultar o Plano de Cuidado e o histórico CADH/UBS.')}
      </div>
    </div>
  `;
  panel.querySelector('#cadh-sharing-patient')?.addEventListener('change', (event) => {
    cadhFlowSharingPatientId = event.currentTarget.value;
    const url = new URL(window.location.href);
    if (cadhFlowSharingPatientId) {
      url.searchParams.set('patient_id', cadhFlowSharingPatientId);
    } else {
      url.searchParams.delete('patient_id');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    renderCadhSharing(panel);
  });
  if (selected) {
    loadCadhSharingDetail(selected);
  }
}

async function loadCadhSharingDetail(patient) {
  const target = document.getElementById('cadh-sharing-detail');
  if (!target) return;
  try {
    const data = await SISELO.apiRequest(`/patients/show.php?id=${encodeURIComponent(patient.id)}`);
    const plans = Array.isArray(data.care_plans) ? data.care_plans : [];
    const transitions = Array.isArray(data.transitions) ? data.transitions : [];
    const sharingReturnTarget = `/cadh/index.html?flow=sharing&patient_id=${encodeURIComponent(patient.id)}`;
    const plansHref = `/care-plans/list.html?patient_id=${encodeURIComponent(patient.id)}&return_to=${encodeURIComponent(sharingReturnTarget)}`;
    const newPlanHref = `/care-plans/form.html?patient_id=${encodeURIComponent(patient.id)}&return_to=${encodeURIComponent(sharingReturnTarget)}`;
    target.innerHTML = `
      <header class="cadh-sharing-detail-header">
        <div>
          <span>Compartilhamentos UBS/CADH</span>
          <strong>${SISELO.escapeHtml(patient.full_name || '-')}</strong>
        </div>
        <a class="btn btn-primary" href="${plans.length ? SISELO.escapeHtml(plansHref) : SISELO.escapeHtml(newPlanHref)}">
          ${plans.length ? 'Visualizar planos ativos' : 'Iniciar Plano de Cuidado'}
        </a>
      </header>
      <div class="cadh-sharing-metrics">
        <span><strong>${plans.length}</strong> ${plans.length === 1 ? 'plano ativo' : 'planos ativos'}</span>
        <span><strong>${plans.length ? 'Ativo' : '—'}</strong> situação do plano</span>
        <span><strong>${transitions.length}</strong> ${transitions.length === 1 ? 'encaminhamento' : 'encaminhamentos'}</span>
      </div>
      <section class="cadh-sharing-care-plans" aria-label="Planos de Cuidado ativos">
        <header>
          <strong>Planos de Cuidado ativos</strong>
          <span>${plans.length} ${plans.length === 1 ? 'plano disponível' : 'planos disponíveis'}</span>
        </header>
        ${plans.length ? plans.map((plan) => `
          <a class="cadh-sharing-care-plan" href="${SISELO.escapeHtml(plansHref)}">
            <div>
              <span>Plano ativo</span>
              <strong>Plano de Cuidado nº ${SISELO.escapeHtml(plan.id)}</strong>
              <p>
                Início: ${SISELO.escapeHtml(formatCadhFlowDate(plan.start_date) || 'não informado')}
                ${plan.end_date ? ` · Revisão: ${SISELO.escapeHtml(formatCadhFlowDate(plan.end_date))}` : ''}
              </p>
            </div>
            <span>Visualizar plano →</span>
          </a>
        `).join('') : renderCadhFlowEmpty('Este paciente ainda não possui Plano de Cuidado ativo.')}
      </section>
    `;
  } catch (error) {
    target.innerHTML = renderCadhFlowEmpty(error.message || 'Não foi possível carregar o compartilhamento.');
  }
}

function renderCadhFinalized(panel) {
  panel.innerHTML = `
    <div class="cadh-finalized-heading">
      <div><strong>Pacientes finalizados</strong><span>Históricos preservados para consulta.</span></div>
    </div>
    <div class="cadh-finalized-list">
      ${cadhFinalizedRows.length ? cadhFinalizedRows.map((row) => `
        <article>
          <div>
            <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
            <span>${SISELO.escapeHtml(row.ubs_ref || '')} · ${SISELO.escapeHtml(row.finalization_reason_label || 'Motivo não informado')}</span>
          </div>
          <time>${SISELO.escapeHtml(formatCadhFlowDate(row.finalized_at))}</time>
          <a class="btn" href="/patients/show.html?id=${encodeURIComponent(row.id)}">Consultar prontuário</a>
          ${canCadhFlow('careflow.finalize') ? `<button class="btn" type="button" data-cadh-reopen="${row.id}">Reabrir acompanhamento</button>` : ''}
        </article>
      `).join('') : renderCadhFlowEmpty('Nenhum paciente finalizado.')}
    </div>
  `;
  panel.querySelectorAll('[data-cadh-reopen]').forEach((button) => {
    button.addEventListener('click', () => reopenCadhPatient(button.dataset.cadhReopen));
  });
}

async function reopenCadhPatient(patientId) {
  const confirmed = await SISELO.ui.confirm({
    title: 'Reabrir acompanhamento',
    message: 'O paciente voltará para Recebidos UBS. Deseja continuar?',
    confirmLabel: 'Reabrir',
  });
  if (!confirmed) return;
  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: { action: 'reopen', patient_id: patientId },
    });
    showCadhFlowAlert('Acompanhamento reaberto.', 'success');
    await loadCadhFlow();
  } catch (error) {
    showCadhFlowAlert(error.message || 'Não foi possível reabrir o acompanhamento.', 'error');
  }
}

function updateCadhFlowIndicators() {
  const receivedCount = document.getElementById('cadh-flow-received-count');
  const finalizedCount = document.getElementById('cadh-flow-finalized-count');
  if (receivedCount) receivedCount.textContent = String(cadhFlowRows.length);
  if (finalizedCount) finalizedCount.textContent = String(cadhFinalizedRows.length);

  const criticalRows = cadhFlowRows.filter((row) => row.risk_classification === 'muito_alto_risco');
  const summary = document.getElementById('cadh-risk-alert-summary');
  if (summary) {
    summary.hidden = criticalRows.length === 0;
    summary.innerHTML = criticalRows.length
      ? `<span aria-hidden="true">⚠</span><strong>${criticalRows.length}</strong> paciente(s) de Muito Alto Risco`
      : '';
  }
}

function filterCadhFlowRows(rows) {
  const search = SISELO.createSearchState(cadhFlowQuery);
  return rows.filter((row) => {
    const matchesQuery = !search.hasLetters && !search.hasDigits
      ? true
      : SISELO.matchesPersonNamePrefix(row.full_name, search) || SISELO.matchesSearchDigits(row.cpf, search);
    const matchesRisk = !cadhFlowRisk || row.risk_classification === cadhFlowRisk;
    return matchesQuery && matchesRisk;
  });
}

function matchesCadhFlowWeekday(row) {
  if (cadhFlowWeekday === 'all') return true;
  if (!row.scheduled_at) return false;
  const date = new Date(String(row.scheduled_at).replace(' ', 'T'));
  return !Number.isNaN(date.getTime()) && String(date.getDay()) === cadhFlowWeekday;
}

function findCadhFlowPatient(patientId) {
  return cadhFlowRows.find((row) => String(row.id) === String(patientId)) || null;
}

function findCadhFlowAppointment(appointmentId) {
  return cadhScheduleRows.find((row) => String(row.appointment_id) === String(appointmentId)) || null;
}

function normalizeCadhAppointmentStatus(status) {
  if (status === 'aguardando' || status === 'em_atendimento') {
    return 'agendado';
  }
  return status || '';
}

function normalizeCadhSpecialty(value) {
  return SISELO.normalizeSearchText(String(value || '')).trim();
}

function canCadhFlow(permission) {
  return cadhFlowPermissions.has(permission) || cadhFlowPermissions.has('admin.manage');
}

function showCadhFlowAlert(message, type = 'info') {
  SISELO.showAlert('cadh-flow-alert', message, type);
}

function renderCadhFlowError(message) {
  const panel = document.getElementById('cadh-flow-panel');
  if (panel) {
    panel.innerHTML = `<div class="cadh-flow-error"><strong>Fluxo assistencial indisponível</strong><p>${SISELO.escapeHtml(message)}</p><small>Confirme a aplicação das migrações do banco de dados.</small></div>`;
  }
}

function renderCadhFlowEmpty(message) {
  return `<div class="cadh-flow-empty"><strong>Nenhum registro</strong><p>${SISELO.escapeHtml(message)}</p></div>`;
}

function formatCadhFlowDateTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatCadhFlowDate(value) {
  if (!value) return '—';
  const date = SISELO.parseDateInputValue(value) || new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}
