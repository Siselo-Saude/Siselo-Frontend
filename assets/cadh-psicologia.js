const PSICOLOGIA_STORAGE_KEY = "siselo_cadh_psicologia_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const INITIAL_CONSULTATION_LABEL = "1\u00AA Consulta (inicial)";

const psicologiaState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-psicologia") {
    return;
  }

  setupPsicologiaPage();
});

async function setupPsicologiaPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  psicologiaState.activePatientId = getPsicologiaContextPatientId();
  psicologiaState.records = readPsicologiaRecords();
  bindPsicologiaModal();
  bindPsicologiaViewModal();
  bindPsicologiaClinicalRules();
  SISELO.bindFieldGuidanceTooltips();

  SISELO.enhanceDateInput("psicologia_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  updatePsicologiaConsultationOptions("");
  syncPsicologiaConsultationSections();

  psicologiaState.patients = await loadPsicologiaPatients();
  psicologiaState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "psicologia_patient_id",
    container: "psicologia_patient_search",
    rows: psicologiaState.patients,
    currentValue: psicologiaState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (psicologiaState.activePatientId) {
        const scopedPatient = getActivePsicologiaPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (psicologiaState.patientPicker && scopedPatient && pickedPatientId !== psicologiaState.activePatientId) {
          psicologiaState.patientPicker.setValue(scopedPatient);
        }
        updatePsicologiaConsultationOptions(psicologiaState.activePatientId, psicologiaState.editingRecordId);
        updatePsicologiaPatientSummary(scopedPatient);
        updatePsicologiaAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findPsicologiaPatientById(patient.id) || patient
        : null;
      updatePsicologiaConsultationOptions(patient && patient.id, psicologiaState.editingRecordId);
      updatePsicologiaPatientSummary(selectedPatient);
      updatePsicologiaAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#psicologia_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "psicologia_patient_search_input";
  }

  applyPsicologiaPatientScope();
  updatePsicologiaScopeControls();
  renderPsicologiaTable();
}

function bindPsicologiaModal() {
  const modal = document.getElementById("psicologia-modal");
  const form = document.getElementById("psicologia-form");
  const newButton = document.getElementById("psicologia-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openPsicologiaModal();
  });

  modal.querySelectorAll("[data-psicologia-close]").forEach((button) => {
    button.addEventListener("click", () => closePsicologiaModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closePsicologiaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closePsicologiaModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    savePsicologiaRecord();
  });
}

function bindPsicologiaViewModal() {
  const modal = document.getElementById("psicologia-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-psicologia-view-close]").forEach((button) => {
    button.addEventListener("click", () => closePsicologiaViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closePsicologiaViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closePsicologiaViewModal();
    }
  });
}

function bindPsicologiaClinicalRules() {
  const consultationSelect = document.getElementById("psicologia_consultation_number");
  if (consultationSelect instanceof HTMLSelectElement) {
    consultationSelect.addEventListener("change", syncPsicologiaConsultationSections);
  }
}

