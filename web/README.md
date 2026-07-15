# Artefato de Atribuição de Disciplinas — DEMAT/UFMT

Página estática (HTML/CSS/JS, sem servidor Python) para distribuir disciplinas a
professores, com análise de conflitos, grade de horário, dashboard de carga e
exportação da planilha de encargos. Os dados persistem numa planilha do Google via um
Web App do Apps Script (ver [`../apps-script/README.md`](../apps-script/README.md)).

## Ferramentas

- **Atribuição** — por professor; destaca disciplinas livres **sem conflito** com as já atribuídas; prévia na grade.
- **Grade** — heatmap Seg–Sex × 07:30–23:00 por professor, com pausas e destaque de conflitos.
- **Conflitos** — matriz N×N de disciplinas que compartilham horário.
- **Dashboard** — KPIs (cobertura, sem professor, CH total) e barras de carga por professor (meta configurável).
- **Distribuição** — tabela filtrável de toda a distribuição.
- **Exportar** — `.xlsx` (planilha de encargos), `.csv` de trabalho, PDF (imprimir).

## Entrada de dados e mapeamento de colunas

Formatos aceitos (⚙ Configurar):

- **Planilha da coordenação (`.xlsx`)** — recomendado. Um único arquivo com as abas de
  disciplinas e de docentes (ex.: `Cópia de Encargos ….xlsx`, abas `Página2`/`Página3`).
  O app **detecta automaticamente** qual aba é qual e abre o mapeamento em duas etapas.
- **CSV** — separadamente, um para disciplinas e outro para professores.

> Ao importar disciplinas, a **coluna de professor é zerada** — a distribuição começa do
> zero (a planilha da coordenação chega com algumas pré-atribuições por primeiro nome, que
> são descartadas). Para recuperar atribuições já feitas, use **↻ Recarregar** (Google Sheet),
> não o import.

As colunas são reconhecidas **pelo nome do cabeçalho**, de forma tolerante a maiúsculas,
acentos e pontuação (`Horário`, `C.H.`, `Professor Responsável`, `N°`,
`Docentes Por Ordem de Distribuição de Encargos…` etc.), e a ordem das colunas não importa.
Ao importar, abre um **painel de mapeamento** onde você confirma/ajusta qual coluna (e, no
`.xlsx`, qual aba) alimenta cada campo, com prévia ao vivo. Se um nome não for reconhecido,
há fallback pela posição da coluna (ordem canônica abaixo).

- **Disciplinas:** `Ordem, Curso, Disciplina, Horario, CH, Professor(a)`
- **Professores:** `Ordem, Docentes`

## Rodar localmente

Precisa ser servido por HTTP (não abrir via `file://`, por causa dos módulos e do fetch):

```bash
# opção 1: Python
cd web && python3 -m http.server 8080

# opção 2: Docker (nginx) — a partir da raiz do projeto
docker build -t atribuicao . && docker run --rm -p 8080:80 atribuicao
```

Abra <http://localhost:8080> e clique em **⚙** para configurar o endpoint/token
(ou importar CSVs para trabalhar offline).

## Publicar no GitHub Pages

O workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publica a
pasta `web/` automaticamente a cada push na `main`. Ative **Settings › Pages › Build and
deployment › GitHub Actions** no repositório uma vez.

## Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` | Layout e abas |
| `styles.css` | Design system (tema claro/escuro, impressão) |
| `logic.js` | Parsing de horário e conflitos (porte de `componente.py`) |
| `sheets.js` | Cliente do Apps Script + CSV |
| `export.js` | Exportações (xlsx/csv/pdf) |
| `app.js` | Estado, navegação e views |
| `vendor/xlsx.full.min.js` | SheetJS (gera o `.xlsx`) |

## Login e permissões

A **leitura é pública** (qualquer pessoa acompanha a distribuição). A **edição exige
login Google** e só é liberada para os e-mails autorizados no Apps Script
(`ALLOWED_EMAILS`, ex.: `moiseis@gmail.com`) — verificado no servidor. Quem entrar com
outra conta continua em somente leitura. Botão **Entrar com Google** na barra superior.

Quem está em modo leitura **acompanha ao vivo**: a página relê a planilha a cada 30s e se
atualiza sozinha conforme o editor vai salvando (pausa quando há edição pendente, quando a
aba está oculta ou um modal está aberto, e só re-renderiza quando algo muda de fato).

## Configuração (guardada no navegador)

- `endpoint` — URL `/exec` do Web App.
- `clientId` — Client ID do Google (OAuth), público, usado para o login.

Passo a passo (planilha, Client ID, deploy) em
[`../apps-script/README.md`](../apps-script/README.md).
