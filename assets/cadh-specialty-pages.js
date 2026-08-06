(() => {
  const CADH_SEARCH_KEY = "siselo_cadh_search";
  const specialtyRecordCache = new Map();
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
      sections: addFollowUpScheduleFields(
        extractedConfig && extractedConfig.sections.length ? extractedConfig.sections : baseConfig.sections
      ),
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

  function addFollowUpScheduleFields(sections) {
    const list = Array.isArray(sections) ? sections : [];
    const hasFollowUpTime = list.some((item) => (
      Array.isArray(item.fields) && item.fields.some((itemField) => itemField.name === "follow_up_time")
    ));
    let hasFollowUpDate = false;
    let appended = false;
    const enhancedSections = list.map((item) => ({
      ...item,
      fields: (item.fields || []).flatMap((itemField) => {
        const normalized = SISELO.normalizeSearchText(`${itemField.name || ""} ${itemField.label || ""}`);
        const isFollowUpDate = (
          itemField.type === "date" &&
          (
            normalized.includes("data da consulta subsequente") ||
            normalized.includes("next consult date")
          )
        );
        if (!isFollowUpDate) return [itemField];

        hasFollowUpDate = true;
        if (hasFollowUpTime || appended) {
          return [{ ...itemField, followUpDate: true }];
        }
        appended = true;
        return [
          { ...itemField, followUpDate: true },
          field("follow_up_time", "Horário da consulta subsequente", "time", {
            id: "clinical_follow_up_time",
            required: false,
          }),
        ];
      }),
    }));

    if (hasFollowUpDate) return enhancedSections;

    return [
      ...enhancedSections,
      section("Consulta subsequente", [
        field("follow_up_date", "Data da consulta subsequente", "date", {
          id: "clinical_follow_up_date",
          followUpDate: true,
          required: false,
        }),
        field("follow_up_time", "Horário da consulta subsequente", "time", {
          id: "clinical_follow_up_time",
          required: false,
        }),
      ]),
    ];
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
    await loadSpecialtyRecords(config, patient);
    const appointmentContext = await loadSpecialtyAppointment(patient);
    renderSpecialtyContent(config, patient, appointmentContext.appointment);
    bindSpecialtyForm(config, patient, appointmentContext.appointment);
    loadRequestedSpecialtyRecord(config, patient);
    const specialtyForm = document.getElementById("clinical-specialty-form");
    if (specialtyForm instanceof HTMLFormElement) {
      applySpecialtyAppointmentContext(specialtyForm, appointmentContext.appointment);
    }
    if (appointmentContext.error) {
      specialtyForm?.querySelector('button[type="submit"]')?.setAttribute("disabled", "disabled");
      SISELO.showAlert("clinical-specialty-alert", appointmentContext.error, "error");
    }
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
                <span class="home-sidebar-nav-copy"><strong>CADH</strong><small>Atenção secundária</small></span>
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

  async function loadSpecialtyAppointment(patient) {
    const appointmentId = SISELO.normalizeEntityId(SISELO.queryParam("appointment_id"));
    if (!appointmentId) {
      return { appointment: null, error: "" };
    }

    try {
      const data = await SISELO.apiRequest(`/care_flow/list.php?appointment_id=${encodeURIComponent(appointmentId)}`);
      const appointment = data && data.appointment ? data.appointment : null;
      if (!appointment) {
        return { appointment: null, error: "O agendamento informado não foi encontrado." };
      }
      if (!patient || String(appointment.patient_id) !== String(patient.id)) {
        return { appointment: null, error: "O agendamento não pertence ao paciente selecionado." };
      }
      if (!["agendado", "aguardando", "em_atendimento", "atendido"].includes(String(appointment.status || ""))) {
        return { appointment: null, error: "Este agendamento foi encerrado sem atendimento e não aceita registro clínico." };
      }
      return { appointment, error: "" };
    } catch (error) {
      return {
        appointment: null,
        error: error.message || "Não foi possível carregar os dados do agendamento.",
      };
    }
  }

  function renderSpecialtyContent(config, patient, appointment = null) {
    const root = document.getElementById("clinical-specialty-root");
    if (!root) return;

    const titlebar = renderTitlebar(config, patient);
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
      <form id="clinical-specialty-form" class="clinical-specialty-form" autocomplete="off" novalidate>
        <input type="hidden" name="record_id" value="">
        <input type="hidden" name="patient_id" value="${SISELO.escapeHtml(patient.id)}">
        <input type="hidden" name="appointment_id" value="${SISELO.escapeHtml(appointment ? appointment.id : "")}">
        <div id="clinical-specialty-alert" class="alert" hidden></div>
        ${appointment ? renderSpecialtyAppointmentContext(appointment) : ""}
        ${config.sections.map(renderSection).join("")}
        <div class="clinical-specialty-actions">
          <a class="btn clinical-secondary-action" href="${SISELO.escapeHtml(getSpecialtyReturnHref(patient))}">Cancelar</a>
          <button class="btn btn-primary clinical-save-action" type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>
            ${SISELO.escapeHtml(config.submitLabel || "Salvar Atendimento")}
          </button>
        </div>
      </form>
    `;
  }

  function renderSpecialtyAppointmentContext(appointment) {
    const scheduled = parseSpecialtyAppointmentDateTime(appointment.scheduled_at);
    return `
      <section class="clinical-appointment-context" aria-labelledby="clinical-appointment-context-title">
        <header>
          <div>
            <span>Dados herdados do agendamento</span>
            <strong id="clinical-appointment-context-title">Consulta agendada</strong>
          </div>
          <span class="clinical-appointment-status">Agendado</span>
        </header>
        <div class="clinical-appointment-context-grid">
          <div><span>Paciente</span><strong>${SISELO.escapeHtml(appointment.full_name || "Não informado")}</strong></div>
          <div><span>Módulo clínico</span><strong>${SISELO.escapeHtml(appointment.specialty || "Não informado")}</strong></div>
          <div><span>Profissional</span><strong>${SISELO.escapeHtml(appointment.professional || "Não informado")}</strong></div>
          <div><span>Data</span><strong>${SISELO.escapeHtml(scheduled.dateLabel)}</strong></div>
          <div><span>Horário</span><strong>${SISELO.escapeHtml(scheduled.timeLabel)}</strong></div>
          <div><span>Equipe</span><strong>${SISELO.escapeHtml(SISELO.formatTeamName(appointment.team) || "Não informada")}</strong></div>
        </div>
        <p>Paciente, módulo, profissional, data e horário vêm do agendamento e serão vinculados automaticamente a este registro.</p>
      </section>
    `;
  }

  function loadRequestedSpecialtyRecord(config, patient) {
    const recordId = String(SISELO.queryParam("record_id") || "").trim();
    if (!recordId || !patient || !patient.id) return;

    const record = findPatientRecord(config, patient.id, recordId);
    if (!record) {
      SISELO.showAlert("clinical-specialty-alert", "Registro não encontrado para edição.", "error");
      return;
    }

    loadSpecialtyRecordIntoForm(config, record);
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
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr>
                <td>${SISELO.escapeHtml(formatSpecialtyDate(record.consultation_date))}</td>
                <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
                <td>${SISELO.escapeHtml(formatSpecialtyDateTime(record.updated_at))}</td>
                <td>
                  <div class="table-actions clinical-specialty-record-actions">
                    ${SISELO.iconButton("view", "Ver exames", { "data-clinical-record-view": record.id })}
                    ${SISELO.iconButton("pdf", "Gerar PDF", { "data-clinical-record-pdf": record.id })}
                    ${SISELO.iconButton("edit", "Editar registro", { "data-clinical-record-edit": record.id })}
                    ${SISELO.iconButton("delete", "Remover registro", { "data-clinical-record-delete": record.id })}
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function bindSpecialtyRecordActions(config, patient) {
    const container = document.getElementById("clinical-specialty-records");
    if (!container || !patient) return;

    container.querySelectorAll("[data-clinical-record-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = findPatientRecord(config, patient.id, button.dataset.clinicalRecordView);
        if (record) {
          openSpecialtyRecordView(config, record);
        }
      });
    });

    container.querySelectorAll("[data-clinical-record-pdf]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = findPatientRecord(config, patient.id, button.dataset.clinicalRecordPdf);
        if (record) {
          SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
        }
      });
    });

    container.querySelectorAll("[data-clinical-record-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = findPatientRecord(config, patient.id, button.dataset.clinicalRecordEdit);
        if (record) {
          loadSpecialtyRecordIntoForm(config, record);
        }
      });
    });

    container.querySelectorAll("[data-clinical-record-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = findPatientRecord(config, patient.id, button.dataset.clinicalRecordDelete);
        if (!record || !(await SISELO.confirmPermanentDeletion(`o registro de ${config.title}`, record.consultation_number))) {
          return;
        }

        if (record.encounter_id) {
          try {
            await SISELO.apiRequest("/encounters/soft_delete.php", {
              method: "POST",
              body: { id: Number(record.encounter_id) },
            });
          } catch (error) {
            SISELO.showAlert("clinical-specialty-alert", error.message || "Não foi possível excluir o registro.", "error");
            return;
          }
        }

        const records = readRecords(config.storageKey).filter((item) => String(item.id) !== String(record.id));
        writeRecords(config.storageKey, records);
        renderSpecialtyContent(config, patient);
        bindSpecialtyForm(config, patient);
      });
    });
  }

  function findPatientRecord(config, patientId, recordId) {
    const normalizedPatientId = SISELO.normalizeEntityId(patientId);
    const normalizedRecordId = String(recordId || "").trim();
    return readRecords(config.storageKey).find((record) => (
      SISELO.normalizeEntityId(record.patient_id) === normalizedPatientId &&
      String(record.id || "").trim() === normalizedRecordId
    )) || null;
  }

  function loadSpecialtyRecordIntoForm(config, record) {
    const form = document.getElementById("clinical-specialty-form");
    if (!(form instanceof HTMLFormElement)) return;

    Object.entries(record || {}).forEach(([name, value]) => {
      setSpecialtyControlValue(form.elements[name], value);
    });

    setSpecialtyControlValue(form.elements.record_id, record.id || "");
    syncConditionalSections(form, config);
    form.querySelectorAll("input, select, textarea").forEach((control) => {
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    SISELO.showAlert("clinical-specialty-alert", "Registro carregado para edição.", "success");
    form.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function setSpecialtyControlValue(control, value) {
    if (!control) return;
    const nextValue = value == null ? "" : String(value);

    if (control instanceof RadioNodeList) {
      control.value = nextValue;
      return;
    }

    if (control instanceof HTMLSelectElement) {
      ensureSpecialtySelectValue(control, nextValue);
      control.value = nextValue;
      return;
    }

    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.value = nextValue;
    }
  }

  function ensureSpecialtySelectValue(select, value) {
    if (!(select instanceof HTMLSelectElement) || !value) return;

    const option = Array.from(select.options).find((item) => item.value === value);
    if (option) {
      option.disabled = false;
      return;
    }

    select.add(new Option(value, value));
  }

  function openSpecialtyRecordView(config, record) {
    const overlay = ensureSpecialtyRecordModal();
    const title = overlay.querySelector("[data-clinical-record-title]");
    const body = overlay.querySelector("[data-clinical-record-body]");
    const dialog = overlay.querySelector(".clinical-record-view-modal");
    if (!title || !body || !dialog) return;

    title.textContent = `${config.title} - Registro salvo`;
    body.innerHTML = renderSpecialtyRecordView(config, record);
    overlay.hidden = false;
    overlay.classList.add("is-open");
    document.body.classList.add("modal-open");
    dialog.focus();
  }

  function ensureSpecialtyRecordModal() {
    let overlay = document.getElementById("clinical-record-view-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "clinical-record-view-overlay";
    overlay.className = "clinical-record-view-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="clinical-record-view-modal" role="dialog" aria-modal="true" aria-labelledby="clinical-record-view-title" tabindex="-1">
        <header>
          <h2 id="clinical-record-view-title" data-clinical-record-title>Registro salvo</h2>
          <button class="clinical-record-view-close" type="button" aria-label="Fechar" data-clinical-record-close>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="clinical-record-view-body" data-clinical-record-body></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeSpecialtyRecordModal();
    });
    overlay.querySelector("[data-clinical-record-close]")?.addEventListener("click", closeSpecialtyRecordModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) closeSpecialtyRecordModal();
    });

    return overlay;
  }

  function closeSpecialtyRecordModal() {
    const overlay = document.getElementById("clinical-record-view-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function renderSpecialtyRecordView(config, record) {
    const identification = [
      ["Paciente", record.full_name || "-"],
      ["CPF", record.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(record.team_ref) || "-"],
      ["Data de nascimento", formatSpecialtyDate(record.birth_date)],
      ["Idade", record.age_label || "-"],
      ["1º atendimento no CADH", formatSpecialtyDate(record.first_cadh_date)],
    ];
    const consultation = [
      ["Data da consulta", formatSpecialtyDate(record.consultation_date)],
      ["Nº da consulta", record.consultation_number || "-"],
      ["Atualizado em", formatSpecialtyDateTime(record.updated_at)],
    ];

    return `
      ${renderSpecialtyRecordViewSection("Identificação", identification)}
      ${renderSpecialtyRecordViewSection("Consulta", consultation)}
      ${config.sections.map((sectionConfig) => renderSpecialtyRecordFieldSection(sectionConfig, record)).join("")}
    `;
  }

  function renderSpecialtyRecordFieldSection(sectionConfig, record) {
    const rows = (sectionConfig.fields || [])
      .filter((fieldConfig) => !["patient_id", "record_id", "consultation_date", "consultation_number"].includes(fieldConfig.name))
      .map((fieldConfig) => [stripRequiredStar(fieldConfig.label), formatSpecialtyRecordValue(fieldConfig, record[fieldConfig.name])]);

    if (!rows.length) return "";
    return renderSpecialtyRecordViewSection(sectionConfig.title, rows);
  }

  function renderSpecialtyRecordViewSection(title, rows) {
    return `
      <section class="clinical-record-view-section">
        <h3>${SISELO.escapeHtml(title)}</h3>
        <dl>
          ${rows.map(([label, value]) => `
            <div>
              <dt>${SISELO.escapeHtml(label)}</dt>
              <dd>${SISELO.escapeHtml(value || "-")}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `;
  }

  function formatSpecialtyRecordValue(fieldConfig, value) {
    if (fieldConfig.type === "date") return formatSpecialtyDate(value);
    return String(value || "-").trim() || "-";
  }

  function renderSpecialtyRecordsEmpty() {
    return `
      <div class="clinical-specialty-records-empty">
        Nenhum registro salvo para esta especialidade.
      </div>
    `;
  }

  function renderTitlebar(config, patient) {
    return `
      <div class="clinical-specialty-titlebar">
        <a class="clinical-back-link" href="${SISELO.escapeHtml(getSpecialtyReturnHref(patient))}" aria-label="Voltar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </a>
        <span class="clinical-specialty-pill">${SISELO.escapeHtml(config.title)}</span>
      </div>
    `;
  }

  function getSpecialtyReturnHref(patient) {
    const requestedReturn = String(SISELO.queryParam("return_to") || "").trim();
    if (requestedReturn.startsWith("/") && !requestedReturn.startsWith("//")) {
      return requestedReturn;
    }
    const patientId = SISELO.normalizeEntityId(patient && patient.id);
    if (SISELO.queryParam("return") === "history" && patientId) {
      return `/cadh/history.html?patient_id=${encodeURIComponent(patientId)}`;
    }
    return "/cadh/index.html?flow=followup&view=encounters";
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
      const inputType = ["date", "time"].includes(fieldConfig.type) ? fieldConfig.type : "text";
      control = `<input ${common} type="${inputType}"${placeholder}${inputmode}${autocomplete}${required}>`;
    }

    return `
      <div class="clinical-specialty-field${wideClass}" data-field-name="${SISELO.escapeHtml(fieldConfig.name)}" data-follow-up-date="${fieldConfig.followUpDate ? "true" : "false"}" data-legacy-container-id="${SISELO.escapeHtml(fieldConfig.legacyContainerId || "")}">
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

  function bindSpecialtyForm(config, patient, appointment = null) {
    const form = document.getElementById("clinical-specialty-form");
    if (!(form instanceof HTMLFormElement) || !patient) return;

    hydrateConsultationOptions(form, config, patient);
    enhanceSpecialtyDateInputs(form);
    applySpecialtyAppointmentContext(form, appointment);
    bindSpecialtyDerivedFields(form);
    syncConditionalSections(form, config);

    const consultationSelect = form.elements.consultation_number;
    if (consultationSelect instanceof HTMLSelectElement) {
      consultationSelect.addEventListener("change", () => syncConditionalSections(form, config));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveSpecialtyRecord(form, config, patient, appointment);
    });
  }

  function applySpecialtyAppointmentContext(form, appointment) {
    if (!appointment) return;

    const scheduled = parseSpecialtyAppointmentDateTime(appointment.scheduled_at);
    setSpecialtyControlValue(form.elements.appointment_id, appointment.id || "");
    const consultationDate = form.elements.consultation_date;
    if (consultationDate instanceof HTMLInputElement) {
      consultationDate.min = scheduled.dateValue;
      consultationDate.max = scheduled.dateValue;
      consultationDate.value = scheduled.dateValue;
      consultationDate.readOnly = true;
      consultationDate.dataset.inheritedFromAppointment = "true";
      SISELO.syncEnhancedDateInput(consultationDate);
      const datePicker = consultationDate.nextElementSibling;
      if (datePicker?.classList.contains("date-picker")) {
        datePicker.classList.add("is-inherited");
        const trigger = datePicker.querySelector(".date-picker-trigger");
        if (trigger instanceof HTMLButtonElement) {
          trigger.disabled = true;
          trigger.setAttribute("aria-label", "Data definida pelo agendamento");
        }
      }
    }

    ["professional", "profissional"].forEach((name) => {
      const control = form.elements[name];
      if (control && !String(control.value || "").trim() && appointment.professional) {
        setSpecialtyControlValue(control, appointment.professional);
      }
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

  async function saveSpecialtyRecord(form, config, patient, appointment = null) {
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
    const followUp = getFollowUpSchedule(form);
    if (!followUp.valid) {
      SISELO.showAlert(
        "clinical-specialty-alert",
        "Para agendar a consulta subsequente, informe a data e o horário.",
        "error"
      );
      followUp.focusControl?.focus();
      return;
    }

    if (hasDuplicateInitial(config.storageKey, patient.id, values.record_id || "", consultationNumber)) {
      SISELO.showAlert("clinical-specialty-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
      return;
    }

    const record = {
      id: values.record_id || createRecordId(config.slug),
      encounter_id: "",
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
      appointment_id: appointment ? appointment.id : "",
      scheduled_at: appointment ? appointment.scheduled_at : "",
      appointment_specialty: appointment ? appointment.specialty : "",
      appointment_professional: appointment ? appointment.professional : "",
      appointment_team: appointment ? appointment.team : "",
      ...values,
      updated_at: new Date().toISOString(),
    };
    delete record.record_id;

    const records = readRecords(config.storageKey);
    const existingIndex = records.findIndex((item) => item.id === record.id);
    const existingRecord = existingIndex >= 0 ? records[existingIndex] : null;
    if (existingRecord?.encounter_id) {
      record.encounter_id = existingRecord.encounter_id;
    }

    {
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
      }
      try {
        const endpoint = record.encounter_id
          ? `/encounters/form.php?id=${encodeURIComponent(record.encounter_id)}`
          : "/encounters/form.php";
        const response = await SISELO.apiRequest(endpoint, {
          method: "POST",
          body: {
            patient_id: Number(patient.id),
            appointment_id: appointment ? Number(appointment.id) : 0,
            encounter_date: appointment
              ? parseSpecialtyAppointmentDateTime(appointment.scheduled_at).dateValue
              : (values.consultation_date || SISELO.todayDateInputValue()),
            specialty: (appointment && appointment.specialty) || config.title,
            record_type: "consulta",
            schema_version: "1.0",
            payload_json: JSON.stringify({
              ...values,
              _specialty_slug: config.slug,
              scheduled_at: appointment ? appointment.scheduled_at : "",
              specialty: (appointment && appointment.specialty) || config.title,
              professional: appointment ? (appointment.professional || "") : "",
              team: appointment ? (appointment.team || "") : "",
            }),
            summary: buildSpecialtySummary(config, values),
            follow_up_date: appointment ? followUp.date : "",
            follow_up_time: appointment ? followUp.time : "",
          },
        });
        record.encounter_id = response?.row?.id || record.encounter_id;
      } catch (error) {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
        }
        SISELO.showAlert(
          "clinical-specialty-alert",
          error.message || "Não foi possível concluir o atendimento vinculado ao agendamento.",
          "error"
        );
        return;
      }
    }

    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.unshift(record);
    }

    writeRecords(config.storageKey, records);
    if (appointment) {
      renderSuccess(config, patient, Boolean(followUp.date && followUp.time));
      return;
    }
    renderSpecialtyContent(config, patient);
    bindSpecialtyForm(config, patient);
    SISELO.showAlert("clinical-specialty-alert", "Atendimento salvo com sucesso.", "success");
  }

  function buildSpecialtySummary(config, values) {
    const consultation = String(values.consultation_number || INITIAL_CONSULTATION_LABEL).trim();
    const notes = [
      values.summary,
      values.anamnese,
      values.description,
      values.descricao,
      values.observations,
      values.observacoes,
    ].find((value) => String(value || "").trim());
    const prefix = `${config.title} · ${consultation}`;
    return notes ? `${prefix} · ${String(notes).trim().slice(0, 220)}` : prefix;
  }

  function getFollowUpSchedule(form) {
    const dateControl = form.querySelector('[data-follow-up-date="true"] input[name]');
    const timeControl = form.elements.follow_up_time;
    const date = dateControl instanceof HTMLInputElement ? String(dateControl.value || "").trim() : "";
    const time = timeControl instanceof HTMLInputElement ? String(timeControl.value || "").trim() : "";
    const valid = (date === "" && time === "") || (date !== "" && time !== "");
    return {
      valid,
      date,
      time,
      focusControl: date === "" ? dateControl : timeControl,
    };
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

  async function loadSpecialtyRecords(config, patient) {
    if (!patient || !patient.id) {
      specialtyRecordCache.set(config.storageKey, []);
      return;
    }
    try {
      const data = await SISELO.apiRequest(`/encounters/list.php?patient_id=${encodeURIComponent(patient.id)}`);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const records = rows.map((row) => {
        let payload = {};
        try {
          payload = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : (row.payload_json || {});
        } catch (error) {
          payload = {};
        }
        return {
          ...payload,
          id: String(row.id),
          encounter_id: row.id,
          patient_id: row.patient_id,
          full_name: row.full_name || patient.full_name,
          cpf: row.cpf || patient.cpf,
          team_ref: row.team_ref || patient.team_ref,
          consultation_date: payload.consultation_date || row.encounter_date,
          updated_at: row.updated_at || row.encounter_date,
          _api_specialty: row.specialty || "",
        };
      }).filter((record) => {
        const slug = String(record._specialty_slug || "");
        const specialty = SISELO.normalizeSearchText(record._api_specialty || "");
        return slug === config.slug
          || specialty.includes(SISELO.normalizeSearchText(config.title))
          || specialty.includes(SISELO.normalizeSearchText(config.slug));
      });
      specialtyRecordCache.set(config.storageKey, records);
    } catch (error) {
      specialtyRecordCache.set(config.storageKey, []);
    }
  }

  function readRecords(storageKey) {
    return [...(specialtyRecordCache.get(storageKey) || [])];
  }

  function writeRecords(storageKey, records) {
    specialtyRecordCache.set(storageKey, (Array.isArray(records) ? records : []).filter(Boolean));
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

  function parseSpecialtyAppointmentDateTime(value) {
    const raw = String(value || "").trim().replace(" ", "T");
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!match) {
      return {
        dateValue: "",
        dateLabel: "Não informada",
        timeLabel: "Não informado",
      };
    }
    return {
      dateValue: match[1],
      dateLabel: formatSpecialtyDate(match[1]),
      timeLabel: match[2],
    };
  }

  function renderSuccess(config, patient, followUpScheduled = false) {
    const root = document.getElementById("clinical-specialty-root");
    if (!root) return;

    root.innerHTML = `
      <section class="clinical-specialty-success">
        <span class="clinical-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.2 2.2 4.8-5.4"/></svg>
        </span>
        <h1>Atendimento registrado!</h1>
        <p>O registro de ${SISELO.escapeHtml(config.title)} foi vinculado ao agendamento e o paciente foi movido automaticamente para Atendidos.${followUpScheduled ? " A consulta subsequente foi adicionada em Agendados." : ""}</p>
        <a class="btn btn-primary" href="${SISELO.escapeHtml(getSpecialtyReturnHref(patient))}">Voltar aos Agendamentos</a>
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
