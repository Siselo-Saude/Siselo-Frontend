document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "patients-list") {
    setupPatientsListPage();
  }

  if (page === "patients-trash") {
    setupPatientsTrashPage();
  }

  if (page === "patients-form") {
    setupPatientFormPage();
  }

  if (page === "patients-show") {
    setupPatientShowPage();
  }
});

async function setupPatientsListPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("patients");
  const query = SISELO.queryParam("q") || "";
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  const newPatientLink = document.getElementById("new-patient-link");
  const canCreatePatient = permissions.has("patients.create");
  searchInput.value = query;
  newPatientLink.hidden = !canCreatePatient;
  document.getElementById("trash-link").hidden =
    !permissions.has("patients.restore");

  let rows = [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const applySearch = (value) => {
    const filteredRows = filterPatientRows(rows, value);
    newPatientLink.hidden = !canCreatePatient || filteredRows.length === 0;
    renderPatientsTable(
      "patients-table-body",
      filteredRows,
      permissions,
      false,
      value,
    );
    SISELO.syncSearchUrl("/patients/list.html", value);
  };

  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
  });
  applySearch(query);

  searchInput.addEventListener("input", (event) => {
    applySearch(event.currentTarget.value);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch(searchInput.value);
  });
}

async function setupPatientsTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("patients");
  const query = SISELO.queryParam("q") || "";
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  searchInput.value = query;

  let rows = [];

  try {
    const data = await SISELO.apiRequest("/patients/trash.php");
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById("patients-table-body");
  const applySearch = (value) => {
    renderPatientsTrashTable(
      tbody,
      filterPatientRows(rows, value),
      permissions,
      value,
    );
    bindPatientsTrashActions(tbody);
    SISELO.syncSearchUrl("/patients/trash.html", value);
  };

  applySearch(query);

  searchInput.addEventListener("input", (event) => {
    applySearch(event.currentTarget.value);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch(searchInput.value);
  });
}

async function setupPatientFormPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  SISELO.bindShell("patients");

  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  const endpoint =
    "/patients/form.php" + (id ? "?id=" + encodeURIComponent(id) : "");
  let data = getEmptyPatientFormContext();

  try {
    data = await SISELO.apiRequest(endpoint);
  } catch (error) {}

  const row = data.row || getEmptyPatientFormContext().row;
  const options = getPatientFormOptions(data.options);

  document.getElementById("form-title").textContent = data.editing
    ? "Editar Usuário"
    : "Novo Usuário";

  fillSelect("gender", options.gender_options, row.sex);
  fillSelect("race", options.race_options, row.race);
  fillSelect("blood_type", options.blood_type_options, row.blood_type, true);

  Object.keys(row).forEach((key) => {
    const field =
      document.querySelector(`[name="${key}"]`) ||
      document.querySelector(`[data-field="${key}"]`);
    if (field) {
      field.value = row[key] ?? "";
    }
  });

  configurePatientDateInputs();
  syncPatientClinicalTextareas();
  attachPatientMasks();
  setupPatientStatusToggle(row.status || row.status_label || "ativo");

  document
    .getElementById("patient-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFieldErrors();

      if (
        !SISELO.validateEnhancedDateInputs(event.currentTarget, {
          alertId: "page-alert",
        })
      ) {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData.entries());

      try {
        const result = await SISELO.apiRequest(endpoint, {
          method: "POST",
          body: payload,
        });
        const savedPatientId = SISELO.normalizeEntityId(
          (result && result.row && result.row.id) || id,
        );
        await SISELO.refreshCachedPatientContext(savedPatientId);
        SISELO.showAlert(
          "page-alert",
          "Usuário registrado com sucesso!",
          "success",
        );
        setTimeout(() => {
          location.href = SISELO.resolveBackTarget("/patients/list.html");
        }, 2000);
      } catch (error) {
        const payloadErrors =
          error.payload && error.payload.errors ? error.payload.errors : {};
        Object.keys(payloadErrors).forEach((field) => {
          const errorElement = document.querySelector(
            `[data-error-for="${field}"]`,
          );
          if (errorElement) {
            errorElement.textContent = payloadErrors[field];
          }
        });

        SISELO.showAlert("page-alert", error.message, "error");
      }
    });
}

