const FISIOTERAPIA_STORAGE_KEY = "siselo_cadh_fisioterapia_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const FISIOTERAPIA_INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";

const fisioterapiaState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-fisioterapia") {
    return;
  }

  setupFisioterapiaPage();
});

async function setupFisioterapiaPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  fisioterapiaState.activePatientId = getFisioterapiaContextPatientId();
  fisioterapiaState.records = readFisioterapiaRecords();
  bindFisioterapiaModal();
  bindFisioterapiaViewModal();
  SISELO.bindFieldGuidanceTooltips();
  updateFisioterapiaConsultationOptions("");

  SISELO.enhanceDateInput("fisioterapia_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  fisioterapiaState.patients = await loadFisioterapiaPatients();
  fisioterapiaState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "fisioterapia_patient_id",
    container: "fisioterapia_patient_search",
    rows: fisioterapiaState.patients,
    currentValue: fisioterapiaState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (fisioterapiaState.activePatientId) {
        const scopedPatient = getActiveFisioterapiaPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (fisioterapiaState.patientPicker && scopedPatient && pickedPatientId !== fisioterapiaState.activePatientId) {
          fisioterapiaState.patientPicker.setValue(scopedPatient);
        }
        updateFisioterapiaConsultationOptions(fisioterapiaState.activePatientId, fisioterapiaState.editingRecordId);
        updateFisioterapiaPatientSummary(scopedPatient);
        updateFisioterapiaAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findFisioterapiaPatientById(patient.id) || patient
        : null;
      updateFisioterapiaConsultationOptions(patient && patient.id, fisioterapiaState.editingRecordId);
      updateFisioterapiaPatientSummary(selectedPatient);
      updateFisioterapiaAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#fisioterapia_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "fisioterapia_patient_search_input";
  }

  applyFisioterapiaPatientScope();
  updateFisioterapiaScopeControls();
  renderFisioterapiaTable();
}

function bindFisioterapiaModal() {
  const modal = document.getElementById("fisioterapia-modal");
  const form = document.getElementById("fisioterapia-form");
  const newButton = document.getElementById("fisioterapia-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openFisioterapiaModal();
  });

  modal.querySelectorAll("[data-fisioterapia-close]").forEach((button) => {
    button.addEventListener("click", () => closeFisioterapiaModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeFisioterapiaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeFisioterapiaModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveFisioterapiaRecord();
  });
}

function bindFisioterapiaViewModal() {
  const modal = document.getElementById("fisioterapia-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-fisioterapia-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeFisioterapiaViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeFisioterapiaViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeFisioterapiaViewModal();
    }
  });
}

