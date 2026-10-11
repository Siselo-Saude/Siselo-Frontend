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
  const canManageUsers = permissions.has('admin.manage');

  const query = SISELO.queryParam('q') || '';

  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');
  const newUserLink = document.getElementById('new-admin-user-link');
  const tbody = document.getElementById('users-table-body');

  searchInput.value = query;
  newUserLink.hidden = !canManageUsers;

  if (!canManageUsers) {
    renderSelfProfilePage(user, tbody, searchForm);
    return;
  }

  let rows = [];

  try {
    const data = await SISELO.apiRequest('/admin/users/list.php');

    rows = Array.isArray(data.rows)
      ? data.rows
      : [];

  } catch (error) {
    SISELO.showAlert(
      'page-alert',
      error.message || 'Não foi possível carregar os usuários.',
      'error'
    );
  }

  const applySearch = (value) => {
    const filteredRows = filterAdminUserRows(rows, value);

    newUserLink.hidden = !canManageUsers;

    renderAdminUsersTable(
      tbody,
      filteredRows,
      value,
      canManageUsers
    );

    bindAdminUserActions(tbody);

    SISELO.syncSearchUrl(
      '/admin/users/list.html',
      value
    );
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
    title.textContent =
      `Bem-vindo ao seu perfil, ${user && user.name ? user.name : ''}`.trim();
  }

  if (searchForm) {
    searchForm.hidden = true;
  }

  renderAdminUsersTable(
    tbody,
    [normalizeSelfProfileRow(user)],
    '',
    false
  );
}

function normalizeSelfProfileRow(user) {
  return {
    id: user && user.id ? user.id : '',
    name: user && user.name ? user.name : '-',
    email: user && user.email ? user.email : '-',
    user_type: user && user.user_type ? user.user_type : '',
    specialty: user && user.specialty ? user.specialty : '',
    roles: user && Array.isArray(user.roles)
      ? user.roles
      : [],
    is_active:
      user && Number(user.is_active) === 1 ? 1 : 0,
    is_approved:
      user && Number(user.is_approved) === 1 ? 1 : 0,
  };
}

function renderAdminUsersTable(
  tbody,
  rows,
  query = '',
  canManageUsers = false
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      9,
      'Nenhum usuário encontrado.',
      canManageUsers
        ? {
            label: '+ Novo usuário',
            href: '/admin/users/form.html',
          }
        : null
    );

    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${SISELO.escapeHtml(String(row.id || ''))}</td>

      <td>
        ${SISELO.highlightPersonName(
          row.name,
          query,
          SISELO.escapeHtml(row.name || '-')
        )}
      </td>

      <td>${SISELO.escapeHtml(row.email || '-')}</td>

      <td>
        ${SISELO.escapeHtml(formatAdminUserType(row.user_type))}
      </td>

      <td>${SISELO.escapeHtml(row.specialty || '-')}</td>

      <td>
        ${SISELO.escapeHtml((row.roles || []).join(', ') || '-')}
      </td>

      <td>${formatAdminApprovalStatus(row)}</td>

      <td>${formatAdminActiveStatus(row)}</td>

      <td>
        <div class="table-actions">
          ${renderAdminUserActions(row, canManageUsers)}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAdminUserActions(row, canManageUsers) {
  if (!canManageUsers) {
    return SISELO.iconLink(
      'edit',
      '/admin/users/form.html?self=1',
      'Editar meu perfil'
    );
  }

  const formUrl =
    `/admin/users/form.html?id=${encodeURIComponent(row.id)}`;

  const pending = Number(row.is_approved) !== 1;

  // O usuario pendente deve passar pela tela
  // administrativa antes de qualquer aprovacao.
  const editLink = SISELO.iconLink(
    'edit',
    formUrl,
    pending
      ? 'Analisar solicitação e configurar acesso'
      : 'Editar usuário'
  );

  return `
    ${editLink}

    ${SISELO.iconButton(
      'toggle',
      Number(row.is_active) === 1
        ? 'Desativar usuário'
        : 'Ativar usuário',
      { 'data-toggle-id': row.id }
    )}

    ${SISELO.iconButton(
      'reset',
      'Resetar senha',
      { 'data-reset-id': row.id }
    )}

    ${SISELO.iconButton(
      'delete',
      'Excluir usuário',
      {
        'data-delete-id': row.id,
        'data-delete-label': row.name || '',
      }
    )}
  `;
}

function formatAdminUserType(value) {
  return String(value || '').trim().toUpperCase() || '-';
}

