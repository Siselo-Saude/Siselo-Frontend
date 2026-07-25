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

const PATIENT_LEGACY_TEAM_OPTIONS = {
  sem_equipe: "Sem equipe",
  safira: "Safira",
  ametista: "Ametista",
  esmeralda: "Esmeralda",
  diamante: "Diamante",
};

const PATIENT_UBS_TEAM_GROUPS = [
  {
    ubs: "UBS 01 PARANOÁ",
    teams: [
      "ESF EQUIPE 08 - BRANCA",
      "ESF EQUIPE 09 - AMARELA",
      "ESF EQUIPE 10 - AZUL",
      "ESF EQUIPE 11 - VERDE",
      "ESF EQUIPE 12 - ROSA",
      "ESF EQUIPE 13 - LILÁS",
      "ESF EQUIPE 14 - MARROM",
      "ESF EQUIPE 15 - DOURADA",
      "ESF EQUIPE 16 - LARANJA",
      "ESF EQUIPE 17 - PRATA",
      "EMULTI AROEIRA",
      "ECR MESTRE DAMIÃO",
    ],
  },
  {
    ubs: "UBS 02 PARANOÁ - Quadra 18",
    teams: [
      "ESF EQUIPE 01 - QUADRA 18",
      "ESF EQUIPE 02 - QUADRA 18",
      "ESF EQUIPE 03 - QUADRA 18",
    ],
  },
  {
    ubs: "UBS 03 PARANOÁ - Paranoá Parque",
    teams: [
      "ESF EQUIPE 18 - BURITI",
      "ESF EQUIPE 20 - JACARANDÁ",
      "ESF EQUIPE 21 - IPÊ",
      "ESF EQUIPE 22 - JEQUITIBÁ",
      "ESF EQUIPE 23 - PEQUI",
    ],
  },
  {
    ubs: "UBS 04 PARANOÁ - Jardim II",
    teams: ["ESF EQUIPE 02 - JARDIM II", "ESB JARDIM II"],
  },
  {
    ubs: "UBS 05 PARANOÁ - Quebrada dos Neres",
    teams: ["ESF EQUIPE QUEBRADA DOS NERES"],
  },
  {
    ubs: "UBS 06 PARANOÁ - Cariru",
    teams: ["ESF EQUIPE 04 - CARIRU", "ESB CARIRU"],
  },
  {
    ubs: "UBS 07 PARANOÁ - Café sem Troco",
    teams: ["ESF EQUIPE CAFÉ SEM TROCO"],
  },
  {
    ubs: "UBS 08 PARANOÁ - PADDF",
    teams: ["ESF EQUIPE PADDF"],
  },
  {
    ubs: "UBS 01 ITAPOÃ",
    teams: [
      "ESF EQUIPE 07 - ROSA",
      "ESF EQUIPE 08 - LARANJA",
      "ESF EQUIPE 09 - LILÁS",
      "ESF EQUIPE 10 - CINZA",
      "ESF EQUIPE 12 - VERDE",
      "ESF EQUIPE 13 - VERMELHA",
    ],
  },
  {
    ubs: "UBS 02 ITAPOÃ",
    teams: ["ESF EQUIPE 01", "ESF EQUIPE 02", "ESF EQUIPE ESMERALDA"],
  },
  {
    ubs: "UBS 03 ITAPOÃ",
    teams: ["ESF EQUIPE 03", "ESF EQUIPE 04", "ESF EQUIPE 05"],
  },
  {
    ubs: "UBS 04 ITAPOÃ",
    teams: ["ESF EQUIPE RUBI"],
  },
  {
    ubs: "UBS 01 SÃO SEBASTIÃO",
    teams: [
      "ESF EQUIPE 04 - LARANJA",
      "ESF EQUIPE 07 - LILÁS",
      "ESF EQUIPE 08 - ROSA",
      "ESF EQUIPE 09 - VERDE",
      "ESF EQUIPE 10 - VERMELHA",
      "ESF DOURADA",
    ],
  },
  {
    ubs: "UBS 02 SÃO SEBASTIÃO - T.R.E.",
    teams: ["ESF EQUIPE T.R.E."],
  },
  {
    ubs: "UBS 03 SÃO SEBASTIÃO - Oeste",
    teams: ["ESF EQUIPE 12 - OESTE 2", "ESB OESTE SSB"],
  },
  {
    ubs: "UBS 04 SÃO SEBASTIÃO - Morro Azul",
    teams: ["ESF EQUIPE MORRO AZUL"],
  },
  {
    ubs: "UBS 05 SÃO SEBASTIÃO - Nova Betânia",
    teams: ["ESF EQUIPE 01 - NOVA BETANIA", "ESB NOVA BETANIA SSB"],
  },
  {
    ubs: "UBS 06 SÃO SEBASTIÃO - São Francisco",
    teams: ["ESF EQUIPE 16 - SÃO FRANCISCO"],
  },
  {
    ubs: "UBS 07 SÃO SEBASTIÃO - Morro da Cruz",
    teams: ["ESF EQUIPE 02 - MORRO DA CRUZ"],
  },
  {
    ubs: "UBS 08 SÃO SEBASTIÃO - Cavas de Baixo",
    teams: ["ESF EQUIPE 03 - CAVAS DE BAIXO"],
  },
  {
    ubs: "UBS 09 SÃO SEBASTIÃO - Bosque",
    teams: [
      "ESF EQ 21 - BOSQUE 1",
      "ESF EQUIPE 23 - VILA NOVA 2",
      "ESB BOSQUE 1 SSB",
      "EMULTI IPE AMARELO",
    ],
  },
  {
    ubs: "UBS 10 SÃO SEBASTIÃO - João Cândido",
    teams: ["ESF EQUIPE 22 - JOÃO CÂNDIDO"],
  },
  {
    ubs: "UBS 11 SÃO SEBASTIÃO - Bosque 2",
    teams: ["ESF EQUIPE 25 - BOSQUE 2"],
  },
  {
    ubs: "UBS 12 SÃO SEBASTIÃO - São José",
    teams: ["ESF EQUIPE 17 - SÃO JOSÉ"],
  },
  {
    ubs: "UBS 14 SÃO SEBASTIÃO - PDF IV",
    teams: [
      "EQ. AMPLIADA 27 TIPO III CDP",
      "EQ. PSICOSOCIAL 30H - 2238861",
      "EQ. AMPLIADA ROSIMEIRE RODRIGUES",
    ],
  },
  {
    ubs: "UBS 15 SÃO SEBASTIÃO - CIR",
    teams: [
      "EQ. PSICOSOCIAL 30H - 2238853",
      "EQ. AMPLIADA 30H - 2238942",
      "EQ. PSICOSOCIAL 30H - 2238969",
      "EQ. AMPLIADA CARLA MACHADO",
    ],
  },
  {
    ubs: "UBS 16 SÃO SEBASTIÃO - PDF 1",
    teams: [
      "EQ. PSICOSOCIAL 30H - 2238837",
      "EQ. AMPLIADA 20H - 2238896",
      "EQ. PSICOSOCIAL 20H - 2238918",
      "EQ. AMPLIADA EURICO JARDIM",
    ],
  },
  {
    ubs: "UBS 17 SÃO SEBASTIÃO - PDF 2",
    teams: [
      "EQ. PSICOSOCIAL 30H - 2238845",
      "EQ. AMPLIADA 20H - 2238926",
      "EQ. PSICOSOCIAL 20H - 2238934",
      "EQ. AMPLIADA ALFA",
    ],
  },
  {
    ubs: "UBS 19 SÃO SEBASTIÃO - Vila do Boa",
    teams: ["ESF EQUIPE VILA DO BOA"],
  },
  {
    ubs: "UBS 20 SÃO SEBASTIÃO CDP",
    teams: [
      "EQ. PSICOSOCIAL 30H - 2238888",
      "EQUIPE AMPLIADA 20H - 2502216",
    ],
  },
  {
    ubs: "UBS 1 JARDINS MANGUEIRAL",
    teams: [
      "ESF DIAMANTE",
      "ESF AMETISTA",
      "ESF SAFIRA",
      "ESF ESMERALDA",
      "ESB 1 JARDINS MANGUEIRAL",
      "ESB 2 JARDINS MANGUEIRAL",
      "EMULTI RUBI",
    ],
  },
  {
    ubs: "UBS 03 JARDIM BOTÂNICO",
    teams: ["ESF TORORO"],
  },
];

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
  const canCreatePatient =
    permissions.has("patients.create") &&
    (
      String(user.user_type || "").toUpperCase() === "UBS" ||
      permissions.has("admin.manage")
    );
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

  const id = SISELO.normalizeEntityId(SISELO.queryParam("id"));
  SISELO.bindShell(id ? "patients" : "ubs");
  if (
    !id &&
    String(user.user_type || "").toUpperCase() !== "UBS" &&
    !SISELO.getUiPermissions(user).has("admin.manage")
  ) {
    SISELO.setFlashAlert("O cadastro de pacientes é exclusivo da UBS.", "error");
    location.href = "/cadh/index.html";
    return;
  }
  if (!id) {
    document.querySelectorAll("[data-back-link]").forEach((link) => {
      link.href = "/ubs/index.html?tab=patients";
      link.dataset.fallback = "/ubs/index.html?tab=patients";
    });
  }
  const endpoint =
    "/patients/form.php" + (id ? "?id=" + encodeURIComponent(id) : "");
  let data = getEmptyPatientFormContext();

  try {
    data = await SISELO.apiRequest(endpoint);
  } catch (error) {}

  const options = getPatientFormOptions(data.options);
  const row = normalizePatientFormRow(data.row || getEmptyPatientFormContext().row, options);

  document.getElementById("form-title").textContent = data.editing
    ? "Editar Paciente"
    : "Cadastro de Paciente pela UBS";

  fillSelect("gender", options.gender_options, row.sex, true, "Selecione...");
  fillSelect("race", options.race_options, row.race, true, "Selecione...");
  setupPatientUbsTeamControls(options, row);

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
  setupPatientStatusSelect(row.status || row.status_label || "ativo");
  syncPatientStatusCard(row.status || row.status_label || "ativo", data.editing);
  SISELO.enhanceChoiceSelects(document);
  SISELO.applyUiComponents(document);

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
      const payload = buildPatientSavePayload(
        Object.fromEntries(formData.entries()),
        row,
        options,
      );

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
          location.href = id
            ? SISELO.resolveBackTarget("/patients/list.html")
            : "/ubs/index.html?tab=patients";
        }, 2000);
      } catch (error) {
        const payloadErrors =
          error.payload && error.payload.errors ? error.payload.errors : {};
        const firstErrorTarget = applyPatientFieldErrors(payloadErrors);
        SISELO.showAlert(
          "page-alert",
          buildPatientValidationMessage(error.message, payloadErrors),
          "error",
        );
        focusPatientErrorTarget(firstErrorTarget);
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
    ${permissions.has("transitions.create") ? `<a class="btn" href="${buildPatientModuleActionHref("/transitions/form.html", { patient_id: actionPatientId, return_to: returnTargets.transicoes })}">+ Novo encaminhamento</a>` : ""}
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
      6,
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
      <td>${renderPatientTeamBadge(row.team_ref)}</td>
      <td>${SISELO.escapeHtml(row.phone || "")}<br><small>${SISELO.escapeHtml(row.email || "")}</small></td>
      <td>${renderPatientStatusBadge(row.status || row.status_label)}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconLink("view", `/patients/show.html?id=${row.id}&tab=planos`, "Usuário 360")}
          ${permissions.has("patients.update") ? SISELO.iconLink("edit", `/patients/form.html?id=${row.id}`, "Editar usuário") : ""}
          ${!isTrash && permissions.has("patients.delete") ? SISELO.iconButton("delete", "Inativar usuário", { "data-delete-id": row.id, "data-delete-label": row.full_name || "" }) : ""}
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
    const matchesTeam = search.hasLetters
      ? SISELO.matchesSearchText(row.team_ref, search)
      : false;
    const matchesDigits = search.hasDigits
      ? SISELO.matchesSearchDigits(row.cpf, search)
      : true;

    return (matchesName || matchesTeam) && matchesDigits;
  });
}