async function setupPatientShowPage() {
  const user = await SISELO.requireSession();
  if (!user) {
    return;
  }

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("patients");

  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  let data = null;

  if (id) {
    try {
      data = await SISELO.apiRequest(
        "/patients/show.php?id=" + encodeURIComponent(id),
      );
    } catch (error) {
      data = null;
    }
  }

  const patient =
    data && data.patient ? data.patient : getEmptyPatientSummary();
  const carePlans =
    data && Array.isArray(data.care_plans) ? data.care_plans : [];
  const encounters =
    data && Array.isArray(data.encounters) ? data.encounters : [];
  const transitions =
    data && Array.isArray(data.transitions) ? data.transitions : [];
  const activeTab = normalizePatientTab(SISELO.queryParam("tab"));
  const actionPatientId = id || "0";
  const returnTargets = {
    planos: buildPatientReturnTarget(actionPatientId, "planos"),
    atendimentos: buildPatientReturnTarget(actionPatientId, "atendimentos"),
    transicoes: buildPatientReturnTarget(actionPatientId, "transicoes"),
  };

  if (!data || !data.patient) {
  }

  document.title = `Usuário 360 - ${patient.full_name || "SISELO"}`;
  document.getElementById("patient-overview").innerHTML =
    renderPatientOverview(patient);

  document.getElementById("patient-notes").innerHTML =
    renderPatientClinicalNotes(patient);

  configurePatientTabs(actionPatientId, activeTab, permissions, {
    planos: carePlans.length,
    atendimentos: encounters.length,
    transicoes: transitions.length,
  });
  configurePatientBackLink(activeTab);
  bindPatientPdfPlaceholder();

  document.getElementById("patient-actions").innerHTML = `
    ${permissions.has("careplans.create") ? `<a class="btn" href="${buildPatientModuleActionHref("/care-plans/form.html", { patient_id: actionPatientId, return_to: returnTargets.planos })}">+ Novo plano</a>` : ""}
    ${permissions.has("encounters.create") ? `<a class="btn" href="${buildPatientModuleActionHref("/encounters/form.html", { patient_id: actionPatientId, return_to: returnTargets.atendimentos })}">+ Novo atendimento</a>` : ""}
    ${permissions.has("transitions.create") ? `<a class="btn" href="${buildPatientModuleActionHref("/transitions/form.html", { patient_id: actionPatientId, return_to: returnTargets.transicoes })}">+ Nova transição</a>` : ""}
  `;

  renderCarePlanRows(
    "care-plans-table-body",
    carePlans,
    permissions,
    returnTargets.planos,
  );
  renderEncounterRows(
    "encounters-table-body",
    encounters,
    permissions,
    returnTargets.atendimentos,
  );
  renderTransitionRows(
    "transitions-table-body",
    transitions,
    permissions,
    returnTargets.transicoes,
  );
}

function renderPatientsTable(targetId, rows, permissions, isTrash, query = "") {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      7,
      "Nenhum usuário encontrado.",
      !isTrash && permissions.has("patients.create")
        ? { label: "+ Novo usuário", href: "/patients/form.html" }
        : null,
    );
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>
        <strong>${SISELO.highlightPersonName(row.full_name, query)}</strong><br>
        <small>${SISELO.escapeHtml(row.age_label || "")}${row.age_label && row.gender_label ? " | " : ""}${SISELO.escapeHtml(row.gender_label || "")}</small>
      </td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${SISELO.escapeHtml(row.ses)}</td>
      <td>${SISELO.escapeHtml(row.phone || "")}<br><small>${SISELO.escapeHtml(row.email || "")}</small></td>
      <td>${SISELO.escapeHtml(row.blood_type || "")}</td>
      <td>${renderPatientStatusBadge(row.status || row.status_label)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink("view", `/patients/show.html?id=${row.id}&tab=planos`, "Usuário 360")}
          ${permissions.has("patients.update") ? SISELO.iconLink("edit", `/patients/form.html?id=${row.id}`, "Editar usuário") : ""}
          ${!isTrash && permissions.has("patients.delete") ? SISELO.iconButton("delete", "Apagar usuário", { "data-delete-id": row.id, "data-delete-label": row.full_name || "" }) : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  bindPatientListActions(tbody);
}

function filterPatientRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesName = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.full_name, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.ses, search)
      : true;

    return matchesName && matchesDigits;
  });
}

function renderPatientsTrashTable(tbody, rows, permissions, query = "") {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(5, "Nenhum usuário na lixeira.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.highlightPersonName(row.full_name, query)}</td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${SISELO.escapeHtml(row.ses)}</td>
      <td>${SISELO.escapeHtml(row.deleted_at)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("restore", "Restaurar usuário", { "data-restore-id": row.id })}
          ${permissions.has("patients.delete")
            ? SISELO.iconButton("delete", "Apagar permanentemente", {
                "data-destroy-id": row.id,
                "data-destroy-label": row.full_name || "",
              })
            : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function bindPatientListActions(tbody) {
  tbody.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (
        !(await SISELO.confirmDeletion(
          "o usuário",
          button.dataset.deleteLabel,
        ))
      ) {
        return;
      }

      try {
        await SISELO.apiRequest("/patients/soft_delete.php", {
          method: "POST",
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o usuário.",
        );
      }
    });
  });
}

function bindPatientsTrashActions(tbody) {
  tbody.querySelectorAll("[data-restore-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await SISELO.apiRequest("/patients/restore.php", {
        method: "POST",
        body: { id: Number(button.dataset.restoreId) },
      });
      location.reload();
    });
  });

  tbody.querySelectorAll("[data-destroy-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (
        !(await SISELO.confirmPermanentDeletion(
          "o usuário",
          button.dataset.destroyLabel,
        ))
      ) {
        return;
      }

      try {
        await SISELO.apiRequest("/patients/destroy.php", {
          method: "POST",
          body: { id: Number(button.dataset.destroyId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o usuário permanentemente.",
        );
      }
    });
  });
}

