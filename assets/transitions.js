const TRANSITION_SPECIALTIES = {
  endocrinologia: {
    key: "endocrinologia",
    label: "Endocrinologia",
    aliases: ["endocrinologia", "endocrino"],
    summaryClass: "is-endocrinologia",
    tagClass: "transition-specialty-tag-endocrinologia",
    defaultDestination: "CADH - Endocrinologia",
    hint: "Destino assistencial vinculado a Endocrinologia.",
  },
  cardiologia: {
    key: "cardiologia",
    label: "Cardiologia",
    aliases: ["cardiologia", "cardio"],
    summaryClass: "is-cardiologia",
    tagClass: "transition-specialty-tag-cardiologia",
    defaultDestination: "CADH - Cardiologia",
    hint: "Destino assistencial vinculado a Cardiologia.",
  },
};

const TRANSITION_PATIENT_DETAILS_CACHE = new Map();

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "transitions-list") setupTransitionsListPage();
  if (page === "transitions-form") setupTransitionFormPage();
  if (page === "transitions-trash") setupTransitionsTrashPage();
});

async function setupTransitionsListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("transitions");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  const newTransitionLink = document.getElementById("new-transition-link");
  const trashLink = document.getElementById("trash-link");
  const canCreateTransition = permissions.has("transitions.create");
  const newTransitionHref =
    "/cadh/index.html?flow=followup&view=transitions" +
    (patientId ? "&patient_id=" + encodeURIComponent(patientId) : "");
  const trashHref =
    "/transitions/trash.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  searchInput.value = query;
  newTransitionLink.hidden = !canCreateTransition;
  newTransitionLink.href = newTransitionHref;
  trashLink.hidden = !permissions.has("transitions.restore");
  trashLink.href = trashHref;

  const url =
    "/transitions/list.php" +
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

  const tbody = document.getElementById("transitions-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/cadh/index.html?flow=followup&view=transitions&patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    const filteredRows = filterTransitionRows(rows, value);
    newTransitionLink.hidden =
      !canCreateTransition || filteredRows.length === 0;
    renderTransitionsTable(
      tbody,
      filteredRows,
      permissions,
      value,
      newTransitionHref,
      patientId,
    );
    bindTransitionListActions(tbody);
    SISELO.syncSearchUrl(
      "/transitions/list.html",
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

async function setupTransitionFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("transitions");
  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  if (patientId) {
    location.replace(`/cadh/index.html?flow=followup&view=transitions&patient_id=${encodeURIComponent(patientId)}`);
    return;
  }
  SISELO.setFlashAlert(
    id
      ? "A transição concluída é consultada no histórico; selecione o paciente no fluxo CADH para novos registros."
      : "Selecione o paciente no fluxo CADH para registrar a transição de cuidado.",
    "info",
  );
  location.replace("/cadh/index.html?flow=followup&view=transitions");
  return;
  const endpointParams = new URLSearchParams();
  if (id) endpointParams.set("id", id);
  if (patientId) endpointParams.set("patient_id", patientId);
  const endpointQuery = endpointParams.toString();
  const endpoint =
    "/transitions/form.php" + (endpointQuery ? "?" + endpointQuery : "");
  const listHref =
    "/transitions/list.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  const returnHref = SISELO.resolveBackTarget(listHref);
  let data = getEmptyTransitionContext(patientId);
  let loadError = null;

  try {
    data = await SISELO.apiRequest(endpoint || "/transitions/form.php");
  } catch (error) {
    loadError = error;
  }

  if (id && (loadError || !data || !data.row)) {
    document.getElementById("form-title").textContent =
      "Editar Encaminhamento do Cuidado";
    SISELO.showAlert(
      "page-alert",
      loadError && loadError.message
        ? loadError.message
        : "Não foi possível carregar o encaminhamento selecionado.",
      "error",
    );
    disableTransitionForm();
    return;
  }

  const context =
    data && typeof data === "object"
      ? data
      : getEmptyTransitionContext(patientId);
  const row = context.row || getEmptyTransitionContext(patientId).row;
  const parsedDestination = parseTransitionDestination(row.to_service);
  let patientOptions = patientId
    ? SISELO.filterPatientsById(
        Array.isArray(context.patients) ? context.patients : [],
        patientId,
      )
    : Array.isArray(context.patients)
      ? context.patients
      : [];

  if (row.patient_id) {
    const selectedPatient = await ensureTransitionPatientOption(
      patientOptions,
      row.patient_id,
    );
    patientOptions = mergeTransitionPatients(
      patientOptions,
      selectedPatient ? [selectedPatient] : [],
    );
  }

  document.getElementById("form-title").textContent =
    id || context.editing
      ? "Editar Encaminhamento do Cuidado"
      : "Novo Encaminhamento do Cuidado";

  fillTransitionStatusSelect(
    Array.isArray(context.statuses) && context.statuses.length
      ? context.statuses
      : getDefaultTransitionStatuses(),
    row.status,
  );

  document.getElementById("transition_date").value =
    row.transition_date || SISELO.todayDateInputValue();
  document.getElementById("from_service").value = row.from_service || "";
  document.getElementById("to_service").value =
    parsedDestination.displayValue || "";
  document.getElementById("notes").value = row.notes || "";
  configureTransitionDateInput();

  let selectedSpecialtyKey =
    parsedDestination.specialtyKey || inferTransitionSpecialty(row);
  setTransitionSpecialtySelection(selectedSpecialtyKey);

  const patientPicker = SISELO.setupPatientFieldPicker({
    select: "patient_id",
    container: "transition-patient-search",
    rows: patientOptions,
    currentValue: row.patient_id,
    locked: Boolean(patientId),
    placeholder: "Digite o nome do usuário cadastrado...",
  });

  document.querySelectorAll("[data-specialty-option]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSpecialtyKey = button.dataset.specialtyOption || "";
      setTransitionSpecialtySelection(selectedSpecialtyKey);
      SISELO.showAlert("page-alert", "", "info");
    });
  });

  const form = document.getElementById("transition-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedPatientId = patientPicker.getValue();

    if (!SISELO.validateEnhancedDateInputs(form, { alertId: "page-alert" })) {
      return;
    }

    if (!getTransitionSpecialtyMeta(selectedSpecialtyKey)) {
      markTransitionSpecialtyInvalid();
      SISELO.showAlert(
        "page-alert",
        "Selecione a especialidade antes de salvar o encaminhamento.",
        "error",
      );
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    if (selectedPatientId) {
      payload.patient_id = selectedPatientId;
    }
    payload.to_service = composeTransitionDestination(
      payload.to_service,
      selectedSpecialtyKey,
    );

    try {
      const result = await SISELO.apiRequest(
        endpoint || "/transitions/form.php",
        {
          method: "POST",
          body: payload,
        },
      );
      const savedPatientId = SISELO.normalizeEntityId(
        (result && result.row && result.row.patient_id) ||
          payload.patient_id ||
          patientId,
      );
      await SISELO.refreshCachedPatientContext(savedPatientId);
      location.href = returnHref;
    } catch (error) {
      SISELO.showAlert("page-alert", error.message, "error");
    }
  });
}

