# Spec — Issue #27: Backup via Google Drive

- **Issue:** #27 — "Backup via Google Drive" (Plan.md seção 4 e seção 5 / Fase 2, item 22).
- **Corpo da issue:** "Implementar backup dos dados do usuario na conta do Google Drive, complementar
  ao backup local ja existente (nao substitui)."
- **Branch:** `feature/27-google-drive-backup`
- **Backend:** `Study-Butler-Backend` (repo separado) ganha a maior parte da lógica nova nesta issue,
  mesmo padrão já estabelecido pela Issue #26 (Calendar sync): protocolo `personare://`, JWT bearer,
  token nunca em texto plano. O backend guarda o refresh token do Drive e fala com a API do Drive; o
  Electron só aciona os fluxos contra ele — mesma justificativa da Issue #26 (reaproveitável pelo app
  mobile no futuro).
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Escopo do Drive**: `https://www.googleapis.com/auth/drive.appdata` (App Data oculta) — pasta
     especial invisível na UI normal do Drive do usuário, dedicada a dados de aplicativo. Google
     classifica esse escopo como não-sensível, ao contrário de `drive.file`/`drive`.
  2. **Criptografia**: reaproveita o mesmo envelope cifrado do backup local (Issue #21) —
     `encryptBackup`/`decryptBackup` (AES-256-GCM, `node:crypto`, chave derivada de uma passphrase via
     `scryptSync`). A cifragem/decifragem acontece inteiramente no Electron; o backend só transporta
     bytes já cifrados, nunca vê o conteúdo em claro nem a passphrase.
  3. **Gatilho**: manual, sob demanda — dois botões ("Fazer backup no Drive" / "Restaurar do Drive"),
     mesmo padrão do backup local e do "Sincronizar agora" do Calendar. Sem job agendado.
  4. **Arquivo único, sobrescrito a cada backup** — não há versionamento; cada "Fazer backup no Drive"
     substitui o backup anterior no Drive (mesma semântica de "backup", não "histórico"). Restaurar segue
     a mesma semântica de substituição total já decidida na Issue #21 (importar apaga todo o conteúdo
     local atual e restaura exatamente o que está no arquivo).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico

