const ENDOCRINO_STORAGE_KEY = "siselo_cadh_endocrino_records";
const CADH_SEARCH_KEY = "siselo_cadh_search";
const INITIAL_CONSULTATION_LABEL = "1\u00AA Consulta (inicial)";
const ENDOCRINO_NUMERIC_HINT = "Informe somente o número do laudo, sem texto ou unidade.";
const ENDOCRINO_TARGET_HINT = "Na meta, use 0 até 20. Pode preencher 7, <7 ou <7,5.";
const ENDOCRINO_FRAGILITY_GUIDANCE = {
  "Bebê (0 a 23 meses)": "Registro clínico: bebê. Meta e conduta individualizadas; confirmar acompanhamento pediátrico, responsável presente e sinais de alerta.",
  "Criança (2 a 9 anos)": "Registro clínico: criança. Avaliar crescimento, alimentação, adesão familiar, risco de hipoglicemia e necessidade de acompanhamento pediátrico.",
  "Adolescente (10 a 19 anos)": "Registro clínico: adolescente. Avaliar adesão, autonomia, apoio familiar/escolar, risco de hipoglicemia e preparo para autocuidado.",
  "Adulto (20 a 59 anos)": "Registro clínico: adulto. Avaliar controle glicêmico, adesão, comorbidades, risco cardiovascular e risco de hipoglicemia.",
  "Pessoa idosa (60 anos ou mais)": "Registro clínico: pessoa idosa. Avaliar funcionalidade, cognição, quedas, polifarmácia, comorbidades e risco de hipoglicemia.",
  "Pessoa idosa frágil ou em fragilização": "Registro clínico: pessoa idosa frágil ou em fragilização. Priorizar segurança, evitar hipoglicemia e simplificar o plano quando possível.",
  Gestante: "Registro clínico: gestante. Considerar pré-natal de alto risco, controle glicêmico, risco de hipoglicemia e segurança materno-fetal.",
  "Não se aplica": "Registro clínico: sem marcador específico de fragilidade nesta consulta.",
};

const endocrinoState = {
  records: [],
  patients: [],
  patientPicker: null,
  lastFocus: null,
  editingRecordId: "",
  lastTypingAlertAt: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "cadh-endocrino") {
    return;
  }

  setupEndocrinoPage();
});

async function setupEndocrinoPage() {
  const user = await SISELO.requireSession();
  if (!user) return;

  SISELO.bindShell("cadh");

  endocrinoState.records = readEndocrinoRecords();
  renderEndocrinoTable();
  bindEndocrinoModal();
  bindEndocrinoViewModal();

  SISELO.enhanceDateInput("endocrino_consultation_date", {
    min: "1900-01-01",
    max: SISELO.todayDateInputValue(),
  });
  bindEndocrinoNumericFields();
  bindEndocrinoFragilityField();
  bindEndocrinoFloatingGuidance();
  updateEndocrinoConsultationOptions("");

  endocrinoState.patients = await loadEndocrinoPatients();
  endocrinoState.patientPicker = SISELO.setupPatientFieldPicker({
    select: "endocrino_patient_id",
    container: "endocrino_patient_search",
    rows: endocrinoState.patients,
    currentValue: "",
    placeholder: "Selecione o paciente...",
    onChange: (patient) => {
      const selectedPatient = patient && patient.id
        ? findEndocrinoPatientById(patient.id) || patient
        : null;
      updateEndocrinoConsultationOptions(patient && patient.id, endocrinoState.editingRecordId);
      updateEndocrinoPatientSummary(selectedPatient);
      updateEndocrinoAgeGuidance(selectedPatient);
      suggestEndocrinoFragilityFromPatient(selectedPatient);
    },
  });

  const patientSearchInput = document.querySelector("#endocrino_patient_search input");
  if (patientSearchInput instanceof HTMLInputElement) {
    patientSearchInput.id = "endocrino_patient_search_input";
  }
}