async function setupTransitionsTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("transitions");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  searchInput.value = query;

  let rows = [];
  const url =
    "/transitions/trash.php" +
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

  const tbody = document.getElementById("transitions-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/transitions/trash.html?patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    renderTransitionsTrashTable(
      tbody,
      filterTransitionRows(rows, value),
      permissions,
      value,
    );
    bindTransitionTrashActions(tbody);
    SISELO.syncSearchUrl(
      "/transitions/trash.html",
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

function renderTransitionsTable(
  tbody,
  rows,
  permissions,
  query = "",
  newTransitionHref = "/transitions/form.html",
  scopedPatientId = "",
) {
  const safeRows = uniqueTransitionRows(rows);
  if (!Array.isArray(safeRows) || safeRows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      7,
      "Nenhum encaminhamento encontrado.",
      permissions.has("transitions.create")
        ? { label: "+ Novo encaminhamento", href: newTransitionHref }
        : null,
    );
    return;
  }

  tbody.innerHTML = safeRows
    .map(
      (row) => `
    <tr>
      <td>${renderTransitionCellDate(row.transition_date)}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.renderTeamBadge(row.team_ref)}</td>
      <td>${renderTransitionCellValue(row.cpf)}</td>
      <td>${renderTransitionRoute(row)}</td>
      <td>${renderTransitionStatusBadge(row.status)}</td>
      <td>
        <div class="table-actions">
          ${renderTransitionViewAction(row)}
          ${renderTransitionEditAction(row, permissions, scopedPatientId)}
          ${renderTransitionDeleteAction(row, permissions)}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderTransitionsTrashTable(tbody, rows, permissions, query = "") {
  const safeRows = uniqueTransitionRows(rows);
  if (!Array.isArray(safeRows) || safeRows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(8, "Nenhum encaminhamento inativo encontrado.");
    return;
  }

  tbody.innerHTML = safeRows
    .map(
      (row) => `
    <tr>
      <td>${renderTransitionCellDateTime(row.deleted_at)}</td>
      <td>${renderTransitionCellDate(row.transition_date)}</td>
      <td><span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span></td>
      <td>${SISELO.renderTeamBadge(row.team_ref)}</td>
      <td>${renderTransitionCellValue(row.cpf)}</td>
      <td>${renderTransitionRoute(row)}</td>
      <td>${renderTransitionStatusBadge(row.status)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("restore", "Restaurar encaminhamento", { "data-restore-id": row.id })}
          ${permissions.has("transitions.delete")
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

function renderTransitionCellValue(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue
    ? SISELO.escapeHtml(normalizedValue)
    : '<span class="muted">-</span>';
}

function renderTransitionCellDate(value) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return '<span class="muted">-</span>';
  }

  const parsedDate = SISELO.parseDateInputValue(normalizedValue);
  if (!parsedDate) {
    return SISELO.escapeHtml(normalizedValue);
  }

  return SISELO.escapeHtml(new Intl.DateTimeFormat("pt-BR").format(parsedDate));
}

function renderTransitionCellDateTime(value) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return '<span class="muted">-</span>';
  }

  const parsedDate = new Date(normalizedValue.replace(" ", "T"));
  if (Number.isNaN(parsedDate.getTime())) {
    return SISELO.escapeHtml(normalizedValue);
  }

  return `<span class="transition-date-time">${SISELO.escapeHtml(
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsedDate).replace(",", "")
  )}</span>`;
}

