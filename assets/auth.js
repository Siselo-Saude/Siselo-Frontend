document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'login') {
    setupLoginPage();
  }

  if (page === 'change-password') {
    setupChangePasswordPage();
  }
});

const AUTH_SPECIALTIES = [
  'Endocrinologia',
  'Cardiologia',
  'Psicologia',
  'Enfermagem',
  'Nutrição',
  'Fisioterapia',
  'Farmácia Clínica',
  'Serviço Social',
  'Oftalmologia',
  'Nefrologia',
  'Técnico de Enfermagem',
  'Gestão do Cuidado',
];

function setupLoginPage() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const switchText = document.querySelector('[data-auth-switch-text]');
  const switchButton = document.querySelector('[data-auth-switch]');
  const tabs = Array.from(document.querySelectorAll('[data-auth-mode]'));
  const alertId = 'page-alert';
  let mode = 'login';

  const syncRegisterSpecialty = setupAuthSpecialtyControls(registerForm);
  SISELO.enhanceChoiceSelects(document);
  if (typeof syncRegisterSpecialty === 'function') {
    syncRegisterSpecialty();
  }

  const setMode = (nextMode) => {
    mode = nextMode === 'register' ? 'register' : 'login';
    const isRegister = mode === 'register';

    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    title.textContent = isRegister ? 'Criar uma conta' : 'Entrar no SISELO';
    subtitle.textContent = isRegister ? 'Preencha os dados para acessar o sistema.' : 'Acesse com seu e-mail cadastrado.';
    switchText.firstChild.textContent = isRegister ? 'Já possui uma conta? ' : 'Ainda não possui uma conta? ';
    switchButton.textContent = isRegister ? 'Fazer login' : 'Cadastre-se';

    tabs.forEach((tab) => {
      const isActive = tab.dataset.authMode === mode;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (typeof syncRegisterSpecialty === 'function') {
      syncRegisterSpecialty();
    }

    SISELO.showAlert(alertId, '', 'info');
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authMode));
  });

  switchButton.addEventListener('click', () => {
    setMode(mode === 'login' ? 'register' : 'login');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert(alertId, '', 'info');

    const formData = new FormData(loginForm);

    try {
      await SISELO.apiRequest('/auth/login.php', {
        method: 'POST',
        body: {
          email: formData.get('email'),
          password: formData.get('password'),
        },
      });

      location.href = '/index.html';
    } catch (error) {
      SISELO.showAlert(alertId, error.message, 'error');
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert(alertId, '', 'info');

    const formData = new FormData(registerForm);

    try {
      await SISELO.apiRequest('/auth/register.php', {
        method: 'POST',
        body: {
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password'),
          user_type: formData.get('user_type'),
          specialty: formData.get('specialty'),
        },
      });

      location.href = '/index.html';
    } catch (error) {
      SISELO.showAlert(alertId, error.message, 'error');
    }
  });
}

function setupAuthSpecialtyControls(form) {
  if (!form) {
    return null;
  }

  const field = form.querySelector('.auth-specialty-field');
  const select = form.querySelector('select[name="specialty"]');
  const userTypeInputs = Array.from(form.querySelectorAll('input[name="user_type"]'));

  if (!field || !select || userTypeInputs.length === 0) {
    return null;
  }

  select.innerHTML = '<option value="">Selecione a especialidade</option>' + AUTH_SPECIALTIES.map((specialty) => (
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

async function setupChangePasswordPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  const form = document.getElementById('change-password-form');
  const alertId = 'page-alert';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert(alertId, '', 'info');

    const formData = new FormData(form);

    try {
      await SISELO.apiRequest('/auth/change_password.php', {
        method: 'POST',
        body: {
          password: formData.get('password'),
          password_confirm: formData.get('password_confirm'),
        },
      });

      location.href = '/index.html';
    } catch (error) {
      SISELO.showAlert(alertId, error.message, 'error');
    }
  });
}