function formatAdminApprovalStatus(row) {
  return Number(row && row.is_approved) === 1
    ? 'Aprovado'
    : 'Pendente';
}

function formatAdminActiveStatus(row) {
  return Number(row && row.is_active) === 1
    ? 'Ativo'
    : 'Inativo';
}

function bindAdminUserActions(tbody) {
  tbody.querySelectorAll('[data-toggle-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await SISELO.apiRequest(
          '/admin/users/toggle_active.php',
          {
            method: 'POST',
            body: {
              id: Number(button.dataset.toggleId),
            },
          }
        );

        location.reload();

      } catch (error) {
        SISELO.showAlert(
          'page-alert',
          error.message,
          'error'
        );
      }
    });
  });

  tbody.querySelectorAll('[data-reset-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      // Procedimento legado, a substituir por
      // redefinicao segura antes da producao.
      if (!window.confirm('Redefinir a senha deste usuário?')) {
        return;
      }

      try {
        await SISELO.apiRequest(
          '/admin/users/reset_password.php',
          {
            method: 'POST',
            body: {
              id: Number(button.dataset.resetId),
            },
          }
        );

        SISELO.showAlert(
          'page-alert',
          'Senha redefinida. Verifique o procedimento administrativo antes de compartilhar credenciais.',
          'info'
        );

      } catch (error) {
        SISELO.showAlert(
          'page-alert',
          error.message,
          'error'
        );
      }
    });
  });

  tbody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const label =
        String(button.dataset.deleteLabel || '').trim();

      const target = label
        ? ` o usuário "${label}"`
        : ' este usuário';

      if (!window.confirm(
        `Excluir${target}? O cadastro sairá da lista de usuários.`
      )) {
        return;
      }

      try {
        await SISELO.apiRequest(
          '/admin/users/soft_delete.php',
          {
            method: 'POST',
            body: {
              id: Number(button.dataset.deleteId),
            },
          }
        );

        location.reload();

      } catch (error) {
        SISELO.showAlert(
          'page-alert',
          error.message || 'Não foi possível excluir o usuário.',
          'error'
        );
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

  const selfProfileRequested =
    SISELO.queryParam('self') === '1';

  const requestedId =
    SISELO.normalizeEntityId(SISELO.queryParam('id'));

  const id = selfProfileRequested
    ? SISELO.normalizeEntityId(user.id)
    : requestedId;

  const isSelfProfile =
    selfProfileRequested ||
    (Boolean(id) && String(user.id) === String(id));

  if (!canManageUsers && !isSelfProfile) {
    document.getElementById('form-title').textContent =
      'Acesso restrito';

    SISELO.showAlert(
      'page-alert',
      'Sem permissão: admin.manage',
      'error'
    );

    disableAdminUserForm();
    return;
  }

  const endpoint =
    '/admin/users/form.php' +
    (id ? '?id=' + encodeURIComponent(id) : '');

  let data;

  try {
    data = await SISELO.apiRequest(endpoint);

    if (canManageUsers) {
      data = await hydrateAdminUserProfileFromList(
        data,
        id
      );
    }

  } catch (error) {
    SISELO.showAlert(
      'page-alert',
      error.message || 'Não foi possível carregar o formulário.',
      'error'
    );

    disableAdminUserForm();
    return;
  }

  document.getElementById('form-title').textContent =
    !canManageUsers && isSelfProfile
      ? 'Meu perfil'
      : (
          data.editing
            ? 'Editar Usuário'
            : 'Novo Usuário'
        );

  if (!canManageUsers) {
    document.querySelectorAll('[data-back-link]').forEach((link) => {
      link.href = '/admin/users/list.html?self=1';
      link.dataset.fallback = '/admin/users/list.html?self=1';
    });
  }

  const userData = data.user || {};

  document.getElementById('name').value =
    userData.name || '';

  document.getElementById('email').value =
    userData.email || '';

  document.getElementById('is_active').checked =
    Number(userData.is_active || 0) === 1;

  setupAdminUserProfileFields(userData);

  const activeField =
    document.getElementById('active-field');

  const rolesField =
    document.getElementById('roles-field');

  if (!canManageUsers) {
    if (activeField) {
      activeField.hidden = true;
    }

    if (rolesField) {
      rolesField.hidden = true;
    }

    // Usuario comum visualiza sua unidade
    // e especialidade, mas nao pode edita-las.
    document.getElementById('user_type').disabled = true;
    document.getElementById('specialty').disabled = true;
  }

  const rolesContainer =
    document.getElementById('roles-container');

  rolesContainer.innerHTML =
    (data.roles || []).map((role) => `
      <label style="display:block; margin-bottom:8px;">
        <input
          type="checkbox"
          name="role_ids[]"
          value="${Number(role.id)}"
          ${
            (userData.role_ids || [])
              .map(Number)
              .includes(Number(role.id))
                ? 'checked'
                : ''
          }>

        ${SISELO.escapeHtml(role.name)}
      </label>
    `).join('');

  const tempPasswordField =
    document.getElementById('temp-password-field');

  if (
    tempPasswordField &&
    (data.editing || !canManageUsers)
  ) {
    tempPasswordField.hidden = true;
  }

  // Mostra os dados solicitados, quando existirem.
  showAccessRequestPanel(data, canManageUsers);

  // Aprovacao explicita pelo administrador.
  // Utiliza exclusivamente permissoes ja salvas.
  if (canManageUsers && id && Number(userData.is_approved) !== 1) {
    const approvalForm = document.getElementById('admin-user-form');
    const actions = approvalForm.querySelector('.form-actions');

    if (actions) {
      const approveButton = document.createElement('button');

      approveButton.type = 'button';
      approveButton.className = 'btn btn-primary';
      approveButton.textContent = 'Aprovar acesso (dados salvos)';

      const markUnsaved = () => {
        approveButton.disabled = true;
        approveButton.title =
          'Salve as alteracoes e reabra o cadastro antes de aprovar.';
      };

      approvalForm.addEventListener('input', markUnsaved);
      approvalForm.addEventListener('change', markUnsaved);

      approveButton.addEventListener('click', async () => {
        const confirmed = window.confirm(
          'Confirma a aprovacao com as permissoes ja salvas? ' +
          'O usuario podera acessar o SIS ELO apos a aprovacao.'
        );

        if (!confirmed) {
          return;
        }

        approveButton.disabled = true;

        try {
          await SISELO.apiRequest('/admin/users/approve.php', {
            method: 'POST',
            body: {
              id: Number(id),
            },
          });

          SISELO.setFlashAlert(
            'Usuario aprovado com sucesso.',
            'success'
          );

          location.href = '/admin/users/list.html';

        } catch (error) {
          SISELO.showAlert(
            'page-alert',
            error.message || 'Nao foi possivel aprovar o usuario.',
            'error'
          );

          approveButton.disabled = false;
        }
      });

      actions.appendChild(approveButton);
    }
  }

  document.getElementById('admin-user-form')
    .addEventListener('submit', async (event) => {
      event.preventDefault();

      SISELO.showAlert(
        'page-alert',
        '',
        'info'
      );

      const formData = new FormData(event.currentTarget);

      const roleIds = formData
        .getAll('role_ids[]')
        .map(Number);

      if (canManageUsers && roleIds.length > 1) {
        SISELO.showAlert(
          'page-alert',
          'Escolha apenas um perfil de acesso.',
          'error'
        );
        return;
      }

      try {
        await SISELO.apiRequest(endpoint, {
          method: 'POST',
          body: {
            name: formData.get('name'),
            email: formData.get('email'),
            is_active:
              formData.get('is_active') ? 1 : 0,
            user_type: formData.get('user_type'),
            specialty: formData.get('specialty'),
            temp_password: formData.get('temp_password'),
            role_ids: roleIds,
          },
        });

        if (canManageUsers) {
          SISELO.setFlashAlert(
            Number(userData.is_approved) === 1
              ? 'Usuário atualizado com sucesso.'
              : 'Configuração salva. A conta permanece pendente até a aprovação.',
            'success'
          );

          location.href = '/admin/users/list.html';
          return;
        }

        await SISELO.apiRequest('/auth/me.php');

        SISELO.setFlashAlert(
          'Perfil atualizado com sucesso.',
          'success'
        );

        location.href =
          '/admin/users/list.html?self=1';

      } catch (error) {
        SISELO.showAlert(
          'page-alert',
          error.message || 'Não foi possível salvar o usuário.',
          'error'
        );
      }
    });
}

