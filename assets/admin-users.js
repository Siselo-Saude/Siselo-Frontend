document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'admin-users-list') {
    setupAdminUsersListPage();
  }

  if (page === 'admin-users-form') {
    setupAdminUsersFormPage();
  }
});

const ADMIN_USER_SPECIALTIES = [
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

  if (!canCreateUser) {
    renderSelfProfilePage(user, tbody, searchForm);
    return;
  }

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/admin/users/list.php');
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    SISELO.showAlert('page-alert', error.message || 'Não foi possível carregar os usuários.', 'error');
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

function renderSelfProfilePage(user, tbody, searchForm) {
  const title = document.querySelector('.page-title');
  if (title) {
    title.textContent = `Bem vindo, ao seu perfil ${user && user.name ? user.name : ''}`.trim();
  }

  if (searchForm) {
    searchForm.hidden = true;
  }

  renderAdminUsersTable(tbody, [normalizeSelfProfileRow(user)], '', false);
}

function normalizeSelfProfileRow(user) {
  return {
    id: user && user.id ? user.id : '',
    name: user && user.name ? user.name : '-',
    email: user && user.email ? user.email : '-',
    user_type: user && user.user_type ? user.user_type : '',
    specialty: user && user.specialty ? user.specialty : '',
    roles: user && Array.isArray(user.roles) ? user.roles : [],
    is_active: user && Number(user.is_active) === 1 ? 1 : 0,
    is_approved: user && Number(user.is_approved) === 1 ? 1 : 0,
  };
}

function renderAdminUsersAccessDenied(tbody) {
  tbody.innerHTML = SISELO.emptyTableRow(
    9,
    'Acesso restrito.',
    'Seu usu\u00e1rio n\u00e3o possui permiss\u00e3o para administrar usu\u00e1rios.'
  );
}

function renderAdminUsersTable(tbody, rows, query = '', canCreateUser = false) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      9,
      'Nenhum usu\u00e1rio encontrado.',
      canCreateUser
        ? { label: '+ Novo usu\u00e1rio', href: '/admin/users/form.html' }
        : null
    );
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.highlightPersonName(row.name, query, SISELO.escapeHtml(row.name || '-'))}</td>
      <td>${SISELO.escapeHtml(row.email)}</td>
      <td>${SISELO.escapeHtml(formatAdminUserType(row.user_type))}</td>
      <td>${SISELO.escapeHtml(row.specialty || '-')}</td>
      <td>${SISELO.escapeHtml((row.roles || []).join(', '))}</td>
      <td>${formatAdminApprovalStatus(row)}</td>
      <td>${formatAdminActiveStatus(row)}</td>
      <td>
        <div class="table-actions">
          ${renderAdminUserActions(row, canCreateUser)}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminUserActions(row, canManageUsers) {
  if (!canManageUsers) {
    return SISELO.iconLink('edit', '/admin/users/form.html?self=1', 'Editar meu perfil');
  }

  return `
    ${SISELO.iconLink('edit', `/admin/users/form.html?id=${row.id}`, 'Editar usu\u00e1rio')}
    ${Number(row.is_approved) === 1 ? '' : SISELO.iconButton('restore', 'Aprovar usu\u00e1rio', { 'data-approve-id': row.id })}
    ${SISELO.iconButton('toggle', Number(row.is_active) === 1 ? 'Desativar usu\u00e1rio' : 'Ativar usu\u00e1rio', { 'data-toggle-id': row.id })}
    ${SISELO.iconButton('reset', 'Resetar senha', { 'data-reset-id': row.id })}
    ${SISELO.iconButton('delete', 'Excluir usu\u00e1rio', { 'data-delete-id': row.id, 'data-delete-label': row.name || '' })}
  `;
}

function formatAdminUserType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase();
  return normalizedValue || '-';
}

function formatAdminApprovalStatus(row) {
  return Number(row && row.is_approved) === 1 ? 'Aprovado' : 'Pendente';
}

function formatAdminActiveStatus(row) {
  return Number(row && row.is_active) === 1 ? 'Ativo' : 'Inativo';
}

