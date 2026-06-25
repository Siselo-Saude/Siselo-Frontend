const NUTRICAO_STORAGE_KEY = "siselo_cadh_nutricao_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const NUTRICAO_INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";

const nutricaoState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-nutricao") {
    return;
  }

  setupNutricaoPage();
});

async function setupNutricaoPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  nutricaoState.activePatientId = getNutricaoContextPatientId();
  nutricaoState.records = readNutricaoRecords();
  bindNutricaoModal();
  bindNutricaoViewModal();
  bindNutricaoFloatingGuidance();
  updateNutricaoConsultationOptions("");

  SISELO.enhanceDateInput("nutricao_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  nutricaoState.patients = await loadNutricaoPatients();
  nutricaoState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "nutricao_patient_id",
    container: "nutricao_patient_search",
    rows: nutricaoState.patients,
    currentValue: nutricaoState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (nutricaoState.activePatientId) {
        const scopedPatient = getActiveNutricaoPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (nutricaoState.patientPicker && scopedPatient && pickedPatientId !== nutricaoState.activePatientId) {
          nutricaoState.patientPicker.setValue(scopedPatient);
        }
        updateNutricaoConsultationOptions(nutricaoState.activePatientId, nutricaoState.editingRecordId);
        updateNutricaoPatientSummary(scopedPatient);
        updateNutricaoAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findNutricaoPatientById(patient.id) || patient
        : null;
      updateNutricaoConsultationOptions(patient && patient.id, nutricaoState.editingRecordId);
      updateNutricaoPatientSummary(selectedPatient);
      updateNutricaoAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#nutricao_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "nutricao_patient_search_input";
  }

  applyNutricaoPatientScope();
  updateNutricaoScopeControls();
  renderNutricaoTable();
}

function bindNutricaoModal() {
  const modal = document.getElementById("nutricao-modal");
  const form = document.getElementById("nutricao-form");
  const newButton = document.getElementById("nutricao-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openNutricaoModal();
  });

  modal.querySelectorAll("[data-nutricao-close]").forEach((button) => {
    button.addEventListener("click", () => closeNutricaoModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeNutricaoModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeNutricaoModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveNutricaoRecord();
  });
}

function bindNutricaoViewModal() {
  const modal = document.getElementById("nutricao-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-nutricao-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeNutricaoViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeNutricaoViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeNutricaoViewModal();
    }
  });
}

function bindNutricaoFloatingGuidance() {
  SISELO.bindFieldGuidanceTooltips();
  return;

  if (document.body.dataset.nutricaoTooltipBound !== "true") {
    document.body.dataset.nutricaoTooltipBound = "true";
    window.addEventListener("resize", hideNutricaoFloatingTip);
  }

  document.querySelectorAll(".nutricao-field-guidance").forEach((guidance) => {
    const field = guidance.closest(".field, .field-full");
    if (!(field instanceof HTMLElement) || field.dataset.nutricaoGuidanceBound === "true") {
      return;
    }

    field.dataset.nutricaoGuidanceBound = "true";
    const show = () => showNutricaoFloatingTip(field, guidance.textContent || "");
    const hide = () => hideNutricaoFloatingTip();

    field.addEventListener("mouseenter", show);
    field.addEventListener("focusin", show);
    field.addEventListener("mouseleave", hide);
    field.addEventListener("focusout", hide);
  });
}

function getNutricaoFloatingTip() {
  let tooltip = document.getElementById("nutricao-floating-tip");
  if (!(tooltip instanceof HTMLElement)) {
    tooltip = document.createElement("div");
    tooltip.id = "nutricao-floating-tip";
    tooltip.className = "nutricao-tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
  }

  return tooltip;
}

function showNutricaoFloatingTip(anchor, message) {
  const text = String(message || "").trim();
  if (!text || !(anchor instanceof HTMLElement)) {
    hideNutricaoFloatingTip();
    return;
  }

  const tooltip = getNutricaoFloatingTip();
  tooltip.textContent = text;
  tooltip.hidden = false;
  positionNutricaoFloatingTip(anchor, tooltip);
}

function hideNutricaoFloatingTip() {
  const tooltip = document.getElementById("nutricao-floating-tip");
  if (tooltip instanceof HTMLElement) {
    tooltip.hidden = true;
    tooltip.textContent = "";
  }
}

