document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "care-plans-list") {
    setupCarePlansListPage();
  }

  if (page === "care-plans-form") {
    setupCarePlansFormPage();
  }

  if (page === "care-plans-trash") {
    setupCarePlansTrashPage();
  }
});

async function setupCarePlansListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("careplans");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  const newPlanLink = document.getElementById("new-plan-link");
  const trashLink = document.getElementById("trash-link");
  const canCreatePlan = permissions.has("careplans.create");
  const newPlanHref =
    "/care-plans/form.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  const trashHref =
    "/care-plans/trash.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  searchInput.value = query;
  newPlanLink.hidden = !canCreatePlan;
  trashLink.hidden = !permissions.has("careplans.restore");
  newPlanLink.href = newPlanHref;
  trashLink.href = trashHref;

  const url =
    "/care_plans/list.php" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  let rows = [];

  try {
    const data = await SISELO.apiRequest(url);
    rows = SISELO.filterRowsByPatientId(
      Array.isArray(data.rows) ? data.rows : [],
      patientId,
    );
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById("care-plans-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/care-plans/form.html?patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    const filteredRows = filterCarePlanRows(rows, value);
    newPlanLink.hidden = !canCreatePlan || filteredRows.length === 0;
    renderCarePlansTable(
      tbody,
      filteredRows,
      permissions,
      value,
      newPlanHref,
      patientId,
    );
    bindCarePlanListActions(tbody);
    SISELO.syncSearchUrl(
      "/care-plans/list.html",
      value,
      patientId ? { patient_id: patientId } : {},
    );
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

async function setupCarePlansFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("careplans");
  setupCarePlanFormShell(user);

  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  let currentPlanId = id;
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const endpointParams = new URLSearchParams();
  if (id) endpointParams.set("id", id);
  if (patientId) endpointParams.set("patient_id", patientId);
  const endpointQuery = endpointParams.toString();
  const endpoint =
    "/care_plans/form.php" + (endpointQuery ? "?" + endpointQuery : "");
  let data = getEmptyCarePlanContext(patientId);

  try {
    data = await SISELO.apiRequest(endpoint || "/care_plans/form.php");
  } catch (error) {}

  const plan = data.plan || getEmptyCarePlanContext(patientId).plan;
  const normalizedPlanPatientId = SISELO.normalizeEntityId(plan.patient_id || patientId);
  const patientOptions = patientId
    ? SISELO.filterPatientsById(
        Array.isArray(data.patients) ? data.patients : [],
        patientId,
      )
    : Array.isArray(data.patients)
      ? data.patients
      : [];
  let selectedPatient =
    patientOptions.find((patient) => SISELO.normalizeEntityId(patient.id) === normalizedPlanPatientId) ||
    null;

  if (normalizedPlanPatientId) {
    const patientContext = await SISELO.loadPatientClinicalContext(normalizedPlanPatientId);
    if (patientContext && patientContext.patient) {
      selectedPatient = patientContext.patient;
    }
  }
  const pickerRows = selectedPatient
    ? [
        selectedPatient,
        ...patientOptions.filter(
          (patient) =>
            SISELO.normalizeEntityId(patient && patient.id) !==
            SISELO.normalizeEntityId(selectedPatient && selectedPatient.id),
        ),
      ]
    : patientOptions;

  document.getElementById("form-title").textContent = "Ficha Plano de Cuidado";

  const formBody = document.getElementById("care-plan-form-body");
  if (formBody) {
    formBody.innerHTML = renderCarePlanSheet({
      plan,
      items: Array.isArray(data.items) ? data.items : [],
      patient: selectedPatient,
      patientLocked: Boolean(patientId),
    });
    SISELO.enhanceChoiceSelects(formBody);
    setupCarePlanGoalRepeater();
    SISELO.applyUiComponents(formBody);
  }
  const patientPicker = SISELO.setupPatientFieldPicker({
    select: "patient_id",
    container: "care-plan-user-search",
    rows: pickerRows,
    currentValue: plan.patient_id,
    locked: Boolean(patientId),
    placeholder: "Digite o nome do usuário cadastrado...",
  });
  configureCarePlanDateInputs();
  bindCarePlanDateMirrors();

  document
    .getElementById("care-plan-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      SISELO.showAlert("page-alert", "", "info");

      if (
        !SISELO.validateEnhancedDateInputs(event.currentTarget, {
          alertId: "page-alert",
        })
      ) {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const selectedUserId = patientPicker.getValue();
      if (selectedUserId) {
        formData.set("patient_id", selectedUserId);
      }

      try {
        const submitEndpoint =
          "/care_plans/form.php" +
          (currentPlanId ? "?id=" + encodeURIComponent(currentPlanId) : "");
        const result = await SISELO.apiRequest(
          submitEndpoint,
          {
            method: "POST",
            body: objectFromFormData(formData),
          },
        );
        const savedPatientId = SISELO.normalizeEntityId(
          (result && result.plan && result.plan.patient_id) ||
            selectedUserId ||
            formData.get("patient_id") ||
            patientId,
        );
        await SISELO.refreshCachedPatientContext(savedPatientId);
        currentPlanId = SISELO.normalizeEntityId(
          result && result.plan ? result.plan.id : currentPlanId,
        );
        showCarePlanSavedState(currentPlanId);
      } catch (error) {
        SISELO.showAlert("page-alert", error.message, "error");
      }
    });
}

function setupCarePlanFormShell(user) {
  document.querySelectorAll(".home-sidebar .menu a").forEach((link) => {
    link.classList.remove("is-active");
    link.removeAttribute("aria-current");
  });
  const activeCadhLink = document.getElementById("nav-cadh");
  if (activeCadhLink) {
    activeCadhLink.classList.add("is-active");
    activeCadhLink.setAttribute("aria-current", "page");
  }

  const dateElement = document.getElementById("care-plan-current-date");
  const updateCurrentDate = () => {
    if (!dateElement) return;
    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    dateElement.dateTime = localDate;
    dateElement.textContent = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);
  };
  updateCurrentDate();
  window.setInterval(updateCurrentDate, 60 * 1000);

  const sidebarToggle = document.getElementById("care-plan-sidebar-toggle");
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
  } catch (error) {
  }
  setSidebarCollapsed(sidebarCollapsed);

  sidebarToggle?.addEventListener("click", () => {
    sidebarCollapsed = !document.body.classList.contains("home-sidebar-is-collapsed");
    setSidebarCollapsed(sidebarCollapsed);
    try {
      localStorage.setItem(collapsedKey, String(sidebarCollapsed));
    } catch (error) {
    }
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

function renderCarePlanSheet({ plan, items, patient, patientLocked }) {
  const lookup = buildCarePlanItemLookup(items);
  const profileFields = [
    "Autocuidado",
    "Letramento funcional em saúde",
    "Adesão terapêutica",
    "Estágio motivacional para a mudança",
    "Suporte familiar",
    "Suporte social",
  ];
  const specialties = [
    "Psicologia",
    "Enfermagem",
    "Endocrinologia",
    "Cardiologia",
    "Oftalmologia",
    "Nutrição",
    "Assistência Social",
    "Fisioterapia",
  ];

  return `
    <select id="patient_id" name="patient_id" class="visually-hidden" tabindex="-1" aria-hidden="true"></select>

    <section class="care-plan-patient-picker ${patientLocked ? "is-locked" : ""}">
      <label>
        <span>Usuário</span>
        <div id="care-plan-user-search" class="transition-patient-search"></div>
      </label>
    </section>

    <section class="care-plan-section care-plan-register-section">
      <header>Dados cadastrais do usuário do SUS</header>
      <div class="care-plan-register-grid">
        ${renderCarePlanStaticField("CPF usuário do SUS", patient && patient.cpf)}
        ${renderCarePlanStaticField("Equipe de referência", patient && SISELO.formatTeamName(patient.team_ref), "care-plan-team-highlight")}
        ${renderCarePlanStaticField("Nome", patient && patient.full_name)}
        ${renderCarePlanStaticField("Nome social", patient && patient.social_name)}
        ${renderCarePlanStaticField("Data de nascimento", formatCarePlanDate(patient && patient.birth_date))}
        ${renderCarePlanStaticField("Data do primeiro atendimento no CADH", formatCarePlanDate(patient && patient.first_cadh_date))}
        ${renderCarePlanStaticField("Unidade Básica de Saúde de Origem", patient && patient.ubs_ref)}
        ${renderCarePlanStaticField("Equipe de saúde da família", patient && SISELO.formatTeamName(patient.team_ref), "care-plan-team-highlight")}
        ${renderCarePlanStaticField("Endereço", patient && patient.address)}
        ${renderCarePlanStaticField("Telefone", patient && patient.phone)}
        ${renderCarePlanStaticField("Apoio familiar (nome)", patient && patient.responsible_name)}
        ${renderCarePlanStaticField("Apoio comunitário (nome)", patient && patient.emergency_contact)}
        <label>
          <span>Data de início</span>
          <input id="start_date" name="start_date" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" value="${SISELO.escapeHtml(plan.start_date || SISELO.todayDateInputValue())}" required>
        </label>
        <label>
          <span>Data da próxima revisão</span>
          <input id="end_date" name="end_date" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" value="${SISELO.escapeHtml(plan.end_date || "")}">
        </label>
      </div>
    </section>

    <section class="care-plan-section">
      <header>Plano de cuidados</header>
      <div class="care-plan-profile-grid">
        ${profileFields.map((title, index) => renderCarePlanProfileField(title, lookup, index + 1)).join("")}
      </div>
    </section>

    <section class="care-plan-section">
      <header>Identificação dos fatores dificultadores e recomendações</header>
      <div class="care-plan-matrix care-plan-specialty-matrix">
        <div class="care-plan-matrix-head">Especialidade</div>
        <div class="care-plan-matrix-head">Fatores dificultadores</div>
        <div class="care-plan-matrix-head">Recomendação</div>
        ${specialties.map((title, index) => renderCarePlanSpecialtyRow(title, lookup, 20 + index)).join("")}
      </div>
    </section>

    <section class="care-plan-section">
      <header>Intervenções medicamentosas e não medicamentosas</header>
      <div class="care-plan-two-column">
        ${renderCarePlanRecommendationField("Endocrinologia", lookup, 40)}
        ${renderCarePlanRecommendationField("Cardiologia", lookup, 41)}
      </div>
    </section>

    <section class="care-plan-section">
      <header>Orientações para sinais de alerta</header>
      <div class="care-plan-matrix care-plan-alert-matrix">
        <div class="care-plan-matrix-head">Situação</div>
        <div class="care-plan-matrix-head">Recomendação</div>
        ${[1, 2, 3].map((number, index) => renderCarePlanAlertRow(number, lookup, 50 + index)).join("")}
      </div>
    </section>

    <section class="care-plan-section">
      <header>Prioridades e recomendações da equipe especializada</header>
      <div id="care-plan-goals-matrix" class="care-plan-matrix care-plan-alert-matrix care-plan-goals-matrix">
        <div class="care-plan-matrix-head">Principais dificuldades encontradas</div>
        <div class="care-plan-matrix-head">Metas estabelecidas</div>
        ${getCarePlanGoalNumbers(lookup).map((number, index) => renderCarePlanGoalRow(number, lookup, 60 + index)).join("")}
      </div>
      <div class="care-plan-repeat-actions" aria-label="Gerenciar prioridades e metas">
        <button type="button" class="care-plan-repeat-button ui-button" data-care-plan-goal-add aria-label="Adicionar prioridade">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button type="button" class="care-plan-repeat-button ui-button" data-care-plan-goal-remove aria-label="Remover prioridade">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
        </button>
      </div>
    </section>

    <section class="care-plan-section">
      <header>Para registro da APS</header>
      <div class="care-plan-two-column">
        <label>
          <span>Data da avaliação da APS</span>
          <input id="aps_review_date" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" value="${SISELO.escapeHtml(plan.end_date || "")}">
        </label>
        <label>
          <span>Monitoramento na APS</span>
          <input id="interventions" name="interventions" value="${SISELO.escapeHtml(plan.interventions || "")}" placeholder="Descrever o monitoramento...">
        </label>
      </div>
    </section>
  `;
}

function renderCarePlanStaticField(label, value, className = "") {
  return `
    <div class="care-plan-static-field ${SISELO.escapeHtml(className)}">
      <span>${SISELO.escapeHtml(label)}</span>
      <strong>${SISELO.escapeHtml(value || "—")}</strong>
    </div>
  `;
}

function renderCarePlanProfileField(title, lookup, sortOrder) {
  const item = findCarePlanItem(lookup, "recomendacao", title);
  return `
    <label>
      ${renderCarePlanHiddenItemFields("recomendacao", title, sortOrder, { situation: "", difficulty: "", goal: "" })}
      <span>${SISELO.escapeHtml(title)}</span>
      <select name="recommendation[]">
        ${["", "Adequado", "Parcial", "Necessita apoio", "Não avaliado"].map((option) => `
          <option value="${SISELO.escapeHtml(option)}" ${String(item.recommendation || "") === option ? "selected" : ""}>${option ? SISELO.escapeHtml(option) : "Selecione..."}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderCarePlanSpecialtyRow(title, lookup, sortOrder) {
  const item = findCarePlanItem(lookup, "dificuldade", title);
  return `
    <div class="care-plan-row-title">
      ${renderCarePlanHiddenItemFields("dificuldade", title, sortOrder, { situation: "", goal: "" })}
      <strong>${SISELO.escapeHtml(title)}</strong>
    </div>
    <textarea name="difficulty[]" rows="2" placeholder="Fatores dificultadores...">${SISELO.escapeHtml(item.difficulty || "")}</textarea>
    <textarea name="recommendation[]" rows="2" placeholder="Recomendação...">${SISELO.escapeHtml(item.recommendation || "")}</textarea>
  `;
}

function renderCarePlanRecommendationField(title, lookup, sortOrder) {
  const item = findCarePlanItem(lookup, "recomendacao", title);
  return `
    <label>
      ${renderCarePlanHiddenItemFields("recomendacao", title, sortOrder, { situation: "", difficulty: "", goal: "" })}
      <span>${SISELO.escapeHtml(title)}</span>
      <textarea name="recommendation[]" rows="2" placeholder="Ex.: conduta, medicamentos, orientações...">${SISELO.escapeHtml(item.recommendation || "")}</textarea>
    </label>
  `;
}

function renderCarePlanAlertRow(number, lookup, sortOrder) {
  const title = `Sinal de alerta ${number}`;
  const item = findCarePlanItem(lookup, "alerta", title);
  return `
    <label>
      ${renderCarePlanHiddenItemFields("alerta", title, sortOrder, { difficulty: "", goal: "" })}
      <textarea name="situation[]" rows="1" placeholder="Situação ${number}...">${SISELO.escapeHtml(item.situation || "")}</textarea>
    </label>
    <textarea name="recommendation[]" rows="1" placeholder="Recomendação ${number}...">${SISELO.escapeHtml(item.recommendation || "")}</textarea>
  `;
}

function renderCarePlanGoalRow(number, lookup, sortOrder) {
  const title = `Prioridade ${number}`;
  const item = findCarePlanItem(lookup, "meta", title);
  return `
    <div class="care-plan-goal-row" data-care-plan-goal-row data-goal-number="${number}">
      <label>
        ${renderCarePlanHiddenItemFields("meta", title, sortOrder, { situation: "", recommendation: "" })}
        <textarea name="difficulty[]" rows="2" placeholder="Dificuldade ${number}...">${SISELO.escapeHtml(item.difficulty || "")}</textarea>
      </label>
      <label>
        <span class="visually-hidden">Meta ${number}</span>
        <textarea name="goal[]" rows="2" placeholder="Meta ${number}...">${SISELO.escapeHtml(item.goal || "")}</textarea>
      </label>
    </div>
  `;
}

function getCarePlanGoalNumbers(lookup) {
  const numbers = [];

  for (let number = 1; number <= 12; number += 1) {
    const item = findCarePlanItem(lookup, "meta", `Prioridade ${number}`);
    const hasContent = Boolean(
      String(item.difficulty || "").trim() ||
      String(item.goal || "").trim(),
    );

    if (number === 1 || hasContent) {
      numbers.push(number);
    }
  }

  return numbers.length ? numbers : [1];
}

function setupCarePlanGoalRepeater() {
  const matrix = document.getElementById("care-plan-goals-matrix");
  const addButton = document.querySelector("[data-care-plan-goal-add]");
  const removeButton = document.querySelector("[data-care-plan-goal-remove]");

  if (!matrix || !addButton || !removeButton) {
    return;
  }

  const getRows = () => Array.from(matrix.querySelectorAll("[data-care-plan-goal-row]"));
  const syncRows = () => {
    const rows = getRows();
    rows.forEach((row, index) => {
      const number = index + 1;
      row.dataset.goalNumber = String(number);
      const titleInput = row.querySelector('input[name="title[]"]');
      const sortInput = row.querySelector('input[name="sort_order[]"]');
      if (titleInput instanceof HTMLInputElement) {
        titleInput.value = `Prioridade ${number}`;
      }
      if (sortInput instanceof HTMLInputElement) {
        sortInput.value = String(60 + index);
      }
      row.querySelector('textarea[name="difficulty[]"]')?.setAttribute("placeholder", `Dificuldade ${number}...`);
      row.querySelector('textarea[name="goal[]"]')?.setAttribute("placeholder", `Meta ${number}...`);
      const hiddenLabel = row.querySelector(".visually-hidden");
      if (hiddenLabel) {
        hiddenLabel.textContent = `Meta ${number}`;
      }
    });
    removeButton.disabled = rows.length <= 1;
    removeButton.setAttribute("aria-disabled", rows.length <= 1 ? "true" : "false");
  };

  addButton.addEventListener("click", () => {
    const nextNumber = getRows().length + 1;
    const template = document.createElement("template");
    template.innerHTML = renderCarePlanGoalRow(nextNumber, [], 60 + nextNumber - 1).trim();
    const row = template.content.firstElementChild;
    if (row) {
      matrix.appendChild(row);
      syncRows();
      row.querySelector("textarea")?.focus();
    }
  });

  removeButton.addEventListener("click", () => {
    const rows = getRows();
    if (rows.length <= 1) {
      syncRows();
      return;
    }

    rows[rows.length - 1].remove();
    syncRows();
  });

  syncRows();
}

function renderCarePlanHiddenItemFields(type, title, sortOrder, hiddenValues = {}) {
  return `
    <input type="hidden" name="item_type[]" value="${SISELO.escapeHtml(type)}">
    <input type="hidden" name="title[]" value="${SISELO.escapeHtml(title)}">
    <input type="hidden" name="sort_order[]" value="${SISELO.escapeHtml(sortOrder)}">
    ${hiddenValues.situation !== undefined ? `<input type="hidden" name="situation[]" value="${SISELO.escapeHtml(hiddenValues.situation)}">` : ""}
    ${hiddenValues.recommendation !== undefined ? `<input type="hidden" name="recommendation[]" value="${SISELO.escapeHtml(hiddenValues.recommendation)}">` : ""}
    ${hiddenValues.difficulty !== undefined ? `<input type="hidden" name="difficulty[]" value="${SISELO.escapeHtml(hiddenValues.difficulty)}">` : ""}
    ${hiddenValues.goal !== undefined ? `<input type="hidden" name="goal[]" value="${SISELO.escapeHtml(hiddenValues.goal)}">` : ""}
  `;
}

function buildCarePlanItemLookup(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    lookupKey: getCarePlanItemKey(item.item_type, item.title),
  }));
}

