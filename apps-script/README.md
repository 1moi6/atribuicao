# Persistência via Google Apps Script (com login Google)

O artefato lê e grava os dados numa **planilha do Google** através de um **Web App do
Apps Script**. Não há servidor próprio para manter: o script roda como você (dono da
planilha), a **leitura é pública** (acompanhamento) e a **escrita exige login Google** —
só e-mails autorizados (ex.: `moiseis@gmail.com`) conseguem gravar; os demais ficam em
modo somente leitura. O login é **verificado no servidor** (o Apps Script confere o ID
token no endpoint oficial do Google), então não dá para burlar pelo navegador.

## 1. Criar a planilha

Crie uma planilha no Google Drive com **duas abas**:

- **`Disciplinas`** — cabeçalho: `Ordem, Curso, Disciplina, Horario, CH, Professor(a)`
- **`Professores`** — cabeçalho: `Ordem, Docentes`

Semeie a partir dos CSVs do projeto (`data/disciplinas_2026_2.csv` e
`data/professores_2026_2.csv`), via **Arquivo › Importar › Enviar**. A coluna
`Professor(a)` pode ficar vazia — é ela que o app preenche ao atribuir.

## 2. Criar o Client ID do Google (OAuth) — para o login

1. Acesse <https://console.cloud.google.com/> e crie/escolha um projeto.
2. **APIs e serviços › Tela de consentimento OAuth**: configure (tipo "Externo"),
   preencha o essencial e publique (ou adicione seu e-mail como usuário de teste).
3. **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas:** as URLs onde o site roda, por exemplo
     `https://SEU-USUARIO.github.io` e, para testes, `http://localhost:8099`.
4. Copie o **Client ID** (`…apps.googleusercontent.com`). Ele é público (vai no site).

## 3. Instalar o script

1. Na planilha: **Extensões › Apps Script**.
2. Cole o conteúdo de [`Code.gs`](./Code.gs).
3. Preencha no topo:
   - `SPREADSHEET_ID` — ID da planilha (parte da URL entre `/d/` e `/edit`).
   - `OAUTH_CLIENT_ID` — o Client ID do passo 2 (o **mesmo** usado no site).
   - `ALLOWED_EMAILS` — lista de quem pode gravar, ex.: `["moiseis@gmail.com"]`.
4. Salve.

## 4. Implantar como Web App

1. **Implantar › Nova implantação** › Tipo: **App da Web**.
2. **Executar como:** eu (dono da planilha).
3. **Quem tem acesso:** Qualquer pessoa.
4. Implantar e autorizar (o Google pedirá permissão para editar a planilha).
5. Copie a **URL do app da Web** (termina em `/exec`).

## 5. Conectar o artefato

No site (**⚙ Configurar**):

- **Endpoint do Apps Script:** a URL `/exec`.
- **Client ID do Google:** o mesmo `OAUTH_CLIENT_ID`.

Salve e clique em **↻** para carregar. Quem for editar clica em **Entrar com Google**;
se o e-mail estiver na lista, o botão **Salvar** aparece. Sem login (ou fora da lista), o
app fica em somente leitura.

## Contrato da API

- `GET  /exec` → `{ ok, disciplinas: [...], professores: [...] }` (público).
- `POST /exec` (corpo `text/plain` com JSON), autenticado por `idToken` do Google:
  - `{ idToken }` → `{ ok, email, canWrite }` (descobre a permissão — *whoami*).
  - `{ idToken, assignments: [{ ordem, professor }] }` → grava se `canWrite`; retorna
    `{ ok, updated }`. Login inválido/expirado ou sem permissão → `{ ok:false, error }`.

## Segurança

A escrita exige um **ID token do Google válido**, verificado no servidor (assinatura,
validade e audiência conferidas via `oauth2.googleapis.com/tokeninfo`), e o e-mail precisa
estar em `ALLOWED_EMAILS`. Não há segredo compartilhado no navegador. O Client ID é
público por natureza (não é segredo). A leitura permanece aberta para o acompanhamento.

Para **adicionar/remover editores**, edite `ALLOWED_EMAILS` no `Code.gs` e reimplante.

## Reimplantar após editar o `Code.gs`

**Implantar › Gerenciar implantações › (editar) › Nova versão** publica as mudanças na
mesma URL.