function bindEndocrinoModal() {
  const modal = document.getElementById("endocrino-modal");
  const form = document.getElementById("endocrino-form");
  const newButton = document.getElementById("endocrino-new");

  if (!modal || !form || !newButton) {
    return;
  }

  newButton.addEventListener("click", () => {
    openEndocrinoModal();
  });

  modal.querySelectorAll("[data-endocrino-close]").forEach((button) => {
    button.addEventListener("click", () => closeEndocrinoModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEndocrinoModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeEndocrinoModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEndocrinoRecord();
  });
}

function bindEndocrinoViewModal() {
  const modal = document.getElementById("endocrino-view-modal");
  if (!modal) {
    return;
  }

  modal.querySelectorAll("[data-endocrino-view-close]").forEach((button) => {
    button.addEventListener("click", () => closeEndocrinoViewModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEndocrinoViewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeEndocrinoViewModal();
    }
  });
}

async function loadEndocrinoPatients() {
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient ? cachedState.patient : null;
  let rows = cachedPatient ? [cachedPatient] : [];

  try {
    const data = await SISELO.apiRequest("/patients/list.php");
    rows = rows.concat(Array.isArray(data.rows) ? data.rows : []);
  } catch (error) {
  }

  return mergeEndocrinoPatients(rows);
}

function readCadhSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(CADH_SEARCH_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function mergeEndocrinoPatients(rows) {
  const merged = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const patient = normalizeEndocrinoPatient(row);
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

function normalizeEndocrinoPatient(patient) {
  return {
    id: SISELO.normalizeEntityId(patient && patient.id),
    full_name: String((patient && patient.full_name) || "").trim(),
    cpf: String((patient && patient.cpf) || "").trim(),
    ses: String((patient && patient.ses) || "").trim(),
    birth_date: String((patient && patient.birth_date) || "").trim(),
    first_cadh_date: String((patient && patient.first_cadh_date) || "").trim(),
    age_label: String((patient && patient.age_label) || "").trim(),
    race: String((patient && (patient.race || patient.race_label || patient.color_race)) || "").trim(),
    gender_label: String((patient && patient.gender_label) || "").trim(),
  };
}

function openEndocrinoModal(record = null) {
  const modal = document.getElementById("endocrino-modal");
  const form = document.getElementById("endocrino-form");
  if (!modal || !form) {
    return;
  }

  endocrinoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  form.reset();
  SISELO.showAlert("endocrino-alert", "", "info");
  fillEndocrinoForm(record);

  modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstInput = document.querySelector("#endocrino_patient_search input");
  if (firstInput instanceof HTMLElement) {
    firstInput.focus();
  }
}

function closeEndocrinoModal() {
  const modal = document.getElementById("endocrino-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (endocrinoState.lastFocus instanceof HTMLElement) {
    endocrinoState.lastFocus.focus();
  }
}

function openEndocrinoViewModal(record) {
  const modal = document.getElementById("endocrino-view-modal");
  const content = document.getElementById("endocrino-view-content");
  if (!modal || !content) {
    return;
  }

  endocrinoState.lastFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  content.innerHTML = renderEndocrinoViewRecord(normalizeEndocrinoRecord(record));
  modal.hidden = false;
  document.body.classList.add("modal-open");

  const closeButton = modal.querySelector("[data-endocrino-view-close]");
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
}

function closeEndocrinoViewModal() {
  const modal = document.getElementById("endocrino-view-modal");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (endocrinoState.lastFocus instanceof HTMLElement) {
    endocrinoState.lastFocus.focus();
  }
}

function fillEndocrinoForm(record = null) {
  const normalizedRecord = record ? normalizeEndocrinoRecord(record) : null;
  endocrinoState.editingRecordId = normalizedRecord ? normalizedRecord.id : "";
  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeEndocrinoPatient(cachedState.patient)
    : null;
  const recordPatient = normalizedRecord
    ? normalizeEndocrinoPatient({
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
    ? findEndocrinoPatientById(normalizedRecord.patient_id) || recordPatient
    : cachedPatient;

  setEndocrinoField("endocrino_record_id", normalizedRecord ? normalizedRecord.id : "");
  setEndocrinoField("endocrino_consultation_date", normalizedRecord ? normalizedRecord.consultation_date : "");
  setEndocrinoField("endocrino_hba1c", normalizedRecord ? formatEndocrinoDecimalInput(normalizedRecord.hba1c) : "");
  setEndocrinoField("endocrino_fragility", normalizedRecord ? normalizedRecord.fragility : "");
  setEndocrinoField("endocrino_clinical_target", normalizedRecord ? formatEndocrinoTargetInput(normalizedRecord.clinical_target) : "");
  setEndocrinoField("endocrino_transition_target", normalizedRecord && !isEndocrinoNotApplicable(normalizedRecord.transition_target) ? formatEndocrinoTargetInput(normalizedRecord.transition_target) : "");
  setEndocrinoField("endocrino_target_met", normalizedRecord ? normalizedRecord.target_met : "");
  setEndocrinoField("endocrino_neuropathy", normalizedRecord ? normalizedRecord.neuropathy : "");
  setEndocrinoField("endocrino_nephropathy", normalizedRecord ? normalizedRecord.nephropathy : "");
  setEndocrinoField("endocrino_renal_function", normalizedRecord ? normalizedRecord.renal_function : "");
  setEndocrinoField("endocrino_interventions", normalizedRecord ? normalizedRecord.interventions : "");
  setEndocrinoField("endocrino_barriers", normalizedRecord ? normalizedRecord.barriers : "");
  setEndocrinoField("endocrino_recommendations", normalizedRecord ? normalizedRecord.recommendations : "");

  if (endocrinoState.patientPicker) {
    endocrinoState.patientPicker.setValue(selectedPatient && selectedPatient.id ? selectedPatient : null);
  }
  updateEndocrinoPatientSummary(selectedPatient && selectedPatient.id ? selectedPatient : null);
  updateEndocrinoAgeGuidance(selectedPatient && selectedPatient.id ? selectedPatient : null);
  suggestEndocrinoFragilityFromPatient(selectedPatient && selectedPatient.id ? selectedPatient : null);

  updateEndocrinoConsultationOptions(
    selectedPatient && selectedPatient.id,
    endocrinoState.editingRecordId,
    normalizedRecord ? normalizedRecord.consultation_number : "",
  );

  const dateInput = document.getElementById("endocrino_consultation_date");
  if (dateInput) {
    SISELO.syncEnhancedDateInput(dateInput);
  }
}

function setEndocrinoField(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }

  field.value = value || "";
}

function bindEndocrinoNumericFields() {
  [
    { id: "endocrino_hba1c", type: "decimal", hint: ENDOCRINO_NUMERIC_HINT, max: null },
    { id: "endocrino_clinical_target", type: "target", hint: ENDOCRINO_TARGET_HINT },
    { id: "endocrino_transition_target", type: "target", hint: ENDOCRINO_TARGET_HINT },
  ].forEach((config) => {
    const id = config.id;
    const input = document.getElementById(id);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.addEventListener("beforeinput", (event) => {
      if (!event.data) {
        return;
      }

      const allowedPattern = config.type === "target" ? /^[0-9,.<]$/ : /^[0-9,.]$/;
      if (!allowedPattern.test(event.data)) {
        event.preventDefault();
        showEndocrinoTypingAlert(config.hint);
        return;
      }

      const nextValue = `${input.value.slice(0, input.selectionStart || 0)}${event.data}${input.value.slice(input.selectionEnd || 0)}`;
      if (!isValidEndocrinoNumericDraft(nextValue, config.type)) {
        event.preventDefault();
        showEndocrinoTypingAlert(config.hint);
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const pasted = event.clipboardData ? event.clipboardData.getData("text") : "";
      const nextValue = `${input.value}${pasted}`;
      const sanitized = sanitizeEndocrinoNumericInput(nextValue, config.type);
      if (sanitized !== normalizeEndocrinoNumericDraft(nextValue, config.type)) {
        showEndocrinoTypingAlert(config.hint);
      }
      input.value = sanitized;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    input.addEventListener("input", () => {
      const sanitized = sanitizeEndocrinoNumericInput(input.value, config.type);
      if (input.value !== sanitized) {
        input.value = sanitized;
        showEndocrinoTypingAlert(config.hint);
      }
      showEndocrinoRangeHint(input.value, config);
      syncEndocrinoTargetMetFromValues();
    });

    input.addEventListener("blur", () => {
      input.value = finalizeEndocrinoNumericInput(input.value, config.type);
      showEndocrinoRangeHint(input.value, config);
      syncEndocrinoTargetMetFromValues();
    });
  });
}

function showEndocrinoTypingAlert(message = ENDOCRINO_NUMERIC_HINT) {
  const now = Date.now();
  if (now - endocrinoState.lastTypingAlertAt < 1600) {
    return;
  }

  endocrinoState.lastTypingAlertAt = now;
  SISELO.showAlert("endocrino-alert", message, "error");
}

function bindEndocrinoFloatingGuidance() {
  if (document.body.dataset.endocrinoTooltipBound !== "true") {
    document.body.dataset.endocrinoTooltipBound = "true";
    window.addEventListener("resize", hideEndocrinoFloatingTip);
  }

  document.querySelectorAll(".endocrino-field-guidance").forEach((guidance) => {
    const field = guidance.closest(".field, .field-full");
    if (!(field instanceof HTMLElement) || field.dataset.endocrinoGuidanceBound === "true") {
      return;
    }

    field.dataset.endocrinoGuidanceBound = "true";
    const show = () => showEndocrinoFloatingTip(field, guidance.textContent || "");
    const hide = () => hideEndocrinoFloatingTip();

    field.addEventListener("mouseenter", show);
    field.addEventListener("focusin", show);
    field.addEventListener("mouseleave", hide);
    field.addEventListener("focusout", hide);
  });
}

function getEndocrinoFloatingTip() {
  let tooltip = document.getElementById("endocrino-floating-tip");
  if (!(tooltip instanceof HTMLElement)) {
    tooltip = document.createElement("div");
    tooltip.id = "endocrino-floating-tip";
    tooltip.className = "endocrino-tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
  }

  return tooltip;
}

function showEndocrinoFloatingTip(anchor, message) {
  const text = String(message || "").trim();
  if (!text || !(anchor instanceof HTMLElement)) {
    hideEndocrinoFloatingTip();
    return;
  }

  const tooltip = getEndocrinoFloatingTip();
  tooltip.textContent = text;
  tooltip.hidden = false;
  positionEndocrinoFloatingTip(anchor, tooltip);
}

function hideEndocrinoFloatingTip() {
  const tooltip = document.getElementById("endocrino-floating-tip");
  if (tooltip instanceof HTMLElement) {
    tooltip.hidden = true;
    tooltip.textContent = "";
  }
}

function positionEndocrinoFloatingTip(anchor, tooltip) {
  const viewportPadding = 12;
  const gap = 10;
  const anchorRect = anchor.getBoundingClientRect();
  const menu = anchor.closest(".endocrino-select-menu");
  const referenceRect = menu instanceof HTMLElement ? menu.getBoundingClientRect() : anchorRect;

  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const tooltipRect = tooltip.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;
  const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;
  const maxTop = window.innerHeight - tooltipHeight - viewportPadding;
  let left = anchorRect.left;
  let top = anchorRect.top - tooltipHeight - gap;

  if (menu instanceof HTMLElement) {
    if (referenceRect.right + gap + tooltipWidth <= window.innerWidth - viewportPadding) {
      left = referenceRect.right + gap;
      top = anchorRect.top;
    } else if (referenceRect.left - gap - tooltipWidth >= viewportPadding) {
      left = referenceRect.left - gap - tooltipWidth;
      top = anchorRect.top;
    } else {
      left = referenceRect.left;
      top = referenceRect.top - tooltipHeight - gap;
      if (top < viewportPadding) {
        top = referenceRect.bottom + gap;
      }
    }
  } else if (top < viewportPadding) {
    top = anchorRect.bottom + gap;
  }

  tooltip.style.left = `${Math.max(viewportPadding, Math.min(left, maxLeft))}px`;
  tooltip.style.top = `${Math.max(viewportPadding, Math.min(top, maxTop))}px`;
}

function bindEndocrinoFragilityField() {
  const select = document.getElementById("endocrino_fragility");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  createEndocrinoFragilityProxy(select);
  select.addEventListener("change", () => {
    updateEndocrinoFragilityGuidance(select.value);
  });
  updateEndocrinoFragilityGuidance(select.value);
}

function createEndocrinoFragilityProxy(select) {
  if (select.dataset.endocrinoProxy === "true") {
    return;
  }

  select.dataset.endocrinoProxy = "true";
  select.classList.add("endocrino-native-select-hidden");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const proxy = document.createElement("div");
  proxy.className = "endocrino-select-proxy";
  proxy.dataset.endocrinoFragilityProxy = "true";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "endocrino-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const triggerText = document.createElement("span");
  triggerText.dataset.endocrinoSelectText = "true";
  trigger.appendChild(triggerText);

  const menu = document.createElement("div");
  menu.className = "endocrino-select-menu";
  menu.hidden = true;

  const list = document.createElement("div");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Análise da fragilidade");

  Array.from(select.options)
    .filter((option) => option.value)
    .forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "endocrino-select-option";
      item.dataset.value = option.value;
      item.setAttribute("role", "option");
      item.textContent = option.textContent;

      item.addEventListener("mouseenter", () => {
        showEndocrinoFloatingTip(item, getEndocrinoFragilityGuidance(option.value));
      });
      item.addEventListener("focus", () => {
        showEndocrinoFloatingTip(item, getEndocrinoFragilityGuidance(option.value));
      });
      item.addEventListener("mouseleave", () => {
        hideEndocrinoFloatingTip();
      });
      item.addEventListener("blur", () => {
        hideEndocrinoFloatingTip();
      });
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeEndocrinoFragilityMenu(proxy);
        trigger.focus();
      });

      list.appendChild(item);
    });

  menu.appendChild(list);
  proxy.append(trigger, menu);
  select.insertAdjacentElement("afterend", proxy);

  trigger.addEventListener("click", () => {
    toggleEndocrinoFragilityMenu(proxy);
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEndocrinoFragilityMenu(proxy);
      const selected = proxy.querySelector(".endocrino-select-option.is-selected");
      const first = proxy.querySelector(".endocrino-select-option");
      (selected || first)?.focus();
    }

    if (event.key === "Escape") {
      closeEndocrinoFragilityMenu(proxy);
    }
  });

  menu.addEventListener("mouseleave", () => {
    hideEndocrinoFloatingTip();
  });
  menu.addEventListener("scroll", () => {
    hideEndocrinoFloatingTip();
  });

  document.addEventListener("click", (event) => {
    if (!proxy.contains(event.target)) {
      closeEndocrinoFragilityMenu(proxy);
    }
  });

  syncEndocrinoFragilityProxy(select);
}

function updateEndocrinoFragilityGuidance() {
  const select = document.getElementById("endocrino_fragility");
  if (select instanceof HTMLSelectElement) {
    syncEndocrinoFragilityProxy(select);
  }
}

function getEndocrinoFragilityGuidance(value) {
  return ENDOCRINO_FRAGILITY_GUIDANCE[normalizeEndocrinoFragility(value)] || "";
}

function toggleEndocrinoFragilityMenu(proxy) {
  const menu = proxy.querySelector(".endocrino-select-menu");
  if (!(menu instanceof HTMLElement)) {
    return;
  }

  if (menu.hidden) {
    openEndocrinoFragilityMenu(proxy);
  } else {
    closeEndocrinoFragilityMenu(proxy);
  }
}

function openEndocrinoFragilityMenu(proxy) {
  const menu = proxy.querySelector(".endocrino-select-menu");
  const trigger = proxy.querySelector(".endocrino-select-trigger");
  if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
    return;
  }

  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => {
    const selected = proxy.querySelector(".endocrino-select-option.is-selected");
    const first = proxy.querySelector(".endocrino-select-option");
    const option = selected || first;
    if (option instanceof HTMLElement) {
      showEndocrinoFloatingTip(option, getEndocrinoFragilityGuidance(option.dataset.value));
    }
  });
}

