const FARMACIA_STORAGE_KEY = "siselo_cadh_farmacia_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const FARMACIA_INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";

const farmaciaState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-farmacia") {
    return;
  }

  setupFarmaciaPage();
});

async function setupFarmaciaPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  farmaciaState.activePatientId = getFarmaciaContextPatientId();
  farmaciaState.records = readFarmaciaRecords();
  bindFarmaciaModal();
  bindFarmaciaViewModal();
  SISELO.bindFieldGuidanceTooltips();
  updateFarmaciaConsultationOptions("");

  SISELO.enhanceDateInput("farmacia_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });

  farmaciaState.patients = await loadFarmaciaPatients();
  farmaciaState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "farmacia_patient_id",
    container: "farmacia_patient_search",
    rows: farmaciaState.patients,
    currentValue: farmaciaState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (farmaciaState.activePatientId) {
        const scopedPatient = getActiveFarmaciaPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (farmaciaState.patientPicker && scopedPatient && pickedPatientId !== farmaciaState.activePatientId) {
          farmaciaState.patientPicker.setValue(scopedPatient);
        }
        updateFarmaciaConsultationOptions(farmaciaState.activePatientId, farmaciaState.editingRecordId);
        updateFarmaciaPatientSummary(scopedPatient);
        updateFarmaciaAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findFarmaciaPatientById(patient.id) || patient
        : null;
      updateFarmaciaConsultationOptions(patient && patient.id, farmaciaState.editingRecordId);
      updateFarmaciaPatientSummary(selectedPatient);
      updateFarmaciaAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#farmacia_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "farmacia_patient_search_input";
  }

  applyFarmaciaPatientScope();
  updateFarmaciaScopeControls();
  renderFarmaciaTable();
}

function bindFarmaciaModal() {
  const modal = document.getElementById("farmacia-modal");
  const form = document.getElementById("farmacia-form");
  const newButton = document.getElementById("farmacia-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openFarmaciaModal();
  });

  modal.querySelectorAll("[data-farmacia-close]").forEach((button) => {
    button.addEventListener("click", () => closeFarmaciaModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeFarmaciaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeFarmaciaModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveFarmaciaRecord();
  });
}

function bindFarmaciaViewModal() {
  const modal = document.getElementById("farmacia-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-farmacia-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeFarmaciaViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeFarmaciaViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeFarmaciaViewModal();
    }
  });
}