function renderTransitionRoute(row) {
  const origin = String(row.from_service || "").trim();
  const parsedDestination = parseTransitionDestination(row.to_service);
  const destination = parsedDestination.displayValue || "";

  if (!origin && !destination && !parsedDestination.specialtyKey) {
    return '<span class="muted">-</span>';
  }

  const specialtyTag = parsedDestination.specialtyKey
    ? renderTransitionSpecialtyTag(parsedDestination.specialtyKey)
    : "";
  const hasOrigin = Boolean(origin);
  const hasDestination = Boolean(destination || parsedDestination.specialtyKey);
  const routeMain = hasOrigin && hasDestination
    ? `
      <span class="transition-route-main">
        <span class="transition-route-service">${SISELO.escapeHtml(origin)}</span>
        <span class="transition-route-arrow" aria-hidden="true">&rarr;</span>
        <span class="transition-route-service">${SISELO.escapeHtml(destination || "CADH")}</span>
      </span>
    `
    : `
      <span class="transition-route-main">
        <span class="transition-route-service">${SISELO.escapeHtml(origin || destination || "CADH")}</span>
      </span>
    `;

  return `
    <span class="transition-route">
      ${routeMain}
      ${specialtyTag}
    </span>
  `;
}

function uniqueTransitionRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const seen = new Set();

  return safeRows.filter((row) => {
    const key = String(row && row.id ? row.id : "");
    if (!key) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renderTransitionSpecialtyTag(specialtyKey) {
  const specialty = getTransitionSpecialtyMeta(specialtyKey);
  if (!specialty) {
    return "";
  }

  return `<span class="transition-specialty-tag ${specialty.tagClass}">${SISELO.escapeHtml(specialty.label)}</span>`;
}

function renderTransitionStatusBadge(status) {
  const config = getTransitionStatusConfig(status);
  return `<span class="status-badge status-badge-${config.kind}">${SISELO.escapeHtml(config.label)}</span>`;
}

function renderTransitionViewAction(row) {
  return SISELO.iconLink(
    "view",
    `/patients/show.html?id=${row.patient_id}&tab=transicoes`,
    "Usuário 360",
  );
}

function renderTransitionEditAction(row, permissions, scopedPatientId = "") {
  if (!permissions.has("transitions.update")) {
    return "";
  }

  const id = SISELO.normalizeEntityId(row && row.id);
  if (!id) {
    return "";
  }

  return SISELO.iconLink(
    "edit",
    `/transitions/form.html?id=${encodeURIComponent(id)}${scopedPatientId ? `&patient_id=${encodeURIComponent(scopedPatientId)}` : ""}`,
    "Editar encaminhamento",
  );
}

function renderTransitionDeleteAction(row, permissions) {
  if (!permissions.has("transitions.delete")) {
    return "";
  }

  return SISELO.iconButton("delete", "Inativar encaminhamento", {
    "data-delete-id": row.id,
    "data-delete-label": row.full_name || "",
  });
}

function getTransitionStatusConfig(status) {
  const rawStatus = String(status || "").trim();
  const normalizedStatus = rawStatus
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["concluida", "concluido"].includes(normalizedStatus)) {
    return { kind: "done", label: "Concluído" };
  }

  if (["em_andamento", "andamento"].includes(normalizedStatus)) {
    return { kind: "progress", label: "Em andamento" };
  }

  if (normalizedStatus === "pendente") {
    return { kind: "pending", label: "Pendente" };
  }

  if (["cancelada", "cancelado"].includes(normalizedStatus)) {
    return { kind: "canceled", label: "Cancelada" };
  }

  return { kind: "neutral", label: rawStatus || "-" };
}

function getTransitionStatusPalette(status) {
  const config = getTransitionStatusConfig(status);
  const palettes = {
    done: {
      borderColor: "#bbf7d0",
      backgroundColor: "#ecfdf5",
      textColor: "#166534",
    },
    progress: {
      borderColor: "#bae6fd",
      backgroundColor: "#e0f2fe",
      textColor: "#075985",
    },
    pending: {
      borderColor: "#fde68a",
      backgroundColor: "#fef3c7",
      textColor: "#92400e",
    },
    canceled: {
      borderColor: "#fecaca",
      backgroundColor: "#fee2e2",
      textColor: "#991b1b",
    },
    neutral: {
      borderColor: "#d8e2e8",
      backgroundColor: "#f8fafc",
      textColor: "#516271",
    },
  };

  return {
    ...config,
    ...(palettes[config.kind] || palettes.neutral),
  };
}

function bindTransitionListActions(tbody) {
  tbody.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (
        !(await SISELO.confirmDeletion(
          "o encaminhamento de",
          button.dataset.deleteLabel,
        ))
      )
        return;

      try {
        await SISELO.apiRequest("/transitions/soft_delete.php", {
          method: "POST",
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o encaminhamento.",
        );
      }
    });
  });
}

