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
  renderCadhPatient(null, false);

  if (ses) {
    const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(ses));
    const patient = (data.rows || []).find((row) => String(row.ses || '') === ses) || null;
    renderCadhPatient(patient, true);
  }

  document.getElementById('cadh-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('ses').value.trim();
    location.href = '/cadh/index.html' + (value ? '?ses=' + encodeURIComponent(value) : '');
  });
}

function renderCadhPatient(patient, searched) {
  const details = document.getElementById('cadh-patient-details');
  const cards = document.getElementById('cadh-cards');

  cards.innerHTML = `
    <div class="cadh-card-item">Cadastro</div>
    <div class="cadh-card-item">Mapa do Usuario</div>
    ${patient ? `
      <a class="cadh-card-item" href="/care-plans/list.html?patient_id=${patient.id}">
        Plano de Cuidado
      </a>
    ` : `
      <div class="cadh-card-item cadh-card-item-disabled">Plano de Cuidado</div>
    `}
  `;

  if (!searched) {
    details.innerHTML = '';
    return;
  }

  if (!patient) {
    details.innerHTML = '<div class="cadh-user-info-item">Usuario nao encontrado</div>';
    return;
  }

  details.innerHTML = `
    <div class="cadh-user-info-item"><strong>Usuario:</strong> ${SISELO.escapeHtml(patient.full_name)}</div>
    <div class="cadh-user-info-item">Idade: ${SISELO.escapeHtml(patient.age_label || '')}</div>
    <div class="cadh-user-info-item">CPF: ${SISELO.escapeHtml(patient.cpf || '')}</div>
    <div class="cadh-user-info-item">SES: ${SISELO.escapeHtml(patient.ses || '')}</div>
    <div class="cadh-user-info-item">Telefone: ${SISELO.escapeHtml(patient.phone || '-')}</div>
    <div class="cadh-user-info-item">Email: ${SISELO.escapeHtml(patient.email || '-')}</div>
  `;
}