function renderPatientsTrashTable(tbody, rows, permissions, query = "") {
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = SISELO.emptyTableRow(5, "Nenhum usuário inativo encontrado.");
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${SISELO.highlightPersonName(row.full_name, query)}</td>
      <td>${SISELO.escapeHtml(row.cpf)}</td>
      <td>${renderPatientTeamBadge(row.team_ref)}</td>
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
    tbody.innerHTML = SISELO.emptyTableRow(6, "Nenhum encaminhamento encontrado.");
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
          ${permissions.has("transitions.update") ? SISELO.iconLink("edit", buildPatientModuleActionHref("/transitions/form.html", { id: row.id, patient_id: row.patient_id, return_to: returnTo }), "Editar encaminhamento") : ""}
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
    ["Equipe", SISELO.renderTeamBadge(patient.team_ref), true],
    [
      "Nascimento",
      patient.birth_date ? formatPatientDisplayDate(patient.birth_date) : "-",
    ],
    ["Idade", patient.age_label || "-"],
    ["Gênero", patient.gender_label || "-"],
    ["Telefone", patient.phone || "-"],
    ["Email", patient.email || "-"],
    ["UBS", patient.ubs_ref || "-"],
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
              ([label, value, isHtml]) => `
            <div class="patient360-meta-item">
              <span class="patient360-meta-label">${SISELO.escapeHtml(label)}</span>
              <span class="patient360-meta-value">${isHtml ? value : SISELO.escapeHtml(value)}</span>
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

function renderPatientTeamBadge(value) {
  return SISELO.renderTeamBadge(value);
}

function setupPatientStatusSelect(initialValue) {
  const select = document.getElementById("patient-status");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  select.value = SISELO.normalizeSearchText(initialValue || "") === "inativo"
    ? "inativo"
    : "ativo";
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncPatientStatusCard(initialValue, editing) {
  const select = document.getElementById("patient-status");
  const title = document.querySelector("[data-patient-status-title]");
  const copy = document.querySelector("[data-patient-status-copy]");
  if (!(select instanceof HTMLSelectElement) || !title || !copy) {
    return;
  }

  const sync = () => {
    const inactive = SISELO.normalizeSearchText(select.value) === "inativo";
    title.textContent = inactive
      ? "Inativo"
      : editing
        ? "Ativo"
        : "Ativo — Nova Admissão";
    copy.innerHTML = inactive
      ? "Este usuário está marcado como <b>Inativo</b> no CADH."
      : "O status é automaticamente definido como <b>Ativo</b> no primeiro cadastro, pois representa nova admissão ao CADH.";
  };

  select.value = SISELO.normalizeSearchText(initialValue || "") === "inativo"
    ? "inativo"
    : "ativo";
  select.addEventListener("change", sync);
  sync();
}

function setupPatientUbsTeamControls(options, row) {
  const ubsSelect = document.getElementById("uds_reference");
  const teamSelect = document.getElementById("team_reference");
  if (!(ubsSelect instanceof HTMLSelectElement) || !(teamSelect instanceof HTMLSelectElement)) {
    return;
  }

  ubsSelect.classList.remove("patient-native-select");
  ubsSelect.removeAttribute("data-native-select");
  teamSelect.classList.remove("patient-native-select");
  teamSelect.removeAttribute("data-native-select");

  const currentUbsRaw = String(row && row.ubs_ref ? row.ubs_ref : "").trim();
  const currentTeamRaw = String(row && row.team_ref ? row.team_ref : "").trim();
  const currentUbs = normalizePatientLegacyUbsValue(currentUbsRaw);
  const currentTeam = normalizePatientLegacyTeamValue(currentTeamRaw);
  const ubsOptions = { ...(options.ubs_options || {}) };
  if (currentUbs && !Object.prototype.hasOwnProperty.call(ubsOptions, currentUbs)) {
    ubsOptions[currentUbs] = currentUbs;
  }
  fillSelect("uds_reference", ubsOptions, currentUbs, true, "Selecione a UBS...");

  const renderTeamOptions = (nextCurrentTeam = "", preserveCurrentTeam = true) => {
    const selectedUbs = String(ubsSelect.value || "").trim();
    const selectedTeam = nextCurrentTeam || (preserveCurrentTeam ? teamSelect.value || currentTeam : "");
    const teamOptions = getPatientTeamOptionsForUbs(selectedUbs, selectedTeam);
    fillSelect("team_reference", teamOptions, selectedTeam, true, "Selecione a equipe...");
    teamSelect.disabled = selectedUbs === "";
  };

  let teamPicker = null;

  ubsSelect.addEventListener("change", () => {
    teamSelect.value = "";
    renderTeamOptions("", false);
    teamPicker?.refresh();
  });

  renderTeamOptions(currentTeam);
  teamPicker = SISELO.setupTeamFieldPicker({ select: teamSelect });
}

function getPatientUbsOptions() {
  return PATIENT_UBS_TEAM_GROUPS.reduce((options, group) => {
    options[group.ubs] = group.ubs;
    return options;
  }, {});
}

function getPatientPdfTeamOptions() {
  return PATIENT_UBS_TEAM_GROUPS.reduce((options, group) => {
    group.teams.forEach((team) => {
      options[team] = team;
    });
    return options;
  }, {});
}

function getPatientTeamOptionsForUbs(ubs, currentTeam = "") {
  const normalizedUbs = normalizePatientComparableValue(ubs);
  const group = PATIENT_UBS_TEAM_GROUPS.find((item) => {
    return normalizePatientComparableValue(item.ubs) === normalizedUbs;
  });

  const options = {};
  if (group) {
    group.teams.forEach((team) => {
      options[team] = team;
    });
  }

  const normalizedCurrentTeam = String(currentTeam || "").trim();
  if (normalizedCurrentTeam && !Object.prototype.hasOwnProperty.call(options, normalizedCurrentTeam)) {
    const legacyLabel = PATIENT_LEGACY_TEAM_OPTIONS[normalizedCurrentTeam];
    options[normalizedCurrentTeam] = legacyLabel || normalizedCurrentTeam;
  }

  return options;
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
    transicoes: "Encaminhamentos",
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

  const teamOptions = {
    ...PATIENT_LEGACY_TEAM_OPTIONS,
    ...getPatientPdfTeamOptions(),
  };

  return {
    gender_options: safeOptions.gender_options || {
      masculino: "Masculino",
      feminino: "Feminino",
      outro: "Outro",
    },
    race_options: raceOptions,
    risk_options: safeOptions.risk_options || {
      alto_risco: "Alto Risco",
      muito_alto_risco: "Muito Alto Risco",
    },
    ubs_options: getPatientUbsOptions(),
    team_options: teamOptions,
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
      cpf: "",
      birth_date: "",
      sex: "",
      race: "",
      responsible_name: "",
      phone: "",
      address: "",
      email: "",
      emergency_contact: "",
      allergies: "",
      chronic_conditions: "",
      status: "ativo",
      risk_classification: "alto_risco",
      care_status: "recebido",
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
    age_label: "",
    gender_label: "",
    status_label: "Ativo",
    phone: "",
    email: "",
    ubs_ref: "",
    team_ref: "",
    emergency_contact: "",
    allergies: "",
    chronic_conditions: "",
  };
}

const PATIENT_FIELD_LABELS = {
  first_cadh_date: "Data de atendimento",
  full_name: "Nome completo",
  cpf: "CPF",
  birth_date: "Data de nascimento",
  sex: "Sexo",
  race: "Raça/Cor",
  responsible_name: "Responsável",
  phone: "Telefone",
  address: "Endereço",
  email: "E-mail",
  emergency_contact: "Contato de emergência",
  allergies: "Alergias",
  chronic_conditions: "Condições crônicas",
  risk_classification: "Classificação de risco",
  ubs_ref: "UBS de referência",
  team_ref: "Equipe",
  status: "Status",
  ses: "Dados internos do cadastro",
  health_insurance: "Dados internos do cadastro",
  blood_type: "Dados internos do cadastro",
};

const PATIENT_FIELD_TARGETS = {
  first_cadh_date: ["attendance_date"],
  sex: ["gender"],
  responsible_name: ["responsible"],
  ubs_ref: ["uds_reference"],
  team_ref: ["team_reference"],
};

function normalizePatientFormRow(row, options) {
  const normalizedRow = { ...(row || {}) };
  normalizedRow.sex = normalizePatientOptionValue(
    normalizedRow.sex,
    options.gender_options,
  );
  normalizedRow.race = normalizePatientOptionValue(
    normalizedRow.race,
    options.race_options,
    { amarelo: "amarela" },
  );
  normalizedRow.status =
    normalizePatientOptionValue(normalizedRow.status || normalizedRow.status_label, {
      ativo: "Ativo",
      inativo: "Inativo",
    }) || "ativo";
  normalizedRow.risk_classification =
    normalizePatientOptionValue(normalizedRow.risk_classification, {
      alto_risco: "Alto Risco",
      muito_alto_risco: "Muito Alto Risco",
    }) || "alto_risco";
  normalizedRow.ubs_ref = normalizePatientLegacyUbsValue(normalizedRow.ubs_ref);
  normalizedRow.team_ref = normalizePatientTeamValue(
    normalizedRow.team_ref,
    options.team_options,
  );

  return normalizedRow;
}

function normalizePatientOptionValue(value, options, aliases = {}) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const normalizedValue = normalizePatientComparableValue(rawValue);
  const normalizedAlias = aliases[normalizedValue];
  if (normalizedAlias) {
    return normalizedAlias;
  }

  return Object.entries(options || {}).reduce((matched, [optionValue, label]) => {
    if (matched) {
      return matched;
    }

    return [optionValue, label].some((candidate) => {
      return normalizePatientComparableValue(candidate) === normalizedValue;
    })
      ? optionValue
      : "";
  }, "");
}

function normalizePatientTeamValue(value, options) {
  const rawValue = String(value || "").replace(/^equipe\s*:\s*/i, "").trim();
  const legacyValue = normalizePatientLegacyTeamValue(rawValue);

  return normalizePatientOptionValue(legacyValue, options);
}

function normalizePatientComparableValue(value) {
  return SISELO.normalizeSearchText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePatientLegacyUbsValue(value) {
  const rawValue = String(value || "").trim();
  const comparable = normalizePatientComparableValue(rawValue);
  if (
    comparable === "ubs 16 sao sebastiao pdf i" ||
    comparable === "ubs 16 sao sebastiao pdf 1"
  ) {
    return "UBS 16 SÃO SEBASTIÃO - PDF 1";
  }

  if (
    comparable === "ubs 17 sao sebastiao pdf ii" ||
    comparable === "ubs 17 sao sebastiao pdf 2"
  ) {
    return "UBS 17 SÃO SEBASTIÃO - PDF 2";
  }

  if (comparable === "ubs 20 sao sebastiao cdp") {
    return "UBS 20 SÃO SEBASTIÃO CDP";
  }

  return rawValue;
}

function normalizePatientLegacyTeamValue(value) {
  const rawValue = String(value || "").trim();
  const comparable = normalizePatientComparableValue(rawValue);
  if (
    comparable === "esf equipe pdf iv" ||
    comparable === "esf equipe cir" ||
    comparable === "esf equipe pdf i" ||
    comparable === "esf equipe pdf ii" ||
    comparable === "esf equipe pdf 1" ||
    comparable === "esf equipe pdf 2" ||
    comparable === "esf equipe cdp"
  ) {
    return "";
  }

  return rawValue;
}

function buildPatientSavePayload(payload, row, options) {
  const nextPayload = { ...(payload || {}) };
  const teamOptions = (options && options.team_options) || getPatientFormOptions({}).team_options;
  const teamValue = normalizePatientTeamValue(
    nextPayload.team_ref || nextPayload.team_reference || (row && row.team_ref),
    teamOptions,
  );
  const legacyBloodType = String(
    nextPayload.blood_type || (row && row.blood_type) || "",
  )
    .trim()
    .toUpperCase();
  const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  nextPayload.team_ref = teamValue;
  nextPayload.team_reference = teamValue;
  delete nextPayload.ses;
  nextPayload.health_insurance = String(
    nextPayload.health_insurance || (row && row.health_insurance) || "SUS",
  ).trim() || "SUS";
  nextPayload.blood_type = validBloodTypes.includes(legacyBloodType)
    ? legacyBloodType
    : "O+";

  return nextPayload;
}

function fillSelect(id, options, currentValue, allowBlank, placeholderLabel = "Selecione") {
  const select = document.getElementById(id);
  if (!select) {
    return;
  }

  const entries = Array.isArray(options)
    ? options.map((value) => [value, value])
    : Object.entries(options || {});

  select.innerHTML =
    `${allowBlank ? `<option value="">${SISELO.escapeHtml(placeholderLabel)}</option>` : `<option value="">${SISELO.escapeHtml(placeholderLabel)}</option>`}` +
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
  document.querySelectorAll(".is-invalid").forEach((element) => {
    element.classList.remove("is-invalid");
  });
  document.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
  });
  SISELO.showAlert("page-alert", "", "info");
}

function applyPatientFieldErrors(errors) {
  let firstTarget = null;

  Object.entries(errors || {}).forEach(([field, message]) => {
    const errorElement = document.querySelector(`[data-error-for="${field}"]`);
    if (errorElement) {
      errorElement.textContent = message;
    }

    const target = findPatientErrorTarget(field);
    if (!target) {
      return;
    }

    if (!firstTarget) {
      firstTarget = target;
    }

    target.setAttribute("aria-invalid", "true");
    target.classList.add("is-invalid");
    const visibleTarget = getPatientVisibleErrorTarget(target);
    if (visibleTarget && visibleTarget !== target) {
      visibleTarget.classList.add("is-invalid");
    }
  });

  return firstTarget;
}

function buildPatientValidationMessage(message, errors) {
  const fields = Array.from(
    new Set(Object.keys(errors || {}).map((field) => PATIENT_FIELD_LABELS[field] || field)),
  ).slice(0, 4);

  if (fields.length === 0) {
    return message || "Revise os campos destacados e tente novamente.";
  }

  const remaining = Math.max(0, Object.keys(errors || {}).length - fields.length);
  const suffix = remaining > 0 ? ` e mais ${remaining}` : "";
  return `Revise: ${fields.join(", ")}${suffix}.`;
}

function findPatientErrorTarget(field) {
  const targets = PATIENT_FIELD_TARGETS[field] || [field];

  for (const target of targets) {
    const element =
      document.getElementById(target) ||
      document.querySelector(`[name="${target}"]`) ||
      document.querySelector(`[data-field="${target}"]`);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
}

function getPatientVisibleErrorTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const choiceSelect = target.closest(".choice-select");
  if (choiceSelect instanceof HTMLElement) {
    return choiceSelect;
  }

  const datePicker = target.nextElementSibling;
  if (datePicker instanceof HTMLElement && datePicker.classList.contains("date-picker")) {
    return datePicker;
  }

  if (target.id === "team_reference") {
    const teamPicker = target.nextElementSibling;
    if (teamPicker instanceof HTMLElement && teamPicker.classList.contains("team-picker")) {
      return teamPicker;
    }
  }

  return target;
}

function focusPatientErrorTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const visibleTarget = getPatientVisibleErrorTarget(target) || target;
  visibleTarget.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusTarget =
    visibleTarget.querySelector("button, input, select, textarea") || target;
  if (focusTarget instanceof HTMLElement) {
    setTimeout(() => focusTarget.focus({ preventScroll: true }), 200);
  }
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

  const minHeight = 132;
  const maxHeight = 220;

  const syncHeights = () => {
    textareas.forEach((textarea) => {
      textarea.style.resize = "vertical";
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
    });

    const nextHeight = Math.min(
      maxHeight,
      Math.max(
        minHeight,
        ...textareas.map((textarea) => textarea.scrollHeight),
      ),
    );

    textareas.forEach((textarea) => {
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = nextHeight >= maxHeight ? "auto" : "hidden";
    });
  };

  textareas.forEach((textarea) => {
    textarea.addEventListener("input", syncHeights);
  });

  syncHeights();
}

function attachPatientMasks() {
  const cpfInput = document.getElementById("cpf");
  const phoneInput = document.getElementById("phone");
  const emergencyInput = document.getElementById("emergency_contact");

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