O backend já tem, da Issue #26, o padrão completo de "conexão OAuth separada do login": tabela
`google_calendar_connections`, `src/auth/token-crypto.ts` (`encryptToken`/`decryptToken`,
`TOKEN_ENCRYPTION_KEY`), `src/google/calendar-oauth.ts` com `exchangeCodeForTokens` e
`revokeGoogleToken` — **ambas já genéricas, não específicas de Calendar** — e o handler de
`DELETE /auth/me` (Issue #28/LGPD) que já revoga o token do Calendar e apaga a conexão ao excluir a
conta. Esta issue estende esses mesmos três pontos para uma segunda conexão (Drive), sem duplicar
`exchangeCodeForTokens`/`revokeGoogleToken` — importa e reaproveita as de `google/calendar-oauth.ts`
diretamente (mesmo arquivo, apesar do nome; não vale a pena renomear/mover só por esta issue).

O Electron já tem, da Issue #21, `src/utils/backup-codec.ts`, `src/utils/backup-crypto.ts` e
`src/utils/backup-data.ts` (puros, sem I/O) usados por `src/ipc/backup/handlers.ts`. Esta issue reaproveita
os três diretamente — a única diferença do fluxo local é o destino dos bytes cifrados (Drive via backend
em vez de um arquivo local escolhido pelo usuário).

## Backend (`Study-Butler-Backend`)

### AC-1 — Novo schema: `google_drive_connections`

```ts
googleDriveConnections: {
  userId (pk, fk users.id),
  encryptedRefreshToken (text),
  driveFileId (text, nullable), // cache do id do arquivo no Drive, evita um GET /files de busca a cada backup
  createdAt, updatedAt
}
```

Mesmo padrão de `google_calendar_connections` (Issue #26 AC-1), incluindo o índice implícito de chave
primária por `userId` (uma conexão por usuário).

### AC-2 — `src/google/drive-oauth.ts`

- `DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"`.
- `buildDriveAuthorizationUrl({ clientId, redirectUri, state }): string` — mesmo formato de
  `buildCalendarAuthorizationUrl` (Issue #26), com `access_type=offline&prompt=consent` para garantir
  `refresh_token`, mas com `DRIVE_SCOPE`.
- Reaproveita `exchangeCodeForTokens` e `revokeGoogleToken` de `google/calendar-oauth.ts` (já genéricas,
  sem nada específico de Calendar) — não duplicar.

### AC-3 — `src/google/drive-client.ts`

Contra `https://www.googleapis.com/drive/v3` e `https://www.googleapis.com/upload/drive/v3`, sempre com
`spaces=appDataFolder`/`parents: ["appDataFolder"]`:

- `findAppDataFileId({ accessToken, fileName }): Promise<string | null>` — `GET /files?spaces=appDataFolder&q=name='<fileName>'`,
  usado só como fallback quando `driveFileId` não está cacheado no banco (ex.: primeiro backup após
  reconectar).
- `uploadAppDataFile({ accessToken, fileId, fileName, data }): Promise<string>` (retorna o `fileId`,
  novo ou existente) — `fileId` nulo faz `POST /upload/drive/v3/files?uploadType=multipart` com
  `parents: ["appDataFolder"]`; `fileId` existente faz
  `PATCH /upload/drive/v3/files/{fileId}?uploadType=media` (só atualiza o conteúdo, não recria).
- `downloadAppDataFile({ accessToken, fileId }): Promise<Buffer>` —
  `GET /files/{fileId}?alt=media`, lê a resposta como `ArrayBuffer`/`Buffer`.

### AC-4 — Rotas novas (`src/http/driveRoutes.ts`)

- **`GET /drive/connect?redirect_uri=...`** (JWT bearer, mesmo contrato de `GET /calendar/connect`):
  monta a URL de autorização do Google com `DRIVE_SCOPE`, `state = base64({ redirectUri, userId })`.
  Retorna `{ authorizationUrl }` (JSON, não redirect — mesmo motivo do Calendar: o navegador do sistema
  não manda o header `Authorization`).
- **`GET /drive/connect/callback?code=...&state=...`**: decodifica `state`, troca `code` por tokens
  (`exchangeCodeForTokens` reaproveitado), cifra o refresh token (`encryptToken`), faz upsert em
  `google_drive_connections` por `userId` (sem popular `driveFileId` ainda), redireciona para
  `redirectUri` com `?driveConnected=true` (ou `?error=...`).
- **`POST /drive/backup`** (JWT bearer): body `{ data: string }` (base64 do buffer cifrado que o
  Electron já produziu com `encryptBackup`). Carrega a conexão do usuário; se não existir, `409` com
  `{ error: "drive_not_connected" }`. Atualiza o access token via `refreshAccessToken` (reaproveitado de
  `google/token-refresh.ts`), faz upload via `uploadAppDataFile` (usando o `driveFileId` cacheado, ou
  `findAppDataFileId` como fallback se nulo), persiste o `driveFileId` retornado de volta em
  `google_drive_connections`. Retorna `204`.
- **`GET /drive/backup`** (JWT bearer): mesma checagem de conexão (`409 drive_not_connected` se não
  conectado). Se `driveFileId` nulo, tenta `findAppDataFileId`; se ainda nulo (nunca fez backup), `404`
  com `{ error: "no_backup_found" }`. Caso contrário, `downloadAppDataFile` e retorna
  `{ data: string }` (base64 do buffer cifrado, tal qual foi enviado — o backend nunca decifra).

### AC-5 — `DELETE /auth/me` (Issue #28): estender para a conexão do Drive

Mesmo tratamento já dado à conexão do Calendar: antes de apagar o usuário, se existir uma
`google_drive_connections` para ele, decifra o refresh token e tenta `revokeGoogleToken` (best-effort,
um `catch` que só loga warning — uma falha de revogação nunca bloqueia a exclusão da conta, mesmo
comportamento já testado para o Calendar). Dentro da mesma `db.transaction`, apaga a linha de
`google_drive_connections` do usuário junto com as demais tabelas já apagadas.

## Personare (Electron)

### AC-6 — `src/constants/index.ts`: novo redirect URI

`DRIVE_CONNECT_REDIRECT_URI = `${OAUTH_PROTOCOL}://drive-connect-callback`` (mesmo padrão de
`CALENDAR_CONNECT_REDIRECT_URI`).

### AC-7 — `src/main/oauth-callback.ts`: `parseDriveConnectCallback`

Mesmo formato de `parseCalendarConnectCallback`, lendo o parâmetro `driveConnected` (`"true"`) em vez de
`calendarConnected`. Tipo de retorno análogo: `{ connected: true } | { error: string } | null`.

### AC-8 — `src/main.ts`: roteamento do callback do Drive

`handleDriveConnectCallback(url)` (espelha `handleCalendarConnectCallback`, chamando
`setDriveConnected(true)`); `handleProtocolCallback` passa a despachar por
`getProtocolCallbackHost(url) === "drive-connect-callback"` além do já existente
`"calendar-connect-callback"`, mantendo `handleLoginCallback` como default — sem alterar nenhum dos dois
fluxos existentes.

### AC-9 — `src/main/backend-client.ts`: três novas funções

- `fetchDriveAuthorizationUrl(token, redirectUri): Promise<string | null>` — espelha
  `fetchCalendarAuthorizationUrl` contra `GET /drive/connect`.
- `uploadDriveBackup(token, data: string): Promise<{ error: string } | { success: true }>` — `POST
  /drive/backup` com `{ data }`; em erro de rede ou resposta não-ok, propaga `{ error: <body.error ??
  "unreachable"> }`.
- `downloadDriveBackup(token): Promise<{ data: string } | { error: string }>` — `GET /drive/backup`; em
  `404`/`409`, propaga o `error` do corpo (`no_backup_found`/`drive_not_connected`); em falha de rede,
  `{ error: "unreachable" }`.

### AC-10 — Novo namespace de IPC/oRPC `driveBackup` (`src/ipc/drive-backup/`)

Estrutura análoga a `src/ipc/calendar-sync/` (`state.ts` com `getDriveConnected`/`setDriveConnected`,
`handlers.ts`, `index.ts`), registrado em `src/ipc/router.ts`:

- **`connect()`**: mesmo padrão de `calendarSync.connect()` — `fetchDriveAuthorizationUrl` com o token
  da sessão e `DRIVE_CONNECT_REDIRECT_URI`, depois `shell.openExternal`.
- **`getConnectionStatus()`**: estado em memória, setado por `handleDriveConnectCallback`.
- **`backup({ passphrase })`**: exige token de sessão (`{ error: "not_logged_in" }` se ausente) —
  `collectBackupData(db)` → `serializeBackup` → `encryptBackup(passphrase)` → `Buffer#toString("base64")`
  → `uploadDriveBackup(token, base64)`. Retorna o resultado tal qual (`{ success: true } | { error }`).
- **`restore({ passphrase })`**: exige token de sessão — `downloadDriveBackup(token)`; se `{ error }`,
  retorna tal qual (não tenta decifrar). Caso contrário, `Buffer.from(data, "base64")` →
  `decryptBackup(passphrase)` (propaga o erro de senha errada/arquivo corrompido tal qual o backup
  local) → `deserializeBackup` → `restoreBackupData(db, ...)` → mesmo `app.releaseSingleInstanceLock();
  app.relaunch(); app.exit(0);` do `backup.importBackup` (Issue #21).

### AC-11 — `src/actions/drive-backup.ts`

Wrappers finos análogos a `src/actions/calendar-sync.ts`/`src/actions/backup.ts`: `connectDrive()`,
`getDriveConnectionStatus()`, `backupToDrive(passphrase)`, `restoreFromDrive(passphrase)`.

### AC-12 — UI: conectar Drive em `src/components/account-section.tsx`

Mesmo padrão do bloco de Calendar já existente no mesmo componente (estado `isDriveConnected`,
`isAwaitingDriveConnect`, `isDriveConsentOpen`, mesmo polling de `POLL_INTERVAL_MS`/`POLL_TIMEOUT_MS`):
botão **"Conectar Google Drive"** → abre `ScopeConsentDialog` (já preparado para isso, ver
`src/components/scope-consent-dialog.tsx`) com `descriptionKey="driveScopeConsentDescription"` e
`titleKey="connectGoogleDriveAction"` → ao confirmar, `connectDrive()` + polling de
`getDriveConnectionStatus()`. Mostra `driveConnectedLabel` quando já conectado, em vez do botão.
`handleAccountDeleted`/`handleLogoutClick` também resetam `isDriveConnected` para `false` (mesma
simetria já aplicada ao Calendar nesses dois handlers).

### AC-13 — UI: seção "Backup no Google Drive" em `src/routes/settings.tsx`

Nova seção abaixo da seção "Backup local" existente (mesmo componente `SettingsPage`), só visível quando
`isDriveConnected` (lido via `getDriveConnectionStatus()` num `useEffect`, mesmo padrão de
`autoStartEnabled`). Dois novos componentes, mesma estrutura de `backup-export-dialog.tsx`/
`backup-import-dialog.tsx`:

- **`DriveBackupDialog`** (dois campos de senha, mesma validação de igualdade de
  `BackupExportDialog`): ao confirmar, chama `backupToDrive(passphrase)` em vez de escolher um
  `filePath` (sem diálogo de arquivo — não há caminho local nesta issue).
- **`DriveRestoreDialog`** (um campo de senha + aviso destrutivo, mesma estrutura de
  `BackupImportDialog`): ao confirmar, chama `restoreFromDrive(passphrase)`. Erro de
  `no_backup_found`/`drive_not_connected`/senha incorreta mostrado de forma amigável (toast/texto),
  sem fechar o diálogo.

## `src/localization/i18n.ts`: novas chaves (en + pt-BR)

`connectGoogleDriveAction`, `driveConnectedLabel`, `waitingForDriveConnectMessage`,
`driveScopeConsentDescription`, `driveBackupSectionTitle`, `driveBackupSectionDescription`,
`backupToDriveAction`, `restoreFromDriveAction`, `driveBackupErrorMessage`,
`driveBackupSuccessMessage`, `driveRestoreErrorMessage`, `driveNoBackupFoundMessage`,
`driveNotConnectedMessage`. Seguir o mesmo tom/estrutura das chaves de Calendar/backup local já
existentes (uma entrada por idioma, ordem alfabética dentro do bloco `translation`).

## Fora de escopo (não tocar)

- Qualquer versionamento/histórico de backups no Drive — sempre um único arquivo sobrescrito.
- Backup/restore automático ou agendado — só sob demanda (decisão já confirmada).
- Trazer para dentro do Personare qualquer outro dado do Drive do usuário além do único arquivo de
  backup — sem listar/gerenciar outros arquivos.
- Desconectar o Drive (revogar acesso) fora do fluxo de exclusão de conta — fica para follow-up, mesmo
  status do Calendar (Issue #26 já deixou isso de fora).
- Qualquer mudança no fluxo de login (Issue #25) ou no Calendar sync (Issue #26) além do necessário para
  reaproveitar `exchangeCodeForTokens`/`revokeGoogleToken`.
- Migrar a lógica de backup local (Issue #21) para dentro deste namespace — `driveBackup` é um namespace
  novo e separado de `backup`, mesmo reaproveitando as mesmas funções puras.

## Ordem do pipeline

1. **Testador**: RED no backend (`drive-client` com `fetch` mockado, rotas `drive` via `app.inject()`
   cobrindo connect/callback/backup/download incluindo os 409/404, `DELETE /auth/me` estendido cobrindo
   a revogação/remoção da conexão do Drive) e no Personare (`ipc/drive-backup` mockando
   `@/main/backend-client` e `electron`, mesmo padrão de `calendar-sync-ipc.test.ts`; UI dos novos
   botões/diálogos, mesmo padrão de `settings-page.test.tsx`/`account-section` existente).
2. **Desenvolvedor**: implementar o mínimo; validar manualmente ponta a ponta com credenciais reais
   (esperado que o escopo `drive.appdata` não exija o mesmo aviso de "app não verificado" que
   `calendar.events`, mas confirmar).
3. **Revisor**: confirmar que o refresh token do Drive nunca é logado/retornado em nenhuma resposta, que
   o backend nunca vê a passphrase nem o conteúdo em claro do backup, que a exclusão de conta revoga e
   apaga a conexão do Drive sem bloquear em caso de falha de revogação, e que nada dos fluxos de login/
   Calendar/backup local foi alterado além do reaproveitamento já previsto.
4. **Redator de Docs**: `CHANGELOG.md` em ambos os repositórios; `.env.example`/`README.md` do backend
   documentando que `ALLOWED_REDIRECT_URIS` deve incluir `personare://drive-connect-callback` (e a
   variante `studybutler://`) e que não há uma env var nova (reaproveita `GOOGLE_CLIENT_ID`/
   `GOOGLE_CLIENT_SECRET`/`TOKEN_ENCRYPTION_KEY` já existentes).
