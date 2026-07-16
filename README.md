# SISELO - Frontend

## Visão Geral

O **SISELO (Sistema Integrado de Saúde)** é um sistema web desenvolvido para apoiar a integração entre o **Centro de Atenção ao Diabetes e Hipertensão (CADH)** e as **Unidades Básicas de Saúde (UBS)**.

A camada de **frontend** é responsável pela interface utilizada pelos usuários para acessar as funcionalidades do sistema, consultar informações, registrar dados e acompanhar os fluxos de atendimento.

---

## Objetivo

Disponibilizar uma interface simples e acessível para apoiar o acompanhamento de pacientes, facilitando o uso do sistema pelas equipes do **CADH** e das **UBS**.

---

## Responsabilidades do Frontend

A camada de frontend é responsável por:

- exibição das telas do sistema
- navegação entre os módulos
- envio de dados para o backend
- exibição das informações retornadas pela API
- apoio aos fluxos de autenticação e troca de senha
- organização visual dos cadastros, listas e formulários

---

## Funcionalidades

O frontend oferece acesso às seguintes funcionalidades principais:

- login no sistema
- cadastro e gerenciamento de pacientes
- registro de atendimentos
- gestão de planos de cuidado
- controle de transições de pacientes entre unidades
- administração de usuários
- acesso ao módulo CADH

---

## Tecnologias Utilizadas

- **HTML** — estrutura das telas
- **CSS** — estilos da interface
- **JavaScript** — interações e comunicação com a API
- **Node.js** — servidor local para disponibilizar os arquivos do frontend

Este frontend não utiliza framework como React, Vue ou Angular.

---

## Como Executar

Entre na pasta do frontend:

```bash
cd siselo-frontend/Siselo-Frontend
```

Execute o servidor local:

```bash
node server.js
```

Acesse no navegador:

```text
http://localhost:3000
```

O frontend espera que o backend esteja rodando em:

```text
http://localhost:8086
```

Caso o backend esteja em outro endereço, altere o arquivo:

```text
assets/config.js
```

---

## Desenvolvimento

Este repositório é destinado ao desenvolvimento e manutenção da interface frontend do sistema SISELO.

Não devem ser incluídos no repositório:

- dados reais de pacientes
- credenciais de acesso
- informações sensíveis do sistema

---

## Integração com o portal COOPERE

Para abrir o Siselo dentro de um iframe/portlet, use a URL com o modo incorporado:

```html
<iframe
  src="https://SEU-DOMINIO-SISELO/index.html?embed=1"
  title="Siselo"
  style="width: 100%; min-height: 760px; border: 0;"
  loading="lazy">
</iframe>
```

O layout segue os breakpoints usados pelo portal (1264 px, 960 px e 600 px), detecta automaticamente quando está dentro de um iframe e evita largura baseada em `100vw`.

No ambiente de produção:

- publique o frontend em HTTPS;
- replique no servidor web a diretiva `frame-ancestors 'self' https://coopere.sds.unb.br`;
- prefira servir frontend e API sob o mesmo site/reverse proxy. Cookies de sessão de terceiros podem ser bloqueados pelo Safari/iOS quando o Siselo esta em outro domínio.
