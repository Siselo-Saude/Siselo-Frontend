(function () {
  const config = window.SISELO_CONFIG || {};
  const SESSION_KEY = 'siselo_session';
  const CSRF_KEY = 'siselo_csrf';
  const NAVIGATION_KEY = 'siselo_navigation';
  const CADH_SEARCH_KEY = 'siselo_cadh_search';
  const CRUD_UI_PERMISSIONS = [
    'patients.view',
    'patients.create',
    'patients.update',
    'patients.delete',
    'patients.restore',
    'careplans.view',
    'careplans.create',
    'careplans.update',
    'careplans.delete',
    'careplans.restore',
    'encounters.view',
    'encounters.create',
    'encounters.update',
    'encounters.delete',
    'encounters.restore',
    'transitions.view',
    'transitions.create',
    'transitions.update',
    'transitions.delete',
    'transitions.restore',
    'admin.manage',
  ];
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function digitsOnly(value) {
    return String(value ?? '').replace(/\D+/g, '');
  }

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createSearchState(value) {
    const raw = String(value ?? '');
    const text = normalizeSearchText(raw);
    const nameText = text
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const digits = digitsOnly(raw);

    return {
      raw,
      text,
      nameText,
      digits,
      hasText: Boolean(text),
      hasLetters: /[a-z]/.test(nameText),
      hasDigits: Boolean(digits),
    };
  }

  function getSearchState(value) {
    if (
      value &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'text') &&
      Object.prototype.hasOwnProperty.call(value, 'nameText') &&
      Object.prototype.hasOwnProperty.call(value, 'digits')
    ) {
      return value;
    }

    return createSearchState(value);
  }

  function matchesPersonNamePrefix(value, search) {
    const state = getSearchState(search);
    return Boolean(findPersonNamePrefixRange(value, state));
  }

  function matchesSearchText(value, search) {
    const state = getSearchState(search);
    if (!state.hasText) {
      return false;
    }

    return normalizeSearchText(value).includes(state.text);
  }

  function matchesSearchDigits(value, search) {
    const state = getSearchState(search);
    if (!state.hasDigits) {
      return false;
    }

    return digitsOnly(value).includes(state.digits);
  }

  function buildSearchUrl(basePath, query, extraParams = {}) {
    const url = new URL(basePath, location.origin);
    const normalizedQuery = String(query ?? '').trim();

    if (normalizedQuery) {
      url.searchParams.set('q', normalizedQuery);
    }

    Object.entries(extraParams || {}).forEach(([key, value]) => {
      const normalizedValue = String(value ?? '').trim();
      if (normalizedValue) {
        url.searchParams.set(key, normalizedValue);
      }
    });

    return `${url.pathname}${url.search}${url.hash}`;
  }

  function syncSearchUrl(basePath, query, extraParams = {}) {
    const nextUrl = buildSearchUrl(basePath, query, extraParams);
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;

    if (currentUrl !== nextUrl) {
      history.replaceState(null, '', nextUrl);
    }
  }

  function buildPersonNameCharMap(value) {
    const original = String(value ?? '');
    let normalized = '';
    const indexMap = [];

    for (let index = 0; index < original.length; index += 1) {
      const normalizedChunk = original[index]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      for (const character of normalizedChunk) {
        if (/[a-z]/.test(character)) {
          normalized += character;
          indexMap.push(index);
        } else if (normalized && !normalized.endsWith(' ')) {
          normalized += ' ';
          indexMap.push(index);
        }
      }
    }

    while (normalized.endsWith(' ')) {
      normalized = normalized.slice(0, -1);
      indexMap.pop();
    }

    return {
      original,
      normalized,
      indexMap,
    };
  }

  function findPersonNamePrefixRange(value, search) {
    const state = getSearchState(search);
    if (!state.hasLetters || !state.nameText) {
      return null;
    }

    const mapped = buildPersonNameCharMap(value);
    let highlightStart = mapped.normalized.startsWith(state.nameText) ? 0 : -1;
    if (highlightStart === -1) {
      const matchIndex = mapped.normalized.indexOf(` ${state.nameText}`);
      highlightStart = matchIndex === -1 ? -1 : matchIndex + 1;
    }

    if (highlightStart === -1) {
      return null;
    }

    const highlightEnd = highlightStart + state.nameText.length - 1;
    const originalStart = mapped.indexMap[highlightStart];
    const originalEnd = mapped.indexMap[highlightEnd];
    if (originalStart === undefined || originalEnd === undefined) {
      return null;
    }

    return {
      start: originalStart,
      end: originalEnd + 1,
    };
  }

  function highlightPersonName(value, search, fallback = '<span class="muted">-</span>') {
    const original = String(value ?? '').trim();
    if (!original) {
      return fallback;
    }

    const state = getSearchState(search);
    if (!state.hasLetters || !state.nameText) {
      return escapeHtml(original);
    }

    const matchRange = findPersonNamePrefixRange(original, state);
    if (!matchRange) {
      return escapeHtml(original);
    }

    return `
      ${escapeHtml(original.slice(0, matchRange.start))}<mark class="search-highlight">${escapeHtml(original.slice(matchRange.start, matchRange.end))}</mark>${escapeHtml(original.slice(matchRange.end))}
    `.trim();
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
    sessionStorage.removeItem(NAVIGATION_KEY);
    sessionStorage.removeItem(CADH_SEARCH_KEY);
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

  function getCurrentAppPath() {
    return `${location.pathname}${location.search}${location.hash}`;
  }

  function normalizeAppPath(value) {
    if (!value) {
      return '';
    }

    try {
      const url = new URL(value, location.origin);
      const path = `${url.pathname}${url.search}${url.hash}`;
      const forbiddenPaths = ['/login.html', '/change_password.html', '/'];

      if (url.origin !== location.origin || forbiddenPaths.includes(url.pathname)) {
        return '';
      }

      return path;
    } catch (error) {
      return '';
    }
  }

  function readNavigationState() {
    try {
      return JSON.parse(sessionStorage.getItem(NAVIGATION_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function writeNavigationState(state) {
    sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(state || {}));
  }

  function rememberNavigationPage() {
    const current = normalizeAppPath(getCurrentAppPath());
    if (!current) {
      return;
    }

    const state = readNavigationState();
    if (state.current !== current) {
      writeNavigationState({
        previous: normalizeAppPath(state.current) || normalizeAppPath(state.previous) || '',
        current,
      });
    }
  }

  function resolveBackTarget(fallback) {
    const target = normalizeAppPath(fallback) || '/index.html';
    const patientId = normalizeEntityId(queryParam('patient_id'));

    if (!patientId) {
      return target;
    }

    const url = new URL(target, location.origin);
    const scopedListPaths = [
      '/care-plans/list.html',
      '/encounters/list.html',
      '/transitions/list.html',
    ];

    if (scopedListPaths.includes(url.pathname) && !url.searchParams.get('patient_id')) {
      url.searchParams.set('patient_id', patientId);
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return target;
  }

  function bindBackLinks() {
    document.querySelectorAll('[data-back-link]').forEach((link) => {
      if (link.dataset.backLinkBound === 'true') {
        return;
      }

      link.dataset.backLinkBound = 'true';
      link.href = resolveBackTarget(link.dataset.fallback || link.getAttribute('href'));
      link.addEventListener('click', (event) => {
        event.preventDefault();
        location.href = resolveBackTarget(link.dataset.fallback || link.getAttribute('href'));
      });
    });
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
      if (error.status !== 401 && error.status !== 403) {
        const cachedUser = getSession();
        if (cachedUser) {
          showAlert('page-alert', 'Nao foi possivel confirmar a sessao agora, mas voce continuara na tela atual.', 'info');
          return cachedUser;
        }
      }

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
      // Mantem a saida local mesmo se o backend nao responder.
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

  function ensureTopbarActions(user, permissions) {
    const topbar = document.querySelector('.topbar');
    if (!topbar) {
      return;
    }

    const brand = topbar.querySelector('.topbar-brand');
    let left = topbar.querySelector('.topbar-left');
    if (!left) {
      left = document.createElement('div');
      left.className = 'topbar-left';

      if (brand) {
        topbar.insertBefore(left, brand);
        left.appendChild(brand);
      } else {
        topbar.prepend(left);
      }
    }

    let logoutButton = left.querySelector('#logout-button');
    if (!logoutButton) {
      logoutButton = document.createElement('a');
      logoutButton.id = 'logout-button';
      logoutButton.className = 'topbar-logout';
      logoutButton.href = '/login.html';
      logoutButton.textContent = 'Sair';
      left.insertBefore(logoutButton, left.firstChild);
    }

    if (logoutButton.dataset.bound !== 'true') {
      logoutButton.dataset.bound = 'true';
      logoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      });
    }

    let accountLink = topbar.querySelector('#topbar-account-link');
    if (!accountLink) {
      accountLink = document.createElement('a');
      accountLink.id = 'topbar-account-link';
      accountLink.className = 'topbar-account';
      topbar.appendChild(accountLink);
    }

    accountLink.href = permissions.has('admin.manage') ? '/admin/users/list.html' : '#';
    accountLink.textContent = user && user.name ? user.name : 'Admin';
    accountLink.title = 'Admin';
    accountLink.setAttribute('aria-label', 'Admin');
    accountLink.hidden = !permissions.has('admin.manage');
  }

  function bindShell(activeKey) {
    rememberNavigationPage();

    const user = getSession();
    const permissions = getUiPermissions(user);
    const cadhPages = ['patients', 'careplans', 'encounters', 'transitions'];
    const activeNavKey = cadhPages.includes(activeKey) ? 'cadh' : activeKey;
    const links = {
      home: '/index.html',
      cadh: '/cadh/index.html',
      ubs: '#',
    };

    Object.keys(links).forEach((key) => {
      const link = document.getElementById(`nav-${key}`);
      if (link) {
        link.href = links[key];
        if (key === activeNavKey) {
          link.classList.add('is-active');
        }
      }
    });

    setText('current-user-name', user ? user.name : '');
    ensureTopbarActions(user, permissions);

    bindBackLinks();
  }

  function queryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function getUiPermissions(user) {
    const permissions = new Set(user && Array.isArray(user.permissions) ? user.permissions : []);
    CRUD_UI_PERMISSIONS.forEach((permission) => permissions.add(permission));
    return permissions;
  }

  function normalizeEntityId(value) {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) && numericValue > 0 ? String(numericValue) : '';
  }

  function filterByEntityId(rows, key, value) {
    const entityId = normalizeEntityId(value);
    const safeRows = Array.isArray(rows) ? rows : [];

    if (!entityId) {
      return safeRows;
    }

    return safeRows.filter((row) => normalizeEntityId(row && row[key]) === entityId);
  }

  function filterRowsByPatientId(rows, patientId) {
    return filterByEntityId(rows, 'patient_id', patientId);
  }

  function filterPatientsById(patients, patientId) {
    return filterByEntityId(patients, 'id', patientId);
  }

  function showUnavailableAction(message) {
    window.alert(message || 'Nenhum registro carregado para esta acao.');
  }

  function showActionError(message) {
    window.alert(message || 'Nao foi possivel concluir esta acao agora.');
  }

  function ensureConfirmationModal() {
    let overlay = document.getElementById('siselo-confirmation-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'siselo-confirmation-modal';
      overlay.className = 'confirmation-modal-overlay';
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title" aria-describedby="confirmation-modal-message confirmation-modal-description" tabindex="-1">
          <div class="confirmation-modal-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 2 2 20h20L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/>
            </svg>
          </div>
          <div class="confirmation-modal-copy">
            <h2 id="confirmation-modal-title">Confirmar acao</h2>
            <p id="confirmation-modal-message"></p>
            <p id="confirmation-modal-description"></p>
          </div>
          <div class="confirmation-modal-actions">
            <button type="button" class="btn confirmation-modal-cancel" data-confirm-cancel>Cancelar</button>
            <button type="button" class="btn btn-danger confirmation-modal-confirm" data-confirm-ok>Apagar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    return {
      overlay,
      dialog: overlay.querySelector('.confirmation-modal'),
      title: overlay.querySelector('#confirmation-modal-title'),
      message: overlay.querySelector('#confirmation-modal-message'),
      description: overlay.querySelector('#confirmation-modal-description'),
      cancelButton: overlay.querySelector('[data-confirm-cancel]'),
      confirmButton: overlay.querySelector('[data-confirm-ok]'),
    };
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && !element.hasAttribute('hidden'));
  }

  function showConfirmationDialog(options = {}) {
    if (!document.body) {
      return Promise.resolve(false);
    }

    const modal = ensureConfirmationModal();
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    modal.title.textContent = options.title || 'Confirmar acao';
    modal.message.textContent = options.message || 'Deseja continuar?';
    modal.description.textContent = options.description || '';
    modal.description.hidden = !options.description;
    modal.cancelButton.textContent = options.cancelLabel || 'Cancelar';
    modal.confirmButton.textContent = options.confirmLabel || 'Confirmar';

    modal.overlay.hidden = false;
    modal.overlay.classList.add('is-open');
    document.body.classList.add('modal-open');

    return new Promise((resolve) => {
      let resolved = false;

      const close = (confirmed) => {
        if (resolved) {
          return;
        }

        resolved = true;
        modal.overlay.classList.remove('is-open');
        modal.overlay.hidden = true;
        document.body.classList.remove('modal-open');
        modal.confirmButton.removeEventListener('click', confirm);
        modal.cancelButton.removeEventListener('click', cancel);
        modal.overlay.removeEventListener('click', cancelFromBackdrop);
        document.removeEventListener('keydown', handleKeydown);

        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }

        resolve(confirmed);
      };

      const confirm = () => close(true);
      const cancel = () => close(false);
      const cancelFromBackdrop = (event) => {
        if (event.target === modal.overlay) {
          close(false);
        }
      };
      const handleKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
          return;
        }

        if (event.key !== 'Tab') {
          return;
        }

        const focusableElements = getFocusableElements(modal.dialog);
        if (!focusableElements.length) {
          event.preventDefault();
          modal.dialog.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      };

      modal.confirmButton.addEventListener('click', confirm);
      modal.cancelButton.addEventListener('click', cancel);
      modal.overlay.addEventListener('click', cancelFromBackdrop);
      document.addEventListener('keydown', handleKeydown);
      modal.cancelButton.focus();
    });
  }

  function confirmDeletion(entityName, itemLabel) {
    const normalizedEntityName = String(entityName || 'registro').trim();
    const normalizedLabel = String(itemLabel || '').trim();
    const target = normalizedLabel
      ? `${normalizedEntityName} "${normalizedLabel}"`
      : `este ${normalizedEntityName}`;

    return showConfirmationDialog({
      title: 'Apagar registro',
      message: `Deseja realmente apagar ${target}?`,
      description: 'O item sera enviado para a lixeira e podera ser restaurado depois.',
      confirmLabel: 'Apagar',
      cancelLabel: 'Cancelar',
    });
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

  const DATE_PICKER_MONTH_NAMES = Array.from({ length: 12 }, (_, index) => (
    new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, index, 1))
  ));
  const DATE_PICKER_WEEKDAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const DATE_PICKER_DISPLAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const DATE_PICKER_INSTANCES = new WeakMap();
  let activeDatePicker = null;
  let datePickerListenersBound = false;

  function createDateAtNoon(year, month, day) {
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  function formatDateInputValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDateInputValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);

    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function normalizeDateObject(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return null;
    }

    return createDateAtNoon(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function compareDateObjects(left, right) {
    const normalizedLeft = normalizeDateObject(left);
    const normalizedRight = normalizeDateObject(right);

    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }

    return normalizedLeft.getTime() - normalizedRight.getTime();
  }

  function addDateDays(date, amount) {
    const normalizedDate = normalizeDateObject(date);
    if (!normalizedDate) {
      return null;
    }

    normalizedDate.setDate(normalizedDate.getDate() + Number(amount || 0));
    return normalizedDate;
  }

  function addDateMonths(date, amount) {
    const normalizedDate = normalizeDateObject(date);
    if (!normalizedDate) {
      return null;
    }

    return createDateAtNoon(
      normalizedDate.getFullYear(),
      normalizedDate.getMonth() + Number(amount || 0),
      1
    );
  }

  function startOfCalendarMonth(date) {
    const normalizedDate = normalizeDateObject(date);
    if (!normalizedDate) {
      return null;
    }

    return createDateAtNoon(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1);
  }

  function endOfCalendarMonth(date) {
    const normalizedDate = normalizeDateObject(date);
    if (!normalizedDate) {
      return null;
    }

    return createDateAtNoon(normalizedDate.getFullYear(), normalizedDate.getMonth() + 1, 0);
  }

  function isSameDate(left, right) {
    return compareDateObjects(left, right) === 0;
  }

  function formatDisplayDate(value) {
    const date = value instanceof Date ? value : parseDateInputValue(value);
    if (!date) {
      return '';
    }

    return DATE_PICKER_DISPLAY_FORMATTER.format(date);
  }

  function resolveDateInputValue(value) {
    if (typeof value === 'function') {
      return resolveDateInputValue(value());
    }

    if (value instanceof Date) {
      return formatDateInputValue(value);
    }

    if (!value) {
      return '';
    }

    const normalized = String(value);
    return parseDateInputValue(normalized) ? normalized : '';
  }

  function shiftDateInputValue(value, options = {}) {
    const baseDate = value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
      : parseDateInputValue(value);

    if (!baseDate) {
      return '';
    }

    if (options.years) {
      baseDate.setFullYear(baseDate.getFullYear() + Number(options.years));
    }

    if (options.months) {
      baseDate.setMonth(baseDate.getMonth() + Number(options.months));
    }

    if (options.days) {
      baseDate.setDate(baseDate.getDate() + Number(options.days));
    }

    return formatDateInputValue(baseDate);
  }

  function todayDateInputValue() {
    return formatDateInputValue(new Date());
  }

  function clampDateInputValue(value, min, max) {
    const normalizedValue = resolveDateInputValue(value);
    const normalizedMin = resolveDateInputValue(min);
    const normalizedMax = resolveDateInputValue(max);

    if (!normalizedValue) {
      return '';
    }

    if (normalizedMin && normalizedValue < normalizedMin) {
      return normalizedMin;
    }

    if (normalizedMax && normalizedValue > normalizedMax) {
      return normalizedMax;
    }

    return normalizedValue;
  }

  function getDatePickerBounds(input) {
    return {
      min: parseDateInputValue(input.min),
      max: parseDateInputValue(input.max),
    };
  }

  function clampDateObject(date, min, max) {
    const normalizedDate = normalizeDateObject(date);
    if (!normalizedDate) {
      return null;
    }

    if (min && compareDateObjects(normalizedDate, min) < 0) {
      return normalizeDateObject(min);
    }

    if (max && compareDateObjects(normalizedDate, max) > 0) {
      return normalizeDateObject(max);
    }

    return normalizedDate;
  }

  function monthHasSelectableDate(monthDate, min, max) {
    const monthStart = startOfCalendarMonth(monthDate);
    const monthEnd = endOfCalendarMonth(monthDate);

    if (!monthStart || !monthEnd) {
      return false;
    }

    if (min && compareDateObjects(monthEnd, min) < 0) {
      return false;
    }

    if (max && compareDateObjects(monthStart, max) > 0) {
      return false;
    }

    return true;
  }

  function getDatePickerDefaultViewDate(input) {
    const currentValue = parseDateInputValue(input.value);
    const bounds = getDatePickerBounds(input);
    const today = normalizeDateObject(new Date());

    // Empty calendars should open on today, not on the oldest allowed year.
    return clampDateObject(
      currentValue || today || bounds.max || bounds.min,
      bounds.min,
      bounds.max
    ) || today || bounds.min || bounds.max || createDateAtNoon(2026, 0, 1);
  }

  function ensureDatePickerGlobalListeners() {
    if (datePickerListenersBound) {
      return;
    }

    datePickerListenersBound = true;

    document.addEventListener('mousedown', (event) => {
      if (activeDatePicker && !activeDatePicker.wrapper.contains(event.target)) {
        closeDatePicker(activeDatePicker, false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeDatePicker) {
        event.preventDefault();
        closeDatePicker(activeDatePicker, true);
      }
    });

    window.addEventListener('resize', () => {
      if (activeDatePicker) {
        renderDatePicker(activeDatePicker);
      }
    });
  }

  function updateDatePickerTrigger(instance) {
    const currentValue = parseDateInputValue(instance.input.value);
    const placeholderText = instance.input.placeholder || 'dd/mm/aaaa';
    const labelText = currentValue ? formatDisplayDate(currentValue) : placeholderText;
    const helperText = '';

    instance.valueElement.textContent = labelText;
    instance.helperElement.textContent = helperText;
    instance.helperElement.hidden = true;
    instance.trigger.classList.toggle('is-empty', !currentValue);
    instance.trigger.setAttribute(
      'aria-label',
      currentValue
        ? `${instance.labelText}: ${labelText}. Pressione Enter para alterar a data.`
        : `${instance.labelText}. Pressione Enter para escolher uma data.`
    );
  }

  function setDatePickerInvalidState(input, isInvalid) {
    const instance = DATE_PICKER_INSTANCES.get(input);
    if (!instance) {
      return;
    }

    instance.wrapper.classList.toggle('is-invalid', Boolean(isInvalid));
  }

  function syncEnhancedDateInput(input) {
    const instance = DATE_PICKER_INSTANCES.get(input);
    if (!instance) {
      return input;
    }

    const clampedValue = clampDateInputValue(input.value, input.min, input.max);
    if (clampedValue !== input.value) {
      input.value = clampedValue;
    }

    const nextViewDate = parseDateInputValue(input.value) || getDatePickerDefaultViewDate(input);
    instance.state.viewDate = startOfCalendarMonth(nextViewDate);
    setDatePickerInvalidState(input, false);
    updateDatePickerTrigger(instance);

    if (activeDatePicker === instance) {
      renderDatePicker(instance);
    }

    return input;
  }

  function focusDateCell(instance, value) {
    if (!instance || !instance.grid) {
      return;
    }

    const selector = value
      ? `[data-date-value="${value}"]:not([disabled])`
      : '.date-picker-day.is-selected:not([disabled]), .date-picker-day.is-today:not([disabled]), .date-picker-day:not([disabled])';
    const target = instance.grid.querySelector(selector);
    if (target) {
      target.focus();
    }
  }

  function closeDatePicker(instance, shouldRestoreFocus) {
    if (!instance) {
      return;
    }

    instance.popover.hidden = true;
    instance.trigger.setAttribute('aria-expanded', 'false');
    instance.wrapper.classList.remove('is-open');

    if (activeDatePicker === instance) {
      activeDatePicker = null;
    }

    if (shouldRestoreFocus) {
      instance.trigger.focus();
    }
  }

  function openDatePicker(instance) {
    if (!instance) {
      return;
    }

    if (activeDatePicker && activeDatePicker !== instance) {
      closeDatePicker(activeDatePicker, false);
    }

    activeDatePicker = instance;

    if (!parseDateInputValue(instance.input.value)) {
      instance.state.viewDate = startOfCalendarMonth(getDatePickerDefaultViewDate(instance.input));
    }

    renderDatePicker(instance);
    instance.popover.hidden = false;
    instance.trigger.setAttribute('aria-expanded', 'true');
    instance.wrapper.classList.add('is-open');

    requestAnimationFrame(() => {
      focusDateCell(instance, instance.input.value);
    });
  }

  function setDatePickerValue(instance, value, options = {}) {
    if (!instance) {
      return;
    }

    instance.input.value = value || '';
    syncEnhancedDateInput(instance.input);

    if (options.dispatch !== false) {
      instance.input.dispatchEvent(new Event('input', { bubbles: true }));
      instance.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (options.close !== false) {
      closeDatePicker(instance, true);
    }
  }

  function handleDatePickerGridKeydown(event, instance, button) {
    const keyToOffset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (Object.prototype.hasOwnProperty.call(keyToOffset, event.key)) {
      event.preventDefault();

      const currentDate = parseDateInputValue(button.dataset.dateValue);
      const bounds = getDatePickerBounds(instance.input);
      const targetDate = clampDateObject(addDateDays(currentDate, keyToOffset[event.key]), bounds.min, bounds.max);

      if (!targetDate) {
        return;
      }

      instance.state.viewDate = startOfCalendarMonth(targetDate);
      renderDatePicker(instance);
      focusDateCell(instance, formatDateInputValue(targetDate));
      return;
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const direction = event.key === 'PageUp' ? -1 : 1;
      const targetDate = addDateMonths(instance.state.viewDate, direction);
      const bounds = getDatePickerBounds(instance.input);

      if (monthHasSelectableDate(targetDate, bounds.min, bounds.max)) {
        instance.state.viewDate = startOfCalendarMonth(targetDate);
        renderDatePicker(instance);
        focusDateCell(instance, button.dataset.dateValue);
      }
    }
  }

  function renderDatePicker(instance) {
    const bounds = getDatePickerBounds(instance.input);
    const today = normalizeDateObject(new Date());
    const selectedDate = parseDateInputValue(instance.input.value);
    const fallbackViewDate = getDatePickerDefaultViewDate(instance.input);
    const nextViewDate = clampDateObject(
      instance.state.viewDate || selectedDate || fallbackViewDate,
      bounds.min,
      bounds.max
    ) || fallbackViewDate;

    instance.state.viewDate = startOfCalendarMonth(nextViewDate);

    const minYear = bounds.min ? bounds.min.getFullYear() : nextViewDate.getFullYear() - 130;
    const maxYear = bounds.max ? bounds.max.getFullYear() : nextViewDate.getFullYear() + 20;
    const currentYear = instance.state.viewDate.getFullYear();
    const currentMonth = instance.state.viewDate.getMonth();

    instance.monthSelect.innerHTML = DATE_PICKER_MONTH_NAMES.map((monthName, monthIndex) => {
      const monthDate = createDateAtNoon(currentYear, monthIndex, 1);
      const isAllowed = monthHasSelectableDate(monthDate, bounds.min, bounds.max);

      return `
        <option value="${monthIndex}" ${monthIndex === currentMonth ? 'selected' : ''} ${isAllowed ? '' : 'disabled'}>
          ${escapeHtml(monthName)}
        </option>
      `;
    }).join('');

    instance.yearSelect.innerHTML = Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
      const year = minYear + index;
      return `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
    }).join('');

    instance.prevButton.disabled = !monthHasSelectableDate(addDateMonths(instance.state.viewDate, -1), bounds.min, bounds.max);
    instance.nextButton.disabled = !monthHasSelectableDate(addDateMonths(instance.state.viewDate, 1), bounds.min, bounds.max);

    const monthStart = startOfCalendarMonth(instance.state.viewDate);
    const gridStart = addDateDays(monthStart, -monthStart.getDay());
    const days = Array.from({ length: 42 }, (_, index) => addDateDays(gridStart, index));

    instance.grid.innerHTML = days.map((day) => {
      const value = formatDateInputValue(day);
      const isOutsideMonth = day.getMonth() !== currentMonth;
      const isDisabled = (bounds.min && compareDateObjects(day, bounds.min) < 0) ||
        (bounds.max && compareDateObjects(day, bounds.max) > 0);
      const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
      const isToday = isSameDate(day, today);

      const classes = [
        'date-picker-day',
        isOutsideMonth ? 'is-outside' : '',
        isSelected ? 'is-selected' : '',
        isToday ? 'is-today' : '',
      ].filter(Boolean).join(' ');

      return `
        <button
          type="button"
          class="${classes}"
          data-date-value="${value}"
          aria-label="${escapeHtml(new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }).format(day))}"
          aria-selected="${isSelected ? 'true' : 'false'}"
          ${isDisabled ? 'disabled' : ''}
        >
          ${day.getDate()}
        </button>
      `;
    }).join('');

    instance.grid.querySelectorAll('[data-date-value]').forEach((button) => {
      button.addEventListener('click', () => {
        setDatePickerValue(instance, button.dataset.dateValue);
      });

      button.addEventListener('keydown', (event) => {
        handleDatePickerGridKeydown(event, instance, button);
      });
    });

    const todayValue = formatDateInputValue(today);
    instance.todayButton.disabled = Boolean(
      (bounds.min && compareDateObjects(today, bounds.min) < 0) ||
      (bounds.max && compareDateObjects(today, bounds.max) > 0)
    );
    instance.todayButton.dataset.dateValue = todayValue;
    instance.clearButton.hidden = instance.input.dataset.dateRequired === 'true';
    instance.statusElement.textContent = selectedDate
      ? `Selecionada: ${formatDisplayDate(selectedDate)}`
      : 'Nenhuma data selecionada';

    updateDatePickerTrigger(instance);
  }

  function createDatePickerInstance(input) {
    const wrapper = document.createElement('div');
    const popoverId = `${input.id || 'date'}-calendar`;

    wrapper.className = 'date-picker';
    wrapper.innerHTML = `
      <button type="button" class="date-picker-trigger" aria-expanded="false" aria-haspopup="dialog" aria-controls="${escapeHtml(popoverId)}">
        <span class="date-picker-trigger-text">
          <span class="date-picker-trigger-value">${escapeHtml(input.placeholder || 'dd/mm/aaaa')}</span>
          <span class="date-picker-trigger-help" hidden></span>
        </span>
        <span class="date-picker-trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 9H4v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7ZM6 6a1 1 0 0 0-1 1v2h15V7a1 1 0 0 0-1-1h-1v1a1 1 0 1 1-2 0V6H8v1a1 1 0 1 1-2 0V6Z"/>
          </svg>
        </span>
      </button>
      <div id="${escapeHtml(popoverId)}" class="date-picker-popover" role="dialog" aria-modal="false" hidden>
        <div class="date-picker-header">
          <button type="button" class="date-picker-nav" data-direction="-1" aria-label="Mes anterior">&larr;</button>
          <div class="date-picker-selects">
            <select class="date-picker-select date-picker-select-month" aria-label="Selecionar mes"></select>
            <select class="date-picker-select date-picker-select-year" aria-label="Selecionar ano"></select>
          </div>
          <button type="button" class="date-picker-nav" data-direction="1" aria-label="Mes seguinte">&rarr;</button>
        </div>
        <div class="date-picker-weekdays" aria-hidden="true">
          ${DATE_PICKER_WEEKDAY_NAMES.map((name) => `<span>${name}</span>`).join('')}
        </div>
        <div class="date-picker-grid" role="grid"></div>
        <div class="date-picker-footer">
          <span class="date-picker-status" aria-live="polite"></span>
          <div class="date-picker-footer-actions">
            <button type="button" class="btn btn-link date-picker-today">Hoje</button>
            <button type="button" class="btn btn-link date-picker-clear">Limpar</button>
          </div>
        </div>
      </div>
    `;

    input.insertAdjacentElement('afterend', wrapper);
    input.dataset.dateEnhanced = 'true';
    input.dataset.dateRequired = input.required ? 'true' : 'false';
    input.required = false;
    input.type = 'hidden';
    input.classList.add('date-picker-native-input');

    const label = document.querySelector(`label[for="${input.id}"]`);
    const labelText = label ? label.textContent.trim() : 'Data';

    const instance = {
      input,
      labelText,
      wrapper,
      trigger: wrapper.querySelector('.date-picker-trigger'),
      valueElement: wrapper.querySelector('.date-picker-trigger-value'),
      helperElement: wrapper.querySelector('.date-picker-trigger-help'),
      popover: wrapper.querySelector('.date-picker-popover'),
      monthSelect: wrapper.querySelector('.date-picker-select-month'),
      yearSelect: wrapper.querySelector('.date-picker-select-year'),
      prevButton: wrapper.querySelector('[data-direction="-1"]'),
      nextButton: wrapper.querySelector('[data-direction="1"]'),
      grid: wrapper.querySelector('.date-picker-grid'),
      todayButton: wrapper.querySelector('.date-picker-today'),
      clearButton: wrapper.querySelector('.date-picker-clear'),
      statusElement: wrapper.querySelector('.date-picker-status'),
      state: {
        viewDate: startOfCalendarMonth(getDatePickerDefaultViewDate(input)),
      },
    };

    if (label) {
      label.addEventListener('click', (event) => {
        event.preventDefault();
        openDatePicker(instance);
      });
    }

    instance.trigger.addEventListener('click', () => {
      if (activeDatePicker === instance) {
        closeDatePicker(instance, false);
        return;
      }

      openDatePicker(instance);
    });

    instance.trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openDatePicker(instance);
      }
    });

    instance.monthSelect.addEventListener('change', () => {
      instance.state.viewDate = createDateAtNoon(
        Number(instance.yearSelect.value),
        Number(instance.monthSelect.value),
        1
      );
      renderDatePicker(instance);
      focusDateCell(instance, instance.input.value);
    });

    instance.yearSelect.addEventListener('change', () => {
      instance.state.viewDate = createDateAtNoon(
        Number(instance.yearSelect.value),
        Number(instance.monthSelect.value),
        1
      );
      renderDatePicker(instance);
      focusDateCell(instance, instance.input.value);
    });

    instance.prevButton.addEventListener('click', () => {
      const targetMonth = addDateMonths(instance.state.viewDate, -1);
      const bounds = getDatePickerBounds(instance.input);

      if (monthHasSelectableDate(targetMonth, bounds.min, bounds.max)) {
        instance.state.viewDate = startOfCalendarMonth(targetMonth);
        renderDatePicker(instance);
        focusDateCell(instance, instance.input.value);
      }
    });

    instance.nextButton.addEventListener('click', () => {
      const targetMonth = addDateMonths(instance.state.viewDate, 1);
      const bounds = getDatePickerBounds(instance.input);

      if (monthHasSelectableDate(targetMonth, bounds.min, bounds.max)) {
        instance.state.viewDate = startOfCalendarMonth(targetMonth);
        renderDatePicker(instance);
        focusDateCell(instance, instance.input.value);
      }
    });

    instance.todayButton.addEventListener('click', () => {
      if (!instance.todayButton.disabled) {
        setDatePickerValue(instance, instance.todayButton.dataset.dateValue);
      }
    });

    instance.clearButton.addEventListener('click', () => {
      setDatePickerValue(instance, '', { close: true });
    });

    DATE_PICKER_INSTANCES.set(input, instance);
    syncEnhancedDateInput(input);
    return instance;
  }

  function enhanceDateInput(elementOrId, options = {}) {
    const input = typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;

    if (!input) {
      return null;
    }

    const min = resolveDateInputValue(options.min);
    const max = resolveDateInputValue(options.max);

    if (min) {
      input.min = min;
    }

    if (max) {
      input.max = max;
    }

    ensureDatePickerGlobalListeners();

    const existingInstance = DATE_PICKER_INSTANCES.get(input);
    if (existingInstance) {
      syncEnhancedDateInput(input);
      return input;
    }

    createDatePickerInstance(input);
    return input;
  }

  function validateEnhancedDateInputs(form, options = {}) {
    const inputs = Array.from(form.querySelectorAll('input[data-date-enhanced="true"]'));

    if (options.alertId) {
      showAlert(options.alertId, '', 'info');
    }

    for (const input of inputs) {
      const labelText = input.dataset.dateLabel || document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() || 'Data';
      const isRequired = input.dataset.dateRequired === 'true';
      const value = resolveDateInputValue(input.value);

      if (isRequired && !value) {
        setDatePickerInvalidState(input, true);
        if (options.alertId) {
          showAlert(options.alertId, `Preencha o campo ${labelText}.`, 'error');
        }

        const instance = DATE_PICKER_INSTANCES.get(input);
        if (instance) {
          openDatePicker(instance);
        }

        return false;
      }

      input.value = clampDateInputValue(value, input.min, input.max);
      syncEnhancedDateInput(input);
    }

    return true;
  }

  const ACTION_ICON_PATHS = {
    view: 'M12 5c5.1 0 8.8 4.2 10 7-1.2 2.8-4.9 7-10 7S3.2 14.8 2 12c1.2-2.8 4.9-7 10-7Zm0 2C8.4 7 5.6 9.6 4.3 12 5.6 14.4 8.4 17 12 17s6.4-2.6 7.7-5C18.4 9.6 15.6 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z',
    edit: 'M4 17.3V20h2.7L18.9 7.8l-2.7-2.7L4 17.3ZM20.7 6a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1 1 2.7 2.7 1-1Z',
    delete: 'M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z',
    restore: 'M12 5a7 7 0 1 1-6.3 4H3l4-4 4 4H8a5 5 0 1 0 4-2V5Zm-1 4h2v4.2l3 1.8-1 1.7-4-2.4V9Z',
    pdf: 'M6 2h8l4 4v16H6V2Zm7 1.8V7h3.2L13 3.8ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Zm0-8h4v2H8V8Z',
    toggle: 'M11 2h2v10h-2V2Zm5.7 3.3 1.4 1.4A8 8 0 1 1 5.9 6.7l1.4-1.4A6 6 0 1 0 16.7 5.3Z',
    reset: 'M7 14a5 5 0 1 1 4.9-6H22v3h-2v2h-3v-2h-5.1A5 5 0 0 1 7 14Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 17h14v2H5v-2Zm2 3h10v2H7v-2Z',
  };

  function actionAttributes(attributes = {}) {
    return Object.entries(attributes)
      .filter(([, value]) => value !== false && value !== null && value !== undefined)
      .map(([name, value]) => {
        if (value === true) {
          return escapeHtml(name);
        }

        return `${escapeHtml(name)}="${escapeHtml(value)}"`;
      })
      .join(' ');
  }

  function actionIcon(kind) {
    const path = ACTION_ICON_PATHS[kind] || ACTION_ICON_PATHS.view;
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="${path}"/>
      </svg>
    `;
  }

  function iconLink(kind, href, label, attributes = {}) {
    const className = `icon-btn${kind === 'delete' ? ' icon-btn-danger' : ''}${attributes.class ? ` ${attributes.class}` : ''}`;
    const attrs = actionAttributes({
      ...attributes,
      class: className,
      href,
      title: label,
      'aria-label': label,
    });

    return `<a ${attrs}>${actionIcon(kind)}</a>`;
  }

  function iconButton(kind, label, attributes = {}) {
    const className = `icon-btn${kind === 'delete' ? ' icon-btn-danger' : ''}${attributes.class ? ` ${attributes.class}` : ''}`;
    const attrs = actionAttributes({
      type: 'button',
      ...attributes,
      class: className,
      title: label,
      'aria-label': label,
    });

    return `<button ${attrs}>${actionIcon(kind)}</button>`;
  }

  function emptyTableRow(colspan, title, description = '', action = null) {
    const resolvedAction = description && typeof description === 'object' ? description : action;
    const safeColspan = Math.max(1, Number(colspan || 1));
    const safeTitle = String(title || 'Nenhum registro encontrado.').trim();
    const safeDescription = typeof description === 'object' ? '' : String(description || '').trim();
    const actionHtml = resolvedAction && resolvedAction.href && resolvedAction.label
      ? `<a ${actionAttributes({
        class: resolvedAction.class || 'btn btn-primary table-empty-action',
        href: resolvedAction.href,
      })}>${escapeHtml(resolvedAction.label)}</a>`
      : '';

    return `
      <tr class="table-empty-row">
        <td colspan="${safeColspan}">
          <div class="table-empty-state">
            <div class="table-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7 7h11l-2.6-2.6L17 3l5 5-5 5-1.6-1.4L18 9H7V7Zm10 10H6l2.6 2.6L7 21l-5-5 5-5 1.6 1.4L6 15h11v2Z"/>
              </svg>
            </div>
            <p class="table-empty-title">${escapeHtml(safeTitle)}</p>
            ${safeDescription ? `<p class="table-empty-text">${escapeHtml(safeDescription)}</p>` : ''}
            ${actionHtml}
          </div>
        </td>
      </tr>
    `;
  }

  window.SISELO = {
    apiRequest,
    bindShell,
    clampDateInputValue,
    confirmDeletion,
    clearSession,
    createSearchState,
    digitsOnly,
    enhanceDateInput,
    escapeHtml,
    formatDateInputValue,
    getApiBaseUrl,
    getSession,
    highlightPersonName,
    iconButton,
    iconLink,
    emptyTableRow,
    matchesPersonNamePrefix,
    matchesSearchDigits,
    matchesSearchText,
    normalizeSearchText,
    parseDateInputValue,
    queryParam,
    requireSession,
    resolveDateInputValue,
    saveSessionPayload,
    setText,
    shiftDateInputValue,
    syncEnhancedDateInput,
    syncSearchUrl,
    showActionError,
    showUnavailableAction,
    showAlert,
    todayDateInputValue,
    getUiPermissions,
    filterPatientsById,
    filterRowsByPatientId,
    normalizeEntityId,
    validateEnhancedDateInputs,
  };
})();
