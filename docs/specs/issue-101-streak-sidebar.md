# Spec — Issue #101: Sistema de streak na sidebar

- **Issue:** #101 — "Sistema de streak (sequência de dias de estudo) na sidebar".
- **Branch:** `feature/101-streak-sidebar`
- **Motivação:** o app já agrega revisões por dia para o heatmap dos cards de Programa (Issue #99),
  mas não expõe um indicador de "streak" (sequência de dias consecutivos com pelo menos uma revisão)
  — um reforço motivacional comum em apps de hábito/estudo (LeetCode, Notion, Duolingo).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Critério de streak**: qualquer revisão concluída no dia conta — mesma métrica já usada pelo
     heatmap dos cards de Programa (Issue #99), não "todas as revisões pendentes do dia".
  2. **Fuso do reset**: meia-noite **local** (hora da máquina), não UTC. A referência visual original
     (um app global multi-usuário) mostra "Resets at midnight UTC", mas isso seria inconsistente com
     o resto do app — o heatmap já usa o dia local, não UTC (`src/routes/calendar.tsx` documenta essa
     mesma escolha para `dueDate`). O texto vira apenas "Resets at midnight"/"Reseta à meia-noite",
     sem mencionar UTC.
  3. **Interação**: popover acionado por um indicador na sidebar (ícone de chama + contagem), não um
     painel sempre visível.
  4. **Posição**: um pouco acima do `AccountMenu`, no `SidebarFooter`.
  5. **Estética do calendário**: mini calendário mensal compacto (referência: painel de calendário do
     Notion na sidebar), combinado com o cabeçalho "Day N" + contagem regressiva + cards de
     Current/Best Streak (referência: popover de streak de apps como LeetCode).

## Escolhas técnicas (registradas para o Revisor)

- **Reaproveita `review.listActivityCounts()` (Issue #99), sem endpoint novo**: esse procedimento já
  retorna `{ programId, date, count }[]` para todo o histórico de revisões, agregado por dia. Para o
  streak (que é *global*, não por Programa), basta ignorar `programId` e tratar cada `date` presente
  como "dia ativo" — daí `toActiveDateSet` em `src/utils/streak.ts` ser um simples `new Set(rows.map(r
  => r.date))`, sem precisar de um handler novo no processo principal.
- **`src/actions/streak.ts` duplica um wrapper de uma linha que já existe em `src/actions/programs.ts`
  (`listProgramActivityCounts`)**: ambos só chamam `ipc.client.review.listActivityCounts()`. A
  duplicação (2 linhas) é preferível a importar de `actions/programs.ts` a partir de um widget global
  da sidebar sem relação com a tela de Programas — cada feature consumindo a mesma IPC de baixo nível
  através do próprio wrapper fino é mais claro do que uma dependência cruzada semanticamente estranha.
- **Calendário mensal é escrito à mão (`buildMonthGrid`), não `react-day-picker`**: o projeto já tem
  `src/components/ui/calendar.tsx` (shadcn sobre `react-day-picker`), mas o layout da referência exige
  duas linhas de cabeçalho separadas (nav de mês, depois "Day N" + contagem regressiva) mais marcação
  customizada de "dia ativo" — sobrepor o slot de `Caption`/`MonthCaption` do `react-day-picker` para
  esse layout específico é mais complexo e frágil do que montar a grade à mão com `date-fns`, no mesmo
  espírito (e reaproveitando o mesmo padrão testável) de `buildHeatmapWeeks`
  (`src/utils/activity-heatmap.ts`, Issue #99). Um calendário só-leitura, sem seleção, que só precisa
  mostrar números e dois estados (ativo/hoje) é hand-rolling razoável, não uma reimplementação de
  primitivo complexo.
- **Locale de mês/dia-da-semana reaproveita `resolveEventCalendarLocale`** (`src/utils/
  event-calendar-i18n.ts`, já usado pelo `EventCalendar`), em vez de mapear `date-fns/locale` de novo
  ou criar chaves i18n para nomes de mês/dias-da-semana — evita duplicar o mapeamento idioma → locale
  já testado.
- **Sem tooltip para "Resets at midnight"**: a referência mostra isso como tooltip ao passar o mouse
  no dia atual. Como o popover já é compacto e essa informação é relevante toda vez que ele é aberto
  (não só sob hover), ela vira uma linha de texto sempre visível abaixo do cabeçalho — mais descobrível
  e não exige interação extra para ler.
- **`streakDaysLabel` usa pluralização nativa do i18next** (`_one`/`_other`), não uma forma neutra
  única — diferente da decisão tomada em `programActivityHeatmapSummary` (Issue #99), onde não havia
  nenhum caso visível de "1 revisão" no fluxo normal. Aqui "1 day"/"1 dia" é um estado comum e muito
  visível (todo streak começa em 1), então "1 days" lido na tela é um defeito real, não hipotético —
  confirmado visualmente antes desta decisão. i18next já suporta `_one`/`_other` nativamente (regras
  CLDR), sem configuração extra.

## AC-1 — `src/utils/streak.ts` (novo, funções puras)

```ts
export function toActiveDateSet(rows: { date: string }[]): Set<string>;
export function computeCurrentStreak(activeDates: Set<string>, today: Date): number;
export function computeBestStreak(activeDates: Set<string>): number;
export function msUntilNextLocalMidnight(now: Date): number;

export interface StreakCalendarDay {
  date: Date;
  dateKey: string;
  isActive: boolean;
  isOutsideMonth: boolean;
  isToday: boolean;
}
export function buildMonthGrid(
  month: Date,
  activeDates: Set<string>,
  today: Date
): StreakCalendarDay[][];
```

- `computeCurrentStreak`: dias consecutivos terminando hoje. Se hoje ainda não tem revisão mas ontem
  tinha, a contagem começa em ontem (o streak continua "vivo" até a virada do dia local, não zera no
  instante em que o dia começa sem atividade ainda).
- `computeBestStreak`: maior sequência de dias consecutivos em toda a história (`0` para histórico
  vazio).
- `msUntilNextLocalMidnight`: milissegundos até a próxima meia-noite local.
- `buildMonthGrid`: semanas (domingo–sábado) cobrindo o mês pedido, incluindo dias do mês
  anterior/seguinte necessários para completar a grade (mesmo padrão do `buildHeatmapWeeks`).

## AC-2 — `src/actions/streak.ts` (novo)

```ts
export function listActivityCounts(): Promise<
  { count: number; date: string; programId: string }[]
>;
```

Wrapper fino de `ipc.client.review.listActivityCounts()` (ver "Escolhas técnicas").

## AC-3 — `src/components/streak-widget.tsx` (novo): `StreakWidget`

- Busca `listActivityCounts()` uma vez ao montar; recalcula `activeDates`
  (`toActiveDateSet`), `currentStreak`/`bestStreak` e a grade do mês exibido via `useMemo`.
- Um `setInterval` de 1s atualiza `now` (para o "hoje" do streak/calendário e a contagem regressiva
  ficarem corretos ao longo da sessão, sem precisar recarregar a página à meia-noite).
- Gatilho: `SidebarMenuButton` (dentro de `SidebarMenu`/`SidebarMenuItem`, mesmo padrão de
  `account-menu.tsx`) com ícone `Flame` (colorido quando `currentStreak > 0`) + `t("streakDaysLabel",
  { count: currentStreak })`, dentro de um `PopoverTrigger asChild`.
- Conteúdo do popover: "Day N" (`streakDayOfMonthLabel`) + contagem regressiva (`HH:MM:SS` até
  `msUntilNextLocalMidnight`), texto "Resets at midnight" (`streakResetsAtMidnightMessage`), nav de
  mês (`‹ Mês Ano ›`, reaproveitando `calendarPreviousAction`/`calendarNextAction`), grade de
  dias-da-semana + `buildMonthGrid` (dia ativo com preenchimento colorido, hoje com anel), dois cards
  "Current Streak"/"Best Streak" (`Flame`/`Trophy`) e a frase de incentivo
  (`streakHintMessage`).

## AC-4 — `src/components/app-sidebar.tsx` (wiring)

`<StreakWidget />` adicionado dentro de `<SidebarFooter>`, antes de `<AccountMenu />`.

### Novas chaves i18n (`en` e `pt-BR`)

`streakBestLabel`, `streakCurrentLabel`, `streakDayOfMonthLabel` (interpola `{{day}}`),
`streakDaysLabel_one`/`streakDaysLabel_other` (interpola `{{count}}`, plural nativo do i18next),
`streakHintMessage`, `streakResetsAtMidnightMessage`. `calendarPreviousAction`/`calendarNextAction`
(já existentes) são reaproveitadas para a navegação de mês.

## Fora de escopo

- Endpoint de backend dedicado a streak — reaproveita `review.listActivityCounts()` (ver "Escolhas
  técnicas").
- Notificações/lembretes quando o streak está perto de quebrar.
- Congelar/"proteger" o streak (streak freeze, como em apps de idioma) — não pedido.
- Persistir o streak calculado no banco — é sempre recalculado a partir do histórico de revisões, sem
  necessidade de uma coluna/tabela própria.

## Ordem do pipeline

1. **Testador**: `src/tests/unit/streak.test.ts` (funções puras) e
   `src/tests/unit/streak-widget.test.tsx` (componente: contagem no gatilho, conteúdo do popover,
   navegação de mês) — usando `vi.useFakeTimers({ toFake: ["Date"] })` para controlar "hoje" sem
   travar o polling interno de `findBy`/`waitFor` do Testing Library (que depende de timers reais).
   Confirmar RED, commitar.
2. **Desenvolvedor**: implementar até GREEN.
3. **Revisor**: `npm run test:unit`, `npm run test:e2e` (a sidebar faz parte do layout raiz),
   `npm run check`; conferir visualmente que o popover não estoura a largura em telas pequenas e que a
   contagem regressiva realmente decresce.
4. **Redator de Docs**: `CHANGELOG.md`.
