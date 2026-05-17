# feat: adiciona guia de Cardiologia no CADH

## Descrição

Esta PR adiciona a guia de Cardiologia dentro do ambiente CADH, seguindo o padrão visual e de fluxo já usado nas guias clínicas do SISELO. A nova página permite registrar consultas cardiológicas, visualizar os dados em tabela, preencher a guia clínica por paciente e manter o histórico de consultas.

## Principais alterações

- Criação da página `cadh/cardiologia.html` com tabela de registros, modal de cadastro/edição e modal de visualização da guia preenchida.
- Criação do script `assets/cadh-cardiologia.js` para controlar carregamento de pacientes, seleção por busca, preenchimento do formulário, persistência local, edição, visualização e renderização da tabela.
- Inclusão dos campos clínicos de Cardiologia conforme a planilha:
  - Valor colesterol LDL mg/dl;
  - Cumprimento da meta terapêutica MAPA;
  - Cerebrovascular;
  - Doença da artéria coronária;
  - Insuficiência cardíaca com fração de ejeção reduzida;
  - Doença arterial periférica sintomática dos membros inferiores;
  - Evento nos últimos 6 meses;
  - Função renal;
  - Plano de cuidado.
- Ajuste da doença da artéria coronária para fluxo clínico em duas etapas: primeiro marcação de `Sim`/`Não` e, quando positivo, classificação específica.
- Separação da classificação de angina em `Angina estável` e `Angina instável`.
- Inclusão de dica clínica destacada para `Angina instável`, orientando a descrever a instabilidade nas recomendações ou no plano de cuidado.
- Padronização do cartão de dados do paciente, mantendo CPF, SES, raça/cor, idade, nascimento e 1º atendimento CADH.
- Ajustes de acessibilidade visual para telas usadas por pacientes/usuários idosos, com fontes, cartões, tabelas, botões e áreas clicáveis maiores no CADH e em Cardiologia.
- Ajuste dos botões de ação da tabela para manter ícones centralizados e proporcionais.
- Ajuste do datepicker para reposicionar corretamente o popover ao abrir ou redimensionar a tela.
- Atualização da configuração da API para `http://localhost:8086/api`.

## Validações realizadas

- `node --check assets/cadh-cardiologia.js`
- `git diff --check`

## Observações

- A guia mantém as nomenclaturas da planilha/documento anterior para reduzir estranhamento dos profissionais.
- A funcionalidade de geração de PDF permanece indicada como ação futura, mantendo o aviso de indisponibilidade já usado na tela.
