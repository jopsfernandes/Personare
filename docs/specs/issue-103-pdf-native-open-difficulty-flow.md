# Spec — Issue #103: PDF nativo + unificação do fluxo de avaliação de dificuldade

- **Issue:** #103 — "PDF abre Dialog vazia; unificar fluxo de abertura com avaliação de dificuldade".
- **Branch:** `feature/103-pdf-native-open-difficulty-flow`
- **Motivação:** `PdfViewerDialog` renderiza um iframe apontando para `` `file://${activity.filePath}` ``,
  que fica em branco por dois motivos independentes: (1) `filePath` vem do diálogo nativo do SO com
  barras invertidas e sem drive-letter prefixado por `///` (`C:\Users\...` vira uma URL inválida ao
  ser simplesmente concatenada), e (2) mesmo com a URL corrigida, `src/main.ts` não habilita
  `webPreferences.plugins`, então o plugin de PDF do Chromium não estaria disponível de qualquer
  forma. Em vez de corrigir o viewer embutido, a correção pedida é abrir o PDF nativamente no SO
  (`shell.openPath`), do mesmo jeito que Link já faz (`shell.openExternal`) — e aproveitar a mudança
  para unificar como a Dialog de Dificuldade (Issue #77) é acionada para os três tipos
  quiz/pdf/link.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. PDF abre nativamente no SO, igual Link.
  2. Para PDF e Link, o botão separado de "marcar como feito" (✓) é **removido** — o próprio clique em
     "abrir" já é o gatilho; ao o usuário voltar para o app (foco da janela), a Dialog de Dificuldade
     abre sozinha.
  3. Isso também se aplica ao Quiz: ao finalizar o quiz e fechar a `QuizRunnerDialog` (depois de ver o
     resultado), a Dialog de Dificuldade abre instantaneamente — sem esperar foco de janela, já que o
     usuário nunca saiu do app. O botão separado de "marcar como feito" também some para Quiz.
  4. Se o app for fechado antes de avaliar, reabrir a Dialog de Dificuldade imediatamente na próxima
     abertura do app, para a atividade pendente.
  5. A Dialog de Dificuldade passa a mostrar nome do Programa, do Módulo e da Atividade.
  6. `flashcard_deck` não é afetado — continua com seu próprio fluxo de revisão por Flashcard
     (`onStartReview`/`ReviewSessionDialog`), sem `review_items` por Atividade inteira.

## Escolhas técnicas (registradas para o Revisor)

- **`pending_activity_ratings` (tabela nova)**: `review_items` de Atividade (Issue #77) é
  get-or-created-e-avaliado atomicamente em `markActivityDifficulty` — nunca existe uma linha
  "aguardando avaliação" ali (ver `docs/specs/issue-77-activity-difficulty-fsrs.md`: "there is no
  separate 'ensure' step"). Sobreviver a um fechamento do app *antes* de avaliar exige então um
  registro separado e durável de "esta Atividade foi aberta/finalizada e ainda não foi avaliada" —
  não reaproveitável de `review_items` sem quebrar essa invariante em uso por
  `listActivityReviewState`/heatmap/contagem de streak. Nova tabela, mesmo espírito de
  `app_settings` (schema pequeno, singular por finalidade): `activityId` (PK, FK
  `activities.id`) + `createdAt`. Uma linha por Atividade pendente (não um singleton — nada impede o
  usuário de abrir PDF de uma Atividade e, antes de voltar, abrir outra).
- **Sem endpoint novo para "review log"**: não precisa; `pending_activity_ratings` é ortogonal a
  `review_items`/`ratingHistory`.
- **Dois gatilhos distintos para abrir a Dialog, um só ponto de persistência**: o clique em
  "abrir" (PDF/Link) sempre grava o registro pendente no banco *imediatamente* (`armPendingActivityRating`,
  chamado no clique, não no retorno de foco) — assim ele sobrevive mesmo que o usuário feche o app
  inteiro sem nunca voltar a focar a janela do Personare enquanto ainda está no PDF/navegador externo.
  A abertura da Dialog em si, porém, é decidida por dois caminhos independentes e não excludentes:
  1. **Mesma sessão, PDF/Link**: um listener de `window.addEventListener("focus", ...)` na própria
     rota de Atividades (`programs.$programId.modules.$moduleId.tsx`) — a mesma rota de onde o clique
     partiu, já que abrir um arquivo/link externamente não navega para outro lugar do app — abre a
     Dialog assim que a janela reganha o foco, usando o objeto `Activity` já em mãos (sem nova
     consulta). Não é acionado por qualquer foco (ex.: alt-tab por outro motivo durante a mesma
     sessão): só dispara uma vez, para o próximo foco após um clique de abrir, via uma ref em memória
     que é limpa assim que consumida.
  2. **Mesma sessão, Quiz**: `QuizRunnerDialog` ganha uma prop `onFinished`, chamada quando a própria
     Dialog fecha (`onOpenChange(false)`, por X/Escape/clique fora) e o quiz já tinha sido finalizado
     (`result !== null`) — não quando abandonado no meio. A rota reage abrindo a Dialog de Dificuldade
     na hora, sem esperar foco (o usuário nunca saiu do app).
  3. **Entre sessões (app foi fechado)**: `src/routes/__root.tsx` consulta
     `review.getPendingActivityRating()` uma única vez ao montar (equivalente, em espírito, a
     `notifyDueReviewsIfAny` em `src/main/due-reviews.ts`, que também reage a estado persistido no
     boot -- mas aqui a reação é abrir uma Dialog, não uma notificação do SO) e, se houver algo
     pendente, abre a Dialog de Dificuldade imediatamente, para qualquer rota em que o app tenha
     restaurado -- por isso esse checador vive na raiz (`__root.tsx`), não na rota de Atividades (que
     só é montada se o usuário estiver navegando dentro daquele Módulo específico).
  - Avaliar com sucesso (`markActivityDifficulty`) sempre limpa o registro pendente
    (`clearPendingActivityRating`), de dentro do próprio `ActivityDifficultyDialog` -- funciona
    igual não importa qual dos três gatilhos abriu a Dialog.
- **`ActivityDifficultyDialog` não recebe mais um `Activity` inteiro**: agora é aberto tanto pela rota
  de Atividades (que tem o `Activity` completo em mãos) quanto pela raiz do app (que só tem o que
  `getPendingActivityRating()` devolve -- id/título da atividade + nomes de módulo/programa, sem
  `filePath`/`url`/`moduleId` etc.). Os props viram `activityId`, `activityTitle`, `moduleName`,
  `programName` (primitivos), não mais `activity: Activity | null` -- evita inventar um `Activity`
  parcial/fake só para satisfazer o tipo antigo.
- **Sem tooltip/mudança de UI para "erro ao abrir o PDF"**: `shell.openPath` retorna uma mensagem de
  erro (string) em vez de lançar. Se vier não-vazia (ex.: arquivo movido/apagado), a Atividade
  simplesmente não é armada como pendente (nada foi de fato aberto) -- sem toast/alerta novo, fora de
  escopo (o app não tem esse tipo de notificação de erro em lugar nenhum hoje).

## AC-1 — `src/database/schema.ts` + migration: `pending_activity_ratings`

```ts
export const pendingActivityRatings = sqliteTable("pending_activity_ratings", {
  activityId: text("activity_id").notNull().primaryKey().references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

Migration via `npx drizzle-kit generate`.

## AC-2 — `src/ipc/shell/handlers.ts`: `openPath`

```ts
export const openPath = os
  .input(z.object({ path: z.string() }))
  .handler(async ({ input }) => {
    const errorMessage = await shell.openPath(input.path);
    return { errorMessage: errorMessage || null };
  });
```

Registrado em `src/ipc/shell/index.ts`. `src/actions/shell.ts` ganha `openActivityFile(path: string)`.

## AC-3 — `src/ipc/review/handlers.ts`: pending-rating

```ts
export const armPendingActivityRating = os
  .input(z.object({ activityId: z.string() }))
  .handler(({ input }) => { /* insert-if-not-exists */ });

export const clearPendingActivityRating = os
  .input(z.object({ activityId: z.string() }))
  .handler(({ input }) => { /* delete */ });

export const getPendingActivityRating = os.handler(() => {
  /* oldest pending row, inner-joined activities -> modules -> programs,
     isNull(deletedAt) em todos os três (mesmo filtro de
     listActivityReviewState) -- retorna null se não houver nenhum */
});
```

Retorno de `getPendingActivityRating`: `{ activityId, activityTitle, moduleName, programName } | null`.
`src/actions/review.ts` ganha os três wrappers correspondentes.

## AC-4 — `src/components/activity-difficulty-dialog.tsx` (props trocados)

```ts
interface ActivityDifficultyDialogProps {
  activityId: string | null;
  activityTitle: string;
  moduleName: string;
  onOpenChange: (open: boolean) => void;
  onRated: () => void;
  open: boolean;
  programName: string;
}
```

`DialogTitle` continua `activityTitle`; nova `DialogDescription` mostra
`t("activityDifficultyContextLabel", { moduleName, programName })`. Ao avaliar com sucesso, chama
`clearPendingActivityRating(activityId)` antes de `onOpenChange(false)`/`onRated()`.

## AC-5 — `src/components/quiz-runner-dialog.tsx`: `onFinished`

Nova prop `onFinished: (activity: Activity) => void`. O `onOpenChange` do `Dialog` interno passa a
interceptar: se `nextOpen === false` e `result !== null` e `activity` existir, chama
`onFinished(activity)` antes de delegar para o `onOpenChange` do chamador.

## AC-6 — `src/components/activities-data-table.tsx`

- Remove `MARKABLE_ACTIVITY_TYPES`, a prop `onMarkDifficulty` e o botão "marcar como feito"
  (`CheckCircle2`/`markActivityDoneAction`) por completo.
- Nova prop `onOpenLink: (activity: Activity) => void`, chamada em `handleOpenUrlClick` **além** da
  chamada já existente a `openExternalLink(activity.url)` (que continua ali, inalterada) -- só avisa o
  chamador que o link foi aberto, para ele armar o pendente.
- `onViewPdf` mantém a mesma assinatura; quem muda é a implementação do lado da rota (deixa de abrir
  `PdfViewerDialog`, passa a chamar `openActivityFile` + armar o pendente).

## AC-7 — `src/routes/programs.$programId.modules.$moduleId.tsx`

- Remove `PdfViewerDialog` e todo o estado associado (`activityBeingViewed`,
  `handlePdfViewerOpenChange`).
- `handleViewPdf(activity)`: `openActivityFile(activity.filePath)`; se `errorMessage` vier nulo,
  `armPendingActivityRating(activity.id)` e guarda `activity` numa `ref` ("armado, aguardando
  próximo foco").
- Nova `handleOpenLink(activity)` (prop `onOpenLink`): mesma lógica de armar + guardar na ref (sem
  reabrir o link -- isso já acontece dentro da própria `ActivitiesDataTable`).
- Novo `useEffect` registra `window.addEventListener("focus", ...)`: se a ref tiver uma Atividade
  armada, abre `ActivityDifficultyDialog` para ela e limpa a ref.
- Nova `handleQuizFinished(activity)` (prop `onFinished` do `QuizRunnerDialog`): arma o pendente e
  abre a Dialog de Dificuldade na hora (sem esperar foco).
- Remove `onMarkDifficulty`/`handleMarkDifficulty` (o botão que os disparava não existe mais).
- `ActivityDifficultyDialog` passa a receber `activityId`/`activityTitle` (derivados do
  `Activity` já guardado em estado) e `programName`/`moduleName` (já buscados nesta rota para o
  breadcrumb -- reaproveitados, sem nova consulta).

## AC-8 — `src/routes/__root.tsx`

Ao montar, chama `getPendingActivityRating()` uma vez; se vier não-nulo, renderiza
`ActivityDifficultyDialog` (mesmo componente do AC-4) com os dados retornados, `open={true}`, ao lado
do `<Outlet />`, para aparecer não importa em qual rota o app tenha restaurado.

## Remoções

- `src/components/pdf-viewer-dialog.tsx` e `src/tests/unit/pdf-viewer-dialog.test.tsx` (o viewer
  embutido deixa de existir).
- Chaves i18n órfãs: `markActivityDoneAction`, `pdfViewerFrameTitle` (`en`/`pt-BR`).

### Novas chaves i18n (`en` e `pt-BR`)

`activityDifficultyContextLabel` (interpola `{{programName}}`/`{{moduleName}}`).

## Fora de escopo

- Notificação/alerta de UI quando `shell.openPath` falha (arquivo movido/apagado) -- a Atividade
  simplesmente não é armada como pendente.
- Suporte a múltiplas Dialogs de Dificuldade pendentes simultâneas na tela -- `getPendingActivityRating`
  sempre resolve para uma por vez (a mais antiga); as demais aparecem em aberturas seguintes do app,
  uma de cada vez, à medida que cada uma é avaliada.
- Qualquer mudança em `flashcard_deck` (segue com seu próprio fluxo, `onStartReview`).
- Reabrir a Dialog de Dificuldade se o usuário só minimizar/restaurar a janela sem nunca ter aberto
  um PDF/Link primeiro (a ref em memória some com o remount da rota; o registro persistido só é
  consultado uma vez, no boot do app, não em todo foco de janela).

## Ordem do pipeline

1. **Testador**: cobrir `armPendingActivityRating`/`clearPendingActivityRating`/`getPendingActivityRating`
   (mirroring `review-ipc.test.ts`), `shell.openPath` (novo `shell-ipc.test.ts`), o novo prop
   `onOpenLink` em `activities-data-table.test.tsx` (mantendo os testes existentes de
   `openExternalLink`), a remoção do botão de marcar-feito, os novos props de
   `activity-difficulty-dialog.test.tsx`, e `onFinished` em `quiz-runner-dialog.test.tsx`
   (finalizado -> fechado -> chamado; abandonado -> fechado -> não chamado). Confirmar RED, commitar.
2. **Desenvolvedor**: implementar até GREEN, depois validar manualmente: abrir um PDF de verdade
   (visualizador padrão do Windows abre), voltar o foco para o Personare e ver a Dialog de
   Dificuldade abrir sozinha com Programa/Módulo/Atividade corretos; repetir para Link; finalizar um
   Quiz e fechar a Dialog de resultado; fechar o app com uma avaliação pendente e reabrir.
3. **Revisor**: `npm run test:unit`, `npm run test:e2e` (a rota de Atividades e a raiz do app
   mudaram), `npm run check`.
4. **Redator de Docs**: `CHANGELOG.md`.
