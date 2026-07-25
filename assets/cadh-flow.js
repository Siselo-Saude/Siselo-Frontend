const CADH_FLOW_COLUMNS = [
  { key: 'agendado', label: 'Agendados' },
  { key: 'aguardando', label: 'Aguardando Atendimento' },
  { key: 'em_atendimento', label: 'Em Atendimento' },
  { key: 'atendido', label: 'Atendidos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'ausente', label: 'Ausentes' },
];

let cadhFlowRows = [];
let cadhFinalizedRows = [];
let cadhFlowPermissions = new Set();
let cadhFlowTab = 'received';
let cadhFlowQuery = '';
let cadhFlowRisk = '';
let cadhFlowWeekday = 'all';
let cadhFlowSchedulingPatientId = '';
let cadhFlowFinalizingPatientId = '';
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
  bindCadhFlowTabs();
  await loadCadhFlow();
  activateCadhFlowTab(SISELO.queryParam('flow') || 'received');
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

    ${cadhFlowSchedulingPatientId ? renderCadhScheduleForm(findCadhFlowPatient(cadhFlowSchedulingPatientId)) : ''}
    ${cadhFlowFinalizingPatientId ? renderCadhFinalizeForm(findCadhFlowPatient(cadhFlowFinalizingPatientId)) : ''}

    <div class="cadh-received-list">
      ${rows.length ? rows.map(renderCadhReceivedCard).join('') : renderCadhFlowEmpty('Nenhum paciente corresponde aos filtros informados.')}
    </div>
  `;
  bindCadhReceivedControls(panel);
}

function renderCadhReceivedCard(row) {
  const veryHigh = row.risk_classification === 'muito_alto_risco';
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
      <div class="cadh-received-meta">
        ${row.scheduled_at
          ? `<span>Agendado: <strong>${SISELO.escapeHtml(formatCadhFlowDateTime(row.scheduled_at))}</strong></span>`
          : '<span>Aguardando agendamento</span>'}
        <span class="cadh-care-status">${SISELO.escapeHtml(row.care_status_label || 'Recebido da UBS')}</span>
      </div>
      <div class="cadh-received-actions">
        ${canCadhFlow('careflow.schedule') ? `<button class="btn btn-primary" type="button" data-cadh-schedule="${row.id}">${row.scheduled_at ? 'Reagendar' : 'Agendar consulta'}</button>` : ''}
        <a class="btn" href="/patients/show.html?id=${encodeURIComponent(row.id)}">Prontuário</a>
        ${canCadhFlow('careflow.finalize') ? `<button class="btn" type="button" data-cadh-finalize="${row.id}">Finalizar</button>` : ''}
      </div>
    </article>
  `;
}

function renderCadhScheduleForm(row) {
  if (!row) return '';
  return `
    <form id="cadh-schedule-form" class="cadh-flow-action-form">
      <header>
        <div>
          <span>Agendamento de consulta</span>
          <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
        </div>
        <button type="button" aria-label="Fechar" data-cadh-close-schedule>×</button>
      </header>
      <input type="hidden" name="patient_id" value="${row.id}">
      <label>
        <span>Data e hora *</span>
        <input name="scheduled_at" type="datetime-local" min="${getCadhFlowLocalDateTime()}" required>
      </label>
      <label>
        <span>Especialidade</span>
        <input name="specialty" placeholder="Ex.: Enfermagem">
      </label>
      <label class="is-wide">
        <span>Observações</span>
        <input name="notes" placeholder="Informações para o atendimento">
      </label>
      <button class="btn btn-primary" type="submit">Confirmar agendamento</button>
    </form>
  `;
}

