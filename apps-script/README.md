# Persistência via Google Apps Script

O artefato lê e grava os dados numa **planilha do Google** através de um **Web App do
Apps Script**. Assim não há servidor próprio para manter: o script roda como você (dono
da planilha), a leitura é pública (acompanhamento) e a escrita exige um **token**.

## 1. Criar a planilha

Crie uma planilha no Google Drive com **duas abas**:

- **`Disciplinas`** — cabeçalho: `Ordem, Curso, Disciplina, Horario, CH, Professor(a)`
- **`Professores`** — cabeçalho: `Ordem, Docentes`

Semeie a partir dos CSVs atuais do projeto:

- `data/disciplinas_2026_2.csv` → aba `Disciplinas`
- `data/professores_2026_2.csv` → aba `Professores`

(No Sheets: **Arquivo › Importar › Enviar**, escolha "Inserir novas planilhas" ou cole
o conteúdo e use **Dados › Dividir texto em colunas**.)

> A coluna `Professor(a)` pode ficar vazia; é ela que o app preenche ao atribuir.

## 2. Instalar o script

1. Na planilha: **Extensões › Apps Script**.
2. Cole o conteúdo de [`Code.gs`](./Code.gs).
3. Preencha no topo:
   - `SPREADSHEET_ID` — o ID da planilha (parte da URL entre `/d/` e `/edit`).
   - `WRITE_TOKEN` — uma senha qualquer (ex.: gere uma frase aleatória). Só quem
     tiver esse token consegue gravar.
4. Salve.

## 3. Implantar como Web App

1. **Implantar › Nova implantação**.
2. Tipo: **App da Web**.
3. **Executar como:** eu (dono da planilha).
4. **Quem tem acesso:** Qualquer pessoa.
5. Implantar e autorizar (o Google pedirá permissão para editar a planilha).
6. Copie a **URL do app da Web** (termina em `/exec`).

## 4. Conectar o artefato

No site (botão **⚙ Configurar**):

- **Endpoint do Apps Script:** cole a URL `/exec`.
- **Token de escrita:** cole o mesmo `WRITE_TOKEN` (só na máquina da coordenação;
  quem for apenas acompanhar deixa em branco → modo somente leitura).

Clique em **Salvar config** e depois em **↻** para carregar.

## Contrato da API

- `GET  /exec` → `{ ok, disciplinas: [...], professores: [...] }`
- `POST /exec` (corpo `text/plain` com JSON) →
  `{ token, assignments: [{ ordem, professor }] }` →
  `{ ok, updated }`. Sem token válido: `{ ok:false, error:"Token inválido." }`.

## Segurança

O token viaja no navegador e **não é um segredo forte** — ele dissuade escrita casual e
é adequado a uma ferramenta interna de coordenação. A leitura é pública (como o
"acompanhamento" atual). Se no futuro for preciso auditoria por usuário, dá para migrar
para login Google (OAuth) na Sheets API.

## Reimplantar após editar o `Code.gs`

Ao alterar o script, use **Implantar › Gerenciar implantações › (editar) › Nova versão**
para publicar as mudanças na mesma URL.
