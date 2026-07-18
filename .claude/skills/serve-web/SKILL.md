---
name: serve-web
description: Sobe o app estático web/ num servidor HTTP local na porta 8099 (a origem autorizada no OAuth do Google, necessária para o login funcionar). Use ao rodar, testar ou tirar screenshot do app localmente.
---

# serve-web

Serve o app `web/` localmente para desenvolvimento e teste manual.

## Passos

1. Verifique se a porta 8099 já está em uso e libere só se for um servidor deste app:
   ```
   lsof -nP -iTCP:8099 -sTCP:LISTEN
   ```
2. Suba o servidor em background a partir de `web/`:
   ```
   cd web && python3 -m http.server 8099
   ```
3. Confirme que respondeu: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8099/index.html` (espera `200`).
4. A URL é **http://localhost:8099/index.html**.

## Por que a porta 8099

É a origem registrada nas *Authorized JavaScript origins* do Client ID OAuth. Em qualquer outra porta o Google recusa o login ("não obedece à política do OAuth 2.0"). Não troque a porta sem antes autorizar a nova origem no Google Cloud Console.

## Notas

- App é vanilla JS sem build — não há passo de compilação; sirva os arquivos como estão.
- Sirva por HTTP, nunca abra via `file://` (o login e o fetch quebram).
- Leitura da planilha é pública; escrita exige login com uma conta em `ALLOWED_EMAILS` (`apps-script/Code.gs`).
- Ao terminar, encerre o servidor em background.