function findCarePlanItem(lookup, type, title) {
  return lookup.find((item) => item.lookupKey === getCarePlanItemKey(type, title)) || {};
}

function getCarePlanItemKey(type, title) {
  return `${SISELO.normalizeSearchText(type)}::${SISELO.normalizeSearchText(title)}`;
}

function formatCarePlanDate(value) {
  const date = SISELO.parseDateInputValue(value);
  return date ? new Intl.DateTimeFormat("pt-BR").format(date) : value || "";
}

function showCarePlanSavedState(planId) {
  SISELO.showAlert("page-alert", "Plano de cuidado salvo com sucesso.", "success");
  if (planId) {
    const url = new URL(location.href);
    url.searchParams.set("id", planId);
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  document.querySelectorAll(".care-plan-save-button").forEach((button) => {
    button.classList.add("is-saved");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#care-plan-icon-check"></use></svg> Plano Salvo!';
  });
}

async function setupCarePlansTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("careplans");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  searchInput.value = query;

  let rows = [];

  const url =
    "/care_plans/trash.php" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");

  try {
    const data = await SISELO.apiRequest(url);
    rows = SISELO.filterRowsByPatientId(
      Array.isArray(data.rows) ? data.rows : [],
      patientId,
    );
  } catch (error) {
    rows = [];
  }

  const tbody = document.getElementById("care-plans-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/care-plans/trash.html?patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    renderCarePlansTrashTable(
      tbody,
      filterCarePlanRows(rows, value),
      permissions,
      value,
    );
    bindCarePlanTrashActions(tbody);
    SISELO.syncSearchUrl(
      "/care-plans/trash.html",
      value,
      patientId ? { patient_id: patientId } : {},
    );
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

function renderCarePlansTable(
  tbody,
  rows,
  permissions,
  query = "",
  newPlanHref = "/care-plans/form.html",
  scopedPatientId = "",
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      5,
      "Nenhum plano de cuidado encontrado.",
      permissions.has("careplans.create")
        ? { label: "+ Novo plano", href: newPlanHref }
        : null,
    );
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.id}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.escapeHtml(formatCarePlanDate(row.start_date))}</td>
      <td>${SISELO.escapeHtml(formatCarePlanDate(row.end_date))}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink("pdf", `${SISELO.getApiBaseUrl()}/care_plans/pdf.php?id=${row.id}`, "Gerar PDF", { target: "_blank", rel: "noreferrer" })}
          ${permissions.has("careplans.update") ? SISELO.iconLink("edit", `/care-plans/form.html?id=${encodeURIComponent(row.id)}${scopedPatientId ? `&patient_id=${encodeURIComponent(scopedPatientId)}` : ""}`, "Editar plano") : ""}
          ${permissions.has("careplans.delete") ? SISELO.iconButton("delete", "Inativar plano", { "data-delete-id": row.id, "data-delete-label": row.full_name || `Plano ${row.id}` }) : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderCarePlansTrashTable(tbody, rows, permissions, query = "") {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(6, "Nenhum plano inativo encontrado.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.id}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.escapeHtml(formatCarePlanDate(row.start_date))}</td>
      <td>${SISELO.escapeHtml(formatCarePlanDate(row.end_date))}</td>
      <td>${SISELO.escapeHtml(row.deleted_at || "")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("restore", "Restaurar plano", { "data-restore-id": row.id })}
          ${permissions.has("careplans.delete")
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

function bindCarePlanListActions(tbody) {
  tbody.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (
        !(await SISELO.confirmDeletion(
          "o plano de cuidado",
          button.dataset.deleteLabel,
        ))
      )
        return;

      try {
        await SISELO.apiRequest("/care_plans/soft_delete.php", {
          method: "POST",
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o plano.",
        );
      }
    });
  });
}

function filterCarePlanRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesName = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.full_name, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.cpf, search)
      : true;

    return matchesName && matchesDigits;
  });
}