function closeEndocrinoFragilityMenu(proxy) {
  const menu = proxy.querySelector(".endocrino-select-menu");
  const trigger = proxy.querySelector(".endocrino-select-trigger");
  if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
    return;
  }

  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  hideEndocrinoFloatingTip();
}

function syncEndocrinoFragilityProxy(select) {
  const proxy = select.nextElementSibling;
  if (!(proxy instanceof HTMLElement) || proxy.dataset.endocrinoFragilityProxy !== "true") {
    return;
  }

  const text = proxy.querySelector("[data-endocrino-select-text]");
  const selectedOption = select.selectedOptions && select.selectedOptions[0]
    ? select.selectedOptions[0]
    : null;
  const label = selectedOption && selectedOption.value
    ? selectedOption.textContent
    : "Selecione...";

  if (text instanceof HTMLElement) {
    text.textContent = label || "Selecione...";
  }

  proxy.querySelectorAll(".endocrino-select-option").forEach((item) => {
    const isSelected = item instanceof HTMLElement && item.dataset.value === select.value;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-selected", String(isSelected));
  });
}

function suggestEndocrinoFragilityFromPatient(patient) {
  const select = document.getElementById("endocrino_fragility");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  if (select.value) {
    updateEndocrinoFragilityGuidance(select.value);
    return;
  }

  const ageYears = getEndocrinoAgeYears(patient);
  const suggestedValue = getEndocrinoFragilityByAge(ageYears);
  if (suggestedValue && Array.from(select.options).some((option) => option.value === suggestedValue)) {
    select.value = suggestedValue;
  }

  updateEndocrinoFragilityGuidance(select.value);
}

