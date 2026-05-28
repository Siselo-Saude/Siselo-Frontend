document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "encounters-list") setupEncountersListPage();
  if (page === "encounters-form") setupEncounterFormPage();
  if (page === "encounters-trash") setupEncountersTrashPage();
});

async function setupEncountersListPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("encounters");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  const newEncounterLink = document.getElementById("new-encounter-link");
  const trashLink = document.getElementById("trash-link");
  const canCreateEncounter = permissions.has("encounters.create");
  const newEncounterHref =
    "/encounters/form.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  const trashHref =
    "/encounters/trash.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  searchInput.value = query;
  newEncounterLink.hidden = !canCreateEncounter;
  newEncounterLink.href = newEncounterHref;
  trashLink.hidden = !permissions.has("encounters.restore");
  trashLink.href = trashHref;

  const url =
    "/encounters/list.php" +
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

  const tbody = document.getElementById("encounters-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/encounters/form.html?patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    const filteredRows = filterEncounterRows(rows, value);
    newEncounterLink.hidden = !canCreateEncounter || filteredRows.length === 0;
    renderEncountersTable(
      tbody,
      filteredRows,
      permissions,
      value,
      newEncounterHref,
      patientId,
    );
    bindEncounterListActions(tbody);
    SISELO.syncSearchUrl(
      "/encounters/list.html",
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

async function setupEncounterFormPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("encounters");
  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const endpointParams = new URLSearchParams();
  if (id) endpointParams.set("id", id);
  if (patientId) endpointParams.set("patient_id", patientId);
  const endpointQuery = endpointParams.toString();
  const endpoint =
    "/encounters/form.php" + (endpointQuery ? "?" + endpointQuery : "");
  const listHref =
    "/encounters/list.html" +
    (patientId ? "?patient_id=" + encodeURIComponent(patientId) : "");
  const returnHref = SISELO.resolveBackTarget(listHref);
  let data = getEmptyEncounterContext(patientId);

  try {
    data = await SISELO.apiRequest(endpoint || "/encounters/form.php");
  } catch (error) {}

  const row = data.row || getEmptyEncounterContext(patientId).row;
  const patientOptions = patientId
    ? SISELO.filterPatientsById(
        Array.isArray(data.patients) ? data.patients : [],
        patientId,
      )
    : Array.isArray(data.patients)
      ? data.patients
      : [];
  document.getElementById("form-title").textContent = data.editing
    ? "Editar Atendimento"
    : "Novo Atendimento";
  const syncEncounterTeamDisplay = (patient) => {
    const display = document.getElementById("encounter-team-display");
    if (!(display instanceof HTMLElement)) {
      return;
    }

    const teamValue = patient && patient.team_ref ? patient.team_ref : "";
    display.classList.toggle("is-empty", !teamValue);
    display.innerHTML = teamValue
      ? SISELO.renderTeamBadge(teamValue)
      : "Selecione um usuário para ver a equipe";
  };
  const patientPicker = SISELO.setupPatientFieldPicker({
    select: "patient_id",
    container: "encounter-user-search",
    rows: patientOptions,
    currentValue: row.patient_id,
    locked: Boolean(patientId),
    placeholder: "Digite o nome do usuário cadastrado...",
    onChange: syncEncounterTeamDisplay,
  });
  syncEncounterTeamDisplay(patientOptions.find((patient) => String(patient.id) === String(row.patient_id)) || null);
  document.getElementById("encounter_date").value = row.encounter_date || "";
  document.getElementById("specialty").value = row.specialty || "";
  document.getElementById("summary").value = row.summary || "";
  configureEncounterDateInput();

  document
    .getElementById("encounter-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

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
        const result = await SISELO.apiRequest(
          endpoint || "/encounters/form.php",
          {
            method: "POST",
            body: Object.fromEntries(formData.entries()),
          },
        );
        const savedPatientId = SISELO.normalizeEntityId(
          (result && result.row && result.row.patient_id) ||
            selectedUserId ||
            formData.get("patient_id") ||
            patientId,
        );
        await SISELO.refreshCachedPatientContext(savedPatientId);
        location.href = returnHref;
      } catch (error) {
        SISELO.showAlert("page-alert", error.message, "error");
      }
    });
}

