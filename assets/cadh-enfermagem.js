const ENFERMAGEM_STORAGE_KEY = "siselo_cadh_enfermagem_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const INITIAL_CONSULTATION_LABEL = "1\u00AA Consulta (inicial)";

const enfermagemState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-enfermagem") {
    return;
  }

  setupEnfermagemPage();
});

async function setupEnfermagemPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  enfermagemState.activePatientId = getEnfermagemContextPatientId();
  enfermagemState.records = readEnfermagemRecords();
  bindEnfermagemModal();
  bindEnfermagemViewModal();
  bindEnfermagemClinicalRules();

  SISELO.enhanceDateInput("enfermagem_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  updateEnfermagemConsultationOptions("");
  syncEnfermagemConsultationSections();

  enfermagemState.patients = await loadEnfermagemPatients();
  enfermagemState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "enfermagem_patient_id",
    container: "enfermagem_patient_search",
    rows: enfermagemState.patients,
    currentValue: enfermagemState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (enfermagemState.activePatientId) {
        const scopedPatient = getActiveEnfermagemPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (enfermagemState.patientPicker && scopedPatient && pickedPatientId !== enfermagemState.activePatientId) {
          enfermagemState.patientPicker.setValue(scopedPatient);
        }
        updateEnfermagemConsultationOptions(enfermagemState.activePatientId, enfermagemState.editingRecordId);
        updateEnfermagemPatientSummary(scopedPatient);
        updateEnfermagemAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findEnfermagemPatientById(patient.id) || patient
        : null;
      updateEnfermagemConsultationOptions(patient && patient.id, enfermagemState.editingRecordId);
      updateEnfermagemPatientSummary(selectedPatient);
      updateEnfermagemAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#enfermagem_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "enfermagem_patient_search_input";
  }

  applyEnfermagemPatientScope();
  updateEnfermagemScopeControls();
  renderEnfermagemTable();
}

function bindEnfermagemModal() {
  const modal = document.getElementById("enfermagem-modal");
  const form = document.getElementById("enfermagem-form");
  const newButton = document.getElementById("enfermagem-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openEnfermagemModal();
  });

  modal.querySelectorAll("[data-enfermagem-close]").forEach((button) => {
    button.addEventListener("click", () => closeEnfermagemModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEnfermagemModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeEnfermagemModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEnfermagemRecord();
  });
}

function bindEnfermagemViewModal() {
  const modal = document.getElementById("enfermagem-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-enfermagem-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeEnfermagemViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEnfermagemViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeEnfermagemViewModal();
    }
  });
}

function bindEnfermagemClinicalRules() {
  const consultationSelect = document.getElementById("enfermagem_consultation_number");
  if (consultationSelect instanceof HTMLSelectElement) {
    consultationSelect.addEventListener("change", syncEnfermagemConsultationSections);
  }
}

