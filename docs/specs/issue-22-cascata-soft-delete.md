# Spec — Issue #22: Regra de exclusão/edição de conteúdo com histórico de revisão

- **Issue:** [#22](https://github.com/jopsfernandes/Personare/issues/22) — "Regra de exclusão/edição de conteúdo com histórico de revisão"
- **Corpo da issue:** "Definir e implementar o comportamento ao excluir um Módulo/Atividade/Flashcard que
  possui ReviewItems com histórico de revisão (usar soft-delete, preservando o histórico). Definir o
  que acontece ao editar o conteúdo de um Flashcard que já foi revisado (o histórico permanece
  associado ao ReviewItem, o conteúdo exibido passa a ser o atual). Referência: Plan.md, seção 1.3 e
  Fase 1, item 18."
- **Branch:** `feature/22-cascata-soft-delete`
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Achado ao investigar esta issue: bug real e concreto, não hipotético

Todo `softDelete` do app hoje (`programs`, `modules`, `activities`, `flashcards`, `quiz.softDeleteQuestion`)
seta `deletedAt` **só na própria linha**, sem cascata para as tabelas filhas:

```ts
// src/ipc/modules/handlers.ts — exatamente igual em programs/activities/flashcards/quiz
export const softDelete = os.input(softDeleteModuleInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  db.update(modulesTable).set({ deletedAt: new Date() }).where(eq(modulesTable.id, input.id)).run();
});
```

Isso já causa um bug **visível e reproduzível** na Calendário (Issue #18, já em produção): a query
`listSchedule` filtra só `isNull(flashcardsTable.deletedAt)` — nunca checa `activities.deletedAt`,
`modules.deletedAt`, nem `programs.deletedAt`. Resultado: excluir um Módulo (ou uma Atividade, ou um
Programa) inteiro **não remove seus Flashcards pendentes do Calendário** — eles continuam aparecendo
indefinidamente, mesmo sem nenhum caminho de navegação na UI para chegar até eles de novo.

**A correção correta é cascatear o soft-delete para baixo na hierarquia**, não caçar e corrigir cada
query de listagem uma por uma — isso mantém o invariante simples ("uma linha só aparece se seu próprio
`deletedAt` for `NULL`") válido em todo lugar, incluindo `listSchedule`, sem precisar tocar nela.

## O que implementar

### AC-1 — Cascata de soft-delete: `programs` → `modules` → `activities` → `flashcards`

Ao excluir um **Programa**: seta `deletedAt` no Programa, em todos os seus Módulos (`deletedAt IS
NULL`), nas Atividades desses Módulos (`deletedAt IS NULL`), e nos Flashcards dessas Atividades
(`deletedAt IS NULL`). Mesmo timestamp (`now`) para toda a cascata de uma única chamada.

Ao excluir um **Módulo**: seta `deletedAt` no Módulo, nas suas Atividades, e nos Flashcards dessas
Atividades.

Ao excluir uma **Atividade**: seta `deletedAt` na Atividade e nos seus Flashcards (se for
`flashcard_deck`; para `link`/`pdf`/`quiz` não há Flashcard para cascatear).

**Regra importante**: a cascata só atualiza linhas com `deletedAt IS NULL` — uma linha filha já
excluída independentemente antes (com seu próprio timestamp) **não deve ser sobrescrita** com o
timestamp da cascata do pai. Isso preserva a informação real de quando cada coisa foi de fato excluída.

`review_items` **não é tocado por nenhuma cascata** — não tem coluna `deletedAt` (decisão de design já
existente, não mudar isso aqui) e já fica automaticamente invisível em toda query de review/calendário
assim que o Flashcard associado for corretamente cascateado (`listDue`, `listSchedule`,
`ensureReviewItems` já filtram por `flashcards.deletedAt IS NULL` — o bug estava só na ausência de
cascata, não nessas queries).

**Implementação sugerida**: um módulo compartilhado (ex. `src/ipc/shared/cascade-soft-delete.ts`) com
funções puras de composição reaproveitáveis entre os handlers de `programs`, `modules` e `activities`
(ex. `cascadeSoftDeleteModule(db, moduleId, now)`, `cascadeSoftDeleteActivity(db, activityId, now)`),
para não duplicar a lógica de "Módulo deletado cascateia para Atividade" em dois lugares (uma vez
dentro de `modules.softDelete`, outra vez dentro de `programs.softDelete` ao cascatear cada um de seus
Módulos).

### AC-2 — Mesma cascata para Quiz: `activities` → `quiz_questions` → `quiz_options`

Mesmo bug, mesma causa, achado ao investigar o padrão em `src/ipc/quiz/handlers.ts`:
`softDeleteQuestion` não cascateia para `quiz_options`. Excluir uma Atividade tipo `quiz` deve
cascatear para suas `quiz_questions` (`deletedAt IS NULL`) e, por sua vez, para as `quiz_options`
dessas perguntas (`deletedAt IS NULL`). Mesma regra de não sobrescrever timestamp de exclusão já
existente.

### AC-3 — Editar Flashcard após ter histórico de revisão: já funciona, documentar com teste

`flashcards.update` já só faz `UPDATE flashcards SET front=?, back=? WHERE id=?` — não existe
snapshotting/versionamento em lugar nenhum do app. Isso já satisfaz exatamente o que a issue pede: o
`ReviewItem` continua referenciando o mesmo `flashcardId` (nada nele muda), e qualquer tela que junta
`review_items` com `flashcards` (sessão de revisão, calendário) automaticamente mostra o texto atual,
não uma versão antiga. **Não precisa de nenhuma mudança de código aqui** — só um teste de regressão
que documente e trave esse comportamento explicitamente (edita um Flashcard com um `ReviewItem`
existente, confirma que `stability`/`difficulty`/`dueDate`/`ratingHistory` do `ReviewItem` continuam
intocados, e que `listDue`/`listSchedule` retornam o `front` **novo**, não o antigo).

## Fora de escopo (não tocar)

- Qualquer UI nova — a issue é sobre comportamento de dados, os diálogos de exclusão já existentes
  (`DeleteModuleDialog`, `DeleteActivityDialog`, etc.) continuam chamando exatamente as mesmas
  procedures `softDelete`, só que agora essas procedures cascateiam corretamente por baixo dos panos.
- `review_items` ganhar uma coluna `deletedAt` própria — decisão de design já tomada (Issue #16), não
  reabrir aqui.
- Qualquer mudança em `ratingHistory`/FSRS/`src/utils/fsrs.ts` — este bug é inteiramente sobre
  visibilidade de linhas via `deletedAt`, não sobre o algoritmo de agendamento.
- "Restaurar" um item soft-deletado (undo) — não pedido pela issue, não implementar.

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED cobrindo AC-1, AC-2, AC-3 (estender os arquivos de
   teste de IPC já existentes — `src/tests/unit/modules-ipc.test.ts`, `activities-ipc.test.ts`,
   `flashcards-ipc.test.ts` [se existir; senão verificar o nome real], `quiz-ipc.test.ts`,
   `programs-ipc.test.ts`, mais um novo teste para `review-ipc.test.ts`/`calendar-actions.test.ts`
   cobrindo o cenário concreto do bug: criar Programa → Módulo → Atividade flashcard_deck → Flashcard →
   excluir o Módulo → confirmar que `listSchedule` não retorna mais aquele item). Confirmar RED pelo
   motivo certo, commitar, **não implementar produção**.
2. **Desenvolvedor**: implementar o mínimo para fazer todos os testes passarem, sem editar nenhum
   teste, sem tocar em `src/utils/fsrs.ts` nem em nenhuma UI.
3. **Revisor**: rodar a suíte completa, revisar o diff contra o spec — confirmar que a regra de "não
   sobrescrever `deletedAt` já existente" está implementada corretamente (não só "sempre sobrescreve"),
   confirmar que `review_items` não foi tocado, confirmar que o cenário do bug original (Módulo
   excluído sumindo do Calendário) está coberto por um teste real.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #22, mencionando explicitamente
   que corrige um bug real da Issue #18 (Calendário não escondia itens de Módulos/Atividades excluídos).