async function loadPsicologiaPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergePsicologiaPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getPsicologiaContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActivePsicologiaPatient() {
  const patientId = SISELO.normalizeEntityId(psicologiaState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findPsicologiaPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizePsicologiaPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyPsicologiaPatientScope() {
  const scopedPatient = getActivePsicologiaPatient();
  if (!scopedPatient || !psicologiaState.patientPicker) {
    return;
  }

  psicologiaState.patientPicker.setValue(scopedPatient);
  updatePsicologiaConsultationOptions(scopedPatient.id, psicologiaState.editingRecordId);
  updatePsicologiaPatientSummary(scopedPatient);
  updatePsicologiaAgeGuidance(scopedPatient);

  const input = document.querySelector("#psicologia_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updatePsicologiaScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(psicologiaState.activePatientId));
  const newButton = document.getElementById("psicologia-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Psicologia.";
  }
}

function mergePsicologiaPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizePsicologiaPatient(row);
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

function normalizePsicologiaPatient(patient) {
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

function openPsicologiaModal(record = null) {
  const modal = document.getElementById("psicologia-modal");
  const form = document.getElementById("psicologia-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(psicologiaState.activePatientId)) {
    SISELO.showAlert("psicologia-alert", "Selecione um usuário no CADH antes de criar um registro de Psicologia.", "error");
    return;
  }

  psicologiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("psicologia-alert", "", "info");
  fillPsicologiaForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#psicologia_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closePsicologiaModal() {
  const modal = document.getElementById("psicologia-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (psicologiaState.lastFocus instanceof HTMLElement) {
    psicologiaState.lastFocus.focus();
  }
}

function openPsicologiaViewModal(record) {
  const modal = document.getElementById("psicologia-view-modal");
  const content = document.getElementById("psicologia-view-content");
  if (!modal || !content) {
    return;
  }

  psicologiaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderPsicologiaViewRecord(normalizePsicologiaRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-psicologia-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closePsicologiaViewModal() {
  const modal = document.getElementById("psicologia-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (psicologiaState.lastFocus instanceof HTMLElement) {
    psicologiaState.lastFocus.focus();
  }
}

function fillPsicologiaForm(record = null) {
  const normalizedRecord = record ? normalizePsicologiaRecord(record) : null;
  psicologiaState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizePsicologiaPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizePsicologiaPatient({
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
    ? findPsicologiaPatientById(normalizedRecord.patient_id) || recordPatient
    : getActivePsicologiaPatient() || cachedPatient;

  setPsicologiaField("psicologia_record_id", normalizedRecord ? normalizedRecord.id : "");
  setPsicologiaField("psicologia_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setPsicologiaField("psicologia_literacy", normalizedRecord ? normalizedRecord.literacy : "");
  setPsicologiaField("psicologia_family_support", normalizedRecord ? normalizedRecord.family_support : "");
  setPsicologiaField("psicologia_self_care_capacity", normalizedRecord ? normalizedRecord.self_care_capacity : "");
  setPsicologiaField("psicologia_adherence", normalizedRecord ? normalizedRecord.adherence : "");
  setPsicologiaField("psicologia_motivational_stage", normalizedRecord ? normalizedRecord.motivational_stage : "");
  setPsicologiaField("psicologia_barriers_plan", normalizedRecord ? normalizedRecord.barriers_plan : "");
  setPsicologiaField("psicologia_recommendations_plan", normalizedRecord ? normalizedRecord.recommendations_plan : "");
  setPsicologiaField("psicologia_followup_adherence", normalizedRecord ? normalizedRecord.followup_adherence : "");
  setPsicologiaField("psicologia_followup_motivational_stage", normalizedRecord ? normalizedRecord.followup_motivational_stage : "");
  setPsicologiaField("psicologia_self_care_score", normalizedRecord ? normalizedRecord.self_care_score : "");
  setPsicologiaField("psicologia_lifestyle_changes", normalizedRecord ? normalizedRecord.lifestyle_changes : "");
  setPsicologiaField("psicologia_previous_goals", normalizedRecord ? normalizedRecord.previous_goals : "");
  setPsicologiaField("psicologia_current_barriers", normalizedRecord ? normalizedRecord.current_barriers : "");
  setPsicologiaField("psicologia_goals_today", normalizedRecord ? normalizedRecord.goals_today : "");

  if (psicologiaState.patientPicker) {
    psicologiaState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updatePsicologiaPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updatePsicologiaAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updatePsicologiaConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    psicologiaState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );
  syncPsicologiaConsultationSections();

  const dateInput = document.getElementById("psicologia_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setPsicologiaField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function syncPsicologiaConsultationSections() {
  const select = document.getElementById("psicologia_consultation_number");
  const initialSection = document.getElementById("psicologia-initial-section");
  const subsequentSection = document.getElementById("psicologia-subsequent-section");
  const isInitial = !(select instanceof HTMLSelectElement) || isInitialPsicologiaConsultation(select.value);

  if (initialSection) {
    initialSection.hidden = !isInitial;
    setPsicologiaSectionDisabled(initialSection, !isInitial);
  }

  if (subsequentSection) {
    subsequentSection.hidden = isInitial;
    setPsicologiaSectionDisabled(subsequentSection, isInitial);
  }
}

function setPsicologiaSectionDisabled(section, disabled) {
  section.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = disabled;
  });
}

function updatePsicologiaConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("psicologia_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizePsicologiaConsultationLabel(preferredValue);
  const patientRecords = psicologiaState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialPsicologiaConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialPsicologiaConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parsePsicologiaConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parsePsicologiaConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatPsicologiaConsultationLabel(preferredOrdinal)
    : formatPsicologiaConsultationLabel(nextOrdinal);
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

  syncPsicologiaConsultationSections();
}

function hasDuplicateInitialPsicologiaConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialPsicologiaConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return psicologiaState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialPsicologiaConsultation(record.consultation_number)
  ));
}

function normalizePsicologiaConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parsePsicologiaConsultationOrdinal(normalized);
  return ordinal ? formatPsicologiaConsultationLabel(ordinal) : "";
}

function isInitialPsicologiaConsultation(value) {
  return parsePsicologiaConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parsePsicologiaConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatPsicologiaConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function savePsicologiaRecord() {
  const form = document.getElementById("psicologia-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "psicologia-alert" })) {
    return;
  }

  const patientId = psicologiaState.activePatientId || (psicologiaState.patientPicker
    ? psicologiaState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("psicologia-alert", "Selecione o paciente.", "error");
    if (psicologiaState.patientPicker) {
      psicologiaState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const consultationNumber = payload.consultation_number || INITIAL_CONSULTATION_LABEL;
  const isInitial = isInitialPsicologiaConsultation(consultationNumber);

  if (hasDuplicateInitialPsicologiaConsultation(patientId, payload.record_id || "", consultationNumber)) {
    SISELO.showAlert("psicologia-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updatePsicologiaConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolvePsicologiaPatient(patientId);
  const record = normalizePsicologiaRecord({
    id: payload.record_id || createPsicologiaRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: consultationNumber,
    literacy: isInitial ? payload.literacy : "",
    family_support: isInitial ? payload.family_support : "",
    self_care_capacity: isInitial ? payload.self_care_capacity : "",
    adherence: isInitial ? payload.adherence : "",
    motivational_stage: isInitial ? payload.motivational_stage : "",
    barriers_plan: isInitial ? payload.barriers_plan : "",
    recommendations_plan: isInitial ? payload.recommendations_plan : "",
    followup_adherence: isInitial ? "" : payload.followup_adherence,
    followup_motivational_stage: isInitial ? "" : payload.followup_motivational_stage,
    self_care_score: isInitial ? "" : payload.self_care_score,
    lifestyle_changes: isInitial ? "" : payload.lifestyle_changes,
    previous_goals: isInitial ? "" : payload.previous_goals,
    current_barriers: isInitial ? "" : payload.current_barriers,
    goals_today: isInitial ? "" : payload.goals_today,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("psicologia-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = psicologiaState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    psicologiaState.records[existingIndex] = record;
  } else {
    psicologiaState.records.unshift(record);
  }

  writePsicologiaRecords(psicologiaState.records);
  renderPsicologiaTable();
  closePsicologiaModal();
}

function resolvePsicologiaPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findPsicologiaPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizePsicologiaPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    psicologiaState.patients = mergePsicologiaPatients(psicologiaState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findPsicologiaPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return psicologiaState.patients.find((item) => item.id === normalizedId) || null;
}

function updatePsicologiaPatientSummary(patient) {
  const element = document.getElementById("psicologia-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findPsicologiaPatientById(patient.id) || normalizePsicologiaPatient(patient);
  const ageYears = getPsicologiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderPsicologiaPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderPsicologiaPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderPsicologiaPatientSummaryItem("Cor/Raça", formatPsicologiaRace(fullPatient.race)),
    renderPsicologiaPatientSummaryItem("Idade", ageLabel),
    renderPsicologiaPatientSummaryItem("Nascimento", formatPsicologiaDate(fullPatient.birth_date)),
    renderPsicologiaPatientSummaryItem("1º atendimento CADH", formatPsicologiaDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderPsicologiaPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updatePsicologiaAgeGuidance(patient) {
  const element = document.getElementById("psicologia-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findPsicologiaPatientById(patient.id) || normalizePsicologiaPatient(patient);
  const ageYears = getPsicologiaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getPsicologiaAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getPsicologiaAgeYears(patient) {
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

function getPsicologiaAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Avalie compreensão, adesão, rede de apoio, motivação para mudança e barreiras psicossociais.";
  }

  if (ageYears < 2) {
    return "Use avaliação com responsável, desenvolvimento, vínculo familiar e sinais de alerta.";
  }

  if (ageYears < 10) {
    return "Considere responsável presente, rotina familiar, compreensão do cuidado e desenvolvimento.";
  }

  if (ageYears < 20) {
    return "Considere autonomia, apoio familiar, escola, adesão e sofrimento emocional.";
  }

  if (ageYears >= 60) {
    return "Considere cognição, autonomia, rede de apoio, perdas, humor e barreiras para autocuidado.";
  }

  return "Avalie adesão, estágio motivacional, suporte familiar, autocuidado e metas possíveis.";
}

function renderPsicologiaViewRecord(record) {
  const item = record || {};
  const isInitial = isInitialPsicologiaConsultation(item.consultation_number);

  return `
    ${renderPsicologiaViewSection("Identificação", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatPsicologiaRace(item.race)],
      ["Data de nascimento", formatPsicologiaDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatPsicologiaDate(item.first_cadh_date)],
    ])}
    ${renderPsicologiaViewSection("Consulta", [
      ["Data da consulta", formatPsicologiaDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${isInitial ? renderPsicologiaViewSection("Primeira consulta", [
      ["Letramento funcional em saúde", item.literacy || "-"],
      ["Suporte familiar", item.family_support || "-"],
      ["Capacidade de autocuidado", item.self_care_capacity || "-"],
      ["Adesão terapêutica", item.adherence || "-"],
      ["Estágio motivacional para a mudança", item.motivational_stage || "-"],
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers_plan || "-", true],
      ["Recomendações- Ficha Plano de Cuidado", item.recommendations_plan || "-", true],
    ]) : renderPsicologiaViewSection("Consulta subsequente", [
      ["Adesão terapêutica", item.followup_adherence || "-"],
      ["Estágio motivacional para a mudança", item.followup_motivational_stage || "-"],
      ["Pontuação declarada do autocuidado", item.self_care_score || "-"],
      ["Fez mudanças no estilo de vida?", item.lifestyle_changes || "-", true],
      ["Cumpriu metas pactuadas na sessão passada?", item.previous_goals || "-", true],
      ["Dificultadores atuais", item.current_barriers || "-", true],
      ["Metas pactuadas hoje", item.goals_today || "-", true],
    ])}
  `;
}

function renderPsicologiaViewSection(title, items) {
  return `
    <section class="psicologia-view-section">
      <h3 class="psicologia-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="psicologia-view-grid">
        ${items.map(([label, value, wide]) => renderPsicologiaViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderPsicologiaViewItem(label, value, wide = false) {
  return `
    <div class="psicologia-view-item${wide ? " is-wide" : ""}">
      <span class="psicologia-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="psicologia-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderPsicologiaTable() {
  const tbody = document.getElementById("psicologia-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(psicologiaState.activePatientId);
  const records = psicologiaState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .sort((left, right) => {
      const consultationOrder = parsePsicologiaConsultationOrdinal(right.consultation_number) -
        parsePsicologiaConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Psicologia encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Psicologia.";
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="psicologia-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindPsicologiaTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatPsicologiaDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.literacy || "-")}</td>
      <td>${SISELO.escapeHtml(getPsicologiaAdherenceSummary(record))}</td>
      <td>${SISELO.escapeHtml(getPsicologiaStageSummary(record))}</td>
      <td>${SISELO.escapeHtml(getPsicologiaSelfCareSummary(record))}</td>
      <td>${SISELO.escapeHtml(getPsicologiaPlanSummary(record))}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver guia clínica", { "data-psicologia-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-psicologia-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-psicologia-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindPsicologiaTableActions();
}

function bindPsicologiaTableActions() {
  const tbody = document.getElementById("psicologia-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-psicologia-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = psicologiaState.records.find((item) => item.id === button.dataset.psicologiaEdit);
      if (record) {
        openPsicologiaModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-psicologia-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = psicologiaState.records.find((item) => item.id === button.dataset.psicologiaView);
      if (record) {
        openPsicologiaViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-psicologia-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function getPsicologiaAdherenceSummary(record) {
  return isInitialPsicologiaConsultation(record.consultation_number)
    ? record.adherence || "-"
    : record.followup_adherence || "-";
}

function getPsicologiaStageSummary(record) {
  return isInitialPsicologiaConsultation(record.consultation_number)
    ? record.motivational_stage || "-"
    : record.followup_motivational_stage || "-";
}

function getPsicologiaSelfCareSummary(record) {
  return isInitialPsicologiaConsultation(record.consultation_number)
    ? record.self_care_capacity || "-"
    : record.self_care_score || "-";
}

function getPsicologiaPlanSummary(record) {
  return isInitialPsicologiaConsultation(record.consultation_number)
    ? record.recommendations_plan || record.barriers_plan || "-"
    : record.goals_today || record.current_barriers || "-";
}

function readPsicologiaRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PSICOLOGIA_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizePsicologiaRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writePsicologiaRecords(records) {
  try {
    localStorage.setItem(
      PSICOLOGIA_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizePsicologiaRecord(record) {
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
    consultation_number: normalizePsicologiaConsultationLabel(record && record.consultation_number) || INITIAL_CONSULTATION_LABEL,
    literacy: String((record && record.literacy) || "").trim(),
    family_support: String((record && record.family_support) || "").trim(),
    self_care_capacity: String((record && record.self_care_capacity) || "").trim(),
    adherence: String((record && record.adherence) || "").trim(),
    motivational_stage: String((record && record.motivational_stage) || "").trim(),
    barriers_plan: String((record && record.barriers_plan) || "").trim(),
    recommendations_plan: String((record && record.recommendations_plan) || "").trim(),
    followup_adherence: String((record && record.followup_adherence) || "").trim(),
    followup_motivational_stage: String((record && record.followup_motivational_stage) || "").trim(),
    self_care_score: String((record && record.self_care_score) || "").trim(),
    lifestyle_changes: String((record && record.lifestyle_changes) || "").trim(),
    previous_goals: String((record && record.previous_goals) || "").trim(),
    current_barriers: String((record && record.current_barriers) || "").trim(),
    goals_today: String((record && record.goals_today) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function createPsicologiaRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `psicologia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatPsicologiaDate(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return normalized || "-";
}

function formatPsicologiaRace(value) {
  const normalized = String(value || "").trim();
  return normalized || "-";
}
