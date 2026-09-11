# Diagnóstico técnico — Siselo-Frontend e Siselo-Users

## Resumo executivo

O sistema em produção não usa React. O frontend real é uma aplicação multipágina composta por HTML estático, CSS global e JavaScript clássico, servida por um servidor Node sem transpilações. Os 56 arquivos JSX em `src/` não possuem entrypoint, dependências, bundle, referência nos HTMLs ou processamento no servidor; portanto, estão fora do runtime.

Os principais riscos são:

1. Os módulos JavaScript específicos das dez especialidades clínicas ficam inativos no carregamento normal, porque o controlador compartilhado altera `data-page` antes de seus listeners executarem.
2. Registros clínicos detalhados e acompanhamentos UBS são persistidos em `localStorage`, fora do backend e sem limpeza identificada no logout.
3. O `app.css` tornou-se uma pilha global de correções conflitantes: 22.630 linhas, aproximadamente 1.530 usos de `!important`, 76 media queries e 23 thresholds diferentes.
4. Existem três padrões de shell autenticado, com comportamentos móveis distintos e sem um drawer acessível comum.
5. A responsividade das tabelas é global e automática, convertendo indiscriminadamente tabelas em blocos/cards e, em outros pontos, apenas ocultando overflow.
6. Não existe infraestrutura automatizada de testes funcionais, visuais, responsivos ou PHP.

A migração deve continuar sobre o runtime estático atual. Ativar React seria uma decisão arquitetural separada e não uma consequência desta refatoração incremental.

## Estado e limites da análise

Foram lidos os arquivos [AGENTS.md do Frontend](../AGENTS.md) e [AGENTS.md do Users](../../Siselo-Users/AGENTS.md). O primeiro contém as regras arquiteturais aplicáveis; o segundo está vazio.

Durante a etapa de diagnóstico, nenhum arquivo de produção foi alterado.

Foram verificados com `node --check` os 25 JavaScripts fora de `src/`: nenhum erro sintático. O host não possuía PHP instalado, portanto não foi possível executar `php -l`.

## 1. Arquitetura atual

### Siselo-Frontend

| Área | Implementação efetiva |
|---|---|
| Runtime | HTML, CSS e JavaScript clássico, com APIs Fetch e globais em `window.SISELO`. |
| Servidor | [server.js](../server.js) usa apenas `node:http`, `fs` e `path`; `/` aponta para `/login.html`. |
| Build | Não há `package.json`, bundler, transpiler, Tailwind, framework ou etapa de compilação. |
| CSS | Todas as 33 páginas HTML carregam [assets/app.css](../assets/app.css). |
| Estado | Sessão e navegação usam cookies/API, `sessionStorage`, query strings e, em fluxos clínicos, `localStorage`. |
| Rotas | Rotas físicas `.html`; não há roteador de SPA. Estados internos são controlados por query parameters. |
| Componentização real | Funções DOM e enhancers em [assets/app.js](../assets/app.js), além de scripts por domínio. |
| React | Os 56 JSX de `src/` são protótipos dormentes. Suas classes utilitárias também não possuem pipeline CSS correspondente. |
| Dependência externa | A fonte Manrope é importada do Google Fonts pelo CSS. |

As 31 páginas autenticadas dividem-se em três arquiteturas:

