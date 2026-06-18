const OFTALMO_STORAGE_KEY = "siselo_cadh_oftalmo_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const OFTALMO_INITIAL_CONSULTATION_LABEL = "1ª Consulta (inicial)";
const OFTALMO_MAX_REFERRALS = 2;
const OFTALMO_REFERRAL_OPTIONS = [
  "Retina",
  "Glaucoma",
  "Catarata",
  "Plástica ocular",
  "Córnea",
  "Pterígio",
  "Outros",
];

const oftalmoState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-oftalmologia") {
    return;
  }

  setupOftalmoPage();
});

async function setupOftalmoPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  oftalmoState.activePatientId = getOftalmoContextPatientId();
  oftalmoState.records = readOftalmoRecords();
  bindOftalmoModal();
  bindOftalmoViewModal();
  SISELO.bindFieldGuidanceTooltips();
  updateOftalmoConsultationOptions("");

  SISELO.enhanceDateInput("oftalmo_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });
  renderOftalmoReferralRows([{}, {}]);

  oftalmoState.patients = await loadOftalmoPatients();
  oftalmoState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "oftalmo_patient_id",
    container: "oftalmo_patient_search",
    rows: oftalmoState.patients,
    currentValue: oftalmoState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (oftalmoState.activePatientId) {
        const scopedPatient = getActiveOftalmoPatient();
        const pickedPatientId = SISELO.normalizeEntityId(patient && patient.id);
        if (oftalmoState.patientPicker && scopedPatient && pickedPatientId !== oftalmoState.activePatientId) {
          oftalmoState.patientPicker.setValue(scopedPatient);
        }
        updateOftalmoConsultationOptions(oftalmoState.activePatientId, oftalmoState.editingRecordId);
        updateOftalmoPatientSummary(scopedPatient);
        updateOftalmoAgeGuidance(scopedPatient);
        return;
      }

      const selectedPatient = patient && patient.id
        ? findOftalmoPatientById(patient.id) || patient
        : null;
      updateOftalmoConsultationOptions(patient && patient.id, oftalmoState.editingRecordId);
      updateOftalmoPatientSummary(selectedPatient);
      updateOftalmoAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#oftalmo_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "oftalmo_patient_search_input";
  }

  applyOftalmoPatientScope();
  updateOftalmoScopeControls();
  renderOftalmoTable();
}

function bindOftalmoModal() {
  const modal = document.getElementById("oftalmo-modal");
  const form = document.getElementById("oftalmo-form");
  const newButton = document.getElementById("oftalmo-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openOftalmoModal();
  });

  modal.querySelectorAll("[data-oftalmo-close]").forEach((button) => {
    button.addEventListener("click", () => closeOftalmoModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeOftalmoModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeOftalmoModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveOftalmoRecord();
  });
}

function bindOftalmoViewModal() {
  const modal = document.getElementById("oftalmo-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-oftalmo-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeOftalmoViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeOftalmoViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeOftalmoViewModal();
    }
  });
}

async function loadOftalmoPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeOftalmoPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function getOftalmoContextPatientId() {
  const queryPatientId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryPatientId) {
    return queryPatientId;
  }

  const cachedState = readCadhSearchState();
  return SISELO.normalizeEntityId(cachedState && cachedState.patient && cachedState.patient.id);
}