function bindTransitionTrashActions(tbody) {
  tbody.querySelectorAll("[data-restore-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await SISELO.apiRequest("/transitions/restore.php", {
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
          "o encaminhamento de",
          button.dataset.destroyLabel,
        ))
      ) {
        return;
      }

      try {
        await SISELO.apiRequest("/transitions/destroy.php", {
          method: "POST",
          body: { id: Number(button.dataset.destroyId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o encaminhamento permanentemente.",
        );
      }
    });
  });
}

function filterTransitionRows(rows, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesLetters = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(row.full_name, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.cpf, search)
      : true;

    return matchesLetters && matchesDigits;
  });
}

function getEmptyTransitionContext(patientId) {
  return {
    editing: false,
    row: {
      patient_id: patientId || "",
      transition_date: SISELO.todayDateInputValue(),
      from_service: "",
      to_service: "",
      status: "pendente",
      notes: "",
    },
    patients: [],
    statuses: getDefaultTransitionStatuses(),
  };
}

function getDefaultTransitionStatuses() {
  return ["pendente", "em_andamento", "concluida", "cancelada"];
}

function disableTransitionForm() {
  const form = document.getElementById("transition-form");
  if (!form) {
    return;
  }

  form.querySelectorAll("input, select, textarea, button").forEach((field) => {
    field.disabled = true;
  });
}

