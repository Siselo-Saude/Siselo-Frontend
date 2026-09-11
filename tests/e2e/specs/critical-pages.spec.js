const {
  TEST_PATIENT,
  expect,
  expectNoDocumentHorizontalOverflow,
  test,
} = require('../fixtures/siselo');

test.describe('baseline responsivo das páginas críticas', () => {
  test('login envia as credenciais e abre a página inicial', async ({ page }) => {
    await page.goto('/login.html');

    await expect(page.getByRole('heading', { name: 'Entrar no SISELO' })).toBeVisible();
    await expect(page.locator('#login-form')).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    const loginRequest = page.waitForRequest((request) => (
      request.url().endsWith('/api/auth/login.php') && request.method() === 'POST'
    ));

    await page.locator('#login-email').fill('admin@example.test');
    await page.locator('#login-password').fill('senha-exclusiva-de-teste');
    await page.locator('#login-form').getByRole('button', { name: 'Entrar' }).click();

    const request = await loginRequest;
    expect(request.postDataJSON()).toEqual({
      email: 'admin@example.test',
      password: 'senha-exclusiva-de-teste',
    });
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'home');
    await expect(page.getByRole('heading', { name: 'Visão clínica de hoje' })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('página inicial preserva shell, métricas e navegação principal', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('body')).toHaveAttribute('data-page', 'home');
    await expect(page.getByRole('heading', { name: 'Visão clínica de hoje' })).toBeVisible();
    await expect(page.locator('#nav-home')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.clinical-home-metrics')).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('navegação principal mantém os destinos Home e CADH', async ({ page }, testInfo) => {
    test.fail(
      testInfo.project.name === 'chromium-768px',
      'Débito conhecido: a subnavegação CADH permanece invisível em 768px.',
    );

    await page.goto('/index.html');
    await expect(page.locator('#nav-cadh')).toBeVisible();
    await page.locator('#nav-cadh').click();
    const receivedLink = page.locator('#siselo-module-subnav-cadh a[href="/cadh/index.html?flow=received"]');
    await expect(receivedLink).toBeVisible();
    await receivedLink.click();

    await expect(page).toHaveURL(/\/cadh\/index\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'cadh');
    await expect(page.locator('#nav-cadh')).toHaveAttribute('aria-current', 'page');
    await expectNoDocumentHorizontalOverflow(page);

    await page.locator('#nav-home').click();
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('#nav-home')).toHaveAttribute('aria-current', 'page');
  });

  test('CADH carrega o fluxo e a área de gestão', async ({ page }) => {
    await page.goto('/cadh/index.html');

    await expect(page.locator('body')).toHaveAttribute('data-page', 'cadh');
    await expect(page.getByRole('heading', {
      name: 'CADH — Centro de Atenção ao Diabetes e Hipertensão',
    })).toBeVisible();
    await expect(page.locator('#cadh-flow-panel')).toBeVisible();
    await expect(page.locator('#cadh-patient-detail')).toContainText('Nenhum paciente selecionado');
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('lista de pacientes renderiza dados e ações sem overflow no documento', async ({ page }) => {
    await page.goto('/patients/list.html');

    await expect(page.locator('body')).toHaveAttribute('data-page', 'patients-list');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await expect(page.locator('#patients-table-body')).toContainText(TEST_PATIENT.full_name);
    await expect(page.locator('#patients-table-body')).toContainText(TEST_PATIENT.cpf);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('plano de cuidado abre com paciente conhecido e formulário renderizado', async ({ page }) => {
    await page.goto(`/care-plans/form.html?patient_id=${TEST_PATIENT.id}`);

    await expect(page.locator('body')).toHaveAttribute('data-page', 'care-plans-form');
    await expect(page.getByRole('heading', { name: 'Ficha Plano de Cuidado' })).toBeVisible();
    await expect(page.locator('#care-plan-form-body')).toContainText(TEST_PATIENT.full_name);
    await expect(page.locator('#care-plan-form-body')).toContainText('Plano de cuidados');
  });

  test('plano de cuidado não causa overflow horizontal no documento', async ({ page }) => {
    const viewportWidth = page.viewportSize().width;
    test.fail(
      viewportWidth <= 600,
      'Débito conhecido: o plano de cuidado excede o documento em 360, 390 e 600px.',
    );

    await page.goto(`/care-plans/form.html?patient_id=${TEST_PATIENT.id}`);
    await expect(page.locator('#care-plan-form-body')).toContainText('Plano de cuidados');
    await expectNoDocumentHorizontalOverflow(page);
  });
});
