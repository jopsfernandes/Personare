# Spec — Issue #28: Requisitos de LGPD

- **Issue:** #28 — "Requisitos de LGPD: exclusao de conta, exportacao de dados, consentimento"
  (Plan.md seção 5 / Fase 2, item 23).
- **Branch:** `feature/28-lgpd`
- **Não depende da verificação OAuth do Google** (diferente da #26/#27) — pode ser implementado,
  testado e mergeado de ponta a ponta nesta rodada.
- **Decisões desta issue (engenharia dentro do escopo já descrito no Plan.md, não produto em
  aberto)**:
  1. **"Exclusão de conta" é sobre a identidade no backend (`users` + conexões OAuth), não sobre o
     conteúdo local do Personare.** O Personare é local-first e funciona inteiramente sem login — o
     conteúdo (Programas/Módulos/Flashcards/ReviewItems) já tem seu próprio CRUD/soft-delete por
     entidade e já tem exportação completa via Backup local (Issue #21). "Excluir conta" aqui apaga o
     registro do usuário no `Study-Butler-Backend` (perfil, conexão de Calendar) e desconecta a sessão
     local — não apaga nenhum dado de estudo no SQLite local.
  2. **"Exportação de dados" aqui é a conta no backend, distinta do Backup local (#21).** O backend hoje
     guarda pouco (perfil + status de conexões), então um endpoint simples que devolve esse JSON (sem o
     refresh token, que é credencial, não dado pessoal para exportar) é proporcional. A UI deixa
     explícito que isso é diferente do Backup local (que já exporta todo o conteúdo de estudo).
  3. **Tela de consentimento explícita no próprio Personare, antes de abrir o OAuth do Google.** A tela
     de consentimento do Google (Issue #24) descreve o escopo em inglês/genérico e é fora do nosso
     controle visual; a LGPD exige que o controlador (Personare) informe claramente, na própria
     linguagem do produto, o que cada escopo faz e por quê, com uma ação de concordância explícita,
     antes de redirecionar. Construído de forma genérica (`ScopeConsentDialog`) para já ser reaproveitado
     pela Issue #27 (Drive) quando ela existir — aplicado agora só ao fluxo de Calendar (#26).
  4. **Revogação do token no Google é best-effort.** Ao excluir a conta, além de apagar nossa cópia do
     refresh token, tentamos revogá-lo na Google (`POST https://oauth2.googleapis.com/revoke`) -- se essa
     chamada falhar (rede, token já inválido), a exclusão local continua e não é bloqueada por isso.

## Backend (`Study-Butler-Backend`)

### AC-1 — `GET /auth/me/export` (JWT bearer)

Retorna `{ profile: { id, email, name, avatarUrl, createdAt }, googleCalendarConnected: boolean }`.
Nunca inclui `encryptedRefreshToken` nem qualquer token.

### AC-2 — `DELETE /auth/me` (JWT bearer)

Dentro de uma transaction: apaga `calendar_event_links` do usuário, tenta revogar o refresh token salvo
em `google_calendar_connections` (best-effort, captura e loga qualquer erro, não propaga), apaga a linha
de `google_calendar_connections`, apaga a linha de `users`. Retorna `204`.

## Personare (Electron)

### AC-3 — `src/ipc/auth/`: `exportAccountData()` e `deleteAccount()`

Novos handlers no namespace `auth` já existente: `exportAccountData()` chama
`GET /auth/me/export` e retorna o JSON; `deleteAccount()` chama `DELETE /auth/me` e, em caso de
sucesso, limpa a sessão local exatamente como `logout()` já faz (sessão em memória, token persistido,
flag de Calendar conectado).

### AC-4 — `src/main/backend-client.ts`: `fetchAccountExport`/`deleteAccount`

Funções paralelas a `fetchCurrentUser`, mesmo padrão de `Authorization: Bearer`.

### AC-5 — UI em Configurações → Conta

Dois novos botões, visíveis só quando logado:

- **"Exportar dados da conta"**: chama `exportAccountData()`, abre `dialog.showSaveDialog` (reaproveitar
  `selectBackupExportPath`-like, mas sem exigir passphrase -- é JSON simples, não é o Backup local),
  grava o JSON. Texto explicando que isso é diferente do Backup local (Issue #21).
- **"Excluir minha conta"**: abre um diálogo de confirmação destrutiva (mesmo padrão visual de
  `BackupImportDialog`, Issue #21) explicando claramente o que será apagado (perfil no backend, conexão
  do Calendar) e o que **não** será apagado (todo o conteúdo de estudo local, que continua intacto e
  continua exportável via Backup local). Só confirma com uma ação deliberada.

### AC-6 — `src/components/scope-consent-dialog.tsx` (genérico) + uso no fluxo de Calendar

Componente reutilizável `ScopeConsentDialog({ descriptionKey, open, onCancel, onConfirm })` que mostra um
parágrafo explicando o escopo solicitado e exige "Continuar"/"Cancelar" explícitos. `AccountSection`
passa a abrir esse diálogo ao clicar em "Conectar Google Calendar", só chamando `connectCalendar()`
(Issue #26) depois do "Continuar". Preparado para a Issue #27 reaproveitar com outro `descriptionKey`
quando o Drive backup existir -- não implementado aqui.

## Fora de escopo (não tocar)

- Qualquer coisa do Drive (#27) alem de deixar o `ScopeConsentDialog` pronto para reaproveitar.
- Excluir/exportar conteúdo de estudo local (Programas/Módulos/etc.) -- já resolvido por #21 e pelo
  CRUD/soft-delete existente por entidade.
- Telas de consentimento por escrito/jurídicas (termos de uso, política de privacidade) -- isso é
  conteúdo de produto/jurídico para a Issue #24 (tela de consentimento do Google), não código.

## Ordem do pipeline

1. **Testador**: RED para `DELETE /auth/me`/`GET /auth/me/export` no backend (via `app.inject()`,
   mockando a chamada de revogação), para os novos handlers `auth.exportAccountData`/`deleteAccount` no
   Personare, e para `ScopeConsentDialog` + os dois novos botões em Configurações.
2. **Desenvolvedor**: implementar o mínimo; validar manualmente que excluir a conta de fato limpa a
   sessão local e que a chamada de revogação falhando não impede a exclusão.
3. **Revisor**: confirmar que a exportação de conta nunca inclui token, que a exclusão é atômica, e que
   nenhum dado de conteúdo local é tocado por nenhuma das duas ações.
4. **Redator de Docs**: `CHANGELOG.md` em ambos os repositórios.
