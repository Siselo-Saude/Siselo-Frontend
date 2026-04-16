(function () {
  const CONFIG = window.SISELO_CONFIG || {};
  const SESSION_KEY = 'siselo_session';
  const CSRF_KEY = 'siselo_csrf';
  const MOCK_DB_KEY = 'siselo_front_mock_db_v1';
  const MOCK_DB_VERSION = 2;
  const MOCK_CSRF_TOKEN = 'siselo-front-mock-csrf';
  const MOCK_GENDER_LABELS = {
    masculino: 'Masculino',
    feminino: 'Feminino',
    outro: 'Outro',
  };
  const MOCK_STATUS_LABELS = {
    ativo: 'Ativo',
    inativo: 'Inativo',
  };
  const MOCK_PATIENT_OPTIONS = {
    gender_options: MOCK_GENDER_LABELS,
    race_options: {
      branca: 'Branca',
      preta: 'Preta',
      parda: 'Parda',
      amarela: 'Amarela',
      indigena: 'Indigena',
      nao_informado: 'Nao informado',
    },
    blood_type_options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    status_options: MOCK_STATUS_LABELS,
  };
  const MOCK_TRANSITION_STATUSES = ['pendente', 'em_andamento', 'concluida', 'cancelada'];
  const CRUD_UI_PERMISSIONS = [
    'patients.view',
    'patients.create',
    'patients.update',
    'patients.delete',
    'patients.restore',
    'careplans.view',
    'careplans.create',
    'careplans.update',
    'careplans.delete',
    'careplans.restore',
    'encounters.view',
    'encounters.create',
    'encounters.update',
    'encounters.delete',
    'encounters.restore',
    'transitions.view',
    'transitions.create',
    'transitions.update',
    'transitions.delete',
    'transitions.restore',
    'admin.manage',
  ];

  function supports(path) {
    const pathname = getUrl(path).pathname;
    return pathname.startsWith('/auth/') ||
      pathname.startsWith('/patients/') ||
      pathname.startsWith('/care_plans/') ||
      pathname.startsWith('/encounters/') ||
      pathname.startsWith('/transitions/');
  }

  function getUrl(path) {
    return new URL(String(path || '/'), location.origin);
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function getCsrfToken() {
    return sessionStorage.getItem(CSRF_KEY) || '';
  }

  function toPositiveInt(value) {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : 0;
  }

  function normalizeSearchValue(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizeSingleLine(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

  function todayDateInputValue() {
    const today = new Date();
    return `${today.getFullYear()}-${padNumber(today.getMonth() + 1)}-${padNumber(today.getDate())}`;
  }

  function parseDateInputValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ` +
      `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
  }

  function createError(message, status, errors) {
    const error = new Error(message || 'Erro na requisicao.');
    error.status = Number(status || 400);
    error.payload = {
      success: false,
      message: error.message,
      errors: errors || {},
    };
    return error;
  }

  function createDemoUser(overrides) {
    return {
      id: 1,
      name: 'Equipe Demo Siselo',
      email: 'demo@siselo.local',
      role: 'demo',
      must_change_password: 0,
      permissions: CRUD_UI_PERMISSIONS.slice(),
      ...(overrides || {}),
    };
  }

  function createMockDatabase() {
    return {
      version: MOCK_DB_VERSION,
      counters: {
        patients: 6,
        carePlans: 1,
        carePlanItems: 1,
        encounters: 1,
        transitions: 1,
      },
      patients: [
        {
          id: 1,
          first_cadh_date: '2026-01-12',
          full_name: 'Ana Clara Pereira',
          ses: '123456789',
          cpf: '214.764.391-25',
          birth_date: '1988-03-17',
          sex: 'feminino',
          race: 'parda',
          responsible_name: 'Paulo Pereira',
          phone: '(61) 99876-1201',
          address: 'SQN 210, Bloco B, Asa Norte',
          email: 'ana.clara@siselo.demo',
          emergency_contact: '(61) 99911-3200',
          health_insurance: 'SUS',
          blood_type: 'O+',
          allergies: 'Penicilina',
          chronic_conditions: 'Diabetes tipo 2',
          status: 'ativo',
          ubs_ref: 'UBS Asa Norte',
          team_ref: 'Equipe Verde',
          deleted_at: null,
          created_at: '2026-01-12 08:30:00',
          updated_at: '2026-04-12 09:15:00',
        },
        {
          id: 2,
          first_cadh_date: '2026-01-18',
          full_name: 'Bruno Henrique Souza',
          ses: '223344556',
          cpf: '741.913.842-79',
          birth_date: '1975-09-02',
          sex: 'masculino',
          race: 'preta',
          responsible_name: 'Marcia Souza',
          phone: '(61) 99120-4488',
          address: 'SHIS QI 09, Conjunto 4, Lago Sul',
          email: 'bruno.souza@siselo.demo',
          emergency_contact: '(61) 99880-5522',
          health_insurance: 'SUS',
          blood_type: 'A+',
          allergies: 'Nao relata',
          chronic_conditions: 'Hipertensao arterial sistemica',
          status: 'ativo',
          ubs_ref: 'UBS Lago Sul',
          team_ref: 'Equipe Azul',
          deleted_at: null,
          created_at: '2026-01-18 10:20:00',
          updated_at: '2026-04-09 14:00:00',
        },
        {
          id: 3,
          first_cadh_date: '2026-02-03',
          full_name: 'Camila Rocha Almeida',
          ses: '334455667',
          cpf: '268.151.293-06',
          birth_date: '1992-11-28',
          sex: 'feminino',
          race: 'branca',
          responsible_name: 'Juliana Rocha',
          phone: '(61) 98544-1102',
          address: 'CLS 303, Bloco C, Sudoeste',
          email: 'camila.almeida@siselo.demo',
          emergency_contact: '(61) 98400-0077',
          health_insurance: 'Particular',
          blood_type: 'B+',
          allergies: 'Amendoim',
          chronic_conditions: 'Obesidade grau I',
          status: 'ativo',
          ubs_ref: 'UBS Sudoeste',
          team_ref: 'Equipe Laranja',
          deleted_at: null,
          created_at: '2026-02-03 07:50:00',
          updated_at: '2026-04-10 16:20:00',
        },
        {
          id: 4,
          first_cadh_date: '2026-01-25',
          full_name: 'Diego Martins Costa',
          ses: '445566778',
          cpf: '895.400.644-22',
          birth_date: '1969-05-09',
          sex: 'masculino',
          race: 'parda',
          responsible_name: 'Luciana Costa',
          phone: '(61) 98210-3344',
          address: 'QNM 32, Conjunto H, Taguatinga',
          email: 'diego.costa@siselo.demo',
          emergency_contact: '(61) 98333-2211',
          health_insurance: 'SUS',
          blood_type: 'AB-',
          allergies: 'Dipirona',
          chronic_conditions: 'Insuficiencia cardiaca e hipertensao',
          status: 'inativo',
          ubs_ref: 'UBS Taguatinga Norte',
          team_ref: 'Equipe Amarela',
          deleted_at: null,
          created_at: '2026-01-25 11:40:00',
          updated_at: '2026-03-30 12:10:00',
        },
        {
          id: 5,
          first_cadh_date: '2026-02-10',
          full_name: 'Eliane Ferreira Lima',
          ses: '556677889',
          cpf: '322.649.195-40',
          birth_date: '1983-01-21',
          sex: 'feminino',
          race: 'preta',
          responsible_name: 'Carlos Lima',
          phone: '(61) 99765-8877',
          address: 'Quadra 104, Casa 12, Recanto das Emas',
          email: 'eliane.lima@siselo.demo',
          emergency_contact: '(61) 99610-4455',
          health_insurance: 'SUS',
          blood_type: 'O-',
          allergies: 'Nao relata',
          chronic_conditions: 'Diabetes gestacional previa e ansiedade',
          status: 'ativo',
          ubs_ref: 'UBS Recanto das Emas',
          team_ref: 'Equipe Vermelha',
          deleted_at: null,
          created_at: '2026-02-10 09:05:00',
          updated_at: '2026-04-13 08:45:00',
        },
      ],
      carePlans: [],
      carePlanItems: [],
      encounters: [],
      transitions: [],
    };
  }

  function getNextCounter(collection, fallback) {
    const nextId = (Array.isArray(collection) ? collection : []).reduce((maxId, item) => (
      Math.max(maxId, toPositiveInt(item && item.id))
    ), 0) + 1;

    return Math.max(toPositiveInt(fallback) || 1, nextId);
  }

  function normalizeStoredDatabase(data) {
    const seed = createMockDatabase();
    const source = data && typeof data === 'object' ? data : {};
    const patients = Array.isArray(source.patients)
      ? source.patients
        .map((patient) => {
          if (!patient || typeof patient !== 'object') {
            return null;
          }

          const id = toPositiveInt(patient.id);
          if (!id) {
            return null;
          }

          return {
            ...patient,
            id,
          };
        })
        .filter(Boolean)
      : deepClone(seed.patients);
    const validPatientIds = new Set(patients.map((patient) => toPositiveInt(patient.id)).filter(Boolean));
    const carePlans = Array.isArray(source.carePlans)
      ? source.carePlans
        .map((plan) => {
          if (!plan || typeof plan !== 'object') {
            return null;
          }

          const id = toPositiveInt(plan.id);
          const patientId = toPositiveInt(plan.patient_id);
          if (!id || !patientId || !validPatientIds.has(patientId)) {
            return null;
          }

          return {
            ...plan,
            id,
            patient_id: patientId,
          };
        })
        .filter(Boolean)
      : [];
    const validCarePlanIds = new Set(carePlans.map((plan) => toPositiveInt(plan.id)).filter(Boolean));
    const carePlanItems = Array.isArray(source.carePlanItems)
      ? source.carePlanItems
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const id = toPositiveInt(item.id);
          const carePlanId = toPositiveInt(item.care_plan_id);
          if (!id || !carePlanId || !validCarePlanIds.has(carePlanId)) {
            return null;
          }

          return {
            ...item,
            id,
            care_plan_id: carePlanId,
            sort_order: toPositiveInt(item.sort_order) || 1,
          };
        })
        .filter(Boolean)
      : [];
    const encounters = Array.isArray(source.encounters)
      ? source.encounters
        .map((encounter) => {
          if (!encounter || typeof encounter !== 'object') {
            return null;
          }

          const id = toPositiveInt(encounter.id);
          const patientId = toPositiveInt(encounter.patient_id);
          if (!id || !patientId || !validPatientIds.has(patientId)) {
            return null;
          }

          return {
            ...encounter,
            id,
            patient_id: patientId,
          };
        })
        .filter(Boolean)
      : [];
    const transitions = Array.isArray(source.transitions)
      ? source.transitions
        .map((transition) => {
          if (!transition || typeof transition !== 'object') {
            return null;
          }

          const id = toPositiveInt(transition.id);
          const patientId = toPositiveInt(transition.patient_id);
          if (!id || !patientId || !validPatientIds.has(patientId)) {
            return null;
          }

          return {
            ...transition,
            id,
            patient_id: patientId,
          };
        })
        .filter(Boolean)
      : [];

    return {
      version: MOCK_DB_VERSION,
      counters: {
        patients: getNextCounter(patients, source.counters && source.counters.patients || seed.counters.patients),
        carePlans: getNextCounter(carePlans, source.counters && source.counters.carePlans || seed.counters.carePlans),
        carePlanItems: getNextCounter(carePlanItems, source.counters && source.counters.carePlanItems || seed.counters.carePlanItems),
        encounters: getNextCounter(encounters, source.counters && source.counters.encounters || seed.counters.encounters),
        transitions: getNextCounter(transitions, source.counters && source.counters.transitions || seed.counters.transitions),
      },
      patients,
      carePlans,
      carePlanItems,
      encounters,
      transitions,
    };
  }

  function loadDatabase() {
    const raw = localStorage.getItem(MOCK_DB_KEY);
    if (!raw) {
      const seed = createMockDatabase();
      localStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
      return seed;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeStoredDatabase(parsed);
      localStorage.setItem(MOCK_DB_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
    }

    const seed = createMockDatabase();
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
    return seed;
  }

  function saveDatabase(db) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
    return db;
  }

  function getAgeLabel(birthDate) {
    const parsedBirthDate = parseDateInputValue(birthDate);
    if (!parsedBirthDate) {
      return '';
    }

    const today = new Date();
    let age = today.getFullYear() - parsedBirthDate.getFullYear();
    const monthDelta = today.getMonth() - parsedBirthDate.getMonth();
    const dayDelta = today.getDate() - parsedBirthDate.getDate();

    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      age -= 1;
    }

    return age >= 0 ? `${age} anos` : '';
  }

  function serializePatient(patient) {
    const normalizedStatus = String(patient.status || 'ativo').toLowerCase();
    const normalizedGender = String(patient.sex || '').toLowerCase();

    return {
      ...patient,
      id: toPositiveInt(patient.id),
      age_label: getAgeLabel(patient.birth_date),
      gender_label: MOCK_GENDER_LABELS[normalizedGender] || '',
      status_label: MOCK_STATUS_LABELS[normalizedStatus] || 'Ativo',
    };
  }

  function serializePatientOption(patient) {
    return {
      id: toPositiveInt(patient.id),
      full_name: patient.full_name || '',
      cpf: patient.cpf || '',
      ses: patient.ses || '',
    };
  }

  function getPatientById(db, patientId, allowDeleted) {
    return (db.patients || []).find((patient) => (
      toPositiveInt(patient.id) === toPositiveInt(patientId) &&
      (allowDeleted || !patient.deleted_at)
    )) || null;
  }

  function getPatientOptions(db) {
    return (db.patients || [])
      .filter((patient) => !patient.deleted_at)
      .slice()
      .sort((left, right) => String(left.full_name || '').localeCompare(String(right.full_name || ''), 'pt-BR'))
      .map(serializePatientOption);
  }

  function patientMatchesQuery(patient, query, includeContact) {
    if (!query) {
      return true;
    }

    const haystack = [
      patient.full_name,
      patient.cpf,
      patient.ses,
      includeContact ? patient.phone : '',
      includeContact ? patient.email : '',
    ].map(normalizeSearchValue).join(' ');

    return haystack.includes(query);
  }

  function listPatients(db, query, includeDeleted) {
    const normalizedQuery = normalizeSearchValue(query);
    return (db.patients || [])
      .filter((patient) => Boolean(patient.deleted_at) === Boolean(includeDeleted))
      .filter((patient) => patientMatchesQuery(patient, normalizedQuery, !includeDeleted))
      .slice()
      .sort((left, right) => {
        if (includeDeleted) {
          return String(right.deleted_at || '').localeCompare(String(left.deleted_at || ''));
        }

        return String(left.full_name || '').localeCompare(String(right.full_name || ''), 'pt-BR');
      })
      .map(serializePatient);
  }

  function serializeCarePlan(db, plan) {
    const patient = getPatientById(db, plan.patient_id, true);
    return {
      ...plan,
      id: toPositiveInt(plan.id),
      patient_id: toPositiveInt(plan.patient_id),
      full_name: patient ? patient.full_name : String(plan.full_name || '').trim(),
      cpf: patient ? patient.cpf : String(plan.cpf || '').trim(),
      ses: patient ? patient.ses : String(plan.ses || '').trim(),
    };
  }

  function serializeEncounter(db, encounter) {
    const patient = getPatientById(db, encounter.patient_id, true);
    return {
      ...encounter,
      id: toPositiveInt(encounter.id),
      patient_id: toPositiveInt(encounter.patient_id),
      full_name: patient ? patient.full_name : String(encounter.full_name || '').trim(),
      cpf: patient ? patient.cpf : String(encounter.cpf || '').trim(),
      ses: patient ? patient.ses : String(encounter.ses || '').trim(),
    };
  }

  function serializeTransition(db, transition) {
    const patient = getPatientById(db, transition.patient_id, true);
    return {
      ...transition,
      id: toPositiveInt(transition.id),
      patient_id: toPositiveInt(transition.patient_id),
      full_name: patient ? patient.full_name : String(transition.full_name || '').trim(),
      cpf: patient ? patient.cpf : String(transition.cpf || '').trim(),
      ses: patient ? patient.ses : String(transition.ses || '').trim(),
    };
  }

  function listCarePlans(db, query, patientId, includeDeleted) {
    const normalizedQuery = normalizeSearchValue(query);
    const selectedPatientId = toPositiveInt(patientId);

    return (db.carePlans || [])
      .filter((plan) => Boolean(plan.deleted_at) === Boolean(includeDeleted))
      .filter((plan) => !selectedPatientId || toPositiveInt(plan.patient_id) === selectedPatientId)
      .filter((plan) => {
        const patient = getPatientById(db, plan.patient_id, false);
        if (!patient) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          patient.full_name,
          patient.cpf,
          patient.ses,
        ].map(normalizeSearchValue).join(' ');

        return haystack.includes(normalizedQuery);
      })
      .slice()
      .sort((left, right) => {
        if (includeDeleted) {
          return String(right.deleted_at || '').localeCompare(String(left.deleted_at || ''));
        }

        return toPositiveInt(right.id) - toPositiveInt(left.id);
      })
      .map((plan) => serializeCarePlan(db, plan));
  }

  function listEncounters(db, query, includeDeleted) {
    const normalizedQuery = normalizeSearchValue(query);

    return (db.encounters || [])
      .filter((encounter) => Boolean(encounter.deleted_at) === Boolean(includeDeleted))
      .filter((encounter) => {
        const patient = getPatientById(db, encounter.patient_id, false);
        if (!patient) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          patient.full_name,
          patient.cpf,
          patient.ses,
          encounter.specialty,
        ].map(normalizeSearchValue).join(' ');

        return haystack.includes(normalizedQuery);
      })
      .slice()
      .sort((left, right) => {
        if (includeDeleted) {
          return String(right.deleted_at || '').localeCompare(String(left.deleted_at || ''));
        }

        if (String(left.encounter_date || '') === String(right.encounter_date || '')) {
          return toPositiveInt(right.id) - toPositiveInt(left.id);
        }

        return String(right.encounter_date || '').localeCompare(String(left.encounter_date || ''));
      })
      .map((encounter) => serializeEncounter(db, encounter));
  }

  function listTransitions(db, query, includeDeleted) {
    const normalizedQuery = normalizeSearchValue(query);

    return (db.transitions || [])
      .filter((transition) => Boolean(transition.deleted_at) === Boolean(includeDeleted))
      .filter((transition) => {
        const patient = getPatientById(db, transition.patient_id, false);
        if (!patient) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          patient.full_name,
          patient.cpf,
          patient.ses,
          transition.status,
          transition.from_service,
          transition.to_service,
        ].map(normalizeSearchValue).join(' ');

        return haystack.includes(normalizedQuery);
      })
      .slice()
      .sort((left, right) => {
        if (includeDeleted) {
          return String(right.deleted_at || '').localeCompare(String(left.deleted_at || ''));
        }

        if (String(left.transition_date || '') === String(right.transition_date || '')) {
          return toPositiveInt(right.id) - toPositiveInt(left.id);
        }

        return String(right.transition_date || '').localeCompare(String(left.transition_date || ''));
      })
      .map((transition) => serializeTransition(db, transition));
  }

  function getDefaultPatientRow() {
    return {
      first_cadh_date: todayDateInputValue(),
      full_name: '',
      ses: '',
      cpf: '',
      birth_date: '',
      sex: '',
      race: '',
      responsible_name: '',
      phone: '',
      address: '',
      email: '',
      emergency_contact: '',
      health_insurance: '',
      blood_type: '',
      allergies: '',
      chronic_conditions: '',
      status: 'ativo',
      ubs_ref: '',
      team_ref: '',
    };
  }

  function getPatientFormContext(db, patientId) {
    const id = toPositiveInt(patientId);
    if (!id) {
      return {
        editing: false,
        row: getDefaultPatientRow(),
        options: deepClone(MOCK_PATIENT_OPTIONS),
      };
    }

    const patient = getPatientById(db, id, false);
    if (!patient) {
      throw createError('Paciente nao encontrado.', 404);
    }

    return {
      editing: true,
      row: {
        ...getDefaultPatientRow(),
        ...deepClone(patient),
      },
      options: deepClone(MOCK_PATIENT_OPTIONS),
    };
  }

  function getDefaultCarePlan(patientId) {
    return {
      patient_id: patientId || '',
      start_date: '',
      end_date: '',
      interventions: '',
    };
  }

  function getCarePlanFormContext(db, carePlanId, patientId) {
    const id = toPositiveInt(carePlanId);
    const prefPatientId = toPositiveInt(patientId);

    if (!id) {
      return {
        editing: false,
        plan: getDefaultCarePlan(prefPatientId),
        items: [],
        patients: getPatientOptions(db),
      };
    }

    const plan = (db.carePlans || []).find((item) => toPositiveInt(item.id) === id && !item.deleted_at);
    if (!plan) {
      throw createError('Plano nao encontrado.', 404);
    }

    return {
      editing: true,
      plan: deepClone(plan),
      items: (db.carePlanItems || [])
        .filter((item) => toPositiveInt(item.care_plan_id) === id)
        .slice()
        .sort((left, right) => toPositiveInt(left.sort_order) - toPositiveInt(right.sort_order))
        .map((item) => deepClone(item)),
      patients: getPatientOptions(db),
    };
  }

  function getDefaultEncounter(patientId) {
    return {
      patient_id: patientId || '',
      encounter_date: todayDateInputValue(),
      specialty: '',
      summary: '',
    };
  }

  function getEncounterFormContext(db, encounterId, patientId) {
    const id = toPositiveInt(encounterId);
    const prefPatientId = toPositiveInt(patientId);

    if (!id) {
      return {
        editing: false,
        row: getDefaultEncounter(prefPatientId),
        patients: getPatientOptions(db),
      };
    }

    const encounter = (db.encounters || []).find((item) => toPositiveInt(item.id) === id && !item.deleted_at);
    if (!encounter) {
      throw createError('Atendimento nao encontrado.', 404);
    }

    return {
      editing: true,
      row: deepClone(encounter),
      patients: getPatientOptions(db),
    };
  }

  function getDefaultTransition(patientId) {
    return {
      patient_id: patientId || '',
      transition_date: todayDateInputValue(),
      from_service: '',
      to_service: '',
      status: 'pendente',
      notes: '',
    };
  }

  function getTransitionFormContext(db, transitionId, patientId) {
    const id = toPositiveInt(transitionId);
    const prefPatientId = toPositiveInt(patientId);

    if (!id) {
      return {
        editing: false,
        row: getDefaultTransition(prefPatientId),
        patients: getPatientOptions(db),
        statuses: MOCK_TRANSITION_STATUSES.slice(),
      };
    }

    const transition = (db.transitions || []).find((item) => toPositiveInt(item.id) === id && !item.deleted_at);
    if (!transition) {
      throw createError('Transicao nao encontrada.', 404);
    }

    return {
      editing: true,
      row: deepClone(transition),
      patients: getPatientOptions(db),
      statuses: MOCK_TRANSITION_STATUSES.slice(),
    };
  }

  function ensurePatientExists(db, patientId) {
    const patient = getPatientById(db, patientId, false);
    if (!patient) {
      throw createError('Paciente nao encontrado.', 404);
    }
    return patient;
  }

  function buildPatientFromPayload(payload) {
    return {
      first_cadh_date: String(payload.attendance_date ?? payload.first_cadh_date ?? '').trim(),
      full_name: normalizeSingleLine(payload.full_name),
      ses: String(payload.ses ?? '').trim(),
      cpf: String(payload.cpf ?? '').trim(),
      birth_date: String(payload.birth_date ?? '').trim(),
      sex: String(payload.gender ?? payload.sex ?? '').trim().toLowerCase(),
      race: String(payload.race ?? '').trim().toLowerCase(),
      responsible_name: normalizeSingleLine(payload.responsible ?? payload.responsible_name),
      phone: String(payload.phone ?? '').trim(),
      address: normalizeSingleLine(payload.address),
      email: String(payload.email ?? '').trim(),
      emergency_contact: String(payload.emergency_contact ?? '').trim(),
      health_insurance: normalizeSingleLine(payload.health_insurance),
      blood_type: String(payload.blood_type ?? '').trim(),
      allergies: String(payload.allergies ?? '').trim(),
      chronic_conditions: String(payload.chronic_conditions ?? '').trim(),
      status: String(payload.status ?? 'ativo').trim().toLowerCase() || 'ativo',
      ubs_ref: normalizeSingleLine(payload.uds_reference ?? payload.ubs_ref),
      team_ref: normalizeSingleLine(payload.team_reference ?? payload.team_ref),
    };
  }

  function validatePatientPayload(payload) {
    const data = buildPatientFromPayload(payload || {});
    const requiredFields = [
      'first_cadh_date',
      'full_name',
      'ses',
      'cpf',
      'birth_date',
      'sex',
      'race',
      'responsible_name',
      'phone',
      'address',
      'email',
      'emergency_contact',
      'health_insurance',
      'blood_type',
      'allergies',
      'chronic_conditions',
      'ubs_ref',
      'team_ref',
    ];
    const errors = {};

    requiredFields.forEach((field) => {
      if (!String(data[field] ?? '').trim()) {
        errors[field] = 'Campo vazio. Preencha este campo.';
      }
    });

    if (data.email && !String(data.email).includes('@')) {
      errors.email = 'Informe um email valido.';
    }

    if (data.sex && !Object.prototype.hasOwnProperty.call(MOCK_GENDER_LABELS, data.sex)) {
      errors.sex = 'Selecione uma opcao valida para genero.';
    }

    if (data.race && !Object.prototype.hasOwnProperty.call(MOCK_PATIENT_OPTIONS.race_options, data.race)) {
      errors.race = 'Selecione uma opcao valida para cor/raca.';
    }

    if (data.status && !Object.prototype.hasOwnProperty.call(MOCK_STATUS_LABELS, data.status)) {
      errors.status = 'Selecione um status valido.';
    }

    if (data.blood_type && !MOCK_PATIENT_OPTIONS.blood_type_options.includes(data.blood_type)) {
      errors.blood_type = 'Selecione um tipo sanguineo valido.';
    }

    if (Object.keys(errors).length > 0) {
      throw createError('Revise os campos destacados e tente novamente.', 422, errors);
    }

    return data;
  }

  function savePatient(db, payload, patientId) {
    const data = validatePatientPayload(payload);
    const id = toPositiveInt(patientId);
    const now = formatDateTime(new Date());

    if (id) {
      const index = (db.patients || []).findIndex((patient) => toPositiveInt(patient.id) === id && !patient.deleted_at);
      if (index < 0) {
        throw createError('Paciente nao encontrado.', 404);
      }

      db.patients[index] = {
        ...db.patients[index],
        ...data,
        id,
        updated_at: now,
      };
    } else {
      db.patients.push({
        id: db.counters.patients++,
        ...data,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    saveDatabase(db);
    return getPatientFormContext(db, id || db.counters.patients - 1);
  }

  function buildCarePlanItems(payload, db, carePlanId) {
    const itemTypes = Array.isArray(payload.item_type) ? payload.item_type : [];
    const titles = Array.isArray(payload.title) ? payload.title : [];
    const situations = Array.isArray(payload.situation) ? payload.situation : [];
    const recommendations = Array.isArray(payload.recommendation) ? payload.recommendation : [];
    const difficulties = Array.isArray(payload.difficulty) ? payload.difficulty : [];
    const goals = Array.isArray(payload.goal) ? payload.goal : [];
    const sortOrders = Array.isArray(payload.sort_order) ? payload.sort_order : [];
    const items = [];

    itemTypes.forEach((itemType, index) => {
      const normalizedType = String(itemType || '').trim();
      const item = {
        id: db.counters.carePlanItems++,
        care_plan_id: carePlanId,
        item_type: normalizedType,
        title: String(titles[index] || '').trim(),
        situation: String(situations[index] || '').trim(),
        recommendation: String(recommendations[index] || '').trim(),
        difficulty: String(difficulties[index] || '').trim(),
        goal: String(goals[index] || '').trim(),
        sort_order: toPositiveInt(sortOrders[index]) || index + 1,
      };

      if (!normalizedType) {
        return;
      }

      if (!item.title && !item.situation && !item.recommendation && !item.difficulty && !item.goal) {
        return;
      }

      items.push(item);
    });

    return items;
  }

  function saveCarePlan(db, payload, carePlanId) {
    const patientId = toPositiveInt(payload.patient_id);
    if (!patientId) {
      throw createError('Paciente e data de inicio sao obrigatorios.', 422, {
        patient_id: 'Paciente obrigatorio.',
      });
    }

    ensurePatientExists(db, patientId);

    if (!String(payload.start_date || '').trim()) {
      throw createError('Paciente e data de inicio sao obrigatorios.', 422, {
        start_date: 'Data de inicio obrigatoria.',
      });
    }

    const now = formatDateTime(new Date());
    const id = toPositiveInt(carePlanId);

    if (id) {
      const index = (db.carePlans || []).findIndex((plan) => toPositiveInt(plan.id) === id && !plan.deleted_at);
      if (index < 0) {
        throw createError('Plano nao encontrado.', 404);
      }

      db.carePlans[index] = {
        ...db.carePlans[index],
        patient_id: patientId,
        start_date: String(payload.start_date || '').trim(),
        end_date: String(payload.end_date || '').trim() || null,
        interventions: String(payload.interventions || '').trim(),
        updated_at: now,
      };
    } else {
      db.carePlans.push({
        id: db.counters.carePlans++,
        patient_id: patientId,
        start_date: String(payload.start_date || '').trim(),
        end_date: String(payload.end_date || '').trim() || null,
        interventions: String(payload.interventions || '').trim(),
        deleted_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    const savedId = id || db.counters.carePlans - 1;
    db.carePlanItems = (db.carePlanItems || []).filter((item) => toPositiveInt(item.care_plan_id) !== savedId);
    db.carePlanItems.push(...buildCarePlanItems(payload || {}, db, savedId));
    saveDatabase(db);
    return getCarePlanFormContext(db, savedId, 0);
  }

  function saveEncounter(db, payload, encounterId) {
    const patientId = toPositiveInt(payload.patient_id);
    const encounterDate = String(payload.encounter_date || '').trim();
    const specialty = String(payload.specialty || '').trim();

    if (!patientId || !encounterDate || !specialty) {
      throw createError('Paciente, data e especialidade sao obrigatorios.', 422, {
        patient_id: patientId ? undefined : 'Paciente obrigatorio.',
        encounter_date: encounterDate ? undefined : 'Data obrigatoria.',
        specialty: specialty ? undefined : 'Especialidade obrigatoria.',
      });
    }

    ensurePatientExists(db, patientId);

    const now = formatDateTime(new Date());
    const id = toPositiveInt(encounterId);

    if (id) {
      const index = (db.encounters || []).findIndex((encounter) => toPositiveInt(encounter.id) === id && !encounter.deleted_at);
      if (index < 0) {
        throw createError('Atendimento nao encontrado.', 404);
      }

      db.encounters[index] = {
        ...db.encounters[index],
        patient_id: patientId,
        encounter_date: encounterDate,
        specialty,
        summary: String(payload.summary || '').trim(),
        updated_at: now,
      };
    } else {
      db.encounters.push({
        id: db.counters.encounters++,
        patient_id: patientId,
        encounter_date: encounterDate,
        specialty,
        summary: String(payload.summary || '').trim(),
        deleted_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    saveDatabase(db);
    return getEncounterFormContext(db, id || db.counters.encounters - 1, 0);
  }

  function saveTransition(db, payload, transitionId) {
    const patientId = toPositiveInt(payload.patient_id);
    const transitionDate = String(payload.transition_date || '').trim();
    const status = String(payload.status || '').trim() || 'pendente';

    if (!patientId || !transitionDate || !status) {
      throw createError('Paciente, data e status sao obrigatorios.', 422, {
        patient_id: patientId ? undefined : 'Paciente obrigatorio.',
        transition_date: transitionDate ? undefined : 'Data obrigatoria.',
        status: status ? undefined : 'Status obrigatorio.',
      });
    }

    if (!MOCK_TRANSITION_STATUSES.includes(status)) {
      throw createError('Paciente, data e status sao obrigatorios.', 422, {
        status: 'Status invalido.',
      });
    }

    ensurePatientExists(db, patientId);

    const now = formatDateTime(new Date());
    const id = toPositiveInt(transitionId);

    if (id) {
      const index = (db.transitions || []).findIndex((transition) => toPositiveInt(transition.id) === id && !transition.deleted_at);
      if (index < 0) {
        throw createError('Transicao nao encontrada.', 404);
      }

      db.transitions[index] = {
        ...db.transitions[index],
        patient_id: patientId,
        transition_date: transitionDate,
        from_service: String(payload.from_service || '').trim(),
        to_service: String(payload.to_service || '').trim(),
        status,
        notes: String(payload.notes || '').trim(),
        updated_at: now,
      };
    } else {
      db.transitions.push({
        id: db.counters.transitions++,
        patient_id: patientId,
        transition_date: transitionDate,
        from_service: String(payload.from_service || '').trim(),
        to_service: String(payload.to_service || '').trim(),
        status,
        notes: String(payload.notes || '').trim(),
        deleted_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    saveDatabase(db);
    return getTransitionFormContext(db, id || db.counters.transitions - 1, 0);
  }

  function setDeletedState(collection, id, deletedAt) {
    const index = collection.findIndex((item) => toPositiveInt(item.id) === id);
    if (index < 0) {
      return null;
    }

    collection[index] = {
      ...collection[index],
      deleted_at: deletedAt,
      updated_at: formatDateTime(new Date()),
    };

    return collection[index];
  }

  function handleAuth(pathname, method, body) {
    if (pathname === '/auth/login.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const email = String(body.email || '').trim();
      const password = String(body.password || '').trim();
      if (!email || !password) {
        throw createError('Informe email e senha para entrar.', 422);
      }

      return {
        user: createDemoUser({
          email,
          name: email.split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Equipe Demo Siselo',
        }),
        csrf: MOCK_CSRF_TOKEN,
      };
    }

    if (pathname === '/auth/me.php') {
      const user = getSession();
      if (!user) {
        throw createError('Sessao expirada.', 401);
      }

      return {
        user,
        csrf: getCsrfToken() || MOCK_CSRF_TOKEN,
      };
    }

    if (pathname === '/auth/logout.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      return { logged_out: true };
    }

    if (pathname === '/auth/change_password.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const user = getSession();
      if (!user) {
        throw createError('Sessao expirada.', 401);
      }

      const password = String(body.password || '');
      const passwordConfirm = String(body.password_confirm || '');
      if (password.length < 6) {
        throw createError('A nova senha deve ter pelo menos 6 caracteres.', 422);
      }

      if (password !== passwordConfirm) {
        throw createError('A confirmacao da senha nao confere.', 422);
      }

      return {
        user: {
          ...user,
          must_change_password: 0,
        },
        csrf: getCsrfToken() || MOCK_CSRF_TOKEN,
      };
    }

    throw createError('Rota mock nao implementada.', 404);
  }

  function handleEntity(pathname, method, body, url) {
    const db = loadDatabase();

    if (pathname === '/patients/list.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listPatients(db, url.searchParams.get('q') || '', false),
      };
    }

    if (pathname === '/patients/trash.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listPatients(db, url.searchParams.get('q') || '', true),
      };
    }

    if (pathname === '/patients/show.php') {
      const id = toPositiveInt(url.searchParams.get('id'));
      if (!id) {
        throw createError('Paciente invalido.', 422);
      }

      const patient = getPatientById(db, id, false);
      if (!patient) {
        throw createError('Paciente nao encontrado.', 404);
      }

      return {
        patient: serializePatient(patient),
        care_plans: listCarePlans(db, '', id, false),
        encounters: listEncounters(db, '', false).filter((row) => toPositiveInt(row.patient_id) === id),
        transitions: listTransitions(db, '', false).filter((row) => toPositiveInt(row.patient_id) === id),
      };
    }

    if (pathname === '/patients/form.php') {
      if (method === 'GET') {
        return getPatientFormContext(db, url.searchParams.get('id'));
      }

      if (method === 'POST') {
        return savePatient(db, body || {}, url.searchParams.get('id'));
      }
    }

    if (pathname === '/patients/soft_delete.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const patient = setDeletedState(db.patients || [], toPositiveInt(body.id), formatDateTime(new Date()));
      if (!patient) {
        throw createError('Paciente nao encontrado.', 404);
      }

      saveDatabase(db);
      return { patient: serializePatient(patient) };
    }

    if (pathname === '/patients/restore.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const patient = setDeletedState(db.patients || [], toPositiveInt(body.id), null);
      if (!patient) {
        throw createError('Paciente nao encontrado.', 404);
      }

      saveDatabase(db);
      return { patient: serializePatient(patient) };
    }

    if (pathname === '/care_plans/list.php') {
      return {
        q: url.searchParams.get('q') || '',
        patient_id: toPositiveInt(url.searchParams.get('patient_id')) || null,
        rows: listCarePlans(db, url.searchParams.get('q') || '', url.searchParams.get('patient_id'), false),
      };
    }

    if (pathname === '/care_plans/trash.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listCarePlans(db, url.searchParams.get('q') || '', 0, true),
      };
    }

    if (pathname === '/care_plans/form.php') {
      if (method === 'GET') {
        return getCarePlanFormContext(db, url.searchParams.get('id'), url.searchParams.get('patient_id'));
      }

      if (method === 'POST') {
        return saveCarePlan(db, body || {}, url.searchParams.get('id'));
      }
    }

    if (pathname === '/care_plans/soft_delete.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const plan = setDeletedState(db.carePlans || [], toPositiveInt(body.id), formatDateTime(new Date()));
      if (!plan) {
        throw createError('Plano nao encontrado.', 404);
      }

      saveDatabase(db);
      return { plan: serializeCarePlan(db, plan) };
    }

    if (pathname === '/care_plans/restore.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const plan = setDeletedState(db.carePlans || [], toPositiveInt(body.id), null);
      if (!plan) {
        throw createError('Plano nao encontrado.', 404);
      }

      saveDatabase(db);
      return { plan: serializeCarePlan(db, plan) };
    }

    if (pathname === '/encounters/list.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listEncounters(db, url.searchParams.get('q') || '', false),
      };
    }

    if (pathname === '/encounters/trash.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listEncounters(db, url.searchParams.get('q') || '', true),
      };
    }

    if (pathname === '/encounters/form.php') {
      if (method === 'GET') {
        return getEncounterFormContext(db, url.searchParams.get('id'), url.searchParams.get('patient_id'));
      }

      if (method === 'POST') {
        return saveEncounter(db, body || {}, url.searchParams.get('id'));
      }
    }

    if (pathname === '/encounters/soft_delete.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const encounter = setDeletedState(db.encounters || [], toPositiveInt(body.id), formatDateTime(new Date()));
      if (!encounter) {
        throw createError('Atendimento nao encontrado.', 404);
      }

      saveDatabase(db);
      return { encounter: serializeEncounter(db, encounter) };
    }

    if (pathname === '/encounters/restore.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const encounter = setDeletedState(db.encounters || [], toPositiveInt(body.id), null);
      if (!encounter) {
        throw createError('Atendimento nao encontrado.', 404);
      }

      saveDatabase(db);
      return { encounter: serializeEncounter(db, encounter) };
    }

    if (pathname === '/transitions/list.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listTransitions(db, url.searchParams.get('q') || '', false),
      };
    }

    if (pathname === '/transitions/trash.php') {
      return {
        q: url.searchParams.get('q') || '',
        rows: listTransitions(db, url.searchParams.get('q') || '', true),
      };
    }

    if (pathname === '/transitions/form.php') {
      if (method === 'GET') {
        return getTransitionFormContext(db, url.searchParams.get('id'), url.searchParams.get('patient_id'));
      }

      if (method === 'POST') {
        return saveTransition(db, body || {}, url.searchParams.get('id'));
      }
    }

    if (pathname === '/transitions/soft_delete.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const transition = setDeletedState(db.transitions || [], toPositiveInt(body.id), formatDateTime(new Date()));
      if (!transition) {
        throw createError('Transicao nao encontrada.', 404);
      }

      saveDatabase(db);
      return { transition: serializeTransition(db, transition) };
    }

    if (pathname === '/transitions/restore.php') {
      if (method !== 'POST') {
        throw createError('Metodo nao permitido.', 405);
      }

      const transition = setDeletedState(db.transitions || [], toPositiveInt(body.id), null);
      if (!transition) {
        throw createError('Transicao nao encontrada.', 404);
      }

      saveDatabase(db);
      return { transition: serializeTransition(db, transition) };
    }

    throw createError('Rota mock nao implementada.', 404);
  }

  async function handle(path, options) {
    const url = getUrl(path);
    const pathname = url.pathname;
    const method = String((options && options.method) || 'GET').toUpperCase();
    const body = (options && options.body) || {};

    if (pathname.startsWith('/auth/')) {
      return handleAuth(pathname, method, body);
    }

    return handleEntity(pathname, method, body, url);
  }

  window.SISELO_MOCK_API = {
    enabled: CONFIG.useMockData === true,
    supports,
    handle,
  };
})();