async function setupEncountersTrashPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  const permissions = SISELO.getUiPermissions(user);
  SISELO.bindShell("encounters");
  const query = SISELO.queryParam("q") || "";
  const patientId = SISELO.normalizeEntityId(SISELO.queryParam("patient_id"));
  const searchInput = document.getElementById("search-input");
  const searchForm = document.getElementById("search-form");
  searchInput.value = query;

  let rows = [];

  const url =
    "/encounters/trash.php" +
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

  const tbody = document.getElementById("encounters-table-body");
  SISELO.setupPatientSearchAutocomplete(searchInput, {
    rows,
    onPick: (patient) => {
      location.href = `/encounters/trash.html?patient_id=${encodeURIComponent(patient.id)}`;
    },
  });
  const applySearch = (value) => {
    renderEncountersTrashTable(
      tbody,
      filterEncounterRows(rows, value),
      permissions,
      value,
    );
    bindEncounterTrashActions(tbody);
    SISELO.syncSearchUrl(
      "/encounters/trash.html",
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

function renderEncountersTable(
  tbody,
  rows,
  permissions,
  query = "",
  newEncounterHref = "/encounters/form.html",
  scopedPatientId = "",
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(
      5,
      "Nenhum atendimento encontrado.",
      permissions.has("encounters.create")
        ? { label: "+ Novo atendimento", href: newEncounterHref }
        : null,
    );
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${renderEncounterIdentityCell(row, query)}</td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>${SISELO.escapeHtml(row.summary || "")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink("view", `/patients/show.html?id=${row.patient_id}&tab=atendimentos`, "Usuário 360")}
          ${permissions.has("encounters.update") ? SISELO.iconLink("edit", `/encounters/form.html?id=${encodeURIComponent(row.id)}${scopedPatientId ? `&patient_id=${encodeURIComponent(scopedPatientId)}` : ""}`, "Editar atendimento") : ""}
          ${permissions.has("encounters.delete") ? SISELO.iconButton("delete", "Inativar atendimento", { "data-delete-id": row.id, "data-delete-label": row.full_name || "" }) : ""}
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderEncountersTrashTable(tbody, rows, permissions, query = "") {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(5, "Nenhum atendimento inativo encontrado.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.escapeHtml(row.deleted_at || "")}</td>
      <td>${SISELO.escapeHtml(row.encounter_date)}</td>
      <td>${renderEncounterIdentityCell(row, query)}</td>
      <td>${SISELO.escapeHtml(row.specialty)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("restore", "Restaurar atendimento", { "data-restore-id": row.id })}
          ${permissions.has("encounters.delete")
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

function renderEncounterIdentityCell(row, query = "") {
  return `
    <div class="table-identity">
      <span class="patient-name">${SISELO.highlightPersonName(row.full_name, query)}</span>
      <div class="table-identity-meta">
        <span class="table-identity-line">
          <span class="table-identity-label">CPF</span>
          <span class="table-identity-value">${SISELO.escapeHtml(row.cpf)}</span>
        </span>
        <span class="table-identity-line">
          <span class="table-identity-label">Equipe</span>
          <span class="table-identity-value table-identity-team">${SISELO.renderTeamBadge(row.team_ref)}</span>
        </span>
      </div>
    </div>
  `;
}

function bindEncounterListActions(tbody) {
  tbody.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (
        !(await SISELO.confirmDeletion(
          "o atendimento de",
          button.dataset.deleteLabel,
        ))
      )
        return;

      try {
        await SISELO.apiRequest("/encounters/soft_delete.php", {
          method: "POST",
          body: { id: Number(button.dataset.deleteId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o atendimento.",
        );
      }
    });
  });
}

function bindEncounterTrashActions(tbody) {
  tbody.querySelectorAll("[data-restore-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await SISELO.apiRequest("/encounters/restore.php", {
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
          "o atendimento de",
          button.dataset.destroyLabel,
        ))
      ) {
        return;
      }

      try {
        await SISELO.apiRequest("/encounters/destroy.php", {
          method: "POST",
          body: { id: Number(button.dataset.destroyId) },
        });
        location.reload();
      } catch (error) {
        SISELO.showActionError(
          error.message || "Não foi possível apagar o atendimento permanentemente.",
        );
      }
    });
  });
}

function filterEncounterRows(rows, query) {
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

function getEmptyEncounterContext(patientId) {
  return {
    editing: false,
    row: {
      patient_id: patientId || "",
      encounter_date: "",
      specialty: "",
      summary: "",
    },
    patients: [],
  };
}

function fillEncounterPatientSelect(patients, currentValue) {
  const select = document.getElementById("patient_id");
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

function configureEncounterDateInput() {
  const today = SISELO.todayDateInputValue();
  const input = SISELO.enhanceDateInput("encounter_date", {
    min: "1900-01-01",
    max: today,
  });

  if (input && input.value) {
    input.value = SISELO.clampDateInputValue(input.value, input.min, input.max);
    SISELO.syncEnhancedDateInput(input);
  }
}
