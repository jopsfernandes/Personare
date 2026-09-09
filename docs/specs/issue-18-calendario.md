# Spec — Issue #18: Calendário — visão de lista/mês das próximas revisões

- **Issue:** [#18](https://github.com/jopsfernandes/Personare/issues/18) — "Calendário: visão de lista/mês das próximas revisões"
- **Corpo da issue:** "Página de Calendário acessível pela Sidebar, exibindo os ReviewItems pendentes
  filtrados por due_date em uma visão simples de lista ou mês. Não implementar drag-and-drop nem
  múltiplas visualizações nesta fase. Referência: Plan.md, seção 3 e Fase 1, item 15."
- **Branch:** `feature/18-calendario`
- **Dependência:** requer a Issue #16 (Motor FSRS) já mergeada — usa `review_items`/`ipc/review`.
- **Decisão do usuário (não deduzida, confirmada antes deste spec)**: usar o componente **`EventCalendar`
  da ReUI** (registry `@reui/event-calendar`, MCP já autenticado). Duas perguntas de produto foram
  resolvidas diretamente com o usuário: (1) visão — **as duas, Mês e Agenda/Lista, com um seletor
  mínimo** entre só essas duas (não a lista completa de views que o componente suporta); (2)
  granularidade — **um evento de calendário por `ReviewItem`** (não agregado por Baralho).
- **Metodologia:** Spec Driven Development + TDD (Red-Driven-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico: `@reui/event-calendar`

Componente headless-first (`@base-ui/react` + `date-fns` + `@date-fns/tz`), instalado via
`npx shadcn@latest add @reui/event-calendar` (o registry `@reui` já está configurado em
`components.json`, adicionado automaticamente na primeira instalação — não precisa configurar nada
antes). Traz consigo várias views (mês/semana/dia/N-dias/agenda/recurso), drag-and-drop, recorrência,
fusos horários — **muito mais do que esta issue precisa**, mas é composicional: dá para usar só o
subconjunto necessário sem tocar no que não se usa.

Fatos verificados (via `mcp__reui__validate_usage` e a documentação real do componente, não chutados):

- **`interactions` (drag/resize/selectSlot) tem default `true` nos três** — para satisfazer "não
  implementar drag-and-drop", é obrigatório passar explicitamente
  `interactions={{ drag: false, resize: false, selectSlot: false }}` no `<EventCalendar>`. Além disso,
  cada `CalendarEvent` gerado deve levar `readOnly: true` (campo documentado do tipo `CalendarEvent`) —
  redundante com `interactions`, mas é a segunda camada de garantia contra edição acidental.
- **`views` é uma prop real e documentada** (`mcp__reui__validate_usage` confirmou) que restringe a
  lista de views resolvida pelo `EventCalendarViewSwitcher`. Passar `views={["month", "agenda"]}` no
  `<EventCalendar>` restringe o seletor a só essas duas — nenhuma view de grade de tempo (semana/dia/
  N-dias) nem a view de recursos aparece.
- **Não existe uma prop `onEventClick` documentada.** A forma correta e oficialmente demonstrada de reagir
  a um clique num evento é customizar o conteúdo do chip via a prop `renderEvent` (real, usada nos
  exemplos oficiais) — o elemento retornado por `renderEvent` é livre para incluir seu próprio
  `onClick`, chamando `navigate(...)` do TanStack Router.
- O `CalendarEvent` exige `start`/`end` (`end` exclusivo). Para um evento de um dia inteiro:
  `allDay: true`, `start: dueDate`, `end: addDays(dueDate, 1)` — mesmo padrão do exemplo oficial de
  evento de dia único.
- A raiz `<EventCalendar>` precisa de altura explícita (não tem altura intrínseca) — usar `className="h-full"`
  já que a página de rota (como as outras já existentes) fica dentro de `<main className="h-screen ...">`.
- Composição mínima confirmada pelos exemplos oficiais:
  ```tsx
  <EventCalendar
    defaultEvents={events}
    defaultView="month"
    views={["month", "agenda"]}
    interactions={{ drag: false, resize: false, selectSlot: false }}
    renderEvent={renderEventContent}
    className="h-full"
  >
    <EventCalendarNav />
    <EventCalendarContent />
  </EventCalendar>
  ```

### AC-1 — Instalar o componente

Rodar `npx shadcn@latest add @reui/event-calendar` (não usar `--yes`/`-y` sem supervisão — se algum
arquivo já existente do projeto for oferecido para sobrescrita, **recusar** e resolver manualmente; não
deve haver nenhuma colisão esperada, já que nenhum componente `calendar`/`popover`/`scroll-area` do
shadcn/base foi instalado antes desta issue). Isso cria `src/components/reui/event-calendar/*` e
adiciona `date-fns`, `@date-fns/tz`, `@base-ui/react` a `package.json` — depois de instalar, rodar
`npm ci` (não `npm install`) para validar que o lockfile ficou consistente, conforme `CONTRIBUTING.md`.

### AC-2 — Extensão do namespace IPC `review` (Issue #16, já existente)

`src/ipc/review/handlers.ts`/`schemas.ts` já têm `ensureReviewItems({ activityId })`, `listDue({
activityId })`, `submitRating(...)`. Esta issue estende, **sem quebrar o contrato existente** (usado
pelo `review-session-dialog.tsx` da Issue #16):

- **`ensureReviewItemsInputSchema`**: tornar `activityId` opcional (`z.string().optional()`). No
  handler, quando `activityId` for `undefined`, aplicar a mesma lógica de "flashcards sem
  `review_items`" só que **sem** o filtro `eq(flashcardsTable.activityId, ...)` — isto é, cobrir TODOS
  os flashcards não deletados do app, não só os de uma Atividade. Isso garante que decks nunca revisados
  ainda apareçam no calendário (sem isso, um Flashcard recém-criado não tem `due_date` nenhum).
- **Nova procedure `listSchedule` (sem input)**: retorna TODOS os `review_items` cujo flashcard não
  está deletado, **sem** o filtro `lte(dueDate, now)` que `listDue` tem (o calendário precisa mostrar
  revisões futuras também, não só as já vencidas — essa é a diferença chave em relação a `listDue`, que
  continua existindo e intocada, usada só pela sessão de revisão). Faz join adicional até `modules` e
  `programs` para trazer os dados de navegação. Formato de retorno por linha: `{ id, dueDate, front,
  activityId, activityTitle, moduleId, programId }`.

Registrar `listSchedule` no mesmo objeto exportado `review` de `src/ipc/review/index.ts` (nenhuma
mudança em `src/ipc/router.ts` — a chave `review` já existe).

### AC-3 — `src/actions/calendar.ts`

Wrapper fino chamando `ipc.client.review.listSchedule()` e `ipc.client.review.ensureReviewItems({})`
(sem `activityId`, acionando o caminho "global" do AC-2). Também uma função pura de mapeamento
`toCalendarEvents(rows: ScheduleRow[]): CalendarEvent[]` — pode viver em `src/actions/calendar.ts`
mesmo (não precisa de um módulo `src/utils/` dedicado, é só um `.map` com o `allDay`/`readOnly`/`data`
já descritos acima; `data` carrega `{ programId, moduleId }` para o clique navegar).

### AC-4 — `src/routes/calendar.tsx`: substituir o placeholder

O arquivo hoje é um placeholder (`<h1>{t("navCalendar")}</h1>`) — a rota `/calendar`, a entrada na
Sidebar (`app-sidebar.tsx`) e a chave i18n `navCalendar` **já existem e não precisam mudar**. Só o
conteúdo do componente `CalendarPage` muda:

- Ao montar: chama `ensureReviewItems({})`, depois `listSchedule()`, guarda os eventos mapeados em
  estado local.
- Renderiza `<EventCalendar>` conforme a composição do AC descrito acima (`views={["month", "agenda"]}`,
  `interactions` desativadas, `defaultView="month"`).
- `renderEvent`: renderiza o `front` do flashcard (truncado, reaproveitar a mesma classe de truncamento
  usada em `EVENT_CALENDAR_FADE_TRUNCATE` se fizer sentido, ou um `truncate` simples do Tailwind já
  usado no resto do app) dentro de um elemento clicável que, ao clicar, chama `navigate({ to:
  "/programs/$programId/modules/$moduleId", params: { moduleId: event.data.moduleId, programId:
  event.data.programId } })`.
- Se `listSchedule()` retornar vazio, o próprio `EventCalendarAgendaView`/`EventCalendarMonthView` já
  tem estado vazio embutido (`noEvents` no i18n) — não precisa de uma mensagem customizada extra.

### Fora de escopo (não tocar)

- Qualquer view além de mês/agenda (semana/dia/N-dias/recurso) — não renderizar, não expor no
  `views`.
- `interactions` habilitadas, `onEventUpdate`, recorrência, fusos horários — nada disso é usado.
- Criar/editar/excluir eventos a partir do calendário — é uma tela somente leitura + navegação; criar
  Flashcards continua sendo trabalho exclusivo de `flashcard-manager-dialog.tsx` (Issue #15).
- Alterar `review-session-dialog.tsx`, `listDue`, ou `submitRating` (Issue #16) — `listSchedule` é uma
  procedure nova e paralela, não uma substituição.
- Sincronização com Google Calendar — Fase 2 (Issue #26), não esta issue.

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED para AC-2 (`review-ipc.test.ts` — adicionar casos
   para `listSchedule` e para `ensureReviewItems` sem `activityId`, sem editar os testes existentes de
   `submitRating`/`listDue`), AC-3 (`calendar-actions.test.ts` para `toCalendarEvents`), e AC-4
   (`calendar-page.test.tsx` ou similar, se for viável testar a composição sem depender de detalhes
   internos do `EventCalendar` — priorizar testar que `ensureReviewItems`/`listSchedule` são chamados e
   que os eventos mapeados chegam à prop `defaultEvents`; não é preciso testar a renderização interna
   da grade do componente ReUI, isso é responsabilidade da própria lib). Confirmar RED pelo motivo
   certo. **Não instalar o componente ReUI nem implementar produção** — isso é do Desenvolvedor.
2. **Desenvolvedor**: rodar `npx shadcn@latest add @reui/event-calendar` (AC-1), implementar AC-2/AC-3/AC-4.
   Sem editar nenhum teste.
3. **Revisor**: rodar a suíte completa, revisar o diff contra este spec — confirmar que `interactions`
   está com os três valores `false`, que `views` está restrito a `["month", "agenda"]`, que `readOnly:
   true` está em todo evento gerado, que `listDue`/`submitRating`/`review-session-dialog.tsx` (Issue
   #16) não foram tocados, que `npm ci` valida o lockfile depois da instalação do componente.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #18.
