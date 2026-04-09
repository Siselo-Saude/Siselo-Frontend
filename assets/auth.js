document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'login') {
    setupLoginPage();
  }

  if (page === 'change-password') {
    setupChangePasswordPage();
  }
});

function setupLoginPage() {
  const form = document.getElementById('login-form');
  const alertId = 'page-alert';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert(alertId, '', 'info');

    const formData = new FormData(form);

    try {
      const data = await SISELO.apiRequest('/auth/login.php', {
        method: 'POST',
        body: {
          email: formData.get('email'),
          password: formData.get('password'),
        },
      });

      if (data.user && Number(data.user.must_change_password) === 1) {
        location.href = '/change_password.html';
        return;
      }

      location.href = '/index.html';
    } catch (error) {
      SISELO.showAlert(alertId, error.message, 'error');
    }
  });
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