function bindCarePlanTrashActions(tbody) {
  tbody.querySelectorAll("[data-restore-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await SISELO.apiRequest("/care_plans/restore.php", {
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
          "o plano de cuidado de",
          button.dataset.destroyLabel,
        ))
      ) {
        return;
      }

      try {
        await SISELO.apiRequest("/care_plans/destroy.php", {
          method: "POST",
          body: { id: Number(button.dataset.destroyId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o plano permanentemente.",
        );
      }
    });
  });
}

function getEmptyCarePlanContext(patientId) {
  return {
    editing: false,
    plan: {
      patient_id: patientId || "",
      start_date: "",
      end_date: "",
      interventions: "",
    },
    items: [],
    patients: [],
  };
}

function addCarePlanItem(item) {
  const itemsContainer = document.getElementById("items");
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.style.marginTop = "12px";
  wrapper.innerHTML = `
    <div class="form-grid">
      <div class="field">
        <label>Tipo</label>
        <select name="item_type[]">
          <option value="alerta" ${item.item_type === "alerta" ? "selected" : ""}>Alerta</option>
          <option value="meta" ${item.item_type === "meta" ? "selected" : ""}>Meta</option>
          <option value="dificuldade" ${item.item_type === "dificuldade" ? "selected" : ""}>Dificuldade</option>
          <option value="recomendacao" ${item.item_type === "recomendacao" ? "selected" : ""}>Recomendação</option>
        </select>
      </div>
      <div class="field">
        <label>Título</label>
        <input name="title[]" value="${SISELO.escapeHtml(item.title || "")}">
      </div>
      <div class="field">
        <label>Ordem</label>
        <input name="sort_order[]" value="${SISELO.escapeHtml(item.sort_order || itemsContainer.children.length + 1)}">
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button type="button" class="btn" data-remove-item>Remover</button>
      </div>
      <div class="field-full">
        <label>Situação</label>
        <textarea name="situation[]">${SISELO.escapeHtml(item.situation || "")}</textarea>
      </div>
      <div class="field-full">
        <label>Recomendação</label>
        <textarea name="recommendation[]">${SISELO.escapeHtml(item.recommendation || "")}</textarea>
      </div>
      <div class="field-full">
        <label>Dificuldade</label>
        <textarea name="difficulty[]">${SISELO.escapeHtml(item.difficulty || "")}</textarea>
      </div>
      <div class="field-full">
        <label>Meta</label>
        <textarea name="goal[]">${SISELO.escapeHtml(item.goal || "")}</textarea>
      </div>
    </div>
  `;
  wrapper
    .querySelector("[data-remove-item]")
    .addEventListener("click", () => wrapper.remove());
  itemsContainer.appendChild(wrapper);
  SISELO.enhanceChoiceSelects(wrapper);
}

