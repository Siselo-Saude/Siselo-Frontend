# Acompanhamento da refatoração responsiva

Última atualização: 11 de setembro de 2026.

Este documento é a fonte de acompanhamento operacional da refatoração. O plano técnico completo permanece em [responsive-refactor-plan.md](responsive-refactor-plan.md), e as regras permanentes do repositório permanecem em [AGENTS.md](../AGENTS.md).

Se houver divergência entre este documento e o código ou os testes, o estado real do código e dos testes prevalece.

## 1. Estado geral

- **Objetivo resumido:** evoluir incrementalmente o `Siselo-Frontend` para ser a interface oficial do SISELO, criando uma arquitetura responsiva previsível e reutilizável sem reescrita completa, alteração indevida de regras de negócio ou quebra de contratos com o backend.
- **Última fase concluída:** baseline e proteção contra regressões, chamada de **Fase 1** na execução autorizada e equivalente à **Fase 0 — Rede de segurança** na nomenclatura do plano aprovado.
- **Próxima fase planejada:** **Fase 1A — Conter o problema do runtime clínico**, exatamente como definida no plano aprovado.
- **Status geral:** baseline inicial concluído; nenhuma fase de refatoração do código de produção foi iniciada.
- **Estado do Git no encerramento:** os arquivos desta iniciativa ainda estão não rastreados. O `HEAD` observado é `20a9788`, e não existe commit da refatoração. Outra máquina somente receberá este trabalho depois que as alterações forem revisadas e registradas no Git pelo fluxo autorizado do projeto.

### Convenção de numeração

O plano aprovado chama a rede de segurança de **Fase 0**. A solicitação que autorizou sua implementação chamou o mesmo escopo de **Fase 1: baseline e proteção contra regressões**. Para evitar avanço indevido, o checklist abaixo preserva a nomenclatura canônica do plano. Assim:

- a Fase 1 operacional concluída corresponde à Fase 0 do plano;
- a próxima fase canônica é a Fase 1A;
- a Fase 2 e todas as posteriores continuam não iniciadas.

## 2. Checklist das fases

| Fase | Objetivo resumido | Status |
|---|---|---|
| Diagnóstico e planejamento, etapa preparatória | Mapear runtime, arquitetura, riscos, rotas, dependências e ordem incremental de implementação. | CONCLUÍDA |
| Fase 0 — Rede de segurança | Criar testes de caracterização e um baseline responsivo antes de mudanças estruturais. Foi executada sob o nome operacional “Fase 1”. | CONCLUÍDA |
| Fase 1A — Conter o problema do runtime clínico | Garantir um único controlador executável por especialidade e preservar as regras clínicas existentes, sem modificar APIs. | NÃO INICIADA |
| Fase 1B — Definir persistência de dados clínicos | Eliminar a dependência insegura de dados clínicos apenas no navegador, mediante autorização explícita para backend e contratos. | NÃO INICIADA |
| Fase 2 — Tokens, breakpoints e primitivas | Criar camadas de tokens, fundamentos, containers e grids com os breakpoints globais oficiais. | NÃO INICIADA |
| Fase 3 — AppShell único, começando por administração | Consolidar header, sidebar, drawer mobile, container e navegação no runtime estático. | NÃO INICIADA |
| Fase 4 — Tabelas por família | Substituir a conversão global de tabelas por estratégias responsivas definidas para cada família. | NÃO INICIADA |
| Fase 5 — Formulários, cards e modais reutilizáveis | Consolidar padrões de campos, grids, cards, feedback, estados vazios e modais acessíveis. | NÃO INICIADA |
| Fase 6 — Dashboards e shells especiais | Migrar Home, CADH, UBS, histórico e plano de cuidado para padrões compartilhados. | NÃO INICIADA |
| Fase 7 — Migração visual das páginas clínicas | Aplicar os padrões consolidados às especialidades e ao gestor, preservando paridade clínica. | NÃO INICIADA |
| Fase 8 — Redução controlada do legado | Remover somente regras e scripts comprovadamente sem uso após cobertura e migração. | NÃO INICIADA |
| Fase 9 — Avaliação das páginas PHP legadas | Confirmar se a UI PHP pode ser arquivada ou removida sem afetar instalações, redirects, ações ou PDF. | NÃO INICIADA |

