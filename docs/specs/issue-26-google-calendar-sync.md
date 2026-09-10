# Spec — Issue #26: Sincronização com Google Calendar

- **Issue:** #26 — "Sincronizacao com Google Calendar" (Plan.md seção 5 / Fase 2, item 21).
- **Branch:** `feature/26-google-calendar-sync`
- **Backend:** `Study-Butler-Backend` (repo separado) ganha a maior parte da lógica nova nesta issue —
  o Electron só aciona dois fluxos contra ele. Segue o mesmo padrão já estabelecido pela Issue #25 (OAuth
  login): protocolo `personare://`, JWT bearer, token nunca em texto plano.
- **Decisão do usuário (confirmada antes deste spec)**: a sincronização é **unidirecional** —
  Personare → Google Calendar. Cada `ReviewItem` pendente aparece como evento no Google Calendar do
  usuário; nada vem de volta do Google Calendar para dentro do Personare. Sem lógica de merge/conflito
  (o protocolo de sync multi-dispositivo continua formalmente em aberto, Fase 4).
- **Decisões técnicas desta issue (engenharia dentro do escopo já aprovado)**:
  1. **Mediado pelo backend, não chamado direto do Electron** — o backend é quem guarda o refresh token
     do Google e fala com a API do Calendar; alinhado com o propósito do `Study-Butler-Backend`
     ("autenticação e demais features aproveitadas pelo mobile") — o mobile vai precisar da mesma lógica
     de sync um dia, não faz sentido duplicá-la no cliente.
  2. **Autorização de Calendar é separada do login** — "Entrar com Google" (Issue #25) não pede o escopo
     de Calendar; um botão dedicado "Conectar Google Calendar" (em Configurações → Conta) dispara um
     segundo fluxo OAuth pedindo só `calendar.events` (não o escopo `calendar` completo — AC-checklist da
     Issue #24), com `access_type=offline&prompt=consent` para garantir um `refresh_token` (Google só
     devolve refresh token no primeiro consentimento ou quando `prompt=consent` força re-consentimento).
  3. **Sem sync automático em background** — um botão "Sincronizar agora" na página Calendário
     (`src/routes/calendar.tsx`) aciona a sincronização sob demanda. Não existe infraestrutura de job
     agendado no backend ainda, e a issue não pede isso.
  4. **Reconciliação completa a cada sync**: o backend recebe a lista atual de `ReviewItem`s pendentes
     (`{ id, dueDate, front }`, mesmo shape que `review.listSchedule` já retorna) e reconcilia contra os
     eventos que ele mesmo criou antes (tabela nova `calendar_event_links`) — cria evento para item novo,
     atualiza data/título de evento existente, **apaga** o evento cujo `ReviewItem` não está mais na
     lista recebida (revisão completada ou removida localmente).

## Backend (`Study-Butler-Backend`)

### AC-1 — Novo schema: `google_calendar_connections` e `calendar_event_links`

```ts
googleCalendarConnections: { userId (pk, fk users.id), encryptedRefreshToken (text), createdAt, updatedAt }
calendarEventLinks: { id (pk), userId (fk users.id), reviewItemId (text), googleEventId (text), createdAt, updatedAt }
// índice único em (userId, reviewItemId)
```

### AC-2 — `src/auth/token-crypto.ts`: criptografia do refresh token

AES-256-GCM via `node:crypto`, mesma family de `encryptBackup`/`decryptBackup` já usada no Personare
(`src/utils/backup-crypto.ts`), mas **sem derivação por passphrase humana** — a chave vem direto de um
novo env var `TOKEN_ENCRYPTION_KEY` (32 bytes em hex, alta entropia, gerada uma vez por
`crypto.randomBytes(32).toString("hex")`), já que não há um usuário digitando senha neste fluxo
server-to-server. `encryptToken(plaintext, keyHex)` / `decryptToken(buffer, keyHex)`.

### AC-3 — `src/google/calendar-client.ts` e `src/google/token-refresh.ts`

- `refreshAccessToken(refreshToken): Promise<string>` — `POST
  https://oauth2.googleapis.com/token` com `grant_type=refresh_token`.
- `upsertCalendarEvent({ accessToken, googleEventId, summary, date }): Promise<string>` (retorna o
  `googleEventId`, novo ou existente) e `deleteCalendarEvent({ accessToken, googleEventId })` contra
  `https://www.googleapis.com/calendar/v3/calendars/primary/events[...]`. Evento de dia inteiro (mesmo
  padrão visual da Issue #18 no Personare: `start.date`/`end.date`, sem horário).

### AC-4 — Rotas novas (`src/http/calendarRoutes.ts`)

- **`GET /calendar/connect?redirect_uri=...`** (JWT bearer, igual `/auth/me`): monta a URL de
  autorização do Google com `scope=.../auth/calendar.events`, `access_type=offline`,
  `prompt=consent`, `state = base64({ redirectUri, userId })` (userId já vem do JWT verificado nesta
  rota, não precisa viajar re-verificável dentro do state).
- **`GET /calendar/connect/callback?code=...&state=...`**: decodifica `state`, troca `code` por tokens
  (agora com `refresh_token` garantido), cifra e faz upsert em `google_calendar_connections` por
  `userId`, redireciona para `redirectUri` com `?calendarConnected=true` (ou `?error=...`).
- **`POST /calendar/sync`** (JWT bearer): body `{ reviewItems: { id: string; dueDate: string (ISO);
  front: string }[] }`. Carrega a conexão do usuário (`google_calendar_connections`); se não existir,
  `409` com `{ error: "calendar_not_connected" }`. Atualiza o access token via `refreshAccessToken`,
  depois reconcilia contra `calendar_event_links` (AC-1/decisão 4). Retorna
  `{ created: number; updated: number; deleted: number }`.

## Personare (Electron)

### AC-5 — `src/main.ts`: roteamento do callback por `hostname` da URL do protocolo

`personare://oauth-callback` (login, Issue #25) e `personare://calendar-connect-callback` (esta issue)
compartilham o mesmo protocolo registrado; `handleProtocolCallback(url)` novo faz
`new URL(url).hostname` e despacha para `handleLoginCallback`/`handleCalendarConnectCallback` mantendo
cada handler de Issue isolado, sem misturar a lógica dos dois fluxos.

### AC-6 — Novo namespace de IPC `calendarSync` (`src/ipc/calendar-sync/`)

- **`connect()`**: `shell.openExternal` contra `${BACKEND_BASE_URL}/calendar/connect?redirect_uri=personare://calendar-connect-callback`,
  enviando o JWT da sessão atual como header `Authorization` (chamado direto via `fetch` do processo
  main para montar a URL assinada, já que `shell.openExternal` não permite headers customizados — ver
  nota abaixo).
- **`sync(reviewItems)`**: `POST {BACKEND_BASE_URL}/calendar/sync` com o JWT da sessão, corpo
  `{ reviewItems }`.
- **`getConnectionStatus()`**: estado em memória (`src/ipc/calendar-sync/state.ts`, mesmo padrão de
  `ipc/auth/state.ts`) setado como `true` quando `calendarConnected=true` chega no callback.

> Nota de implementação: como `GET /calendar/connect` exige JWT bearer mas o navegador do sistema não
> manda esse header, o processo main primeiro chama esse endpoint via `fetch` (não `shell.openExternal`)
> só para obter a URL de autorização do Google já montada (o backend responde com
> `{ authorizationUrl }` em vez de um 302 direto, diferente do `/auth/google` da Issue #25, que pode
> redirecionar puro por não exigir JWT) — **aí sim** `shell.openExternal(authorizationUrl)` abre o
> navegador. `AC-4` acima reflete esse contrato (`GET /calendar/connect` retorna JSON, não redirect).

### AC-7 — UI

- Configurações → "Conta": quando logado, botão **"Conectar Google Calendar"** (chama
  `calendarSync.connect()`); mostra "Conectado" quando `getConnectionStatus()` é `true`.
- Página Calendário (`src/routes/calendar.tsx`): botão **"Sincronizar agora"**, habilitado só quando
  conectado; chama `calendarSync.sync(schedule)` com os mesmos dados já carregados via
  `listSchedule`/`toCalendarEvents` (Issue #18); mostra resultado (`N criados, M atualizados, K
  removidos`) ou erro (`calendar_not_connected` → mensagem orientando a conectar primeiro).

## Fora de escopo (não tocar)

- Sync automático/agendado em background — só sob demanda.
- Desconectar o Calendar (revogar acesso) — fica para follow-up.
- Qualquer escopo do Google Drive (Issue #27) ou LGPD (Issue #28).
- Trazer eventos do Google Calendar para dentro do Personare — unidirecional, decisão já confirmada.

## Ordem do pipeline

1. **Testador**: RED no backend (`token-crypto`, `calendar-client`/`token-refresh` com `fetch` mockado,
   rotas `calendar` com tudo mockado) e no Personare (`ipc/calendar-sync`, UI dos dois botões). A
   orquestração de protocolo em `main.ts` (igual Issues #20/#25) é validada manualmente.
2. **Desenvolvedor**: implementar o mínimo; validar manualmente ponta a ponta com credenciais reais —
   Google vai mostrar o aviso "app não verificado" ao pedir o escopo sensível `calendar.events`
   (aceitável em modo Testing, contanto que o usuário esteja na lista de testadores).
3. **Revisor**: confirmar que o refresh token nunca é logado/retornado em nenhuma resposta, que a
   reconciliação apaga de fato eventos órfãos, e que nada do fluxo de login (Issue #25) foi alterado.
4. **Redator de Docs**: `CHANGELOG.md` em ambos os repositórios.
