# Spec — Issue #99: Programas em cards com heatmap de uso e Context Menu

- **Issue:** #99 — "Programas: cards com heatmap de uso e context menu (substituindo tabela e ícones
  de ação)".
- **Branch:** `feature/99-programs-cards-heatmap`
- **Motivação:** a tela de Programas (`/`) lista programas em uma `<table>` simples
  (`ProgramsDataTable`), com uma coluna de três botões-ícone (editar, excluir, ver módulos). Esta
  issue substitui a listagem por cards — um por programa —, cada um mostrando um heatmap de uso
  (estilo gráfico de contribuições do GitHub), remove o ícone de "ver módulos" (o clique no próprio
  card já navega) e agrupa renomear/excluir em um Context Menu (clique direito no card).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Métrica do heatmap**: revisões concluídas por dia (contagem de entradas de
     `review_items.ratingHistory` cujo `reviewedAt` cai naquele dia), não criação/edição de
     atividades.
  2. **Layout**: grid de cards responsivo (vários por linha), com heatmap **compacto** (~3 meses),
     não o heatmap completo de 12 meses do GitHub — que é largo demais (~700px) para caber em um
     grid de múltiplos cards por linha.
  3. **Clique no card**: clique simples navega para os módulos do programa (substitui o antigo botão
     "ver módulos"). Clique direito abre o Context Menu com "Editar" e "Excluir".

## Escolhas técnicas (registradas para o Revisor)

- **Sem tabela de log de revisões**: o schema não tem uma tabela `review_log` (uma linha por
  avaliação). O histórico vive serializado em `review_items.ratingHistory` (JSON,
  `{ rating, reviewedAt }[]`), uma coluna por Flashcard/Activity, não por dia. A agregação por dia
  precisa então: (1) buscar todo `ratingHistory` acessível a partir de cada Programa (reaproveitando
  o mesmo padrão de `unionAll` Flashcard-scoped/Activity-scoped já usado por `listSchedule` em
  `src/ipc/review/handlers.ts`), (2) fazer `JSON.parse` de cada linha e (3) "achatar"/agrupar os
  timestamps em contagens por dia — tudo em código de aplicação (SQLite deste projeto não expõe
  função de expansão de array JSON usada em nenhum outro lugar do código). Introduzir uma tabela
  `review_log` normalizada é uma alternativa mais idiomática de longo prazo, mas está fora de escopo
  desta issue (nenhuma migration de schema é necessária para a métrica pedida).
- **Sem `date-fns` no processo principal**: todo o parsing/soma de contagens por dia acontece dentro
  do handler oRPC (processo principal do Electron). Para evitar introduzir uma dependência nova nesse
  processo só para formatar `"yyyy-MM-dd"`, um helper local (`getFullYear`/`getMonth`/`getDate` do
  próprio `Date`, hora local da máquina) resolve isso — a mesma técnica de "dia local, não UTC" que
  `src/routes/calendar.tsx` já documenta para `dueDate`. `date-fns` continua sendo usado normalmente
  no lado do renderer (onde já é dependência estabelecida), para a lógica de grade do heatmap.
- **Sem `Card` genérico em `src/components/ui`**: diferente do Context Menu (que tem lógica real de
  posicionamento/teclado que vale a pena encapsular como primitivo Radix), um "card" aqui é só um
  contêiner com `border`/`rounded`/`shadow`, usado em exatamente um lugar. Adicionar
  `src/components/ui/card.tsx` inteiro (Header/Title/Description/Action/Content/Footer) para um único
  consumidor seria abstração prematura; o botão-card em `programs-card-grid.tsx` usa as mesmas
  classes de superfície já convencionadas no projeto (`rounded-lg border-border bg-card ring-1
  ring-foreground/10`, como em `dropdown-menu.tsx`) diretamente.
- **`src/components/ui/context-menu.tsx` (novo)**: não existe ainda neste projeto. Espelha
  `dropdown-menu.tsx` 1:1 (mesmo estilo "radix-mira": `data-slot`, classes `data-open:`/`data-closed:`,
  `ring-1 ring-foreground/10`), trocando o primitivo Radix de `DropdownMenu` para `ContextMenu` (ambos
  vêm do mesmo pacote unificado `radix-ui` já usado em todo `src/components/ui`). Superfície completa
  (Root/Trigger/Portal/Content/Group/Label/Item/CheckboxItem/RadioGroup/RadioItem/Separator/Shortcut/
  Sub/SubTrigger/SubContent), mesmo que este card use só Root/Trigger/Content/Item/Separator —
  consistente com como `dropdown-menu.tsx` já foi instalado por completo neste repo, não recortado ao
  uso imediato.
