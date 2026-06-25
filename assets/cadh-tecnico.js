const TECNICO_STORAGE_KEY = "siselo_cadh_tecnico_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const INITIAL_CONSULTATION_LABEL = "1\u00AA Consulta (inicial)";

// ─── Limites clínicos ────────────────────────────────────────────────────────
const LIMITES = {
  peso:   { bloqMin: 0.3,  alertMin: 2.5,  alertMax: 250,  bloqMax: 650  },
  altura: { bloqMin: 0.25, alertMin: 0.45, alertMax: null, bloqMax: 3    },
  imc:    { bloqMin: 5,    alertMin: 15,   alertMax: 50,   bloqMax: 120  }, // alertMin = adulto; crianças: 11
  ca:     { bloqMin: 20,   alertMin: 50,   alertMax: 160,  bloqMax: 250  },
  cp:     { bloqMin: 10,   alertMin: 20,   alertMax: 60,   bloqMax: 100  },
};

const tecnicoState = {
  records: [],
  patients: [],
  patientPicker: null,
  activePatientId: "",
  lastFocus: null,
  editingRecordId: "",
  lastTypingAlertAt: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-tecnico") return;
  setupTecnicoPage();
});

async function setupTecnicoPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  tecnicoState.activePatientId = getTecnicoContextPatientId();
  tecnicoState.records = readTecnicoRecords();

  bindTecnicoModal();
  bindTecnicoViewModal();
  SISELO.bindFieldGuidanceTooltips();

  SISELO.enhanceDateInput("tecnico_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });
  SISELO.enhanceDateInput("tecnico_next_consult_date", {
    min: SISELO.todayDateInputValue(),
  });

  bindTecnicoNumericFields();
  updateTecnicoConsultationOptions("");

  tecnicoState.patients = await loadTecnicoPatients();
  tecnicoState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "tecnico_patient_id",
    container: "tecnico_patient_search",
    rows: tecnicoState.patients,
    currentValue: tecnicoState.activePatientId,
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      if (tecnicoState.activePatientId) {
        const scopedPatient = getActiveTecnicoPatient();
        const pickedId = SISELO.normalizeEntityId(patient && patient.id);
        if (tecnicoState.patientPicker && scopedPatient && pickedId !== tecnicoState.activePatientId) {
          tecnicoState.patientPicker.setValue(scopedPatient);
        }
        updateTecnicoConsultationOptions(tecnicoState.activePatientId, tecnicoState.editingRecordId);
        updateTecnicoPatientSummary(scopedPatient);
        updateTecnicoAgeGuidance(scopedPatient);
        return;
      }
      const selectedPatient = patient && patient.id
        ? findTecnicoPatientById(patient.id) || patient
        : null;
      updateTecnicoConsultationOptions(patient && patient.id, tecnicoState.editingRecordId);
      updateTecnicoPatientSummary(selectedPatient);
      updateTecnicoAgeGuidance(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#tecnico_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "tecnico_patient_search_input";
  }

  applyTecnicoPatientScope();
  updateTecnicoScopeControls();
  renderTecnicoTable();
}

// ─── Patient helpers ─────────────────────────────────────────────────────────
async function loadTecnicoPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];
  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (_) {}
  return mergeTecnicoPatients(rows);
}

function readCadhSearchState() {
  try { return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null"); } catch (_) { return null; }
}

function getTecnicoContextPatientId() {
  const queryId = SISELO.normalizeEntityId(new URLSearchParams(window.location.search).get("patient_id"));
  if (queryId) return queryId;
  const cached = readCadhSearchState();
  return SISELO.normalizeEntityId(cached && cached.patient && cached.patient.id);
}

function getActiveTecnicoPatient() {
  const patientId = SISELO.normalizeEntityId(tecnicoState.activePatientId);
  if (!patientId) return null;
  const patient = findTecnicoPatientById(patientId);
  if (patient) return patient;
  const cached = readCadhSearchState();
  const cachedPatient = cached && cached.patient ? normalizeTecnicoPatient(cached.patient) : null;
  return cachedPatient && cachedPatient.id === patientId ? cachedPatient : null;
}

function applyTecnicoPatientScope() {
  const scopedPatient = getActiveTecnicoPatient();
  if (!scopedPatient || !tecnicoState.patientPicker) return;
  tecnicoState.patientPicker.setValue(scopedPatient);
  updateTecnicoConsultationOptions(scopedPatient.id, tecnicoState.editingRecordId);
  updateTecnicoPatientSummary(scopedPatient);
  updateTecnicoAgeGuidance(scopedPatient);
  const input = document.querySelector("#tecnico_patient_search input");
  if (input instanceof HTMLInputElement) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.title = "Paciente definido pela busca do CADH";
  }
}