async function loadFarmaciaPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeFarmaciaPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getFarmaciaContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveFarmaciaPatient() {
  const patientId = SISELO.normalizeEntityId(farmaciaState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findFarmaciaPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFarmaciaPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyFarmaciaPatientScope() {
  const scopedPatient = getActiveFarmaciaPatient();
  if (!scopedPatient || !farmaciaState.patientPicker) {
    return;
  }

  farmaciaState.patientPicker.setValue(scopedPatient);
  updateFarmaciaConsultationOptions(scopedPatient.id, farmaciaState.editingRecordId);
  updateFarmaciaPatientSummary(scopedPatient);
  updateFarmaciaAgeGuidance(scopedPatient);

  const input = document.querySelector("#farmacia_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateFarmaciaScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(farmaciaState.activePatientId));
  const newButton = document.getElementById("farmacia-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Farmácia Clínica.";
  }
}

function mergeFarmaciaPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeFarmaciaPatient(row);
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

function normalizeFarmaciaPatient(patient) {
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

function openFarmaciaModal(record = null) {
  const modal = document.getElementById("farmacia-modal");
  const form = document.getElementById("farmacia-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(farmaciaState.activePatientId)) {
    SISELO.showAlert("farmacia-alert", "Selecione um usuário no CADH antes de criar um registro de Farmácia Clínica.", "error");
    return;
  }

  farmaciaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("farmacia-alert", "", "info");
  fillFarmaciaForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#farmacia_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeFarmaciaModal() {
  const modal = document.getElementById("farmacia-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (farmaciaState.lastFocus instanceof HTMLElement) {
    farmaciaState.lastFocus.focus();
  }
}

function openFarmaciaViewModal(record) {
  const modal = document.getElementById("farmacia-view-modal");
  const content = document.getElementById("farmacia-view-content");
  if (!modal || !content) {
    return;
  }

  farmaciaState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderFarmaciaViewRecord(normalizeFarmaciaRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-farmacia-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeFarmaciaViewModal() {
  const modal = document.getElementById("farmacia-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (farmaciaState.lastFocus instanceof HTMLElement) {
    farmaciaState.lastFocus.focus();
  }
}

function fillFarmaciaForm(record = null) {
  const normalizedRecord = record ? normalizeFarmaciaRecord(record) : null;
  farmaciaState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFarmaciaPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeFarmaciaPatient({
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
    ? findFarmaciaPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveFarmaciaPatient() || cachedPatient;

  setFarmaciaField("farmacia_record_id", normalizedRecord ? normalizedRecord.id : "");
  setFarmaciaField("farmacia_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setFarmaciaField("farmacia_medication_treatment", normalizedRecord ? normalizedRecord.medication_treatment : "");
  setFarmaciaField("farmacia_drug_interaction", normalizedRecord ? normalizedRecord.drug_interaction : "");
  setFarmaciaField("farmacia_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setFarmaciaField("farmacia_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");

  if (farmaciaState.patientPicker) {
    farmaciaState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateFarmaciaPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateFarmaciaAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateFarmaciaConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    farmaciaState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  const dateInput = document.getElementById("farmacia_consultation_date");
  if (dateInput instanceof HTMLInputElement) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setFarmaciaField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function saveFarmaciaRecord() {
  const form = document.getElementById("farmacia-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "farmacia-alert" })) {
    return;
  }

  const patientId = farmaciaState.activePatientId || (farmaciaState.patientPicker
    ? farmaciaState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("farmacia-alert", "Selecione o paciente.", "error");
    if (farmaciaState.patientPicker) {
      farmaciaState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const missingFields = validateFarmaciaRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("farmacia-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingFarmaciaField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialFarmaciaConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("farmacia-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateFarmaciaConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveFarmaciaPatient(patientId);
  const record = normalizeFarmaciaRecord({
    id: payload.record_id || createFarmaciaRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || FARMACIA_INITIAL_CONSULTATION_LABEL,
    medication_treatment: payload.medication_treatment,
    drug_interaction: payload.drug_interaction,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("farmacia-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = farmaciaState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    farmaciaState.records[existingIndex] = record;
  } else {
    farmaciaState.records.unshift(record);
  }

  writeFarmaciaRecords(farmaciaState.records);
  renderFarmaciaTable();
  closeFarmaciaModal();
}

function validateFarmaciaRequiredFields(payload) {
  return [
    ["consultation_date", "Data da consulta"],
    ["medication_treatment", "Tratamento medicamentoso"],
    ["drug_interaction", "Interação medicamentosa"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ]
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingFarmaciaField(label) {
  const fieldMap = {
    "Data da consulta": "farmacia_consultation_date",
    "Tratamento medicamentoso": "farmacia_medication_treatment",
    "Interação medicamentosa": "farmacia_drug_interaction",
    "Fatores dificultadores": "farmacia_barriers",
    Recomendações: "farmacia_recommendations",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function updateFarmaciaConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("farmacia_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeFarmaciaConsultationLabel(preferredValue);
  const patientRecords = farmaciaState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialFarmaciaConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialFarmaciaConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseFarmaciaConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseFarmaciaConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatFarmaciaConsultationLabel(preferredOrdinal)
    : formatFarmaciaConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: FARMACIA_INITIAL_CONSULTATION_LABEL,
    label: FARMACIA_INITIAL_CONSULTATION_LABEL,
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
  select.value = firstEnabled ? firstEnabled.value : FARMACIA_INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialFarmaciaConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialFarmaciaConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return farmaciaState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialFarmaciaConsultation(record.consultation_number)
  ));
}

function normalizeFarmaciaConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parseFarmaciaConsultationOrdinal(normalized);
  return ordinal ? formatFarmaciaConsultationLabel(ordinal) : "";
}

function isInitialFarmaciaConsultation(value) {
  return parseFarmaciaConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseFarmaciaConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatFarmaciaConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? FARMACIA_INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function resolveFarmaciaPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findFarmaciaPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeFarmaciaPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    farmaciaState.patients = mergeFarmaciaPatients(farmaciaState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findFarmaciaPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return farmaciaState.patients.find((item) => item.id === normalizedId) || null;
}

function updateFarmaciaPatientSummary(patient) {
  const element = document.getElementById("farmacia-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findFarmaciaPatientById(patient.id) || normalizeFarmaciaPatient(patient);
  const ageYears = getFarmaciaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderFarmaciaPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderFarmaciaPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderFarmaciaPatientSummaryItem("Cor/Raça", formatFarmaciaRace(fullPatient.race)),
    renderFarmaciaPatientSummaryItem("Idade", ageLabel),
    renderFarmaciaPatientSummaryItem("Nascimento", formatFarmaciaDate(fullPatient.birth_date)),
    renderFarmaciaPatientSummaryItem("1º atendimento CADH", formatFarmaciaDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderFarmaciaPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateFarmaciaAgeGuidance(patient) {
  const element = document.getElementById("farmacia-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findFarmaciaPatientById(patient.id) || normalizeFarmaciaPatient(patient);
  const ageYears = getFarmaciaAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getFarmaciaAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getFarmaciaAgeYears(patient) {
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

function getFarmaciaAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Registre tratamento medicamentoso, possíveis interações, barreiras de adesão e orientação pactuada.";
  }

  if (ageYears < 2) {
    return "Confirme dose, apresentação, responsável pelo uso, armazenamento e sinais de alerta.";
  }

  if (ageYears < 10) {
    return "Considere responsável, rotina familiar, forma farmacêutica, dose e compreensão da prescrição.";
  }

  if (ageYears < 20) {
    return "Avalie autonomia, adesão, compreensão da prescrição, eventos adversos e apoio familiar.";
  }

  if (ageYears >= 60) {
    return "Considere polifarmácia, função renal, risco de interação, quedas, cognição e organização do uso.";
  }

  return "Avalie adesão, segurança, interações, eventos adversos, acesso e conciliação medicamentosa.";
}

function renderFarmaciaViewRecord(record) {
  const item = record || {};

  return `
    ${renderFarmaciaViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatFarmaciaRace(item.race)],
      ["Data de nascimento", formatFarmaciaDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatFarmaciaDate(item.first_cadh_date)],
      ["Data da consulta", formatFarmaciaDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderFarmaciaViewSection("Acompanhamento medicamentoso", [
      ["Tratamento medicamentoso", item.medication_treatment || "-"],
      ["Interação medicamentosa", item.drug_interaction || "-"],
    ])}
    ${renderFarmaciaViewSection("Plano de cuidado", [
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers || "-", true],
      ["Recomendações - Ficha Plano de Cuidado", item.recommendations || "-", true],
    ])}
  `;
}

function renderFarmaciaViewSection(title, items) {
  return `
    <section class="farmacia-view-section">
      <h3 class="farmacia-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="farmacia-view-grid">
        ${items.map(([label, value, wide]) => renderFarmaciaViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderFarmaciaViewItem(label, value, wide = false) {
  return `
    <div class="farmacia-view-item${wide ? " is-wide" : ""}">
      <span class="farmacia-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="farmacia-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderFarmaciaTable() {
  const tbody = document.getElementById("farmacia-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(farmaciaState.activePatientId);
  const records = farmaciaState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseFarmaciaConsultationOrdinal(right.consultation_number) -
        parseFarmaciaConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Farmácia Clínica encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Farmácia Clínica.";
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="farmacia-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindFarmaciaTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatFarmaciaDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.medication_treatment || "-")}</td>
      <td>${SISELO.escapeHtml(record.drug_interaction || "-")}</td>
      <td>${SISELO.escapeHtml(record.barriers || "-")}</td>
      <td>${SISELO.escapeHtml(record.recommendations || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver consulta de Farmácia Clínica", { "data-farmacia-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-farmacia-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-farmacia-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindFarmaciaTableActions();
}

function bindFarmaciaTableActions() {
  const tbody = document.getElementById("farmacia-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-farmacia-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = farmaciaState.records.find((item) => item.id === button.dataset.farmaciaEdit);
      if (record) {
        openFarmaciaModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-farmacia-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = farmaciaState.records.find((item) => item.id === button.dataset.farmaciaView);
      if (record) {
        openFarmaciaViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-farmacia-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function readFarmaciaRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FARMACIA_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeFarmaciaRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeFarmaciaRecords(records) {
  try {
    localStorage.setItem(
      FARMACIA_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeFarmaciaRecord(record) {
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
    consultation_number: normalizeFarmaciaConsultationLabel(record && record.consultation_number) || FARMACIA_INITIAL_CONSULTATION_LABEL,
    medication_treatment: normalizeFarmaciaMedicationTreatment(record && record.medication_treatment),
    drug_interaction: normalizeFarmaciaYesNo(record && record.drug_interaction),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeFarmaciaMedicationTreatment(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "nao utiliza medicamentos": "Não utiliza medicamentos",
    "1 a 5 medicamentos": "1 a 5 medicamentos",
    "6 a 10 medicamentos": "6 a 10 medicamentos",
    "> 10 medicamentos": "> 10 medicamentos",
    "mais de 10 medicamentos": "> 10 medicamentos",
  };

  return legacyValues[normalized] || original;
}

function normalizeFarmaciaYesNo(value) {
  const normalized = SISELO.normalizeSearchText(value);
  if (normalized === "sim") {
    return "Sim";
  }
  if (normalized === "nao") {
    return "Não";
  }
  return String(value || "").trim();
}

function createFarmaciaRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `farmacia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFarmaciaDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatFarmaciaRace(value) {
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