function positionNutricaoFloatingTip(anchor, tooltip) {
  const viewportPadding = 12;
  const gap = 10;
  const anchorRect = anchor.getBoundingClientRect();

  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const tooltipRect = tooltip.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;
  const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
  const maxTop = window.innerHeight - tooltipHeight - viewportPadding;
  let left = anchorRect.left;
  let top = anchorRect.top - tooltipHeight - gap;

  if (top < viewportPadding) {
    top = anchorRect.bottom + gap;
  }

  tooltip.style.left = `${Math.max(viewportPadding, Math.min(left, maxLeft))}px`;
  tooltip.style.top = `${Math.max(viewportPadding, Math.min(top, maxTop))}px`;
}

async function loadNutricaoPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeNutricaoPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getNutricaoContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveNutricaoPatient() {
  const patientId = SISELO.normalizeEntityId(nutricaoState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findNutricaoPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeNutricaoPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyNutricaoPatientScope() {
  const scopedPatient = getActiveNutricaoPatient();
  if (!scopedPatient || !nutricaoState.patientPicker) {
    return;
  }

  nutricaoState.patientPicker.setValue(scopedPatient);
  updateNutricaoConsultationOptions(scopedPatient.id, nutricaoState.editingRecordId);
  updateNutricaoPatientSummary(scopedPatient);
  updateNutricaoAgeGuidance(scopedPatient);

  const input = document.querySelector("#nutricao_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateNutricaoScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(nutricaoState.activePatientId));
  const newButton = document.getElementById("nutricao-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Nutrição.";
  }
}

function mergeNutricaoPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeNutricaoPatient(row);
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

function normalizeNutricaoPatient(patient) {
  return {
    id: SISELO.normalizeEntityId(patient && patient.id),
    full_name: String((patient && patient.full_name) || "").trim(),
    cpf: String((patient && patient.cpf) || "").trim(),
    team_ref: String((patient && patient.team_ref) || "").trim(),
    birth_date: String((patient && patient.birth_date) || "").trim(),
    first_cadh_date: String((patient && patient.first_cadh_date) || "").trim(),
    age_label: String((patient && patient.age_label) || "").trim(),
    race: String((patient && (patient.race || patient.race_label || patient.color_race)) || "").trim(),
    gender_label: String((patient && patient.gender_label) || "").trim(),
  };
}

function openNutricaoModal(record = null) {
  const modal = document.getElementById("nutricao-modal");
  const form = document.getElementById("nutricao-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(nutricaoState.activePatientId)) {
    SISELO.showAlert("nutricao-alert", "Selecione um usuário no CADH antes de criar um registro de Nutrição.", "error");
    return;
  }

  nutricaoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("nutricao-alert", "", "info");
  fillNutricaoForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#nutricao_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeNutricaoModal() {
  const modal = document.getElementById("nutricao-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");
  hideNutricaoFloatingTip();

  if (nutricaoState.lastFocus instanceof HTMLElement) {
    nutricaoState.lastFocus.focus();
  }
}

function openNutricaoViewModal(record) {
  const modal = document.getElementById("nutricao-view-modal");
  const content = document.getElementById("nutricao-view-content");
  if (!modal || !content) {
    return;
  }

  nutricaoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderNutricaoViewRecord(normalizeNutricaoRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-nutricao-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeNutricaoViewModal() {
  const modal = document.getElementById("nutricao-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (nutricaoState.lastFocus instanceof HTMLElement) {
    nutricaoState.lastFocus.focus();
  }
}

function fillNutricaoForm(record = null) {
  const normalizedRecord = record ? normalizeNutricaoRecord(record) : null;
  nutricaoState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeNutricaoPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeNutricaoPatient({
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
    ? findNutricaoPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveNutricaoPatient() || cachedPatient;

  setNutricaoField("nutricao_record_id", normalizedRecord ? normalizedRecord.id : "");
  setNutricaoField("nutricao_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setNutricaoField("nutricao_activity_modality", normalizedRecord ? normalizedRecord.activity_modality : "");
  setNutricaoField("nutricao_activity_duration", normalizedRecord ? normalizedRecord.activity_duration : "");
  setNutricaoField("nutricao_activity_frequency", normalizedRecord ? normalizedRecord.activity_frequency : "");
  setNutricaoField("nutricao_ultraprocessed", normalizedRecord ? normalizedRecord.ultraprocessed : "");
  setNutricaoField("nutricao_processed", normalizedRecord ? normalizedRecord.processed : "");
  setNutricaoField("nutricao_in_natura", normalizedRecord ? normalizedRecord.in_natura : "");
  setNutricaoField("nutricao_bowel_function", normalizedRecord ? normalizedRecord.bowel_function : "");
  setNutricaoField("nutricao_water_intake", normalizedRecord ? normalizedRecord.water_intake : "");
  setNutricaoField("nutricao_water_liters", normalizedRecord ? normalizedRecord.water_liters : "");
  setNutricaoField("nutricao_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setNutricaoField("nutricao_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");

  if (nutricaoState.patientPicker) {
    nutricaoState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateNutricaoPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateNutricaoAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateNutricaoConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    nutricaoState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  const dateInput = document.getElementById("nutricao_consultation_date");
  if (dateInput) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setNutricaoField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function saveNutricaoRecord() {
  const form = document.getElementById("nutricao-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "nutricao-alert" })) {
    return;
  }

  const patientId = nutricaoState.activePatientId || (nutricaoState.patientPicker
    ? nutricaoState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("nutricao-alert", "Selecione o paciente.", "error");
    if (nutricaoState.patientPicker) {
      nutricaoState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const missingFields = validateNutricaoRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("nutricao-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingNutricaoField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialNutricaoConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("nutricao-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateNutricaoConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveNutricaoPatient(patientId);
  const record = normalizeNutricaoRecord({
    id: payload.record_id || createNutricaoRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || NUTRICAO_INITIAL_CONSULTATION_LABEL,
    activity_modality: payload.activity_modality,
    activity_duration: payload.activity_duration,
    activity_frequency: payload.activity_frequency,
    ultraprocessed: payload.ultraprocessed,
    processed: payload.processed,
    in_natura: payload.in_natura,
    bowel_function: payload.bowel_function,
    water_intake: payload.water_intake,
    water_liters: payload.water_liters,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("nutricao-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = nutricaoState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    nutricaoState.records[existingIndex] = record;
  } else {
    nutricaoState.records.unshift(record);
  }

  writeNutricaoRecords(nutricaoState.records);
  renderNutricaoTable();
  closeNutricaoModal();
}

function validateNutricaoRequiredFields(payload) {
  return [
    ["consultation_date", "Data da consulta"],
    ["activity_modality", "Modalidade"],
    ["activity_duration", "Duração"],
    ["activity_frequency", "Frequência"],
    ["ultraprocessed", "Ultraprocessados"],
    ["processed", "Processados"],
    ["in_natura", "In natura"],
    ["bowel_function", "Funcionalidade intestinal"],
    ["water_intake", "Ingestão hídrica"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ]
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingNutricaoField(label) {
  const fieldMap = {
    "Data da consulta": "nutricao_consultation_date",
    Modalidade: "nutricao_activity_modality",
    "Duração": "nutricao_activity_duration",
    "Frequência": "nutricao_activity_frequency",
    Ultraprocessados: "nutricao_ultraprocessed",
    Processados: "nutricao_processed",
    "In natura": "nutricao_in_natura",
    "Funcionalidade intestinal": "nutricao_bowel_function",
    "Ingestão hídrica": "nutricao_water_intake",
    "Fatores dificultadores": "nutricao_barriers",
    "Recomendações": "nutricao_recommendations",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function updateNutricaoConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("nutricao_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeNutricaoConsultationLabel(preferredValue);
  const patientRecords = nutricaoState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialNutricaoConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialNutricaoConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseNutricaoConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseNutricaoConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatNutricaoConsultationLabel(preferredOrdinal)
    : formatNutricaoConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: NUTRICAO_INITIAL_CONSULTATION_LABEL,
    label: NUTRICAO_INITIAL_CONSULTATION_LABEL,
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
  select.value = firstEnabled ? firstEnabled.value : NUTRICAO_INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialNutricaoConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialNutricaoConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return nutricaoState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialNutricaoConsultation(record.consultation_number)
  ));
}

function normalizeNutricaoConsultationLabel(value) {
  const ordinal = parseNutricaoConsultationOrdinal(String(value || "").trim());
  return ordinal ? formatNutricaoConsultationLabel(ordinal) : "";
}

function isInitialNutricaoConsultation(value) {
  return parseNutricaoConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseNutricaoConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatNutricaoConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? NUTRICAO_INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function resolveNutricaoPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findNutricaoPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeNutricaoPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    nutricaoState.patients = mergeNutricaoPatients(nutricaoState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findNutricaoPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return nutricaoState.patients.find((item) => item.id === normalizedId) || null;
}

function updateNutricaoPatientSummary(patient) {
  const element = document.getElementById("nutricao-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findNutricaoPatientById(patient.id) || normalizeNutricaoPatient(patient);
  const ageYears = getNutricaoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderNutricaoPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderNutricaoPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderNutricaoPatientSummaryItem("Cor/Raça", formatNutricaoRace(fullPatient.race)),
    renderNutricaoPatientSummaryItem("Idade", ageLabel),
    renderNutricaoPatientSummaryItem("Nascimento", formatNutricaoDate(fullPatient.birth_date)),
    renderNutricaoPatientSummaryItem("1º atendimento CADH", formatNutricaoDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderNutricaoPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateNutricaoAgeGuidance(patient) {
  const element = document.getElementById("nutricao-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findNutricaoPatientById(patient.id) || normalizeNutricaoPatient(patient);
  const ageYears = getNutricaoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getNutricaoAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getNutricaoAgeYears(patient) {
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

function getNutricaoAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Registre alimentação, hidratação, rotina intestinal, barreiras e orientação combinada.";
  }

  if (ageYears < 2) {
    return "Considere responsável presente, acompanhamento pediátrico e sinais de alerta nutricional.";
  }

  if (ageYears < 10) {
    return "Inclua família ou responsável no plano alimentar e observe crescimento e rotina escolar.";
  }

  if (ageYears < 20) {
    return "Avalie autonomia, rotina escolar, apoio familiar e padrão alimentar fora de casa.";
  }

  if (ageYears >= 60) {
    return "Considere funcionalidade, mastigação, deglutição, constipação, hidratação e risco social.";
  }

  return "Avalie rotina alimentar, atividade física, barreiras, hidratação e metas pactuadas.";
}

function renderNutricaoViewRecord(record) {
  const item = record || {};

  return `
    ${renderNutricaoViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatNutricaoRace(item.race)],
      ["Data de nascimento", formatNutricaoDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatNutricaoDate(item.first_cadh_date)],
      ["Data da consulta", formatNutricaoDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderNutricaoViewSection("Atividade física", [
      ["Modalidade", item.activity_modality || "-"],
      ["Duração", item.activity_duration || "-"],
      ["Frequência", item.activity_frequency || "-"],
    ])}
    ${renderNutricaoViewSection("Consumo alimentar", [
      ["Ultraprocessados", item.ultraprocessed || "-"],
      ["Processados", item.processed || "-"],
      ["In natura", item.in_natura || "-"],
    ])}
    ${renderNutricaoViewSection("Rotina clínica", [
      ["Funcionalidade intestinal", item.bowel_function || "-"],
      ["Ingestão hídrica", item.water_intake || "-"],
      ["Litros por dia", item.water_liters ? `${item.water_liters} L/dia` : "-"],
    ])}
    ${renderNutricaoViewSection("Plano de cuidado", [
      ["Fatores dificultadores", item.barriers || "-", true],
      ["Recomendações", item.recommendations || "-", true],
    ])}
  `;
}

function renderNutricaoViewSection(title, items) {
  return `
    <section class="nutricao-view-section">
      <h3 class="nutricao-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="nutricao-view-grid">
        ${items.map(([label, value, wide]) => renderNutricaoViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderNutricaoViewItem(label, value, wide = false) {
  return `
    <div class="nutricao-view-item${wide ? " is-wide" : ""}">
      <span class="nutricao-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="nutricao-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function formatNutricaoWaterIntake(record) {
  const intake = normalizeNutricaoText(record && record.water_intake);
  const liters = normalizeNutricaoWaterLiters(record && record.water_liters);

  if (intake && liters) {
    return `${intake} (${liters} L/dia)`;
  }

  if (liters) {
    return `${liters} L/dia`;
  }

  return intake || "-";
}

function renderNutricaoTable() {
  const tbody = document.getElementById("nutricao-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(nutricaoState.activePatientId);
  const records = nutricaoState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseNutricaoConsultationOrdinal(right.consultation_number) -
        parseNutricaoConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Nutrição encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Nutrição.";
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="nutricao-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindNutricaoTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatNutricaoDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.barriers || "-")}</td>
      <td>${SISELO.escapeHtml(record.recommendations || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver consulta nutricional", { "data-nutricao-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-nutricao-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-nutricao-edit": record.id })}
          ${SISELO.iconButton("delete", "Remover registro", { "data-nutricao-delete": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindNutricaoTableActions();
}

function bindNutricaoTableActions() {
  const tbody = document.getElementById("nutricao-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-nutricao-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = nutricaoState.records.find((item) => item.id === button.dataset.nutricaoEdit);
      if (record) {
        openNutricaoModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-nutricao-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = nutricaoState.records.find((item) => item.id === button.dataset.nutricaoView);
      if (record) {
        openNutricaoViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-nutricao-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });

  tbody.querySelectorAll("[data-nutricao-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = nutricaoState.records.find((item) => item.id === button.dataset.nutricaoDelete);
      if (!record || !(await SISELO.confirmPermanentDeletion("o registro de Nutrição", record.consultation_number))) {
        return;
      }

      nutricaoState.records = nutricaoState.records.filter((item) => item.id !== record.id);
      writeNutricaoRecords(nutricaoState.records);
      renderNutricaoTable();
    });
  });
}

function readNutricaoRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NUTRICAO_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeNutricaoRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeNutricaoRecords(records) {
  try {
    localStorage.setItem(
      NUTRICAO_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeNutricaoRecord(record) {
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
    consultation_number: normalizeNutricaoConsultationLabel(record && record.consultation_number) || NUTRICAO_INITIAL_CONSULTATION_LABEL,
    activity_modality: normalizeNutricaoActivityModality(record && record.activity_modality),
    activity_duration: normalizeNutricaoText(record && record.activity_duration),
    activity_frequency: normalizeNutricaoText(record && record.activity_frequency),
    ultraprocessed: normalizeNutricaoConsumption(record && record.ultraprocessed),
    processed: normalizeNutricaoConsumption(record && record.processed),
    in_natura: normalizeNutricaoConsumption(record && record.in_natura),
    bowel_function: normalizeNutricaoBowelFunction(record && record.bowel_function),
    water_intake: normalizeNutricaoText(record && record.water_intake),
    water_liters: normalizeNutricaoWaterLiters(record && record.water_liters),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeNutricaoText(value) {
  return String(value || "").trim();
}

function normalizeNutricaoWaterLiters(value) {
  const original = normalizeNutricaoText(value);
  if (!original) {
    return "";
  }

  const decimal = original.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(decimal);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return original;
  }

  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function normalizeNutricaoActivityModality(value) {
  const original = normalizeNutricaoText(value);
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "tempo livre ou lazer": "Tempo livre ou lazer",
    "tempo livre ou lazer ": "Tempo livre ou lazer",
    "atividade ocupacional": "Atividade ocupacional",
    deslocamento: "Deslocamento",
    "ambito das atividades domesticas": "Âmbito das atividades domésticas",
    "exercicio fisico": "Exercício físico",
  };

  return legacyValues[normalized] || original;
}

function normalizeNutricaoConsumption(value) {
  const original = normalizeNutricaoText(value);
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "baixo consumo": "Baixo consumo",
    "medio consumo": "Médio consumo",
    "alto consumo": "Alto consumo",
  };

  return legacyValues[normalized] || original;
}

function normalizeNutricaoBowelFunction(value) {
  const original = normalizeNutricaoText(value);
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    regular: "Regular",
    constipacao: "Constipação",
    diarreia: "Diarreia",
  };

  return legacyValues[normalized] || original;
}

function createNutricaoRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatNutricaoDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatNutricaoRace(value) {
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
