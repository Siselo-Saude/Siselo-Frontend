(() => {
  const CADH_SEARCH_KEY = "siselo_cadh_search";
  const INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";

  const configs = {
    "cadh-tecnico": specialty("tecnico", "Técnico de Enfermagem", "siselo_cadh_tecnico_records", "#0891b2", "#tecnico-form"),
    "cadh-gestor": {
      slug: "gestor",
      title: "Gestor do Cuidado",
      storageKey: "siselo_cadh_gestor_records",
      accent: "#0b5c8e",
      sections: [
        section("Estratificação de risco", [
          field("risk_correct", "Estratificação de risco correta?", "select", {
            options: ["Usuário corretamente estratificado", "Necessita reclassificação"],
          }),
          field("health_condition", "Condição de saúde", "text", { placeholder: "Ex: DM Tipo 2, HAS, LADA" }),
          field("risk_classification", "Estratificação de risco (conforme NT)", "select", {
            options: ["Alto risco", "Muito Alto risco", "Risco moderado"],
          }),
          field("other_conditions", "Outras condições de saúde", "text"),
        ]),
        section("Encaminhamentos para especialistas", [
          field("needs_oftalmo", "Necessário avaliação da oftalmologia?", "select", { options: ["Não", "Sim"] }),
          field("oftalmo_schedule_date", "Data de regulação/agendamento (oftalmo)", "date"),
          field("oftalmo_execution_date", "Data da execução (oftalmo)", "date"),
          field("needs_angio", "Necessário avaliação da angiologia?", "select", { options: ["Não", "Sim"] }),
          field("angio_schedule_date", "Data de regulação/agendamento (angio)", "date"),
          field("angio_execution_date", "Data da execução (angio)", "date"),
          field("needs_nefro", "Necessário avaliação da nefrologia?", "select", { options: ["Não", "Sim"] }),
          field("nefro_schedule_date", "Data de regulação/agendamento (nefro)", "date"),
          field("nefro_execution_date", "Data da execução (nefro)", "date"),
          field("needs_neuro", "Necessário avaliação da neurologia?", "select", { options: ["Não", "Sim"] }),
          field("needs_stress_test", "Necessário regulação para teste ergométrico?", "select", { options: ["Não", "Sim"] }),
          field("needs_mapa_holter", "Necessário regulação para MAPA/Holter?", "select", { options: ["Não", "Sim"] }),
          field("needs_echo", "Necessário regulação para ecocardiograma?", "select", { options: ["Não", "Sim"] }),
        ]),
      ],
    },
    "cadh-psicologia": specialty("psicologia", "Psicólogo", "siselo_cadh_psicologia_records", "#a855f7", "#psicologia-form"),
    "cadh-enfermagem": specialty("enfermagem", "Enfermeiro", "siselo_cadh_enfermagem_records", "#0f9f8f", "#enfermagem-form", {
      keepInitialOnFollowup: true,
    }),
    "cadh-endocrino": specialty("endocrino", "Endocrinologia", "siselo_cadh_endocrino_records", "#f97316", "#endocrino-form"),
    "cadh-cardiologia": specialty("cardiologia", "Cardiologia", "siselo_cadh_cardiologia_records", "#ef4444", "#cardiologia-form"),
    "cadh-nutricao": specialty("nutricao", "Nutrição", "siselo_cadh_nutricao_records", "#22c55e", "#nutricao-form"),
    "cadh-oftalmologia": specialty("oftalmo", "Oftalmologia", "siselo_cadh_oftalmo_records", "#6366f1", "#oftalmo-form"),
    "cadh-fisioterapia": specialty("fisioterapia", "Fisioterapia", "siselo_cadh_fisioterapia_records", "#3b82f6", "#fisioterapia-form"),
    "cadh-farmacia": specialty("farmacia", "Farmácia Clínica", "siselo_cadh_farmacia_records", "#eab308", "#farmacia-form"),
    "cadh-servico-social": specialty("social", "Serviço Social", "siselo_cadh_social_records", "#ec4899", "#social-form"),
  };

  document.addEventListener("DOMContentLoaded", () => {
    const originalPage = document.body.dataset.page || "";
    const baseConfig = configs[originalPage];
    if (!baseConfig) return;

    const extractedConfig = extractLegacyFormConfig(baseConfig);
    const config = {
      ...baseConfig,
      ...extractedConfig,
      sections: extractedConfig && extractedConfig.sections.length ? extractedConfig.sections : baseConfig.sections,
    };

    document.body.dataset.legacyPage = originalPage;
    document.body.dataset.page = "cadh-specialty-form";
    setupSpecialtyPage(config).catch((error) => {
      console.error(error);
      document.body.innerHTML = `<main class="clinical-specialty-fatal">Não foi possível carregar a tela da especialidade.</main>`;
    });
  });

  function specialty(slug, title, storageKey, accent, formSelector, options = {}) {
    return { slug, title, storageKey, accent, formSelector, sections: [], ...options };
  }

  function section(title, fields, options = {}) {
    return { title, fields, ...options };
  }

  function field(name, label, type, options = {}) {
    return { name, label, type, ...options };
  }

  function extractLegacyFormConfig(config) {
    const form = config.formSelector ? document.querySelector(config.formSelector) : null;
    if (!(form instanceof HTMLFormElement)) return null;

    const sections = Array.from(form.querySelectorAll("section"))
      .map((sectionElement, index) => extractLegacySection(sectionElement, index))
      .filter(Boolean);

    return {
      legacyFormId: form.id || "",
      submitLabel: getLegacySubmitLabel(form) || "Salvar Atendimento",
      sections,
    };
  }

  function extractLegacySection(sectionElement, index) {
    const fields = Array.from(sectionElement.querySelectorAll(".field, .field-full"))
      .map(extractLegacyField)
      .filter(Boolean);

    if (!fields.length) return null;

    const titleElement = sectionElement.querySelector("h3");
    const title = cleanText(titleElement ? titleElement.textContent : "") || (index === 0 ? "Consulta" : "Dados do atendimento");

    return section(title, fields, {
      condition: getSectionCondition(sectionElement),
      legacyId: sectionElement.id || "",
    });
  }

  function extractLegacyField(container) {
    const control = findLegacyControl(container);
    if (!control) return null;

    const name = String(control.getAttribute("name") || "").trim();
    if (!name || ["patient_id", "record_id"].includes(name)) return null;

    const labelElement = container.querySelector("label");
    const label = cleanText(labelElement ? labelElement.textContent : "");
    if (!label) return null;

    const common = {
      id: control.id || `clinical_${name}`,
      name,
      label,
      full: container.classList.contains("field-full") || control instanceof HTMLTextAreaElement,
      placeholder: control.getAttribute("placeholder") || "",
      required: control.required || /\*/.test(label),
      inputmode: control.getAttribute("inputmode") || "",
      autocomplete: control.getAttribute("autocomplete") || "",
      legacyContainerId: container.id || "",
    };

    if (control instanceof HTMLSelectElement) {
      return field(name, label, "select", {
        ...common,
        options: Array.from(control.options).map((option) => ({
          value: option.value,
          label: cleanText(option.textContent),
          hidden: option.hidden,
          disabled: option.disabled,
        })),
      });
    }

    if (control instanceof HTMLTextAreaElement) {
      return field(name, label, "textarea", {
        ...common,
        rows: Number(control.getAttribute("rows")) || 4,
      });
    }

    if (control instanceof HTMLInputElement && control.type === "hidden") {
      return field(name, label, "calculated", {
        ...common,
        displayId: `${control.id || name}_display`,
      });
    }

    return field(name, label, control.type === "date" ? "date" : "text", common);
  }

  function findLegacyControl(container) {
    const controls = Array.from(container.querySelectorAll("input[name], select[name], textarea[name]"));
    const visibleControl = controls.find((control) => {
      const name = String(control.getAttribute("name") || "").trim();
      if (!name || ["patient_id", "record_id"].includes(name)) return false;
      if (control instanceof HTMLInputElement && control.type === "hidden") return false;
      return true;
    });

    if (visibleControl) return visibleControl;

    return controls.find((control) => (
      control instanceof HTMLInputElement &&
      control.type === "hidden" &&
      control.name === "imc"
    )) || null;
  }

  function getSectionCondition(sectionElement) {
    const id = String(sectionElement.id || "").toLowerCase();
    if (id.includes("subsequent")) return "subsequent";
    if (id.includes("initial")) return "initial";
    return "";
  }

  function getLegacySubmitLabel(form) {
    const submitButton = form.querySelector('button[type="submit"], .btn-primary');
    return cleanText(submitButton ? submitButton.textContent : "");
  }

  async function setupSpecialtyPage(config) {
    const user = await SISELO.requireSession();
    if (!user) return;

    document.title = `${config.title} | SISELO`;
    renderShell(config);
    SISELO.bindShell("cadh");
    setupHeaderDate();
    setupSidebar(user);

    const patient = await loadContextPatient();
    renderSpecialtyContent(config, patient);
    bindSpecialtyForm(config, patient);
  }

  function renderShell(config) {
    document.body.innerHTML = `
      <div class="clinical-specialty-shell">
        <aside class="topbar home-sidebar cadh-sidebar clinical-specialty-sidebar" aria-label="Navegação do SISELO">
          <div class="topbar-left">
            <div class="topbar-brand home-sidebar-brand">
              <span class="home-sidebar-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="7"/><path d="M5 12h14M12 5c2 2.1 3 4.4 3 7s-1 4.9-3 7M12 5c-2 2.1-3 4.4-3 7s1 4.9 3 7"/></svg>
              </span>
              <span class="home-sidebar-brand-copy">
                <strong>SISELO</strong>
                <small>Sistema de Saúde</small>
              </span>
            </div>
          </div>

          <div class="home-sidebar-nav">
            <p class="home-sidebar-label">Módulos</p>
            <nav class="menu" aria-label="Módulos principais">
              <a id="nav-home" href="/index.html">
                <span class="home-sidebar-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 10 8-6 8 6v10H4V10Z"/><path d="M9 20v-6h6v6"/></svg></span>
                <span class="home-sidebar-nav-copy"><strong>Início</strong><small>Painel geral</small></span>
                <svg class="home-sidebar-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
              </a>
              <a id="nav-cadh" href="/cadh/index.html">
                <span class="home-sidebar-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 13h4l2-7 4 14 2-7h6"/></svg></span>
                <span class="home-sidebar-nav-copy"><strong>CADH</strong><small>Atenção Domiciliar</small></span>
                <svg class="home-sidebar-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
              </a>
              <a id="nav-ubs" href="/ubs/index.html">
                <span class="home-sidebar-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg></span>
                <span class="home-sidebar-nav-copy"><strong>UBS</strong><small>Atenção Primária</small></span>
                <svg class="home-sidebar-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
              </a>
            </nav>
          </div>

          <div class="topbar-actions home-sidebar-footer"></div>
          <button id="clinical-sidebar-toggle" class="home-sidebar-toggle" type="button" aria-label="Recolher menu lateral" aria-expanded="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>
          </button>
        </aside>

        <div class="clinical-specialty-main">
          <header class="clinical-specialty-topbar">
            <p>Página</p>
            <div class="home-page-status">
              <span class="home-system-status home-user-role-status home-user-role-admin">
                <span class="home-system-status-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="M9 12l2 2 4-5"/></svg>
                </span>
                <span>Administrador</span>
              </span>
              <time id="clinical-current-date" class="home-current-date"></time>
            </div>
          </header>
          <main id="clinical-specialty-root" class="clinical-specialty-board" style="--specialty-accent:${SISELO.escapeHtml(config.accent)}"></main>
        </div>
      </div>
    `;
  }

  function setupHeaderDate() {
    if (SISELO.syncCurrentDate) {
      SISELO.syncCurrentDate();
    }
  }

  function setupSidebar(user) {
    const sidebarToggle = document.getElementById("clinical-sidebar-toggle");
    const collapsedKey = "siselo_home_sidebar_collapsed";
    const setSidebarCollapsed = (collapsed) => {
      document.body.classList.toggle("home-sidebar-is-collapsed", collapsed);
      if (sidebarToggle) {
        sidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir menu lateral" : "Recolher menu lateral");
      }
    };

    let sidebarCollapsed = false;
    try {
      sidebarCollapsed = localStorage.getItem(collapsedKey) === "true";
    } catch (error) {}
    setSidebarCollapsed(sidebarCollapsed);

    sidebarToggle?.addEventListener("click", () => {
      sidebarCollapsed = !document.body.classList.contains("home-sidebar-is-collapsed");
      setSidebarCollapsed(sidebarCollapsed);
      try {
        localStorage.setItem(collapsedKey, String(sidebarCollapsed));
      } catch (error) {}
    });

    const sidebarFooter = document.querySelector(".home-sidebar-footer");
    const logoutButton = document.getElementById("logout-button");
    if (sidebarFooter && logoutButton) {
      sidebarFooter.appendChild(logoutButton);
      logoutButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg><span>Sair</span>';
    }

    const accountLink = document.getElementById("topbar-account-link");
    if (accountLink) {
      accountLink.textContent = "";
      const icon = document.createElement("span");
      icon.className = "home-sidebar-user-icon";
      icon.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
      const copy = document.createElement("span");
      copy.className = "home-sidebar-user-copy";
      const name = document.createElement("strong");
      name.textContent = user.name || "Meu perfil";
      const email = document.createElement("small");
      email.textContent = user.email || "Acessar perfil";
      copy.append(name, email);
      accountLink.append(icon, copy);
    }
  }

  async function loadContextPatient() {
    const queryId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
    const cached = readCadhSearchState();
    const cachedPatient = cached && cached.patient ? normalizePatient(cached.patient) : null;

    if (cachedPatient && (!queryId || cachedPatient.id === queryId)) {
      return cachedPatient;
    }

    if (queryId) {
      try {
        const context = await SISELO.loadPatientClinicalContext(queryId);
        if (context && context.patient) return normalizePatient(context.patient);
      } catch (error) {}

      try {
        const data = await SISELO.apiRequest("/patients/list.php");
        const rows = Array.isArray(data.rows) ? data.rows : [];
        const patient = rows.find((row) => SISELO.normalizeEntityId(row.id) === queryId);
        if (patient) return normalizePatient(patient);
      } catch (error) {}
    }

    return cachedPatient;
  }

  function readCadhSearchState() {
    try {
      return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function normalizePatient(patient) {
    const source = patient || {};
    return {
      id: SISELO.normalizeEntityId(source.id),
      full_name: String(source.full_name || "").trim(),
      cpf: String(source.cpf || "").trim(),
      team_ref: String(source.team_ref || "").trim(),
      birth_date: String(source.birth_date || "").trim(),
      first_cadh_date: String(source.first_cadh_date || "").trim(),
      age_label: String(source.age_label || "").trim(),
      race: String(source.race || source.race_label || source.color_race || "").trim(),
    };
  }

  function renderSpecialtyContent(config, patient) {
    const root = document.getElementById("clinical-specialty-root");
    if (!root) return;

    const titlebar = renderTitlebar(config);
    if (!patient || !patient.id) {
      root.innerHTML = `
        ${titlebar}
        <section class="clinical-specialty-empty">
          <strong>Nenhum usuário selecionado</strong>
          <p>Volte ao CADH, selecione um usuário e acesse a especialidade novamente.</p>
          <a class="btn btn-primary" href="/cadh/index.html">Voltar ao CADH</a>
        </section>
      `;
      return;
    }

    root.innerHTML = `
      ${titlebar}
      ${renderSpecialtyRecords(config, patient)}
      <form id="clinical-specialty-form" class="clinical-specialty-form" autocomplete="off" novalidate>
        <input type="hidden" name="record_id" value="">
        <input type="hidden" name="patient_id" value="${SISELO.escapeHtml(patient.id)}">
        <div id="clinical-specialty-alert" class="alert" hidden></div>
        ${config.sections.map(renderSection).join("")}
        <div class="clinical-specialty-actions">
          <a class="btn clinical-secondary-action" href="/cadh/index.html">Cancelar</a>
          <button class="btn btn-primary clinical-save-action" type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>
            ${SISELO.escapeHtml(config.submitLabel || "Salvar Atendimento")}
          </button>
        </div>
      </form>
    `;
  }

  function renderSpecialtyRecords(config, patient) {
    const records = getPatientSpecialtyRecords(config, patient && patient.id);
    const countLabel = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;

    return `
      <section id="clinical-specialty-records" class="clinical-specialty-section clinical-specialty-records" aria-labelledby="clinical-specialty-records-title">
        <header>
          <span id="clinical-specialty-records-title">Registros salvos</span>
          <small>${SISELO.escapeHtml(countLabel)}</small>
        </header>
        <div class="clinical-specialty-records-body">
          ${records.length ? renderSpecialtyRecordsTable(records) : renderSpecialtyRecordsEmpty()}
        </div>
      </section>
    `;
  }

  function renderSpecialtyRecordsTable(records) {
    return `
      <div class="clinical-specialty-records-scroll">
        <table class="clinical-specialty-records-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Consulta</th>
              <th>Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr>
                <td>${SISELO.escapeHtml(formatSpecialtyDate(record.consultation_date))}</td>
                <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
                <td>${SISELO.escapeHtml(formatSpecialtyDateTime(record.updated_at))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSpecialtyRecordsEmpty() {
    return `
      <div class="clinical-specialty-records-empty">
        Nenhum registro salvo para esta especialidade.
      </div>
    `;
  }

  function renderTitlebar(config) {
    return `
      <div class="clinical-specialty-titlebar">
        <a class="clinical-back-link" href="/cadh/index.html" aria-label="Voltar ao CADH">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </a>
        <span class="clinical-specialty-pill">${SISELO.escapeHtml(config.title)}</span>
      </div>
    `;
  }

  function renderSection(sectionConfig) {
    const condition = sectionConfig.condition ? ` data-condition="${SISELO.escapeHtml(sectionConfig.condition)}"` : "";
    const legacyId = sectionConfig.legacyId ? ` data-legacy-id="${SISELO.escapeHtml(sectionConfig.legacyId)}"` : "";
    return `
      <section class="clinical-specialty-section"${condition}${legacyId}>
        <header>${SISELO.escapeHtml(sectionConfig.title)}</header>
        <div class="clinical-specialty-grid">
          ${sectionConfig.fields.map(renderField).join("")}
        </div>
      </section>
    `;
  }

  function renderField(fieldConfig) {
    const id = fieldConfig.id || `clinical_${fieldConfig.name}`;
    const wideClass = fieldConfig.full || fieldConfig.type === "textarea" ? " is-wide" : "";
    const required = fieldConfig.required ? " required" : "";
    const placeholder = fieldConfig.placeholder ? ` placeholder="${SISELO.escapeHtml(fieldConfig.placeholder)}"` : "";
    const inputmode = fieldConfig.inputmode ? ` inputmode="${SISELO.escapeHtml(fieldConfig.inputmode)}"` : "";
    const autocomplete = fieldConfig.autocomplete ? ` autocomplete="${SISELO.escapeHtml(fieldConfig.autocomplete)}"` : "";
    const common = `id="${SISELO.escapeHtml(id)}" name="${SISELO.escapeHtml(fieldConfig.name)}"`;

    let control = "";
    if (fieldConfig.type === "select") {
      control = `
        <select ${common} class="clinical-specialty-native-select" data-native-select="true"${required}>
          ${renderOptions(fieldConfig.options || [])}
        </select>
      `;
    } else if (fieldConfig.type === "textarea") {
      const rows = Number(fieldConfig.rows) || 4;
      control = `<textarea ${common} rows="${rows}"${placeholder}${required}></textarea>`;
    } else if (fieldConfig.type === "calculated") {
      control = `
        <div id="${SISELO.escapeHtml(fieldConfig.displayId || `${id}_display`)}" class="clinical-specialty-calculated" aria-live="polite">—</div>
        <input ${common} type="hidden">
      `;
    } else {
      control = `<input ${common} type="${fieldConfig.type === "date" ? "date" : "text"}"${placeholder}${inputmode}${autocomplete}${required}>`;
    }

    return `
      <div class="clinical-specialty-field${wideClass}" data-field-name="${SISELO.escapeHtml(fieldConfig.name)}" data-legacy-container-id="${SISELO.escapeHtml(fieldConfig.legacyContainerId || "")}">
        <label for="${SISELO.escapeHtml(id)}">${SISELO.escapeHtml(stripRequiredStar(fieldConfig.label))}</label>
        ${control}
      </div>
    `;
  }

  function renderOptions(options) {
    const normalizedOptions = options.length
      ? options
      : [{ value: "", label: "Selecione...", hidden: true }, { value: "Não", label: "Não" }, { value: "Sim", label: "Sim" }];

    return normalizedOptions.map((option) => {
      const value = option && Object.prototype.hasOwnProperty.call(option, "value") ? option.value : option;
      const label = option && Object.prototype.hasOwnProperty.call(option, "label") ? option.label : option;
      const hidden = option && option.hidden ? " hidden" : "";
      const disabled = option && option.disabled ? " disabled" : "";
      return `<option value="${SISELO.escapeHtml(value || "")}"${hidden}${disabled}>${SISELO.escapeHtml(label || value || "")}</option>`;
    }).join("");
  }

  function bindSpecialtyForm(config, patient) {
    const form = document.getElementById("clinical-specialty-form");
    if (!(form instanceof HTMLFormElement) || !patient) return;

    hydrateConsultationOptions(form, config, patient);
    enhanceSpecialtyDateInputs(form);
    bindSpecialtyDerivedFields(form);
    syncConditionalSections(form, config);

    const consultationSelect = form.elements.consultation_number;
    if (consultationSelect instanceof HTMLSelectElement) {
      consultationSelect.addEventListener("change", () => syncConditionalSections(form, config));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveSpecialtyRecord(form, config, patient);
    });
  }

  function enhanceSpecialtyDateInputs(form) {
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      SISELO.enhanceDateInput(input, getSpecialtyDateOptions(input));
    });
  }

  function getSpecialtyDateOptions(input) {
    const today = SISELO.todayDateInputValue();
    const label = document.querySelector(`label[for="${input.id}"]`);
    const text = SISELO.normalizeSearchText([
      input.name,
      input.id,
      label ? label.textContent : "",
    ].join(" "));
    const futureDate = (
      text.includes("subsequente") ||
      text.includes("agendamento") ||
      text.includes("regulacao") ||
      text.includes("retorno") ||
      text.includes("next") ||
      text.includes("schedule")
    );

    return futureDate
      ? { min: today }
      : { min: "1900-01-01", max: today };
  }

  function hydrateConsultationOptions(form, config, patient) {
    const select = form.elements.consultation_number;
    if (!(select instanceof HTMLSelectElement) || !patient || !patient.id) return;

    const records = readRecords(config.storageKey)
      .filter((record) => SISELO.normalizeEntityId(record.patient_id) === patient.id);
    const hasInitial = records.some((record) => isInitialConsultation(record.consultation_number));
    if (!hasInitial) return;

    const maxOrdinal = records.reduce((max, record) => Math.max(max, parseConsultationOrdinal(record.consultation_number)), 0);
    const nextOrdinal = Math.max(2, maxOrdinal + 1);
    const nextLabel = `${nextOrdinal}ª Consulta (subsequente)`;

    select.innerHTML = `
      <option value="${SISELO.escapeHtml(INITIAL_CONSULTATION_LABEL)}" disabled>${SISELO.escapeHtml(INITIAL_CONSULTATION_LABEL)}</option>
      <option value="${SISELO.escapeHtml(nextLabel)}">${SISELO.escapeHtml(nextLabel)}</option>
    `;
    select.value = nextLabel;
  }

  function syncConditionalSections(form, config) {
    const select = form.elements.consultation_number;
    const isInitial = !(select instanceof HTMLSelectElement) || isInitialConsultation(select.value);

    form.querySelectorAll("[data-condition]").forEach((sectionElement) => {
      const condition = sectionElement.getAttribute("data-condition");
      let hidden = false;
      if (condition === "subsequent") hidden = isInitial;
      if (condition === "initial" && !config.keepInitialOnFollowup) hidden = !isInitial;

      sectionElement.hidden = hidden;
      sectionElement.querySelectorAll("input, select, textarea").forEach((control) => {
        control.disabled = hidden;
      });
    });
  }

  function bindSpecialtyDerivedFields(form) {
    const peso = form.elements.peso;
    const altura = form.elements.altura;
    const imc = form.elements.imc;
    const display = document.getElementById("tecnico_imc_display") || document.getElementById("tecnico_imc_display_display");
    if (!(peso instanceof HTMLInputElement) || !(altura instanceof HTMLInputElement) || !(imc instanceof HTMLInputElement) || !display) return;

    const recalc = () => {
      const weight = parseDecimal(peso.value);
      const height = parseDecimal(altura.value);
      if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) {
        display.textContent = "—";
        imc.value = "";
        return;
      }

      const value = weight / (height * height);
      const formatted = value.toFixed(1).replace(".", ",");
      display.textContent = `${formatted} kg/m²`;
      imc.value = formatted;
    };

    peso.addEventListener("input", recalc);
    altura.addEventListener("input", recalc);
    recalc();
  }

  function saveSpecialtyRecord(form, config, patient) {
    if (!SISELO.validateEnhancedDateInputs(form, { alertId: "clinical-specialty-alert" })) return;

    const invalid = getFirstInvalidField(form);
    if (invalid) {
      SISELO.showAlert("clinical-specialty-alert", `Preencha: ${invalid.label}.`, "error");
      invalid.control.focus();
      return;
    }

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const consultationNumber = values.consultation_number || INITIAL_CONSULTATION_LABEL;

    if (hasDuplicateInitial(config.storageKey, patient.id, values.record_id || "", consultationNumber)) {
      SISELO.showAlert("clinical-specialty-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
      return;
    }

    const record = {
      id: values.record_id || createRecordId(config.slug),
      patient_id: patient.id,
      full_name: patient.full_name,
      cpf: patient.cpf,
      team_ref: patient.team_ref,
      birth_date: patient.birth_date,
      first_cadh_date: patient.first_cadh_date,
      age_label: patient.age_label,
      race: patient.race,
      consultation_date: values.consultation_date || "",
      consultation_number: consultationNumber,
      ...values,
      updated_at: new Date().toISOString(),
    };
    delete record.record_id;

    const records = readRecords(config.storageKey);
    const existingIndex = records.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.unshift(record);
    }

    writeRecords(config.storageKey, records);
    renderSpecialtyContent(config, patient);
    bindSpecialtyForm(config, patient);
    SISELO.showAlert("clinical-specialty-alert", "Atendimento salvo com sucesso.", "success");
    document.getElementById("clinical-specialty-records")?.scrollIntoView({ block: "nearest" });
  }

  function getFirstInvalidField(form) {
    const controls = Array.from(form.querySelectorAll("input, select, textarea"));
    const invalidControl = controls.find((control) => (
      !control.disabled &&
      control.required &&
      !String(control.value || "").trim()
    ));
    if (!invalidControl) return null;

    const fieldElement = invalidControl.closest(".clinical-specialty-field");
    const label = cleanText(fieldElement ? fieldElement.querySelector("label")?.textContent : "") || invalidControl.name || "campo obrigatório";
    return { control: invalidControl, label };
  }

  function hasDuplicateInitial(storageKey, patientId, currentRecordId, consultationNumber) {
    if (!isInitialConsultation(consultationNumber)) return false;

    const normalizedPatientId = SISELO.normalizeEntityId(patientId);
    const normalizedCurrentId = String(currentRecordId || "").trim();
    return readRecords(storageKey).some((record) => (
      SISELO.normalizeEntityId(record.patient_id) === normalizedPatientId &&
      String(record.id || "").trim() !== normalizedCurrentId &&
      isInitialConsultation(record.consultation_number)
    ));
  }

  function getPatientSpecialtyRecords(config, patientId) {
    const normalizedPatientId = SISELO.normalizeEntityId(patientId);
    if (!normalizedPatientId) return [];

    return readRecords(config.storageKey)
      .filter((record) => SISELO.normalizeEntityId(record.patient_id) === normalizedPatientId)
      .sort(compareSpecialtyRecords);
  }

  function compareSpecialtyRecords(left, right) {
    const ordinalDiff = parseConsultationOrdinal(right.consultation_number) - parseConsultationOrdinal(left.consultation_number);
    if (ordinalDiff !== 0) return ordinalDiff;

    const dateDiff = String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    if (dateDiff !== 0) return dateDiff;

    return String(right.updated_at || "").localeCompare(String(left.updated_at || ""));
  }

  function readRecords(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function writeRecords(storageKey, records) {
    try {
      localStorage.setItem(storageKey, JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)));
    } catch (error) {}
  }

  function formatSpecialtyDate(value) {
    const date = SISELO.parseDateInputValue(value);
    if (!date) return "-";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  }

  function formatSpecialtyDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function renderSuccess(config) {
    const root = document.getElementById("clinical-specialty-root");
    if (!root) return;

    root.innerHTML = `
      <section class="clinical-specialty-success">
        <span class="clinical-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.2 2.2 4.8-5.4"/></svg>
        </span>
        <h1>Atendimento registrado!</h1>
        <p>Registro de ${SISELO.escapeHtml(config.title)} salvo com sucesso.</p>
        <a class="btn btn-primary" href="/cadh/index.html">Voltar ao CADH</a>
      </section>
    `;
  }

  function createRecordId(slug) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${slug}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isInitialConsultation(value) {
    return parseConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
  }

  function parseConsultationOrdinal(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function parseDecimal(value) {
    const normalized = String(value || "").replace(",", ".").trim();
    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function stripRequiredStar(value) {
    return cleanText(value).replace(/\s*\*$/, "");
  }
})();
