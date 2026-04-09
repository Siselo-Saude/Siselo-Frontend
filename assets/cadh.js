document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'cadh') {
    return;
  }

  setupCadhPage();
});

async function setupCadhPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell('cadh');
  const ses = SISELO.queryParam('ses') || '';
  document.getElementById('ses').value = ses;

  if (ses) {
    const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(ses));
    const patient = (data.rows || []).find((row) => String(row.ses || '') === ses) || null;
    renderCadhPatient(patient);
  }

  document.getElementById('cadh-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('ses').value.trim();
    location.href = '/cadh/index.html' + (value ? '?ses=' + encodeURIComponent(value) : '');
  });
}

function renderCadhPatient(patient) {
  const details = document.getElementById('cadh-patient-details');
  const cards = document.getElementById('cadh-cards');

  if (!patient) {
    details.innerHTML = '<div class="card">Usuario nao encontrado</div>';
    cards.innerHTML = `
      <div class="summary-card">Cadastro</div>
      <div class="summary-card">Mapa do Usuario</div>
      <div class="summary-card" style="opacity:.5; pointer-events:none;">Plano de Cuidado</div>
    `;
    return;
  }

  details.innerHTML = `
    <div class="card">
      <div><strong>Usuario:</strong> ${SISELO.escapeHtml(patient.full_name)}</div>
      <div>Idade: ${SISELO.escapeHtml(patient.age_label || '')}</div>
      <div>CPF: ${SISELO.escapeHtml(patient.cpf || '')}</div>
      <div>SES: ${SISELO.escapeHtml(patient.ses || '')}</div>
      <div>Telefone: ${SISELO.escapeHtml(patient.phone || '-')}</div>
      <div>Email: ${SISELO.escapeHtml(patient.email || '-')}</div>
    </div>
  `;

  cards.innerHTML = `
    <div class="summary-card">Cadastro</div>
    <div class="summary-card">Mapa do Usuario</div>
    <a class="summary-card" href="/care-plans/list.html?patient_id=${patient.id}">
      <strong>Plano de Cuidado</strong>
      <span class="muted">Abrir o plano desse paciente</span>
    </a>
  `;
}