function showAccessRequestPanel(data, canManageUsers) {
  const panel =
    document.getElementById('access-request-panel');

  const legacyMessage =
    document.getElementById('legacy-request-message');

  if (!panel || !legacyMessage) {
    return;
  }

  panel.hidden = true;
  legacyMessage.hidden = true;

  if (!canManageUsers || !data.editing) {
    return;
  }

  const request = data.access_request;

  if (!request) {
    if (Number(data.user && data.user.is_approved) !== 1) {
      legacyMessage.textContent =
        'Este usuário foi cadastrado antes do novo fluxo. Não há solicitação detalhada registrada. Confira e configure manualmente o perfil, a unidade e a especialidade.';

      legacyMessage.hidden = false;
    }

    return;
  }

  panel.hidden = false;

  const show = (id, value) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value || '-');
    }
  };

  const statuses = {
    pending: 'Pendente',
    approved: 'Aprovada',
    rejected: 'Rejeitada',
  };

  show(
    'requested-role',
    request.requested_role
  );

  show(
    'requested-unit',
    request.requested_user_type
  );

  show(
    'requested-specialty',
    request.requested_specialty
  );

  show(
    'requested-status',
    statuses[request.status] || request.status
  );

  show(
    'requested-date',
    String(request.submitted_at || '').replace('T', ' ')
  );

  if (
    request.status !== 'pending' ||
    Number(data.user.is_approved) === 1
  ) {
    return;
  }

  // O preenchimento ocorre somente apos um clique
  // expresso do administrador.
  // Nao salva nem aprova automaticamente.
  const applyButton =
    document.createElement('button');

  applyButton.type = 'button';
  applyButton.className = 'btn';

  applyButton.textContent =
    'Preencher com os dados solicitados';

  applyButton.addEventListener('click', () => {
    const unitSelect =
      document.getElementById('user_type');

    const specialtySelect =
      document.getElementById('specialty');

    unitSelect.value =
      request.requested_user_type || '';

    unitSelect.dispatchEvent(
      new Event('change', {
        bubbles: true,
      })
    );

    specialtySelect.value =
      request.requested_specialty || '';

    specialtySelect.dispatchEvent(
      new Event('change', {
        bubbles: true,
      })
    );

    const role = (data.roles || []).find(
      (item) =>
        item.name === request.requested_role
    );

    if (role) {
      document
        .querySelectorAll(
          '#roles-container input[name="role_ids[]"]'
        )
        .forEach((checkbox) => {
          checkbox.checked =
            Number(checkbox.value) === Number(role.id);
        });
    }

    SISELO.showAlert(
      'page-alert',
      'Sugestões preenchidas. Confira os dados e clique em Salvar. O usuário continuará pendente.',
      'info'
    );
  });

  panel.appendChild(applyButton);
}

