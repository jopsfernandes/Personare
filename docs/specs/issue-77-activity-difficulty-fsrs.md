# Spec — Issue #77: Agendamento FSRS para Quiz/PDF/Link via dificuldade percebida

- **Issue:** [#77](https://github.com/jopsfernandes/Personare/issues/77) — "Agendamento FSRS para Quiz/PDF/Link via dificuldade percebida"
- **Branch:** `feature/77-activity-difficulty-fsrs`
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Granularidade**: 1 `ReviewItem` por Atividade inteira (quiz/pdf/link), não por sub-conteúdo (não é "questão errada do quiz" nem "trecho do PDF" — isso é a ideia de V2 já registrada como fora de escopo em `Plan.md` 1.2). Reaproveita a mesma escala `again`/`hard`/`good`/`easy` que já alimenta o motor `ts-fsrs` do Flashcard hoje — a mesma tabela `review_items`, o mesmo `submitRating`.
  2. **Gatilho**: botão manual "Marcar como concluído" na row da Atividade, igual para os 3 tipos (quiz/pdf/link) — sem tentar detectar conclusão automaticamente (fechar o viewer do PDF ou o navegador do link não é um sinal confiável). Clicar abre direto o mesmo step de avaliação Again/Hard/Good/Easy.
  3. `flashcard_deck` **não muda**: continua com um `ReviewItem` por Flashcard, sem `ReviewItem` no nível da Atividade — o botão novo não aparece nesse tipo.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico

Hoje `review_items.flashcard_id` é `NOT NULL` — `ReviewItem` só existe para Flashcard (`src/database/schema.ts`, comentário: "it references only the Flashcard that schedules it"). `Plan.md` 1.2 registra explicitamente que Quiz/PDF/Link não geram `ReviewItem` na V1 e deixa em aberto "se e como versões futuras gerarão itens revisáveis a partir delas" — esta issue resolve essa decisão em aberto.

`src/ipc/review/handlers.ts`'s `submitRating` já é agnóstico de origem: opera só em cima de um `reviewItemId` existente, sem nenhuma referência a Flashcard — reaproveitado sem alteração.

### AC-1 — Schema: `review_items` ganha uma segunda origem possível

Migration nova (`npx drizzle-kit generate`) em `src/database/schema.ts`:

- `review_items.flashcard_id` deixa de ser `.notNull()`.
- Nova coluna `review_items.activity_id`, nullable, `references(() => activities.id)`.
- Invariante "exatamente um dos dois preenchido" é validada em app (mesmo padrão de `activities.type`, que também é um discriminador aberto sem CHECK de banco), não em SQL.

### AC-2 — `src/utils/fsrs.ts`

`ReviewItemRow` tinha um `flashcardId: string` obrigatório que nenhuma das funções de FSRS (`toFsrsCard`, `applyRating`, `fromFsrsCard`) de fato lê — é removido da interface, tornando o tipo agnóstico de origem (Flashcard ou Activity). Nenhuma outra função muda.

### AC-3 — `src/ipc/review/` (schemas + handlers)

- **Novo `markActivityDifficulty({ activityId, rating })`**: get-or-create atômico — se não existe `review_items` com `activity_id = activityId`, cria um com `createInitialReviewItemFields()` (igual ao caminho de criação de `ensureReviewItems`); em seguida aplica a rating (mesma lógica de `submitRating`: `applyRating` + histórico) na mesma chamada, para a primeira marcação já valer como uma revisão de verdade, não ficar "criado mas nunca avaliado". Retorna a row atualizada (para a UI já mostrar a próxima `dueDate`/`lastRating` sem round-trip extra).
  - **Achado durante validação manual**: o scheduler default do `ts-fsrs` (`enable_short_term: true`, usado pela revisão de Flashcard) trata cada rating como um passo de "estudo na mesma sessão" — a primeira rating de um card novo agenda a próxima `dueDate` minutos depois (um passo curto de aprendizado), só chegando a um intervalo real de vários dias numa rating seguinte (relatado como um reagendamento de ~2 dias estranho na segunda marcação). Faz sentido pra Flashcard (o usuário treina o mesmo card várias vezes na mesma sessão), não faz sentido pra marcar uma Atividade feita uma vez só. `applyRating` (`src/utils/fsrs.ts`) ganhou um parâmetro `options?: { shortTermEnabled?: boolean }` (default `true`, preserva o comportamento do Flashcard); `markActivityDifficulty` passa `{ shortTermEnabled: false }`, fazendo toda rating (mesmo a primeira) já graduar pra um intervalo real, em dias inteiros.
- **`listSchedule`**: hoje só varre `review_items` → `flashcards` → `activities`. Passa a ser a união de duas branches (`UNION ALL` via `db.select().from(...).unionAll(...)`, mesmo padrão de query builder já usado no resto do arquivo): a existente (via Flashcard) e uma nova (via `activity_id` direto → `modules` → `programs`), ambas projetando o mesmo formato de linha. `front` fica nullable no resultado (só existe no branch de Flashcard); a Activity-branch retorna `front: null`.
- **`listActivityReviewState({ moduleId })`**: nova query só de leitura (para a UI da tabela de Atividades, sem misturar com o namespace `activities` que é CRUD puro) — retorna `{ activityId, lastRating, dueDate }[]` de todo `review_items` com `activity_id` não nulo cujas Atividades pertencem a `moduleId` e não estão soft-deletadas.

### AC-4 — `src/main/due-reviews.ts`

`countDueReviews` hoje faz um `innerJoin` com `flashcards`, o que exclui por construção qualquer `review_items` com `flashcard_id` nulo. Passa a somar as duas branches (Flashcard-scoped, com o filtro de `flashcards.deletedAt` que já existia; Activity-scoped, com o filtro equivalente em `activities.deletedAt`), cada uma com seu próprio `lte(dueDate, now)`.

### AC-5 — `src/actions/review.ts` / `src/actions/calendar.ts`

- Novo `markActivityDifficulty(activityId, rating)` e `listActivityReviewState(moduleId)` em `actions/review.ts`.
- `ScheduleRow.front` vira `string | null`; `toCalendarEvents` usa `row.front ?? row.activityTitle` como `title` do evento (Activity-branch não tem front de Flashcard).

### AC-6 — UI

- **Novo `src/components/activity-difficulty-dialog.tsx`**: mesmo padrão visual/de botões de `review-session-dialog.tsx` (`RATINGS`/`RATING_TRANSLATION_KEYS`, sem o passo de "revelar resposta" — vai direto pros 4 botões Again/Hard/Good/Easy), título usando `activity.title`. Ao confirmar, chama `markActivityDifficulty` e fecha.
- **`src/components/activities-data-table.tsx`**: novo botão ícone "Marcar como concluído" (ex. `CheckCircle2` do lucide) visível só para `type !== "flashcard_deck"` (quiz/pdf/link), nova prop `onMarkDifficulty`. Nova célula na row mostrando o estado atual, quando existir: label da última rating (reaproveita `ratingAgainAction`/etc.) + próxima data de revisão formatada — nada quando a Atividade nunca foi marcada.
- **`src/routes/programs.$programId.modules.$moduleId.tsx`**: busca `listActivityReviewState(moduleId)` junto com `listActivities`, guarda em estado, passa pra tabela; novo estado `activityMarkingDifficulty` + `ActivityDifficultyDialog`, seguindo exatamente o padrão dos outros diálogos já na página (abrir por `useState<Activity | null>`, `onOpenChange` fecha, `onConfirm` chama `refreshActivities` e o refresh do review state).

## Fora de escopo (não tocar)

- Qualquer granularidade mais fina que a Atividade inteira (questões erradas de Quiz, trechos de PDF) — V2, já registrada como aberta em `Plan.md`.
- Detecção automática de conclusão (fechar o viewer do PDF, retorno do navegador do link) — decisão explícita pelo botão manual.
- `flashcard_deck` — comportamento inalterado.
- Sincronização desses novos eventos com o Google Calendar (`calendar-sync`) — a query de `listSchedule` já alimenta `toCalendarEvents`/a visão de Calendário local; se o push pro Google Calendar (Issue #26) deve incluir esses eventos é uma decisão separada, não assumida aqui.

## Ordem do pipeline

1. **Testador**: RED cobrindo AC-1 (migration aplicando limpo, round-trip de `activityId`-only e `flashcardId`-only via `restoreBackupData`/queries diretas), AC-3 (`markActivityDifficulty` idempotente na criação + aplica rating; `listSchedule` retornando as duas branches; `listActivityReviewState`), AC-4 (`countDueReviews` somando as duas branches, excluindo Atividade soft-deletada), componentes de UI (`activities-data-table.test.tsx` cobrindo o botão novo só em quiz/pdf/link e a célula de estado; novo `activity-difficulty-dialog.test.tsx`).
2. **Desenvolvedor**: implementar o mínimo para os testes passarem, sem editar teste nenhum; validar manualmente marcando dificuldade nos 3 tipos e conferindo que a Atividade aparece no Calendário.
3. **Revisor**: suíte completa, confirmar que `flashcard_deck` não regride, que a migration é reversível/aditiva (não quebra dados existentes), que nenhuma query nova é N+1.
4. **Redator de Docs**: `CHANGELOG.md` referenciando a Issue #77.