async function loadFisioterapiaPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeFisioterapiaPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getFisioterapiaContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveFisioterapiaPatient() {
  const patientId = SISELO.normalizeEntityId(fisioterapiaState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findFisioterapiaPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFisioterapiaPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyFisioterapiaPatientScope() {
  const scopedPatient = getActiveFisioterapiaPatient();
  if (!scopedPatient || !fisioterapiaState.patientPicker) {
    return;
  }

  fisioterapiaState.patientPicker.setValue(scopedPatient);
  updateFisioterapiaConsultationOptions(scopedPatient.id, fisioterapiaState.editingRecordId);
  updateFisioterapiaPatientSummary(scopedPatient);
  updateFisioterapiaAgeGuidance(scopedPatient);

  const input = document.querySelector("#fisioterapia_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateFisioterapiaScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(fisioterapiaState.activePatientId));
  const newButton = document.getElementById("fisioterapia-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Fisioterapia.";
  }
}

function mergeFisioterapiaPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeFisioterapiaPatient(row);
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

function normalizeFisioterapiaPatient(patient) {
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

function openFisioterapiaModal(record = null) {
  const modal = document.getElementById("fisioterapia-modal");
  const form = document.getElementById("fisioterapia-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(fisioterapiaState.activePatientId)) {
    SISELO.showAlert("fisioterapia-alert", "Selecione um usuário no CADH antes de criar um registro de Fisioterapia.", "error");
    return;
  }

  fisioterapiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("fisioterapia-alert", "", "info");
  fillFisioterapiaForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#fisioterapia_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeFisioterapiaModal() {
  const modal = document.getElementById("fisioterapia-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (fisioterapiaState.lastFocus instanceof HTMLElement) {
    fisioterapiaState.lastFocus.focus();
  }
}

function openFisioterapiaViewModal(record) {
  const modal = document.getElementById("fisioterapia-view-modal");
  const content = document.getElementById("fisioterapia-view-content");
  if (!modal || !content) {
    return;
  }

  fisioterapiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderFisioterapiaViewRecord(normalizeFisioterapiaRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-fisioterapia-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeFisioterapiaViewModal() {
  const modal = document.getElementById("fisioterapia-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (fisioterapiaState.lastFocus instanceof HTMLElement) {
    fisioterapiaState.lastFocus.focus();
  }
}

function fillFisioterapiaForm(record = null) {
  const normalizedRecord = record ? normalizeFisioterapiaRecord(record) : null;
  fisioterapiaState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFisioterapiaPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeFisioterapiaPatient({
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
    ? findFisioterapiaPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveFisioterapiaPatient() || cachedPatient;

  setFisioterapiaField("fisioterapia_record_id", normalizedRecord ? normalizedRecord.id : "");
  setFisioterapiaField("fisioterapia_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setFisioterapiaField("fisioterapia_amputation", normalizedRecord ? normalizedRecord.amputation : "");
  setFisioterapiaField("fisioterapia_prosthesis", normalizedRecord ? normalizedRecord.prosthesis : "");
  setFisioterapiaField("fisioterapia_pain_presence", normalizedRecord ? normalizedRecord.pain_presence : "");
  setFisioterapiaField("fisioterapia_activity_modality", normalizedRecord ? normalizedRecord.activity_modality : "");
  setFisioterapiaField("fisioterapia_intensity", normalizedRecord ? normalizedRecord.intensity : "");
  setFisioterapiaField("fisioterapia_weekly_time", normalizedRecord ? normalizedRecord.weekly_time : "");
  setFisioterapiaField("fisioterapia_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setFisioterapiaField("fisioterapia_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");

  if (fisioterapiaState.patientPicker) {
    fisioterapiaState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateFisioterapiaPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateFisioterapiaAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateFisioterapiaConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    fisioterapiaState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  const dateInput = document.getElementById("fisioterapia_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setFisioterapiaField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function saveFisioterapiaRecord() {
  const form = document.getElementById("fisioterapia-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "fisioterapia-alert" })) {
    return;
  }

  const patientId = fisioterapiaState.activePatientId || (fisioterapiaState.patientPicker
    ? fisioterapiaState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("fisioterapia-alert", "Selecione o paciente.", "error");
    if (fisioterapiaState.patientPicker) {
      fisioterapiaState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const missingFields = validateFisioterapiaRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("fisioterapia-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingFisioterapiaField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialFisioterapiaConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("fisioterapia-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateFisioterapiaConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveFisioterapiaPatient(patientId);
  const record = normalizeFisioterapiaRecord({
    id: payload.record_id || createFisioterapiaRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || FISIOTERAPIA_INITIAL_CONSULTATION_LABEL,
    amputation: payload.amputation,
    prosthesis: payload.prosthesis,
    pain_presence: payload.pain_presence,
    activity_modality: payload.activity_modality,
    intensity: payload.intensity,
    weekly_time: payload.weekly_time,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("fisioterapia-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = fisioterapiaState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    fisioterapiaState.records[existingIndex] = record;
  } else {
    fisioterapiaState.records.unshift(record);
  }

  writeFisioterapiaRecords(fisioterapiaState.records);
  renderFisioterapiaTable();
  closeFisioterapiaModal();
}

function validateFisioterapiaRequiredFields(payload) {
  return [
    ["consultation_date", "Data da consulta"],
    ["amputation", "Amputação"],
    ["prosthesis", "Prótese"],
    ["pain_presence", "Presença de dor"],
    ["activity_modality", "Modalidade"],
    ["intensity", "Intensidade"],
    ["weekly_time", "Tempo por semana"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ]
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingFisioterapiaField(label) {
  const fieldMap = {
    "Data da consulta": "fisioterapia_consultation_date",
    Amputação: "fisioterapia_amputation",
    Prótese: "fisioterapia_prosthesis",
    "Presença de dor": "fisioterapia_pain_presence",
    Modalidade: "fisioterapia_activity_modality",
    Intensidade: "fisioterapia_intensity",
    "Tempo por semana": "fisioterapia_weekly_time",
    "Fatores dificultadores": "fisioterapia_barriers",
    Recomendações: "fisioterapia_recommendations",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function updateFisioterapiaConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("fisioterapia_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeFisioterapiaConsultationLabel(preferredValue);
  const patientRecords = fisioterapiaState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialFisioterapiaConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialFisioterapiaConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseFisioterapiaConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseFisioterapiaConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatFisioterapiaConsultationLabel(preferredOrdinal)
    : formatFisioterapiaConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: FISIOTERAPIA_INITIAL_CONSULTATION_LABEL,
    label: FISIOTERAPIA_INITIAL_CONSULTATION_LABEL,
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
  select.value = firstEnabled ? firstEnabled.value : FISIOTERAPIA_INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialFisioterapiaConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialFisioterapiaConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return fisioterapiaState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialFisioterapiaConsultation(record.consultation_number)
  ));
}

function normalizeFisioterapiaConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parseFisioterapiaConsultationOrdinal(normalized);
  return ordinal ? formatFisioterapiaConsultationLabel(ordinal) : "";
}

function isInitialFisioterapiaConsultation(value) {
  return parseFisioterapiaConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseFisioterapiaConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatFisioterapiaConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? FISIOTERAPIA_INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function resolveFisioterapiaPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findFisioterapiaPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFisioterapiaPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    fisioterapiaState.patients = mergeFisioterapiaPatients(fisioterapiaState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findFisioterapiaPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return fisioterapiaState.patients.find((item) => item.id === normalizedId) || null;
}

function updateFisioterapiaPatientSummary(patient) {
  const element = document.getElementById("fisioterapia-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findFisioterapiaPatientById(patient.id) || normalizeFisioterapiaPatient(patient);
  const ageYears = getFisioterapiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderFisioterapiaPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderFisioterapiaPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderFisioterapiaPatientSummaryItem("Cor/Raça", formatFisioterapiaRace(fullPatient.race)),
    renderFisioterapiaPatientSummaryItem("Idade", ageLabel),
    renderFisioterapiaPatientSummaryItem("Nascimento", formatFisioterapiaDate(fullPatient.birth_date)),
    renderFisioterapiaPatientSummaryItem("1º atendimento CADH", formatFisioterapiaDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderFisioterapiaPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateFisioterapiaAgeGuidance(patient) {
  const element = document.getElementById("fisioterapia-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findFisioterapiaPatientById(patient.id) || normalizeFisioterapiaPatient(patient);
  const ageYears = getFisioterapiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getFisioterapiaAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getFisioterapiaAgeYears(patient) {
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

function getFisioterapiaAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Registre funcionalidade, dor, prótese, atividade física, barreiras e orientação combinada.";
  }

  if (ageYears < 2) {
    return "Considere avaliação com responsável, desenvolvimento motor, tônus, dor e sinais de alerta.";
  }

  if (ageYears < 10) {
    return "Observe desenvolvimento motor, rotina escolar, participação familiar e funcionalidade nas atividades diárias.";
  }

  if (ageYears < 20) {
    return "Considere autonomia, prática de atividade, dor, barreiras ambientais e adesão ao plano.";
  }

  if (ageYears >= 60) {
    return "Considere risco de queda, força, equilíbrio, mobilidade, dor crônica, prótese e barreiras domiciliares.";
  }

  return "Avalie dor, mobilidade, funcionalidade, atividade física, barreiras e metas pactuadas.";
}

function renderFisioterapiaViewRecord(record) {
  const item = record || {};

  return `
    ${renderFisioterapiaViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatFisioterapiaRace(item.race)],
      ["Data de nascimento", formatFisioterapiaDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatFisioterapiaDate(item.first_cadh_date)],
      ["Data da consulta", formatFisioterapiaDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderFisioterapiaViewSection("Avaliação funcional", [
      ["Amputação", item.amputation || "-"],
      ["Prótese", item.prosthesis || "-"],
      ["Presença de dor", item.pain_presence || "-"],
    ])}
    ${renderFisioterapiaViewSection("Atividade física", [
      ["Modalidade", item.activity_modality || "-"],
      ["Intensidade", item.intensity || "-"],
      ["Tempo por semana", item.weekly_time || "-"],
    ])}
    ${renderFisioterapiaViewSection("Plano de cuidado", [
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers || "-", true],
      ["Recomendações - Ficha Plano de Cuidado", item.recommendations || "-", true],
    ])}
  `;
}

function renderFisioterapiaViewSection(title, items) {
  return `
    <section class="fisioterapia-view-section">
      <h3 class="fisioterapia-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="fisioterapia-view-grid">
        ${items.map(([label, value, wide]) => renderFisioterapiaViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderFisioterapiaViewItem(label, value, wide = false) {
  return `
    <div class="fisioterapia-view-item${wide ? " is-wide" : ""}">
      <span class="fisioterapia-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="fisioterapia-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderFisioterapiaTable() {
  const tbody = document.getElementById("fisioterapia-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(fisioterapiaState.activePatientId);
  const records = fisioterapiaState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseFisioterapiaConsultationOrdinal(right.consultation_number) -
        parseFisioterapiaConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Fisioterapia encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Fisioterapia.";
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="fisioterapia-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindFisioterapiaTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatFisioterapiaDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.barriers || "-")}</td>
      <td>${SISELO.escapeHtml(record.recommendations || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver consulta de Fisioterapia", { "data-fisioterapia-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-fisioterapia-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-fisioterapia-edit": record.id })}
          ${SISELO.iconButton("delete", "Remover registro", { "data-fisioterapia-delete": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindFisioterapiaTableActions();
}

function bindFisioterapiaTableActions() {
  const tbody = document.getElementById("fisioterapia-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-fisioterapia-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = fisioterapiaState.records.find((item) => item.id === button.dataset.fisioterapiaEdit);
      if (record) {
        openFisioterapiaModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-fisioterapia-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = fisioterapiaState.records.find((item) => item.id === button.dataset.fisioterapiaView);
      if (record) {
        openFisioterapiaViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-fisioterapia-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });

  tbody.querySelectorAll("[data-fisioterapia-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = fisioterapiaState.records.find((item) => item.id === button.dataset.fisioterapiaDelete);
      if (!record || !(await SISELO.confirmPermanentDeletion("o registro de Fisioterapia", record.consultation_number))) {
        return;
      }

      fisioterapiaState.records = fisioterapiaState.records.filter((item) => item.id !== record.id);
      writeFisioterapiaRecords(fisioterapiaState.records);
      renderFisioterapiaTable();
    });
  });
}

function getFisioterapiaPlanSummary(record) {
  return record.recommendations || record.barriers || "-";
}

function readFisioterapiaRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FISIOTERAPIA_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeFisioterapiaRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeFisioterapiaRecords(records) {
  try {
    localStorage.setItem(
      FISIOTERAPIA_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeFisioterapiaRecord(record) {
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
    consultation_number: normalizeFisioterapiaConsultationLabel(record && record.consultation_number) || FISIOTERAPIA_INITIAL_CONSULTATION_LABEL,
    amputation: normalizeFisioterapiaYesNo(record && record.amputation),
    prosthesis: normalizeFisioterapiaProsthesis(record && record.prosthesis),
    pain_presence: normalizeFisioterapiaYesNo(record && record.pain_presence),
    activity_modality: normalizeFisioterapiaActivityModality(record && record.activity_modality),
    intensity: normalizeFisioterapiaIntensity(record && record.intensity),
    weekly_time: String((record && record.weekly_time) || "").trim(),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeFisioterapiaYesNo(value) {
  const normalized = SISELO.normalizeSearchText(value);
  if (normalized === "sim") {
    return "Sim";
  }
  if (normalized === "nao") {
    return "Não";
  }
  return String(value || "").trim();
}

function normalizeFisioterapiaProsthesis(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "sem necessidade": "Sem necessidade",
    "com necessidade": "Com necessidade",
    "sem resposta": "Sem resposta",
    "com necessidade sem resposta": "Sem resposta",
    "utilizando protese prescrita": "Utilizando protese prescrita",
  };

  return legacyValues[normalized] || original;
}

function normalizeFisioterapiaActivityModality(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "tempo livre ou lazer": "Tempo livre ou Lazer",
    "atividade ocupacional": "Atividade ocupacional",
    deslocamento: "Deslocamento",
    "ambito das atividades domesticas": "Âmbito das atividades domésticas",
  };

  return legacyValues[normalized] || original;
}

function normalizeFisioterapiaIntensity(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    leve: "Leve",
    moderado: "Moderado",
    moderada: "Moderado",
    vigorosa: "Vigorosa",
    vigoroso: "Vigorosa",
  };

  return legacyValues[normalized] || original;
}

function createFisioterapiaRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `fisioterapia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFisioterapiaDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatFisioterapiaRace(value) {
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
