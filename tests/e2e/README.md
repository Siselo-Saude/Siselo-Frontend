# Testes E2E de baseline responsivo

Esta suíte protege o comportamento atual das páginas críticas antes da refatoração de responsividade. Ela não altera nem depende de dados reais.

## Cobertura inicial

- login e redirecionamento autenticado;
- página inicial e métricas;
- navegação entre Home e CADH;
- dashboard CADH;
- lista de pacientes;
- formulário de plano de cuidado;
- ausência de overflow horizontal do documento;
- larguras de 360, 390, 600, 768, 960, 1280 e 1440px.

Os sete cenários são executados em todas as sete larguras, totalizando 49 testes.

O overflow já existente no plano de cuidado em 360, 390 e 600px e a subnavegação CADH invisível em 768px estão registrados como falhas esperadas. As asserções continuam ativas: quando os problemas forem corrigidos, o Playwright sinalizará que as expectativas de falha precisam ser removidas.

## Isolamento do backend

As respostas da API são interceptadas pelo Playwright e usam fixtures inteiramente fictícias. Endpoints sem fixture explícita fazem o teste falhar. Isso permite testar rotas autenticadas sem credenciais, banco ou mudanças no código de produção.

Esses testes não substituem os futuros testes de integração com o `Siselo-Users`. Login real, sessão PHP, CORS real, permissões persistidas e dados do banco continuam fora desta cobertura inicial.

## Execução

Use Node.js 20 ou superior. A dependência fica isolada neste diretório e não altera o runtime Node 16 usado pelo container do frontend.

Na raiz do `Siselo-Frontend`:

```bash
npm --prefix tests/e2e ci
npm --prefix tests/e2e run install:browsers
npm --prefix tests/e2e test
```

No PowerShell com política de scripts restrita, use `npm.cmd` e `npx.cmd`.

O Playwright inicia automaticamente o frontend com `node server.js`. Para usar um servidor já disponível em outro endereço:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm --prefix tests/e2e test
```