- **Acessibilidade do Context Menu por teclado**: sem um botão "•••" dedicado (removido a pedido),
  usuários de teclado abrem o menu de contexto do jeito nativo do sistema/navegador para qualquer
  elemento focado — tecla Menu ou Shift+F10, que disparam o mesmo evento `contextmenu` que o
  `ContextMenuTrigger` do Radix já escuta. Não é necessário nenhum código adicional para isso.
- **Bucket de intensidade do heatmap**: relativo ao próprio programa (não a um valor absoluto global),
  em 5 níveis (0 = sem revisão, 1–4 proporcional ao dia de maior contagem daquele programa dentro da
  janela visível) — mesma ideia do GitHub, mas escalado por card em vez de por conta inteira, já que
  cada Programa pode ter volumes de revisão bem diferentes. Cores reaproveitadas de
  `--chart-1`..`--chart-4` (já definidas em `src/styles/global.css`, mesma família usada por
  `radial-chart-text.tsx`), nível 0 em `bg-muted`.

## AC-1 — `src/ipc/review/handlers.ts`: novo handler `listActivityCounts`

```ts
export const listActivityCounts = os.handler(() => { /* ... */ });
```

Retorna `{ programId: string; date: string; count: number }[]` — uma linha por combinação
programa/dia com pelo menos uma revisão, `date` no formato `"yyyy-MM-dd"` (dia local da máquina, via
helper próprio, não `date-fns`). Implementação: reaproveita o par `viaFlashcard`/`viaActivity` +
`unionAll` de `listSchedule` (mesmo join até `programsTable`), mas selecionando
`{ programId, ratingHistory }`; depois, em memória, faz `JSON.parse(ratingHistory)`, itera
`{ reviewedAt }[]`, converte cada `reviewedAt` (epoch ms) para a chave de dia local e acumula num
`Map<string, Map<string, number>>` (programId → dia → contagem) antes de achatar para o array de
retorno. Exportado de `src/ipc/review/index.ts` junto aos demais.

## AC-2 — `src/actions/programs.ts`: `listProgramActivityCounts` + `groupActivityCountsByProgram`

```ts
export interface ProgramActivityCount {
  count: number;
  date: string;
  programId: string;
}

export function listProgramActivityCounts(): Promise<ProgramActivityCount[]>;

export function groupActivityCountsByProgram(
  rows: ProgramActivityCount[]
): Map<string, { count: number; date: string }[]>;
```

`listProgramActivityCounts` chama `ipc.client.review.listActivityCounts()`.
`groupActivityCountsByProgram` é uma função pura (testável sem mocks) que agrupa o array plano por
`programId`, descartando o campo (redundante depois de agrupado) na fatia de cada programa.

## AC-3 — `src/utils/activity-heatmap.ts`: `buildHeatmapWeeks`

```ts
export interface ActivityHeatmapDay {
  count: number;
  date: string;
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = { count: number; date: string; level: HeatmapLevel } | null;

export function buildHeatmapWeeks(
  counts: ActivityHeatmapDay[],
  options?: { today?: Date; weeks?: number }
): HeatmapCell[][];
```

Função pura (sem I/O), grade estilo GitHub: `weeks` colunas (default `13`, ~3 meses) × 7 linhas
(domingo a sábado). `today` (default `new Date()`) cai na **última** coluna; essa última coluna é a
semana (domingo–sábado) que contém `today` — ou seja, a primeira coluna começa `(weeks - 1)` semanas
antes dela: `gridStart = subDays(startOfWeek(today, { weekStartsOn: 0 }), (weeks - 1) * 7)` (via
`date-fns`: `startOfWeek`, `subDays`, `addDays`, `format`). Dias da grade que caem **depois** de
`today` (preenchimento da última coluna até completar 7 linhas) são `null` (célula não renderizada,
só mantém o alinhamento da grade). Contagens de `counts` fora do intervalo `[gridStart, today]` são
ignoradas. Nível: `0` quando a contagem do dia é `0`; senão
`Math.min(4, Math.ceil((count / maiorContagemNaJanela) * 4))`, sempre um inteiro entre 1 e 4 (a maior
contagem dentro da janela sempre cai em `4`).

