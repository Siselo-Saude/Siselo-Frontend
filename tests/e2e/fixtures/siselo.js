const { test: base, expect } = require('@playwright/test');

const TEST_USER = Object.freeze({
  id: 1,
  name: 'Administrador de Teste',
  email: 'admin@example.test',
  user_type: 'CADH',
  specialty: 'Gestão do Cuidado',
  roles: ['admin'],
  permissions: [
    'admin.manage',
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
    'careflow.view',
    'careflow.update',
  ],
});

const TEST_PATIENT = Object.freeze({
  id: 101,
  full_name: 'Paciente de Teste com Nome Extenso',
  social_name: '',
  cpf: '000.000.000-00',
  ses: 'SES-TESTE-101',
  birth_date: '1968-05-12',
  age_label: '58 anos',
  first_cadh_date: '2025-01-10',
  phone: '(61) 99999-0000',
  email: 'paciente@example.test',
  address: 'Endereço fictício usado exclusivamente pelos testes',
  responsible_name: 'Responsável de Teste',
  emergency_contact: 'Contato de Teste',
  ubs_ref: 'UBS 01 TESTE',
  team_ref: 'ESF EQUIPE DE TESTE COM NOME EXTENSO',
  status: 'ativo',
  care_status: 'recebido',
  risk_classification: 'muito_alto_risco',
});

function success(data) {
  return JSON.stringify({ success: true, data });
}

function mockedData(url) {
  const path = url.pathname;

  if (path === '/api/auth/login.php' || path === '/api/auth/me.php') {
    return { user: TEST_USER, csrf: 'csrf-exclusive-for-tests' };
  }

  if (path === '/api/care_flow/list.php') {
    if (url.searchParams.get('care_status') === 'finalizado') {
      return { rows: [] };
    }

    return {
      rows: [
        {
          id: 501,
          appointment_id: 501,
          patient_id: TEST_PATIENT.id,
          ...TEST_PATIENT,
          scheduled_at: '2026-09-11 09:00:00',
          appointment_status: 'aguardando',
          specialty: 'Cardiologia',
          from_service: 'UBS',
          to_service: 'CADH',
        },
      ],
      options: {
        appointment_outcome_reasons: {},
      },
    };
  }

  if (path === '/api/patients/list.php') {
    return { rows: [TEST_PATIENT] };
  }

  if (path === '/api/patients/show.php') {
    return {
      patient: TEST_PATIENT,
      care_plans: [],
      encounters: [],
      transitions: [],
    };
  }

  if (path === '/api/care_plans/form.php') {
    return {
      plan: { patient_id: TEST_PATIENT.id },
      items: [],
      patients: [TEST_PATIENT],
    };
  }

  return null;
}

async function installBrowserMocks(page, unexpectedRequests) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }));
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

  await page.route('http://localhost:8086/api/**', async (route) => {
    const request = route.request();
    const origin = request.headers().origin || 'http://127.0.0.1:3000';
    const corsHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'Content-Type, X-CSRF-Token',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-origin': origin,
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }

    const url = new URL(request.url());
    const data = mockedData(url);
    if (data === null) {
      unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({
        status: 501,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Endpoint sem fixture de teste.' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: success(data),
    });
  });
}

const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors = [];
    const unexpectedRequests = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await installBrowserMocks(page, unexpectedRequests);

    await use(page);

    expect(pageErrors, 'Erros JavaScript não tratados na página').toEqual([]);
    expect(unexpectedRequests, 'Chamadas de API sem fixture explícita').toEqual([]);
  },
});

async function expectNoDocumentHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `Overflow horizontal: scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

module.exports = {
  TEST_PATIENT,
  TEST_USER,
  expect,
  expectNoDocumentHorizontalOverflow,
  test,
};