A Fase 0 é considerada concluída dentro do escopo incremental autorizado: rotas críticas representativas, larguras solicitadas, CI e overflow possuem cobertura inicial. A matriz completa de papéis, integração real com APIs, limites adicionais de breakpoint, zoom e todas as rotas permanecem como extensões documentadas da rede de segurança, sem invalidar o baseline entregue.

## 3. Registro da Fase 1

### Implementação realizada

- Playwright `1.63.0` isolado em `tests/e2e`;
- Chromium como navegador inicial;
- frontend iniciado automaticamente com `node server.js`;
- fixtures fictícias e estritas para APIs;
- cobertura de login, home, navegação, CADH, pacientes e plano de cuidado;
- viewports de `360px`, `390px`, `600px`, `768px`, `960px`, `1280px` e `1440px`;
- detecção automática de overflow horizontal do documento;
- detecção de erros JavaScript não tratados;
- workflow dedicado de CI.

As fixtures interceptam somente a API configurada para os testes. Uma chamada a endpoint sem fixture explícita recebe erro e também é registrada para fazer o teste falhar. Os dados usados são fictícios e não exigem credenciais, banco ou alterações no backend.

### Resultado atual

Comando de referência, executado a partir da raiz do `Siselo-Frontend`:

```bash
npm --prefix tests/e2e test
```

Resultado final observado:

- **49 testes aceitos pelo Playwright**, com código de saída `0`;
- **45 aprovações diretas**;
- **4 falhas esperadas e preexistentes**:
  - overflow no plano de cuidado em `360px`;
  - overflow no plano de cuidado em `390px`;
  - overflow no plano de cuidado em `600px`;
  - subnavegação CADH invisível em `768px`.

Esses quatro problemas **não foram introduzidos pela Fase 1** e **não foram corrigidos nela**. As asserções continuam executando e foram marcadas com `test.fail` somente nas larguras afetadas. Quando o comportamento for corrigido, o Playwright deverá acusar aprovação inesperada até que a marcação da dívida conhecida seja removida conscientemente.

Nenhum cenário da suíte criada ficou sem execução. O runner considerou o conjunto aprovado porque as quatro falhas conhecidas correspondem exatamente às expectativas registradas.

## 4. Limitações atuais

- Apenas Chromium está coberto.
- A integração real com `Siselo-Users` e o backend PHP ainda não foi testada.
- A suíte utiliza fixtures e mocks de API; ela não valida sessão PHP, cookies, CORS real, banco de dados ou permissões persistidas.
- Playwright requer Node.js 20 ou superior.
- O workflow de CI utiliza Node.js 22.
- Ainda não existe regressão visual baseada em snapshots aprovados.
- Ainda não existem testes de zoom.
- Ainda não existe cobertura de todas as rotas.
- A matriz completa de papéis e permissões ainda não está coberta.
- Os limites adicionais `599/600px`, `959/960px` e `1263/1264px` ainda não possuem projetos dedicados; apenas `600px` e `960px` fazem parte do baseline atual.
- Os problemas responsivos e funcionais das páginas clínicas continuam pendentes.
- O CSS legado, incluindo `app.css`, continua intacto.
- React, páginas PHP, sidebar, header, componentes, tabelas e formulários de produção não foram alterados.

## 5. Arquivos da Fase 1

Arquivos criados na implementação do baseline:

- [.github/workflows/e2e.yml](../.github/workflows/e2e.yml);
- [tests/e2e/.gitignore](../tests/e2e/.gitignore);
- [tests/e2e/README.md](../tests/e2e/README.md);
- [tests/e2e/package.json](../tests/e2e/package.json);
- [tests/e2e/package-lock.json](../tests/e2e/package-lock.json);
- [tests/e2e/playwright.config.js](../tests/e2e/playwright.config.js);
- [tests/e2e/fixtures/siselo.js](../tests/e2e/fixtures/siselo.js);
- [tests/e2e/specs/critical-pages.spec.js](../tests/e2e/specs/critical-pages.spec.js).

