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
  const permissions = SISELO.getUiPermissions(user);
  const query = SISELO.queryParam('q') || '';
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const newUserLink = document.getElementById('new-admin-user-link');
  const canCreateUser = permissions.has('admin.manage');
  searchInput.value = query;
  newUserLink.hidden = !canCreateUser;
  const tbody = document.getElementById('users-table-body');
  let rows = [];

  try {
    const data = await SISELO.apiRequest('/admin/users/list.php');
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const applySearch = (value) => {
    const filteredRows = filterAdminUserRows(rows, value);
    newUserLink.hidden = !canCreateUser || filteredRows.length === 0;
    renderAdminUsersTable(tbody, filteredRows, value, canCreateUser);
    bindAdminUserActions(tbody);
    SISELO.syncSearchUrl('/admin/users/list.html', value);
  };

  applySearch(query);

  searchInput.addEventListener('input', (event) => {
    applySearch(event.currentTarget.value);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applySearch(searchInput.value);
  });
}

function renderAdminUsersTable(tbody, rows, query = '', canCreateUser = false) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      6,
      'Nenhum usuario encontrado.',
      canCreateUser
        ? { label: '+ Novo usuario', href: '/admin/users/form.html' }
        : null
    );
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.highlightPersonName(row.name, query, SISELO.escapeHtml(row.name || '-'))}</td>
      <td>${SISELO.escapeHtml(row.email)}</td>
      <td>${SISELO.escapeHtml((row.roles || []).join(', '))}</td>
      <td>${Number(row.is_active) === 1 ? 'Ativo' : 'Inativo'}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink('edit', `/admin/users/form.html?id=${row.id}`, 'Editar usuario')}
          ${SISELO.iconButton('toggle', Number(row.is_active) === 1 ? 'Desativar usuario' : 'Ativar usuario', { 'data-toggle-id': row.id })}
          ${SISELO.iconButton('reset', 'Resetar senha', { 'data-reset-id': row.id })}
        </div>
      </td>
    </tr>
  `).join('');
}

function bindAdminUserActions(tbody) {
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
}

function filterAdminUserRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesLetters = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.name, search) ||
        SISELO.matchesSearchText(row.email, search) ||
        SISELO.matchesSearchText((row.roles || []).join(' '), search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.id, search) ||
        SISELO.matchesSearchText(row.email, search)
      : true;

    return matchesLetters && matchesDigits;
  });
}

async function setupAdminUsersFormPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell('admin');

  const id = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const endpoint = '/admin/users/form.php' + (id ? '?id=' + encodeURIComponent(id) : '');
  let data = {
    editing: Boolean(id),
    user: {
      name: '',
      email: '',
      is_active: 1,
      role_ids: [],
    },
    roles: [],
  };

  try {
    data = await SISELO.apiRequest(endpoint || '/admin/users/form.php');
  } catch (error) {
  }

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
      await SISELO.apiRequest(endpoint || '/admin/users/form.php', {
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
