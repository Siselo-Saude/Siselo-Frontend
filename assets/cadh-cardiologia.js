const CARDIOLOGIA_STORAGE_KEY = "siselo_cadh_cardiologia_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const INITIAL_CONSULTATION_LABEL = "1\u00AA Consulta (inicial)";
const CARDIOLOGIA_LDL_HINT = "Informe somente o valor numérico do LDL em mg/dl, sem texto ou unidade.";

const cardiologiaState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
  lastTypingAlertAt: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-cardiologia") {
    return;
  }

  setupCardiologiaPage();
});

async function setupCardiologiaPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  cardiologiaState.activePatientId = getCardiologiaContextPatientId();
  cardiologiaState.records = readCardiologiaRecords();
  bindCardiologiaModal();
  bindCardiologiaViewModal();
  bindCardiologiaClinicalRules();
  SISELO.bindFieldGuidanceTooltips();

  SISELO.enhanceDateInput("cardiologia_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });
  bindCardiologiaLdlField();
  updateCardiologiaConsultationOptions("");
  updateCardiologiaInitialFields();
  syncCardiologiaCoronaryClassification();
  syncCardiologiaRecentEventDetail();

  cardiologiaState.patients = await loadCardiologiaPatients();
  cardiologiaState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "cardiologia_patient_id",
    container: "cardiologia_patient_search",
    rows: cardiologiaState.patients,
    currentValue: cardiologiaState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (cardiologiaState.activePatientId) {
        const scopedPatient = getActiveCardiologiaPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (cardiologiaState.patientPicker && scopedPatient && pickedPatientId !== cardiologiaState.activePatientId) {
          cardiologiaState.patientPicker.setValue(scopedPatient);
        }
        updateCardiologiaConsultationOptions(cardiologiaState.activePatientId, cardiologiaState.editingRecordId);
        updateCardiologiaPatientSummary(scopedPatient);
        updateCardiologiaAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findCardiologiaPatientById(patient.id) || patient
        : null;
      updateCardiologiaConsultationOptions(patient && patient.id, cardiologiaState.editingRecordId);
      updateCardiologiaPatientSummary(selectedPatient);
      updateCardiologiaAgeGuidance(selectedPatient);
      updateCardiologiaInitialFields();
      syncCardiologiaCoronaryClassification();
    },
  });

  const patientSearchInput = document.querySelector("#cardiologia_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "cardiologia_patient_search_input";
  }

  applyCardiologiaPatientScope();
  updateCardiologiaScopeControls();
  renderCardiologiaTable();
}

function bindCardiologiaModal() {
  const modal = document.getElementById("cardiologia-modal");
  const form = document.getElementById("cardiologia-form");
  const newButton = document.getElementById("cardiologia-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openCardiologiaModal();
  });

  modal.querySelectorAll("[data-cardiologia-close]").forEach((button) => {
    button.addEventListener("click", () => closeCardiologiaModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCardiologiaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeCardiologiaModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCardiologiaRecord();
  });
}

function bindCardiologiaViewModal() {
  const modal = document.getElementById("cardiologia-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-cardiologia-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeCardiologiaViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCardiologiaViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeCardiologiaViewModal();
    }
  });
}

function bindCardiologiaClinicalRules() {
  const consultationSelect = document.getElementById("cardiologia_consultation_number");
  if (consultationSelect instanceof HTMLSelectElement) {
    consultationSelect.addEventListener("change", () => {
      updateCardiologiaInitialFields();
      syncCardiologiaCoronaryClassification();
      syncCardiologiaRecentEventDetail();
    });
  }

  const coronarySelect = document.getElementById("cardiologia_coronary_disease");
  if (coronarySelect instanceof HTMLSelectElement) {
    coronarySelect.addEventListener("change", () => {
      syncCardiologiaCoronaryClassification();
    });
  }

  const coronaryClassificationSelect = document.getElementById("cardiologia_coronary_classification");
  if (coronaryClassificationSelect instanceof HTMLSelectElement) {
    coronaryClassificationSelect.addEventListener("change", () => {
      syncCardiologiaCoronaryClassification();
    });
  }

  const recentEventSelect = document.getElementById("cardiologia_recent_event");
  if (recentEventSelect instanceof HTMLSelectElement) {
    recentEventSelect.addEventListener("change", () => {
      syncCardiologiaRecentEventDetail();
    });
  }
}