## AC-4 — `src/components/activity-heatmap.tsx`: `ActivityHeatmap`

```ts
export interface ActivityHeatmapProps {
  counts: ActivityHeatmapDay[];
  weeks?: number;
}
export function ActivityHeatmap(props: ActivityHeatmapProps): JSX.Element;
```

Usa `buildHeatmapWeeks` e renderiza colunas de células `10px` (`size-2.5 rounded-xs`,
`gap-[3px]`), cor por nível (`bg-muted` para nível 0, `bg-chart-1`..`bg-chart-4` para 1–4), células
`null` renderizadas como espaço vazio do mesmo tamanho (mantém o grid alinhado). O contêiner é
`role="img"` com `aria-label` = nova chave `programActivityHeatmapSummary` (interpola o total de
revisões na janela, ex. "12 revisões nos últimos 3 meses"); a grade interna de células é
`aria-hidden`, e cada célula individual carrega `title="{data}: {contagem}"` só como dica visual do
mouse (não é a fonte de informação acessível — essa é o `aria-label` do contêiner).

## AC-5 — `src/components/ui/context-menu.tsx` (novo)

Ver "Escolhas técnicas" acima — espelho estrutural de `dropdown-menu.tsx` usando o primitivo
`ContextMenu` de `radix-ui`.

## AC-6 — `src/components/programs-card-grid.tsx` (substitui `programs-data-table.tsx`)

```ts
export interface Program {
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}

interface ProgramsCardGridProps {
  activityCountsByProgramId: Map<string, { count: number; date: string }[]>;
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  programs: Program[];
}
export default function ProgramsCardGrid(props: ProgramsCardGridProps): JSX.Element;
```

- Grid responsivo (`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`); lista vazia mantém a
  mensagem `programsTableEmptyMessage` (chave reaproveitada, sem mudança de texto).
  Um card por programa: `<ContextMenu>` envolvendo um `<ContextMenuTrigger asChild>` cujo filho é um
  único `<button>` (não uma `<div>` com `onClick` — precisa ser focável/acionável por teclado) com o
  nome do programa e o `ActivityHeatmap` da fatia de `activityCountsByProgramId.get(program.id)`
  (`?? []` se o programa ainda não tem nenhuma revisão). Clique no botão chama
  `onNavigateToModules(program)`. **Nenhum ícone/botão de "ver módulos" é renderizado** — a
  chave `viewModulesAction` e o ícone `BookOpen` (antes importado de `lucide-react`) são removidos
  por completo, junto com sua entrada em `en`/`pt-BR` de `src/localization/i18n.ts` (fica órfã depois
  desta issue).
- `<ContextMenuContent>` com dois itens: `editProgramAction` (ícone `Pencil`, chama `onEdit(program)`
  em `onSelect`) e `deleteProgramAction` (ícone `Trash2`, `variant="destructive"`, chama
  `onRequestDelete(program)` em `onSelect`) — mesmos rótulos/callbacks de antes, só a forma de
  acioná-los muda (menu em vez de botões sempre visíveis).

## AC-7 — `src/routes/index.tsx` (wiring)

- Novo estado `activityCounts` (`ProgramActivityCount[]`), buscado uma vez no mount (mesmo padrão do
  `getCalendarConnectionStatus` em `calendar.tsx` — não depende do ciclo de refresh de
  criar/editar/excluir Programa, já que revisões não mudam por causa de um CRUD de Programa).
  `activityCountsByProgramId` é `useMemo(() => groupActivityCountsByProgram(activityCounts),
  [activityCounts])`.
- `<ProgramsDataTable ... />` → `<ProgramsCardGrid activityCountsByProgramId={...} ... />` (demais
  props — `onEdit`/`onNavigateToModules`/`onRequestDelete`/`programs` — inalteradas).
- `program-form-dialog.tsx` e `delete-program-dialog.tsx`: só o caminho do `import type { Program }`
  muda, de `@/components/programs-data-table` para `@/components/programs-card-grid`.

## AC-8 — `src/tests/e2e/activities-navigation.test.ts` (atualizado, não novo)