function bindAdminUserActions(tbody) {
  tbody.querySelectorAll('[data-approve-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await SISELO.apiRequest('/admin/users/approve.php', {
        method: 'POST',
        body: { id: Number(button.dataset.approveId) },
      });
      location.reload();
    });
  });

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

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const label = String(button.dataset.deleteLabel || '').trim();
      const target = label ? ` o usu\u00e1rio "${label}"` : ' este usu\u00e1rio';
      if (!window.confirm(`Excluir${target}? O cadastro sair\u00e1 da lista de usu\u00e1rios.`)) {
        return;
      }

      try {
        await SISELO.apiRequest('/admin/users/soft_delete.php', {
          method: 'POST',
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showAlert('page-alert', error.message || 'N\u00e3o foi poss\u00edvel excluir o usu\u00e1rio.', 'error');
      }
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
        SISELO.matchesSearchText(row.user_type, search) ||
        SISELO.matchesSearchText(row.specialty, search) ||
        SISELO.matchesSearchText((row.roles || []).join(' '), search) ||
        SISELO.matchesSearchText(formatAdminApprovalStatus(row), search) ||
        SISELO.matchesSearchText(formatAdminActiveStatus(row), search)
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
  const permissions = SISELO.getUiPermissions(user);
  const canManageUsers = permissions.has('admin.manage');
  const selfProfileRequested = SISELO.queryParam('self') === '1';
  const requestedId = SISELO.normalizeEntityId(SISELO.queryParam('id'));
  const id = selfProfileRequested ? SISELO.normalizeEntityId(user.id) : requestedId;
  const isSelfProfile = selfProfileRequested || (Boolean(id) && String(user.id) === String(id));

  if (!canManageUsers && !isSelfProfile) {
    document.getElementById('form-title').textContent = 'Acesso restrito';
    SISELO.showAlert('page-alert', 'Sem permissao: admin.manage', 'error');
    disableAdminUserForm();
    return;
  }

  const endpoint = '/admin/users/form.php' + (id ? '?id=' + encodeURIComponent(id) : '');
  let data = {
    editing: Boolean(id),
    user: {
      name: '',
      email: '',
      is_active: 1,
      user_type: '',
      specialty: '',
      role_ids: [],
    },
    roles: [],
  };

  try {
    data = await SISELO.apiRequest(endpoint || '/admin/users/form.php');
    data = await hydrateAdminUserProfileFromList(data, id);
  } catch (error) {
    SISELO.showAlert('page-alert', error.message || 'Não foi possível carregar o formulário.', 'error');
    disableAdminUserForm();
    return;
  }

  document.getElementById('form-title').textContent = !canManageUsers && isSelfProfile
    ? 'Meu perfil'
    : (data.editing ? 'Editar Usu\u00e1rio' : 'Novo Usu\u00e1rio');

  if (!canManageUsers) {
    document.querySelectorAll('[data-back-link]').forEach((link) => {
      link.href = '/admin/users/list.html?self=1';
      link.dataset.fallback = '/admin/users/list.html?self=1';
    });
  }

  const userData = data.user || {};
  document.getElementById('name').value = userData.name || '';
  document.getElementById('email').value = userData.email || '';
  document.getElementById('is_active').checked = Number(userData.is_active || 0) === 1;
  setupAdminUserProfileFields(userData);

  const activeField = document.getElementById('active-field');
  const rolesField = document.getElementById('roles-field');
  if (!canManageUsers) {
    if (activeField) {
      activeField.hidden = true;
    }
    if (rolesField) {
      rolesField.hidden = true;
    }
  }

  const rolesContainer = document.getElementById('roles-container');
  rolesContainer.innerHTML = (data.roles || []).map((role) => `
    <label style="display:block; margin-bottom:8px;">
      <input type="checkbox" name="role_ids[]" value="${role.id}" ${(userData.role_ids || []).includes(role.id) ? 'checked' : ''}>
      ${SISELO.escapeHtml(role.name)}
    </label>
  `).join('');

  const tempPasswordField = document.getElementById('temp-password-field');
  if (data.editing || !canManageUsers) {
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
          user_type: formData.get('user_type'),
          specialty: formData.get('specialty'),
          temp_password: formData.get('temp_password'),
          role_ids: roleIds,
        },
      });

      if (canManageUsers) {
        location.href = '/admin/users/list.html';
        return;
      }

      await SISELO.apiRequest('/auth/me.php');
      SISELO.setFlashAlert('Perfil atualizado com sucesso.', 'success');
      location.href = '/admin/users/list.html?self=1';
    } catch (error) {
      SISELO.showAlert('page-alert', error.message, 'error');
    }
  });
}

async function hydrateAdminUserProfileFromList(data, id) {
  if (!id || !data || !data.user || hasCompleteAdminUserProfile(data.user)) {
    return data;
  }

  try {
    const listData = await SISELO.apiRequest('/admin/users/list.php');
    const rows = Array.isArray(listData.rows) ? listData.rows : [];
    const row = rows.find((item) => String(item.id) === String(id));
    if (!row) {
      return data;
    }

    return {
      ...data,
      user: {
        ...data.user,
        user_type: data.user.user_type || row.user_type || '',
        specialty: data.user.specialty || row.specialty || '',
      },
    };
  } catch (error) {
    return data;
  }
}

function hasCompleteAdminUserProfile(user) {
  const userType = String(user && user.user_type || '').toUpperCase();
  if (!userType) {
    return false;
  }

  return userType !== 'CADH' || Boolean(user && user.specialty);
}

function setupAdminUserProfileFields(userData) {
  const userTypeSelect = document.getElementById('user_type');
  const specialtyField = document.getElementById('specialty-field');
  const specialtySelect = document.getElementById('specialty');

  if (!userTypeSelect || !specialtyField || !specialtySelect) {
    return;
  }

  specialtySelect.innerHTML = '<option value="">Selecione a especialidade</option>' + ADMIN_USER_SPECIALTIES.map((specialty) => (
    `<option value="${SISELO.escapeHtml(specialty)}">${SISELO.escapeHtml(specialty)}</option>`
  )).join('');

  userTypeSelect.value = String(userData.user_type || '').toUpperCase();
  specialtySelect.value = userData.specialty || '';

  const sync = () => {
    const isCadh = userTypeSelect.value === 'CADH';
    specialtyField.hidden = !isCadh;
    specialtySelect.required = isCadh;
    if (!isCadh) {
      specialtySelect.value = '';
    }
  };

  userTypeSelect.addEventListener('change', sync);
  sync();
  SISELO.enhanceChoiceSelects(document);
}

function disableAdminUserForm() {
  const form = document.getElementById('admin-user-form');
  if (!form) {
    return;
  }

  form.querySelectorAll('input, select, textarea, button').forEach((field) => {
    field.disabled = true;
  });
}