function fillTransitionPatientSelect(patients, currentValue) {
  const select = document.getElementById("patient_id");
  if (!select) {
    return;
  }

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

function fillTransitionStatusSelect(statuses, currentValue) {
  const select = document.getElementById("status");
  if (!select) {
    return;
  }

  select.innerHTML = (statuses || [])
    .map((status) => {
      const palette = getTransitionStatusPalette(status);
      return `
    <option
      value="${SISELO.escapeHtml(status)}"
      class="status-option status-option-${palette.kind}"
      style="color:${palette.textColor};"
      ${String(currentValue || "") === String(status) ? "selected" : ""}
    >${SISELO.escapeHtml(palette.label)}</option>
  `;
    })
    .join("");

  syncTransitionStatusAppearance(select);
  SISELO.enhanceChoiceSelects(document);
  if (select.dataset.statusAppearanceBound !== "true") {
    select.dataset.statusAppearanceBound = "true";
    select.addEventListener("change", () => syncTransitionStatusAppearance(select));
  }
}

function syncTransitionStatusAppearance(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const config = getTransitionStatusConfig(select.value);
  const shell = document.getElementById("transition-status-shell");
  const pill = document.getElementById("transition-status-pill");
  select.classList.remove(
    "status-select-done",
    "status-select-progress",
    "status-select-pending",
    "status-select-canceled",
    "status-select-neutral",
  );
  select.classList.add("status-select", `status-select-${config.kind}`);

  if (shell) {
    shell.classList.remove(
      "status-select-shell-done",
      "status-select-shell-progress",
      "status-select-shell-pending",
      "status-select-shell-canceled",
      "status-select-shell-neutral",
    );
    shell.classList.add("status-select-shell", `status-select-shell-${config.kind}`);
  }

  if (pill) {
    pill.textContent = config.label;
    pill.classList.remove(
      "status-select-pill-done",
      "status-select-pill-progress",
      "status-select-pill-pending",
      "status-select-pill-canceled",
      "status-select-pill-neutral",
    );
    pill.classList.add("status-select-pill", `status-select-pill-${config.kind}`);
  }
}

function configureTransitionDateInput() {
  const today = SISELO.todayDateInputValue();
  const input = SISELO.enhanceDateInput("transition_date", {
    min: "1900-01-01",
    max: today,
  });

  if (input && input.value) {
    input.value = SISELO.clampDateInputValue(input.value, input.min, input.max);
    SISELO.syncEnhancedDateInput(input);
  }
}

function getTransitionSpecialtyMeta(key) {
  return (
    TRANSITION_SPECIALTIES[
      String(key || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

function normalizeTransitionText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferTransitionSpecialty(row) {
  const candidates = [
    row && row.to_service,
    row && row.from_service,
    row && row.notes,
  ];

  return candidates.map(detectTransitionSpecialty).find(Boolean) || "";
}

function detectTransitionSpecialty(value) {
  const normalized = normalizeTransitionText(value);
  if (!normalized) {
    return "";
  }

  if (normalized.includes("endocrino")) {
    return "endocrinologia";
  }

  if (normalized.includes("cardio")) {
    return "cardiologia";
  }

  return "";
}

function parseTransitionDestination(value) {
  const rawValue = String(value || "").trim();
  const specialtyKey = detectTransitionSpecialty(rawValue);

  if (!rawValue) {
    return { displayValue: "", specialtyKey: "" };
  }

  if (!specialtyKey) {
    return { displayValue: rawValue, specialtyKey: "" };
  }

  const cleanedValue = stripTransitionSpecialty(rawValue);
  return {
    displayValue: cleanedValue || "CADH",
    specialtyKey,
  };
}

function stripTransitionSpecialty(value) {
  let cleanedValue = String(value || "").trim();

  Object.values(TRANSITION_SPECIALTIES).forEach((specialty) => {
    specialty.aliases.forEach((alias) => {
      cleanedValue = cleanedValue.replace(
        new RegExp(`(?:\\s*[-|/>]\\s*)?${escapeRegExp(alias)}\\s*$`, "i"),
        "",
      );
    });
  });

  return cleanedValue.replace(/[\s\-|/:;>]+$/g, "").trim();
}

function composeTransitionDestination(value, specialtyKey) {
  const specialty = getTransitionSpecialtyMeta(specialtyKey);
  if (!specialty) {
    return String(value || "").trim();
  }

  const baseValue = stripTransitionSpecialty(value);
  if (!baseValue) {
    return specialty.defaultDestination;
  }

  if (/^cadh$/i.test(baseValue)) {
    return specialty.defaultDestination;
  }

  return `${baseValue} - ${specialty.label}`;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setTransitionSpecialtySelection(specialtyKey) {
  const picker = document.getElementById("transition-specialty-picker");
  const summary = document.getElementById("transition-specialty-summary");
  const summaryLabel = document.getElementById(
    "transition-specialty-summary-label",
  );
  const hint = document.getElementById("transition-specialty-hint");
  const specialty = getTransitionSpecialtyMeta(specialtyKey);

  document.querySelectorAll("[data-specialty-option]").forEach((button) => {
    const isSelected = button.dataset.specialtyOption === specialtyKey;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
  });

  document.querySelectorAll("[data-specialty-mark]").forEach((element) => {
    element.textContent =
      element.dataset.specialtyMark === specialtyKey ? "OK" : "+";
  });

  if (picker) {
    picker.classList.remove("is-invalid");
  }

  if (!summary || !summaryLabel || !hint) {
    return;
  }

  if (!specialty) {
    summary.hidden = true;
    summary.className = "transition-specialty-summary";
    summaryLabel.className = "transition-specialty-summary-label";
    summaryLabel.textContent = "";
    hint.hidden = true;
    hint.textContent = "";
    return;
  }

  summary.hidden = false;
  summary.className = `transition-specialty-summary ${specialty.summaryClass}`;
  summaryLabel.className = `transition-specialty-summary-label ${specialty.summaryClass}`;
  summaryLabel.textContent = specialty.label;
  hint.hidden = true;
  hint.textContent = specialty.hint;
}

function markTransitionSpecialtyInvalid() {
  const picker = document.getElementById("transition-specialty-picker");
  const hint = document.getElementById("transition-specialty-hint");
  if (picker) {
    picker.classList.add("is-invalid");
  }
  if (hint) {
    hint.hidden = false;
    hint.textContent = "Selecione a especialidade para continuar.";
  }
}

function createTransitionPatientPicker(options = {}) {
  const select = document.getElementById("patient_id");
  const container = document.getElementById("transition-patient-search");
  const locked = options.locked === true;
  const onChange =
    typeof options.onChange === "function" ? options.onChange : () => {};
  let patients = mergeTransitionPatients(options.patients, []);
  let selectedId = SISELO.normalizeEntityId(options.currentValue);
  let visiblePatients = [];
  let activeIndex = -1;
  let searchTimer = 0;
  let searchToken = 0;

  if (!select || !container) {
    return {
      getValue: () => selectedId,
      focus: () => {},
    };
  }

  container.innerHTML = `
    <input
      id="patient-search-input"
      type="text"
      autocomplete="off"
      data-search-input="true"
      placeholder="Digite o nome do paciente cadastrado..."
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="false"
      aria-controls="transition-patient-results"
    >
    <div id="transition-patient-results" class="transition-patient-results" role="listbox" hidden></div>
  `;

  const input = document.getElementById("patient-search-input");
  const results = document.getElementById("transition-patient-results");
  SISELO.decorateSearchInputs(container);

  if (locked) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
  }

  function getSelectedPatient() {
    return patients.find((patient) => patient.id === selectedId) || null;
  }

  function syncSelectOptions() {
    fillTransitionPatientSelect(patients, selectedId);
  }

  function updateExpandedState() {
    input.setAttribute("aria-expanded", String(!results.hidden));
  }

  function closeResults() {
    results.hidden = true;
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    updateExpandedState();
  }

  function renderResults(query = "") {
    const trimmedQuery = String(query || "").trim();

    if (trimmedQuery) {
      visiblePatients = filterTransitionPatients(patients, trimmedQuery).slice(
        0,
        12,
      );
    } else {
      visiblePatients = patients.slice(0, 8);
    }

    if (!visiblePatients.length) {
      results.innerHTML =
        '<div class="transition-patient-empty">Nenhum usuário localizado com esse critério de busca.</div>';
      results.hidden = false;
      updateExpandedState();
      return;
    }

    if (activeIndex >= visiblePatients.length) {
      activeIndex = visiblePatients.length - 1;
    }

    results.innerHTML = visiblePatients
      .map(
        (patient, index) => `
      <button
        type="button"
        id="transition-patient-option-${patient.id}"
        class="transition-patient-option${index === activeIndex ? " is-active" : ""}"
        role="option"
        aria-selected="${patient.id === selectedId ? "true" : "false"}"
        data-patient-option="${patient.id}"
      >
        <span class="transition-patient-option-name">${SISELO.highlightPersonName(patient.full_name, trimmedQuery, SISELO.escapeHtml(patient.full_name || "-"))}</span>
        <span class="transition-patient-option-meta">CPF: ${SISELO.escapeHtml(patient.cpf || "-")} | Equipe: ${SISELO.escapeHtml(SISELO.formatTeamName(patient.team_ref))}</span>
      </button>
    `,
      )
      .join("");

    results.hidden = false;
    updateExpandedState();

    results.querySelectorAll("[data-patient-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const patient = visiblePatients.find(
          (item) => item.id === button.dataset.patientOption,
        );
        selectPatient(patient || null);
      });
    });

    if (activeIndex >= 0 && visiblePatients[activeIndex]) {
      input.setAttribute(
        "aria-activedescendant",
        `transition-patient-option-${visiblePatients[activeIndex].id}`,
      );
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function setPatients(nextPatients) {
    patients = mergeTransitionPatients(patients, nextPatients);
    syncSelectOptions();
  }

  function selectPatient(patient) {
    searchToken += 1;
    window.clearTimeout(searchTimer);

    if (!patient) {
      selectedId = "";
      syncSelectOptions();
      onChange(null);
      return;
    }

    selectedId = patient.id;
    input.value = patient.full_name || "";
    syncSelectOptions();
    closeResults();
    onChange(patient);
  }

  async function searchPatientsRemotely(query) {
    const trimmedQuery = String(query || "").trim();
    if (locked || trimmedQuery.length < 2) {
      return;
    }

    const currentToken = ++searchToken;
    try {
      const data = await SISELO.apiRequest(
        "/patients/list.php?q=" + encodeURIComponent(trimmedQuery),
      );
      if (currentToken !== searchToken) {
        return;
      }

      setPatients(Array.isArray(data.rows) ? data.rows : []);
      renderResults(trimmedQuery);
    } catch (error) {
      if (currentToken !== searchToken) {
        return;
      }

      renderResults(trimmedQuery);
    }
  }

  input.addEventListener("focus", () => {
    if (!locked) {
      renderResults(input.value);
    }
  });

  input.addEventListener("input", () => {
    const query = input.value;
    if (!locked) {
      const selectedPatient = getSelectedPatient();
      if (
        !selectedPatient ||
        query.trim() !== String(selectedPatient.full_name || "").trim()
      ) {
        selectedId = "";
        syncSelectOptions();
        onChange(null);
      }
    }

    renderResults(query);
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchPatientsRemotely(query);
    }, 180);
  });

  input.addEventListener("keydown", (event) => {
    if (locked) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.hidden) {
        renderResults(input.value);
      }
      activeIndex = visiblePatients.length
        ? Math.min(activeIndex + 1, visiblePatients.length - 1)
        : -1;
      renderResults(input.value);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.hidden) {
        renderResults(input.value);
      }
      activeIndex = visiblePatients.length ? Math.max(activeIndex - 1, 0) : -1;
      renderResults(input.value);
      return;
    }

    if (
      event.key === "Enter" &&
      !results.hidden &&
      activeIndex >= 0 &&
      visiblePatients[activeIndex]
    ) {
      event.preventDefault();
      selectPatient(visiblePatients[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      closeResults();
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!container.contains(event.target)) {
      closeResults();
    }
  });

  syncSelectOptions();

  const initiallySelectedPatient = getSelectedPatient();
  input.value = initiallySelectedPatient
    ? initiallySelectedPatient.full_name || ""
    : "";
  if (initiallySelectedPatient) {
    onChange(initiallySelectedPatient);
  }

  return {
    getValue: () => selectedId,
    focus: () => input.focus(),
    addPatients: setPatients,
  };
}

