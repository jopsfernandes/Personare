# Spec — Issue #16: Motor FSRS — sessão de revisão do Baralho

- **Issue:** [#16](https://github.com/jopsfernandes/Personare/issues/16) — "Motor FSRS: sessão de revisão do Baralho"
- **Corpo da issue:** "Integrar ts-fsrs ao ReviewItem. Tela de sessão de revisão que itera sobre os
  ReviewItems pendentes de um Baralho, capturando o rating do usuário (again/hard/good/easy) e
  atualizando stability/difficulty/due_date. Referência: Plan.md, seções 1.2, 1.3 e Fase 1, item 13."
- **Branch:** `feature/16-motor-fsrs-sessao-revisao`
- **Dependência:** requer a Issue #15 (Flashcard/Baralho) já mergeada — usa a tabela `flashcards` e o
  tipo de Atividade `flashcard_deck` que ela entrega.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico: a biblioteca `ts-fsrs` (v5.4.2, já em `package.json`)

```ts
import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";

const scheduler = fsrs(); // parâmetros default, request_retention 0.9 — não customizar nesta issue
const card = createEmptyCard(); // Card novo, state = State.New

// dado um Card existente + a nota do usuário:
const result = scheduler.next(card, new Date(), Rating.Good);
result.card; // novo Card (stability, difficulty, due, state, reps, lapses, scheduled_days, learning_steps, last_review)
result.log; // ReviewLog dessa revisão específica
```

`Card` (o estado que a biblioteca precisa para agendar corretamente) tem mais campos do que
`review_items` persiste hoje (só `difficulty`/`stability`/`due_date`/`last_rating`/`rating_history`).
Faltam: `state`, `reps`, `lapses`, `scheduled_days`, `learning_steps`, e a data da última revisão
(`last_review`). Sem esses campos, reconstruir o `Card` a cada revisão perderia a distinção entre
cartão Novo/Aprendendo/Revisão/Reaprendendo, que muda como o algoritmo se comporta — **não é seguro
aproximar isso**. `elapsed_days` do `Card` está marcado `@deprecated` na própria lib (será removido na
v6) — não persistir essa coluna; deixar como derivado/não utilizado.

### AC-1 — Migration: completar `review_items` para persistir o `Card` do ts-fsrs

Adicionar em `src/database/schema.ts`, na tabela `reviewItems` já existente:

- `state`: `text` NOT NULL, default `"New"` (armazenar a string `StateType` — `"New" | "Learning" |
  "Review" | "Relearning"` — mesma convenção textual já usada por `activities.type`, não um integer cru).
- `reps`: `integer` NOT NULL, default `0`.
- `lapses`: `integer` NOT NULL, default `0`.
- `scheduledDays` (`scheduled_days`): `integer` NOT NULL, default `0`.
- `learningSteps` (`learning_steps`): `integer` NOT NULL, default `0`.
- `lastReviewedAt` (`last_reviewed_at`): `integer` (`mode: "timestamp"`), **nullable** — mapeia
  `Card.last_review`, que é `undefined` num cartão novo.

Gerar a migration via `drizzle-kit generate` (será a `0005_*.sql`) — nunca editar `drizzle/meta/*` à
mão. A tabela `review_items` está vazia em produção até esta issue (nenhum ReviewItem foi criado por
#12–#15), então não há dado existente para migrar/backfillar.

### AC-2 — `src/utils/fsrs.ts`: módulo puro de conversão, sem I/O

Espelha o espírito de `src/utils/quiz-scoring.ts` (função pura, testável sem banco/IPC). Responsável
por toda a ponte entre a forma como `review_items` é persistida e o tipo `Card` que a biblioteca espera:

- `createInitialReviewItemFields(): ReviewItemInsertFields` — chama `createEmptyCard()` e mapeia os
  campos para o formato de insert de `review_items` (incluindo `dueDate` = `card.due`, que para um
  cartão novo é "agora", tornando-o imediatamente elegível para revisão).
- `toFsrsCard(row: ReviewItemRow): Card` — reconstrói o `Card` completo a partir de uma linha de
  `review_items` (mapeando `state` de volta para o enum `State`, `dueDate` → `due`, `lastReviewedAt` →
  `last_review`, etc.). `elapsed_days` pode ser preenchido com `0` (não utilizado/deprecated).
- `applyRating(row: ReviewItemRow, rating: Grade, now: Date): { card: Card; log: ReviewLog }` — chama
  `fsrs().next(toFsrsCard(row), now, rating)` e retorna o resultado bruto da biblioteca.
- `fromFsrsCard(card: Card): ReviewItemUpdateFields` — extrai de um `Card` atualizado os campos a
  persistir de volta em `review_items` (`difficulty`, `stability`, `dueDate` = `card.due`, `state`,
  `reps`, `lapses`, `scheduledDays`, `learningSteps`, `lastReviewedAt` = `card.last_review`).

`Grade` (de `ts-fsrs`) exclui `Rating.Manual` — só `Again | Hard | Good | Easy` chegam até aqui, nunca
`Manual`.

### AC-3 — Namespace IPC `review`

Novo diretório `src/ipc/review/` (`schemas.ts`, `handlers.ts`, `index.ts`), registrado em
`src/ipc/router.ts` sob a chave `review`.

- **`ensureReviewItems({ activityId })`**: idempotente. Para cada `flashcard` não deletado daquela
  Atividade (Baralho) que ainda não tem um `review_items` correspondente (`LEFT JOIN` + `WHERE
  review_items.id IS NULL`), insere um novo `review_items` usando
  `createInitialReviewItemFields()`. Não retorna nada relevante para a UI usar diretamente — é uma
  etapa de preparação chamada antes de `listDue`.
- **`listDue({ activityId })`**: retorna os `review_items` cujo `flashcardId` pertence a um flashcard
  não deletado daquela Atividade, com `dueDate <= now()`, ordenados por `dueDate` ascendente, cada um
  já incluindo `front`/`back` do flashcard associado (join, não uma segunda chamada — evita N+1 na UI).
  Formato: `{ id, front, back, dueDate, ... }[]` (os demais campos de FSRS não precisam ir para a UI,
  só os necessários para renderizar e depois submeter).
- **`submitRating({ reviewItemId, rating })`**: `rating` é uma das 4 strings `"again" | "hard" | "good"
  | "easy"` (Zod enum — nunca `"manual"`), validadas antes de mapear para o enum `Rating` do ts-fsrs.
  Busca a linha de `review_items`, chama `applyRating`, persiste os campos de `fromFsrsCard`, e ainda
  atualiza `lastRating` (a string do rating aplicado) e `ratingHistory` (ver formato abaixo). Retorna a
  linha atualizada — a UI não precisa dela para nada além de confirmar sucesso.

`ratingHistory` é uma string JSON, um array append-only de `{ rating: "again" | "hard" | "good" |
"easy", reviewedAt: number }` (epoch ms), serializado/desserializado no handler (não no util puro do
AC-2, que só lida com o `Card` da biblioteca).

### AC-4 — `src/components/review-session-dialog.tsx`

Diálogo de sessão de revisão de um Baralho. Ao abrir (`activity` muda para não-nulo): chama
`ensureReviewItems(activity.id)` e então `listDue(activity.id)`, guardando a fila em estado local. Se a
fila vier vazia, mostra uma mensagem de "nada para revisar agora" (nova chave i18n) em vez da UI de
revisão.

Fluxo por item da fila: mostra a frente do flashcard; um clique/toque revela o verso (estado local
`isRevealed`, não precisa persistir nada); com o verso revelado, aparecem os 4 botões de rating
(Again/Hard/Good/Easy). Ao clicar um rating: chama `submitRating(item.id, rating)`, remove o item da
fila local (não precisa reconsultar `listDue` — a fila em memória já reflete o progresso da sessão), e
avança para o próximo item (ou mostra a tela de "sessão concluída" se a fila esvaziar). Nenhum estado de
navegação entre cartões precisa ser persistido além do que `submitRating` já grava — se o diálogo for
fechado no meio, reabrir chama `listDue` de novo e continua de onde os dados do banco indicam
(cartões já avaliados não voltam a aparecer até seu novo `due_date`).

**Fora de escopo nesta tela** (não implementar, evitar scope creep): pré-visualizar os 4 intervalos
resultantes nos botões (`repeat()` em vez de `next()` direto) — Plan.md/a issue não pedem isso; usar
`next()` com o rating já escolhido é suficiente. Também fora de escopo: parâmetros customizados de
`fsrs()` (`request_retention`, `learning_steps`, etc.) — usar o `fsrs()` default, sem configuração.

### AC-5 — Integração na tabela de atividades e na rota

Em `src/components/activities-data-table.tsx`: novo botão condicional para `activity.type ===
"flashcard_deck"` — "iniciar revisão" (ícone `Repeat` de `lucide-react` — distinto do `Layers` já usado
por "gerenciar flashcards" da Issue #15 e do `Play` já usado por "responder quiz"), chamando uma nova
prop `onStartReview`, mesmo padrão condicional de `onManageFlashcards`/`onTakeQuiz`.

Em `src/routes/programs.$programId.modules.$moduleId.tsx`: novo estado local (`activityInReview`) e
handler, montando `ReviewSessionDialog` ao lado dos diálogos já existentes — mesmo padrão de
`activityTakingQuiz`/`handleTakeQuiz`/`handleQuizRunnerOpenChange`.

### Novas chaves i18n (adicionar em `src/localization/i18n.ts`, `en` e `pt-BR`)

`startReviewAction`, `reviewNothingDueMessage`, `revealAnswerAction`, `ratingAgainAction`,
`ratingHardAction`, `ratingGoodAction`, `ratingEasyAction`, `reviewSessionCompleteMessage`. Sugestão de
valores pt-BR: `ratingAgainAction` = "Errei", `ratingHardAction` = "Difícil", `ratingGoodAction` =
"Bom", `ratingEasyAction` = "Fácil" — ajustar se quem escrever os testes achar termo melhor, não é um
detalhe crítico do contrato.

## Fora de escopo (não tocar)

- Qualquer mudança em `flashcard-form-dialog.tsx`/`flashcard-manager-dialog.tsx` (Issue #15) ou no
  fluxo de criação de Flashcard — a criação de `review_items` acontece de forma preguiçosa
  (`ensureReviewItems`), não no momento em que o Flashcard é criado.
- Calendário (Issue #18) — mesmo que `review_items.due_date` seja o dado que uma futura tela de
  calendário vai consultar, não construir nenhuma UI de calendário aqui.
- Notificação do SO (Issue #20).
- Qualquer parâmetro customizado de FSRS, preview de múltiplos outcomes, ou UI de estatísticas de
  progresso — não pedido pela issue.

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED para AC-1 a AC-5 em `src/tests/unit/` (arquivos
   sugeridos: `fsrs-utils.test.ts` para o AC-2 puro, `review-ipc.test.ts` para o AC-3,
   `review-session-dialog.test.tsx` para o AC-4, mais casos novos em `activities-data-table.test.tsx`
   para o AC-5), confirmar que falham pelo motivo certo, commitar, **não implementar produção**.
2. **Desenvolvedor**: implementar o mínimo para fazer todos os testes passarem, sem editar nenhum
   teste, sem alterar `flashcard-form-dialog.tsx`/`flashcard-manager-dialog.tsx`.
3. **Revisor**: rodar a suíte completa (`npm run test:unit`), revisar o diff contra este spec, conferir
   que a migration gerada bate com o schema, que `elapsed_days` não foi persistido, que nenhum parâmetro
   customizado de `fsrs()` foi introduzido, e que Link/PDF/Quiz/Flashcard-CRUD (#12–#15) não foram
   tocados.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #16.
