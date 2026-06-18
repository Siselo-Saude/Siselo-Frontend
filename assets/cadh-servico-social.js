const SOCIAL_STORAGE_KEY = "siselo_cadh_social_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const SOCIAL_INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";

const socialState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-servico-social") {
    return;
  }

  setupSocialPage();
});

async function setupSocialPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  socialState.activePatientId = getSocialContextPatientId();
  socialState.records = readSocialRecords();
  bindSocialModal();
  bindSocialViewModal();
  SISELO.bindFieldGuidanceTooltips();
  updateSocialConsultationOptions("");

  SISELO.enhanceDateInput("social_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  socialState.patients = await loadSocialPatients();
  socialState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "social_patient_id",
    container: "social_patient_search",
    rows: socialState.patients,
    currentValue: socialState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (socialState.activePatientId) {
        const scopedPatient = getActiveSocialPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (socialState.patientPicker && scopedPatient && pickedPatientId !== socialState.activePatientId) {
          socialState.patientPicker.setValue(scopedPatient);
        }
        updateSocialConsultationOptions(socialState.activePatientId, socialState.editingRecordId);
        updateSocialPatientSummary(scopedPatient);
        updateSocialAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findSocialPatientById(patient.id) || patient
        : null;
      updateSocialConsultationOptions(patient && patient.id, socialState.editingRecordId);
      updateSocialPatientSummary(selectedPatient);
      updateSocialAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#social_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "social_patient_search_input";
  }

  applySocialPatientScope();
  updateSocialScopeControls();
  renderSocialTable();
}

function bindSocialModal() {
  const modal = document.getElementById("social-modal");
  const form = document.getElementById("social-form");
  const newButton = document.getElementById("social-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openSocialModal();
  });

  modal.querySelectorAll("[data-social-close]").forEach((button) => {
    button.addEventListener("click", () => closeSocialModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeSocialModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeSocialModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSocialRecord();
  });
}

function bindSocialViewModal() {
  const modal = document.getElementById("social-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-social-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeSocialViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeSocialViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeSocialViewModal();
    }
  });
}

async function loadSocialPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeSocialPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getSocialContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveSocialPatient() {
  const patientId = SISELO.normalizeEntityId(socialState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findSocialPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeSocialPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applySocialPatientScope() {
  const scopedPatient = getActiveSocialPatient();
  if (!scopedPatient || !socialState.patientPicker) {
    return;
  }

  socialState.patientPicker.setValue(scopedPatient);
  updateSocialConsultationOptions(scopedPatient.id, socialState.editingRecordId);
  updateSocialPatientSummary(scopedPatient);
  updateSocialAgeGuidance(scopedPatient);

  const input = document.querySelector("#social_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateSocialScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(socialState.activePatientId));
  const newButton = document.getElementById("social-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar o Serviço Social.";
  }
}

function mergeSocialPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeSocialPatient(row);
    if (!patient.id) {
      return;
    }

    merged.set(patient.id, {
      ...(merged.get(patient.id) || {}),
      ...patient,
    });
  });

  return Array.from(merged.values());
}

function normalizeSocialPatient(patient) {
  return {
    id: SISELO.normalizeEntityId(patient && patient.id),
    full_name: String((patient && patient.full_name) || "").trim(),
    cpf: String((patient && patient.cpf) || "").trim(),
    team_ref: String((patient && patient.team_ref) || "").trim(),
    birth_date: String((patient && patient.birth_date) || "").trim(),
    first_cadh_date: String((patient && patient.first_cadh_date) || "").trim(),
    age_label: String((patient && patient.age_label) || "").trim(),
    race: String((patient && (patient.race || patient.race_label || patient.color_race)) || "").trim(),
  };
}

function openSocialModal(record = null) {
  const modal = document.getElementById("social-modal");
  const form = document.getElementById("social-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(socialState.activePatientId)) {
    SISELO.showAlert("social-alert", "Selecione um usuário no CADH antes de criar um registro de Serviço Social.", "error");
    return;
  }

  socialState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("social-alert", "", "info");
  fillSocialForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#social_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeSocialModal() {
  const modal = document.getElementById("social-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (socialState.lastFocus instanceof HTMLElement) {
    socialState.lastFocus.focus();
  }
}