async function loadEnfermagemPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeEnfermagemPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getEnfermagemContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveEnfermagemPatient() {
  const patientId = SISELO.normalizeEntityId(enfermagemState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findEnfermagemPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeEnfermagemPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyEnfermagemPatientScope() {
  const scopedPatient = getActiveEnfermagemPatient();
  if (!scopedPatient || !enfermagemState.patientPicker) {
    return;
  }

  enfermagemState.patientPicker.setValue(scopedPatient);
  updateEnfermagemConsultationOptions(scopedPatient.id, enfermagemState.editingRecordId);
  updateEnfermagemPatientSummary(scopedPatient);
  updateEnfermagemAgeGuidance(scopedPatient);

  const input = document.querySelector("#enfermagem_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateEnfermagemScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(enfermagemState.activePatientId));
  const newButton = document.getElementById("enfermagem-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Enfermagem.";
  }
}

function mergeEnfermagemPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeEnfermagemPatient(row);
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

function normalizeEnfermagemPatient(patient) {
  return {
    id: SISELO.normalizeEntityId(patient && patient.id),
    full_name: String((patient && patient.full_name) || "").trim(),
    cpf: String((patient && patient.cpf) || "").trim(),
    ses: String((patient && patient.ses) || "").trim(),
    birth_date: String((patient && patient.birth_date) || "").trim(),
    first_cadh_date: String((patient && patient.first_cadh_date) || "").trim(),
    age_label: String((patient && patient.age_label) || "").trim(),
    race: String((patient && (patient.race || patient.race_label || patient.color_race)) || "").trim(),
  };
}

function openEnfermagemModal(record = null) {
  const modal = document.getElementById("enfermagem-modal");
  const form = document.getElementById("enfermagem-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(enfermagemState.activePatientId)) {
    SISELO.showAlert("enfermagem-alert", "Selecione um usuário no CADH antes de criar um registro de Enfermagem.", "error");
    return;
  }

  enfermagemState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("enfermagem-alert", "", "info");
  fillEnfermagemForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#enfermagem_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeEnfermagemModal() {
  const modal = document.getElementById("enfermagem-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (enfermagemState.lastFocus instanceof HTMLElement) {
    enfermagemState.lastFocus.focus();
  }
}

function openEnfermagemViewModal(record) {
  const modal = document.getElementById("enfermagem-view-modal");
  const content = document.getElementById("enfermagem-view-content");
  if (!modal || !content) {
    return;
  }

  enfermagemState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderEnfermagemViewRecord(normalizeEnfermagemRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-enfermagem-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeEnfermagemViewModal() {
  const modal = document.getElementById("enfermagem-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (enfermagemState.lastFocus instanceof HTMLElement) {
    enfermagemState.lastFocus.focus();
  }
}

function fillEnfermagemForm(record = null) {
  const normalizedRecord = record ? normalizeEnfermagemRecord(record) : null;
  enfermagemState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeEnfermagemPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeEnfermagemPatient({
      id: normalizedRecord.patient_id,
      full_name: normalizedRecord.full_name,
      cpf: normalizedRecord.cpf,
      ses: normalizedRecord.ses,
      birth_date: normalizedRecord.birth_date,
      first_cadh_date: normalizedRecord.first_cadh_date,
      age_label: normalizedRecord.age_label,
      race: normalizedRecord.race,
    })
    : null;
  const selectedPatient = normalizedRecord
    ? findEnfermagemPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveEnfermagemPatient() || cachedPatient;

  setEnfermagemField("enfermagem_record_id", normalizedRecord ? normalizedRecord.id : "");
  setEnfermagemField("enfermagem_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setEnfermagemField("enfermagem_dm_diagnosis_time", normalizedRecord ? normalizedRecord.dm_diagnosis_time : "");
  setEnfermagemField("enfermagem_has_diagnosis_time", normalizedRecord ? normalizedRecord.has_diagnosis_time : "");
  setEnfermagemField("enfermagem_family_history", normalizedRecord ? normalizedRecord.family_history : "");
  setEnfermagemField("enfermagem_sedentary", normalizedRecord ? normalizedRecord.sedentary : "");
  setEnfermagemField("enfermagem_medication_treatment", normalizedRecord ? normalizedRecord.medication_treatment : "");
  setEnfermagemField("enfermagem_smoking", normalizedRecord ? normalizedRecord.smoking : "");
  setEnfermagemField("enfermagem_alcohol_use", normalizedRecord ? normalizedRecord.alcohol_use : "");
  setEnfermagemField("enfermagem_foot_psp", normalizedRecord ? normalizedRecord.foot_psp : "");
  setEnfermagemField("enfermagem_foot_deformity", normalizedRecord ? normalizedRecord.foot_deformity : "");
  setEnfermagemField("enfermagem_foot_polyneuropathy", normalizedRecord ? normalizedRecord.foot_polyneuropathy : "");
  setEnfermagemField("enfermagem_foot_neuropathic_pain", normalizedRecord ? normalizedRecord.foot_neuropathic_pain : "");
  setEnfermagemField("enfermagem_amputation", normalizedRecord ? normalizedRecord.amputation : "");
  setEnfermagemField("enfermagem_active_ulcer", normalizedRecord ? normalizedRecord.active_ulcer : "");
  setEnfermagemField("enfermagem_previous_ulcer", normalizedRecord ? normalizedRecord.previous_ulcer : "");
  setEnfermagemField("enfermagem_risk_classification", normalizedRecord ? normalizedRecord.risk_classification : "");
  setEnfermagemField("enfermagem_orthosis_referral", normalizedRecord ? normalizedRecord.orthosis_referral : "");
  setEnfermagemField("enfermagem_oral_health_need", normalizedRecord ? normalizedRecord.oral_health_need : "");
  setEnfermagemField("enfermagem_barriers_plan", normalizedRecord ? normalizedRecord.barriers_plan : "");
  setEnfermagemField("enfermagem_recommendations_plan", normalizedRecord ? normalizedRecord.recommendations_plan : "");
  setEnfermagemField("enfermagem_followed_previous_guidance", normalizedRecord ? normalizedRecord.followed_previous_guidance : "");

  if (enfermagemState.patientPicker) {
    enfermagemState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateEnfermagemPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateEnfermagemAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateEnfermagemConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    enfermagemState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );
  syncEnfermagemConsultationSections();

  const dateInput = document.getElementById("enfermagem_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setEnfermagemField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function syncEnfermagemConsultationSections() {
  const select = document.getElementById("enfermagem_consultation_number");
  const initialSections = [
    document.getElementById("enfermagem-initial-section"),
    document.getElementById("enfermagem-foot-section"),
    document.getElementById("enfermagem-care-section"),
  ];
  const subsequentSection = document.getElementById("enfermagem-subsequent-section");
  const isInitial = !(select instanceof HTMLSelectElement) || isInitialEnfermagemConsultation(select.value);

  initialSections.forEach((section) => {
    if (!section) {
      return;
    }

    section.hidden = false;
    setEnfermagemSectionDisabled(section, false);
  });

  if (subsequentSection) {
    subsequentSection.hidden = isInitial;
    setEnfermagemSectionDisabled(subsequentSection, isInitial);
  }
}

function setEnfermagemSectionDisabled(section, disabled) {
  section.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = disabled;
  });
}

function updateEnfermagemConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("enfermagem_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeEnfermagemConsultationLabel(preferredValue);
  const patientRecords = enfermagemState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialEnfermagemConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialEnfermagemConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseEnfermagemConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseEnfermagemConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatEnfermagemConsultationLabel(preferredOrdinal)
    : formatEnfermagemConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: INITIAL_CONSULTATION_LABEL,
    label: INITIAL_CONSULTATION_LABEL,
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
  } else {
    const firstEnabled = options.find((option) => !option.disabled);
    select.value = firstEnabled ? firstEnabled.value : INITIAL_CONSULTATION_LABEL;
  }

  syncEnfermagemConsultationSections();
}

function hasDuplicateInitialEnfermagemConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialEnfermagemConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return enfermagemState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialEnfermagemConsultation(record.consultation_number)
  ));
}

function normalizeEnfermagemConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parseEnfermagemConsultationOrdinal(normalized);
  return ordinal ? formatEnfermagemConsultationLabel(ordinal) : "";
}

