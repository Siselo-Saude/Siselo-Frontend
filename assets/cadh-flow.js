const CADH_FLOW_COLUMNS = [
  { key: 'aguardando_agendamento', label: 'Aguardando Agendamento', withoutAppointment: true },
  { key: 'agendado', label: 'Agendados' },
  { key: 'atendido', label: 'Atendidos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'ausente', label: 'Ausentes' },
];

const CADH_APPOINTMENT_COLUMNS = CADH_FLOW_COLUMNS.filter((column) => !column.withoutAppointment);

let cadhFlowRows = [];
let cadhFinalizedRows = [];
let cadhFlowPermissions = new Set();
let cadhFlowTab = 'received';
let cadhFlowQuery = '';
let cadhFlowRisk = '';
let cadhFlowWeekday = 'all';
let cadhFlowReferralDetailPatientId = '';
let cadhFlowSharingPatientId = '';

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
    const [activeData, finalizedData] = await Promise.all([
      SISELO.apiRequest('/care_flow/list.php?care_status=active'),
      SISELO.apiRequest('/care_flow/list.php?care_status=finalizado'),
    ]);
    cadhFlowRows = Array.isArray(activeData.rows) ? activeData.rows : [];
    cadhFinalizedRows = Array.isArray(finalizedData.rows) ? finalizedData.rows : [];
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
  const rows = cadhFlowRows
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
  `;
  panel.querySelector('#cadh-weekday-filter')?.addEventListener('change', (event) => {
    cadhFlowWeekday = event.currentTarget.value;
    renderCadhKanban(panel);
  });
  panel.querySelectorAll('[data-cadh-move-appointment]').forEach((select) => {
    select.addEventListener('change', () => moveCadhAppointment(select.dataset.cadhMoveAppointment, select.value));
  });
  panel.querySelectorAll('[data-cadh-kanban-schedule]').forEach((button) => {
    button.addEventListener('click', () => {
      openCadhClinicalScheduling(button.dataset.cadhKanbanSchedule);
    });
  });
}

function renderCadhKanbanColumn(column, rows) {
  const columnRows = rows.filter((row) => {
    if (column.withoutAppointment) {
      return !row.appointment_id;
    }
    return Boolean(row.appointment_id) && row.appointment_status === column.key;
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
  return `
    <article class="cadh-kanban-card ${veryHigh ? 'is-critical' : ''}">
      <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
      <span>${SISELO.escapeHtml(row.scheduled_at ? formatCadhFlowDateTime(row.scheduled_at) : 'Sem data definida')}</span>
      <small>${SISELO.escapeHtml(row.appointment_specialty || row.ubs_ref || '')}</small>
      <span class="cadh-risk-chip ${veryHigh ? 'is-critical' : 'is-high'}">${SISELO.escapeHtml(row.risk_label || 'Alto Risco')}</span>
      ${row.appointment_id && canCadhFlow('careflow.update') ? `
        <select data-cadh-move-appointment="${row.appointment_id}" aria-label="Mover paciente no fluxo">
          ${CADH_APPOINTMENT_COLUMNS.map((column) => `<option value="${column.key}" ${column.key === status ? 'selected' : ''}>${column.label}</option>`).join('')}
        </select>
      ` : canCadhFlow('careflow.schedule') ? `<button class="btn" type="button" data-cadh-kanban-schedule="${row.id}">Definir data</button>` : ''}
    </article>
  `;
}

function openCadhClinicalScheduling(patientId) {
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
  window.location.assign(`${url.pathname}${url.search}`);
}

async function moveCadhAppointment(appointmentId, status) {
  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: { action: 'move', appointment_id: appointmentId, status },
    });
    await loadCadhFlow();
  } catch (error) {
    showCadhFlowAlert(error.message || 'Não foi possível mover o agendamento.', 'error');
    await loadCadhFlow();
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
