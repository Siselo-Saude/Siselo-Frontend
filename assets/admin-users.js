document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'admin-users-list') {
    setupAdminUsersListPage();
  }

  if (page === 'admin-users-form') {
    setupAdminUsersFormPage();
  }
});

async function setupAdminUsersListPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('admin');
  const query = SISELO.queryParam('q') || '';
  document.getElementById('search-input').value = query;

  const data = await SISELO.apiRequest('/admin/users/list.php?q=' + encodeURIComponent(query));
  const tbody = document.getElementById('users-table-body');

  tbody.innerHTML = data.rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.name)}</td>
      <td>${SISELO.escapeHtml(row.email)}</td>
      <td>${SISELO.escapeHtml((row.roles || []).join(', '))}</td>
      <td>${Number(row.is_active) === 1 ? 'Ativo' : 'Inativo'}</td>
      <td>
        <a class="btn" href="/admin/users/form.html?id=${row.id}">Editar</a>
        <button class="btn" data-toggle-id="${row.id}">${Number(row.is_active) === 1 ? 'Desativar' : 'Ativar'}</button>
        <button class="btn" data-reset-id="${row.id}">Reset senha</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-toggle-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/admin/users/toggle_active.php', {
        method: 'POST',
        body: { id: Number(button.dataset.toggleId) },
      });
      location.reload();
    });
  });

  tbody.querySelectorAll('[data-reset-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Resetar senha para Temporaria@123?')) {
        return;
      }

      await SISELO.apiRequest('/admin/users/reset_password.php', {
        method: 'POST',
        body: { id: Number(button.dataset.resetId) },
      });
      location.reload();
    });
  });

  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    location.href = '/admin/users/list.html' + (value ? '?q=' + encodeURIComponent(value) : '');
  });
}

async function setupAdminUsersFormPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('admin');

  const id = SISELO.queryParam('id');
  const endpoint = '/admin/users/form.php' + (id ? '?id=' + encodeURIComponent(id) : '');
  const data = await SISELO.apiRequest(endpoint);

  document.getElementById('form-title').textContent = data.editing ? 'Editar Usuario' : 'Novo Usuario';

  const userData = data.user || {};
  document.getElementById('name').value = userData.name || '';
  document.getElementById('email').value = userData.email || '';
  document.getElementById('is_active').checked = Number(userData.is_active || 0) === 1;

  const rolesContainer = document.getElementById('roles-container');
  rolesContainer.innerHTML = (data.roles || []).map((role) => `
    <label style="display:block; margin-bottom:8px;">
      <input type="checkbox" name="role_ids[]" value="${role.id}" ${(userData.role_ids || []).includes(role.id) ? 'checked' : ''}>
      ${SISELO.escapeHtml(role.name)}
    </label>
  `).join('');

  const tempPasswordField = document.getElementById('temp-password-field');
  if (data.editing) {
    tempPasswordField.hidden = true;
  }

  document.getElementById('admin-user-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    SISELO.showAlert('page-alert', '', 'info');

    const formData = new FormData(event.currentTarget);
    const roleIds = formData.getAll('role_ids[]').map((value) => Number(value));

    try {
      await SISELO.apiRequest(endpoint, {
        method: 'POST',
        body: {
          name: formData.get('name'),
          email: formData.get('email'),
          is_active: formData.get('is_active') ? 1 : 0,
          temp_password: formData.get('temp_password'),
          role_ids: roleIds,
        },
      });

      location.href = '/admin/users/list.html';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}
