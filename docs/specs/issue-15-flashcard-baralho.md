# Spec — Issue #15: Atividade tipo Flashcard/Baralho

- **Issue:** [#15](https://github.com/jopsfernandes/Personare/issues/15) — "Atividade tipo Flashcard/Baralho: CRUD de Baralho e Flashcards"
- **Corpo da issue:** "Criação de Atividade tipo Baralho. CRUD de Flashcards (frente/verso no mínimo) dentro
  do Baralho. Baralho é apenas agrupamento de UI/filtro — sem estado FSRS próprio; cada Flashcard é um
  ReviewItem individual. Referência: Plan.md, seção 1.2 e Fase 1, item 12."
- **Branch:** `feature/15-atividade-flashcard-baralho`
- **Sequência:** última de uma série sequencial (não-paralela) de issues de tipo de Atividade
  (#12 Link → #13 PDF → #14 Quiz → **#15 Flashcard/Baralho**, todas fechadas/mergeadas exceto esta).
  A próxima issue do roadmap, #16 (Motor FSRS: sessão de revisão do Baralho), depende desta.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Estado herdado — NENHUMA migration de schema é necessária nesta issue

Diferente de #12/#13/#14 (que precisaram estender `activities` ou criar tabelas novas via
`drizzle-kit generate`), as tabelas `flashcards` e `review_items` **já existem** no schema e já têm
migration aplicada desde `drizzle/0001_chilly_zombie.sql` (schema fundacional do projeto, anterior a
qualquer issue de tipo de Atividade):

```ts
// src/database/schema.ts (já existente, não editar a estrutura)
export const flashcards = sqliteTable("flashcards", {
  activityId: text("activity_id").notNull().references(() => activities.id),
  back: text("back").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  front: text("front").notNull(),
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const reviewItems = sqliteTable("review_items", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  difficulty: real("difficulty").notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  flashcardId: text("flashcard_id").notNull().references(() => flashcards.id),
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  lastRating: text("last_rating").notNull(),
  ratingHistory: text("rating_history").notNull(),
  stability: real("stability").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

O tipo de Atividade `"flashcard_deck"` **já está** em `MVP_ACTIVITY_TYPES` dentro de
`src/components/activity-form-dialog.tsx` desde o boilerplate inicial das issues de Atividade — **não
precisa mudar esse arquivo**. Um Baralho é simplesmente uma `Activity` com `type = "flashcard_deck"`;
nada nela precisa de campo extra (ao contrário de Link/`url` e PDF/`filePath`).

## Fronteira crítica de escopo: `review_items` pertence à Issue #16, não a esta

Plan.md 1.2 diz "cada Flashcard dentro dele é um ReviewItem individual" — mas a **criação** do
`ReviewItem` (com `difficulty`/`stability`/`due_date` inicial calculados) é trabalho de **integrar o
`ts-fsrs`**, que é explicitamente o escopo da Issue #16 ("Motor FSRS: sessão de revisão do Baralho" —
corpo: "Integrar ts-fsrs ao ReviewItem... capturando o rating do usuário... atualizando
stability/difficulty/due_date"). Gerar esses valores manualmente aqui, sem `ts-fsrs`, seria
inventar/chutar o estado inicial do algoritmo — errado e duplicaria trabalho quando #16 for implementada.

**Portanto, o CRUD de Flashcard implementado nesta issue NÃO cria, edita, nem lê `review_items` de
forma alguma.** Um Flashcard criado por esta feature fica sem `ReviewItem` associado até a Issue #16
existir — isso é esperado e correto, não um bug a corrigir aqui.

## O que implementar

Mesmo padrão arquitetural já estabelecido por `src/ipc/quiz/` e `src/ipc/activities/`, mas mais simples
— Flashcard é uma entidade flat (sem sub-entidade como as opções do Quiz).

### AC-1 — Namespace IPC `flashcards`

Novo diretório `src/ipc/flashcards/` (`schemas.ts`, `handlers.ts`, `index.ts`), registrado em
`src/ipc/router.ts` sob a chave `flashcards`. Procedures, espelhando exatamente
`src/ipc/activities/handlers.ts` (list/create/update/softDelete, scoped por FK):

- `list({ activityId })`: retorna os flashcards não deletados daquela Atividade (Baralho), ordenados
  por `createdAt` — mesmo padrão de `activities.list` (filter `eq(activityId)` + `isNull(deletedAt)` +
  `orderBy(asc(createdAt))`).
- `create({ activityId, front, back })`: insere um flashcard associado à Atividade dada. `front` e
  `back` rejeitam string vazia (Zod `.min(1)`), mesma convenção de `createActivityInputSchema`/
  `createQuestion`.
- `update({ id, front, back })`: atualiza texto de frente/verso de um flashcard existente. Mesma
  validação `.min(1)` em ambos os campos.
- `softDelete({ id })`: seta `deletedAt`, não remove a linha — idêntico a `activities.softDelete`.

### AC-2 — `src/actions/flashcards.ts`

Wrappers finos chamando `ipc.client.flashcards.*`, espelhando exatamente
`src/actions/activities.ts` (não `src/actions/quiz.ts` — não há necessidade de uma função de
composição tipo `listQuizQuestionsWithOptions`, pois Flashcard não tem sub-entidade).

### AC-3 — `src/components/flashcard-form-dialog.tsx`

Diálogo de criar/editar UM flashcard por vez. Props: `{ flashcard: FlashcardFormValue | null, open,
onOpenChange, onSubmit }`, onde `FlashcardFormValue = { id: string; front: string; back: string }` e
`onSubmit(front: string, back: string) => void`. Dois campos de texto (`front`/`back`), ambos
obrigatórios (`required` no input, mesma UX de `activity-form-dialog.tsx`'s campo `title` — validação
HTML nativa via `required` é suficiente aqui, não precisa da validação client-side elaborada do
`quiz-question-form-dialog.tsx`, já que não há invariante multi-campo como "exatamente uma opção
correta"). Ao editar, pré-preenche os dois campos a partir de `flashcard`; ao criar, começa vazio.

### AC-4 — `src/components/flashcard-manager-dialog.tsx`

Diálogo que gerencia TODOS os flashcards de um Baralho. Props: `{ activity: Activity | null, open,
onOpenChange }` — mesma forma de `quiz-question-manager-dialog.tsx`. Ao abrir (ou quando `activity`
muda), busca `listFlashcards(activity.id)` e lista cada flashcard mostrando `front` e `back` (ambos
visíveis na linha — isto é uma tela de autoria/gerência de conteúdo, não a tela de revisão; o usuário
precisa ver o que escreveu dos dois lados para revisar/corrigir), com ações de editar/excluir por linha
e um botão "adicionar flashcard". Adicionar/editar abre `FlashcardFormDialog`. Excluir chama
`softDeleteFlashcard`. Submissão do form chama `createFlashcard`/`updateFlashcard` conforme o caso,
depois recarrega a lista — mesmo fluxo de `quiz-question-manager-dialog.tsx`, só que sem a etapa extra
de reconciliar sub-entidades (Flashcard não tem opções).

### AC-5 — Integração na tabela de atividades e na rota

Em `src/components/activities-data-table.tsx`, seguindo o padrão condicional já usado para
`quiz`/`pdf`/`link`: adicionar um botão condicional para `activity.type === "flashcard_deck"` —
"gerenciar flashcards" (ícone `Layers` de `lucide-react`), chamando uma nova prop obrigatória
`onManageFlashcards`, no mesmo formato de `onManageQuiz`.

Em `src/routes/programs.$programId.modules.$moduleId.tsx` (dentro do `<Outlet />` do layout — ver
Issue #60/PR #61, já corrigido): novo estado local (`activityBeingManagedFlashcards` ou nome similar) e
handler, montando `FlashcardManagerDialog` ao lado dos diálogos já existentes (`PdfViewerDialog`,
`QuizQuestionManagerDialog`, `QuizRunnerDialog`) — mesmo padrão de
`activityBeingManaged`/`handleManageQuiz`/`handleQuizManagerOpenChange`.

### Novas chaves i18n (adicionar em `src/localization/i18n.ts`, `en` e `pt-BR`)

`manageFlashcardsAction`, `addFlashcardAction`, `editFlashcardAction`, `deleteFlashcardAction`,
`flashcardFrontLabel`, `flashcardBackLabel`, `flashcardsEmptyMessage`. Reaproveitar
`saveAction`/`cancelAction` já existentes onde servirem, em vez de criar sinônimo (mesma disciplina já
aplicada em #14).

## Fora de escopo (não tocar)

- Qualquer leitura/escrita em `review_items` — pertence inteiramente à Issue #16.
- Integração com `ts-fsrs`, cálculo de `difficulty`/`stability`/`due_date` — Issue #16.
- Tela de sessão de revisão (capturar rating again/hard/good/easy) — Issue #16.
- Qualquer migration/alteração de schema — as tabelas já existem, não gerar `drizzle-kit generate` nesta
  issue a menos que se descubra uma necessidade real não prevista aqui (documentar no PR se acontecer).
- Mudanças em `activity-form-dialog.tsx`, ou no comportamento de Link/PDF/Quiz já entregues.

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED para AC-1 a AC-5 em `src/tests/unit/` (arquivos
   sugeridos: `flashcards-ipc.test.ts`, `flashcard-form-dialog.test.tsx`,
   `flashcard-manager-dialog.test.tsx`, mais casos novos em `activities-data-table.test.tsx`),
   confirmar que falham pelo motivo certo, commitar, **não implementar produção**.
2. **Desenvolvedor**: implementar o mínimo para fazer todos os testes passarem, sem editar nenhum
   teste, sem tocar em `review_items`.
3. **Revisor**: rodar a suíte completa (`npm run test:unit`), revisar o diff contra este spec, procurar
   por vazamento de escopo para a Issue #16 (qualquer menção a `review_items`/`ts-fsrs`/rating é sinal
   de alarme), arquivos esquecidos, regressão em Link/PDF/Quiz.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #15.
