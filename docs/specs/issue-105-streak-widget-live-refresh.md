# Spec — Issue #105: Streak da sidebar não atualiza após avaliar uma Atividade

- **Issue:** #105 — "Streak da sidebar não atualiza após avaliar uma Atividade".
- **Branch:** `feature/105-streak-widget-live-refresh`
- **Motivação:** bug reportado pelo usuário — "acabei de revisar uma atividade e o streak n aumentou
  de 0 para 1". `StreakWidget` (Issue #101) buscava `review.listActivityCounts()` uma única vez, no
  `mount`; como o widget vive fixo no rodapé da sidebar e nunca desmonta durante a navegação, uma
  avaliação feita em qualquer outra tela (página de Atividades de um Módulo, avaliação de um
  Flashcard, ou a Dialog de avaliação pendente montada na raiz do app, Issue #103) não tinha como
  chegar até ele. O contador só refletia a revisão nova reabrindo o app do zero.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Escolhas técnicas (registradas para o Revisor)

- **Pub/sub mínimo (`src/utils/review-events.ts`) em vez de prop-drilling ou um framework de
  store/query-cache**: o app não tem Redux/Zustand/React Query/Context provider para invalidação de
  estado global em nenhum outro lugar do código — introduzir um desses só para este bug seria
  desproporcional. `submitRating` e `markActivityDifficulty` (`src/actions/review.ts`, os dois únicos
  pontos que persistem uma avaliação) chamam `notifyReviewCompleted()` depois que a chamada IPC
  resolve; `StreakWidget` assina via `onReviewCompleted` e refaz o mesmo fetch do `mount`
  (`refreshActiveDates`, extraído para `useCallback` para ser reutilizável nos dois efeitos).
- **Notifica depois da resposta da IPC, não antes**: garante que o refetch do `StreakWidget` só
  aconteça depois que a avaliação já está persistida no SQLite — sem essa ordem, uma race faria o
  refetch buscar dados desatualizados.
- **Sem debounce/coalescing**: `submitRating`/`markActivityDifficulty` já são ações pontuais do
  usuário (uma avaliação por vez), não uma rajada de eventos — um pub/sub sem buffer é suficiente.

## Testes (TDD)

- `src/tests/unit/review-events.test.ts` (novo): pub/sub em isolamento — chama todo listener
  inscrito, para de chamar após `unsubscribe`, não lança com zero listeners, `unsubscribe` de um não
  afeta os demais.
- `src/tests/unit/review-actions.test.ts` (novo): `submitRating`/`markActivityDifficulty` chamam
  `notifyReviewCompleted` depois que a chamada IPC mockada resolve, e ainda retornam o valor original.
- `src/tests/unit/streak-widget.test.tsx`: novo caso RED→GREEN — renderiza com streak 0, dispara
  `notifyReviewCompleted()` com o mock de `listActivityCounts` atualizado, confirma que o contador
  sobe para 1 sem re-renderizar o componente manualmente.
