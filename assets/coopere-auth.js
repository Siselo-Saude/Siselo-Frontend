document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'coopere-login') {
    setupCoopereLoginPage();
  }

  if (page === 'welcome') {
    setupWelcomePage();
  }
});

const COOPERE_SPECIALTIES = [
  'Endocrinologia',
  'Cardiologia',
  'Psicologia',
  'Enfermagem',
  'Nutri\u00e7\u00e3o',
  'Fisioterapia',
  'Farm\u00e1cia Cl\u00ednica',
  'Servi\u00e7o Social',
  'Oftalmologia',
  'Nefrologia',
  'T\u00e9cnico de Enfermagem',
  'Gest\u00e3o do Cuidado',
];

async function setupCoopereLoginPage() {
  const token = SISELO.queryParam('token') || '';
  const devMode = SISELO.queryParam('dev') === '1';
  const status = document.getElementById('coopere-login-status');
  const devForm = document.getElementById('coopere-dev-form');

  if (token) {
    await completeCoopereLogin(token, status);
    return;
  }

  if (devMode && devForm) {
    status.textContent = 'Modo local de teste.';
    devForm.hidden = false;
    devForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      SISELO.showAlert('page-alert', '', 'info');

      const formData = new FormData(devForm);
      try {
        const data = await SISELO.apiRequest('/auth/coopere/dev_token.php', {
          method: 'POST',
          body: {
            name: formData.get('name'),
            email: formData.get('email'),
            username: formData.get('username'),
          },
        });

        await completeCoopereLogin(data.token, status);
      } catch (error) {
        SISELO.showAlert('page-alert', error.message || 'Nao foi possivel gerar o acesso local.', 'error');
      }
    });
    return;
  }

  status.textContent = 'Acesso Coopere indisponivel.';
  SISELO.showAlert('page-alert', 'Token Coopere ausente.', 'error');
}

async function completeCoopereLogin(token, status) {
  try {
    if (status) {
      status.textContent = 'Validando acesso na Coopere.';
    }

    const data = await SISELO.apiRequest('/auth/coopere/complete.php', {
      method: 'POST',
      body: { token },
    });

    if (status) {
      status.textContent = 'Acesso confirmado.';
    }

    location.href = data && data.redirect ? data.redirect : '/welcome.html';
  } catch (error) {
    if (status) {
      status.textContent = 'Nao foi possivel entrar pelo Coopere.';
    }
    SISELO.clearSession();
    SISELO.showAlert('page-alert', error.message || 'Acesso Coopere invalido.', 'error');
  }
}

async function setupWelcomePage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  if (Number(user.profile_completed || 0) === 1) {
    location.href = '/index.html';
    return;
  }

  const form = document.getElementById('welcome-form');
  const nameInput = document.getElementById('welcome-name');
  const emailInput = document.getElementById('welcome-email');
  const syncSpecialty = setupWelcomeSpecialtyControls(form);

  nameInput.value = user.name || '';
  emailInput.value = user.email || '';
  syncSpecialty();
  SISELO.enhanceChoiceSelects(document);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert('page-alert', '', 'info');

    const formData = new FormData(form);

    try {
      const data = await SISELO.apiRequest('/auth/coopere/profile.php', {
        method: 'POST',
        body: {
          user_type: formData.get('user_type'),
          specialty: formData.get('specialty'),
        },
      });

      SISELO.setFlashAlert('Perfil concluido com sucesso.', 'success');
      location.href = data && data.redirect ? data.redirect : '/index.html';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message || 'Nao foi possivel concluir o perfil.', 'error');
    }
  });
}

function setupWelcomeSpecialtyControls(form) {
  if (!form) {
    return () => {};
  }

  const field = form.querySelector('.auth-specialty-field');
  const select = form.querySelector('select[name="specialty"]');
  const userTypeInputs = Array.from(form.querySelectorAll('input[name="user_type"]'));

  if (!field || !select || userTypeInputs.length === 0) {
    return () => {};
  }

  select.innerHTML = '<option value="">Selecione a especialidade</option>' + COOPERE_SPECIALTIES.map((specialty) => (
    `<option value="${SISELO.escapeHtml(specialty)}">${SISELO.escapeHtml(specialty)}</option>`
  )).join('');

  const sync = () => {
    const selectedType = userTypeInputs.find((input) => input.checked);
    const isCadh = selectedType && selectedType.value === 'CADH';
    const previousValue = select.value;

    field.hidden = !isCadh;
    select.required = Boolean(isCadh);
    if (!isCadh) {
      select.value = '';
    }

    if (select.value !== previousValue) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  userTypeInputs.forEach((input) => {
    input.addEventListener('change', sync);
  });

  sync();
  return sync;
}