function renderCadhFinalizeForm(row) {
  if (!row) return '';
  return `
    <form id="cadh-finalize-form" class="cadh-flow-action-form cadh-finalize-form">
      <header>
        <div>
          <span>Finalizar acompanhamento</span>
          <strong>${SISELO.escapeHtml(row.full_name || '-')}</strong>
        </div>
        <button type="button" aria-label="Fechar" data-cadh-close-finalize>×</button>
      </header>
      <input type="hidden" name="patient_id" value="${row.id}">
      <label>
        <span>Motivo *</span>
        <select name="reason" required>
          <option value="">Selecione...</option>
          <option value="obito">Óbito</option>
          <option value="ausencia">Ausência</option>
          <option value="tratamento_finalizado">Tratamento finalizado</option>
          <option value="outro">Outro</option>
        </select>
      </label>
      <label class="is-wide">
        <span>Observações</span>
        <input name="notes" placeholder="Informações complementares">
      </label>
      <button class="btn btn-primary" type="submit">Confirmar finalização</button>
    </form>
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

  panel.querySelectorAll('[data-cadh-schedule]').forEach((button) => {
    button.addEventListener('click', () => {
      cadhFlowSchedulingPatientId = button.dataset.cadhSchedule;
      cadhFlowFinalizingPatientId = '';
      renderCadhReceived(panel);
      panel.querySelector('#cadh-schedule-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
  panel.querySelector('[data-cadh-close-schedule]')?.addEventListener('click', () => {
    cadhFlowSchedulingPatientId = '';
    renderCadhReceived(panel);
  });
  panel.querySelector('#cadh-schedule-form')?.addEventListener('submit', saveCadhSchedule);
  panel.querySelectorAll('[data-cadh-finalize]').forEach((button) => {
    button.addEventListener('click', () => {
      cadhFlowFinalizingPatientId = button.dataset.cadhFinalize;
      cadhFlowSchedulingPatientId = '';
      renderCadhReceived(panel);
    });
  });
  panel.querySelector('[data-cadh-close-finalize]')?.addEventListener('click', () => {
    cadhFlowFinalizingPatientId = '';
    renderCadhReceived(panel);
  });
  panel.querySelector('#cadh-finalize-form')?.addEventListener('submit', submitCadhFinalization);
}

async function saveCadhSchedule(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  payload.action = 'schedule';
  try {
    await SISELO.apiRequest('/care_flow/action.php', { method: 'POST', body: payload });
    cadhFlowSchedulingPatientId = '';
    showCadhFlowAlert('Consulta agendada com sucesso.', 'success');
    await loadCadhFlow();
  } catch (error) {
    showCadhFlowAlert(error.message || 'Não foi possível agendar a consulta.', 'error');
  }
}

function renderCadhKanban(panel) {
  const rows = cadhFlowRows.filter(matchesCadhFlowWeekday);
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
      cadhFlowSchedulingPatientId = button.dataset.cadhKanbanSchedule;
      activateCadhFlowTab('received');
    });
  });
}

function renderCadhKanbanColumn(column, rows) {
  const columnRows = rows.filter((row) => {
    const status = row.appointment_status || 'agendado';
    return status === column.key;
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
          ${CADH_FLOW_COLUMNS.map((column) => `<option value="${column.key}" ${column.key === status ? 'selected' : ''}>${column.label}</option>`).join('')}
        </select>
      ` : canCadhFlow('careflow.schedule') ? `<button class="btn" type="button" data-cadh-kanban-schedule="${row.id}">Definir data</button>` : ''}
    </article>
  `;
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
    const encounters = Array.isArray(data.encounters) ? data.encounters : [];
    const transitions = Array.isArray(data.transitions) ? data.transitions : [];
    target.innerHTML = `
      <header class="cadh-sharing-detail-header">
        <div>
          <span>Compartilhamentos UBS/CADH</span>
          <strong>${SISELO.escapeHtml(patient.full_name || '-')}</strong>
        </div>
        <a class="btn btn-primary" href="/care-plans/form.html?patient_id=${encodeURIComponent(patient.id)}${plans[0] ? `&id=${encodeURIComponent(plans[0].id)}` : ''}">
          ${plans.length ? 'Abrir Plano de Cuidado' : 'Iniciar Plano de Cuidado'}
        </a>
      </header>
      <div class="cadh-sharing-metrics">
        <span><strong>${plans.length}</strong> plano(s) de cuidado</span>
        <span><strong>${encounters.length}</strong> acompanhamento(s)</span>
        <span><strong>${transitions.length}</strong> ${transitions.length === 1 ? 'encaminhamento' : 'encaminhamentos'}</span>
      </div>
      <div class="cadh-sharing-records">
        ${encounters.map((row) => `
          <article>
            <strong>${SISELO.escapeHtml(row.specialty || 'Acompanhamento')}</strong>
            <span>${SISELO.escapeHtml(formatCadhFlowDate(row.encounter_date))}</span>
            <p>${SISELO.escapeHtml(row.summary || 'Registro clínico compartilhado.')}</p>
          </article>
        `).join('') || renderCadhFlowEmpty('Ainda não há acompanhamentos registrados para este paciente.')}
      </div>
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

async function submitCadhFinalization(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (payload.reason === 'outro' && !String(payload.notes || '').trim()) {
    showCadhFlowAlert('Descreva o motivo da finalização.', 'error');
    return;
  }
  try {
    await SISELO.apiRequest('/care_flow/action.php', {
      method: 'POST',
      body: { action: 'finalize', ...payload },
    });
    cadhFlowFinalizingPatientId = '';
    showCadhFlowAlert('Paciente movido para Finalizados.', 'success');
    await loadCadhFlow();
  } catch (error) {
    showCadhFlowAlert(error.message || 'Não foi possível finalizar o acompanhamento.', 'error');
  }
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
    panel.innerHTML = `<div class="cadh-flow-error"><strong>Fluxo assistencial indisponível</strong><p>${SISELO.escapeHtml(message)}</p><small>Confirme a aplicação do arquivo database_patch_006.sql.</small></div>`;
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
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function getCadhFlowLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}