function getActiveOftalmoPatient() {
  const patientId = SISELO.normalizeEntityId(oftalmoState.activePatientId);
  if (!patientId) {
    return null;
  }

  const patient = findOftalmoPatientById(patientId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeOftalmoPatient(cachedState.patient)
    : null;

  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyOftalmoPatientScope() {
  const scopedPatient = getActiveOftalmoPatient();
  if (!scopedPatient || !oftalmoState.patientPicker) {
    return;
  }

  oftalmoState.patientPicker.setValue(scopedPatient);
  updateOftalmoConsultationOptions(scopedPatient.id, oftalmoState.editingRecordId);
  updateOftalmoPatientSummary(scopedPatient);
  updateOftalmoAgeGuidance(scopedPatient);

  const input = document.querySelector("#oftalmo_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateOftalmoScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(oftalmoState.activePatientId));
  const newButton = document.getElementById("oftalmo-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient
      ? ""
      : "Selecione um usuário no CADH para liberar a Oftalmologia.";
  }
}

function mergeOftalmoPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeOftalmoPatient(row);
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

function normalizeOftalmoPatient(patient) {
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

function openOftalmoModal(record = null) {
  const modal = document.getElementById("oftalmo-modal");
  const form = document.getElementById("oftalmo-form");
  if (!modal || !form) {
    return;
  }

  if (!record && !SISELO.normalizeEntityId(oftalmoState.activePatientId)) {
    SISELO.showAlert("oftalmo-alert", "Selecione um usuário no CADH antes de criar um registro de Oftalmologia.", "error");
    return;
  }

  oftalmoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("oftalmo-alert", "", "info");
  fillOftalmoForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#oftalmo_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeOftalmoModal() {
  const modal = document.getElementById("oftalmo-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (oftalmoState.lastFocus instanceof HTMLElement) {
    oftalmoState.lastFocus.focus();
  }
}

function openOftalmoViewModal(record) {
  const modal = document.getElementById("oftalmo-view-modal");
  const content = document.getElementById("oftalmo-view-content");
  if (!modal || !content) {
    return;
  }

  oftalmoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderOftalmoViewRecord(normalizeOftalmoRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-oftalmo-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeOftalmoViewModal() {
  const modal = document.getElementById("oftalmo-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (oftalmoState.lastFocus instanceof HTMLElement) {
    oftalmoState.lastFocus.focus();
  }
}

function fillOftalmoForm(record = null) {
  const normalizedRecord = record ? normalizeOftalmoRecord(record) : null;
  oftalmoState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeOftalmoPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeOftalmoPatient({
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
    ? findOftalmoPatientById(normalizedRecord.patient_id) || recordPatient
    : getActiveOftalmoPatient() || cachedPatient;

  setOftalmoField("oftalmo_record_id", normalizedRecord ? normalizedRecord.id : "");
  setOftalmoField("oftalmo_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setOftalmoField("oftalmo_right_visual_acuity", normalizedRecord ? normalizedRecord.right_visual_acuity : "");
  setOftalmoField("oftalmo_left_visual_acuity", normalizedRecord ? normalizedRecord.left_visual_acuity : "");
  setOftalmoField("oftalmo_biomicroscopy", normalizedRecord ? normalizedRecord.biomicroscopy : "");
  setOftalmoField("oftalmo_tonometry", normalizedRecord ? normalizedRecord.tonometry : "");
  setOftalmoField("oftalmo_fundoscopy", normalizedRecord ? normalizedRecord.fundoscopy : "");
  setOftalmoField("oftalmo_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setOftalmoField("oftalmo_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");
  renderOftalmoReferralRows(normalizedRecord && normalizedRecord.referrals && normalizedRecord.referrals.length
    ? normalizedRecord.referrals
    : [{}, {}]);

  if (oftalmoState.patientPicker) {
    oftalmoState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }

  updateOftalmoPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateOftalmoAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateOftalmoConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    oftalmoState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  [
    "oftalmo_consultation_date",
  ].forEach((id) => {
    const dateInput = document.getElementById(id);
    if (dateInput instanceof HTMLInputElement) {
      SISELO.syncEnhancedDateInput(dateInput);
    }
  });
}

function setOftalmoField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
  if (field instanceof HTMLSelectElement) {
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function normalizeOftalmoReferralItem(referral) {
  return {
    specialty: normalizeOftalmoReferralSpecialty(referral && (referral.specialty || referral.referral_specialty)),
    schedule_date: String((referral && (referral.schedule_date || referral.referral_schedule_date)) || "").trim(),
    execution_date: String((referral && (referral.execution_date || referral.referral_execution_date)) || "").trim(),
  };
}

function hasOftalmoReferralItem(referral) {
  return Boolean(referral && (
    String(referral.specialty || "").trim() ||
    String(referral.schedule_date || "").trim() ||
    String(referral.execution_date || "").trim()
  ));
}

function getOftalmoReferralRows() {
  return Array.from(document.querySelectorAll("[data-oftalmo-referral-row]"));
}

function collectOftalmoReferralRows(options = {}) {
  const includeEmpty = options.includeEmpty === true;
  return getOftalmoReferralRows()
    .map((row) => normalizeOftalmoReferralItem({
      specialty: row.querySelector("[data-oftalmo-referral-specialty]")?.value,
      schedule_date: row.querySelector("[data-oftalmo-referral-schedule]")?.value,
      execution_date: row.querySelector("[data-oftalmo-referral-execution]")?.value,
    }))
    .slice(0, OFTALMO_MAX_REFERRALS)
    .filter((referral) => includeEmpty || hasOftalmoReferralItem(referral));
}

function buildOftalmoReferralOptions(selectedValue) {
  const selected = normalizeOftalmoReferralSpecialty(selectedValue);
  return [
    '<option value="" hidden>Selecione...</option>',
    ...OFTALMO_REFERRAL_OPTIONS.map((option) => (
      `<option value="${SISELO.escapeHtml(option)}" ${option === selected ? "selected" : ""}>${SISELO.escapeHtml(option)}</option>`
    )),
  ].join("");
}

function renderOftalmoReferralRows(referrals) {
  const list = document.getElementById("oftalmo-referral-list");
  if (!list) {
    return;
  }

  const sourceReferrals = Array.isArray(referrals) ? referrals : [];
  const normalizedReferrals = Array.from(
    { length: OFTALMO_MAX_REFERRALS },
    (_, index) => normalizeOftalmoReferralItem(sourceReferrals[index] || {}),
  );

  list.innerHTML = normalizedReferrals.map((referral, index) => `
    <div class="oftalmo-referral-row" data-oftalmo-referral-row>
      <div class="field">
        <label for="oftalmo_referral_specialty_${index}">Especialista</label>
        <select id="oftalmo_referral_specialty_${index}" name="referrals[${index}][specialty]" data-oftalmo-referral-specialty>
          ${buildOftalmoReferralOptions(referral.specialty)}
        </select>
      </div>

      <div class="field">
        <label for="oftalmo_referral_schedule_date_${index}">Data de regulação/agendamento</label>
        <input id="oftalmo_referral_schedule_date_${index}" name="referrals[${index}][schedule_date]" type="date" placeholder="dd/mm/aaaa" value="${SISELO.escapeHtml(referral.schedule_date)}" data-oftalmo-referral-schedule>
      </div>

      <div class="field">
        <label for="oftalmo_referral_execution_date_${index}">Data da execução da consulta</label>
        <input id="oftalmo_referral_execution_date_${index}" name="referrals[${index}][execution_date]" type="date" placeholder="dd/mm/aaaa" value="${SISELO.escapeHtml(referral.execution_date)}" data-oftalmo-referral-execution>
      </div>
    </div>
  `).join("");

  SISELO.enhanceChoiceSelects(list);
  list.querySelectorAll("[data-oftalmo-referral-schedule], [data-oftalmo-referral-execution]").forEach((input) => {
    if (input instanceof HTMLInputElement) {
      SISELO.enhanceDateInput(input.id, { min: "1900-01-01" });
      SISELO.syncEnhancedDateInput(input);
    }
  });
}

function saveOftalmoRecord() {
  const form = document.getElementById("oftalmo-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "oftalmo-alert" })) {
    return;
  }

  const patientId = oftalmoState.activePatientId || (oftalmoState.patientPicker
    ? oftalmoState.patientPicker.getValue()
    : "");

  if (!patientId) {
    SISELO.showAlert("oftalmo-alert", "Selecione o paciente.", "error");
    if (oftalmoState.patientPicker) {
      oftalmoState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const missingFields = validateOftalmoRequiredFields(payload);
  if (missingFields.length) {
    SISELO.showAlert("oftalmo-alert", `Preencha: ${missingFields.join(", ")}.`, "error");
    focusFirstMissingOftalmoField(missingFields[0]);
    return;
  }

  if (hasDuplicateInitialOftalmoConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("oftalmo-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateOftalmoConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const referrals = collectOftalmoReferralRows();
  const primaryReferral = referrals[0] || {};
  const secondaryReferral = referrals[1] || {};
  const patient = resolveOftalmoPatient(patientId);
  const record = normalizeOftalmoRecord({
    id: payload.record_id || createOftalmoRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    team_ref: patient.team_ref || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || OFTALMO_INITIAL_CONSULTATION_LABEL,
    right_visual_acuity: payload.right_visual_acuity,
    left_visual_acuity: payload.left_visual_acuity,
    biomicroscopy: payload.biomicroscopy,
    tonometry: payload.tonometry,
    fundoscopy: payload.fundoscopy,
    referrals,
    referral_specialty_1: primaryReferral.specialty || "",
    referral_schedule_date_1: primaryReferral.schedule_date || "",
    referral_execution_date_1: primaryReferral.execution_date || "",
    referral_specialty_2: secondaryReferral.specialty || "",
    referral_schedule_date_2: secondaryReferral.schedule_date || "",
    referral_execution_date_2: secondaryReferral.execution_date || "",
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("oftalmo-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = oftalmoState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    oftalmoState.records[existingIndex] = record;
  } else {
    oftalmoState.records.unshift(record);
  }

  writeOftalmoRecords(oftalmoState.records);
  renderOftalmoTable();
  closeOftalmoModal();
}

function validateOftalmoRequiredFields(payload) {
  return [
    ["consultation_date", "Data da consulta"],
    ["right_visual_acuity", "Acuidade Visual OLHO DIREITO"],
    ["left_visual_acuity", "Acuidade Visual OLHO ESQUERDO"],
    ["biomicroscopy", "Biomicroscopia"],
    ["tonometry", "Tonometria"],
    ["fundoscopy", "Fundoscopia"],
    ["barriers", "Fatores dificultadores"],
    ["recommendations", "Recomendações"],
  ]
    .filter(([field]) => !String((payload && payload[field]) || "").trim())
    .map(([, label]) => label);
}

function focusFirstMissingOftalmoField(label) {
  const fieldMap = {
    "Data da consulta": "oftalmo_consultation_date",
    "Acuidade Visual OLHO DIREITO": "oftalmo_right_visual_acuity",
    "Acuidade Visual OLHO ESQUERDO": "oftalmo_left_visual_acuity",
    Biomicroscopia: "oftalmo_biomicroscopy",
    Tonometria: "oftalmo_tonometry",
    Fundoscopia: "oftalmo_fundoscopy",
    "Fatores dificultadores": "oftalmo_barriers",
    Recomendações: "oftalmo_recommendations",
  };
  const field = document.getElementById(fieldMap[label] || "");

  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function updateOftalmoConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("oftalmo_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeOftalmoConsultationLabel(preferredValue);
  const patientRecords = oftalmoState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialOftalmoConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialOftalmoConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseOftalmoConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseOftalmoConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatOftalmoConsultationLabel(preferredOrdinal)
    : formatOftalmoConsultationLabel(nextOrdinal);
  const options = [];

  options.push({
    value: OFTALMO_INITIAL_CONSULTATION_LABEL,
    label: OFTALMO_INITIAL_CONSULTATION_LABEL,
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
  select.value = firstEnabled ? firstEnabled.value : OFTALMO_INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialOftalmoConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialOftalmoConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return oftalmoState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialOftalmoConsultation(record.consultation_number)
  ));
}

function normalizeOftalmoConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Ã‚Âª/g, "ª")
    .trim();
  const ordinal = parseOftalmoConsultationOrdinal(normalized);
  return ordinal ? formatOftalmoConsultationLabel(ordinal) : "";
}

function isInitialOftalmoConsultation(value) {
  return parseOftalmoConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseOftalmoConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatOftalmoConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? OFTALMO_INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}ª Consulta (subsequente)`;
}

function resolveOftalmoPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findOftalmoPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeOftalmoPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    oftalmoState.patients = mergeOftalmoPatients(oftalmoState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findOftalmoPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return oftalmoState.patients.find((item) => item.id === normalizedId) || null;
}

function updateOftalmoPatientSummary(patient) {
  const element = document.getElementById("oftalmo-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findOftalmoPatientById(patient.id) || normalizeOftalmoPatient(patient);
  const ageYears = getOftalmoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderOftalmoPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderOftalmoPatientSummaryItem("Equipe", SISELO.formatTeamName(fullPatient.team_ref)),
    renderOftalmoPatientSummaryItem("Cor/Raça", formatOftalmoRace(fullPatient.race)),
    renderOftalmoPatientSummaryItem("Idade", ageLabel),
    renderOftalmoPatientSummaryItem("Nascimento", formatOftalmoDate(fullPatient.birth_date)),
    renderOftalmoPatientSummaryItem("1º atendimento CADH", formatOftalmoDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderOftalmoPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateOftalmoAgeGuidance(patient) {
  const element = document.getElementById("oftalmo-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findOftalmoPatientById(patient.id) || normalizeOftalmoPatient(patient);
  const ageYears = getOftalmoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getOftalmoAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getOftalmoAgeYears(patient) {
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

function getOftalmoAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Registre acuidade visual, exames, necessidade de regulação e orientações do plano de cuidado.";
  }

  if (ageYears < 2) {
    return "Observe sinais de alerta, acompanhamento do responsável, acesso à avaliação especializada e retorno pactuado.";
  }

  if (ageYears < 10) {
    return "Considere impacto visual nas atividades escolares, necessidade de óculos, acompanhamento familiar e regulação.";
  }

  if (ageYears < 20) {
    return "Avalie queixas visuais, adesão a óculos ou colírios, acompanhamento familiar e necessidade de especialista.";
  }

  if (ageYears >= 60) {
    return "Considere catarata, glaucoma, retinopatias, uso de colírios, risco de queda e acesso ao especialista.";
  }

  return "Avalie acuidade visual, exames, sintomas, uso de correção óptica, regulação e barreiras para seguimento.";
}

function renderOftalmoViewRecord(record) {
  const item = record || {};

  return `
    ${renderOftalmoViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(item.team_ref)],
      ["Cor/Raça", formatOftalmoRace(item.race)],
      ["Data de nascimento", formatOftalmoDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatOftalmoDate(item.first_cadh_date)],
      ["Data da consulta", formatOftalmoDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderOftalmoViewSection("Avaliação oftalmológica", [
      ["Acuidade Visual OLHO DIREITO", item.right_visual_acuity || "-"],
      ["Acuidade Visual OLHO ESQUERDO", item.left_visual_acuity || "-"],
      ["Biomicroscopia", item.biomicroscopy || "-"],
      ["Tonometria", item.tonometry || "-"],
      ["Fundoscopia", item.fundoscopy || "-"],
    ])}
    ${renderOftalmoViewSection("Encaminhamento ao especialista", getOftalmoReferralViewItems(item.referrals))}
    ${renderOftalmoViewSection("Plano de cuidado", [
      ["Fatores dificultadores - Ficha Plano de Cuidado", item.barriers || "-", true],
      ["Recomendações - Ficha Plano de Cuidado", item.recommendations || "-", true],
    ])}
  `;
}

function renderOftalmoViewSection(title, items) {
  return `
    <section class="oftalmo-view-section">
      <h3 class="oftalmo-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="oftalmo-view-grid">
        ${items.map(([label, value, wide]) => renderOftalmoViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderOftalmoViewItem(label, value, wide = false) {
  return `
    <div class="oftalmo-view-item${wide ? " is-wide" : ""}">
      <span class="oftalmo-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="oftalmo-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function getOftalmoReferralViewItems(referrals) {
  const rows = (Array.isArray(referrals) ? referrals : [])
    .filter((referral) => hasOftalmoReferralItem(referral));

  if (!rows.length) {
    return [["Especialista", "-"]];
  }

  return rows.map((referral, index) => {
    const parts = [
      referral.specialty || "-",
      referral.schedule_date ? `Reg.: ${formatOftalmoDate(referral.schedule_date)}` : "",
      referral.execution_date ? `Exec.: ${formatOftalmoDate(referral.execution_date)}` : "",
    ].filter(Boolean);
    return [
      index === 0 ? "Especialista" : "Especialista adicional",
      parts.join("\n") || "-",
      true,
    ];
  });
}

function renderOftalmoReferralSummary(specialty, scheduleDate, executionDate) {
  const rows = [];
  if (specialty) {
    rows.push(`<span class="oftalmo-referral-line">${SISELO.escapeHtml(specialty)}</span>`);
  }
  if (scheduleDate) {
    rows.push(`
      <span class="oftalmo-referral-line">
        Reg.: <span class="oftalmo-referral-date">${SISELO.escapeHtml(formatOftalmoDate(scheduleDate))}</span>
      </span>
    `);
  }
  if (executionDate) {
    rows.push(`
      <span class="oftalmo-referral-line">
        Exec.: <span class="oftalmo-referral-date">${SISELO.escapeHtml(formatOftalmoDate(executionDate))}</span>
      </span>
    `);
  }

  return rows.length ? `<div class="oftalmo-referral-cell">${rows.join("")}</div>` : "-";
}

function renderOftalmoReferralColumn(referrals, field) {
  const rows = (Array.isArray(referrals) ? referrals : [])
    .filter((referral) => hasOftalmoReferralItem(referral));

  if (!rows.length) {
    return "-";
  }

  const values = rows.map((referral) => {
    const rawValue = String((referral && referral[field]) || "").trim();
    if (!rawValue) {
      return "";
    }
    return field === "schedule_date" || field === "execution_date"
      ? formatOftalmoDate(rawValue)
      : rawValue;
  });

  const dateClass = field === "schedule_date" || field === "execution_date" ? " is-date" : "";
  return `
    <div class="oftalmo-list-cell${dateClass}">
      ${values.map((value) => `<span>${value ? SISELO.escapeHtml(value) : "&nbsp;"}</span>`).join("")}
    </div>
  `;
}

function renderOftalmoSummaryLines(items) {
  const rows = (Array.isArray(items) ? items : [])
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `
      <span class="oftalmo-summary-line">
        <strong>${SISELO.escapeHtml(label)}:</strong> ${SISELO.escapeHtml(value)}
      </span>
    `);

  return rows.length ? `<div class="oftalmo-summary-cell">${rows.join("")}</div>` : "-";
}

function renderOftalmoTable() {
  const tbody = document.getElementById("oftalmo-table-body");
  if (!tbody) {
    return;
  }

  const activePatientId = SISELO.normalizeEntityId(oftalmoState.activePatientId);
  const records = oftalmoState.records
    .filter((record) => activePatientId && record.patient_id === activePatientId)
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseOftalmoConsultationOrdinal(right.consultation_number) -
        parseOftalmoConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    const emptyMessage = activePatientId
      ? "Nenhum registro de Oftalmologia encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros de Oftalmologia.";
    tbody.innerHTML = `
      <tr>
        <td colspan="14">
          <div class="oftalmo-empty">
            <p>${SISELO.escapeHtml(emptyMessage)}</p>
          </div>
        </td>
      </tr>
    `;
    bindOftalmoTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatOftalmoDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.right_visual_acuity || "-")}</td>
      <td>${SISELO.escapeHtml(record.left_visual_acuity || "-")}</td>
      <td>${SISELO.escapeHtml(record.biomicroscopy || "-")}</td>
      <td>${SISELO.escapeHtml(record.tonometry || "-")}</td>
      <td>${SISELO.escapeHtml(record.fundoscopy || "-")}</td>
      <td>${renderOftalmoReferralColumn(record.referrals, "specialty")}</td>
      <td>${renderOftalmoReferralColumn(record.referrals, "schedule_date")}</td>
      <td>${renderOftalmoReferralColumn(record.referrals, "execution_date")}</td>
      <td>${SISELO.escapeHtml(record.barriers || "-")}</td>
      <td>${SISELO.escapeHtml(record.recommendations || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver consulta de Oftalmologia", { "data-oftalmo-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-oftalmo-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-oftalmo-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindOftalmoTableActions();
}

function bindOftalmoTableActions() {
  const tbody = document.getElementById("oftalmo-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-oftalmo-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = oftalmoState.records.find((item) => item.id === button.dataset.oftalmoEdit);
      if (record) {
        openOftalmoModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-oftalmo-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = oftalmoState.records.find((item) => item.id === button.dataset.oftalmoView);
      if (record) {
        openOftalmoViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-oftalmo-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function readOftalmoRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFTALMO_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeOftalmoRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeOftalmoRecords(records) {
  try {
    localStorage.setItem(
      OFTALMO_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeOftalmoRecord(record) {
  const id = String((record && record.id) || "").trim();
  if (!id) {
    return null;
  }

  const legacyReferrals = [1, 2]
    .map((index) => normalizeOftalmoReferralItem({
      specialty: record && record[`referral_specialty_${index}`],
      schedule_date: record && record[`referral_schedule_date_${index}`],
      execution_date: record && record[`referral_execution_date_${index}`],
    }))
    .filter((referral) => hasOftalmoReferralItem(referral));
  const storedReferrals = Array.isArray(record && record.referrals)
    ? record.referrals
      .map((referral) => normalizeOftalmoReferralItem(referral))
      .filter((referral) => hasOftalmoReferralItem(referral))
    : [];
  const referrals = (storedReferrals.length ? storedReferrals : legacyReferrals)
    .slice(0, OFTALMO_MAX_REFERRALS);
  const primaryReferral = referrals[0] || {};
  const secondaryReferral = referrals[1] || {};

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
    consultation_number: normalizeOftalmoConsultationLabel(record && record.consultation_number) || OFTALMO_INITIAL_CONSULTATION_LABEL,
    right_visual_acuity: normalizeOftalmoVisualAcuity(record && record.right_visual_acuity),
    left_visual_acuity: normalizeOftalmoVisualAcuity(record && record.left_visual_acuity),
    biomicroscopy: normalizeOftalmoBiomicroscopy(record && record.biomicroscopy),
    tonometry: normalizeOftalmoTonometry(record && record.tonometry),
    fundoscopy: normalizeOftalmoFundoscopy(record && record.fundoscopy),
    referrals,
    referral_specialty_1: primaryReferral.specialty || "",
    referral_schedule_date_1: primaryReferral.schedule_date || "",
    referral_execution_date_1: primaryReferral.execution_date || "",
    referral_specialty_2: secondaryReferral.specialty || "",
    referral_schedule_date_2: secondaryReferral.schedule_date || "",
    referral_execution_date_2: secondaryReferral.execution_date || "",
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeOftalmoEducation(value) {
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

function normalizeOftalmoIncome(value) {
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

function normalizeOftalmoYesNo(value) {
  const normalized = SISELO.normalizeSearchText(value);
  if (normalized === "sim") {
    return "Sim";
  }
  if (normalized === "nao") {
    return "Não";
  }
  return String(value || "").trim();
}

function normalizeOftalmoVisualAcuity(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "nao percebe luz npl": "Não percebe luz (NPL)",
    "conta dedos cd": "Conta dedos (CD)",
    "nao melhora com buraco estenopeico nmph": "Não melhora com buraco estenopeico (NMPH)",
    "20/400 sem correcao": "20/400- Sem correção",
    "20/400 com correcao": "20/400- Com correção",
    "20/200 sem correcao": "20/200- Sem correção",
    "20/200 com correcao": "20/200- Com correção",
    "20/100 sem correcao": "20/100- Sem correção",
    "20/100 com correcao": "20/100- Com  correção",
    "20/80 sem correcao": "20/80-  Sem correção",
    "20/80 com correcao": "20/80-  Com correção",
    "20/60 sem correcao": "20/60- Sem correção",
    "20/60 com correcao": "20/60- Com correção",
    "20/40 sem correcao": "20/40- Sem correção",
    "20/40 com correcao": "20/40- Com correção",
    "20/30 sem correcao": "20/30- Sem correção",
    "20/30 com correcao": "20/30- Com correção",
    "20/25 sem correcao": "20/25- Sem correção",
    "20/25 com correcao": "20/25- Com correção",
    "20/20 sem correcao": "20/20- Sem correção",
    "20/20 com correcao": "20/20- Com correção",
  };

  return legacyValues[normalized] || original;
}

function normalizeOftalmoBiomicroscopy(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    normal: "Normal",
    "afacia od": "Afacia OD",
    "afacia oe": "Afacia OE",
    "afacia ao": "Afacia AO",
    "catarata od": "Catarata OD",
    "catarata oe": "Catarata OE",
    "catarata ao": "Catarata AO",
    infeccoes: "Infecções",
    pterigio: "Pterigio",
    "alteracoes na cornea": "Alterações na córnea",
    outros: "Outros",
  };

  return legacyValues[normalized] || original;
}

function normalizeOftalmoTonometry(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    normal: "Normal",
    alterado: "Alterado",
    inviavel: "Inviável",
  };

  return legacyValues[normalized] || original;
}

function normalizeOftalmoFundoscopy(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    normal: "Normal",
    "retinopatia diabetica": "Retinopatia diabética",
    "retinopatia hipertensiva": "Retinopatia hipertensiva",
    "degeneracao macular relacionada com a idade": "Degeneração macular relacionada com a idade",
    miopia: "Miopia",
    "placas de toxoplasmose": "Placas de toxoplasmose",
    "aplicacoes de laser": "Aplicações de laser",
    "sugestivo de glaucoma": "Sugestivo de glaucoma",
    outros: "Outros",
    inviavel: "Inviavél",
  };

  return legacyValues[normalized] || original;
}

function normalizeOftalmoReferralSpecialty(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    retina: "Retina",
    glaucoma: "Glaucoma",
    catarata: "Catarata",
    "plastica ocular": "Plástica ocular",
    cornea: "Córnea",
    pterigio: "Pterígio",
    outros: "Outros",
  };

  return legacyValues[normalized] || original;
}

function createOftalmoRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `oftalmo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatOftalmoDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatOftalmoRace(value) {
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