function updateTecnicoScopeControls() {
  const hasActivePatient = Boolean(SISELO.normalizeEntityId(tecnicoState.activePatientId));
  const newButton = document.getElementById("tecnico-new");
  if (newButton instanceof HTMLButtonElement) {
    newButton.disabled = !hasActivePatient;
    newButton.title = hasActivePatient ? "" : "Selecione um usuário no CADH para liberar o módulo.";
  }
}

function mergeTecnicoPatients(rows) {
  const merged = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeTecnicoPatient(row);
    if (!patient.id) return;
    merged.set(patient.id, { ...(merged.get(patient.id) || {}), ...patient });
  });
  return Array.from(merged.values());
}

function normalizeTecnicoPatient(patient) {
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

function findTecnicoPatientById(patientId) {
  const id = SISELO.normalizeEntityId(patientId);
  return tecnicoState.patients.find((p) => p.id === id) || null;
}

function resolveTecnicoPatient(patientId) {
  const id = SISELO.normalizeEntityId(patientId);
  const patient = findTecnicoPatientById(id);
  if (patient) return patient;
  const cached = readCadhSearchState();
  const cachedPatient = cached && cached.patient ? normalizeTecnicoPatient(cached.patient) : null;
  if (cachedPatient && cachedPatient.id === id) {
    tecnicoState.patients = mergeTecnicoPatients(tecnicoState.patients.concat([cachedPatient]));
    return cachedPatient;
  }
  return { id, full_name: "", cpf: "", team_ref: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function bindTecnicoModal() {
  const modal = document.getElementById("tecnico-modal");
  const form = document.getElementById("tecnico-form");
  const newButton = document.getElementById("tecnico-new");
  if (!modal || !form || !newButton) return;

  newButton.addEventListener("click", () => openTecnicoModal());

  modal.querySelectorAll("[data-tecnico-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeTecnicoModal())
  );

  modal.addEventListener("click", (e) => { if (e.target === modal) closeTecnicoModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeTecnicoModal(); });

  form.addEventListener("submit", (e) => { e.preventDefault(); saveTecnicoRecord(); });
}

function bindTecnicoViewModal() {
  const modal = document.getElementById("tecnico-view-modal");
  if (!modal) return;
  modal.querySelectorAll("[data-tecnico-view-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeTecnicoViewModal())
  );
  modal.addEventListener("click", (e) => { if (e.target === modal) closeTecnicoViewModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeTecnicoViewModal(); });
}

function openTecnicoModal(record = null) {
  const modal = document.getElementById("tecnico-modal");
  const form = document.getElementById("tecnico-form");
  if (!modal || !form) return;

  if (!record && !SISELO.normalizeEntityId(tecnicoState.activePatientId)) {
    SISELO.showAlert("tecnico-alert", "Selecione um usuário no CADH antes de criar um registro.", "error");
    return;
  }

  tecnicoState.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  form.reset();
  SISELO.showAlert("tecnico-alert", "", "info");
  fillTecnicoForm(record);
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#tecnico_patient_search input");
  if (firstInput instanceof HTMLElement) firstInput.focus();
}

function closeTecnicoModal() {
  const modal = document.getElementById("tecnico-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (tecnicoState.lastFocus instanceof HTMLElement) tecnicoState.lastFocus.focus();
}

function openTecnicoViewModal(record) {
  const modal = document.getElementById("tecnico-view-modal");
  const content = document.getElementById("tecnico-view-content");
  if (!modal || !content) return;
  tecnicoState.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  content.innerHTML = renderTecnicoViewRecord(normalizeTecnicoRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");
  const closeButton = modal.querySelector("[data-tecnico-view-close]");
  if (closeButton instanceof HTMLElement) closeButton.focus();
}

function closeTecnicoViewModal() {
  const modal = document.getElementById("tecnico-view-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (tecnicoState.lastFocus instanceof HTMLElement) tecnicoState.lastFocus.focus();
}

// ─── Form fill ────────────────────────────────────────────────────────────────
function fillTecnicoForm(record = null) {
  const normalizedRecord = record ? normalizeTecnicoRecord(record) : null;
  tecnicoState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? normalizeTecnicoPatient(cachedState.patient) : null;
  const scopedPatient = getActiveTecnicoPatient();
  const recordPatient = normalizedRecord
    ? normalizeTecnicoPatient({
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
    ? findTecnicoPatientById(normalizedRecord.patient_id) || recordPatient
    : scopedPatient || cachedPatient;

  setTecnicoField("tecnico_record_id", normalizedRecord ? normalizedRecord.id : "");
  setTecnicoField("tecnico_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setTecnicoField("tecnico_peso", normalizedRecord ? normalizedRecord.peso : "");
  setTecnicoField("tecnico_altura", normalizedRecord ? normalizedRecord.altura : "");
  setTecnicoField("tecnico_circ_abdominal", normalizedRecord ? normalizedRecord.circ_abdominal : "");
  setTecnicoField("tecnico_circ_panturrilha", normalizedRecord ? normalizedRecord.circ_panturrilha : "");
  setTecnicoField("tecnico_internacao", normalizedRecord ? normalizedRecord.internacao : "");
  setTecnicoField("tecnico_next_consult_date", normalizedRecord ? normalizedRecord.next_consult_date : "");

  recalcIMC();

  if (tecnicoState.patientPicker) {
    tecnicoState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }
  updateTecnicoPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateTecnicoAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateTecnicoConsultationOptions(
    selectedPatient && selectedPatient.id ? selectedPatient.id : "",
    tecnicoState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  ["tecnico_consultation_date", "tecnico_next_consult_date"].forEach((id) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) SISELO.syncEnhancedDateInput(el);
  });
}

function setTecnicoField(id, value) {
  const field = document.getElementById(id);
  if (field) field.value = value || "";
}

// ─── Numeric field binding & validation ──────────────────────────────────────
function bindTecnicoNumericFields() {
  const fields = [
    { id: "tecnico_peso",          limites: LIMITES.peso,   label: "Peso",                     unit: "kg"  },
    { id: "tecnico_altura",        limites: LIMITES.altura, label: "Altura",                   unit: "m"   },
    { id: "tecnico_circ_abdominal",limites: LIMITES.ca,     label: "Circunferência abdominal", unit: "cm"  },
    { id: "tecnico_circ_panturrilha",limites: LIMITES.cp,   label: "Circunferência da panturrilha", unit: "cm" },
  ];

  fields.forEach(({ id, limites, label, unit }) => {
    const input = document.getElementById(id);
    if (!(input instanceof HTMLInputElement)) return;

    input.addEventListener("beforeinput", (e) => {
      if (!e.data) return;
      if (!/^[0-9,.]$/.test(e.data)) { e.preventDefault(); showTecnicoAlert(`${label}: use apenas números e vírgula.`); return; }
      const next = `${input.value.slice(0, input.selectionStart || 0)}${e.data}${input.value.slice(input.selectionEnd || 0)}`;
      if (!isTecnicoNumericDraftValid(next)) { e.preventDefault(); showTecnicoAlert(`${label}: formato inválido.`); }
    });

    input.addEventListener("input", () => {
      const sanitized = sanitizeTecnicoDecimal(input.value);
      if (sanitized !== input.value) { input.value = sanitized; showTecnicoAlert(`${label}: use apenas números e vírgula.`); }
      const val = parseTecnicoNum(input.value);
      if (Number.isFinite(val)) checkTecnicoRange(val, limites, label, unit);
      recalcIMC();
    });

    input.addEventListener("blur", () => {
      input.value = finalizeTecnicoDecimal(input.value);
      const val = parseTecnicoNum(input.value);
      if (Number.isFinite(val)) checkTecnicoRange(val, limites, label, unit);
      recalcIMC();
    });
  });
}

function recalcIMC() {
  const pesoInput  = document.getElementById("tecnico_peso");
  const alturaInput = document.getElementById("tecnico_altura");
  const imcHidden  = document.getElementById("tecnico_imc");
  const imcDisplay = document.getElementById("tecnico_imc_display");
  if (!pesoInput || !alturaInput || !imcHidden || !imcDisplay) return;

  const peso   = parseTecnicoNum(pesoInput.value);
  const altura = parseTecnicoNum(alturaInput.value);

  if (!Number.isFinite(peso) || !Number.isFinite(altura) || altura <= 0) {
    imcDisplay.textContent = "—";
    imcDisplay.removeAttribute("data-status");
    imcHidden.value = "";
    return;
  }

  const imc = peso / (altura * altura);
  const imcStr = imc.toFixed(1).replace(".", ",");
  imcDisplay.textContent = `${imcStr} kg/m²`;
  imcHidden.value = imcStr;

  // determina status visual
  const { bloqMin, alertMin, alertMax, bloqMax } = LIMITES.imc;
  if (imc < bloqMin || imc > bloqMax) {
    imcDisplay.setAttribute("data-status", "critico");
  } else if ((alertMax && imc > alertMax) || imc < alertMin) {
    imcDisplay.setAttribute("data-status", "alerta");
  } else {
    imcDisplay.removeAttribute("data-status");
  }

  // alerta textual se necessário
  if (imc < bloqMin || imc > bloqMax) {
    showTecnicoAlert(`IMC ${imcStr}: valor fora dos limites possíveis. Verifique peso e altura.`);
  } else if (alertMax && imc > alertMax) {
    showTecnicoAlert(`IMC ${imcStr}: acima de 50 (superobesidade). Por favor, confirme o peso e a altura.`);
  } else if (imc < alertMin) {
    showTecnicoAlert(`IMC ${imcStr}: abaixo de 15. Indica desnutrição grave. Verifique os dados.`);
  }
}

function checkTecnicoRange(val, limites, label, unit) {
  const { bloqMin, alertMin, alertMax, bloqMax } = limites;
  if (val < bloqMin) { showTecnicoAlert(`${label}: valor ${val} ${unit} abaixo do mínimo permitido (${bloqMin} ${unit}).`); return; }
  if (val > bloqMax) { showTecnicoAlert(`${label}: valor ${val} ${unit} acima do máximo permitido (${bloqMax} ${unit}).`); return; }
  if (val < alertMin) { showTecnicoAlert(`${label}: valor ${val} ${unit} muito baixo (alerta clínico). Verifique se está correto.`); return; }
  if (alertMax && val > alertMax) { showTecnicoAlert(`${label}: valor ${val} ${unit} muito alto (alerta clínico). Por favor, confirme.`); }
}

function showTecnicoAlert(message) {
  const now = Date.now();
  if (now - tecnicoState.lastTypingAlertAt < 1600) return;
  tecnicoState.lastTypingAlertAt = now;
  SISELO.showAlert("tecnico-alert", message, "error");
}

// ─── Decimal helpers ──────────────────────────────────────────────────────────
function sanitizeTecnicoDecimal(value) {
  const normalized = String(value || "").replace(/\./g, ",");
  let result = ""; let hasSep = false;
  for (const c of normalized) {
    if (/\d/.test(c)) { result += c; continue; }
    if (c === "," && !hasSep) { result += c; hasSep = true; }
  }
  const parts = result.split(",");
  const intPart = (parts[0] || "").slice(0, 5);
  const decPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : "";
  return hasSep ? `${intPart},${decPart}` : intPart;
}

function finalizeTecnicoDecimal(value) {
  return sanitizeTecnicoDecimal(value).replace(/,$/, "");
}

function isTecnicoNumericDraftValid(value) {
  return sanitizeTecnicoDecimal(value) === String(value || "").replace(/\./g, ",").replace(/\s/g, "");
}

function parseTecnicoNum(value) {
  const clean = finalizeTecnicoDecimal(String(value || ""));
  if (!clean) return NaN;
  const n = Number(clean.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formatTecnicoNum(value, unit) {
  const clean = finalizeTecnicoDecimal(String(value || ""));
  return clean ? `${clean} ${unit}` : "";
}

// ─── Consultation options ────────────────────────────────────────────────────
function updateTecnicoConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("tecnico_consultation_number");
  if (!(select instanceof HTMLSelectElement)) return;

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeConsultationLabel(preferredValue);

  const patientRecords = tecnicoState.records.filter(
    (r) => r.patient_id === normalizedPatientId && r.id !== normalizedCurrentId
  );
  const hasInitial = patientRecords.some((r) => isInitialConsultation(r.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, r) => Math.max(max, parseConsultationOrdinal(r.consultation_number)), 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1 ? formatConsultationLabel(preferredOrdinal) : formatConsultationLabel(nextOrdinal);

  const options = [
    { value: INITIAL_CONSULTATION_LABEL, label: INITIAL_CONSULTATION_LABEL, disabled: Boolean(normalizedPatientId && hasInitial && !isEditingInitial) },
  ];

  if (normalizedPatientId && (hasInitial || preferredOrdinal > 1)) {
    options.push({ value: subsequentLabel, label: subsequentLabel, disabled: false });
  }

  select.innerHTML = options.map((o) => `<option value="${SISELO.escapeHtml(o.value)}" ${o.disabled ? "disabled" : ""}>${SISELO.escapeHtml(o.label)}</option>`).join("");

  if (normalizedPreferred && options.some((o) => o.value === normalizedPreferred && !o.disabled)) {
    select.value = normalizedPreferred;
  } else {
    const first = options.find((o) => !o.disabled);
    select.value = first ? first.value : INITIAL_CONSULTATION_LABEL;
  }
}

function isInitialConsultation(value) {
  return parseConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseConsultationOrdinal(value) {
  const m = String(value || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function formatConsultationLabel(ordinal) {
  const n = Math.max(1, Number(ordinal) || 1);
  return n === 1 ? INITIAL_CONSULTATION_LABEL : `${n}ª Consulta`;
}

function normalizeConsultationLabel(value) {
  const normalized = String(value || "").replace(/Âª/g, "ª").trim();
  const ordinal = parseConsultationOrdinal(normalized);
  return ordinal ? formatConsultationLabel(ordinal) : "";
}

function hasDuplicateInitialConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialConsultation(consultationNumber)) return false;
  const pid = SISELO.normalizeEntityId(patientId);
  const cid = String(currentRecordId || "").trim();
  return tecnicoState.records.some(
    (r) => r.patient_id === pid && r.id !== cid && isInitialConsultation(r.consultation_number)
  );
}

// ─── Patient summary + age guidance ──────────────────────────────────────────
function updateTecnicoPatientSummary(patient) {
  const el = document.getElementById("tecnico-patient-summary");
  if (!el) return;
  if (!patient || !patient.id) { el.hidden = true; el.innerHTML = ""; return; }
  const full = findTecnicoPatientById(patient.id) || normalizeTecnicoPatient(patient);
  const ageLabel = full.age_label || "-";
  el.innerHTML = [
    renderSummaryItem("CPF", full.cpf || "-"),
    renderSummaryItem("Equipe", SISELO.formatTeamName(full.team_ref)),
    renderSummaryItem("Cor/Raça", formatTecnicoRace(full.race)),
    renderSummaryItem("Idade", ageLabel),
    renderSummaryItem("Nascimento", formatTecnicoDate(full.birth_date)),
    renderSummaryItem("1º atendimento CADH", formatTecnicoDate(full.first_cadh_date)),
  ].join("");
  el.hidden = false;
}

function renderSummaryItem(label, value) {
  return `<span>${SISELO.escapeHtml(label)}<strong>${SISELO.escapeHtml(value || "-")}</strong></span>`;
}

function updateTecnicoAgeGuidance(patient) {
  const el = document.getElementById("tecnico-age-guidance");
  if (!el) return;
  if (!patient || !patient.id) { el.hidden = true; el.textContent = ""; return; }
  const full = findTecnicoPatientById(patient.id) || normalizeTecnicoPatient(patient);
  const ageYears = getTecnicoAgeYears(full);
  const ageLabel = full.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");

  // mostrar/esconder campo panturrilha conforme idade
  const panturrilhaField = document.getElementById("tecnico-panturrilha-field");
  if (panturrilhaField) {
    panturrilhaField.hidden = Number.isFinite(ageYears) && ageYears < 60;
  }

  el.textContent = ageLabel
    ? `Idade: ${ageLabel}. Considere fragilidade e polifarmácia em idosos; avalie crescimento em crianças.`
    : "Idade não informada. Registre peso, altura e circunferências com atenção clínica.";
  el.hidden = false;
}

function getTecnicoAgeYears(patient) {
  const fromLabel = String((patient && patient.age_label) || "").match(/\d+/);
  if (fromLabel) return Number(fromLabel[0]);
  const birthDate = SISELO.parseDateInputValue(patient && patient.birth_date);
  if (!birthDate) return NaN;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function saveTecnicoRecord() {
  const form = document.getElementById("tecnico-form");
  if (!form) return;

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "tecnico-alert" })) return;

  const patientId = tecnicoState.activePatientId || (tecnicoState.patientPicker ? tecnicoState.patientPicker.getValue() : "");
  if (!patientId) {
    SISELO.showAlert("tecnico-alert", "Selecione o paciente.", "error");
    if (tecnicoState.patientPicker) tecnicoState.patientPicker.focus();
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());

  // validar campos obrigatórios
  const missing = [];
  if (!String(payload.consultation_date || "").trim()) missing.push("Data da consulta");
  if (!String(payload.peso || "").trim()) missing.push("Peso");
  if (!String(payload.altura || "").trim()) missing.push("Altura");
  if (!String(payload.circ_abdominal || "").trim()) missing.push("Circunferência abdominal");
  if (!String(payload.internacao || "").trim()) missing.push("Internação por complicação");

  if (missing.length) {
    SISELO.showAlert("tecnico-alert", `Preencha: ${missing.join(", ")}.`, "error");
    return;
  }

  // validar limites dos campos numéricos
  const pesoVal = parseTecnicoNum(payload.peso);
  if (!Number.isFinite(pesoVal) || pesoVal < LIMITES.peso.bloqMin || pesoVal > LIMITES.peso.bloqMax) {
    SISELO.showAlert("tecnico-alert", `Peso inválido. Informe um valor entre ${LIMITES.peso.bloqMin} e ${LIMITES.peso.bloqMax} kg.`, "error");
    document.getElementById("tecnico_peso")?.focus();
    return;
  }
  const alturaVal = parseTecnicoNum(payload.altura);
  if (!Number.isFinite(alturaVal) || alturaVal < LIMITES.altura.bloqMin || alturaVal > LIMITES.altura.bloqMax) {
    SISELO.showAlert("tecnico-alert", `Altura inválida. Informe um valor entre ${LIMITES.altura.bloqMin} e ${LIMITES.altura.bloqMax} m.`, "error");
    document.getElementById("tecnico_altura")?.focus();
    return;
  }
  const caVal = parseTecnicoNum(payload.circ_abdominal);
  if (!Number.isFinite(caVal) || caVal < LIMITES.ca.bloqMin || caVal > LIMITES.ca.bloqMax) {
    SISELO.showAlert("tecnico-alert", `Circunferência abdominal inválida (${LIMITES.ca.bloqMin}–${LIMITES.ca.bloqMax} cm).`, "error");
    document.getElementById("tecnico_circ_abdominal")?.focus();
    return;
  }
  const cpVal = parseTecnicoNum(payload.circ_panturrilha);
  if (payload.circ_panturrilha && Number.isFinite(cpVal) && (cpVal < LIMITES.cp.bloqMin || cpVal > LIMITES.cp.bloqMax)) {
    SISELO.showAlert("tecnico-alert", `Circunferência da panturrilha inválida (${LIMITES.cp.bloqMin}–${LIMITES.cp.bloqMax} cm).`, "error");
    document.getElementById("tecnico_circ_panturrilha")?.focus();
    return;
  }

  if (hasDuplicateInitialConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("tecnico-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateTecnicoConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveTecnicoPatient(patientId);
  const imc = payload.imc || "";

  const record = normalizeTecnicoRecord({
    id: payload.record_id || createTecnicoRecordId(),
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
    peso: finalizeTecnicoDecimal(payload.peso),
    altura: finalizeTecnicoDecimal(payload.altura),
    imc,
    circ_abdominal: finalizeTecnicoDecimal(payload.circ_abdominal),
    circ_panturrilha: finalizeTecnicoDecimal(payload.circ_panturrilha || ""),
    internacao: payload.internacao,
    next_consult_date: payload.next_consult_date || "",
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("tecnico-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const idx = tecnicoState.records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    tecnicoState.records[idx] = record;
  } else {
    tecnicoState.records.unshift(record);
  }

  writeTecnicoRecords(tecnicoState.records);
  renderTecnicoTable();
  closeTecnicoModal();
}

// ─── Table ────────────────────────────────────────────────────────────────────
function renderTecnicoTable() {
  const tbody = document.getElementById("tecnico-table-body");
  if (!tbody) return;

  const activeId = SISELO.normalizeEntityId(tecnicoState.activePatientId);
  const records = tecnicoState.records
    .filter((r) => activeId && r.patient_id === activeId)
    .sort((a, b) => {
      const ordDiff = parseConsultationOrdinal(b.consultation_number) - parseConsultationOrdinal(a.consultation_number);
      if (ordDiff !== 0) return ordDiff;
      return String(b.consultation_date || "").localeCompare(String(a.consultation_date || ""));
    });

  if (!records.length) {
    const msg = activeId
      ? "Nenhum registro encontrado para este paciente."
      : "Selecione um usuário no CADH para visualizar os registros.";
    tbody.innerHTML = `<tr><td colspan="4"><div class="tecnico-empty"><p>${SISELO.escapeHtml(msg)}</p></div></td></tr>`;
    bindTecnicoTableActions();
    return;
  }

  tbody.innerHTML = records.map((r) => `
    <tr>
      <td>${SISELO.escapeHtml(formatTecnicoDate(r.consultation_date))}</td>
      <td>${SISELO.escapeHtml(r.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(r.consultation_number || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver guia clínica", { "data-tecnico-view": r.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-tecnico-pdf": r.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-tecnico-edit": r.id })}
          ${SISELO.iconButton("delete", "Remover registro", { "data-tecnico-delete": r.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindTecnicoTableActions();
}

function bindTecnicoTableActions() {
  const tbody = document.getElementById("tecnico-table-body");
  if (!tbody) return;

  tbody.querySelectorAll("[data-tecnico-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = tecnicoState.records.find((x) => x.id === btn.dataset.tecnicoEdit);
      if (r) openTecnicoModal(r);
    });
  });

  tbody.querySelectorAll("[data-tecnico-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = tecnicoState.records.find((x) => x.id === btn.dataset.tecnicoView);
      if (r) openTecnicoViewModal(r);
    });
  });

  tbody.querySelectorAll("[data-tecnico-pdf]").forEach((btn) => {
    btn.addEventListener("click", () => SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve."));
  });

  tbody.querySelectorAll("[data-tecnico-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const record = tecnicoState.records.find((item) => item.id === btn.dataset.tecnicoDelete);
      if (!record || !(await SISELO.confirmPermanentDeletion("o registro de Técnico de Enfermagem", record.consultation_number))) {
        return;
      }

      tecnicoState.records = tecnicoState.records.filter((item) => item.id !== record.id);
      writeTecnicoRecords(tecnicoState.records);
      renderTecnicoTable();
    });
  });
}

// ─── View modal render ────────────────────────────────────────────────────────
function renderTecnicoViewRecord(record) {
  const r = record || {};
  return `
    ${renderViewSection("Identificação", [
      ["Paciente", r.full_name || "-"],
      ["CPF", r.cpf || "-"],
      ["Equipe", SISELO.formatTeamName(r.team_ref)],
      ["Cor/Raça", formatTecnicoRace(r.race)],
      ["Data de nascimento", formatTecnicoDate(r.birth_date)],
      ["Idade", r.age_label || "-"],
      ["Primeiro atendimento CADH", formatTecnicoDate(r.first_cadh_date)],
    ])}
    ${renderViewSection("Consulta", [
      ["Data da consulta", formatTecnicoDate(r.consultation_date)],
      ["Nº da consulta", r.consultation_number || "-"],
    ])}
    ${renderViewSection("Dados antropométricos", [
      ["Peso", r.peso ? `${r.peso} kg` : "-"],
      ["Altura", r.altura ? `${r.altura} m` : "-"],
      ["IMC", r.imc ? `${r.imc} kg/m²` : "-"],
      ["Circunferência abdominal", r.circ_abdominal ? `${r.circ_abdominal} cm` : "-"],
      ["Circunferência da panturrilha", r.circ_panturrilha ? `${r.circ_panturrilha} cm` : "-"],
      ["Internação por complicação (último ano)", r.internacao || "-"],
      ["Data da consulta subsequente", formatTecnicoDate(r.next_consult_date)],
    ])}
  `;
}

function renderViewSection(title, items) {
  return `
    <section class="tecnico-view-section">
      <h3 class="tecnico-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="tecnico-view-grid">
        ${items.map(([label, value, wide]) => renderViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderViewItem(label, value, wide = false) {
  return `
    <div class="tecnico-view-item${wide ? " is-wide" : ""}">
      <span class="tecnico-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="tecnico-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
function readTecnicoRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TECNICO_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((r) => normalizeTecnicoRecord(r))
      .filter(Boolean);
  } catch (_) { return []; }
}

function writeTecnicoRecords(records) {
  try {
    localStorage.setItem(TECNICO_STORAGE_KEY, JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)));
  } catch (_) {}
}

function normalizeTecnicoRecord(record) {
  const id = String((record && record.id) || "").trim();
  if (!id) return null;
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
    consultation_number: normalizeConsultationLabel(record && record.consultation_number) || INITIAL_CONSULTATION_LABEL,
    peso: String((record && record.peso) || "").trim(),
    altura: String((record && record.altura) || "").trim(),
    imc: String((record && record.imc) || "").trim(),
    circ_abdominal: String((record && record.circ_abdominal) || "").trim(),
    circ_panturrilha: String((record && record.circ_panturrilha) || "").trim(),
    internacao: normalizeYesNo(record && record.internacao),
    next_consult_date: String((record && record.next_consult_date) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeYesNo(value) {
  const n = SISELO.normalizeSearchText(value);
  if (n === "sim") return "Sim";
  if (n === "nao") return "Não";
  return "";
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function createTecnicoRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `tecnico-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTecnicoDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatTecnicoRace(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const n = SISELO.normalizeSearchText(raw);
  const map = { branca: "Branca", branco: "Branca", preta: "Preta", preto: "Preta", parda: "Parda", pardo: "Parda", amarela: "Amarela", amarelo: "Amarela", indigena: "Indígena" };
  return map[n] || raw;
}