async function loadCardiologiaPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeCardiologiaPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getCardiologiaContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveCardiologiaPatient() {
  const patientId = SISELO.normalizeEntityId(cardiologiaState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findCardiologiaPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeCardiologiaPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyCardiologiaPatientScope() {
  const scopedPatient = getActiveCardiologiaPatient();
  if (!scopedPatient || !cardiologiaState.patientPicker) {
    return;
  }

  cardiologiaState.patientPicker.setValue(scopedPatient);
  updateCardiologiaConsultationOptions(scopedPatient.id, cardiologiaState.editingRecordId);
  updateCardiologiaPatientSummary(scopedPatient);
  updateCardiologiaAgeGuidance(scopedPatient);

  const input = document.querySelector("#cardiologia_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateCardiologiaScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(cardiologiaState.activePatientId));
  const newButton = document.getElementById("cardiologia-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Cardiologia.";
  }
}

function mergeCardiologiaPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeCardiologiaPatient(row);
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

function normalizeCardiologiaPatient(patient) {
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

function openCardiologiaModal(record = null) {
  const modal = document.getElementById("cardiologia-modal");
  const form = document.getElementById("cardiologia-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(cardiologiaState.activePatientId)) {
    SISELO.showAlert("cardiologia-alert", "Selecione um usuário no CADH antes de criar um registro de Cardiologia.", "error");
    return;
  }

  cardiologiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("cardiologia-alert", "", "info");
  fillCardiologiaForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#cardiologia_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeCardiologiaModal() {
  const modal = document.getElementById("cardiologia-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (cardiologiaState.lastFocus instanceof HTMLElement) {
    cardiologiaState.lastFocus.focus();
  }
}

function openCardiologiaViewModal(record) {
  const modal = document.getElementById("cardiologia-view-modal");
  const content = document.getElementById("cardiologia-view-content");
  if (!modal || !content) {
    return;
  }

  cardiologiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderCardiologiaViewRecord(normalizeCardiologiaRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-cardiologia-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeCardiologiaViewModal() {
  const modal = document.getElementById("cardiologia-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (cardiologiaState.lastFocus instanceof HTMLElement) {
    cardiologiaState.lastFocus.focus();
  }
}

function fillCardiologiaForm(record = null) {
  const normalizedRecord = record ? normalizeCardiologiaRecord(record) : null;
  const formRecord = normalizedRecord ? mergeCardiologiaUniqueAnswers(normalizedRecord) : null;
  cardiologiaState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeCardiologiaPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeCardiologiaPatient({
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
  const scopedPatient = getActiveCardiologiaPatient();
  const selectedPatient = normalizedRecord
    ? findCardiologiaPatientById(normalizedRecord.patient_id) || recordPatient
    : scopedPatient || cachedPatient;

  setCardiologiaField("cardiologia_record_id", normalizedRecord ? normalizedRecord.id : "");
  setCardiologiaField("cardiologia_consultation_date", formRecord ? formRecord.consultation_date : "");
  setCardiologiaField("cardiologia_ldl", formRecord ? formatCardiologiaLdlInput(formRecord.ldl) : "");
  setCardiologiaField("cardiologia_mapa_target_met", formRecord ? formRecord.mapa_target_met : "");
  setCardiologiaField("cardiologia_cerebrovascular", formRecord ? formRecord.cerebrovascular : "");
  setCardiologiaField("cardiologia_coronary_disease", formRecord ? formRecord.coronary_disease : "");
  setCardiologiaField("cardiologia_coronary_classification", formRecord ? formRecord.coronary_classification : "");
  setCardiologiaField("cardiologia_hf_reduced_ef", formRecord ? formRecord.hf_reduced_ef : "");
  setCardiologiaField("cardiologia_peripheral_arterial_disease", formRecord ? formRecord.peripheral_arterial_disease : "");
  setCardiologiaField("cardiologia_recent_event", formRecord ? formRecord.recent_event : "");
  setCardiologiaField("cardiologia_recent_event_description", formRecord ? formRecord.recent_event_description : "");
  setCardiologiaField("cardiologia_renal_function", formRecord ? formRecord.renal_function : "");
  setCardiologiaField("cardiologia_interventions", formRecord ? formRecord.interventions : "");
  setCardiologiaField("cardiologia_barriers", formRecord ? formRecord.barriers : "");
  setCardiologiaField("cardiologia_recommendations", formRecord ? formRecord.recommendations : "");

  if (cardiologiaState.patientPicker) {
    cardiologiaState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateCardiologiaPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateCardiologiaAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateCardiologiaConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    cardiologiaState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );
  updateCardiologiaInitialFields();
  syncCardiologiaCoronaryClassification();
  syncCardiologiaRecentEventDetail();

  const dateInput = document.getElementById("cardiologia_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setCardiologiaField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function bindCardiologiaLdlField() {
  const input = document.getElementById("cardiologia_ldl");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.addEventListener("beforeinput", (event) => {
    if (!event.data) {
      return;
    }

    if (!/^[0-9,.]$/.test(event.data)) {
      event.preventDefault();
      showCardiologiaTypingAlert();
      return;
    }

    const nextValue = `${input.value.slice(0, input.selectionStart || 0)}${event.data}${input.value.slice(input.selectionEnd || 0)}`;
    if (!isValidCardiologiaNumericDraft(nextValue)) {
      event.preventDefault();
      showCardiologiaTypingAlert();
    }
  });

  input.addEventListener("paste", (event) => {
    const pasted = event.clipboardData ? event.clipboardData.getData("text") : "";
    const sanitized = sanitizeCardiologiaDecimalInput(`${input.value}${pasted}`);
    if (sanitized !== normalizeCardiologiaNumericDraft(`${input.value}${pasted}`)) {
      event.preventDefault();
      input.value = sanitized;
      showCardiologiaTypingAlert();
    }
  });

  input.addEventListener("input", () => {
    const sanitized = sanitizeCardiologiaDecimalInput(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
      showCardiologiaTypingAlert();
    }
    showCardiologiaLdlRangeHint(input.value);
  });

  input.addEventListener("blur", () => {
    input.value = finalizeCardiologiaDecimalInput(input.value);
    showCardiologiaLdlRangeHint(input.value);
  });
}

function showCardiologiaTypingAlert(message = CARDIOLOGIA_LDL_HINT) {
  const now = Date.now();
  if (now - cardiologiaState.lastTypingAlertAt < 1600) {
    return;
  }

  cardiologiaState.lastTypingAlertAt = now;
  SISELO.showAlert("cardiologia-alert", message, "error");
}

function sanitizeCardiologiaDecimalInput(value) {
  const normalized = String(value || "").replace(/\./g, ",");
  let result = "";
  let hasSeparator = false;

  for (const character of normalized) {
    if (/\d/.test(character)) {
      result += character;
      continue;
    }

    if (character === "," && !hasSeparator) {
      result += character;
      hasSeparator = true;
    }
  }

  const parts = result.split(",");
  const integerPart = (parts[0] || "").slice(0, 4);
  const decimalPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 1) : "";
  return hasSeparator ? `${integerPart},${decimalPart}` : integerPart;
}

function normalizeCardiologiaNumericDraft(value) {
  return String(value || "").replace(/\./g, ",").replace(/\s/g, "");
}

function isValidCardiologiaNumericDraft(value) {
  return sanitizeCardiologiaDecimalInput(value) === normalizeCardiologiaNumericDraft(value);
}

function finalizeCardiologiaDecimalInput(value) {
  return sanitizeCardiologiaDecimalInput(value).replace(/,$/, "");
}

function parseCardiologiaNumericValue(value) {
  const numericValue = finalizeCardiologiaDecimalInput(String(value || "").replace(/mg\/?dl/gi, ""));
  if (!numericValue) {
    return NaN;
  }

  const numberValue = Number(numericValue.replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : NaN;
}

function showCardiologiaLdlRangeHint(value) {
  const numberValue = parseCardiologiaNumericValue(value);
  if (!Number.isFinite(numberValue) || (numberValue >= 0 && numberValue <= 1000)) {
    return;
  }

  showCardiologiaTypingAlert("LDL: informe um valor de 0 até 1000 mg/dl, conforme o laudo.");
}

function validateCardiologiaLdlField() {
  const input = document.getElementById("cardiologia_ldl");
  if (!(input instanceof HTMLInputElement)) {
    return "";
  }

  const value = finalizeCardiologiaDecimalInput(input.value);
  input.value = value;

  if (!value) {
    return "";
  }

  const numberValue = parseCardiologiaNumericValue(value);
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 1000) {
    SISELO.showAlert("cardiologia-alert", "LDL: preencha apenas o número informado no laudo, de 0 até 1000 mg/dl.", "error");
    input.focus();
    return null;
  }

  return value;
}

function formatCardiologiaLdlInput(value) {
  return sanitizeCardiologiaDecimalInput(
    String(value || "")
      .replace(/mg\/?dl/gi, "")
      .replace(/[^\d,.]/g, ""),
  );
}

function formatCardiologiaLdlOutput(value) {
  const ldlValue = finalizeCardiologiaDecimalInput(value);
  return ldlValue ? `${ldlValue} mg/dl` : "";
}

function updateCardiologiaInitialFields() {
  const initialSection = document.getElementById("cardiologia-initial-section");
  const careSection = document.getElementById("cardiologia-care-section");

  [initialSection, careSection].forEach((section) => {
    if (section) {
      section.hidden = false;
    }
  });

  document.querySelectorAll("[data-cardiologia-initial-field]").forEach((field) => {
    field.disabled = false;
  });
}

function syncCardiologiaCoronaryClassification() {
  const select = document.getElementById("cardiologia_coronary_disease");
  const detail = document.getElementById("cardiologia-coronary-detail");
  const classification = document.getElementById("cardiologia_coronary_classification");
  const instabilityHint = document.getElementById("cardiologia_coronary_instability_hint");
  const shouldShow = select instanceof HTMLSelectElement && select.value === "Sim";

  if (detail) {
    detail.hidden = !shouldShow;
  }

  if (classification instanceof HTMLSelectElement) {
    classification.disabled = !shouldShow;
    if (!shouldShow) {
      classification.value = "";
    }
  }

  if (instabilityHint) {
    instabilityHint.hidden = !(
      shouldShow &&
      classification instanceof HTMLSelectElement &&
      classification.value === "Angina instável"
    );
  }
}

function syncCardiologiaRecentEventDetail() {
  const select = document.getElementById("cardiologia_recent_event");
  const detail = document.getElementById("cardiologia-event-detail");
  const input = document.getElementById("cardiologia_recent_event_description");
  const shouldShow = select instanceof HTMLSelectElement && select.value === "Sim";

  if (detail) {
    detail.hidden = !shouldShow;
  }

  if (input instanceof HTMLInputElement) {
    input.disabled = !shouldShow;
    if (!shouldShow) {
      input.value = "";
    }
  }
}

function updateCardiologiaConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("cardiologia_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeCardiologiaConsultationLabel(preferredValue);
  const patientRecords = cardiologiaState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialCardiologiaConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialCardiologiaConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseCardiologiaConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseCardiologiaConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatCardiologiaConsultationLabel(preferredOrdinal)
    : formatCardiologiaConsultationLabel(nextOrdinal);
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

  updateCardiologiaInitialFields();
  syncCardiologiaCoronaryClassification();
  syncCardiologiaRecentEventDetail();
}

function hasDuplicateInitialCardiologiaConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialCardiologiaConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return cardiologiaState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialCardiologiaConsultation(record.consultation_number)
  ));
}

function normalizeCardiologiaConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Âª/g, "ª")
    .trim();
  const ordinal = parseCardiologiaConsultationOrdinal(normalized);
  return ordinal ? formatCardiologiaConsultationLabel(ordinal) : "";
}

function isInitialCardiologiaConsultation(value) {
  return parseCardiologiaConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseCardiologiaConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatCardiologiaConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1 ? INITIAL_CONSULTATION_LABEL : `${safeOrdinal}ª Consulta`;
}

function saveCardiologiaRecord() {
  const form = document.getElementById("cardiologia-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "cardiologia-alert" })) {
    return;
  }

  const patientId = cardiologiaState.activePatientId || (cardiologiaState.patientPicker
    ? cardiologiaState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("cardiologia-alert", "Selecione o paciente.", "error");
    if (cardiologiaState.patientPicker) {
      cardiologiaState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const ldlValue = validateCardiologiaLdlField();
  if (ldlValue === null) {
    return;
  }

  const missingFields = validateCardiologiaRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("cardiologia-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingCardiologiaField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialCardiologiaConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("cardiologia-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateCardiologiaConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  if (payload.coronary_disease === "Sim" && !String(payload.coronary_classification || "").trim()) {
    SISELO.showAlert("cardiologia-alert", "Informe a classificação da doença coronária.", "error");
    const input = document.getElementById("cardiologia_coronary_classification");
    if (input instanceof HTMLSelectElement) {
      input.focus();
    }
    return;
  }

  if (payload.recent_event === "Sim" && !String(payload.recent_event_description || "").trim()) {
    SISELO.showAlert("cardiologia-alert", "Informe qual evento ocorreu nos últimos 6 meses.", "error");
    const input = document.getElementById("cardiologia_recent_event_description");
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
    return;
  }

  const patient = resolveCardiologiaPatient(patientId);
  const record = normalizeCardiologiaRecord({
    id: payload.record_id || createCardiologiaRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || INITIAL_CONSULTATION_LABEL,
    ldl: formatCardiologiaLdlOutput(ldlValue),
    mapa_target_met: payload.mapa_target_met,
    cerebrovascular: payload.cerebrovascular,
    coronary_disease: payload.coronary_disease,
    coronary_classification: payload.coronary_disease === "Sim" ? payload.coronary_classification : "",
    hf_reduced_ef: payload.hf_reduced_ef,
    peripheral_arterial_disease: payload.peripheral_arterial_disease,
    recent_event: payload.recent_event,
    recent_event_description: payload.recent_event === "Sim" ? payload.recent_event_description : "",
    renal_function: payload.renal_function,
    interventions: payload.interventions,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("cardiologia-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = cardiologiaState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    cardiologiaState.records[existingIndex] = record;
  } else {
    cardiologiaState.records.unshift(record);
  }

  writeCardiologiaRecords(cardiologiaState.records);
  renderCardiologiaTable();
  closeCardiologiaModal();
}

function validateCardiologiaRequiredFields(payload) {
  const fields = [
    ["consultation_date", "Data da consulta"],
    ["ldl", "LDL"],
    ["mapa_target_met", "Meta MAPA atingida"],
    ["cerebrovascular", "Cerebrovascular"],
    ["coronary_disease", "Doença da artéria coronária"],
    ["hf_reduced_ef", "IC com fração reduzida"],
    ["peripheral_arterial_disease", "Doença arterial periférica"],
    ["recent_event", "Evento nos últimos 6 meses"],
    ["renal_function", "Função renal"],
    ["interventions", "Intervenções medicamentosas e não medicamentosas"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ];
  const missingFields = fields
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);

  if (payload && payload.coronary_disease === "Sim" && !String(payload.coronary_classification || "").trim()) {
    missingFields.push("Classificação coronária");
  }

  if (payload && payload.recent_event === "Sim" && !String(payload.recent_event_description || "").trim()) {
    missingFields.push("Qual evento");
  }

  return missingFields;
}

function focusFirstMissingCardiologiaField(label) {
  const fieldMap = {
    "Data da consulta": "cardiologia_consultation_date",
    LDL: "cardiologia_ldl",
    "Meta MAPA atingida": "cardiologia_mapa_target_met",
    Cerebrovascular: "cardiologia_cerebrovascular",
    "Doença da artéria coronária": "cardiologia_coronary_disease",
    "Classificação coronária": "cardiologia_coronary_classification",
    "IC com fração reduzida": "cardiologia_hf_reduced_ef",
    "Doença arterial periférica": "cardiologia_peripheral_arterial_disease",
    "Evento nos últimos 6 meses": "cardiologia_recent_event",
    "Qual evento": "cardiologia_recent_event_description",
    "Função renal": "cardiologia_renal_function",
    "Intervenções medicamentosas e não medicamentosas": "cardiologia_interventions",
    "Fatores dificultadores": "cardiologia_barriers",
    Recomendações: "cardiologia_recommendations",
  };

  syncCardiologiaCoronaryClassification();
  syncCardiologiaRecentEventDetail();

  const field = document.getElementById(fieldMap[label] || "");
  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function resolveCardiologiaPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findCardiologiaPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeCardiologiaPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    cardiologiaState.patients = mergeCardiologiaPatients(cardiologiaState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findCardiologiaPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return cardiologiaState.patients.find((item) => item.id === normalizedId) || null;
}

function findInitialCardiologiaRecordByPatient(patientId, currentRecordId = "") {
  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();

  if (!normalizedPatientId) {
    return null;
  }

  return cardiologiaState.records.find((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialCardiologiaConsultation(record.consultation_number)
  )) || null;
}

function mergeCardiologiaUniqueAnswers(record) {
  const item = record || {};
  if (isInitialCardiologiaConsultation(item.consultation_number)) {
    return item;
  }

  const initialRecord = findInitialCardiologiaRecordByPatient(item.patient_id, item.id);
  if (!initialRecord) {
    return item;
  }

  return {
    ...item,
    cerebrovascular: item.cerebrovascular || initialRecord.cerebrovascular,
    coronary_disease: item.coronary_disease || initialRecord.coronary_disease,
    coronary_classification: item.coronary_classification || initialRecord.coronary_classification,
    hf_reduced_ef: item.hf_reduced_ef || initialRecord.hf_reduced_ef,
    peripheral_arterial_disease: item.peripheral_arterial_disease || initialRecord.peripheral_arterial_disease,
    recent_event: item.recent_event || initialRecord.recent_event,
    recent_event_description: item.recent_event_description || initialRecord.recent_event_description,
    renal_function: item.renal_function || initialRecord.renal_function,
    interventions: item.interventions || initialRecord.interventions,
    barriers: item.barriers || initialRecord.barriers,
    recommendations: item.recommendations || initialRecord.recommendations,
  };
}

function updateCardiologiaPatientSummary(patient) {
  const element = document.getElementById("cardiologia-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findCardiologiaPatientById(patient.id) || normalizeCardiologiaPatient(patient);
  const ageYears = getCardiologiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderCardiologiaPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderCardiologiaPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderCardiologiaPatientSummaryItem("Cor/Raça", formatCardiologiaRace(fullPatient.race)),
    renderCardiologiaPatientSummaryItem("Idade", ageLabel),
    renderCardiologiaPatientSummaryItem("Nascimento", formatCardiologiaDate(fullPatient.birth_date)),
    renderCardiologiaPatientSummaryItem("1º atendimento CADH", formatCardiologiaDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderCardiologiaPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateCardiologiaAgeGuidance(patient) {
  const element = document.getElementById("cardiologia-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findCardiologiaPatientById(patient.id) || normalizeCardiologiaPatient(patient);
  const ageYears = getCardiologiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getCardiologiaAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getCardiologiaAgeYears(patient) {
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

function getCardiologiaAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Avalie risco cardiovascular, PA/MAPA, LDL, função renal e sinais de alerta.";
  }

  if (ageYears < 2) {
    return "Use avaliação pediátrica, confirme responsável presente e registre sinais de alerta.";
  }

  if (ageYears < 10) {
    return "Considere responsável presente, crescimento, PA adequada para idade e sintomas de alerta.";
  }

  if (ageYears < 20) {
    return "Considere adesão, autonomia, apoio familiar e risco cardiometabólico.";
  }

  if (ageYears >= 60) {
    return "Considere fragilidade, função renal, polifarmácia, quedas e risco de hipotensão.";
  }

  return "Avalie risco cardiovascular, adesão, PA/MAPA, LDL e sintomas de alerta.";
}

function renderCardiologiaViewRecord(record) {
  const item = mergeCardiologiaUniqueAnswers(record || {});

  return `
    ${renderCardiologiaViewSection("Identificação", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatCardiologiaRace(item.race)],
      ["Data de nascimento", formatCardiologiaDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatCardiologiaDate(item.first_cadh_date)],
    ])}
    ${renderCardiologiaViewSection("Consulta", [
      ["Data da consulta", formatCardiologiaDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
      ["Valor colesterol LDL", item.ldl || "-"],
      ["Cumprimento da meta terapêutica MAPA", item.mapa_target_met || "-"],
    ])}
    ${renderCardiologiaViewSection("Informações únicas", [
      ["Cerebrovascular", item.cerebrovascular || "-"],
      ["Doença da artéria coronária", item.coronary_disease || "-"],
      ["Classificação da doença da artéria coronária", formatCardiologiaCoronaryClassification(item) || "-"],
      ["Insuficiência cardíaca com fração de ejeção reduzida", item.hf_reduced_ef || "-"],
      ["Doença arterial periférica sintomática dos membros inferiores", item.peripheral_arterial_disease || "-"],
      ["Teve evento nos últimos 6 meses", item.recent_event || "-"],
      ["Se sim, qual evento", item.recent_event_description || "-"],
      ["Função renal", item.renal_function || "-"],
    ])}
    ${renderCardiologiaViewSection("Plano de cuidado", [
      ["Intervenções medicamentosas e não medicamentosas", item.interventions || "-", true],
      ["Fatores dificultadores", item.barriers || "-", true],
      ["Recomendações", item.recommendations || "-", true],
    ])}
  `;
}

function renderCardiologiaViewSection(title, items) {
  return `
    <section class="cardiologia-view-section">
      <h3 class="cardiologia-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="cardiologia-view-grid">
        ${items.map(([label, value, wide]) => renderCardiologiaViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderCardiologiaViewItem(label, value, wide = false) {
  return `
    <div class="cardiologia-view-item${wide ? " is-wide" : ""}">
      <span class="cardiologia-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="cardiologia-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function formatCardiologiaCoronaryClassification(record) {
  const item = record || {};
  return item.coronary_disease === "Sim" ? item.coronary_classification || "" : "";
}

function formatCardiologiaCoronarySummary(record) {
  const item = record || {};
  const classification = formatCardiologiaCoronaryClassification(item);

  if (item.coronary_disease === "Sim") {
    return classification ? `Sim - ${classification}` : "Sim - classificar";
  }

  if (item.coronary_disease === "Não") {
    return "Não";
  }

  return classification || "-";
}

function renderCardiologiaTable() {
  const tbody = document.getElementById("cardiologia-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(cardiologiaState.activePatientId);
  const records = cardiologiaState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .sort((left, right) => {
      const consultationOrder = parseCardiologiaConsultationOrdinal(right.consultation_number) -
        parseCardiologiaConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Cardiologia encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Cardiologia.";
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="cardiologia-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindCardiologiaTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => {
    const clinicalRecord = mergeCardiologiaUniqueAnswers(record);

    return `
      <tr>
        <td>${SISELO.escapeHtml(formatCardiologiaDate(record.consultation_date))}</td>
        <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
        <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
        <td>${SISELO.escapeHtml(record.ldl || "-")}</td>
        <td>${SISELO.escapeHtml(record.mapa_target_met || "-")}</td>
        <td>${SISELO.escapeHtml(clinicalRecord.cerebrovascular || "-")}</td>
        <td>${SISELO.escapeHtml(formatCardiologiaCoronarySummary(clinicalRecord))}</td>
        <td>${SISELO.escapeHtml(clinicalRecord.renal_function || "-")}</td>
        <td>
          <div class="table-actions">
            ${SISELO.iconButton("view", "Ver guia clínica", { "data-cardiologia-view": record.id })}
            ${SISELO.iconButton("pdf", "Gerar PDF", { "data-cardiologia-pdf": record.id })}
            ${SISELO.iconButton("edit", "Editar registro", { "data-cardiologia-edit": record.id })}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  bindCardiologiaTableActions();
}

function bindCardiologiaTableActions() {
  const tbody = document.getElementById("cardiologia-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-cardiologia-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = cardiologiaState.records.find((item) => item.id === button.dataset.cardiologiaEdit);
      if (record) {
        openCardiologiaModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-cardiologia-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = cardiologiaState.records.find((item) => item.id === button.dataset.cardiologiaView);
      if (record) {
        openCardiologiaViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-cardiologia-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function readCardiologiaRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CARDIOLOGIA_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeCardiologiaRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeCardiologiaRecords(records) {
  try {
    localStorage.setItem(
      CARDIOLOGIA_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeCardiologiaRecord(record) {
  const id = String((record && record.id) || "").trim();
  if (!id) {
    return null;
  }

  const coronaryStatus = normalizeCardiologiaCoronaryDisease(
    record && record.coronary_disease,
    record && record.coronary_classification,
  );
  const coronaryClassification = normalizeCardiologiaCoronaryClassification(
    (record && record.coronary_classification) || (record && record.coronary_disease),
  );

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
    consultation_number: normalizeCardiologiaConsultationLabel(record && record.consultation_number) || INITIAL_CONSULTATION_LABEL,
    ldl: String((record && record.ldl) || "").trim(),
    mapa_target_met: normalizeCardiologiaYesNo(record && record.mapa_target_met),
    cerebrovascular: normalizeCardiologiaCerebrovascular(record && record.cerebrovascular),
    coronary_disease: coronaryStatus,
    coronary_classification: coronaryStatus === "Sim" ? coronaryClassification : "",
    hf_reduced_ef: normalizeCardiologiaYesNo(record && record.hf_reduced_ef),
    peripheral_arterial_disease: normalizeCardiologiaYesNo(record && record.peripheral_arterial_disease),
    recent_event: normalizeCardiologiaYesNo(record && record.recent_event),
    recent_event_description: String((record && record.recent_event_description) || "").trim(),
    renal_function: normalizeCardiologiaRenalFunction(record && record.renal_function),
    interventions: String((record && record.interventions) || "").trim(),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeCardiologiaYesNo(value) {
  const normalized = SISELO.normalizeSearchText(value);
  if (normalized === "sim") {
    return "Sim";
  }

  if (normalized === "nao") {
    return "Não";
  }

  return "";
}

function normalizeCardiologiaCerebrovascular(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const values = {
    "sem complicacoes": "Sem complicações",
    "sem alteracoes": "Sem complicações",
    "ave isquemico": "AVE isquêmico",
    "avc isquemico": "AVE isquêmico",
    "avc ave isquemico": "AVE isquêmico",
    "hemorragia cerebral": "Hemorragia cerebral",
    "ataque isquemico transitorio": "Ataque isquêmico transitório",
    ait: "Ataque isquêmico transitório",
  };

  return values[normalized] || original;
}

function normalizeCardiologiaCoronaryDisease(value, classification = "") {
  const normalized = SISELO.normalizeSearchText(value);
  const normalizedClassification = SISELO.normalizeSearchText(classification);

  if (normalized === "nao" || normalized === "sem complicacoes" || normalized === "sem alteracoes") {
    return "Não";
  }

  if (
    normalized === "sim" ||
    normalized === "angina" ||
    normalized === "angina estavel ou instavel" ||
    normalizedClassification
  ) {
    return "Sim";
  }

  if (normalizeCardiologiaCoronaryClassification(value)) {
    return "Sim";
  }

  return "";
}

function normalizeCardiologiaCoronaryClassification(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const values = {
    "angina estavel": "Angina estável",
    "angina instavel": "Angina instável",
    "infarto do miocardio": "Infarto do miocárdio",
    infarto: "Infarto do miocárdio",
    "revascularizacao do miocardio percutanea angioplastia ou cirurgica": "Revascularização do miocárdio: percutânea (angioplastia) ou cirúrgica",
    "revascularizacao coronaria": "Revascularização do miocárdio: percutânea (angioplastia) ou cirúrgica",
  };

  return values[normalized] || "";
}

function normalizeCardiologiaRenalFunction(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const values = {
    "sem complicacoes": "Sem complicações",
    "sem alteracoes": "Sem complicações",
    "estagio drc 1": "Estágio DRC: 1",
    "estagio drc 2": "Estágio DRC: 2",
    "estagio drc 3a": "Estágio DRC: 3A",
    "estagio drc 3b": "Estágio DRC: 3B",
    "estagio drc 4": "Estágio DRC: 4",
    "estagio drc 5": "Estágio DRC: 5",
    "drc 1": "Estágio DRC: 1",
    "drc 2": "Estágio DRC: 2",
    "drc 3a": "Estágio DRC: 3A",
    "drc 3b": "Estágio DRC: 3B",
    "drc 4": "Estágio DRC: 4",
    "drc 5": "Estágio DRC: 5",
  };

  return values[normalized] || original;
}

function createCardiologiaRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `cardiologia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCardiologiaDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatCardiologiaRace(value) {
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
    indigenae: "Indígena",
  };

  return raceMap[normalized] || raw;
}