O teste hoje navega para Módulos via
`page.getByRole("row", { name: ... }).getByLabel("View modules")`. Sem `<table>`/`<tr>` nem botão de
ícone, isso não existe mais — passa a ser `page.getByRole("button", { name: new
RegExp(programName) }).click()` (o card inteiro é o botão, seu nome acessível contém o nome do
programa). Resto do teste (Módulos → Atividades, ambos ainda em `<table>`) inalterado.

### Novas chaves i18n (`en` e `pt-BR`)

`programActivityHeatmapSummary` (interpola `{{count}}`, plural: revisão/revisões — ver
`Intl.PluralRules`/i18next `_one`/`_other` já usado em outras chaves do projeto, ex.
`calendarWeekNumberLabel` não é plural mas `activityReviewStateColumnLabel` etc. — conferir se o
projeto já usa `_one`/`_other` em algum lugar antes de decidir a forma; caso não haja precedente,
uma única forma neutra "N revisões nos últimos 3 meses"/"N reviews in the last 3 months" é aceitável
mesmo com N=1, evitando introduzir pluralização nova sem padrão local a seguir).

### Chaves removidas (ficam órfãs)

`viewModulesAction` (`en` e `pt-BR`) — sem nenhum outro consumidor no código (confirmado por busca
antes deste spec).

## Revisão (ainda na Issue #99, antes do merge do PR #100)

Depois do primeiro GREEN, o usuário pediu ajustes visuais com base em duas referências (um app de
hábitos estilo Streaks): o card ganha ícone + cor próprios, o heatmap passa a cobrir 365 dias (não
mais ~3 meses) e o formulário ganha um seletor de ícone/cor. Decisões confirmadas com o usuário:

1. **Escopo continua sendo o card de Programa** (não um card novo para Atividades) — só evolui o que
   já existe.
2. **O botão de check da referência vira um ícone de três pontos** (`MoreHorizontal`) que abre o
   mesmo menu Editar/Excluir do Context Menu (agora via `DropdownMenu`, clique simples), **em
   adição** ao clique direito no card (que continua abrindo o Context Menu) — não o substitui. O
   card inteiro também ganha `cursor-pointer` explícito.
3. **Seletor de ícone usa Lucide** (`lucide-react`, já é a lib de ícones do projeto) — não uma lib
   nova.

### Escolhas técnicas adicionais

- **`programs.icon`/`programs.color` (novas colunas, nullable)**: `icon` guarda o nome literal do
  ícone Lucide exportado (ex. `"BookOpen"`), resolvido para o componente em tempo de render via um
  mapa (`src/constants/program-appearance.ts`). `color` guarda um hex (`"#ef4444"`) de uma paleta fixa
  de 19 cores (mesmo espírito da paleta do app de referência, usando os tons 500 do Tailwind para
  ficarem consistentes com o resto do design). Ambas nullable porque programas criados antes desta
  revisão não têm valor — `resolveProgramIcon`/`resolveProgramColor` (funções puras, testáveis)
  aplicam um fallback (`BookOpen` / primeira cor da paleta) para esse caso, em vez de a UI precisar
  tratar `null` em todo lugar que usa ícone/cor.
- **Conjunto de ícones é curado, não a biblioteca inteira**: Lucide tem milhares de ícones; a grade do
  formulário mostra ~32 ícones relevantes para "programas de estudo" (livro, cálculo, ciências,
  idiomas, código, artes, etc.), não todos os ícones existentes -- mesmo espírito de um picker de
  hábito (curado por categoria), adaptado ao domínio do app.
- **Sem os campos "Descrição" e "Tipo de Hábito" (Criar/Largar) da referência**: o pedido do usuário
  foi reaproveitar a *estética* (preview circular do ícone, grade de ícones, paleta de cores em
  swatches), não replicar campos que não existem no domínio de "Programa" -- `Program` não ganha uma
  coluna de descrição nesta revisão (não foi pedido), e não há um conceito de "hábito a largar" para
  um programa de estudo.
- **Nested interactive elements**: o botão de três pontos (um `<button>` real, disparando o
  `DropdownMenu`) não pode ficar dentro de outro `<button>` (HTML inválido -- botão dentro de botão).
  O contêiner clicável do card deixa de ser um `<button>` e passa a ser um `<div role="button"
  tabIndex={0}>` com `onClick`/`onKeyDown` (Enter/Espaço) equivalentes, e `aria-label={program.name}`
  explícito (sem isso, o nome acessível do card acabaria incluindo o rótulo do botão de três pontos
  aninhado). O clique no botão de três pontos chama `event.stopPropagation()` para não também
  disparar a navegação do card.