function sanitizeEndocrinoNumericInput(value, type = "decimal") {
  return type === "target"
    ? sanitizeEndocrinoTargetInput(value)
    : sanitizeEndocrinoDecimalInput(value, type === "target" ? 2 : 5);
}

function finalizeEndocrinoNumericInput(value, type = "decimal") {
  const sanitized = sanitizeEndocrinoNumericInput(value, type);
  return sanitized.endsWith(",") ? sanitized.slice(0, -1) : sanitized;
}

function sanitizeEndocrinoDecimalInput(value, maxIntegerDigits = 5) {
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
  if (parts.length === 1) {
    return parts[0].slice(0, maxIntegerDigits);
  }

  return `${parts[0].slice(0, maxIntegerDigits)},${parts[1].slice(0, 2)}`;
}

function sanitizeEndocrinoTargetInput(value) {
  const normalized = String(value || "")
    .replace(/\./g, ",")
    .replace(/≤/g, "<")
    .replace(/\s+/g, "");
  const hasComparator = normalized.startsWith("<");
  const numberPart = sanitizeEndocrinoDecimalInput(normalized.replace(/[<>=]/g, ""));

  if (hasComparator && !numberPart) {
    return "<";
  }

  return `${hasComparator ? "<" : ""}${numberPart}`;
}