- Shell escrito diretamente no HTML: `/index.html`, `/cadh/index.html`, `/cadh/history.html`, `/ubs/index.html` e `/care-plans/form.html`.
- Shell criado dinamicamente por `ensureUnifiedSidebarShell()` em [app.js](../assets/app.js#L2815): 15 páginas de pacientes, atendimentos, transições, planos de cuidado, administração e `/ubs/patient.html`.
- Shell clínico recriado por [cadh-specialty-pages.js](../assets/cadh-specialty-pages.js#L53): gestor e dez especialidades.

Os estados principais de navegação são:

- `/cadh/index.html?flow=received|schedule|followup|sharing|finalized`;
- `/cadh/index.html?view=users|encounters|transitions`;
- `/ubs/index.html?tab=patients|transitioned|next|sharing`;
- `/ubs/patient.html?id=...&view=history|specialties|referral`;
- `/patients/show.html?id=...&tab=planos|atendimentos|transicoes`;
- formulários e especialidades com `id`, `patient_id`, `appointment_id`, `record_id`, `return` e `return_to`.

### Siselo-Users

| Área | Implementação efetiva |
|---|---|
| Runtime | PHP 8.1 sobre Apache e MySQL 8. |
| Arquitetura | Endpoints/wrappers manuais, controllers estáticos, models PDO e serviços. |
| Segurança existente | Sessão, CSRF, RBAC/permissões, auditoria e prepared statements reais (`PDO::ATTR_EMULATE_PREPARES=false`). |
| APIs | `/api/auth`, `/api/patients`, `/api/care_plans`, `/api/encounters`, `/api/transitions`, `/api/care_flow` e `/api/admin/users`. |
| Integração | CORS com origem configurada e credenciais; frontend usa por padrão `http://localhost:8086/api`. |
| UI PHP | Páginas completas ainda existem em `public/`, mas o Apache padrão as redireciona por HTTP 302 para os HTMLs do Frontend. |
| Testes/build | Não há Composer, PHPUnit ou suíte automatizada. |

Os redirecionamentos estão em [public/.htaccess](../../Siselo-Users/public/.htaccess#L13). As páginas PHP continuam sendo uma implementação paralela potencial caso rewrite, `AllowOverride` ou `FRONTEND_ORIGIN` estejam incorretos.

## 2. Problemas encontrados e classificação

| ID | Severidade | Diagnóstico e impacto | Rotas/arquivos principais |
|---|---|---|---|
| C1 | **Crítico** | Os dez scripts específicos de especialidade tornam-se inalcançáveis. O listener compartilhado, registrado primeiro, extrai o formulário e muda `body.dataset.page` para `cadh-specialty-form`; o listener específico então rejeita a página. Validações e regras clínicas próprias podem não executar. | Todas as rotas `/cadh/{especialidade}.html`; [cadh-specialty-pages.js](../assets/cadh-specialty-pages.js#L53), [cadh-cardiologia.js](../assets/cadh-cardiologia.js#L16) e equivalentes. |
| C2 | **Crítico** | Registros clínicos detalhados e acompanhamentos UBS são salvos em `localStorage`. Isso os torna dependentes de navegador/dispositivo e permite permanência após logout. O backend recebe, em alguns fluxos, apenas um resumo do atendimento. | Especialidades, `/cadh/history.html`, `/ubs/index.html`; [cadh-specialty-pages.js](../assets/cadh-specialty-pages.js#L1242), [cadh-history.js](../assets/cadh-history.js#L394), [ubs.js](../assets/ubs.js#L796). |
| H1 | **Alto** | Não há testes automatizados de rotas, contratos, permissões, layout, acessibilidade ou regressão visual. Isso bloqueia remoções seguras no CSS e PHP legado. | Ambos os repositórios e todas as rotas. |
| H2 | **Alto** | `app.css` é global, monolítico e append-only. Regras tardias sobrescrevem fundações anteriores, frequentemente com `!important`; alterações locais têm raio de impacto global. | Todas as páginas; [app.css](../assets/app.css). |
| H3 | **Alto** | Há três AppShells e várias cópias de header/sidebar/toggle. Em mobile, páginas nativas viram navegação horizontal, enquanto páginas auto-shell viram um rail fixo de 72px. Não existe drawer comum com foco gerenciado. | Todas as páginas autenticadas; `index.html`, `cadh/`, `ubs/`, `care-plans/form.html`, `app.js`. |
| H4 | **Alto** | Todas as tabelas são tratadas pelo enhancer global e, abaixo de 600px, convertidas em blocos/cards. Em outros trechos há `overflow:hidden`, `overflow:auto` e larguras mínimas conflitantes. O `overflow-x` no documento esconde problemas em vez de resolvê-los. | Listas/lixeiras CRUD, admin, detalhes do paciente, UBS e páginas clínicas; [app.js](../assets/app.js#L93), [app.css](../assets/app.css#L4001). |
| H5 | **Alto** | Acessibilidade inconsistente: textos de 8–11px, controles densos, navegação móvel sem drawer, modais sem ciclo completo de foco e elementos bloqueados ainda focalizáveis. Zoom é tratado por correções locais. | Principalmente CADH, UBS e fluxos clínicos. |
| H6 | **Alto** | Os formulários HTML “legados” das especialidades ainda são dependências de runtime: o controlador extrai deles campos/labels e o histórico faz `fetch` dos HTMLs para reconstruir metadados. Não podem ser apagados ou reorganizados livremente. | Especialidades e `/cadh/history.html`; [cadh-specialty-pages.js](../assets/cadh-specialty-pages.js#L87), [cadh-history.js](../assets/cadh-history.js#L145). |
| M1 | **Médio** | `app.js` concentra sessão, API, shell, widgets, tabelas, formulários, date picker, modais e observers. Scripts de domínio recriam grandes blocos com `innerHTML` e rebinding após renderização. | Todo o frontend. |
| M2 | **Médio** | CSS inline e estilos embutidos permanecem relevantes: 19 atributos `style`, dez blocos `<style>` clínicos com cerca de 5.265 linhas e dezenas de alterações de estilo via JS. No PHP há 58 atributos e sete blocos. | Auth, admin, especialidades e páginas PHP. |
| M3 | **Médio** | Containers e grids não possuem contrato único. Há máximos de 1240/1280/1320/1380px, sidebars de várias larguras e tabelas com `min-width` entre 850 e 1420px. | Todas as famílias de páginas. |
| M4 | **Médio** | Existem duas arquiteturas aparentes: componentes React em `src/` e componentes DOM reais em `assets/`. O comentário “Static bridge for src/components/ui” não torna o JSX executável. Isso induz futuras alterações no lugar errado. | [src/components](../src/components), [app.css](../assets/app.css#L12489). |
| M5 | **Médio** | A UI PHP continua duplicando páginas, formulários, tabelas e CSS. Ela é dormente na configuração padrão, mas pode reaparecer em implantações sem rewrite. | `Siselo-Users/public/{patients,care_plans,encounters,transitions,admin,cadh}` e páginas de autenticação. |
| M6 | **Médio** | Tokens existem apenas parcialmente: cerca de 222 declarações de custom properties convivem com aproximadamente 1.894 cores hexadecimais e milhares de valores `px`. | `app.css` e estilos embutidos. |
| M7 | **Médio** | `confirmPermanentDeletion` é declarado duas vezes no mesmo arquivo; a segunda declaração vence silenciosamente. | [app.js](../assets/app.js#L3216), [app.js](../assets/app.js#L4291). |
| B1 | **Baixo** | Há placeholders PHP vazios em `app/views`, CSS de páginas clínicas antigas que deixa de casar após a troca de `data-page` e outros artefatos potencialmente mortos. Ainda não existe evidência suficiente para removê-los. | `Siselo-Users/app/views`, `src/` e seletores antigos de `app.css`. |
| B2 | **Baixo** | API origin e fonte externa estão acopladas à configuração atual. Isso pode causar falhas operacionais ou de renderização em ambientes alternativos. | `assets/config.js`, `app.css`, CORS em [app/api/http.php](../../Siselo-Users/app/api/http.php#L9). |

### Evidências quantitativas do CSS

A varredura estática de `app.css` encontrou:

- 22.630 linhas e aproximadamente 582 KB;
- cerca de 1.530 ocorrências de `!important`, com forte concentração nas camadas tardias;
- 76 media queries e 23 valores diferentes de breakpoint;
- thresholds como 360, 520, 560, 620, 700, 720, 760, 820, 860, 900, 920, 980, 1100, 1120 e 1180px, além dos equivalentes aos limites oficiais;
- aproximadamente 667 declarações explícitas de `width`, `height`, `min-width` ou `max-width` em pixels;
- seletores importantes repetidos de quatro a dez vezes em regiões diferentes do arquivo;
- regras globais de `overflow-x:hidden/clip`, inclusive no `body`;
- 56 usos adicionais de `!important` nos estilos embutidos das especialidades.

Existe CSS mobile-first nas camadas iniciais, mas ele é frequentemente anulado por blocos posteriores `max-width`. O conflito mais visível ocorre entre 700px e 760px, onde o modelo de navegação muda de forma abrupta.

## 3. Páginas, componentes e padrões afetados

### Mapa das páginas

| Família | Rotas | Problemas predominantes |
|---|---|---|
| Autenticação | `/login.html`, `/change_password.html` | Shell próprio, estilos inline, origem da API e responsividade separada. |
| Home | `/index.html` | Shell próprio, dashboard e script inline. |
| CADH | `/cadh/index.html`, `/cadh/history.html`, `/cadh/gestor.html` | Dashboard complexo, shell duplicado, toggle potencialmente inoperante no histórico e dados locais. |
| Especialidades | cardiologia, endocrinologia, enfermagem, farmácia, fisioterapia, nutrição, oftalmologia, psicologia, serviço social e técnico | C1, C2, CSS embutido, formulários e modais duplicados. |
| UBS | `/ubs/index.html`, `/ubs/patient.html` | Dois shells diferentes, tabelas dinâmicas, estado local e vários modos por query string. |
| Pacientes | list/form/show/trash | Auto-shell, tabelas, formulários, abas e relações clínicas. |
| Atendimentos | list/form/trash | Auto-shell, formulários e tabelas. |
| Transições | list/form/trash | Auto-shell, formulários compostos e tabelas largas. |
| Planos de cuidado | list/form/trash | Shell inconsistente; formulário usa implementação própria. |
| Administração | `/admin/users/list.html`, `/admin/users/form.html` | Bom candidato a piloto, mas depende de permissões e tabela larga. |
| PHP legado | Rotas equivalentes `.php` | Duplicação e dependência do funcionamento de redirects. |

### Componentes potencialmente reutilizáveis

Os candidatos reais para consolidação são:

- sessão, API, navegação e autorização já expostas por `window.SISELO`;
- modal de confirmação de exclusão, que já possui trap de foco, Escape e restauração de foco;
- date picker, patient picker e team picker;
- padrões `.field`, `.field-full`, `.form-grid`, alertas e estados vazios;
- cabeçalho de página, container, sidebar, navegação principal e subnavegação;
- wrappers de tabela, ações por linha e paginação;
- painéis de dashboard;
- schema/configuração comum das especialidades e cards de histórico.

Os componentes React não devem ser tratados como reutilizáveis no runtime sem uma decisão explícita de adoção, toolchain e migração.

## 4. Dependências entre os problemas

A ordem técnica das dependências é:

1. Testes de caracterização são pré-requisito para qualquer mudança ampla em CSS, shell, tabelas ou PHP.
2. C1 precisa ser resolvido antes de refatorar visualmente formulários clínicos; caso contrário, os testes podem cristalizar o comportamento incorreto.
3. C2 exige decisão de segurança/produto. Persistência no backend modificaria contratos e só pode ocorrer com autorização explícita.
4. Tokens, breakpoints e primitivas de container devem anteceder o novo AppShell.
5. O AppShell deve anteceder a migração de dashboards e páginas clínicas.
6. A estratégia explícita por tabela deve existir antes de retirar a conversão global para cards.
7. A dependência de parsing dos HTMLs clínicos deve ser removida antes de reorganizar esses formulários.
8. A limpeza do `app.css`, JSX dormente ou PHP legado só pode ocorrer após migração, cobertura de uso e evidência de ausência de dependências.

Interfaces que precisam permanecer estáveis durante as fases de UI:

- URLs e query parameters atuais;
- formatos de resposta, payloads, códigos HTTP e cookies das APIs;
- permissões e regras de negócio;
- redirects PHP e geração de PDF;
- fluxos de retorno entre lista, formulário, histórico e especialidade.

## 5. Riscos de regressão

Os maiores riscos são:

- alterar permissões visuais ou expor navegação administrativa;
- quebrar deep links e estados codificados em query strings;
- perder foco, scroll ou estado ao reconstruir DOM;
- ocultar ações essenciais de tabelas em mobile;
- alterar nomes de campos, datas, validações ou payloads de formulários;
- perder ou duplicar dados clínicos armazenados localmente;
- quebrar integração cross-origin com cookies;
- remover seletores aparentemente mortos que ainda participam do parsing clínico;
- mudar redirects, downloads de PDF ou instalações sem `mod_rewrite`;
- corrigir uma faixa de largura e criar regressão por uma regra tardia de `app.css`.

## 6. Testes necessários antes das refatorações

### Base geral

- Smoke test de todas as 33 rotas.
- Login, troca de senha, logout, sessão expirada e matriz de papéis/permissões.
- Contratos de API para sucesso, validação, 401, 403, 404 e erro de servidor.
- Screenshots de referência em 360, 390, 600, 768, 960, 1280 e 1440px.
- Testes adicionais em 599/600, 959/960 e 1263/1264px.
- Verificação automatizada de `scrollWidth <= clientWidth` no documento.
- Zoom de 100%, 125%, 150%, 175% e 200%.
- Estados loading, vazio, erro, conteúdo longo e dados extremos.

### Antes do AppShell

- Navegação ativa, subnavegação, permissões, conta, logout e estado recolhido.
- Tabulação, Escape, retorno de foco e bloqueio de scroll do drawer.
- Deep links com todos os query parameters conhecidos.
- Modo incorporado, quando usado, incluindo `?embed=1`.

### Antes das tabelas

- Fixtures com muitas colunas, textos longos, múltiplas ações e ausência de dados.
- Definição explícita, por tabela, de colunas essenciais/secundárias e comportamento mobile.
- Scroll horizontal restrito ao wrapper.
- Cabeçalhos/labels acessíveis e ações utilizáveis por teclado.

### Antes de formulários e modais

- Snapshot do conjunto de campos e nomes enviados.
- Validação obrigatória, limites clínicos, datas e mensagens de erro.
- Create/edit, cancelamento, retorno à origem e proteção contra duplo submit.
- Trap de foco, Escape, backdrop, restauração de foco e leitura por tecnologia assistiva.

### Antes das páginas clínicas

- Teste que comprove qual controlador inicia em cada especialidade.
- Cobertura de todas as regras clínicas específicas.
- Compatibilidade dos registros já existentes em `localStorage`.
- Histórico combinado, edição, consulta inicial/retorno e vínculo com agendamento.
- Teste de isolamento entre usuários e comportamento após logout.

### Antes de remover PHP ou CSS legado

- Testes de redirects em instalação Apache real.
- Testes de API e PDF.
- Busca estática e observação de cobertura de seletores/rotas.
- Comparação visual completa das páginas migradas.

## 7. Ordem recomendada e fases pequenas

### Fase 0 — Rede de segurança

**Objetivo:** introduzir testes de caracterização sem alterar comportamento.

**Arquivos prováveis:** novo `package.json`, suíte `tests/e2e`, configuração de navegador, workflow do Frontend e fixtures no ambiente Docker.

**Dependências:** nenhuma.

**Risco:** baixo.

**Critérios de aceite:** rotas representativas, papéis, APIs, larguras oficiais, limites dos breakpoints, zoom e overflow cobertos; execução reproduzível em CI.

### Fase 1A — Conter o problema do runtime clínico

**Objetivo:** garantir um único controlador executável por especialidade e preservar todas as regras clínicas já existentes, sem modificar APIs.

**Arquivos prováveis:** `cadh-specialty-pages.js`, os dez `cadh-<especialidade>.js`, os dez HTMLs clínicos e testes específicos.

**Dependências:** Fase 0 e validação funcional das regras com responsáveis do domínio.

**Risco:** crítico.

**Critérios de aceite:** nenhum módulo carregado fica inerte; cada regra específica possui teste; formulários, nomes de campos e persistência corrente permanecem compatíveis.

### Fase 1B — Definir persistência de dados clínicos

**Objetivo:** eliminar a dependência insegura de dados clínicos apenas no navegador.

**Arquivos prováveis:** scripts de especialidades, histórico e UBS; controllers/models/migrations/API do `Siselo-Users`, somente após autorização.

**Dependências:** Fase 1A e autorização explícita para contrato/backend.

**Risco:** crítico.

**Critérios de aceite:** fonte canônica definida, migração/compatibilidade dos dados locais testada, isolamento entre usuários garantido e nenhum dado perdido. Sem autorização, esta fase permanece bloqueada e o risco deve continuar documentado.

### Fase 2 — Tokens, breakpoints e primitivas

**Objetivo:** criar camadas CSS de tokens, fundamentos, container e grid usando exclusivamente 600, 960 e 1264px como thresholds globais.

**Arquivos prováveis:** novas folhas em `assets/styles/`, links de carregamento e pequenos pontos de integração com `app.css`.

**Dependências:** Fase 0.

**Risco:** médio.

**Critérios de aceite:** piloto sem alteração visual não intencional, abordagem mobile-first, escopo explícito, nenhum novo inline ou `!important` e nenhuma remoção ampla do legado.

### Fase 3 — AppShell único, começando por administração

**Objetivo:** criar header, sidebar, drawer mobile, container e navegação compartilhados no runtime estático.

**Arquivos prováveis:** módulo de AppShell, CSS correspondente, `app.js` e inicialmente `admin/users/list.html` e `form.html`.

**Dependências:** Fases 0 e 2.

**Risco:** alto.

**Critérios de aceite:** permissões, rota ativa, logout e query strings preservados; drawer com foco correto; todas as larguras e zoom sem overflow. Após o piloto, migrar as demais páginas auto-shell em lotes pequenos.

### Fase 4 — Tabelas por família

**Objetivo:** substituir a regra global de tabela→card por estratégias explícitas: colunas responsivas, scroll localizado, detalhes expansíveis ou cards apenas quando justificados.

**Arquivos prováveis:** componente DOM/CSS de tabela, `app.js` e scripts/HTMLs das listas de pacientes, atendimentos, transições, planos, admin e UBS.

**Dependências:** Fases 0, 2 e preferencialmente 3.

**Risco:** alto.

**Critérios de aceite:** nenhuma tabela causa overflow no documento; dados e ações essenciais permanecem acessíveis; comportamento documentado por tabela; remoção do enhancer global somente após a última migração.

### Fase 5 — Formulários, cards e modais reutilizáveis

**Objetivo:** consolidar padrões de campo, grid, card, feedback, estados vazios e modal acessível.

**Arquivos prováveis:** componentes DOM/CSS novos, `app.js`, formulários CRUD e scripts de domínio correspondentes.

**Dependências:** Fases 0 e 2; AppShell disponível.

**Risco:** médio/alto.

**Critérios de aceite:** payloads e validações inalterados, teclado e foco completos, contraste e alvos de interação adequados, sem novos estilos inline ou `!important`.

### Fase 6 — Dashboards e shells especiais

**Objetivo:** migrar progressivamente Home, CADH, UBS, histórico e formulário de plano para o AppShell e grids comuns.

**Arquivos prováveis:** `index.html`, `cadh/index.html`, `cadh/history.html`, `ubs/index.html`, `care-plans/form.html` e seus scripts.

**Dependências:** Fases 2–5.

**Risco:** alto.

**Critérios de aceite:** métricas, agenda, alertas, kanban, abas, permissões e estados de query string preservados; navegação móvel uniforme e sem controles ocultos indispensáveis.

### Fase 7 — Migração visual das páginas clínicas

**Objetivo:** aplicar shell, formulários, cards, tabelas e modais consolidados às dez especialidades e ao gestor.

**Arquivos prováveis:** HTMLs e scripts de `cadh/`, estilos clínicos embutidos, histórico e componentes compartilhados.

**Dependências:** Fases 1A, 2–5 e decisão da Fase 1B.

**Risco:** crítico.

**Critérios de aceite:** paridade clínica integral, histórico consistente, nenhuma dependência implícita de DOM antigo, acessibilidade completa e validação em todas as larguras oficiais.

### Fase 8 — Redução controlada do legado

**Objetivo:** remover somente regras, duplicações e scripts comprovadamente sem uso.

**Arquivos prováveis:** `app.css`, `app.js`, estilos clínicos e eventualmente `src/`.

**Dependências:** todas as páginas afetadas já migradas e cobertas.

**Risco:** alto.

**Critérios de aceite:** evidência de cobertura/ausência de uso, regressão visual limpa, redução mensurável de `!important` e nenhum seletor removido em massa apenas por organização.

### Fase 9 — Avaliação das páginas PHP legadas

**Objetivo:** confirmar se podem ser arquivadas ou removidas sem afetar instalações, ações, redirects ou PDF.

**Arquivos prováveis:** `Siselo-Users/public/*.php`, `.htaccess` e documentação de implantação.

**Dependências:** cobertura de redirects/API, inventário de acessos e confirmação explícita de ausência de consumidores.

**Risco:** alto.

**Critérios de aceite:** todas as URLs antigas possuem destino validado, APIs e PDF permanecem funcionais, nenhum deployment alternativo depende da UI PHP e a exclusão recebe autorização explícita.

## Diretriz final

A primeira mudança de produção não deve ser uma reorganização de arquivos nem a adoção de React. Deve ser a criação da rede de testes, seguida da contenção do runtime clínico. A evolução visual pode então começar por uma rota administrativa de baixo acoplamento e avançar por famílias, mantendo `app.css` e o PHP legado como fallback até haver comprovação de que cada dependência foi substituída.
