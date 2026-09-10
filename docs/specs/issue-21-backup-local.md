# Spec — Issue #21: Backup local (exportação/importação criptografada)

- **Issue:** [#21](https://github.com/jopsfernandes/Personare/issues/21) — "Backup local (exportacao/importacao criptografada)"
- **Corpo da issue:** "Funcionalidade de exportar todos os dados do usuario para um arquivo local
  criptografado, e de importar esse arquivo de volta. Deve funcionar independente de login Google.
  Referencia: Plan.md, secao 4 e Fase 1, item 17."
- **Branch:** `feature/21-backup-local`
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Criptografia**: `node:crypto` nativo (sem dependência nova) — AES-256-GCM (cifra autenticada,
     detecta arquivo corrompido/adulterado) com a chave derivada de uma passphrase via `scryptSync`
     (parâmetros default do Node: N=16384, r=8, p=1). A passphrase nunca é persistida em disco nem no
     `app_settings` — pedida ao usuário a cada exportação e a cada importação.
  2. **Semântica de importação: substituição total, não mescla.** Importar um backup apaga todo o
     conteúdo local atual (todas as tabelas de negócio) e restaura exatamente o que está no arquivo —
     é "restaurar um backup", não "sincronizar/mesclar dois conjuntos de dados". O protocolo de
     resolução de conflito multi-dispositivo está formalmente em aberto na Fase 4 do `Plan.md`
     (Issues #32/#33) e não deve ser antecipado aqui. Por ser destrutiva, a importação exige
     confirmação explícita do usuário na UI antes de executar.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico

O processo main já expõe `getDatabaseClient()` (`src/ipc/database/state.ts`), usado por todos os
namespaces de IPC existentes. O padrão de diálogo nativo de arquivo já existe em `src/ipc/dialog/`
(`selectPdfFile`, via `electronDialog.showOpenDialog`) — esta issue estende esse namespace com dois
novos handlers de diálogo (escolher onde salvar / qual arquivo abrir), análogos ao existente.

O schema de negócio hoje tem 8 tabelas: `programs`, `modules`, `activities`, `quiz_questions`,
`quiz_options`, `flashcards`, `review_items`, `app_settings` (`health_check` é um placeholder da Fase 0,
sem dado de usuário, e fica fora do backup). Todas usam colunas `integer(..., { mode: "timestamp" |
"timestamp_ms" })`, que o drizzle-orm lê/escreve como objetos `Date` — a serialização para JSON precisa
de um passo explícito de (de)serialização de `Date`, não um `JSON.stringify`/`parse` direto.

### AC-1 — `src/utils/backup-codec.ts` (puro, sem I/O): serialização JSON com suporte a `Date`

`serializeBackup(data: BackupData): string` / `deserializeBackup(json: string): BackupData`, usando um
replacer/reviver de `JSON.stringify`/`JSON.parse` que converte cada `instanceof Date` para
`{ __type: "Date", value: <epoch ms> }` na escrita e de volta para `Date` na leitura. `BackupData` é um
tipo com uma propriedade por tabela (array das linhas lidas via `db.select().from(...).all()`, sem
filtrar `deletedAt` — o backup preserva também linhas soft-deletadas, já que restaurar deve reconstruir
o estado exato do banco) mais `version: 1` e `exportedAt: Date`.

### AC-2 — `src/utils/backup-crypto.ts` (puro, sem I/O): envelope cifrado

- `encryptBackup(plaintext: string, passphrase: string): Buffer` — gera `salt` aleatório (16 bytes) e
  `iv` aleatório (12 bytes), deriva a chave via `scryptSync(passphrase, salt, 32)`, cifra com
  `createCipheriv("aes-256-gcm", key, iv)`. Retorna a concatenação
  `MAGIC (8 bytes: "PSNRBKP1") + salt (16) + iv (12) + authTag (16) + ciphertext`.
- `decryptBackup(buffer: Buffer, passphrase: string): string` — lê os mesmos campos do envelope,
  deriva a chave com o `salt` lido do arquivo, decifra com `createDecipheriv`. Se o `MAGIC` não bater
  (arquivo não é um backup do Personare) ou a verificação do `authTag` falhar (senha errada **ou**
  arquivo corrompido/adulterado — GCM não distingue as duas causas), lança um `Error` com mensagem
  única e genérica (`"Invalid passphrase or corrupted backup file"`) — não dar pista ao chamador de
  qual das duas causas ocorreu.

### AC-3 — `src/utils/backup-data.ts` (lê/escreve o `DatabaseClient`, sem crypto/arquivo)

- `collectBackupData(db: DatabaseClient): BackupData` — um `select().from(table).all()` por tabela das 8
  listadas no AC-1, sem `where`.
- `restoreBackupData(db: DatabaseClient, data: BackupData): void` — dentro de **uma única**
  `db.transaction(...)` (atomicidade: tudo ou nada), apaga todas as linhas das 8 tabelas (`delete(table)`)
  e insere de volta as linhas de `data` (`insert(table).values(data.table)`, pulando o `insert` quando o
  array daquela tabela estiver vazio) — **ordem de delete é inversa à ordem de insert**, respeitando as
  foreign keys existentes (ex.: apagar `review_items`/`flashcards` antes de `activities`; inserir
  `programs` antes de `modules` antes de `activities` etc.).

### AC-4 — Novos handlers em `src/ipc/dialog/`

- **`selectBackupExportPath()`**: `electronDialog.showSaveDialog` com
  `filters: [{ name: "Personare Backup", extensions: ["personare-backup"] }]` e `defaultPath` sugerindo
  `personare-backup-<YYYY-MM-DD>.personare-backup`. Retorna o path escolhido ou `null` se cancelado
  (mesmo contrato de `selectPdfFile`).
- **`selectBackupImportFile()`**: `electronDialog.showOpenDialog` com `properties: ["openFile"]` e o
  mesmo filtro de extensão. Retorna o path escolhido ou `null` se cancelado.

### AC-5 — Novo namespace de IPC/oRPC `backup` (`src/ipc/backup/`)

- **`exportBackup({ filePath: string, passphrase: string })`**: `collectBackupData` → `serializeBackup`
  → `encryptBackup` → `fs.writeFileSync(filePath, buffer)`. Sem retorno (lança se qualquer etapa
  falhar, ex. caminho sem permissão de escrita).
- **`importBackup({ filePath: string, passphrase: string })`**: `fs.readFileSync(filePath)` →
  `decryptBackup` (propaga o erro de senha/arquivo corrompido tal qual) → `deserializeBackup` →
  `restoreBackupData`. Ao final, com sucesso, chama `app.relaunch(); app.exit(0);` (de `"electron"`) —
  garante um processo e um renderer totalmente novos lendo o banco já restaurado, em vez de tentar
  invalidar manualmente todo cache de query do TanStack Query da sessão atual.

### AC-6 — UI: nova seção "Backup local" em `src/routes/settings.tsx`

Dois botões, cada um abrindo um `Dialog` (shadcn, mesmo padrão de `flashcard-manager-dialog.tsx`):

- **"Exportar backup"**: formulário com dois campos de senha (`passphrase`, `confirmPassphrase`) — o
  submit só é permitido quando os dois campos são iguais e não-vazios. Ao confirmar: chama
  `dialog.selectBackupExportPath()`; se não cancelado, chama `backup.exportBackup({ filePath,
  passphrase })`; mostra sucesso (toast) ou erro.
- **"Importar backup"**: ao clicar, chama `dialog.selectBackupImportFile()` primeiro; se não cancelado,
  abre o diálogo com um campo de senha e um aviso explícito de que a importação **substitui todos os
  dados atuais** (texto claro, ex.: "Isso vai apagar todo o conteúdo atual do app e substituir pelo
  conteúdo do arquivo selecionado. Essa ação não pode ser desfeita."), exigindo uma ação de confirmação
  deliberada (ex. checkbox "Entendo que isso substitui meus dados atuais" antes do botão de confirmar
  ficar habilitado) antes de chamar `backup.importBackup({ filePath, passphrase })`. Erro de
  senha/arquivo corrompido é mostrado de forma amigável (toast), sem fechar o diálogo, permitindo tentar
  de novo.
- Parágrafo introdutório explicando em linguagem simples o que a seção faz, seguindo o mesmo tom de
  `navSettings`/auto-start (Issue #20).

## Fora de escopo (não tocar)

- Backup via Google Drive (Fase 2, Issue #27) — esta issue é só o fallback local.
- Qualquer protocolo de resolução de conflito/mesclagem multi-dispositivo (Fase 4, Issues #32/#33) —
  importação aqui é sempre substituição total, nunca merge.
- Agendamento automático/periódico de backup — a issue pede só exportação/importação manual sob
  demanda.
- Lembrar/armazenar a passphrase entre sessões (ex. keychain do SO) — pedida a cada operação.
- Migrar `backup.exportBackup`/`importBackup` para rodar fora do processo main, ou qualquer otimização
  de streaming para arquivos muito grandes — volume de dados do app (texto) não justifica isso no MVP.
- Tocar em `health_check` (placeholder da Fase 0, sem dado de usuário).

## Ordem do pipeline

1. **Testador**: testes RED cobrindo AC-1 (round-trip `serializeBackup`/`deserializeBackup` preservando
   `Date`), AC-2 (round-trip `encryptBackup`/`decryptBackup`; `decryptBackup` lança com passphrase errada
   e com buffer corrompido/truncado), AC-3 (`collectBackupData`/`restoreBackupData` contra um
   `DatabaseClient` real via `createDatabaseClient`+`runMigrations`, cobrindo a hierarquia completa
   Programa→Módulo→Atividade→Flashcard→ReviewItem e confirmando que linhas soft-deletadas também
   sobrevivem ao round-trip, e que `restoreBackupData` é atômica — uma falha no meio não deixa o banco
   pela metade), testes de IPC para `dialog.selectBackupExportPath`/`selectBackupImportFile` (mockando
   `electron`'s `dialog`, padrão de `dialog-ipc.test.ts`) e para `backup.exportBackup`/`importBackup`
   (mockando `node:fs` e `electron`'s `app.relaunch`/`app.exit`, padrão de `settings-ipc.test.ts`
   mockando `electron`). Confirmar RED pelo motivo certo, commitar, não implementar produção.
2. **Desenvolvedor**: implementar o mínimo para os testes passarem, sem editar teste nenhum, e
   **validar manualmente** (app empacotado real): exportar um backup, fechar o app, apagar/mover o
   arquivo `.sqlite` local (ou criar conteúdo novo), importar o backup de volta, confirmar que o app
   reinicia e mostra exatamente o conteúdo restaurado; confirmar que uma senha errada na importação
   mostra erro claro sem corromper o banco atual.
3. **Revisor**: rodar a suíte completa, revisar o diff contra o spec, confirmar que a importação é
   atômica (transaction única), que a ordem de delete/insert respeita FKs, que a passphrase nunca é
   logada/persistida, e que nenhuma mudança foi feita em `review.listDue`/`listSchedule` ou nas demais
   procedures de IPC existentes.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #21, documentando o formato do
   arquivo (`.personare-backup`, AES-256-GCM, substituição total na importação) e o relançamento
   automático do app após importar com sucesso.