function normalizeEndocrinoNumericDraft(value, type = "decimal") {
  const normalized = String(value || "").replace(/\./g, ",");
  return type === "target" ? normalized.replace(/\s+/g, "") : normalized;
}

function isValidEndocrinoNumericDraft(value, type = "decimal") {
  return sanitizeEndocrinoNumericInput(value, type) === normalizeEndocrinoNumericDraft(value, type);
}

function parseEndocrinoNumericValue(value) {
  const numericValue = finalizeEndocrinoNumericInput(String(value || "").replace(/</g, ""), "decimal");
  if (!numericValue) {
    return NaN;
  }

  const numberValue = Number(numericValue.replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : NaN;
}

function showEndocrinoRangeHint(value, config) {
  const numberValue = parseEndocrinoNumericValue(value);
  if (!Number.isFinite(numberValue) || config.max == null || numberValue <= config.max) {
    return;
  }

  showEndocrinoTypingAlert(`Meta de HbA1c: o valor deve ser de 0 até ${config.max}. Ex: 7,2.`);
}

function calculateEndocrinoTargetMet(hba1cValue, targetValue) {
  const hba1cNumber = parseEndocrinoNumericValue(hba1cValue);
  const targetNumber = parseEndocrinoNumericValue(targetValue);
  if (!Number.isFinite(hba1cNumber) || !Number.isFinite(targetNumber)) {
    return "";
  }

  const usesStrictLimit = String(targetValue || "").trim().startsWith("<");
  return usesStrictLimit
    ? (hba1cNumber < targetNumber ? "Sim" : "Não")
    : (hba1cNumber <= targetNumber ? "Sim" : "Não");
}

function syncEndocrinoTargetMetFromValues() {
  const hba1cInput = document.getElementById("endocrino_hba1c");
  const targetInput = document.getElementById("endocrino_clinical_target");
  const targetMetSelect = document.getElementById("endocrino_target_met");
  if (
    !(hba1cInput instanceof HTMLInputElement) ||
    !(targetInput instanceof HTMLInputElement) ||
    !(targetMetSelect instanceof HTMLSelectElement)
  ) {
    return;
  }

  const result = calculateEndocrinoTargetMet(hba1cInput.value, targetInput.value);
  if (result) {
    targetMetSelect.value = result;
  }
}

function validateEndocrinoNumericFields() {
  const fields = [
    { id: "endocrino_hba1c", label: "valor hemoglobina glicada", min: 0, max: null, type: "decimal" },
    { id: "endocrino_clinical_target", label: "meta de HbA1c", min: 0, max: 20, type: "target" },
    { id: "endocrino_transition_target", label: "meta de acompanhamento", min: 0, max: 20, type: "target" },
  ];
  const values = {};

  for (const field of fields) {
    const input = document.getElementById(field.id);
    const value = finalizeEndocrinoNumericInput(input ? input.value : "", field.type);
    if (input) {
      input.value = value;
    }

    if (!value) {
      values[field.id.replace("endocrino_", "")] = "";
      continue;
    }

    if (field.type === "target" && value === "<") {
      SISELO.showAlert("endocrino-alert", `${field.label}: informe o número depois do sinal <. Ex: <7 ou <7,5.`, "error");
      if (input) {
        input.focus();
      }
      return null;
    }

    const numberValue = parseEndocrinoNumericValue(value);
    if (!Number.isFinite(numberValue) || numberValue < field.min || (field.max != null && numberValue > field.max)) {
      const example = field.type === "target" ? `preencha de ${field.min} até ${field.max}. Ex: 7, <7 ou <7,5.` : "preencha apenas o número informado no laudo, sem texto ou unidade.";
      SISELO.showAlert("endocrino-alert", `${field.label}: ${example}`, "error");
      if (input) {
        input.focus();
      }
      return null;
    }

    values[field.id.replace("endocrino_", "")] = value;
  }

  return {
    hba1c: values.hba1c,
    clinical_target: values.clinical_target,
    transition_target: values.transition_target,
  };
}

function updateEndocrinoConsultationOptions(patientId, currentRecordId = "", preferredValue = "") {
  const select = document.getElementById("endocrino_consultation_number");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  const normalizedPreferred = normalizeEndocrinoConsultationLabel(preferredValue);
  const patientRecords = endocrinoState.records.filter((record) => (
    record.patient_id === normalizedPatientId && record.id !== normalizedCurrentId
  ));
  const hasInitial = patientRecords.some((record) => isInitialEndocrinoConsultation(record.consultation_number));
  const isEditingInitial = normalizedPreferred && isInitialEndocrinoConsultation(normalizedPreferred);
  const maxOrdinal = patientRecords.reduce((max, record) => {
    return Math.max(max, parseEndocrinoConsultationOrdinal(record.consultation_number));
  }, 0);
  const nextOrdinal = Math.max(2, maxOrdinal + 1);
  const preferredOrdinal = parseEndocrinoConsultationOrdinal(normalizedPreferred);
  const subsequentLabel = preferredOrdinal > 1
    ? formatEndocrinoConsultationLabel(preferredOrdinal)
    : formatEndocrinoConsultationLabel(nextOrdinal);
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
    return;
  }

  const firstEnabled = options.find((option) => !option.disabled);
  select.value = firstEnabled ? firstEnabled.value : INITIAL_CONSULTATION_LABEL;
}