function openSocialViewModal(record) {
  const modal = document.getElementById("social-view-modal");
  const content = document.getElementById("social-view-content");
  if (!modal || !content) {
    return;
  }

  socialState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderSocialViewRecord(normalizeSocialRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-social-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeSocialViewModal() {
  const modal = document.getElementById("social-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (socialState.lastFocus instanceof HTMLElement) {
    socialState.lastFocus.focus();
  }
}

function fillSocialForm(record = null) {
  const normalizedRecord = record ? normalizeSocialRecord(record) : null;
  socialState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeSocialPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeSocialPatient({
      id: normalizedRecord.patient_id,
      full_name: normalizedRecord.full_name,
      cpf: normalizedRecord.cpf,
      team_ref: normalizedRecord.team_ref,
      birth_date: normalizedRecord.birth_date,
      first_cadh_date: normalizedRecord.first_cadh_date,
      age_label: normalizedRecord.age_label,
      race: normalizedRecord.race,
    })
    : null;
  const selectedPatient = normalizedRecord
    ? findSocialPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveSocialPatient() || cachedPatient;

  setSocialField("social_record_id", normalizedRecord ? normalizedRecord.id : "");
  setSocialField("social_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setSocialField("social_education", normalizedRecord ? normalizedRecord.education : "");
  setSocialField("social_support", normalizedRecord ? normalizedRecord.support : "");
  setSocialField("social_income", normalizedRecord ? normalizedRecord.income : "");
  setSocialField("social_assistance_need", normalizedRecord ? normalizedRecord.assistance_need : "");
  setSocialField("social_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setSocialField("social_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");

  if (socialState.patientPicker) {
    socialState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateSocialPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateSocialAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateSocialConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    socialState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  const dateInput = document.getElementById("social_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setSocialField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function saveSocialRecord() {
  const form = document.getElementById("social-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "social-alert" })) {
    return;
  }

  const patientId = socialState.activePatientId || (socialState.patientPicker
    ? socialState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("social-alert", "Selecione o paciente.", "error");
    if (socialState.patientPicker) {
      socialState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const missingFields = validateSocialRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("social-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingSocialField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialSocialConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("social-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateSocialConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveSocialPatient(patientId);
  const record = normalizeSocialRecord({
    id: payload.record_id || createSocialRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || SOCIAL_INITIAL_CONSULTATION_LABEL,
    education: payload.education,
    support: payload.support,
    income: payload.income,
    assistance_need: payload.assistance_need,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("social-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = socialState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    socialState.records[existingIndex] = record;
  } else {
    socialState.records.unshift(record);
  }

  writeSocialRecords(socialState.records);
  renderSocialTable();
  closeSocialModal();
}

function validateSocialRequiredFields(payload) {
  return [
    ["consultation_date", "Data da consulta"],
    ["education", "Escolaridade"],
    ["support", "Suporte Social"],
    ["income", "Renda familiar"],
    ["assistance_need", "Necessidade de apoio assistencial"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ]
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingSocialField(label) {
  const fieldMap = {
    "Data da consulta": "social_consultation_date",
    "Escolaridade": "social_education",
    "Suporte Social": "social_support",
    "Renda familiar": "social_income",
    "Necessidade de apoio assistencial": "social_assistance_need",
    "Fatores dificultadores": "social_barriers",
    Recomendações: "social_recommendations",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function updateSocialConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("social_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeSocialConsultationLabel(preferredValue);
  const patientRecords = socialState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialSocialConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialSocialConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseSocialConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseSocialConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatSocialConsultationLabel(preferredOrdinal)
    : formatSocialConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: SOCIAL_INITIAL_CONSULTATION_LABEL,
    label: SOCIAL_INITIAL_CONSULTATION_LABEL,
    disabled: Boolean(normalizedPatientId && hasInitial && !isEditingInitial),
  });

  if (normalizedPatientId && (hasInitial || preferredOrdinal > 1)) {
    options.push({
      value: subsequentLabel,
      label: subsequentLabel,
      disabled: false,
    });
  }

  select.innerHTML = options.map((option) => `
    <option value="${SISELO.escapeHtml(option.value)}" ${option.disabled ? "disabled" : ""}>
      ${SISELO.escapeHtml(option.label)}
    </option>
  `).join("");

  if (normalizedPreferred && options.some((option) => option.value === normalizedPreferred && !option.disabled)) {
    select.value = normalizedPreferred;
    return;
  }

  const firstEnabled = options.find((option) => !option.disabled);
  select.value = firstEnabled ? firstEnabled.value : SOCIAL_INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialSocialConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialSocialConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return socialState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialSocialConsultation(record.consultation_number)
  ));
}

function normalizeSocialConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parseSocialConsultationOrdinal(normalized);
  return ordinal ? formatSocialConsultationLabel(ordinal) : "";
}

function isInitialSocialConsultation(value) {
  return parseSocialConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseSocialConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatSocialConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? SOCIAL_INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function resolveSocialPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findSocialPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeSocialPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    socialState.patients = mergeSocialPatients(socialState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findSocialPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return socialState.patients.find((item) => item.id === normalizedId) || null;
}

function updateSocialPatientSummary(patient) {
  const element = document.getElementById("social-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findSocialPatientById(patient.id) || normalizeSocialPatient(patient);
  const ageYears = getSocialAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderSocialPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderSocialPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderSocialPatientSummaryItem("Cor/Raça", formatSocialRace(fullPatient.race)),
    renderSocialPatientSummaryItem("Idade", ageLabel),
    renderSocialPatientSummaryItem("Nascimento", formatSocialDate(fullPatient.birth_date)),
    renderSocialPatientSummaryItem("1º atendimento CADH", formatSocialDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderSocialPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateSocialAgeGuidance(patient) {
  const element = document.getElementById("social-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findSocialPatientById(patient.id) || normalizeSocialPatient(patient);
  const ageYears = getSocialAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getSocialAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getSocialAgeYears(patient) {
  const fromLabel = String((patient && patient.age_label) || "").match(/\d+/);
  if (fromLabel) {
    return Number(fromLabel[0]);
  }

  const birthDate = SISELO.parseDateInputValue(patient && patient.birth_date);
  if (!birthDate) {
    return NaN;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function getSocialAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Registre escolaridade, suporte social, renda, necessidade de apoio assistencial e encaminhamentos pactuados.";
  }

  if (ageYears < 2) {
    return "Observe responsável legal, suporte familiar, documentação, acesso a benefícios e segurança social da criança.";
  }

  if (ageYears < 10) {
    return "Considere responsável, rede de apoio, escola, transporte, documentação e acesso a benefícios sociais.";
  }

  if (ageYears < 20) {
    return "Avalie autonomia, suporte familiar, vínculo escolar, renda, documentação e necessidade de rede socioassistencial.";
  }

  if (ageYears >= 60) {
    return "Considere apoio familiar, cuidador, renda, benefícios, transporte, moradia e risco de isolamento social.";
  }

  return "Avalie renda, suporte social, trabalho, documentação, acesso a benefícios e articulação com a rede de proteção.";
}

function renderSocialViewRecord(record) {
  const item = record || {};

  return `
    ${renderSocialViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatSocialRace(item.race)],
      ["Data de nascimento", formatSocialDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatSocialDate(item.first_cadh_date)],
      ["Data da consulta", formatSocialDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderSocialViewSection("Avaliação socioassistencial", [
      ["Escolaridade", item.education || "-"],
      ["Suporte Social", item.support || "-", true],
      ["Renda familiar", item.income || "-"],
      ["Necessidade de apoio assistencial (CRAS/CREAS/INSS/etc)", item.assistance_need || "-"],
    ])}
    ${renderSocialViewSection("Plano de cuidado", [
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers || "-", true],
      ["Recomendações - Ficha Plano de Cuidado", item.recommendations || "-", true],
    ])}
  `;
}

function renderSocialViewSection(title, items) {
  return `
    <section class="social-view-section">
      <h3 class="social-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="social-view-grid">
        ${items.map(([label, value, wide]) => renderSocialViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderSocialViewItem(label, value, wide = false) {
  return `
    <div class="social-view-item${wide ? " is-wide" : ""}">
      <span class="social-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="social-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderSocialTable() {
  const tbody = document.getElementById("social-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(socialState.activePatientId);
  const records = socialState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseSocialConsultationOrdinal(right.consultation_number) -
        parseSocialConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Serviço Social encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Serviço Social.";
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="social-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindSocialTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatSocialDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.education || "-")}</td>
      <td>${SISELO.escapeHtml(record.support || "-")}</td>
      <td>${SISELO.escapeHtml(record.income || "-")}</td>
      <td>${SISELO.escapeHtml(record.assistance_need || "-")}</td>
      <td>${SISELO.escapeHtml(record.barriers || "-")}</td>
      <td>${SISELO.escapeHtml(record.recommendations || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver consulta de Serviço Social", { "data-social-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-social-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-social-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindSocialTableActions();
}

function bindSocialTableActions() {
  const tbody = document.getElementById("social-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-social-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = socialState.records.find((item) => item.id === button.dataset.socialEdit);
      if (record) {
        openSocialModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-social-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = socialState.records.find((item) => item.id === button.dataset.socialView);
      if (record) {
        openSocialViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-social-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function readSocialRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SOCIAL_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeSocialRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeSocialRecords(records) {
  try {
    localStorage.setItem(
      SOCIAL_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeSocialRecord(record) {
  const id = String((record && record.id) || "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    patient_id: SISELO.normalizeEntityId(record && record.patient_id),
    full_name: String((record && record.full_name) || "").trim(),
    cpf: String((record && record.cpf) || "").trim(),
    team_ref: String((record && record.team_ref) || "").trim(),
    birth_date: String((record && record.birth_date) || "").trim(),
    first_cadh_date: String((record && record.first_cadh_date) || "").trim(),
    age_label: String((record && record.age_label) || "").trim(),
    race: String((record && record.race) || "").trim(),
    consultation_date: String((record && record.consultation_date) || "").trim(),
    consultation_number: normalizeSocialConsultationLabel(record && record.consultation_number) || SOCIAL_INITIAL_CONSULTATION_LABEL,
    education: normalizeSocialEducation(record && record.education),
    support: String((record && record.support) || "").trim(),
    income: normalizeSocialIncome(record && record.income),
    assistance_need: normalizeSocialYesNo(record && record.assistance_need),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeSocialEducation(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "nao possui": "Não possui",
    "educacao infantil": "Educação infantil",
    fundamental: "Fundamental",
    medio: "Médio",
    "superior graduacao": "Superior (Graduação)",
    "superior (graduacao)": "Superior (Graduação)",
    "pos graduacao": "Pós-graduação",
    "pos-graduacao": "Pós-graduação",
    mestrado: "Mestrado",
    doutorado: "Doutorado",
  };

  return legacyValues[normalized] || original;
}

function normalizeSocialIncome(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "sem renda familiar": "Sem renda familiar",
    "ate 1 salario minimo": "Até 1 salário mínimo",
    "de 2 a 5 salarios minimos": "De 2 a 5 salários mínimos",
    "de 5 a 10 salarios minimos": "De 5 a 10 salários mínimos",
    "acima de 10 salarios minimos": "Acima de 10 salários mínimos",
  };

  return legacyValues[normalized] || original;
}

function normalizeSocialYesNo(value) {
  const normalized = SISELO.normalizeSearchText(value);
  if (normalized === "sim") {
    return "Sim";
  }
  if (normalized === "nao") {
    return "Não";
  }
  return String(value || "").trim();
}

function createSocialRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `social-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSocialDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatSocialRace(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const normalized = SISELO.normalizeSearchText(raw);
  const raceMap = {
    branca: "Branca",
    branco: "Branca",
    preta: "Preta",
    preto: "Preta",
    parda: "Parda",
    pardo: "Parda",
    amarela: "Amarela",
    amarelo: "Amarela",
    indigena: "Indígena",
  };

  return raceMap[normalized] || raw;
}
