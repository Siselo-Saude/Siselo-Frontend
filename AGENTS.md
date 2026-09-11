# Regras arquiteturais do Siselo-Frontend

## Escopo e objetivo

Estas instruções se aplicam a todo o repositório `Siselo-Frontend`.

- O `Siselo-Frontend` deve evoluir para ser a interface oficial do SISELO.
- A migração deve ser incremental. Nunca realizar uma reescrita completa sem solicitação explícita.
- Preservar as funcionalidades existentes.
- Não alterar regras de negócio sem necessidade para a tarefa atual.
- Não modificar APIs ou contratos de backend sem autorização explícita.
- Não realizar refatorações não relacionadas à tarefa atual.
- Não renomear nem mover grandes quantidades de arquivos apenas por organização.
- Não excluir código legado sem confirmar que ele não possui dependências nem uso.

## Regra fundamental de escopo

Ao receber uma tarefa, modificar somente os arquivos necessários para concluí-la.

Se outros problemas forem encontrados durante o trabalho:

1. registrá-los no relatório final;
2. não corrigi-los automaticamente;
3. corrigi-los somente se forem necessários para concluir a tarefa atual.

Nunca avançar automaticamente para outra fase de refatoração.

## Responsividade

Os breakpoints globais oficiais são:

- mobile: `0–599px`;
- tablet: `600–959px`;
- desktop: `960–1263px`;
- desktop amplo: `>=1264px`.

Usar como thresholds globais apenas:

- `600px`;
- `960px`;
- `1264px`.

Novos breakpoints fora desses valores somente podem ser criados quando houver necessidade técnica comprovada e documentada. Preferir CSS mobile-first.

## CSS

- Evitar novos usos de `!important`.
- Evitar estilos inline.
- Evitar valores arbitrários repetidos.
- Preferir tokens definidos por meio de CSS Custom Properties.
- Todo CSS novo deve possuir escopo claro.
- Não continuar adicionando correções indiscriminadamente ao `app.css`.
- Não remover grandes trechos do `app.css` sem comprovar que não são utilizados.
- Eliminar o CSS legado progressivamente, à medida que páginas e componentes forem migrados.

## Arquitetura desejada

A arquitetura deve evoluir progressivamente nesta ordem de camadas:

1. tokens e fundamentos;
2. primitivas de layout;
3. componentes reutilizáveis;
4. padrões de negócio;
5. páginas compostas pelos componentes anteriores.

Reutilizar componentes e padrões comuns em vez de recriá-los em cada página.

## AppShell

As páginas autenticadas devem convergir progressivamente para um único padrão de:

- header;
- sidebar;
- drawer mobile;
- container;
- navegação.

Não criar novas implementações independentes de sidebar ou header.

## Tabelas

Não transformar automaticamente todas as tabelas em cards no mobile. Analisar cada tabela considerando:

- dados essenciais;
- dados secundários;
- ações;
- possibilidade de scroll horizontal localizado;
- possibilidade de detalhes expansíveis;
- necessidade, ou não, de representação em cards.

Nunca permitir que uma tabela provoque overflow horizontal no documento inteiro.

## Acessibilidade

Novos componentes devem considerar:

- navegação por teclado;
- foco visível e ordem de foco adequada;
- labels;
- contraste;
- zoom;
- tamanhos adequados para interação;
- gerenciamento correto de foco em modais e drawers.

## Testes e validação

Toda alteração relevante de layout deve ser validada nas seguintes larguras:

- `360px`;
- `390px`;
- `600px`;
- `768px`;
- `960px`;
- `1280px`;
- `1440px`.

Quando pertinente, testar também os limites dos breakpoints:

- `599px` e `600px`;
- `959px` e `960px`;
- `1263px` e `1264px`.

Sempre verificar se existe overflow horizontal.

## Encerramento de cada tarefa

Ao terminar cada tarefa:

1. executar os testes disponíveis;
2. informar os arquivos alterados;
3. explicar o que foi modificado;
4. informar possíveis riscos;
5. informar problemas encontrados, mas não corrigidos;
6. parar e aguardar uma nova tarefa.
