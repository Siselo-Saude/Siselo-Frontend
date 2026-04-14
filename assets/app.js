(function () {
  const config = window.SISELO_CONFIG || {};
  const SESSION_KEY = 'siselo_session';
  const CSRF_KEY = 'siselo_csrf';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getApiBaseUrl() {
    return String(config.apiBaseUrl || '').replace(/\/+$/, '');
  }

  function saveSessionPayload(payload) {
    if (payload && payload.user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload.user));
    }

    if (payload && typeof payload.csrf === 'string') {
      sessionStorage.setItem(CSRF_KEY, payload.csrf);
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(CSRF_KEY);
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      clearSession();
      return null;
    }
  }

  function getCsrfToken() {
    return sessionStorage.getItem(CSRF_KEY) || '';
  }

  async function apiRequest(path, options = {}) {
    const method = options.method || 'GET';
    const headers = new Headers(options.headers || {});
    const body = options.body || null;

    if (body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (method !== 'GET' && method !== 'HEAD') {
      const csrf = getCsrfToken();
      if (csrf) {
        headers.set('X-CSRF-Token', csrf);
      }
    }

    const response = await fetch(getApiBaseUrl() + path, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);
    if (payload && payload.data && typeof payload.data === 'object') {
      saveSessionPayload(payload.data);
    }

    if (!response.ok || !payload || payload.success !== true) {
      const error = new Error(payload && payload.message ? payload.message : 'Erro na requisicao.');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload.data;
  }

  async function requireSession() {
    try {
      const data = await apiRequest('/auth/me.php');
      return data.user;
    } catch (error) {
      clearSession();
      if (!String(location.pathname).endsWith('/login.html') && !String(location.pathname).endsWith('/change_password.html')) {
        location.href = '/login.html';
      }

      return null;
    }
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout.php', { method: 'POST', body: {} });
    } catch (error) {
      // ignora para manter a saida simples
    } finally {
      clearSession();
      location.href = '/login.html';
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function bindShell(activeKey) {
    const user = getSession();
    const permissions = new Set(user && Array.isArray(user.permissions) ? user.permissions : []);
    const links = {
      home: '/index.html',
      patients: '/patients/list.html',
      admin: '/admin/users/list.html',
      careplans: '/care-plans/list.html',
      encounters: '/encounters/list.html',
      transitions: '/transitions/list.html',
      cadh: '/cadh/index.html',
    };

    Object.keys(links).forEach((key) => {
      const link = document.getElementById(`nav-${key}`);
      if (link) {
        link.href = links[key];
        if (key === activeKey) {
          link.classList.add('is-active');
        }
      }
    });

    const guardedLinks = {
      'nav-patients': permissions.has('patients.view'),
      'nav-careplans': permissions.has('careplans.view'),
      'nav-encounters': permissions.has('encounters.view'),
      'nav-transitions': permissions.has('transitions.view'),
      'nav-admin': permissions.has('admin.manage'),
    };

    Object.keys(guardedLinks).forEach((id) => {
      const link = document.getElementById(id);
      if (link) {
        link.hidden = !guardedLinks[id];
      }
    });

    setText('current-user-name', user ? user.name : '');

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      });
    }
  }

  function queryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function showAlert(id, message, type) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    if (!message) {
      element.hidden = true;
      element.textContent = '';
      element.className = 'alert';
      return;
    }

    element.hidden = false;
    element.textContent = message;
    element.className = `alert alert-${type || 'info'}`;
  }

  window.SISELO = {
    apiRequest,
    bindShell,
    clearSession,
    escapeHtml,
    getApiBaseUrl,
    getSession,
    queryParam,
    requireSession,
    saveSessionPayload,
    setText,
    showAlert,
  };
})();