async function hydrateAdminUserProfileFromList(data, id) {
  if (
    !id ||
    !data ||
    !data.user ||
    hasCompleteAdminUserProfile(data.user)
  ) {
    return data;
  }

  try {
    const listData = await SISELO.apiRequest(
      '/admin/users/list.php'
    );

    const rows = Array.isArray(listData.rows)
      ? listData.rows
      : [];

    const row = rows.find(
      (item) =>
        String(item.id) === String(id)
    );

    if (!row) {
      return data;
    }

    return {
      ...data,
      user: {
        ...data.user,
        user_type:
          data.user.user_type || row.user_type || '',
        specialty:
          data.user.specialty || row.specialty || '',
      },
    };

  } catch (error) {
    return data;
  }
}

function hasCompleteAdminUserProfile(user) {
  const userType = String(
    user && user.user_type || ''
  ).toUpperCase();

  if (!userType) {
    return false;
  }

  return userType !== 'CADH' ||
    Boolean(user && user.specialty);
}

function setupAdminUserProfileFields(userData) {
  const userTypeSelect =
    document.getElementById('user_type');

  const specialtyField =
    document.getElementById('specialty-field');

  const specialtySelect =
    document.getElementById('specialty');

  if (
    !userTypeSelect ||
    !specialtyField ||
    !specialtySelect
  ) {
    return;
  }

  specialtySelect.innerHTML =
    '<option value="">Selecione a especialidade</option>' +
    ADMIN_USER_SPECIALTIES.map((specialty) => {
      const escaped =
        SISELO.escapeHtml(specialty);

      return `<option value="${escaped}">${escaped}</option>`;
    }).join('');

  userTypeSelect.value =
    String(userData.user_type || '').toUpperCase();

  specialtySelect.value =
    userData.specialty || '';

  const sync = () => {
    const isCadh =
      userTypeSelect.value === 'CADH';

    specialtyField.hidden = !isCadh;
    specialtySelect.required = isCadh;

    if (!isCadh) {
      specialtySelect.value = '';
    }
  };

  userTypeSelect.addEventListener(
    'change',
    sync
  );

  sync();

  SISELO.enhanceChoiceSelects(document);
}

function disableAdminUserForm() {
  const form =
    document.getElementById('admin-user-form');

  if (!form) {
    return;
  }

  form.querySelectorAll(
    'input, select, textarea, button'
  ).forEach((field) => {
    field.disabled = true;
  });
}