function fillPatientSelect(id, patients, currentValue) {
  const select = document.getElementById(id);
  select.innerHTML =
    '<option value="">Selecione um usuário</option>' +
    (patients || [])
      .map(
        (patient) => `
    <option value="${patient.id}" ${Number(currentValue || 0) === Number(patient.id) ? "selected" : ""}>
      ${SISELO.escapeHtml(patient.full_name)}
    </option>
  `,
      )
      .join("");
}

function objectFromFormData(formData) {
  const payload = {};
  formData.forEach((value, key) => {
    if (key.endsWith("[]")) {
      if (!payload[key.slice(0, -2)]) payload[key.slice(0, -2)] = [];
      payload[key.slice(0, -2)].push(value);
      return;
    }

    payload[key] = value;
  });
  return payload;
}

function configureCarePlanDateInputs() {
  const startInput = SISELO.enhanceDateInput("start_date", {
    min: "1900-01-01",
  });
  const endInput = SISELO.enhanceDateInput("end_date", {
    min: "1900-01-01",
  });
  SISELO.enhanceDateInput("aps_review_date", {
    min: "1900-01-01",
  });

  if (!startInput || !endInput) {
    return;
  }

  const baseMin = "1900-01-01";
  const syncCarePlanDates = () => {
    const apsInput = document.getElementById("aps_review_date");
    startInput.max = endInput.value || "";
    endInput.min =
      startInput.value && startInput.value > baseMin
        ? startInput.value
        : baseMin;
    if (apsInput instanceof HTMLInputElement) {
      apsInput.min = endInput.min;
      apsInput.max = endInput.max || "";
    }

    if (startInput.value) {
      startInput.value = SISELO.clampDateInputValue(
        startInput.value,
        baseMin,
        startInput.max,
      );
    }

    if (endInput.value) {
      endInput.value = SISELO.clampDateInputValue(
        endInput.value,
        endInput.min,
        "",
      );
    }

    SISELO.syncEnhancedDateInput(startInput);
    SISELO.syncEnhancedDateInput(endInput);
    if (apsInput instanceof HTMLInputElement) {
      SISELO.syncEnhancedDateInput(apsInput);
    }
  };

  startInput.addEventListener("change", syncCarePlanDates);
  endInput.addEventListener("change", syncCarePlanDates);
  syncCarePlanDates();
}

function bindCarePlanDateMirrors() {
  const endInput = document.getElementById("end_date");
  const apsInput = document.getElementById("aps_review_date");

  if (!(endInput instanceof HTMLInputElement) || !(apsInput instanceof HTMLInputElement)) {
    return;
  }

  apsInput.min = endInput.min || "1900-01-01";
  apsInput.max = endInput.max || "";

  endInput.addEventListener("change", () => {
    apsInput.value = endInput.value;
    SISELO.syncEnhancedDateInput(apsInput);
  });

  apsInput.addEventListener("change", () => {
    endInput.value = apsInput.value;
    SISELO.syncEnhancedDateInput(endInput);
  });
}
