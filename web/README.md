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

## Entrada de dados (Google Sheet)

Os dados vivem na planilha do Google (fonte da verdade). Para um novo semestre, atualize
as abas diretamente no Sheets — **não há import pela interface**:

- **`Disciplinas`** — cabeçalho: `Ordem, Curso, Disciplina, Horario, CH, Professor(a)`
- **`Professores`** — cabeçalho: `Ordem, Docentes`

Deixe a coluna `Professor(a)` vazia para começar a distribuição do zero. Ao fim do
semestre, exporte o `.xlsx` de encargos (⭳) como arquivo histórico. As colunas são lidas
pelo **nome do cabeçalho** (tolerante a maiúsculas/acentos/pontuação), então variações como
`Horário`, `Professor Responsável` ou `Docentes Por Ordem…` também são reconhecidas.

## Rodar localmente

Precisa ser servido por HTTP (não abrir via `file://`, por causa dos módulos e do fetch):

```bash
# opção 1: Python
cd web && python3 -m http.server 8080

# opção 2: Docker (nginx) — a partir da raiz do projeto
docker build -t atribuicao . && docker run --rm -p 8080:80 atribuicao
```

Abra <http://localhost:8080>. O endpoint e o Client ID já vêm de `config.js`.

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

## Configuração

Fica em **`config.js`** (embutido no deploy) — preenchido uma vez e commitado, então
qualquer visitante já carrega os dados sem configurar nada; o editor só faz login:

- `endpoint` — URL `/exec` do Web App do Apps Script.
- `clientId` — Client ID do Google (OAuth), público, usado para o login.

Nenhum dos dois é segredo. Passo a passo (planilha, Client ID, deploy) em
[`../apps-script/README.md`](../apps-script/README.md).