function filterTransitionPatients(patients, query) {
  const search = SISELO.createSearchState(query);
  if (!search.hasLetters && !search.hasDigits) {
    return Array.isArray(patients) ? patients : [];
  }

  return (Array.isArray(patients) ? patients : []).filter((patient) => {
    const matchesLetters = search.hasLetters
      ? SISELO.matchesPersonNamePrefix(patient.full_name, search) ||
        SISELO.matchesSearchText(patient.team_ref, search)
      : true;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(patient.cpf, search)
      : true;

    return matchesLetters && matchesDigits;
  });
}

function mergeTransitionPatients(currentPatients, nextPatients) {
  const merged = new Map();

  [
    ...(Array.isArray(currentPatients) ? currentPatients : []),
    ...(Array.isArray(nextPatients) ? nextPatients : []),
  ]
    .map(normalizeTransitionPatient)
    .filter((patient) => patient.id)
    .forEach((patient) => {
      merged.set(patient.id, {
        ...(merged.get(patient.id) || {}),
        ...patient,
      });
    });

  return Array.from(merged.values()).sort((left, right) =>
    String(left.full_name || "").localeCompare(
      String(right.full_name || ""),
      "pt-BR",
      { sensitivity: "base" },
    ),
  );
}

function normalizeTransitionPatient(patient) {
  return {
    id: SISELO.normalizeEntityId(patient && patient.id),
    full_name: String((patient && patient.full_name) || "").trim(),
    cpf: String((patient && patient.cpf) || "").trim(),
    team_ref: String((patient && patient.team_ref) || "").trim(),
    birth_date: String((patient && patient.birth_date) || "").trim(),
    first_cadh_date: String((patient && patient.first_cadh_date) || "").trim(),
  };
}