function isInitialEnfermagemConsultation(value) {
  return parseEnfermagemConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseEnfermagemConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatEnfermagemConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function saveEnfermagemRecord() {
  const form = document.getElementById("enfermagem-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "enfermagem-alert" })) {
    return;
  }

  const patientId = enfermagemState.activePatientId || (enfermagemState.patientPicker
    ? enfermagemState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("enfermagem-alert", "Selecione o paciente.", "error");
    if (enfermagemState.patientPicker) {
      enfermagemState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const consultationNumber = payload.consultation_number || INITIAL_CONSULTATION_LABEL;
  const isInitial = isInitialEnfermagemConsultation(consultationNumber);
  const missingFields = validateEnfermagemRequiredFields(payload, isInitial);

  if (missingFields.length) {
    SISELO.showAlert("enfermagem-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingEnfermagemField(missingFields[0], isInitial);
    return;
  }

  if (hasDuplicateInitialEnfermagemConsultation(patientId, payload.record_id || "", consultationNumber)) {
    SISELO.showAlert("enfermagem-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateEnfermagemConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveEnfermagemPatient(patientId);
  const record = normalizeEnfermagemRecord({
    id: payload.record_id || createEnfermagemRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    ses: patient.ses || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: consultationNumber,
    dm_diagnosis_time: payload.dm_diagnosis_time,
    has_diagnosis_time: payload.has_diagnosis_time,
    family_history: payload.family_history,
    sedentary: payload.sedentary,
    medication_treatment: payload.medication_treatment,
    smoking: payload.smoking,
    alcohol_use: payload.alcohol_use,
    foot_psp: payload.foot_psp,
    foot_deformity: payload.foot_deformity,
    foot_polyneuropathy: payload.foot_polyneuropathy,
    foot_neuropathic_pain: payload.foot_neuropathic_pain,
    amputation: payload.amputation,
    active_ulcer: payload.active_ulcer,
    previous_ulcer: payload.previous_ulcer,
    risk_classification: payload.risk_classification,
    orthosis_referral: payload.orthosis_referral,
    oral_health_need: payload.oral_health_need,
    barriers_plan: payload.barriers_plan,
    recommendations_plan: payload.recommendations_plan,
    followed_previous_guidance: isInitial ? "" : payload.followed_previous_guidance,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("enfermagem-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = enfermagemState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    enfermagemState.records[existingIndex] = record;
  } else {
    enfermagemState.records.unshift(record);
  }

  writeEnfermagemRecords(enfermagemState.records);
  renderEnfermagemTable();
  closeEnfermagemModal();
}

function validateEnfermagemRequiredFields(payload, isInitial) {
  const initialFields = [
    ["consultation_date", "Data da consulta"],
    ["dm_diagnosis_time", "Tempo de diagnóstico para DM"],
    ["has_diagnosis_time", "Tempo de diagnóstico para HAS"],
    ["family_history", "Antecedentes familiares"],
    ["sedentary", "Sedentarismo"],
    ["medication_treatment", "Tratamento medicamentoso"],
    ["smoking", "Tabagismo"],
    ["alcohol_use", "Consumo de bebidas alcoolicas"],
    ["foot_psp", "Perda de Sensação Protetora (PSP)"],
    ["foot_deformity", "Deforminade"],
    ["foot_polyneuropathy", "Polineuropatia diabética"],
    ["foot_neuropathic_pain", "Dor neuropática"],
    ["amputation", "Amputação"],
    ["active_ulcer", "Úlcera ativa"],
    ["previous_ulcer", "Úlcera prévia"],
    ["risk_classification", "Classificação de risco e seguimento"],
    ["orthosis_referral", "Encaminhamento para Oficina de Órtese e Prótese"],
    ["oral_health_need", "Necessidade de cuidados de saúde bucal"],
    ["barriers_plan", "Fatores dificultadores"],
    ["recommendations_plan", "Recomendações"],
  ];
  const subsequentFields = [
    ["consultation_date", "Data da consulta"],
    ["followed_previous_guidance", "Usuário seguiu as orientações prévias"],
  ];

  const requiredFields = isInitial
    ? initialFields
    : initialFields.concat(subsequentFields.filter(([field]) => field !== "consultation_date"));

  return requiredFields
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingEnfermagemField(label, isInitial) {
  const fieldMap = {
    "Data da consulta": "enfermagem_consultation_date",
    "Tempo de diagnóstico para DM": "enfermagem_dm_diagnosis_time",
    "Tempo de diagnóstico para HAS": "enfermagem_has_diagnosis_time",
    "Antecedentes familiares": "enfermagem_family_history",
    Sedentarismo: "enfermagem_sedentary",
    "Tratamento medicamentoso": "enfermagem_medication_treatment",
    Tabagismo: "enfermagem_smoking",
    "Consumo de bebidas alcoolicas": "enfermagem_alcohol_use",
    "Perda de Sensação Protetora (PSP)": "enfermagem_foot_psp",
    Deforminade: "enfermagem_foot_deformity",
    "Polineuropatia diabética": "enfermagem_foot_polyneuropathy",
    "Dor neuropática": "enfermagem_foot_neuropathic_pain",
    Amputação: "enfermagem_amputation",
    "Úlcera ativa": "enfermagem_active_ulcer",
    "Úlcera prévia": "enfermagem_previous_ulcer",
    "Classificação de risco e seguimento": "enfermagem_risk_classification",
    "Encaminhamento para Oficina de Órtese e Prótese": "enfermagem_orthosis_referral",
    "Necessidade de cuidados de saúde bucal": "enfermagem_oral_health_need",
    "Fatores dificultadores": "enfermagem_barriers_plan",
    Recomendações: "enfermagem_recommendations_plan",
    "Usuário seguiu as orientações prévias": "enfermagem_followed_previous_guidance",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (!isInitial) {
    syncEnfermagemConsultationSections();
  }

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function resolveEnfermagemPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findEnfermagemPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeEnfermagemPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    enfermagemState.patients = mergeEnfermagemPatients(enfermagemState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", ses: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findEnfermagemPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return enfermagemState.patients.find((item) => item.id === normalizedId) || null;
}

function updateEnfermagemPatientSummary(patient) {
  const element = document.getElementById("enfermagem-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findEnfermagemPatientById(patient.id) || normalizeEnfermagemPatient(patient);
  const ageYears = getEnfermagemAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderEnfermagemPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderEnfermagemPatientSummaryItem("SES", fullPatient.ses || "-"),
    renderEnfermagemPatientSummaryItem("Cor/Raça", formatEnfermagemRace(fullPatient.race)),
    renderEnfermagemPatientSummaryItem("Idade", ageLabel),
    renderEnfermagemPatientSummaryItem("Nascimento", formatEnfermagemDate(fullPatient.birth_date)),
    renderEnfermagemPatientSummaryItem("1º atendimento CADH", formatEnfermagemDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderEnfermagemPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateEnfermagemAgeGuidance(patient) {
  const element = document.getElementById("enfermagem-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findEnfermagemPatientById(patient.id) || normalizeEnfermagemPatient(patient);
  const ageYears = getEnfermagemAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getEnfermagemAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getEnfermagemAgeYears(patient) {
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

function getEnfermagemAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Avalie adesão, uso de medicação, autocuidado, risco nos pés, saúde bucal e barreiras para o cuidado.";
  }

  if (ageYears < 2) {
    return "Confirme responsável presente, desenvolvimento, sinais de alerta e orientações de cuidado domiciliar.";
  }

  if (ageYears < 10) {
    return "Inclua responsável, rotina familiar, hábitos, uso correto de medicações e sinais de alerta.";
  }

  if (ageYears < 20) {
    return "Considere autonomia, apoio familiar, adesão, hábitos e educação em saúde.";
  }

  if (ageYears >= 60) {
    return "Considere fragilidade, visão, audição, risco de queda, uso de múltiplos medicamentos e cuidados com os pés.";
  }

  return "Avalie adesão, hábitos, uso correto das medicações, cuidado com os pés e metas pactuadas.";
}

function renderEnfermagemViewRecord(record) {
  const item = record || {};
  const isInitial = isInitialEnfermagemConsultation(item.consultation_number);

  return `
    ${renderEnfermagemViewSection("Identificação", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["SES", item.ses || "-"],
      ["Cor/Raça", formatEnfermagemRace(item.race)],
      ["Data de nascimento", formatEnfermagemDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatEnfermagemDate(item.first_cadh_date)],
    ])}
    ${renderEnfermagemViewSection("Consulta", [
      ["Data da consulta", formatEnfermagemDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
      ...(!isInitial ? [["Usuário seguiu as orientações prévias?", item.followed_previous_guidance || "-"]] : []),
    ])}
    ${renderEnfermagemViewSection("Informações clínicas", [
      ["Tempo de diagnóstico para DM (desde de...)", item.dm_diagnosis_time || "-"],
      ["Tempo de diagnóstico para HAS (desde de...)", item.has_diagnosis_time || "-"],
      ["Antecedentes familiares", item.family_history || "-"],
      ["Sedentarismo", item.sedentary || "-"],
      ["Tratamento medicamentoso", item.medication_treatment || "-"],
      ["Tabagismo", item.smoking || "-"],
      ["Consumo de bebidas alcoolicas", item.alcohol_use || "-"],
    ])}
    ${renderEnfermagemViewSection("Avaliação dos pés", [
      ["Perda de Sensação Protetora (PSP)", item.foot_psp || "-"],
      ["Deforminade", item.foot_deformity || "-"],
      ["Polineuropatia diabética", item.foot_polyneuropathy || "-"],
      ["Dor neuropática", item.foot_neuropathic_pain || "-"],
      ["Amputação", item.amputation || "-"],
      ["Úlcera ativa", item.active_ulcer || "-"],
      ["Úlcera prévia", item.previous_ulcer || "-"],
      ["Classificação de risco e seguimento", item.risk_classification || "-"],
      ["Encaminhamento para Oficina de Órtese e Prótese da SES", item.orthosis_referral || "-"],
      ["Necessidade de cuidados de saúde bucal?", item.oral_health_need || "-"],
    ])}
    ${renderEnfermagemViewSection("Plano de cuidado", [
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers_plan || "-", true],
      ["Recomendações - Ficha Plano de Cuidado", item.recommendations_plan || "-", true],
    ])}
  `;
}

function renderEnfermagemViewSection(title, items) {
  return `
    <section class="enfermagem-view-section">
      <h3 class="enfermagem-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="enfermagem-view-grid">
        ${items.map(([label, value, wide]) => renderEnfermagemViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderEnfermagemViewItem(label, value, wide = false) {
  return `
    <div class="enfermagem-view-item${wide ? " is-wide" : ""}">
      <span class="enfermagem-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="enfermagem-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderEnfermagemTable() {
  const tbody = document.getElementById("enfermagem-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(enfermagemState.activePatientId);
  const records = enfermagemState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .sort((left, right) => {
      const consultationOrder = parseEnfermagemConsultationOrdinal(right.consultation_number) -
        parseEnfermagemConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Enfermagem encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Enfermagem.";
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="enfermagem-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
            ${activePatientId ? '<button type="button" class="btn btn-primary" data-enfermagem-empty-new>+ Novo registro</button>' : ""}
          </div>
        </td>
      </tr>
    `;
    bindEnfermagemTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatEnfermagemDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(getEnfermagemDiagnosisSummary(record))}</td>
      <td>${SISELO.escapeHtml(record.medication_treatment || "-")}</td>
      <td>${SISELO.escapeHtml(getEnfermagemFootSummary(record))}</td>
      <td>${SISELO.escapeHtml(record.risk_classification || "-")}</td>
      <td>${SISELO.escapeHtml(getEnfermagemPlanSummary(record))}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver guia clínica", { "data-enfermagem-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-enfermagem-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-enfermagem-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindEnfermagemTableActions();
}

function bindEnfermagemTableActions() {
  const tbody = document.getElementById("enfermagem-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-enfermagem-empty-new]").forEach((button) => {
    button.addEventListener("click", () => openEnfermagemModal());
  });

  tbody.querySelectorAll("[data-enfermagem-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = enfermagemState.records.find((item) => item.id === button.dataset.enfermagemEdit);
      if (record) {
        openEnfermagemModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-enfermagem-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = enfermagemState.records.find((item) => item.id === button.dataset.enfermagemView);
      if (record) {
        openEnfermagemViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-enfermagem-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function getEnfermagemDiagnosisSummary(record) {
  if (!isInitialEnfermagemConsultation(record.consultation_number)) {
    const parts = [];
    if (record.dm_diagnosis_time) {
      parts.push(`DM: ${record.dm_diagnosis_time}`);
    }
    if (record.has_diagnosis_time) {
      parts.push(`HAS: ${record.has_diagnosis_time}`);
    }
    return parts.join(" | ") || "-";
  }

  const parts = [];
  if (record.dm_diagnosis_time) {
    parts.push(`DM: ${record.dm_diagnosis_time}`);
  }
  if (record.has_diagnosis_time) {
    parts.push(`HAS: ${record.has_diagnosis_time}`);
  }
  return parts.join(" | ") || "-";
}

function getEnfermagemFootSummary(record) {
  const positives = [
    ["PSP", record.foot_psp],
    ["Deformidade", record.foot_deformity],
    ["PND", record.foot_polyneuropathy],
    ["Dor", record.foot_neuropathic_pain],
    ["Úlcera ativa", record.active_ulcer],
    ["Úlcera prévia", record.previous_ulcer],
  ]
    .filter(([, value]) => String(value || "").toLowerCase() === "sim")
    .map(([label]) => label);

  if (record.amputation && record.amputation !== "Não") {
    positives.push(record.amputation);
  }

  return positives.length ? positives.join(", ") : "Sem alterações registradas";
}

function getEnfermagemPlanSummary(record) {
  return record.recommendations_plan || record.barriers_plan || record.followed_previous_guidance || "-";
}

function readEnfermagemRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENFERMAGEM_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeEnfermagemRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeEnfermagemRecords(records) {
  try {
    localStorage.setItem(
      ENFERMAGEM_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeEnfermagemRecord(record) {
  const id = String((record && record.id) || "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    patient_id: SISELO.normalizeEntityId(record && record.patient_id),
    full_name: String((record && record.full_name) || "").trim(),
    cpf: String((record && record.cpf) || "").trim(),
    ses: String((record && record.ses) || "").trim(),
    birth_date: String((record && record.birth_date) || "").trim(),
    first_cadh_date: String((record && record.first_cadh_date) || "").trim(),
    age_label: String((record && record.age_label) || "").trim(),
    race: String((record && record.race) || "").trim(),
    consultation_date: String((record && record.consultation_date) || "").trim(),
    consultation_number: normalizeEnfermagemConsultationLabel(record && record.consultation_number) || INITIAL_CONSULTATION_LABEL,
    dm_diagnosis_time: String((record && record.dm_diagnosis_time) || "").trim(),
    has_diagnosis_time: String((record && record.has_diagnosis_time) || "").trim(),
    family_history: String((record && record.family_history) || "").trim(),
    sedentary: String((record && record.sedentary) || "").trim(),
    medication_treatment: normalizeEnfermagemMedicationTreatment(record && record.medication_treatment),
    smoking: String((record && record.smoking) || "").trim(),
    alcohol_use: String((record && record.alcohol_use) || "").trim(),
    foot_psp: String((record && record.foot_psp) || "").trim(),
    foot_deformity: String((record && record.foot_deformity) || "").trim(),
    foot_polyneuropathy: String((record && record.foot_polyneuropathy) || "").trim(),
    foot_neuropathic_pain: String((record && record.foot_neuropathic_pain) || "").trim(),
    amputation: String((record && record.amputation) || "").trim(),
    active_ulcer: String((record && record.active_ulcer) || "").trim(),
    previous_ulcer: String((record && record.previous_ulcer) || "").trim(),
    risk_classification: String((record && record.risk_classification) || "").trim(),
    orthosis_referral: String((record && record.orthosis_referral) || "").trim(),
    oral_health_need: String((record && record.oral_health_need) || "").trim(),
    barriers_plan: String((record && record.barriers_plan) || "").trim(),
    recommendations_plan: String((record && record.recommendations_plan) || "").trim(),
    followed_previous_guidance: String((record && record.followed_previous_guidance) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeEnfermagemMedicationTreatment(value) {
  const normalized = String(value || "").trim();
  const simple = normalized.toLowerCase();

  if (!normalized) {
    return "";
  }

  if (simple === "1 a 5 medicamentos") {
    return "1 a 5 medicamentos de uso contínuo";
  }

  if (simple === "6 a 10 medicamentos") {
    return "6 a 10 medicamentos (polifarmácia)";
  }

  if (simple === "> 10 medicamentos" || simple === "acima de 10 medicamentos") {
    return "Acima de 10 medicamentos (polifarmácia excessiva)";
  }

  return normalized;
}

function createEnfermagemRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `enfermagem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatEnfermagemDate(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return normalized || "-";
}

function formatEnfermagemRace(value) {
  const normalized = String(value || "").trim();
  return normalized || "-";
}