function hasDuplicateInitialConsultation(patientId, currentRecordId, consultationNumber) {
  if (!isInitialEndocrinoConsultation(consultationNumber)) {
    return false;
  }

  const normalizedPatientId = SISELO.normalizeEntityId(patientId);
  const normalizedCurrentId = String(currentRecordId || "").trim();
  return endocrinoState.records.some((record) => (
    record.patient_id === normalizedPatientId &&
    record.id !== normalizedCurrentId &&
    isInitialEndocrinoConsultation(record.consultation_number)
  ));
}

function normalizeEndocrinoConsultationLabel(value) {
  const normalized = String(value || "")
    .replace(/Âª/g, "ª")
    .trim();
  const ordinal = parseEndocrinoConsultationOrdinal(normalized);
  return ordinal ? formatEndocrinoConsultationLabel(ordinal) : "";
}

function isInitialEndocrinoConsultation(value) {
  return parseEndocrinoConsultationOrdinal(value) === 1 || String(value || "").toLowerCase().includes("inicial");
}

function parseEndocrinoConsultationOrdinal(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatEndocrinoConsultationLabel(ordinal) {
  const safeOrdinal = Math.max(1, Number(ordinal) || 1);
  return safeOrdinal === 1
    ? INITIAL_CONSULTATION_LABEL
    : `${safeOrdinal}\u00AA Consulta (subsequente)`;
}

function formatEndocrinoDecimalInput(value) {
  if (isEndocrinoNotApplicable(value)) {
    return "";
  }

  return sanitizeEndocrinoDecimalInput(String(value || "").replace(/</g, "").replace(/%/g, ""));
}

function formatEndocrinoTargetInput(value) {
  if (isEndocrinoNotApplicable(value)) {
    return "";
  }

  return sanitizeEndocrinoTargetInput(String(value || "").replace(/%/g, ""));
}

function formatEndocrinoTargetOutput(value) {
  const targetValue = finalizeEndocrinoNumericInput(value, "target");
  if (!targetValue || targetValue === "<") {
    return "";
  }

  return `${targetValue.startsWith("<") ? "< " : ""}${targetValue.replace(/</g, "")}%`;
}

function isEndocrinoNotApplicable(value) {
  return /n\s*\/?\s*a|não se aplica|nao se aplica|dm\s*tipo\s*i/i.test(String(value || ""));
}

function saveEndocrinoRecord() {
  const form = document.getElementById("endocrino-form");
  if (!form) {
    return;
  }

  if (!SISELO.validateEnhancedDateInputs(form, { alertId: "endocrino-alert" })) {
    return;
  }

  const patientId = endocrinoState.patientPicker
    ? endocrinoState.patientPicker.getValue()
    : "";

  if (!patientId) {
    SISELO.showAlert("endocrino-alert", "Selecione o paciente.", "error");
    if (endocrinoState.patientPicker) {
      endocrinoState.patientPicker.focus();
    }
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const numericValues = validateEndocrinoNumericFields();
  if (!numericValues) {
    return;
  }
  const targetMet = calculateEndocrinoTargetMet(numericValues.hba1c, numericValues.clinical_target);

  if (hasDuplicateInitialConsultation(patientId, payload.record_id || "", payload.consultation_number)) {
    SISELO.showAlert("endocrino-alert", "Este paciente já tem 1ª consulta. Escolha consulta subsequente.", "error");
    updateEndocrinoConsultationOptions(patientId, payload.record_id || "");
    return;
  }

  const patient = resolveEndocrinoPatient(patientId);
  const record = normalizeEndocrinoRecord({
    id: payload.record_id || createEndocrinoRecordId(),
    patient_id: patientId,
    full_name: patient.full_name || "",
    cpf: patient.cpf || "",
    ses: patient.ses || "",
    birth_date: patient.birth_date || "",
    first_cadh_date: patient.first_cadh_date || "",
    age_label: patient.age_label || "",
    race: patient.race || "",
    consultation_date: payload.consultation_date,
    consultation_number: payload.consultation_number || INITIAL_CONSULTATION_LABEL,
    hba1c: numericValues.hba1c ? `${numericValues.hba1c}%` : "",
    fragility: payload.fragility,
    clinical_target: formatEndocrinoTargetOutput(numericValues.clinical_target),
    transition_target: formatEndocrinoTargetOutput(numericValues.transition_target) || "N/A para DM tipo I",
    target_met: targetMet || payload.target_met,
    neuropathy: payload.neuropathy,
    nephropathy: payload.nephropathy,
    renal_function: payload.renal_function,
    interventions: payload.interventions,
    barriers: payload.barriers,
    recommendations: payload.recommendations,
    updated_at: new Date().toISOString(),
  });

  if (!record) {
    SISELO.showAlert("endocrino-alert", "Não foi possível salvar. Confira os dados e tente de novo.", "error");
    return;
  }

  const existingIndex = endocrinoState.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    endocrinoState.records[existingIndex] = record;
  } else {
    endocrinoState.records.unshift(record);
  }

  writeEndocrinoRecords(endocrinoState.records);
  renderEndocrinoTable();
  closeEndocrinoModal();
}

function resolveEndocrinoPatient(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  const patient = findEndocrinoPatientById(normalizedId);
  if (patient) {
    return patient;
  }

  const cachedState = readCadhSearchState();
  const cachedPatient = cachedState && cachedState.patient
    ? normalizeEndocrinoPatient(cachedState.patient)
    : null;

  if (cachedPatient && cachedPatient.id === normalizedId) {
    endocrinoState.patients = mergeEndocrinoPatients(endocrinoState.patients.concat([cachedPatient]));
    return cachedPatient;
  }

  return { id: normalizedId, full_name: "", cpf: "", ses: "", birth_date: "", first_cadh_date: "", age_label: "", race: "" };
}

function findEndocrinoPatientById(patientId) {
  const normalizedId = SISELO.normalizeEntityId(patientId);
  return endocrinoState.patients.find((item) => item.id === normalizedId) || null;
}

function updateEndocrinoPatientSummary(patient) {
  const element = document.getElementById("endocrino-patient-summary");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  const fullPatient = findEndocrinoPatientById(patient.id) || normalizeEndocrinoPatient(patient);
  const ageYears = getEndocrinoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "-");
  element.innerHTML = [
    renderEndocrinoPatientSummaryItem("CPF", fullPatient.cpf || "-"),
    renderEndocrinoPatientSummaryItem("SES", fullPatient.ses || "-"),
    renderEndocrinoPatientSummaryItem("Cor/Raça", formatEndocrinoRace(fullPatient.race)),
    renderEndocrinoPatientSummaryItem("Idade", ageLabel),
    renderEndocrinoPatientSummaryItem("Nascimento", formatEndocrinoDate(fullPatient.birth_date)),
    renderEndocrinoPatientSummaryItem("1º atendimento CADH", formatEndocrinoDate(fullPatient.first_cadh_date)),
  ].join("");
  element.hidden = false;
}

