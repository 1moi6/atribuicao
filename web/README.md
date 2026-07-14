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

As colunas são reconhecidas **pelo nome do cabeçalho**, de forma tolerante a maiúsculas,
acentos e pontuação (`Horário`, `C.H.`, `Professor Responsável`, `N°` etc.), e a ordem das
colunas não importa. Ao **importar um CSV** (⚙ Configurar), abre um **painel de mapeamento**
onde você confirma/ajusta qual coluna do arquivo alimenta cada campo, com uma prévia ao
vivo — assim qualquer planilha pode ser encaixada, mesmo com nomes fora do padrão. Se um
nome não for reconhecido, há fallback pela posição da coluna (ordem canônica abaixo).

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

## Configuração (guardada no navegador)

- `endpoint` — URL `/exec` do Web App.
- `token` — token de escrita (só na máquina da coordenação; vazio = somente leitura).