function renderCarePlanRows(targetId, rows, permissions, returnTo = "") {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      4,
      "Nenhum plano de cuidado encontrado.",
    );
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.id}</td>
      <td>${SISELO.escapeHtml(row.start_date)}</td>
      <td>${SISELO.escapeHtml(row.end_date || "")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink("pdf", `${SISELO.getApiBaseUrl()}/care_plans/pdf.php?id=${row.id}`, "Gerar PDF", { target: "_blank", rel: "noreferrer" })}
          ${permissions.has("careplans.update") ? SISELO.iconLink("edit", buildPatientModuleActionHref("/care-plans/form.html", { id: row.id, patient_id: row.patient_id, return_to: returnTo }), "Editar plano") : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderEncounterRows(targetId, rows, permissions, returnTo = "") {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(4, "Nenhum atendimento encontrado.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || "")}</td>
      <td>
        <div class="table-actions">
          ${permissions.has("encounters.update") ? SISELO.iconLink("edit", buildPatientModuleActionHref("/encounters/form.html", { id: row.id, patient_id: row.patient_id, return_to: returnTo }), "Editar atendimento") : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderTransitionRows(targetId, rows, permissions, returnTo = "") {
  const tbody = document.getElementById(targetId);

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(6, "Nenhuma transição encontrada.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.transition_date)}</td>
      <td>${SISELO.escapeHtml(row.from_service || "")}</td>
      <td>${SISELO.escapeHtml(row.to_service || "")}</td>
      <td>${SISELO.escapeHtml(row.status)}</td>
      <td>${SISELO.escapeHtml(row.notes || "")}</td>
      <td>
        <div class="table-actions">
          ${permissions.has("transitions.update") ? SISELO.iconLink("edit", buildPatientModuleActionHref("/transitions/form.html", { id: row.id, patient_id: row.patient_id, return_to: returnTo }), "Editar transição") : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderPatientOverview(patient) {
  const statusConfig = getPatientStatusConfig(
    patient.status || patient.status_label,
  );
  const metaItems = [
    ["CPF", patient.cpf || "-"],
    ["SES", patient.ses || "-"],
    [
      "Nascimento",
      patient.birth_date ? formatPatientDisplayDate(patient.birth_date) : "-",
    ],
    ["Idade", patient.age_label || "-"],
    ["Gênero", patient.gender_label || "-"],
    ["Telefone", patient.phone || "-"],
    ["Email", patient.email || "-"],
    ["Sangue", patient.blood_type || "-"],
    ["Convênio", patient.health_insurance || "-"],
    ["UBS", patient.ubs_ref || "-"],
    ["Equipe", patient.team_ref || "-"],
    ["Contato de emergência", patient.emergency_contact || "-"],
  ];

  return `
    <div class="patient360-hero">
      <div class="patient360-avatar" aria-hidden="true">${SISELO.escapeHtml(getPatientInitials(patient.full_name))}</div>
      <div class="patient360-hero-copy">
        <div class="patient360-name-row">
          <h2 class="patient360-name">${SISELO.escapeHtml(patient.full_name || "Usuário não localizado")}</h2>
          <span class="patient360-status${statusConfig.key === "inativo" ? " is-inativo" : ""}">${SISELO.escapeHtml(statusConfig.label)}</span>
        </div>
        <div class="patient360-meta-grid">
          ${metaItems
            .map(
              ([label, value]) => `
            <div class="patient360-meta-item">
              <span class="patient360-meta-label">${SISELO.escapeHtml(label)}</span>
              <span class="patient360-meta-value">${SISELO.escapeHtml(value)}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderPatientClinicalNotes(patient) {
  const cards = [
    {
      title: "Alergias",
      value: patient.allergies || "",
      empty: "Não informado.",
    },
    {
      title: "Condições crônicas",
      value: patient.chronic_conditions || "",
      empty: "Não informado.",
    },
  ];

  return cards
    .map(
      (card) => `
    <article class="patient360-note-card">
      <h3 class="patient360-note-title">${SISELO.escapeHtml(card.title)}</h3>
      <p class="patient360-note-text${card.value ? "" : " patient360-note-empty"}">${SISELO.escapeHtml(card.value || card.empty)}</p>
    </article>
  `,
    )
    .join("");
}

function getPatientInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "P";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatPatientDisplayDate(value) {
  const parsedDate = SISELO.parseDateInputValue(value);
  if (!parsedDate) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsedDate);
}

function getPatientStatusConfig(value) {
  const normalized = SISELO.normalizeSearchText(value || "");
  if (normalized === "inativo") {
    return {
      key: "inativo",
      label: "Inativo",
      badgeClass: "status-badge-inactive",
    };
  }

  return {
    key: "ativo",
    label: "Ativo",
    badgeClass: "status-badge-active",
  };
}

function renderPatientStatusBadge(value) {
  const config = getPatientStatusConfig(value);
  return `<span class="status-badge ${config.badgeClass}">${SISELO.escapeHtml(config.label)}</span>`;
}

function setupPatientStatusToggle(initialValue) {
  const hiddenInput = document.getElementById("patient-status");
  const toggle = document.getElementById("patient-status-toggle");
  if (!(hiddenInput instanceof HTMLInputElement) || !(toggle instanceof HTMLElement)) {
    return;
  }

  const setValue = (nextValue) => {
    const normalized = SISELO.normalizeSearchText(nextValue || "") === "inativo"
      ? "inativo"
      : "ativo";
    hiddenInput.value = normalized;
    toggle.querySelectorAll("[data-status-value]").forEach((button) => {
      const isSelected = button.getAttribute("data-status-value") === normalized;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  };

  toggle.querySelectorAll("[data-status-value]").forEach((button) => {
    button.addEventListener("click", () => {
      setValue(button.getAttribute("data-status-value"));
    });
  });

  setValue(initialValue);
}

function bindPatientPdfPlaceholder() {
  const button = document.getElementById("patient-pdf-button");
  if (!button || button.dataset.bound === "true") {
    return;
  }

  button.dataset.bound = "true";
  button.addEventListener("click", () => {
    SISELO.showUnavailableAction(
      "A impressão do prontuário será disponibilizada em breve.",
    );
  });
}

function getPatientTabLabel(key) {
  const labels = {
    planos: "Planos de Cuidado",
    atendimentos: "Atendimentos",
    transicoes: "Transições",
  };

  return labels[key] || key;
}

function normalizePatientTab(value) {
  return ["planos", "atendimentos", "transicoes"].includes(String(value || ""))
    ? String(value)
    : "planos";
}

function configurePatientTabs(id, activeTab, permissions, counts = {}) {
  const tabs = [
    {
      key: "planos",
      permission: "careplans.view",
      linkId: "patient-careplans-link",
      panelId: "patient-panel-planos",
    },
    {
      key: "atendimentos",
      permission: "encounters.view",
      linkId: "patient-encounters-link",
      panelId: "patient-panel-atendimentos",
    },
    {
      key: "transicoes",
      permission: "transitions.view",
      linkId: "patient-transitions-link",
      panelId: "patient-panel-transicoes",
    },
  ];

  tabs.forEach((tab) => {
    const link = document.getElementById(tab.linkId);
    const panel = document.getElementById(tab.panelId);
    const allowed = permissions.has(tab.permission);
    const count = Number(counts[tab.key] || 0);

    if (link) {
      link.href =
        "/patients/show.html?id=" + encodeURIComponent(id) + "&tab=" + tab.key;
      link.hidden = !allowed;
      link.classList.toggle("is-active", allowed && tab.key === activeTab);
      link.innerHTML = `${getPatientTabLabel(tab.key)}<span class="patient360-tab-badge">${count}</span>`;
    }

    if (panel) {
      panel.hidden = !allowed || tab.key !== activeTab;
    }
  });
}

function configurePatientBackLink(activeTab) {
  const link = document.getElementById("patient-back-link");
  if (!link) {
    return;
  }

  const destinations = {
    planos: "/patients/list.html",
    atendimentos: "/encounters/list.html",
    transicoes: "/transitions/list.html",
  };

  const fallback = destinations[activeTab] || "/patients/list.html";
  link.href = fallback;
  link.dataset.fallback = fallback;
}

function getPatientFormOptions(options) {
  const safeOptions = options || {};
  const defaultRaceOptions = {
    branca: "Branco",
    preta: "Preto",
    parda: "Pardo",
    amarela: "Amarelo",
    indigena: "Indígena",
    nao_informado: "Não informado",
  };

  const incomingRaceOptions = safeOptions.race_options || defaultRaceOptions;
  const raceOptions = Object.keys(defaultRaceOptions).reduce((acc, key) => {
    acc[key] = defaultRaceOptions[key];
    return acc;
  }, {});

  Object.entries(incomingRaceOptions).forEach(([key, label]) => {
    if (Object.prototype.hasOwnProperty.call(raceOptions, key)) {
      raceOptions[key] = defaultRaceOptions[key];
      return;
    }

    raceOptions[key] = label;
  });

  return {
    gender_options: safeOptions.gender_options || {
      masculino: "Masculino",
      feminino: "Feminino",
      outro: "Outro",
    },
    race_options: raceOptions,
    blood_type_options: safeOptions.blood_type_options || [
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "O+",
      "O-",
      "N/A",
    ],
  };
}

function buildPatientReturnTarget(patientId, tab) {
  return `/patients/show.html?id=${encodeURIComponent(patientId)}&tab=${encodeURIComponent(tab)}`;
}

function buildPatientModuleActionHref(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

function getEmptyPatientFormContext() {
  return {
    editing: false,
    row: {
      first_cadh_date: "",
      full_name: "",
      ses: "",
      cpf: "",
      birth_date: "",
      sex: "",
      race: "",
      responsible_name: "",
      phone: "",
      address: "",
      email: "",
      emergency_contact: "",
      health_insurance: "",
      blood_type: "",
      allergies: "",
      chronic_conditions: "",
      status: "ativo",
      ubs_ref: "",
      team_ref: "",
    },
    options: getPatientFormOptions({}),
  };
}

function getEmptyPatientSummary() {
  return {
    full_name: "",
    cpf: "",
    ses: "",
    age_label: "",
    gender_label: "",
    status_label: "Ativo",
    phone: "",
    email: "",
    blood_type: "",
    health_insurance: "",
    ubs_ref: "",
    team_ref: "",
    emergency_contact: "",
    allergies: "",
    chronic_conditions: "",
  };
}

function fillSelect(id, options, currentValue, allowBlank) {
  const select = document.getElementById(id);
  if (!select) {
    return;
  }

  const entries = Array.isArray(options)
    ? options.map((value) => [value, value])
    : Object.entries(options || {});

  select.innerHTML =
    `${allowBlank ? '<option value="">Selecione</option>' : '<option value="">Selecione</option>'}` +
    entries
      .map(
        ([value, label]) => `
      <option value="${SISELO.escapeHtml(value)}" ${String(currentValue || "") === String(value) ? "selected" : ""}>${SISELO.escapeHtml(label)}</option>
    `,
      )
      .join("");
}

function clearFieldErrors() {
  document.querySelectorAll("[data-error-for]").forEach((element) => {
    element.textContent = "";
  });
  SISELO.showAlert("page-alert", "", "info");
}

function configurePatientDateInputs() {
  const today = SISELO.todayDateInputValue();
  const oldestBirthDate = SISELO.shiftDateInputValue(today, { years: -130 });
  const attendanceFloor = "1900-01-01";
  const birthInput = SISELO.enhanceDateInput("birth_date", {
    min: oldestBirthDate,
    max: today,
    defaultViewYearsAgo: 30,
  });
  const attendanceInput = SISELO.enhanceDateInput("attendance_date", {
    min: attendanceFloor,
    max: today,
  });

  if (!birthInput || !attendanceInput) {
    return;
  }

  const syncPatientDates = () => {
    birthInput.max = attendanceInput.value || today;
    attendanceInput.min =
      birthInput.value && birthInput.value > attendanceFloor
        ? birthInput.value
        : attendanceFloor;

    if (birthInput.value) {
      birthInput.value = SISELO.clampDateInputValue(
        birthInput.value,
        oldestBirthDate,
        birthInput.max,
      );
    }

    if (attendanceInput.value) {
      attendanceInput.value = SISELO.clampDateInputValue(
        attendanceInput.value,
        attendanceInput.min,
        today,
      );
    }

    SISELO.syncEnhancedDateInput(birthInput);
    SISELO.syncEnhancedDateInput(attendanceInput);
  };

  birthInput.addEventListener("change", syncPatientDates);
  attendanceInput.addEventListener("change", syncPatientDates);
  syncPatientDates();
}

function syncPatientClinicalTextareas() {
  const textareas = ["allergies", "chronic_conditions"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (textareas.length < 2) {
    return;
  }

  const syncHeights = () => {
    textareas.forEach((textarea) => {
      textarea.style.resize = "none";
      textarea.style.height = "auto";
    });

    const nextHeight = Math.max(
      160,
      ...textareas.map((textarea) => textarea.scrollHeight),
    );

    textareas.forEach((textarea) => {
      textarea.style.height = `${nextHeight}px`;
    });
  };

  textareas.forEach((textarea) => {
    textarea.addEventListener("input", syncHeights);
  });

  syncHeights();
}

function attachPatientMasks() {
  const sesInput = document.getElementById("ses");
  const cpfInput = document.getElementById("cpf");
  const phoneInput = document.getElementById("phone");
  const emergencyInput = document.getElementById("emergency_contact");

  if (sesInput) {
    sesInput.addEventListener("input", () => {
      sesInput.value = digitsOnly(sesInput.value).slice(0, 9);
    });
    sesInput.value = digitsOnly(sesInput.value).slice(0, 9);
  }

  if (cpfInput) {
    cpfInput.addEventListener("input", () => {
      cpfInput.value = formatCpf(cpfInput.value);
    });
    cpfInput.value = formatCpf(cpfInput.value);
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = formatPhone(phoneInput.value);
    });
    phoneInput.value = formatPhone(phoneInput.value);
  }

  if (emergencyInput) {
    emergencyInput.addEventListener("input", () => {
      emergencyInput.value = formatPhone(emergencyInput.value);
    });
    emergencyInput.value = formatPhone(emergencyInput.value);
  }
}

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatCpf(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length <= 9)
    return (
      digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6)
    );
  return (
    digits.slice(0, 3) +
    "." +
    digits.slice(3, 6) +
    "." +
    digits.slice(6, 9) +
    "-" +
    digits.slice(9)
  );
}

function formatPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6)
    return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
  if (digits.length <= 10)
    return (
      "(" +
      digits.slice(0, 2) +
      ") " +
      digits.slice(2, 6) +
      "-" +
      digits.slice(6)
    );
  return (
    "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7)
  );
}