- **Heatmap de 365 dias com scroll horizontal + máscara de fade**: `ActivityHeatmap` passa a aceitar
  uma prop `color` (obrigatória agora que só tem um consumidor, o card de Programa) usada para as 4
  cores de intensidade via `style` inline (opacidade crescente sobre o hex do programa, em vez das
  classes fixas `bg-chart-1..4`) -- nível 0 continua `bg-muted`. `buildHeatmapWeeks`'s `DEFAULT_WEEKS`
  passa de `13` para `53` (⌈365 / 7⌉, mesma contagem de colunas que o GitHub usa pra "último ano"). O
  contêiner da grade vira `overflow-x-auto`, e um `useEffect` mede `scrollWidth`/`clientWidth` depois
  de montar: **só quando o conteúdo realmente não cabe**, aplica uma classe de `mask-image` (fade da
  esquerda, onde ficam os dias mais antigos) e rola para o final (`scrollLeft = scrollWidth`), deixando
  os dias mais recentes visíveis por padrão -- pedido explícito do usuário ("caso não caiba... aplique
  uma máscara"), não incondicional. A barra de rolagem em si fica oculta via uma nova utility
  `no-scrollbar` em `src/styles/global.css` (Tailwind v4 `@utility`) -- reaproveita o nome de classe já
  referenciado (mas nunca definido) em `sidebar.tsx`, corrigindo de brinde essa referência morta.
  `scrollWidth`/`clientWidth` são sempre `0` no jsdom (sem layout real), então esse "liga/desliga" da
  máscara não é coberto por teste unitário, só por verificação visual manual.

### AC-9 — `src/database/schema.ts` + migration: `programs.icon`, `programs.color`

`icon: text("icon")` e `color: text("color")` (ambas nullable, sem default no banco -- o fallback é
só na camada de apresentação). Migration gerada via `drizzle-kit generate`.

### AC-10 — `src/constants/program-appearance.ts` (novo)

```ts
export const PROGRAM_ICONS: { Icon: LucideIcon; name: string }[];
export const PROGRAM_COLORS: string[]; // 19 hex, tons 500 do Tailwind
export const DEFAULT_PROGRAM_ICON_NAME: string; // "BookOpen"
export const DEFAULT_PROGRAM_COLOR: string; // PROGRAM_COLORS[0]
export function resolveProgramIcon(name: string | null): LucideIcon;
export function resolveProgramColor(color: string | null): string;
```

### AC-11 — `src/ipc/programs/schemas.ts` + `handlers.ts`

`createProgramInputSchema`/`updateProgramInputSchema` ganham `icon`/`color` opcionais
(`z.string().nullable().optional()`); `create`/`update` persistem os valores recebidos (`null` quando
omitidos, mesmo comportamento de "sem ícone/cor escolhidos" que uma linha pré-existente já tem).

### AC-12 — `src/components/program-form-dialog.tsx` (redesenhado)

Preview circular (ícone atual sobre a cor atual, `size-16 rounded-full`), grade dos ~32 ícones
curados (grid `flex flex-wrap gap-2`, cada um um `button` que seta o ícone selecionado, destacado com
anel quando ativo), campo Nome (inalterado), paleta de 19 cores em swatches (`button` circular/quadrado
por cor, anel quando selecionada). Estado novo (`icon`, `color`) inicializado a partir do `program`
em edição ou dos defaults (`DEFAULT_PROGRAM_ICON_NAME`/`DEFAULT_PROGRAM_COLOR`) na criação;
`onSubmit` passa a receber `{ color, icon, name }`.

### AC-13 — `src/components/programs-card-grid.tsx` (redesenhado)

Ver "Escolhas técnicas adicionais" acima. Ícone quadrado (`size-10 rounded-xl`, fundo = cor do
programa, ícone branco) + nome à esquerda; `DropdownMenu` (três pontos) à direita, mesmos itens do
Context Menu já existente (mantido, para o clique direito). Fundo do card ganha um leve gradiente
radial na cor do programa (`style` inline, `radial-gradient` de baixa opacidade), sutil, não a cor
sólida.

## Revisão 3 (correção de bug + ajustes visuais)

Duas mudanças pontuais pedidas depois do GREEN da Revisão 2:

1. **Bug**: selecionar "Editar"/"Excluir" no menu de três pontos também navegava para os módulos do
   programa (a ação em si funcionava, mas a navegação indesejada atrapalhava o fluxo). Causa:
   `DropdownMenuContent` renderiza via `Portal` do Radix para `document.body`, e o React propaga
   eventos sintéticos pela **árvore de componentes React**, não pela árvore do DOM -- um clique num
   item dentro do portal ainda "sobe" até o `onClick` do card ancestral. `ContextMenuContent` (mesmo
   sendo portalizado do mesmo jeito) já intercepta isso sozinho por conta do próprio Radix; o
   `DropdownMenu` não. Fix: `handleEditClick`/`handleDeleteClick` (compartilhados pelos dois menus)
   agora chamam `event.stopPropagation()` antes de disparar `onEdit`/`onRequestDelete`.
2. **Contraste no tema claro**: `--muted` (`oklch(0.97 0 0)`) fica a só `0.03` de `--card`
   (`oklch(1 0 0)`) no tema claro -- diferença imperceptível, por isso a grade do heatmap
   praticamente sumia. O mesmo efeito (alpha-blend de uma cor saturada sobre branco produz um tom
   pastel bem mais "lavado" do que o mesmo alpha sobre um fundo escuro) também lavava o tingimento de
   fundo do card e os níveis 1-4 do heatmap. Fix: `src/styles/global.css` ganha variáveis dedicadas
   (`--heatmap-empty-cell`, `--heatmap-level-1..4`, `--card-tint-strength`) com valores diferentes por
   tema -- claro com contraste/opacidade mais alta, escuro mantendo exatamente os valores que já
   funcionavam (sem regressão). `ActivityHeatmap` e `ProgramsCardGrid` passam a montar as cores via
   `color-mix(in srgb, ${color} var(--...), transparent)` em vez de hex+alpha fixo (`${color}26`),
   já que a cor em si (`program.color`) é dinâmica (por programa) mas a intensidade precisa reagir ao
   tema.
3. **Border glow effect** (pedido do usuário, ambos os temas): `box-shadow` de duas camadas na cor do
   próprio programa -- um anel de 1px (`color-mix(... 35%, transparent)`, reforça a borda) mais um
   brilho difuso (`0 0 20px 0`, `color-mix(... 25%, transparent)`) -- substitui o `ring-1
   ring-foreground/10` neutro que existia antes.
4. **Gradiente do card**: pedido do usuário para ir "de cima para baixo" -- troca de
   `radial-gradient(circle at 0% 0%, ...)` para `linear-gradient(to bottom, ...)`.

## Fora de escopo

- Tabela `review_log` normalizada (ver "Escolhas técnicas") — a agregação em memória a partir de
  `ratingHistory` é suficiente para o volume de dados de um app local single-user.
- Heatmap de 12 meses completo (decisão do usuário: layout em grid compacto).
- Qualquer mudança em Módulos/Atividades (`ModulesDataTable`, etc.) — só a tela de Programas muda
  nesta issue.
- Reordenar/arrastar cards, filtros ou busca na grid de Programas.

## Ordem do pipeline

1. **Testador**: `src/tests/unit/activity-heatmap-util.test.ts` (AC-3, puro),
   `src/tests/unit/activity-heatmap.test.tsx` (AC-4), substituir
   `src/tests/unit/programs-data-table.test.tsx` por
   `src/tests/unit/programs-card-grid.test.tsx` (AC-6, incluindo clique simples/clique
   direito+menu), e um teste mínimo para `groupActivityCountsByProgram` (AC-2). Confirmar RED,
   commitar.
2. **Desenvolvedor**: implementar até GREEN (AC-1 a AC-7), depois atualizar o e2e (AC-8) — o e2e não
   roda no CI de unit tests, então precisa de uma passada manual (`npm run test:e2e`) por tocar a
   rota `/`, conforme `CONTRIBUTING.md`.
3. **Revisor**: `npm run test:unit`, `npm run test:e2e`, `npm run check`; conferir visualmente (app
   rodando) que o heatmap não estoura a largura do card em telas pequenas e que o Context Menu
   fecha corretamente após cada ação.
4. **Redator de Docs**: `CHANGELOG.md`.
