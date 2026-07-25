(function () {
  const config = window.SISELO_CONFIG || {};
  const SESSION_KEY = 'siselo_session';
  const CSRF_KEY = 'siselo_csrf';
  const NAVIGATION_KEY = 'siselo_navigation';
  const CADH_SEARCH_KEY = 'siselo_cadh_search';
  const FLASH_ALERT_KEY = 'siselo_flash_alert';
  const TEAM_LABELS = {
    safira: 'Safira',
    ametista: 'Ametista',
    esmeralda: 'Esmeralda',
    diamante: 'Diamante',
    sem_equipe: 'Sem equipe',
    'sem equipe': 'Sem equipe',
  };
  const TEAM_THEMES = {
    safira: { color: '#2f6fec', border: '#c7dafc', bg: '#f0f6ff', text: '#2357c6', className: 'team-badge-safira' },
    ametista: { color: '#c850d8', border: '#edcef7', bg: '#fdf5ff', text: '#9c27b0', className: 'team-badge-ametista' },
    esmeralda: { color: '#0f9f75', border: '#bdebd4', bg: '#effcf6', text: '#08785a', className: 'team-badge-esmeralda' },
    diamante: { color: '#1f2937', border: '#cbd5e1', bg: '#f4f7fa', text: '#111827', className: 'team-badge-diamante' },
    sem_equipe: { color: '#94a3b8', border: '#d7dee8', bg: '#f4f6f8', text: '#667085', className: 'team-badge-sem-equipe' },
    'sem equipe': { color: '#94a3b8', border: '#d7dee8', bg: '#f4f6f8', text: '#667085', className: 'team-badge-sem-equipe' },
  };
  const TEAM_FALLBACK_THEMES = [
    { color: '#0f766e', border: '#99f6e4', bg: '#ecfdfa', text: '#0f766e' },
    { color: '#b45309', border: '#fde68a', bg: '#fffbeb', text: '#92400e' },
    { color: '#be123c', border: '#fecdd3', bg: '#fff1f2', text: '#9f1239' },
    { color: '#0369a1', border: '#bae6fd', bg: '#f0f9ff', text: '#075985' },
    { color: '#4d7c0f', border: '#d9f99d', bg: '#f7fee7', text: '#3f6212' },
  ];
  let currentDateTickerBound = false;

  function applyRuntimeLayoutContext() {
    const params = new URLSearchParams(window.location.search);
    let isEmbedded = params.get('embed') === '1' || params.get('embedded') === '1';

    try {
      isEmbedded = isEmbedded || window.self !== window.top;
    } catch (error) {
      isEmbedded = true;
    }

    document.documentElement.classList.toggle('is-embedded', isEmbedded);
    document.documentElement.style.setProperty('--app-viewport-height', `${window.innerHeight}px`);
  }

  function getResponsiveTableLabels(table) {
    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    if (headerRows.length === 0) {
      return [];
    }

    const headerCells = Array.from(headerRows[headerRows.length - 1].querySelectorAll('th'));
    return headerCells.map((cell, index) => {
      const label = String(cell.getAttribute('aria-label') || cell.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      return label || (index === headerCells.length - 1 ? 'Ações' : '');
    });
  }

  function labelResponsiveTable(table) {
    if (!(table instanceof HTMLTableElement)) {
      return;
    }

    const labels = getResponsiveTableLabels(table);
    if (labels.length === 0) {
      return;
    }

    table.querySelectorAll('tbody tr').forEach((row) => {
      if (row.classList.contains('table-empty-row')) {
        return;
      }

      const cells = Array.from(row.children).filter((cell) => cell instanceof HTMLTableCellElement);
      if (cells.length !== labels.length || cells.some((cell) => Number(cell.colSpan || 1) > 1)) {
        return;
      }

      cells.forEach((cell, index) => {
        const label = labels[index];
        if (label) {
          cell.dataset.label = label;
        } else {
          delete cell.dataset.label;
        }
      });
    });
  }

  function enhanceResponsiveTables(root = document) {
    const scope = root instanceof Document || root instanceof Element ? root : document;
    scope.querySelectorAll('table').forEach(labelResponsiveTable);

    if (!document.body || document.documentElement.dataset.responsiveTablesBound === 'true') {
      return;
    }

    document.documentElement.dataset.responsiveTablesBound = 'true';
    const observer = new MutationObserver((mutations) => {
      const tables = new Set();

      mutations.forEach((mutation) => {
        const targetTable = mutation.target instanceof Element
          ? mutation.target.closest('table')
          : null;
        if (targetTable) {
          tables.add(targetTable);
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }

          if (node.matches('table')) {
            tables.add(node);
          }
          node.querySelectorAll('table').forEach((table) => tables.add(table));
        });
      });

      tables.forEach(labelResponsiveTable);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  applyRuntimeLayoutContext();
  window.addEventListener('resize', applyRuntimeLayoutContext, { passive: true });
  window.addEventListener('orientationchange', applyRuntimeLayoutContext, { passive: true });

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const UI_SELECTORS = {
    button: [
      '.btn',
      '.icon-btn',
      '.topbar-logout',
      '.topbar-account',
      '.topbar-icon-btn',
      '.cadh-search-button',
      '.cadh-new-patient-link',
      '.cadh-tab-link',
      '.cadh-specialty-card',
      '.cadh-transition-cta',
      '.ubs-tab',
      '.ubs-row-action',
      '.ubs-filter-button',
      '.date-picker-trigger',
      '.choice-select-trigger',
      '.choice-select-option',
      '.team-picker-trigger',
      '.team-picker-option',
      '.care-plan-repeat-button',
      '.confirmation-modal-actions button',
      '[data-ui-button]',
    ].join(', '),
    card: [
      '.card',
      '.home-metric-card',
      '.home-environment-card',
      '.home-pillar-card',
      '.home-direction-card',
      '.cadh-management-card',
      '.cadh-patient-search',
      '.cadh-patient-detail',
      '.cadh-specialty-card',
      '.cadh-tab-link',
      '.cadh-care-plan-card',
      '.cadh-transition-card',
      '.clinical-specialty-section',
      '.patient360-card',
      '.ubs-card',
      '.ubs-followup-card',
      '.care-plan-section',
      '.care-plan-static-field',
      '.care-plan-patient-picker',
      '.care-plan-row-title',
      '[data-ui-card]',
    ].join(', '),
    input: [
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"])',
      'textarea',
      'select',
      '[data-ui-input]',
    ].join(', '),
    checkbox: 'input[type="checkbox"], [data-ui-checkbox]',
    radio: 'input[type="radio"], [data-ui-radio]',
    range: 'input[type="range"], [data-ui-slider]',
    badge: [
      '.badge',
      '.team-badge',
      '.status-badge',
      '.cadh-module-badge',
      '.home-operational-status',
      '[data-ui-badge]',
    ].join(', '),
    table: 'table, [data-ui-table]',
    tableShell: '.table-scroll, [data-ui-table-shell]',
    toolbar: '.toolbar, .actions, .form-actions, .transition-form-actions, [data-ui-toolbar]',
    alert: '.alert, [data-ui-alert]',
    dialogOverlay: '.confirmation-modal-overlay, [data-ui-dialog-overlay]',
    dialog: '.confirmation-modal, [data-ui-dialog]',
    popover: '.search-suggestions, .date-picker-popover, .choice-select-menu, .team-picker-menu, [data-ui-popover]',
    tabs: '.cadh-module-tabs, .tabs, [data-ui-tabs]',
    progress: 'progress, [data-ui-progress]',
    skeleton: '.skeleton, [data-ui-skeleton]',
  };

  let uiMutationObserverBound = false;

  function forEachUiMatch(root, selector, callback) {
    const scope = root instanceof Document || root instanceof Element ? root : document;
    const matches = [];

    if (scope instanceof Element && scope.matches(selector)) {
      matches.push(scope);
    }

    if (typeof scope.querySelectorAll === 'function') {
      scope.querySelectorAll(selector).forEach((element) => matches.push(element));
    }

    matches.forEach((element) => {
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        callback(element);
      }
    });
  }

  function setUiComponent(element, name, classes = []) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.dataset.uiComponent = element.dataset.uiComponent || name;
    classes.filter(Boolean).forEach((className) => element.classList.add(className));
  }

  function getButtonVariant(element) {
    const className = String(element.className || '').toLowerCase();
    const text = String(element.textContent || '').toLowerCase();

    if (
      className.includes('danger') ||
      className.includes('delete') ||
      className.includes('destructive') ||
      text.includes('excluir') ||
      text.includes('inativar')
    ) {
      return 'destructive';
    }

    if (
      className.includes('primary') ||
      className.includes('confirm') ||
      className.includes('search') ||
      className.includes('new') ||
      className.includes('save') ||
      text.includes('salvar') ||
      text.includes('buscar') ||
      text.includes('novo')
    ) {
      return 'default';
    }

    if (className.includes('link') || element.hasAttribute('data-back-link')) {
      return 'ghost';
    }

    if (className.includes('icon') || (element.querySelector('svg') && String(element.textContent || '').trim().length <= 2)) {
      return 'icon';
    }

    return 'outline';
  }

  function enhanceUiButtons(root = document) {
    forEachUiMatch(root, UI_SELECTORS.button, (element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const variant = element.dataset.uiVariant || getButtonVariant(element);
      setUiComponent(element, 'button', ['ui-button', `ui-button-${variant}`]);
      element.dataset.uiVariant = variant;
    });
  }

  function enhanceUiCards(root = document) {
    forEachUiMatch(root, UI_SELECTORS.card, (element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const classes = ['ui-card'];
      if (element instanceof HTMLAnchorElement || element instanceof HTMLButtonElement) {
        classes.push('ui-card-action');
      }
      setUiComponent(element, 'card', classes);
    });
  }

  function enhanceUiInputs(root = document) {
    forEachUiMatch(root, UI_SELECTORS.input, (element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (element instanceof HTMLTextAreaElement) {
        setUiComponent(element, 'textarea', ['ui-textarea']);
        return;
      }

      if (element instanceof HTMLSelectElement) {
        setUiComponent(element, 'select', ['ui-select']);
        return;
      }

      setUiComponent(element, 'input', ['ui-input']);
    });

    forEachUiMatch(root, UI_SELECTORS.checkbox, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'checkbox', ['ui-checkbox']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.radio, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'radio', ['ui-radio']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.range, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'slider', ['ui-slider']);
      }
    });
  }

  function enhanceUiBadges(root = document) {
    forEachUiMatch(root, UI_SELECTORS.badge, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'badge', ['ui-badge']);
      }
    });
  }

  function enhanceUiTables(root = document) {
    forEachUiMatch(root, UI_SELECTORS.tableShell, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'table-shell', ['ui-table-shell']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.table, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'table', ['ui-table']);
      }
    });
  }

  function enhanceUiOverlays(root = document) {
    forEachUiMatch(root, UI_SELECTORS.alert, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'alert', ['ui-alert']);
        if (!element.getAttribute('role')) {
          element.setAttribute('role', 'alert');
        }
      }
    });

    forEachUiMatch(root, UI_SELECTORS.dialogOverlay, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'dialog-overlay', ['ui-dialog-overlay']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.dialog, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'dialog', ['ui-dialog']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.popover, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'popover', ['ui-popover']);
      }
    });
  }

  function enhanceUiStructure(root = document) {
    forEachUiMatch(root, UI_SELECTORS.toolbar, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'toolbar', ['ui-toolbar']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.tabs, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'tabs', ['ui-tabs']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.progress, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'progress', ['ui-progress']);
      }
    });

    forEachUiMatch(root, UI_SELECTORS.skeleton, (element) => {
      if (element instanceof HTMLElement) {
        setUiComponent(element, 'skeleton', ['ui-skeleton']);
      }
    });
  }

  function applyUiComponents(root = document) {
    if (document.body) {
      document.body.classList.add('siselo-ui-ready');
    }

    enhanceUiCards(root);
    enhanceUiButtons(root);
    enhanceUiInputs(root);
    enhanceUiBadges(root);
    enhanceUiTables(root);
    enhanceUiOverlays(root);
    enhanceUiStructure(root);
  }

  function bindUiComponentObserver() {
    if (!document.body || uiMutationObserverBound) {
      return;
    }

    uiMutationObserverBound = true;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            applyUiComponents(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function createUiElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    const className = String(options.className || '').trim();

    if (className) {
      element.className = className;
    }

    Object.entries(options.attrs || {}).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) {
        return;
      }
      if (value === true) {
        element.setAttribute(name, '');
        return;
      }
      element.setAttribute(name, String(value));
    });

    if (options.html !== undefined) {
      element.innerHTML = String(options.html);
    } else if (options.text !== undefined) {
      element.textContent = String(options.text);
    }

    (Array.isArray(options.children) ? options.children : []).forEach((child) => {
      if (child instanceof Node) {
        element.appendChild(child);
      }
    });

    applyUiComponents(element);
    return element;
  }

  function createUiButton(options = {}) {
    const tagName = options.href ? 'a' : 'button';
    const element = createUiElement(tagName, {
      className: ['ui-button', options.className].filter(Boolean).join(' '),
      attrs: {
        href: options.href,
        type: tagName === 'button' ? (options.type || 'button') : undefined,
        'data-ui-button': 'true',
        'data-ui-variant': options.variant || undefined,
        'aria-label': options.ariaLabel,
      },
      html: options.html,
      text: options.html === undefined ? options.label : undefined,
      children: options.children,
    });

    if (options.variant) {
      element.dataset.uiVariant = options.variant;
      element.classList.add(`ui-button-${options.variant}`);
    }

    return element;
  }

  function createUiCard(options = {}) {
    return createUiElement('section', {
      className: ['ui-card', options.className].filter(Boolean).join(' '),
      attrs: { 'data-ui-card': 'true', ...options.attrs },
      html: options.html,
      children: options.children,
    });
  }

  function createUiBadge(options = {}) {
    return createUiElement('span', {
      className: ['ui-badge', options.className].filter(Boolean).join(' '),
      attrs: { 'data-ui-badge': 'true', ...options.attrs },
      text: options.label,
      html: options.html,
    });
  }

  function createUiAlert(options = {}) {
    return createUiElement('div', {
      className: ['ui-alert', options.type ? `ui-alert-${options.type}` : '', options.className].filter(Boolean).join(' '),
      attrs: { role: 'alert', 'data-ui-alert': 'true', ...options.attrs },
      text: options.message,
      html: options.html,
    });
  }

  function ensureToastViewport() {
    let viewport = document.getElementById('siselo-toast-viewport');
    if (!viewport) {
      viewport = document.createElement('ol');
      viewport.id = 'siselo-toast-viewport';
      viewport.className = 'ui-toast-viewport';
      viewport.setAttribute('aria-live', 'polite');
      viewport.setAttribute('aria-relevant', 'additions text');
      document.body.appendChild(viewport);
    }
    applyUiComponents(viewport);
    return viewport;
  }

  function showToast(message, type = 'info', options = {}) {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage || !document.body) {
      return null;
    }

    const viewport = ensureToastViewport();
    const toast = document.createElement('li');
    const normalizedType = String(type || 'info').trim() || 'info';
    const title = String(options.title || '').trim();
    toast.className = `ui-toast ui-toast-${normalizedType}`;
    toast.dataset.uiComponent = 'toast';
    toast.innerHTML = `
      <div class="ui-toast-copy">
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
        <span>${escapeHtml(normalizedMessage)}</span>
      </div>
      <button type="button" class="ui-toast-close" aria-label="Fechar aviso">x</button>
    `;
    viewport.appendChild(toast);
    applyUiComponents(toast);

    const close = () => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 180);
    };

    toast.querySelector('.ui-toast-close')?.addEventListener('click', close);
    window.setTimeout(close, Number(options.duration || 3800));
    return { element: toast, close };
  }

  const SiseloUI = {
    alert: createUiAlert,
    apply: applyUiComponents,
    badge: createUiBadge,
    button: createUiButton,
    card: createUiCard,
    create: createUiElement,
    toast: showToast,
  };

  window.SiseloUI = SiseloUI;

  const initUiComponents = () => {
    applyUiComponents(document);
    bindUiComponentObserver();
    bindStaticTextSelectionGuard();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUiComponents, { once: true });
  } else {
    initUiComponents();
  }

  function digitsOnly(value) {
    return String(value ?? '').replace(/\D+/g, '');
  }

  const STATIC_TEXT_UI_SELECTOR = [
    'a',
    'button',
    '[role="button"]',
    '[role="tab"]',
    '.btn',
    '.icon-btn',
    '.topbar',
    '.home-sidebar',
    '.home-page-header',
    '.siselo-page-header',
    '.cadh-module-tabs',
    '.tabs',
    '.ui-tabs',
    '.ui-button',
    '.ui-card',
    '.card',
    '.status-badge',
    '.team-badge',
    '.badge',
    '.home-system-status',
    '.home-operational-status',
    '.patient360-tabs',
    '.patient360-name',
    '.cadh-specialty-card',
    '.ubs-tab',
  ].join(', ');

  const EDITABLE_TEXT_SELECTOR = [
    'input:not([type="button"]):not([type="submit"]):not([type="reset"])',
    'textarea',
    '[contenteditable="true"]',
  ].join(', ');

  function isEditableTextTarget(target) {
    return target instanceof HTMLElement && (
      target.isContentEditable ||
      Boolean(target.closest(EDITABLE_TEXT_SELECTOR))
    );
  }

  function isStaticTextUiTarget(target) {
    return target instanceof HTMLElement &&
      !isEditableTextTarget(target) &&
      Boolean(target.closest(STATIC_TEXT_UI_SELECTOR));
  }

  function clearStaticTextSelection() {
    if (isEditableTextTarget(document.activeElement)) {
      return;
    }

    const selection = window.getSelection ? window.getSelection() : null;
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
  }

  function bindStaticTextSelectionGuard() {
    if (document.documentElement.dataset.staticTextSelectionGuardBound === 'true') {
      return;
    }

    document.documentElement.dataset.staticTextSelectionGuardBound = 'true';
    let lastStaticUiPointerAt = 0;

    const markStaticUiPointer = (event) => {
      if (!isStaticTextUiTarget(event.target)) {
        return;
      }

      lastStaticUiPointerAt = Date.now();
      window.requestAnimationFrame(clearStaticTextSelection);
    };

    document.addEventListener('pointerdown', markStaticUiPointer, true);
    document.addEventListener('mousedown', markStaticUiPointer, true);
    document.addEventListener('click', (event) => {
      if (isStaticTextUiTarget(event.target)) {
        clearStaticTextSelection();
      }
    }, true);
    document.addEventListener('selectionchange', () => {
      if (Date.now() - lastStaticUiPointerAt < 700) {
        clearStaticTextSelection();
      }
    });
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

    return digitsOnly(value).startsWith(state.digits);
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

  function highlightSearchDigits(value, search, fallback = '<span class="muted">-</span>') {
    const original = String(value ?? '').trim();
    if (!original) {
      return fallback;
    }

    const state = getSearchState(search);
    if (!state.hasDigits) {
      return escapeHtml(original);
    }

    const digits = digitsOnly(original);
    const matchIndex = digits.indexOf(state.digits);
    if (matchIndex === -1) {
      return escapeHtml(original);
    }

    let digitPosition = 0;
    let rangeStart = -1;
    let rangeEnd = -1;

    for (let index = 0; index < original.length; index += 1) {
      if (!/\d/.test(original[index])) {
        continue;
      }

      if (digitPosition === matchIndex) {
        rangeStart = index;
      }

      if (digitPosition === matchIndex + state.digits.length - 1) {
        rangeEnd = index + 1;
        break;
      }

      digitPosition += 1;
    }

    if (rangeStart === -1 || rangeEnd === -1) {
      return escapeHtml(original);
    }

    return `
      ${escapeHtml(original.slice(0, rangeStart))}<mark class="search-highlight">${escapeHtml(original.slice(rangeStart, rangeEnd))}</mark>${escapeHtml(original.slice(rangeEnd))}
    `.trim();
  }

  function filterPatientsForSearch(patients, query) {
    const search = getSearchState(query);
    if (!search.hasLetters && !search.hasDigits) {
      return Array.isArray(patients) ? patients : [];
    }

    return (Array.isArray(patients) ? patients : []).filter((patient) => {
      const matchesName = search.hasLetters
        ? matchesPersonNamePrefix(patient && patient.full_name, search)
        : true;
      const matchesCPF = search.hasDigits
        ? digitsOnly(patient && patient.cpf).includes(search.digits)
        : true;

      return matchesName && matchesCPF;
    });
  }

  function normalizePatientSearchRow(patient) {
    return {
      id: normalizeEntityId(patient && patient.id),
      full_name: String((patient && patient.full_name) || '').trim(),
      cpf: String((patient && patient.cpf) || '').trim(),
      team_ref: String((patient && patient.team_ref) || '').trim(),
    };
  }

  function mergePatientSearchRows(...rowGroups) {
    const merged = new Map();

    rowGroups.flat().forEach((row) => {
      const normalizedRow = normalizePatientSearchRow(row);
      if (!normalizedRow.id) {
        return;
      }

      const cpfKey = digitsOnly(normalizedRow.cpf);
      const identityKey = cpfKey ? `cpf:${cpfKey}` : `id:${normalizedRow.id}`;
      merged.set(identityKey, {
        ...(merged.get(identityKey) || {}),
        ...normalizedRow,
      });
    });

    return Array.from(merged.values());
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
    sessionStorage.removeItem(FLASH_ALERT_KEY);
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

  function readCadhSearchState() {
    try {
      return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeCadhSearchState(state) {
    if (!state) {
      sessionStorage.removeItem(CADH_SEARCH_KEY);
      return;
    }

    sessionStorage.setItem(CADH_SEARCH_KEY, JSON.stringify(state));
  }

  function getCsrfToken() {
    return sessionStorage.getItem(CSRF_KEY) || '';
  }

  function getCurrentAppPath() {
    return `${location.pathname}${location.search}${location.hash}`;
  }

  function getClinicalModuleMeta(moduleKey) {
    const meta = {
      careplans: {
        singular: 'plano de cuidado',
        emptyTitle: 'Usuário sem plano de cuidado registrado.',
        emptyDescription: '',
      },
      encounters: {
        singular: 'atendimento',
        emptyTitle: 'Usuário sem atendimento registrado.',
        emptyDescription: '',
      },
      transitions: {
        singular: 'transição do cuidado',
        emptyTitle: 'Usuário sem transição do cuidado registrada.',
        emptyDescription: '',
      },
    };

    return meta[moduleKey] || {
      singular: 'registro assistencial',
      emptyTitle: 'Usuário sem registros assistenciais vinculados.',
      emptyDescription: '',
    };
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
    const explicitReturnTarget = normalizeAppPath(queryParam('return_to'));
    const patientId = normalizeEntityId(queryParam('patient_id'));

    if (explicitReturnTarget) {
      return explicitReturnTarget;
    }

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

  function getSameOriginReferrerPath() {
    try {
      if (!document.referrer) {
        return '';
      }

      const referrerUrl = new URL(document.referrer);
      if (referrerUrl.origin !== location.origin) {
        return '';
      }

      const referrerPath = normalizeAppPath(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`);
      const currentPath = normalizeAppPath(`${location.pathname}${location.search}${location.hash}`);

      if (!referrerPath || referrerPath === currentPath) {
        return '';
      }

      return referrerPath;
    } catch (error) {
      return '';
    }
  }

  function getNavigationPreviousPath() {
    const state = readNavigationState();
    return normalizeAppPath(state.previous);
  }

  function isSamePathGroup(firstPath, secondPath) {
    const first = normalizeAppPath(firstPath);
    const second = normalizeAppPath(secondPath);
    if (!first || !second) {
      return false;
    }

    const firstSegment = new URL(first, location.origin).pathname.split('/').filter(Boolean)[0] || '';
    const secondSegment = new URL(second, location.origin).pathname.split('/').filter(Boolean)[0] || '';
    return firstSegment !== '' && firstSegment === secondSegment;
  }

  function resolvePreviousScreenTarget(link) {
    const fallback = link?.dataset?.fallback || link?.getAttribute?.('href') || '';
    const scopedFallback = resolveBackTarget(fallback);
    const previousPath = getSameOriginReferrerPath() || getNavigationPreviousPath();

    return isSamePathGroup(previousPath, scopedFallback) ? previousPath : scopedFallback;
  }

  function navigatePreviousScreen(link) {
    location.href = resolvePreviousScreenTarget(link);
  }

  function isBackShortcutBlocked(event) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      document.body.classList.contains('modal-open') ||
      document.querySelector('.choice-select.is-open, .team-picker.is-open, .date-picker.is-open')
    ) {
      return true;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (
      target.isContentEditable ||
      target.closest('input, textarea, select, [contenteditable="true"], .choice-select, .team-picker, .date-picker')
    ) {
      return true;
    }

    return false;
  }

  function bindBackShortcut() {
    if (document.documentElement.dataset.backShortcutBound === 'true') {
      return;
    }

    document.documentElement.dataset.backShortcutBound = 'true';
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || isBackShortcutBlocked(event)) {
        return;
      }

      const link = Array.from(document.querySelectorAll('[data-back-link]')).find((item) => {
        if (!(item instanceof HTMLElement)) {
          return false;
        }

        return item.offsetParent !== null || item.getClientRects().length > 0;
      });

      if (link) {
        event.preventDefault();
        navigatePreviousScreen(link);
      }
    });
  }

  function bindBackLinks() {
    document.querySelectorAll('[data-back-link]').forEach((link) => {
      enhanceBackLink(link);

      if (link.dataset.backLinkBound === 'true') {
        return;
      }

      link.dataset.backLinkBound = 'true';

      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigatePreviousScreen(link);
      });
    });

    bindBackShortcut();
  }

  function enhanceBackLink(link) {
    if (!(link instanceof HTMLElement) || link.dataset.backLinkEnhanced === 'true') {
      return;
    }

    link.dataset.backLinkEnhanced = 'true';
    link.classList.add('back-link');
    link.title = link.title || 'Voltar para a tela anterior';
    link.setAttribute('aria-label', link.getAttribute('aria-label') || 'Voltar para a tela anterior');

    if (!link.querySelector('svg')) {
      const text = String(link.textContent || 'Voltar')
        .replace(/^[←\u2190\-\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Voltar';

      link.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 5 8 12l7 7"/>
          <path d="M9 12h11"/>
        </svg>
        <span>${escapeHtml(text)}</span>
      `;
    }
  }

  function enhanceSearchInput(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.searchDecorated === 'true') {
      return input;
    }

    let wrapper = input.parentElement;
    if (!(wrapper instanceof HTMLElement) || !wrapper.classList.contains('search-input-shell')) {
      wrapper = document.createElement('div');
      wrapper.className = 'search-input-shell';
      input.parentNode?.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    let icon = wrapper.querySelector('.search-input-icon');
    if (!(icon instanceof HTMLElement)) {
      icon = document.createElement('span');
      icon.className = 'search-input-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="m16.2 16.2 3.8 3.8"></path>
        </svg>
      `;
      wrapper.prepend(icon);
    }

    input.classList.add('search-input-control');
    input.dataset.searchDecorated = 'true';
    return input;
  }

  function decorateSearchInputs(root = document) {
    const scope = root instanceof Document || root instanceof Element ? root : document;
    const selector = [
      '.search-toolbar input:not([type="hidden"])',
      '.cadh-patient-search input:not([type="hidden"])',
      'input[data-search-input="true"]:not([type="hidden"])',
    ].join(', ');

    if (scope instanceof HTMLInputElement && scope.matches(selector)) {
      enhanceSearchInput(scope);
      return;
    }

    scope.querySelectorAll(selector).forEach((input) => enhanceSearchInput(input));
  }

  function setupPatientSearchAutocomplete(input, options = {}) {
    if (!(input instanceof HTMLInputElement)) {
      return { destroy() {} };
    }

    enhanceSearchInput(input);
    const wrapper = input.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      return { destroy() {} };
    }

    wrapper.classList.add('search-input-shell-has-suggestions');
    let panel = wrapper.querySelector('.search-suggestions');
    if (!(panel instanceof HTMLElement)) {
      panel = document.createElement('div');
      panel.className = 'search-suggestions';
      panel.hidden = true;
      panel.setAttribute('role', 'listbox');
      wrapper.appendChild(panel);
    }

    const onPick = typeof options.onPick === 'function'
      ? options.onPick
      : (patient) => {
        location.href = `/patients/show.html?id=${encodeURIComponent(patient.id)}&tab=planos`;
      };
    const getInputValue = typeof options.getInputValue === 'function'
      ? options.getInputValue
      : (patient) => patient.full_name || input.value;
    const renderName = typeof options.renderName === 'function'
      ? options.renderName
      : (patient, query) => highlightPersonName(
        patient.full_name,
        query,
        escapeHtml(patient.full_name || '-')
      );
    const renderMeta = typeof options.renderMeta === 'function'
      ? options.renderMeta
      : (patient, query) => {
        const cpf = patient.cpf
          ? `CPF: ${highlightSearchDigits(patient.cpf, query, escapeHtml(patient.cpf))}`
          : 'CPF: -';
        return `${cpf} | Equipe: ${escapeHtml(formatTeamName(patient.team_ref))}`;
      };
    const filterRows = typeof options.filterRows === 'function'
      ? options.filterRows
      : (rows, search) => filterPatientsForSearch(rows, search);
    const minLength = Math.max(1, Number(options.minLength || 1));
    const limit = Math.max(4, Number(options.limit || 8));
    const localRows = Array.isArray(options.rows) ? options.rows : [];
    const seenPatients = new Map();
    let activeIndex = -1;
    let visiblePatients = [];
    let debounceTimer = 0;
    let requestToken = 0;

    const mergeRows = (rows) => {
      mergePatientSearchRows((Array.isArray(rows) ? rows : []).map((row) => ({
        id: (row && row.patient_id) || (row && row.id),
        full_name: row && row.full_name,
        cpf: row && row.cpf,
        team_ref: row && row.team_ref,
      }))).forEach((patient) => {
        const cpfKey = digitsOnly(patient.cpf);
        const identityKey = cpfKey ? `cpf:${cpfKey}` : `id:${patient.id}`;
        seenPatients.set(identityKey, patient);
      });
    };

    mergeRows(localRows);

    const updateExpandedState = () => {
      input.setAttribute('aria-expanded', String(!panel.hidden));
    };

    const closePanel = () => {
      panel.hidden = true;
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      updateExpandedState();
    };

    const renderPanel = (query, patients) => {
      visiblePatients = patients.slice(0, limit);
      if (!visiblePatients.length) {
        panel.innerHTML = '';
        closePanel();
        return;
      }

      panel.innerHTML = visiblePatients.map((patient, index) => `
        <button
          type="button"
          id="search-suggestion-${patient.id}"
          class="search-suggestion${index === activeIndex ? ' is-active' : ''}"
          role="option"
          aria-selected="${index === activeIndex ? 'true' : 'false'}"
          data-patient-id="${patient.id}"
        >
          <span class="search-suggestion-name">${renderName(patient, query)}</span>
          <span class="search-suggestion-meta">${renderMeta(patient, query)}</span>
        </button>
      `).join('');

      panel.hidden = false;
      updateExpandedState();

      if (activeIndex >= 0 && visiblePatients[activeIndex]) {
        input.setAttribute('aria-activedescendant', `search-suggestion-${visiblePatients[activeIndex].id}`);
      } else {
        input.removeAttribute('aria-activedescendant');
      }

      panel.querySelectorAll('[data-patient-id]').forEach((button) => {
        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });

        button.addEventListener('click', () => {
          const patient = visiblePatients.find((item) => item.id === button.dataset.patientId);
          if (!patient) {
            return;
          }

          input.value = getInputValue(patient);
          closePanel();
          onPick(patient);
        });
      });
    };

    const resolveSuggestions = async (query) => {
      const trimmedQuery = String(query || '').trim();
      if (trimmedQuery.length < minLength) {
        closePanel();
        return;
      }

      const search = getSearchState(trimmedQuery);
      const localMatches = filterRows(Array.from(seenPatients.values()), search);
      renderPanel(trimmedQuery, localMatches);

      const token = ++requestToken;
      try {
        const data = await apiRequest('/patients/list.php?q=' + encodeURIComponent(trimmedQuery));
        if (token !== requestToken) {
          return;
        }

        const rows = Array.isArray(data.rows) ? data.rows : [];
        mergeRows(rows);
        renderPanel(trimmedQuery, filterRows(Array.from(seenPatients.values()), search));
      } catch (error) {
        if (token !== requestToken) {
          return;
        }
      }
    };

    const handleInput = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        resolveSuggestions(input.value);
      }, 120);
    };

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleInput);
    input.addEventListener('keydown', (event) => {
      if (panel.hidden || !visiblePatients.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, visiblePatients.length - 1);
        renderPanel(input.value, visiblePatients);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderPanel(input.value, visiblePatients);
        return;
      }

      if (event.key === 'Enter' && activeIndex >= 0 && visiblePatients[activeIndex]) {
        event.preventDefault();
        const patient = visiblePatients[activeIndex];
        input.value = getInputValue(patient);
        closePanel();
        onPick(patient);
        return;
      }

      if (event.key === 'Escape') {
        closePanel();
      }
    });

    document.addEventListener('mousedown', (event) => {
      if (!wrapper.contains(event.target)) {
        closePanel();
      }
    });

    return {
      destroy() {
        closePanel();
        panel.remove();
      },
      setRows(rows) {
        mergeRows(rows);
      },
    };
  }

  function setupPatientFieldPicker(options = {}) {
    const select = options.select instanceof HTMLSelectElement
      ? options.select
      : document.getElementById(String(options.select || ''));
    const container = options.container instanceof HTMLElement
      ? options.container
      : document.getElementById(String(options.container || ''));
    const placeholder = String(options.placeholder || 'Digite o nome do usuário cadastrado...');
    const locked = options.locked === true;
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    let patients = mergePatientSearchRows(options.rows || []);
    let selectedId = normalizeEntityId(options.currentValue);

    if (!select || !container) {
      return {
        getValue: () => selectedId,
        focus: () => {},
        setRows: () => {},
      };
    }

    container.innerHTML = `
      <input
        type="text"
        autocomplete="off"
        data-search-input="true"
        placeholder="${escapeHtml(placeholder)}"
        aria-label="${escapeHtml(placeholder)}"
      >
    `;

    const input = container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      return {
        getValue: () => selectedId,
        focus: () => {},
        setRows: () => {},
      };
    }

    const syncOptions = () => {
      select.innerHTML = '<option value=""></option>' + patients.map((patient) => `
        <option value="${escapeHtml(patient.id)}" ${patient.id === selectedId ? 'selected' : ''}>
          ${escapeHtml(patient.full_name || patient.id)}
        </option>
      `).join('');
    };

    const getSelectedPatient = () => patients.find((patient) => patient.id === selectedId) || null;

    const setSelectedPatient = (patient) => {
      const normalizedPatient = patient ? normalizePatientSearchRow(patient) : null;
      if (!normalizedPatient || !normalizedPatient.id) {
        selectedId = '';
        input.value = '';
        syncOptions();
        onChange(null);
        return;
      }

      patients = mergePatientSearchRows(patients, [normalizedPatient]);
      selectedId = normalizedPatient.id;
      input.value = normalizedPatient.full_name || '';
      syncOptions();
      onChange(normalizedPatient);
    };

    syncOptions();

    const autocomplete = setupPatientSearchAutocomplete(input, {
      rows: patients,
      minLength: 1,
      onPick: setSelectedPatient,
      getInputValue: (patient) => patient.full_name || '',
      renderMeta: () => '',
      filterRows: (rows, search) => {
        if (!search.hasLetters) {
          return [];
        }

        return (Array.isArray(rows) ? rows : []).filter((row) => (
          matchesPersonNamePrefix(row && row.full_name, search)
        ));
      },
    });

    if (locked) {
      input.readOnly = true;
      input.setAttribute('aria-readonly', 'true');
    }

    const initialPatient = getSelectedPatient();
    if (initialPatient) {
      input.value = initialPatient.full_name || '';
      onChange(initialPatient);
    }

    return {
      getValue: () => selectedId,
      focus: () => input.focus(),
      setRows(nextRows) {
        patients = mergePatientSearchRows(patients, nextRows || []);
        syncOptions();
        autocomplete.setRows(patients);
        const selectedPatient = getSelectedPatient();
        if (selectedPatient) {
          input.value = selectedPatient.full_name || '';
        }
      },
      setValue(patient) {
        setSelectedPatient(patient);
      },
      destroy() {
        autocomplete.destroy();
      },
    };
  }

  function getTeamKey(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return 'sem_equipe';
    }

    return normalizeSearchText(raw).replace(/\s+/g, '_');
  }

  function getTeamTheme(value) {
    const key = getTeamKey(formatTeamName(value));
    if (TEAM_THEMES[key]) {
      return TEAM_THEMES[key];
    }

    const hash = Array.from(key).reduce((total, character) => {
      return total + character.charCodeAt(0);
    }, 0);

    return TEAM_FALLBACK_THEMES[hash % TEAM_FALLBACK_THEMES.length];
  }

  function getTeamStyle(value) {
    const theme = getTeamTheme(value);
    return [
      `--team-color: ${theme.color}`,
      `--team-border: ${theme.border}`,
      `--team-bg: ${theme.bg}`,
      `--team-text: ${theme.text}`,
    ].join('; ');
  }

  function applyTeamTheme(element, value) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const theme = getTeamTheme(value);
    element.style.setProperty('--team-color', theme.color);
    element.style.setProperty('--team-border', theme.border);
    element.style.setProperty('--team-bg', theme.bg);
    element.style.setProperty('--team-text', theme.text);
  }

  function closeOpenPopovers(exceptElement = null) {
    const except = exceptElement instanceof Element ? exceptElement : null;

    document.querySelectorAll('.choice-select.is-open, .team-picker.is-open').forEach((wrapper) => {
      if (except && wrapper === except) {
        return;
      }

      wrapper.classList.remove('is-open');
      wrapper.querySelector('.choice-select-trigger, .team-picker-trigger')?.setAttribute('aria-expanded', 'false');
      const menu = wrapper.querySelector('.choice-select-menu, .team-picker-menu');
      if (menu instanceof HTMLElement) {
        menu.hidden = true;
      }
    });

    if (activeDatePicker && (!except || activeDatePicker.wrapper !== except)) {
      closeDatePicker(activeDatePicker, false);
    }

    hideFieldGuidanceTooltip();
  }

  function setupTeamFieldPicker(options = {}) {
    const select = options.select instanceof HTMLSelectElement
      ? options.select
      : document.getElementById(String(options.select || ''));

    if (!(select instanceof HTMLSelectElement)) {
      return null;
    }

    let container = options.container instanceof HTMLElement
      ? options.container
      : document.getElementById(String(options.container || ''));

    if (!(container instanceof HTMLElement)) {
      container = document.createElement('div');
      select.insertAdjacentElement('afterend', container);
    }

    container.className = [container.className, 'team-picker'].filter(Boolean).join(' ');

    select.classList.add('visually-hidden');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    container.innerHTML = `
      <button type="button" class="team-picker-trigger" aria-haspopup="listbox" aria-expanded="false"></button>
      <div class="team-picker-menu" role="listbox" hidden></div>
    `;

    const trigger = container.querySelector('.team-picker-trigger');
    const menu = container.querySelector('.team-picker-menu');

    if (!(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
      return null;
    }

    const getOptions = () => Array.from(select.options)
      .map((option) => ({
        value: option.value,
        label: option.textContent || formatTeamName(option.value),
      }))
      .filter((option) => option.value !== '');

    const close = () => {
      container.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    };

    const open = () => {
      closeOpenPopovers(container);
      container.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      const selected = menu.querySelector('.team-picker-option.is-selected');
      const first = menu.querySelector('.team-picker-option');
      const target = selected || first;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    };

    const sync = () => {
      const selectedOption = getOptions().find((option) => option.value === select.value) || null;

      if (!select.value || !selectedOption) {
        trigger.disabled = select.disabled;
        trigger.innerHTML = '<span class="team-field-display is-empty">Selecione a equipe...</span>';
        menu.querySelectorAll('.team-picker-option').forEach((button) => {
          button.classList.remove('is-selected');
          button.setAttribute('aria-selected', 'false');
        });
        return;
      }

      const selectedLabel = selectedOption
        ? formatTeamName(selectedOption.label || selectedOption.value)
        : 'Sem equipe';
      const triggerLabel = selectedLabel === 'Sem equipe'
        ? 'Sem equipe'
        : `Equipe: ${selectedLabel}`;

      trigger.disabled = select.disabled;
      applyTeamTheme(trigger, selectedOption ? selectedOption.value : selectedLabel);
      trigger.innerHTML = `<span class="team-badge" style="${escapeHtml(getTeamStyle(selectedLabel))}">${escapeHtml(triggerLabel)}</span>`;

      menu.querySelectorAll('.team-picker-option').forEach((button) => {
        const selected = button.getAttribute('data-team-value') === select.value;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    };

    const render = () => {
      menu.innerHTML = getOptions().map((option) => {
        const label = formatTeamName(option.label || option.value);
        const displayLabel = label === 'Sem equipe' ? label : `Equipe: ${label}`;
        return `
          <button type="button" class="team-picker-option" role="option" data-team-value="${escapeHtml(option.value)}">
            <span class="team-picker-swatch" aria-hidden="true"></span>
            <span class="team-picker-label">${escapeHtml(displayLabel)}</span>
          </button>
        `;
      }).join('');

      menu.querySelectorAll('.team-picker-option').forEach((button) => {
        const value = button.getAttribute('data-team-value') || '';
        applyTeamTheme(button, value);
        button.addEventListener('click', () => {
          select.value = value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
      });

      sync();
    };

    select.addEventListener('change', sync);
    trigger.addEventListener('click', () => {
      if (menu.hidden) {
        open();
      } else {
        close();
      }
    });

    container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
        trigger.focus();
      }
    });

    document.addEventListener('mousedown', (event) => {
      if (!container.contains(event.target)) {
        close();
      }
    });

    render();

    return {
      refresh: render,
      focus() {
        trigger.focus();
      },
    };
  }

  function shouldEnhanceChoiceSelect(select) {
    if (!(select instanceof HTMLSelectElement) || select.multiple || select.dataset.choiceEnhanced === 'true') {
      return false;
    }

    if (document.body && document.body.dataset.page === 'cadh-specialty-form') {
      return false;
    }

    if (
      select.classList.contains('visually-hidden') ||
      select.classList.contains('date-picker-select') ||
      select.classList.contains('status-select-native') ||
      select.classList.contains('clinical-specialty-native-select') ||
      select.classList.contains('patient-native-select') ||
      select.classList.contains('endocrino-native-select-hidden') ||
      select.dataset.nativeSelect === 'true' ||
      select.id === 'team_reference'
    ) {
      return false;
    }

    return true;
  }

  function enhanceChoiceSelect(select) {
    if (!shouldEnhanceChoiceSelect(select)) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'choice-select';
    wrapper.innerHTML = `
      <button type="button" class="choice-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="choice-select-value"></span>
      </button>
      <div class="choice-select-menu" role="listbox" hidden></div>
    `;

    select.dataset.choiceEnhanced = 'true';
    select.classList.add('choice-select-native');
    select.insertAdjacentElement('afterend', wrapper);
    wrapper.prepend(select);

    const trigger = wrapper.querySelector('.choice-select-trigger');
    const valueNode = wrapper.querySelector('.choice-select-value');
    const menu = wrapper.querySelector('.choice-select-menu');

    if (!(trigger instanceof HTMLButtonElement) || !(valueNode instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
      return null;
    }

    const getVisibleOptions = () => Array.from(select.options)
      .filter((option) => !option.hidden && !option.disabled && option.value !== '');

    const getMenuOptions = () => {
      const options = getVisibleOptions();
      if (select.dataset.hideSelectedOption !== 'true' || options.length <= 1) {
        return options;
      }

      return options.filter((option) => option.value !== select.value);
    };

    const getSelectedLabel = () => {
      const selected = select.selectedOptions && select.selectedOptions[0]
        ? select.selectedOptions[0]
        : null;
      return selected ? String(selected.textContent || '').trim() : '';
    };

    const close = () => {
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    };

    const renderValue = () => {
      const label = getSelectedLabel() || 'Selecione...';
      valueNode.textContent = label;
      valueNode.classList.toggle('is-placeholder', !select.value);
    };

    const syncSelected = () => {
      renderValue();
      menu.querySelectorAll('.choice-select-option').forEach((button) => {
        const selected = button.getAttribute('data-choice-value') === select.value;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    };

    const renderMenu = () => {
      menu.innerHTML = getMenuOptions().map((option) => `
        <button type="button" class="choice-select-option" role="option" data-choice-value="${escapeHtml(option.value)}">
          ${escapeHtml(option.textContent || option.value)}
        </button>
      `).join('');

      menu.querySelectorAll('.choice-select-option').forEach((button) => {
        button.addEventListener('click', () => {
          select.value = button.getAttribute('data-choice-value') || '';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          trigger.focus();
        });
      });

      syncSelected();
    };

    const open = () => {
      closeOpenPopovers(wrapper);
      renderMenu();
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      const selected = menu.querySelector('.choice-select-option.is-selected');
      const first = menu.querySelector('.choice-select-option');
      const target = selected || first;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    };

    trigger.addEventListener('click', () => {
      if (menu.hidden) {
        open();
      } else {
        close();
      }
    });

    wrapper.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
        trigger.focus();
      }
    });

    document.addEventListener('mousedown', (event) => {
      if (!wrapper.contains(event.target)) {
        close();
      }
    });

    select.addEventListener('change', syncSelected);

    const observer = new MutationObserver(() => {
      renderValue();
      if (!menu.hidden) {
        renderMenu();
      }
    });
    observer.observe(select, { childList: true, subtree: true, attributes: true });

    renderValue();

    return {
      refresh() {
        renderValue();
        if (!menu.hidden) {
          renderMenu();
        }
      },
      destroy() {
        observer.disconnect();
      },
    };
  }

  function enhanceChoiceSelects(root = document) {
    const scope = root instanceof Document || root instanceof Element ? root : document;
    scope.querySelectorAll('select').forEach((select) => {
      enhanceChoiceSelect(select);
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

  async function loadPatientClinicalContext(patientId) {
    const normalizedId = normalizeEntityId(patientId);
    if (!normalizedId) {
      return null;
    }

    try {
      return await apiRequest('/patients/show.php?id=' + encodeURIComponent(normalizedId));
    } catch (error) {
      return null;
    }
  }

  async function refreshCachedPatientContext(patientId) {
    const normalizedId = normalizeEntityId(patientId);
    if (!normalizedId) {
      return;
    }

    const state = readCadhSearchState();
    if (!state || normalizeEntityId(state.patient && state.patient.id) !== normalizedId) {
      return;
    }

    const context = await loadPatientClinicalContext(normalizedId);
    if (!context || !context.patient) {
      writeCadhSearchState(null);
      return;
    }

    writeCadhSearchState({
      ...state,
      team_ref: String(context.patient.team_ref || state.team_ref || '').trim(),
      patient: {
        id: normalizedId,
        full_name: context.patient.full_name || '',
        cpf: context.patient.cpf || '',
        team_ref: context.patient.team_ref || '',
        birth_date: context.patient.birth_date || '',
        first_cadh_date: context.patient.first_cadh_date || '',
        age_label: context.patient.age_label || '',
        race: context.patient.race || '',
      },
    });
  }

  async function requireSession() {
    try {
      const data = await apiRequest('/auth/me.php');
      return data.user;
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) {
        const cachedUser = getSession();
        if (cachedUser) {
          showAlert('page-alert', 'Não foi possível confirmar a sessão agora, mas você continuará na tela atual.', 'info');
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

  function removeAppThemePreference() {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('siselo_theme');
    } catch (error) {
    }
  }

  removeAppThemePreference();

  function normalizeRoleName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizeDisplayName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function userHasAdminAccess(user, permissions = getUiPermissions(user)) {
    const roles = Array.isArray(user && user.roles)
      ? user.roles.map(normalizeRoleName)
      : [];
    const profileValues = [
      user && user.role,
      user && user.profile,
      user && user.perfil,
      user && user.user_role,
      user && user.access_level,
      user && user.type,
      user && user.user_type,
    ].map(normalizeRoleName);

    return Boolean(
      permissions.has('admin.manage') ||
      roles.some((role) => role === 'admin' || role === 'administrador') ||
      profileValues.some((value) => value === 'admin' || value === 'administrador') ||
      (user && (user.is_admin === true || user.is_admin === 1 || user.admin === true || user.admin === 1))
    );
  }

  function getUserRoleMeta(user, permissions = getUiPermissions(user)) {
    const roles = Array.isArray(user && user.roles)
      ? user.roles.map(normalizeRoleName)
      : [];
    const specialty = String((user && user.specialty) || '').trim();
    const userType = String((user && user.user_type) || '').trim().toUpperCase();
    const name = normalizeDisplayName(user && user.name);

    if (userHasAdminAccess(user, permissions)) {
      return { kind: 'admin', label: 'Administrador', detail: '' };
    }

    if (roles.includes('alimentador')) {
      return { kind: 'editor', label: specialty || 'Alimentador', detail: name || 'Profissional' };
    }

    if (roles.includes('visualizador')) {
      return { kind: 'viewer', label: 'Visualizador', detail: name || '' };
    }

    if (specialty) {
      return { kind: 'clinical', label: specialty, detail: name || '' };
    }

    if (userType) {
      return { kind: userType === 'CADH' ? 'clinical' : 'viewer', label: userType, detail: name || '' };
    }

    if (name) {
      return { kind: 'user', label: name, detail: '' };
    }

    return { kind: 'user', label: 'Usuário' };
  }

  function getUserRoleIcon(kind) {
    const icons = {
      admin: '<path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="M9 12l2 2 4-5"/>',
      editor: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 7.5 3 3"/>',
      clinical: '<path d="M4 14h4l2-7 4 14 2-7h4"/>',
      viewer: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/>',
      user: '<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    };

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        ${icons[kind] || icons.user}
      </svg>
    `;
  }

  function getCurrentDateParts() {
    const now = new Date();
    return {
      iso: [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-'),
      label: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(now),
    };
  }

  function syncCurrentDateElements() {
    const currentDate = getCurrentDateParts();
    document.querySelectorAll('.home-current-date, [data-shell-current-date]').forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (element instanceof HTMLTimeElement) {
        element.dateTime = currentDate.iso;
      } else {
        element.setAttribute('datetime', currentDate.iso);
      }
      element.hidden = false;
      element.removeAttribute('hidden');
      element.textContent = currentDate.label;
    });
  }

  function bindCurrentDateTicker() {
    syncCurrentDateElements();
    if (currentDateTickerBound) {
      return;
    }

    currentDateTickerBound = true;
    window.setInterval(syncCurrentDateElements, 60 * 1000);
  }

  function syncUserRoleStatus(user, permissions) {
    const meta = getUserRoleMeta(user, permissions);
    const title = [meta.detail, meta.label].filter(Boolean).join(' - ') || meta.label;
    document.querySelectorAll('.home-system-status, .home-operational-status').forEach((status) => {
      if (!(status instanceof HTMLElement)) {
        return;
      }

      status.classList.remove(
        'home-operational-status',
        'cadh-operational-status',
        'home-user-role-status',
        'home-user-role-admin',
        'home-user-role-editor',
        'home-user-role-clinical',
        'home-user-role-viewer',
        'home-user-role-user'
      );
      status.classList.add('home-system-status', 'home-user-role-status', `home-user-role-${meta.kind}`);
      status.title = title;
      status.setAttribute('aria-label', title);
      status.innerHTML = `
        <span class="home-system-status-icon" aria-hidden="true">${getUserRoleIcon(meta.kind)}</span>
        <span class="home-system-status-copy">
          ${meta.detail ? `<span class="home-system-status-name">${escapeHtml(meta.detail)}</span>` : ''}
          <span class="home-system-status-role">${escapeHtml(meta.label)}</span>
        </span>
      `;
    });
  }

  function ensureTopbarActions(user, permissions) {
    const topbar = document.querySelector('.topbar');
    if (!topbar) {
      return;
    }

    const isSidebarShell = topbar.classList.contains('home-sidebar');
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

    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      topbar.appendChild(actions);
    }

    const logoutContainer = isSidebarShell ? actions : left;
    let logoutButton = topbar.querySelector('#logout-button');
    if (!logoutButton) {
      logoutButton = document.createElement('a');
      logoutButton.id = 'logout-button';
      logoutButton.className = 'topbar-logout';
      logoutButton.href = '/login.html';
      logoutButton.textContent = 'Sair';
      logoutContainer.insertBefore(logoutButton, logoutContainer.firstChild);
    } else if (logoutButton.parentElement !== logoutContainer && isSidebarShell) {
      logoutContainer.appendChild(logoutButton);
    }

    if (logoutButton.dataset.bound !== 'true') {
      logoutButton.dataset.bound = 'true';
      logoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      });
    }

    let settingsLink = actions.querySelector('#topbar-settings-link');
    if (!settingsLink) {
      settingsLink = document.createElement('a');
      settingsLink.id = 'topbar-settings-link';
      settingsLink.className = 'topbar-icon-btn topbar-settings';
      settingsLink.innerHTML = `
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>Configurações</span>
      `;
      actions.appendChild(settingsLink);
    }

    settingsLink.title = 'Configurações';
    settingsLink.setAttribute('aria-label', 'Configurações');
    settingsLink.hidden = !user;

    let accountLink = actions.querySelector('#topbar-account-link');
    if (!accountLink) {
      accountLink = document.createElement('a');
      accountLink.id = 'topbar-account-link';
      accountLink.className = 'topbar-account';
      actions.appendChild(accountLink);
    }

    const hasAdminAccess = userHasAdminAccess(user, permissions);
    settingsLink.href = hasAdminAccess
      ? '/admin/users/list.html'
      : '/change_password.html';

    accountLink.href = hasAdminAccess
      ? '/admin/users/list.html'
      : '/admin/users/list.html?self=1';
    accountLink.textContent = user && user.name ? user.name : 'Meu perfil';
    accountLink.title = hasAdminAccess ? 'Admin' : 'Meu perfil';
    accountLink.setAttribute('aria-label', hasAdminAccess ? 'Admin' : 'Meu perfil');
    accountLink.hidden = !user;
    syncUserRoleStatus(user, permissions);
  }

  const SIDEBAR_NAV_META = {
    home: {
      label: 'Início',
      description: 'Painel geral',
      icon: '<path d="m4 10 8-6 8 6v10H4V10Z"/><path d="M9 20v-6h6v6"/>',
    },
    cadh: {
      label: 'CADH',
      description: 'Atenção Domiciliar',
      icon: '<path d="M3 13h4l2-7 4 14 2-7h6"/>',
    },
    ubs: {
      label: 'UBS',
      description: 'Atenção primária',
      icon: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    },
  };

  const SHELL_PAGE_META = {
    home: { section: 'Início', title: 'Painel de Controle' },
    cadh: { section: 'CADH', title: 'Centro de Atenção Domiciliar Hospitalar' },
    ubs: { section: 'UBS', title: 'Unidade Básica de Saúde' },
    patients: { section: 'CADH', title: 'Usuários' },
    careplans: { section: 'CADH', title: 'Planos de Cuidado' },
    encounters: { section: 'CADH', title: 'Atendimentos' },
    transitions: { section: 'CADH', title: 'Transições do Cuidado' },
    admin: { section: 'Configurações', title: 'Usuários do Sistema' },
  };

  function sidebarNavMarkup(key) {
    const meta = SIDEBAR_NAV_META[key] || SIDEBAR_NAV_META.home;
    const disclosureChevron = ['ubs', 'cadh'].includes(key)
      ? `
        <svg class="home-sidebar-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7"/>
        </svg>
      `
      : '';
    return `
      <span class="home-sidebar-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">${meta.icon}</svg>
      </span>
      <span class="home-sidebar-nav-copy">
        <strong>${escapeHtml(meta.label)}</strong>
        <small>${escapeHtml(meta.description)}</small>
      </span>
      ${disclosureChevron}
    `;
  }

  function ensureSidebarBrand(topbar) {
    let left = topbar.querySelector('.topbar-left');
    if (!left) {
      left = document.createElement('div');
      left.className = 'topbar-left';
      topbar.prepend(left);
    }

    let brand = topbar.querySelector('.topbar-brand');
    if (!brand) {
      brand = document.createElement('div');
      left.appendChild(brand);
    } else if (brand.parentElement !== left) {
      left.appendChild(brand);
    }

    brand.className = 'topbar-brand home-sidebar-brand';
    brand.innerHTML = `
      <span class="home-sidebar-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="7"/>
          <path d="M5 12h14M12 5c2 2.1 3 4.4 3 7s-1 4.9-3 7M12 5c-2 2.1-3 4.4-3 7s1 4.9 3 7"/>
        </svg>
      </span>
      <span class="home-sidebar-brand-copy">
        <strong>SISELO</strong>
        <small>Sistema de Saúde</small>
      </span>
    `;
  }

  function ensureSidebarNavigation(topbar) {
    let nav = topbar.querySelector('nav.menu');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'menu';
      nav.setAttribute('aria-label', 'Módulos principais');
    }

    let navShell = topbar.querySelector('.home-sidebar-nav');
    if (!navShell) {
      navShell = document.createElement('div');
      navShell.className = 'home-sidebar-nav';
      const left = topbar.querySelector('.topbar-left');
      if (left && left.nextSibling) {
        topbar.insertBefore(navShell, left.nextSibling);
      } else {
        topbar.appendChild(navShell);
      }
    }

    if (!navShell.querySelector('.home-sidebar-label')) {
      const label = document.createElement('p');
      label.className = 'home-sidebar-label';
      label.textContent = 'Módulos';
      navShell.prepend(label);
    }

    if (nav.parentElement !== navShell) {
      navShell.appendChild(nav);
    }

    Object.keys(SIDEBAR_NAV_META).forEach((key) => {
      const link = document.getElementById(`nav-${key}`);
      if (link) {
        link.innerHTML = sidebarNavMarkup(key);
        ensureModuleSubnavigation(link, key);
      }
    });
  }

  function ensureModuleSubnavigation(link, key) {
    if (!link || !['ubs', 'cadh'].includes(key)) {
      return;
    }

    const oldSubnav = link.nextElementSibling;
    if (oldSubnav && oldSubnav.classList.contains('siselo-module-subnav')) {
      oldSubnav.remove();
    }

    const items = key === 'ubs'
      ? [
          { label: 'Dados do Paciente', heading: true },
          { label: 'Lista de usuários', href: '/ubs/index.html?tab=patients' },
          { label: 'Cadastrar usuário', href: '/patients/form.html', ubsCreateOnly: true },
          { label: 'Compartilhamentos UBS/CADH', href: '/ubs/index.html?tab=sharing' },
        ]
      : [
          { label: 'Recebidos UBS', href: '/cadh/index.html?flow=received' },
          { label: 'Acompanhamento', href: '/cadh/index.html?flow=followup' },
          { label: 'Compartilhamentos UBS/CADH', href: '/cadh/index.html?flow=sharing' },
          { label: 'Finalizados', href: '/cadh/index.html?flow=finalized' },
        ];

    const subnav = document.createElement('div');
    const subnavId = `siselo-module-subnav-${key}`;
    subnav.id = subnavId;
    subnav.className = `siselo-module-subnav siselo-module-subnav-${key}`;
    subnav.hidden = true;
    subnav.innerHTML = items.map((item) => {
      if (item.heading) {
        return `<span class="siselo-module-subnav-heading">${escapeHtml(item.label)}</span>`;
      }
      const itemUrl = new URL(item.href, window.location.origin);
      const active = location.pathname === itemUrl.pathname && (
        itemUrl.searchParams.size === 0 ||
        Array.from(itemUrl.searchParams).every(([name, value]) => new URLSearchParams(location.search).get(name) === value) ||
        (item.href.includes('flow=received') && !new URLSearchParams(location.search).has('flow'))
      );
      return `<a href="${item.href}"${item.ubsCreateOnly ? ' data-ubs-create-link' : ''} class="${active ? 'active' : ''}"><span aria-hidden="true">＋</span>${escapeHtml(item.label)}</a>`;
    }).join('');
    link.insertAdjacentElement('afterend', subnav);

    link.classList.add('siselo-module-toggle');
    link.setAttribute('aria-controls', subnavId);
    link.setAttribute('aria-expanded', 'false');

    if (link.dataset.moduleToggleBound !== 'true') {
      link.dataset.moduleToggleBound = 'true';
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        const controlledSubnav = document.getElementById(link.getAttribute('aria-controls') || '');
        if (!(controlledSubnav instanceof HTMLElement)) {
          return;
        }

        const willExpand = link.getAttribute('aria-expanded') !== 'true';
        document.querySelectorAll('.siselo-module-toggle[aria-expanded="true"]').forEach((toggle) => {
          if (toggle === link) {
            return;
          }
          toggle.setAttribute('aria-expanded', 'false');
          const otherSubnav = document.getElementById(toggle.getAttribute('aria-controls') || '');
          if (otherSubnav instanceof HTMLElement) {
            otherSubnav.hidden = true;
          }
        });

        link.setAttribute('aria-expanded', String(willExpand));
        controlledSubnav.hidden = !willExpand;
        if (willExpand) {
          const linkRect = link.getBoundingClientRect();
          controlledSubnav.style.setProperty('--siselo-subnav-mobile-top', `${Math.round(linkRect.bottom + 6)}px`);
        }
      });
    }
  }

  function ensureSidebarActionsContainer(topbar) {
    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      topbar.appendChild(actions);
    }
    actions.classList.add('topbar-actions', 'home-sidebar-footer');
    return actions;
  }

  function getShellPageMeta(activeKey) {
    const page = document.body ? document.body.dataset.page || '' : '';
    if (page.startsWith('admin-')) {
      return SHELL_PAGE_META.admin;
    }
    return SHELL_PAGE_META[activeKey] || { section: 'SISELO', title: 'Sistema de Saúde' };
  }

  function cleanShellTitle(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+\|\s+SISELO$/i, '')
      .trim();
  }

  function getCurrentPageTitle(activeKey) {
    const selectors = [
      '#form-title',
      '.page-heading .page-title',
      '.patient360-name',
      '.page-title',
      'h1',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = cleanShellTitle(element && element.textContent);
      if (text) {
        return text;
      }
    }

    const documentTitle = cleanShellTitle(document.title);
    if (documentTitle) {
      return documentTitle.split('|')[0].trim();
    }

    return getShellPageMeta(activeKey).title;
  }

  function createUnifiedPageHeader(activeKey) {
    const meta = getShellPageMeta(activeKey);
    const header = document.createElement('header');
    header.className = 'home-page-header siselo-page-header';
    header.innerHTML = `
      <div class="siselo-page-heading">
        <span data-shell-section>${escapeHtml(meta.section)}</span>
        <strong data-shell-title>${escapeHtml(getCurrentPageTitle(activeKey) || meta.title)}</strong>
      </div>
      <div class="home-page-status">
        <span class="home-system-status home-user-role-status home-user-role-user">
          <span class="home-system-status-icon" aria-hidden="true">${getUserRoleIcon('user')}</span>
          <span>Usuário</span>
        </span>
        <time class="home-current-date" data-shell-current-date></time>
      </div>
    `;
    return header;
  }

  function setupUnifiedHeaderDate(header) {
    const dateElement = header && header.querySelector('[data-shell-current-date]');
    if (!(dateElement instanceof HTMLTimeElement)) {
      return;
    }

    bindCurrentDateTicker();
  }

  function bindUnifiedHeaderTitleSync(header, activeKey) {
    const titleElement = header && header.querySelector('[data-shell-title]');
    if (!(titleElement instanceof HTMLElement)) {
      return;
    }

    const syncTitle = () => {
      titleElement.textContent = getCurrentPageTitle(activeKey) || getShellPageMeta(activeKey).title;
    };

    syncTitle();
    document.querySelectorAll('#form-title, .page-title, .patient360-name, h1').forEach((source) => {
      if (!(source instanceof HTMLElement) || source.dataset.shellTitleObserved === 'true') {
        return;
      }
      source.dataset.shellTitleObserved = 'true';
      new MutationObserver(syncTitle).observe(source, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  }

  function ensureUnifiedSidebarToggle(topbar) {
    let toggle = topbar.querySelector('[data-unified-sidebar-toggle]');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'siselo-sidebar-toggle';
      toggle.className = 'home-sidebar-toggle siselo-sidebar-toggle';
      toggle.type = 'button';
      toggle.dataset.unifiedSidebarToggle = 'true';
      toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
      topbar.appendChild(toggle);
    }
    return toggle;
  }

  function ensureUnifiedSidebarShell(activeKey) {
    const topbar = document.querySelector('.topbar');
    const main = document.querySelector('main.container, body > main');
    if (!topbar) {
      return;
    }

    document.body.classList.add('siselo-sidebar-shell');
    if (topbar.classList.contains('home-sidebar')) {
      ensureSidebarBrand(topbar);
      ensureSidebarNavigation(topbar);
      ensureSidebarActionsContainer(topbar);
      return;
    }

    if (!main || main.closest('.siselo-main-shell')) {
      return;
    }

    document.body.classList.add('siselo-auto-shell');
    topbar.classList.add('home-sidebar', 'siselo-sidebar');
    ensureSidebarBrand(topbar);
    ensureSidebarNavigation(topbar);
    ensureSidebarActionsContainer(topbar);
    ensureUnifiedSidebarToggle(topbar);

    const shell = document.createElement('div');
    shell.className = 'siselo-app-shell';
    const mainShell = document.createElement('div');
    mainShell.className = 'siselo-main-shell';
    const pageHeader = createUnifiedPageHeader(activeKey);

    topbar.parentNode.insertBefore(shell, topbar);
    shell.appendChild(topbar);
    shell.appendChild(mainShell);
    mainShell.appendChild(pageHeader);
    mainShell.appendChild(main);
    setupUnifiedHeaderDate(pageHeader);
    bindUnifiedHeaderTitleSync(pageHeader, activeKey);
  }

  function syncUnifiedSidebarFooter(user) {
    if (!document.body.classList.contains('siselo-sidebar-shell')) {
      return;
    }

    const topbar = document.querySelector('.home-sidebar');
    const actions = topbar && topbar.querySelector('.topbar-actions');
    if (!(actions instanceof HTMLElement)) {
      return;
    }

    actions.classList.add('home-sidebar-footer');
    const settingsLink = actions.querySelector('#topbar-settings-link');
    const accountLink = actions.querySelector('#topbar-account-link');
    const logoutButton = actions.querySelector('#logout-button');

    [settingsLink, accountLink, logoutButton].forEach((item) => {
      if (item) {
        actions.appendChild(item);
      }
    });

    if (logoutButton) {
      logoutButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg><span>Sair</span>';
    }

    if (accountLink) {
      accountLink.textContent = '';
      accountLink.innerHTML = `
        <span class="home-sidebar-user-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>
        </span>
        <span class="home-sidebar-user-copy">
          <strong>${escapeHtml(user && user.name ? user.name : 'Meu perfil')}</strong>
          <small>${escapeHtml(user && user.email ? user.email : 'Acessar perfil')}</small>
        </span>
      `;
    }
  }

  function bindUnifiedSidebarToggle() {
    if (!document.body.classList.contains('siselo-auto-shell')) {
      return;
    }

    const toggle = document.querySelector('[data-unified-sidebar-toggle]');
    if (!(toggle instanceof HTMLButtonElement) || toggle.dataset.bound === 'true') {
      return;
    }

    const collapsedKey = 'siselo_home_sidebar_collapsed';
    const setSidebarCollapsed = (collapsed) => {
      document.body.classList.toggle('home-sidebar-is-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral');
    };

    let collapsed = false;
    try {
      collapsed = localStorage.getItem(collapsedKey) === 'true';
    } catch (error) {
    }
    setSidebarCollapsed(collapsed);

    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => {
      collapsed = !document.body.classList.contains('home-sidebar-is-collapsed');
      setSidebarCollapsed(collapsed);
      try {
        localStorage.setItem(collapsedKey, String(collapsed));
      } catch (error) {
      }
    });
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
      ubs: '/ubs/index.html',
    };

    ensureUnifiedSidebarShell(activeKey);
    const canCreateUbsPatient = String(user && user.user_type || '').toUpperCase() === 'UBS' ||
      permissions.has('admin.manage');
    document.querySelectorAll('[data-ubs-create-link]').forEach((link) => {
      link.hidden = !canCreateUbsPatient;
    });

    Object.keys(links).forEach((key) => {
      const link = document.getElementById(`nav-${key}`);
      if (link) {
        link.href = links[key];
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
        if (key === activeNavKey) {
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'page');
        }
      }
    });

    setText('current-user-name', user ? user.name : '');
    ensureTopbarActions(user, permissions);
    bindCurrentDateTicker();
    syncUnifiedSidebarFooter(user);
    bindUnifiedSidebarToggle();

    bindBackLinks();
    decorateSearchInputs(document);
    enhanceChoiceSelects(document);
    enhanceResponsiveTables(document);
    bindFieldGuidanceTooltips();
    renderFlashAlert('page-alert');
    applyUiComponents(document);
    bindUiComponentObserver();
  }

  function queryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function getUiPermissions(user) {
    return new Set(user && Array.isArray(user.permissions) ? user.permissions : []);
  }

  function buildPatientModuleEmptyState(moduleKey, options = {}) {
    const meta = getClinicalModuleMeta(moduleKey);
    const patientKnown = options.patientKnown === true;
    const canCreate = options.canCreate === true;
    const actionHref = String(options.actionHref || '').trim();

    if (!patientKnown) {
      return {
        title: `Nenhum ${meta.singular} encontrado.`,
        description: '',
        action: canCreate && actionHref ? { label: options.actionLabel || 'Novo registro', href: actionHref } : null,
      };
    }

    return {
      title: meta.emptyTitle,
      description: meta.emptyDescription,
      action: canCreate && actionHref ? { label: options.actionLabel || 'Novo registro', href: actionHref } : null,
    };
  }

  function normalizeEntityId(value) {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) && numericValue > 0 ? String(numericValue) : '';
  }

  function formatTeamName(value) {
    const raw = String(value || '').replace(/^equipe\s*:\s*/i, '').trim();
    if (!raw) {
      return 'Sem equipe';
    }

    const key = normalizeSearchText(raw);
    return TEAM_LABELS[key] || TEAM_LABELS[key.replace(/\s+/g, '_')] || raw;
  }

  function renderTeamBadge(value) {
    const label = formatTeamName(value);
    const displayLabel = label === 'Sem equipe' ? label : `Equipe: ${label}`;
    const key = normalizeSearchText(label);
    const theme = getTeamTheme(label);
    const className = theme.className || (
      key === 'sem equipe' || key === 'sem_equipe'
        ? 'team-badge-sem-equipe'
        : ['safira', 'ametista', 'esmeralda', 'diamante'].includes(key)
          ? `team-badge-${key}`
          : ''
    );

    return `<span class="team-badge${className ? ` ${className}` : ''}" style="${escapeHtml(getTeamStyle(label))}">${escapeHtml(displayLabel)}</span>`;
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
    showToast(message || 'Nenhum registro carregado para esta ação.', 'info');
  }

  function showActionError(message) {
    showToast(message || 'Não foi possível concluir esta ação agora.', 'error');
  }

  function ensureConfirmationModal() {
    let overlay = document.getElementById('siselo-confirmation-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'siselo-confirmation-modal';
      overlay.className = 'confirmation-modal-overlay ui-dialog-overlay';
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="confirmation-modal ui-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title" aria-describedby="confirmation-modal-message confirmation-modal-description" tabindex="-1">
          <div class="confirmation-modal-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 2 2 20h20L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/>
            </svg>
          </div>
          <div class="confirmation-modal-copy">
            <h2 id="confirmation-modal-title">Confirmar ação</h2>
            <p id="confirmation-modal-message"></p>
            <p id="confirmation-modal-description"></p>
          </div>
          <div class="confirmation-modal-actions">
            <button type="button" class="btn ui-button ui-button-outline confirmation-modal-cancel" data-confirm-cancel>Cancelar</button>
            <button type="button" class="btn btn-danger ui-button ui-button-destructive confirmation-modal-confirm" data-confirm-ok>Inativar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      applyUiComponents(overlay);
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

    modal.title.textContent = options.title || 'Confirmar ação';
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
      title: 'Mover registro para aba de inativos',
      message: `Deseja realmente inativar ${target}?`,
      description: 'O registro poderá ser restaurado posteriormente, se necessário.',
      confirmLabel: 'Inativar',
      cancelLabel: 'Cancelar',
    });
  }

  function confirmPermanentDeletion(entityName, itemLabel) {
    const normalizedEntityName = String(entityName || 'registro').trim();
    const normalizedLabel = String(itemLabel || '').trim();
    const target = normalizedLabel
      ? `${normalizedEntityName} "${normalizedLabel}"`
      : `este ${normalizedEntityName}`;

    return showConfirmationDialog({
      title: 'Apagar permanentemente',
      message: `Deseja realmente apagar ${target}?`,
      description: 'Se apagar, o registro será removido para sempre e não poderá ser restaurado depois.',
      confirmLabel: 'Apagar para sempre',
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
    element.className = `alert alert-${type || 'info'} ui-alert ui-alert-${type || 'info'}`;
    element.dataset.uiComponent = 'alert';
  }

  function setFlashAlert(message, type = 'success') {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      sessionStorage.removeItem(FLASH_ALERT_KEY);
      return;
    }

    sessionStorage.setItem(FLASH_ALERT_KEY, JSON.stringify({
      message: normalizedMessage,
      type: String(type || 'success').trim() || 'success',
    }));
  }

  function renderFlashAlert(id = 'page-alert') {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    let flash = null;
    try {
      flash = JSON.parse(sessionStorage.getItem(FLASH_ALERT_KEY) || 'null');
    } catch (error) {
      flash = null;
    }

    sessionStorage.removeItem(FLASH_ALERT_KEY);

    if (!flash || !flash.message) {
      return;
    }

    showAlert(id, flash.message, flash.type || 'success');
    window.setTimeout(() => {
      if (element.textContent === flash.message) {
        showAlert(id, '', 'info');
      }
    }, 2600);
  }

  const DATE_PICKER_MONTH_NAMES = Array.from({ length: 12 }, (_, index) => (
    new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(new Date().getFullYear(), index, 1))
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
    const defaultYearsAgo = Number(input.dataset.dateDefaultYearsAgo || '');

    if (!currentValue && Number.isFinite(defaultYearsAgo) && defaultYearsAgo > 0 && today) {
      const referenceDate = createDateAtNoon(
        today.getFullYear() - defaultYearsAgo,
        today.getMonth(),
        today.getDate()
      );

      return clampDateObject(
        referenceDate || today || bounds.max || bounds.min,
        bounds.min,
        bounds.max
      ) || referenceDate || today || bounds.min || bounds.max || createDateAtNoon(new Date().getFullYear(), 0, 1);
    }

    return clampDateObject(
      currentValue || today || bounds.max || bounds.min,
      bounds.min,
      bounds.max
    ) || today || bounds.min || bounds.max || createDateAtNoon(new Date().getFullYear(), 0, 1);
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
        positionDatePickerPopover(activeDatePicker);
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

  function positionDatePickerPopover(instance) {
    if (!instance || !instance.popover || !instance.wrapper) {
      return;
    }

    const viewportPadding = 12;
    const triggerRect = instance.trigger.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - (viewportPadding * 2));
    const left = Math.max(
      viewportPadding,
      Math.min(triggerRect.left, window.innerWidth - viewportPadding - width)
    );
    const belowTop = triggerRect.bottom + 10;
    const aboveTop = triggerRect.top - instance.popover.offsetHeight - 10;
    const availableBelow = window.innerHeight - belowTop - viewportPadding;
    const shouldOpenAbove =
      instance.popover.offsetHeight > availableBelow && aboveTop >= viewportPadding;
    const top = shouldOpenAbove ? aboveTop : belowTop;

    instance.popover.style.position = 'fixed';
    instance.popover.style.width = `${width}px`;
    instance.popover.style.minWidth = `${Math.min(326, width)}px`;
    instance.popover.style.left = `${left}px`;
    instance.popover.style.right = 'auto';
    instance.popover.style.top = `${Math.max(viewportPadding, top)}px`;
    instance.popover.style.bottom = 'auto';
  }

  function openDatePicker(instance) {
    if (!instance) {
      return;
    }

    closeOpenPopovers(instance.wrapper);

    if (activeDatePicker && activeDatePicker !== instance) {
      closeDatePicker(activeDatePicker, false);
    }

    activeDatePicker = instance;

    if (!parseDateInputValue(instance.input.value)) {
      instance.state.viewDate = startOfCalendarMonth(getDatePickerDefaultViewDate(instance.input));
    }

    renderDatePicker(instance);
    instance.popover.hidden = false;
    positionDatePickerPopover(instance);
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

    const currentYear = instance.state.viewDate.getFullYear();
    const currentMonth = instance.state.viewDate.getMonth();
    const currentSystemYear = today.getFullYear();
    const minYearLimit = bounds.min ? bounds.min.getFullYear() : currentSystemYear - 130;
    const maxYearLimit = bounds.max ? bounds.max.getFullYear() : currentSystemYear + 100;
    const minYear = minYearLimit;
    const maxYear = maxYearLimit;

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

    if (options.defaultViewYearsAgo !== undefined) {
      input.dataset.dateDefaultYearsAgo = String(options.defaultViewYearsAgo || '');
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

  const FIELD_GUIDANCE_TOOLTIP_ID = 'siselo-field-guidance-tooltip';

  function bindFieldGuidanceTooltips(options = {}) {
    const selector = options.selector || '[class*="-field-guidance"]';
    const anchors = new Set();

    document.querySelectorAll(selector).forEach((guidance) => {
      if (!(guidance instanceof HTMLElement) || guidance.hidden) {
        return;
      }

      const anchor = guidance.closest('.field, .field-full, .form-field');
      if (!(anchor instanceof HTMLElement) || anchors.has(anchor) || anchor.dataset.siseloGuidanceBound === 'true') {
        return;
      }

      if (anchor.querySelector('textarea')) {
        return;
      }

      const text = String(guidance.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return;
      }

      anchors.add(anchor);
      anchor.dataset.siseloGuidanceBound = 'true';
      anchor.dataset.siseloGuidanceText = text;

      const show = () => showFieldGuidanceTooltip(anchor, text);
      const hide = () => hideFieldGuidanceTooltip();

      anchor.addEventListener('mouseenter', show);
      anchor.addEventListener('focusin', show);
      anchor.addEventListener('mouseleave', hide);
      anchor.addEventListener('focusout', hide);
    });

    if (document.body.dataset.siseloGuidanceGlobalBound !== 'true') {
      document.body.dataset.siseloGuidanceGlobalBound = 'true';
      window.addEventListener('resize', hideFieldGuidanceTooltip);
      window.addEventListener('scroll', hideFieldGuidanceTooltip, true);
    }
  }

  function getFieldGuidanceTooltip() {
    let tooltip = document.getElementById(FIELD_GUIDANCE_TOOLTIP_ID);
    if (!(tooltip instanceof HTMLElement)) {
      tooltip = document.createElement('div');
      tooltip.id = FIELD_GUIDANCE_TOOLTIP_ID;
      tooltip.className = 'clinical-floating-tip';
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }

    return tooltip;
  }

  function showFieldGuidanceTooltip(anchor, message) {
    if (!(anchor instanceof HTMLElement)) {
      hideFieldGuidanceTooltip();
      return;
    }

    const text = String(message || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      hideFieldGuidanceTooltip();
      return;
    }

    const tooltip = getFieldGuidanceTooltip();
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionFieldGuidanceTooltip(anchor, tooltip);
  }

  function hideFieldGuidanceTooltip() {
    const tooltip = document.getElementById(FIELD_GUIDANCE_TOOLTIP_ID);
    if (tooltip instanceof HTMLElement) {
      tooltip.hidden = true;
      tooltip.textContent = '';
    }
  }

  function positionFieldGuidanceTooltip(anchor, tooltip) {
    const viewportPadding = 12;
    const gap = 10;
    const anchorRect = anchor.getBoundingClientRect();

    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipHeight - viewportPadding);
    let left = anchorRect.left;
    let top = anchorRect.top - tooltipHeight - gap;

    if (top < viewportPadding) {
      top = anchorRect.bottom + gap;
    }

    tooltip.style.left = `${Math.max(viewportPadding, Math.min(left, maxLeft))}px`;
    tooltip.style.top = `${Math.max(viewportPadding, Math.min(top, maxTop))}px`;
  }

  const ACTION_ICON_PATHS = {
    search: 'M10.5 4a6.5 6.5 0 1 0 4.3 11.4l4 4 1.4-1.4-4-4A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z',
    view: 'M12 5c5.1 0 8.8 4.2 10 7-1.2 2.8-4.9 7-10 7S3.2 14.8 2 12c1.2-2.8 4.9-7 10-7Zm0 2C8.4 7 5.6 9.6 4.3 12 5.6 14.4 8.4 17 12 17s6.4-2.6 7.7-5C18.4 9.6 15.6 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z',
    edit: 'M4 17.3V20h2.7L18.9 7.8l-2.7-2.7L4 17.3ZM20.7 6a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1 1 2.7 2.7 1-1Z',
    delete: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 17.31C15.55 18.37 13.85 19 12 20Zm6.31-4.71L7.09 4.69C8.45 3.63 10.15 3 12 3c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9Z',
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

  function confirmPermanentDeletion(entityName, itemLabel) {
    const normalizedEntityName = String(entityName || 'registro').trim();
    const normalizedLabel = String(itemLabel || '').trim();
    const target = normalizedLabel
      ? `${normalizedEntityName} "${normalizedLabel}"`
      : `este ${normalizedEntityName}`;

    return showConfirmationDialog({
      title: 'Excluir permanentemente',
      message: `Deseja excluir ${target}?`,
      description: 'Esta ação não poderá ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
    });
  }

  function confirmPermanentDeletionSafe(entityName, itemLabel) {
    const normalizedEntityName = String(entityName || 'registro').trim();
    const normalizedLabel = String(itemLabel || '').trim();
    const target = normalizedLabel
      ? `${normalizedEntityName} "${normalizedLabel}"`
      : `este ${normalizedEntityName}`;

    return showConfirmationDialog({
      title: 'Excluir permanentemente',
      message: `Deseja excluir ${target}?`,
      description: 'Esta a\u00E7\u00E3o n\u00E3o poder\u00E1 ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
    });
  }

  SiseloUI.confirm = showConfirmationDialog;

  window.SISELO = {
    apiRequest,
    bindShell,
    applyUiComponents,
    clampDateInputValue,
    confirmDeletion,
    confirmPermanentDeletion: confirmPermanentDeletionSafe,
    clearSession,
    createSearchState,
    decorateSearchInputs,
    digitsOnly,
    enhanceDateInput,
    enhanceChoiceSelects,
    enhanceResponsiveTables,
    escapeHtml,
    filterPatientsForSearch,
    formatTeamName,
    formatDateInputValue,
    getApiBaseUrl,
    getSession,
    highlightSearchDigits,
    highlightPersonName,
    iconButton,
    iconLink,
    emptyTableRow,
    matchesPersonNamePrefix,
    matchesSearchDigits,
    matchesSearchText,
    normalizeSearchText,
    loadPatientClinicalContext,
    parseDateInputValue,
    queryParam,
    refreshCachedPatientContext,
    requireSession,
    resolveDateInputValue,
    resolveBackTarget,
    renderTeamBadge,
    saveSessionPayload,
    setFlashAlert,
    setText,
    shiftDateInputValue,
    showToast,
    syncCurrentDate: syncCurrentDateElements,
    syncEnhancedDateInput,
    syncSearchUrl,
    showActionError,
    showUnavailableAction,
    showAlert,
    ui: SiseloUI,
    bindFieldGuidanceTooltips,
    setupPatientFieldPicker,
    setupPatientSearchAutocomplete,
    setupTeamFieldPicker,
    todayDateInputValue,
    buildPatientModuleEmptyState,
    getUiPermissions,
    filterPatientsById,
    filterRowsByPatientId,
    normalizeEntityId,
    validateEnhancedDateInputs,
  };
})();