Arquivo criado no encerramento formal, fora da implementação técnica da fase:

- `docs/responsive-refactor-status.md` — este documento.

Não houve alteração em código de produção. `AGENTS.md` e `docs/responsive-refactor-plan.md` já existiam antes da implementação da suíte e foram preservados.

## 6. Decisões importantes

- Os testes E2E permanecem isolados em `tests/e2e`.
- O runtime Node 16 da aplicação não deve ser alterado apenas por causa do Playwright. A suíte usa Node 20+ de forma independente, e o CI está fixado em Node 22.
- Fixtures desconhecidas devem continuar falhando explicitamente. Não adicionar resposta genérica de sucesso para endpoints não caracterizados.
- Problemas preexistentes podem e devem ser registrados pelo baseline, mas não devem ser mascarados como regressões novas.
- Uma falha esperada deve ser restrita ao cenário e à largura comprovadamente afetados. Não ampliar `test.fail` para ocultar outras asserções.
- O código de produção não foi alterado nesta fase.
- Os mocks protegem o comportamento do frontend, mas não substituem testes futuros de integração com o backend real.
- O runtime efetivo continua sendo HTML, CSS e JavaScript clássico. React não faz parte desta fase nem deve ser ativado implicitamente.
- URLs, query parameters, regras de negócio, APIs e contratos backend devem permanecer estáveis sem autorização explícita.
- A nomenclatura canônica para continuidade deve ser a de `responsive-refactor-plan.md`; portanto, a próxima fase é a Fase 1A, não a Fase 2.

## 7. Próxima fase

### Fase 1A — Conter o problema do runtime clínico

**Objetivo:** garantir um único controlador executável por especialidade e preservar todas as regras clínicas já existentes, sem modificar APIs.

**Pré-requisitos:**

- baseline E2E da Fase 0 disponível e executável;
- leitura das regras, do plano e deste status;
- confirmação do comportamento real de carregamento dos controladores clínicos;
- validação funcional das regras com responsáveis do domínio;
- testes específicos de caracterização preparados antes de modificar o fluxo clínico.

**Arquivos provavelmente envolvidos:**

- `assets/cadh-specialty-pages.js`;
- os dez arquivos `assets/cadh-<especialidade>.js`;
- os dez HTMLs clínicos em `cadh/`;
- testes clínicos adicionais em `tests/e2e`.

**Critérios de aceite:**

- nenhum módulo de especialidade carregado permanece inerte;
- cada regra clínica específica relevante possui teste;
- formulários e nomes de campos permanecem compatíveis;
- persistência corrente permanece compatível durante esta fase;
- nenhuma API ou contrato backend é modificado.

**Riscos conhecidos:**

- alteração involuntária de validações clínicas;
- execução duplicada de controladores ou listeners;
- quebra da extração de campos a partir dos HTMLs existentes;
- incompatibilidade com registros mantidos em `localStorage`;
- divergência do histórico, que também depende dos HTMLs clínicos;
- impacto em segurança do paciente caso regras específicas sejam omitidas.

Esta fase está **NÃO INICIADA**. A Fase 1B, a Fase 2 e todas as posteriores também permanecem não iniciadas.

## 8. Instruções para retomada

Antes de qualquer alteração, uma futura sessão do Codex deve:

1. ler `AGENTS.md`;
2. ler `docs/responsive-refactor-plan.md`;
3. ler `docs/responsive-refactor-status.md`;
4. verificar `git status`;
5. consultar os commits recentes da refatoração;
6. executar ou validar os testes existentes;
7. comparar o estado documentado com o código real;
8. executar somente uma fase por vez.

Se houver divergência entre este documento e o código ou os testes, o estado real do código e dos testes deve prevalecer.

Como os artefatos estão não rastreados no estado atual, a retomada em outra máquina depende de eles terem sido incluídos em um commit ou transferidos por outro mecanismo autorizado. A sessão futura não deve presumir que a ausência desses arquivos significa que a fase nunca foi executada; deve verificar histórico, branch e estado remoto antes de recriar qualquer coisa.