function renderEndocrinoPatientSummaryItem(label, value) {
  return `
    <span>
      ${SISELO.escapeHtml(label)}
      <strong>${SISELO.escapeHtml(value || "-")}</strong>
    </span>
  `;
}

function updateEndocrinoAgeGuidance(patient) {
  const element = document.getElementById("endocrino-age-guidance");
  if (!element) {
    return;
  }

  if (!patient || !patient.id) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  const fullPatient = findEndocrinoPatientById(patient.id) || normalizeEndocrinoPatient(patient);
  const ageYears = getEndocrinoAgeYears(fullPatient);
  const ageLabel = fullPatient.age_label || (Number.isFinite(ageYears) ? `${ageYears} anos` : "");
  const guidance = getEndocrinoAgeGuidance(ageYears);

  element.textContent = ageLabel
    ? `Idade: ${ageLabel}. ${guidance}`
    : `Idade não informada. ${guidance}`;
  element.hidden = false;
}

function getEndocrinoAgeYears(patient) {
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

function getEndocrinoAgeGuidance(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "Ajuste a meta conforme fragilidade e risco de hipoglicemia.";
  }

  if (ageYears < 2) {
    return "Use conduta pediátrica, com responsável presente e sinais de alerta registrados.";
  }

  if (ageYears < 10) {
    return "Use meta individualizada e inclua o responsável no plano.";
  }

  if (ageYears < 20) {
    return "Use meta individualizada e considere o responsável no plano.";
  }

  if (ageYears >= 60) {
    return "Considere fragilidade, comorbidades e risco de hipoglicemia.";
  }

  return "Defina a meta conforme protocolo clínico e risco de hipoglicemia.";
}

function getEndocrinoFragilityByAge(ageYears) {
  if (!Number.isFinite(ageYears)) {
    return "";
  }

  if (ageYears < 2) {
    return "Bebê (0 a 23 meses)";
  }

  if (ageYears < 10) {
    return "Criança (2 a 9 anos)";
  }

  if (ageYears < 20) {
    return "Adolescente (10 a 19 anos)";
  }

  if (ageYears < 60) {
    return "Adulto (20 a 59 anos)";
  }

  return "Pessoa idosa (60 anos ou mais)";
}

function renderEndocrinoViewRecord(record) {
  const item = record || {};

  return `
    ${renderEndocrinoViewSection("Identificação da consulta", [
      ["Paciente", item.full_name || "-"],
      ["CPF", item.cpf || "-"],
      ["SES", item.ses || "-"],
      ["Cor/Raça", formatEndocrinoRace(item.race)],
      ["Data de nascimento", formatEndocrinoDate(item.birth_date)],
      ["Idade", item.age_label || "-"],
      ["Primeiro atendimento CADH", formatEndocrinoDate(item.first_cadh_date)],
      ["Data da consulta", formatEndocrinoDate(item.consultation_date)],
      ["Nº da consulta", item.consultation_number || "-"],
    ])}
    ${renderEndocrinoViewSection("Dados clínicos", [
      ["Valor hemoglobina glicada", item.hba1c || "-"],
      ["Análise da fragilidade", item.fragility || "-"],
      ["Meta de HbA1c do paciente", item.clinical_target || "-"],
      ["Meta de HbA1c para acompanhamento", item.transition_target || "-"],
      ["Cumprimento da meta terapêutica", item.target_met || "-"],
      ["Neuropatia", item.neuropathy || "-"],
      ["Nefropatia", item.nephropathy || "-"],
      ["Função renal", item.renal_function || "-"],
    ])}
    ${renderEndocrinoViewSection("Plano de cuidado", [
      ["Conduta", item.interventions || "-", true],
      ["Dificuldades do paciente", item.barriers || "-", true],
      ["Orientação e retorno", item.recommendations || "-", true],
    ])}
  `;
}

function renderEndocrinoViewSection(title, items) {
  return `
    <section class="endocrino-view-section">
      <h3 class="endocrino-section-title">${SISELO.escapeHtml(title)}</h3>
      <div class="endocrino-view-grid">
        ${items.map(([label, value, wide]) => renderEndocrinoViewItem(label, value, wide)).join("")}
      </div>
    </section>
  `;
}

