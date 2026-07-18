# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Distribuição de Disciplinas — DEMAT/UFMT. Atribuição de disciplinas a professores.

Responda e escreva mensagens de commit em **português** (subject imperativo/descritivo, sem prefixos convencionais tipo `feat:`).

## O que é o quê

- **`web/`** — o produto ativo. App **vanilla JS, sem build step**: edite os arquivos e eles vão pro deploy como estão. É onde o trabalho acontece.
- **App Streamlit na raiz** (`main.py`, `sistema.py`, `home.py`, `componente.py`) — secundário/legado. Rodar com `streamlit run main.py` (sem manifesto de dependências no repo; usa `st.user`/OIDC configurado em `.streamlit/secrets.toml`, gitignored). `web/logic.js` é uma port de `componente.py`.

## Rodar o web/ localmente

```
cd web && python3 -m http.server 8099
```

Sirva por **HTTP** (não `file://`) e use a **porta 8099**: é a origem registrada nas *Authorized JavaScript origins* do OAuth. Em outra porta o login Google é recusado ("não obedece à política do OAuth 2.0"). Para autorizar outra origem, edite o Client ID no Google Cloud Console.

## Deploy

GitHub Pages via `.github/workflows/pages.yml`, automático a cada push em `main` que toque `web/**`. Site: `https://1moi6.github.io/ditribuicao/`. `origin` = `https://github.com/1moi6/atribuicao.git` (repo renomeado; a pasta local `ditribuicao` está com o nome antigo).

Fluxo de trabalho: feature na branch `web-atribuicao` → PR → merge em `main`.

## Dados e auth (web/)

Fonte da verdade é um **Google Sheet** acessado por um **Google Apps Script Web App** (`apps-script/Code.gs`):
- `GET /exec` → `{disciplinas, professores}` — **leitura pública**.
- `POST /exec` → whoami e `saveAssignments([{ordem, professor}])` — **escrita exige login Google**, verificado no servidor; o email precisa estar em `ALLOWED_EMAILS` dentro de `Code.gs`. Mudar editores = editar `Code.gs` e **publicar uma nova versão** no Apps Script (mesma URL).

`data/*.csv` (`disciplinas_YYYY_S.csv`, `professores_YYYY_S.csv`) servem para semear o Sheet; o web/ **não** lê os CSVs em runtime.

## Gotchas

- **`web/config.js` é público por design** (endpoint do Apps Script + Client ID OAuth) — não é segredo, não trate como tal.
- **`POST` usa `Content-Type: text/plain`** de propósito, para evitar preflight de CORS com o Apps Script — não troque por `application/json`.
- Sem lint e sem testes. Após editar JS em `web/`, valide a sintaxe com `node --check web/*.js`.
- Ordem dos scripts em `index.html` importa: `config.js` → `xlsx` → `logic.js` → `sheets.js` → `export.js` → `app.js`.