async function ensureTransitionPatientOption(patients, patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  if (!normalizedId) {
    return null;
  }

  const existing = mergeTransitionPatients(patients, []).find(
    (patient) => patient.id === normalizedId,
  );
  if (existing) {
    return existing;
  }

  return loadTransitionPatientDetails(normalizedId);
}

async function loadTransitionPatientDetails(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  if (!normalizedId) {
    return null;
  }

  if (TRANSITION_PATIENT_DETAILS_CACHE.has(normalizedId)) {
    return TRANSITION_PATIENT_DETAILS_CACHE.get(normalizedId);
  }

  try {
    const context = await SISELO.loadPatientClinicalContext(normalizedId);
    const patient = normalizeTransitionPatient(
      context && context.patient ? context.patient : null,
    );
    if (!patient.id) {
      return null;
    }

    TRANSITION_PATIENT_DETAILS_CACHE.set(normalizedId, patient);
    return patient;
  } catch (error) {
    return null;
  }
}

function renderTransitionPatientSnapshot(patient) {
  const snapshot = normalizeTransitionPatient(patient);

  const teamField = document.getElementById("patient_team_ref");
  if (teamField) {
    teamField.value = SISELO.formatTeamName(snapshot.team_ref);
  }
  document.getElementById("patient_cpf").value = snapshot.cpf || "";
  document.getElementById("patient_birth_date").value =
    formatTransitionDisplayDate(snapshot.birth_date);
  document.getElementById("patient_first_cadh_date").value =
    formatTransitionDisplayDate(snapshot.first_cadh_date);
}

function formatTransitionDisplayDate(value) {
  const parsedDate = SISELO.parseDateInputValue(value);
  if (!parsedDate) {
    return value || "";
  }

  return new Intl.DateTimeFormat("pt-BR").format(parsedDate);
}