function renderEndocrinoViewItem(label, value, wide = false) {
  return `
    <div class="endocrino-view-item${wide ? " is-wide" : ""}">
      <span class="endocrino-view-label">${SISELO.escapeHtml(label)}</span>
      <div class="endocrino-view-value">${SISELO.escapeHtml(value || "-")}</div>
    </div>
  `;
}

function renderEndocrinoTable() {
  const tbody = document.getElementById("endocrino-table-body");
  if (!tbody) {
    return;
  }

  const records = endocrinoState.records
    .slice()
    .sort((left, right) => {
      const consultationOrder = parseEndocrinoConsultationOrdinal(right.consultation_number) -
        parseEndocrinoConsultationOrdinal(left.consultation_number);
      if (consultationOrder !== 0) {
        return consultationOrder;
      }

      return String(right.consultation_date || "").localeCompare(String(left.consultation_date || ""));
    });

  if (!records.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="endocrino-empty">
            <p>Nenhum registro de Endocrinologia encontrado.</p>
            <button type="button" class="btn btn-primary" data-endocrino-empty-new>+ Novo registro</button>
          </div>
        </td>
      </tr>
    `;
    bindEndocrinoTableActions();
    return;
  }

  tbody.innerHTML = records.map((record) => `
    <tr>
      <td>${SISELO.escapeHtml(formatEndocrinoDate(record.consultation_date))}</td>
      <td>${SISELO.escapeHtml(record.full_name || "-")}</td>
      <td>${SISELO.escapeHtml(record.consultation_number || "-")}</td>
      <td>${SISELO.escapeHtml(record.hba1c || "-")}</td>
      <td>${SISELO.escapeHtml(record.target_met || "-")}</td>
      <td>${SISELO.escapeHtml(record.neuropathy || "-")}</td>
      <td>${SISELO.escapeHtml(record.nephropathy || "-")}</td>
      <td>${SISELO.escapeHtml(record.renal_function || "-")}</td>
      <td>
        <div class="table-actions">
          ${SISELO.iconButton("view", "Ver exame clínico", { "data-endocrino-view": record.id })}
          ${SISELO.iconButton("pdf", "Gerar PDF", { "data-endocrino-pdf": record.id })}
          ${SISELO.iconButton("edit", "Editar registro", { "data-endocrino-edit": record.id })}
        </div>
      </td>
    </tr>
  `).join("");

  bindEndocrinoTableActions();
}

function bindEndocrinoTableActions() {
  const tbody = document.getElementById("endocrino-table-body");
  if (!tbody) {
    return;
  }

  tbody.querySelectorAll("[data-endocrino-empty-new]").forEach((button) => {
    button.addEventListener("click", () => openEndocrinoModal());
  });

  tbody.querySelectorAll("[data-endocrino-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = endocrinoState.records.find((item) => item.id === button.dataset.endocrinoEdit);
      if (record) {
        openEndocrinoModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-endocrino-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = endocrinoState.records.find((item) => item.id === button.dataset.endocrinoView);
      if (record) {
        openEndocrinoViewModal(record);
      }
    });
  });

  tbody.querySelectorAll("[data-endocrino-pdf]").forEach((button) => {
    button.addEventListener("click", () => {
      SISELO.showUnavailableAction("A geração do PDF será disponibilizada em breve.");
    });
  });
}

function readEndocrinoRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENDOCRINO_STORAGE_KEY) || "[]");
    return (Array.isArray(parsed) ? parsed : [])
      .map((record) => normalizeEndocrinoRecord(record))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeEndocrinoRecords(records) {
  try {
    localStorage.setItem(
      ENDOCRINO_STORAGE_KEY,
      JSON.stringify((Array.isArray(records) ? records : []).filter(Boolean)),
    );
  } catch (error) {
  }
}

function normalizeEndocrinoRecord(record) {
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
    consultation_number: normalizeEndocrinoConsultationLabel(record && record.consultation_number) || INITIAL_CONSULTATION_LABEL,
    hba1c: String((record && record.hba1c) || "").trim(),
    fragility: normalizeEndocrinoFragility(record && record.fragility),
    clinical_target: String((record && record.clinical_target) || "").trim(),
    transition_target: String((record && record.transition_target) || "").trim(),
    target_met: String((record && record.target_met) || "").trim(),
    neuropathy: String((record && record.neuropathy) || "").trim(),
    nephropathy: String((record && record.nephropathy) || "").trim(),
    renal_function: String((record && record.renal_function) || "").trim(),
    interventions: String((record && record.interventions) || "").trim(),
    barriers: String((record && record.barriers) || "").trim(),
    recommendations: String((record && record.recommendations) || "").trim(),
    updated_at: String((record && record.updated_at) || "").trim(),
  };
}

function normalizeEndocrinoFragility(value) {
  const original = String(value || "").trim();
  const normalized = SISELO.normalizeSearchText(original);
  const legacyValues = {
    "crianca ou adolescente": "Adolescente (10 a 19 anos)",
    "crianca": "Criança (2 a 9 anos)",
    "adolescente": "Adolescente (10 a 19 anos)",
    "adulto": "Adulto (20 a 59 anos)",
    "idoso": "Pessoa idosa (60 anos ou mais)",
    "pessoa idosa": "Pessoa idosa (60 anos ou mais)",
    "idoso fragil": "Pessoa idosa frágil ou em fragilização",
    "pessoa idosa fragil": "Pessoa idosa frágil ou em fragilização",
    "gestante": "Gestante",
    "nao se aplica": "Não se aplica",
  };

  return legacyValues[normalized] || original;
}

function createEndocrinoRecordId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatEndocrinoDate(value) {
  const date = SISELO.parseDateInputValue(value);
  if (!date) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatEndocrinoRace(value) {
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
