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
  applyCadhModulePermissions(SISELO.getUiPermissions(user));
  bindCadhSesSearch();
}

function applyCadhModulePermissions(permissions) {
  const cards = {
    'cadh-patients-card': 'patients.view',
    'cadh-careplans-card': 'careplans.view',
    'cadh-encounters-card': 'encounters.view',
    'cadh-transitions-card': 'transitions.view',
  };

  Object.entries(cards).forEach(([id, permission]) => {
    const card = document.getElementById(id);
    if (card) {
      card.hidden = !permissions.has(permission);
    }
  });
}

function bindCadhSesSearch() {
  const form = document.getElementById('cadh-ses-search');
  const input = document.getElementById('cadh-ses-input');
  if (!form || !input) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const ses = String(input.value || '').trim();
    if (!ses) {
      renderCadhPatientMessage('Digite um SES para buscar.', 'error');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Buscando';
    }

    try {
      const data = await SISELO.apiRequest('/patients/list.php?q=' + encodeURIComponent(ses));
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const patient = findCadhPatientBySes(rows, ses);

      if (!patient) {
        renderCadhPatientMessage('Nenhum usuario encontrado para este SES.', 'error');
        return;
      }

      renderCadhPatient(patient);
    } catch (error) {
      renderCadhPatientMessage(error.message || 'Nao foi possivel buscar o usuario agora.', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Buscar';
      }
    }
  });
}

function findCadhPatientBySes(rows, ses) {
  const normalizedSes = normalizeCadhSes(ses);
  return rows.find((row) => normalizeCadhSes(row.ses) === normalizedSes) || null;
}

function normalizeCadhSes(value) {
  const digits = SISELO.digitsOnly(value);
  return digits || String(value || '').trim().toLowerCase();
}

function renderCadhPatient(patient) {
  const result = document.getElementById('cadh-patient-result');
  if (!result) {
    return;
  }

  result.innerHTML = `
    <div class="cadh-patient-info">
      <div class="cadh-patient-pill">Usuario: ${SISELO.escapeHtml(patient.full_name || '-')}</div>
      <div class="cadh-patient-pill">CPF ${SISELO.escapeHtml(patient.cpf || '-')}</div>
      <div class="cadh-patient-pill">SES ${SISELO.escapeHtml(patient.ses || '-')}</div>
      <div class="cadh-patient-pill">Data de nascimento ${SISELO.escapeHtml(formatCadhDate(patient.birth_date))}</div>
      <div class="cadh-patient-pill">Idade: ${SISELO.escapeHtml(patient.age_label || '-')}</div>
      <div class="cadh-patient-pill">Cor: ${SISELO.escapeHtml(formatCadhRace(patient.race))}</div>
    </div>
  `;
}

function renderCadhPatientMessage(message, type = 'info') {
  const result = document.getElementById('cadh-patient-result');
  if (!result) {
    return;
  }

  result.innerHTML = `<p class="cadh-patient-message ${type === 'error' ? 'is-error' : ''}">${SISELO.escapeHtml(message)}</p>`;
}

function formatCadhDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || '-';
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatCadhRace(value) {
  const labels = {
    branca: 'Branca',
    preta: 'Preta',
    parda: 'Parda',
    amarela: 'Amarela',
    indigena: 'Indigena',
    nao_informado: 'Nao informado',
  };
  const key = String(value || '').trim().toLowerCase();
  return labels[key] || value || '-';
}
