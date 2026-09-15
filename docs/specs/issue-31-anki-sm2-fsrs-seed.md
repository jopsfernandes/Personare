# Spec — Issue #31: Conversão de estado SM-2 para seed inicial de FSRS

- **Issue:** #31 — "Conversao de estado SM-2 para seed inicial de FSRS" (Plan.md seção 6 e Fase 3,
  item 26).
- **Corpo da issue:** "Definir e implementar a heurística de conversão do estado de repetição SM-2
  (usado pelo Anki) para um estado inicial razoável de FSRS ao importar um deck existente. Não é um
  mapeamento 1:1."
- **Branch:** `feature/31-sm2-fsrs-seed`
- **Depende de:** Issue #29 (`parseApkg`, entrega o `db` `better-sqlite3`). Não depende da Issue #30 —
  ao contrário do mapeamento de notes/templates, o estado de repetição vive inteiramente na tabela
  `cards` (`type`/`queue`/`due`/`ivl`/`factor`/`reps`/`lapses`/`data`/`mod`) e em `col.crt`, colunas que
  **não mudam entre os schemas de coleção** (nem a Issue #30 precisou tocar `cards`/`col.crt` — só
  `notetypes`/`fields`/`templates`/`decks` migram de JSON para tabelas normalizadas entre schemas).
  Portanto este módulo não precisa de nenhuma detecção de `col.ver`.
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Usar o estado FSRS nativo do Anki quando presente**: coleções do Anki 23.10+ com o scheduler
     FSRS habilitado já guardam `stability`/`difficulty` reais por card (ver AC-2). Quando presentes,
     usar esses valores diretamente em vez da heurística SM-2 — só cai na heurística quando ausentes.
  2. **Só campos agregados do card** (`type`/`queue`/`due`/`ivl`/`factor`/`reps`/`lapses`), sem ler
     `revlog` — mesma disciplina minimalista das Issues #29/#30. `revlog` é opcional na exportação do
     Anki (a caixa "incluir agendamento" do diálogo de exportação) e reconstruir uma estimativa a partir
     dele seria, na prática, reimplementar parte do otimizador do FSRS — desproporcional ao escopo de um
     "seed razoável".
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Fora de escopo**: gravação em `review_items`/IPC/UI (issue de importação futura, ainda não numerada
  — ver nota de correlação abaixo); qualquer leitura de `revlog`.

## Nota de correlação com a Issue #30 (para quem implementar a issue de importação)

`mapAnkiNotesToFlashcards` (#30) pula cards silenciosamente em alguns casos (`ord` fora do array de
templates, número de cloze que não existe mais em nenhum campo) — seu array de saída **não tem o mesmo
tamanho nem a mesma ordem** que a lista de todas as linhas de `cards`. Este módulo, por outro lado,
devolve um seed por linha de `cards` (nenhuma é pulada — ver AC-3). Por isso cada seed carrega
`cardId` (o `cards.id` original do Anki): a issue de importação futura precisará ler `cards.id` também
ao consumir a Issue #30 (uma pequena adição lá, não feita agora) para casar as duas listas por
`cardId` — não por índice de array.

## Contexto técnico: onde o estado de repetição vive no banco

Verificado diretamente no repositório `ankitects/anki` (`rslib/src/card/mod.rs`,
`rslib/src/storage/card/data.rs`, `rslib/src/storage/schema11.sql`) para esta spec.

### Colunas de `cards` (idênticas em todos os schemas de coleção)

- `type` (`CardType`): `0` = New, `1` = Learn, `2` = Review, `3` = Relearn.
- `queue` (`CardQueue`): `0` = New (due = posição, não data), `1` = Learn (due = timestamp Unix em
  segundos), `2` = Review (due = dias desde `col.crt`), `3` = DayLearn (due = dias desde `col.crt`,
  como Review, mas o card ainda está na fase de aprendizado), `4` = PreviewRepeat (due = timestamp Unix,
  só cards de deck filtrado), `-1`/`-2`/`-3` = suspenso/enterrado (o `due` mantém o significado que
  tinha antes de ser suspenso/enterrado, mas o `queue` original é perdido — ver AC-3 para a
  simplificação assumida).
- `ivl`: intervalo agendado. Positivo = dias (cards que já graduaram para Review). Zero ou negativo
  (negativo = segundos) = card ainda em Learn/Relearn, sem um intervalo de dias real ainda.
- `factor`: fator de facilidade (ease), em milésimos (ex.: `2500` = 250%, o padrão do Anki para um card
  novo). `0` para cards `type = New` (nunca calculado ainda).
- `reps`: total de revisões já feitas (sucessos + falhas).
- `lapses`: total de vezes que o card "esqueceu" (voltou para Relearn).
- `mod`: timestamp Unix (segundos) da última modificação do card — na prática, para um card já
  revisado, é o timestamp da última revisão (é exatamente o que atualiza `due`/`ivl`/`factor`/`reps`).
  Usado aqui como proxy de `lastReviewedAt` (ver AC-3) — o próprio Anki não guarda "data da última
  revisão" como coluna separada em `cards`, só em `revlog` (fora de escopo).
- `data`: JSON (pode ser string vazia). Ver AC-2.

### `col.crt`

Timestamp Unix (segundos) do início do dia em que a coleção foi criada — a referência de "dia 0" para
todo `due` no formato "dias desde a criação" (`queue` 2 e 3). Coluna do `col` table, inalterada por
qualquer upgrade de schema (`crt` não aparece em nenhum dos scripts `schema1{4,5,7,8}_upgrade.sql`).

## AC-1 — Estado FSRS nativo em `cards.data` (`rslib/src/storage/card/data.rs`)

Coleções com o scheduler FSRS do próprio Anki habilitado (23.10+) guardam o estado de memória real na
coluna `cards.data`, um JSON cujas chaves relevantes são:

```json
{ "s": 34.2, "d": 6.1, "dr": 0.9, "lrt": 1699999999 }
```

- `s` = `fsrs_stability` (dias) — **mesma escala e unidade** que `Card.stability` do `ts-fsrs`.
- `d` = `fsrs_difficulty` — escala `1.0`–`10.0`, **idêntica** à de `Card.difficulty` do `ts-fsrs`
  (confirmado por `FsrsMemoryState::difficulty()` em `card/mod.rs`, que normaliza via
  `(difficulty - 1.0) / 9.0`, ou seja, o range bruto é `[1, 10]` — igual ao FSRS padrão que o `ts-fsrs`
  implementa).
- Quando ambas as chaves existem: usar `s`/`d` diretamente como `stability`/`difficulty` do seed — não
  passar pela heurística do AC-4. Quando qualquer uma estiver ausente (coleção sem FSRS habilitado, ou
  card nunca revisado sob FSRS): cair no AC-4.

## AC-2 — `src/main/anki-review-seed.ts`

```ts
import type { ReviewItemInsertFields } from "@/utils/fsrs";

export interface AnkiReviewSeed extends ReviewItemInsertFields {
  cardId: number; // cards.id original do Anki -- ver nota de correlação acima
}

export function seedReviewStateFromAnkiCards(
  db: Database.Database
): AnkiReviewSeed[];
```

Reaproveita `ReviewItemInsertFields`/`StateType`/`createInitialReviewItemFields` de
`src/utils/fsrs.ts` tal qual (não duplica os nomes de campo do estado FSRS) — o seed final tem
exatamente o formato que `src/ipc/review` (ou o que vier a gravar `review_items`) já espera.

Passos internos: `SELECT id, type, queue, due, ivl, factor, reps, lapses, mod, data FROM cards ORDER BY
id` + `SELECT crt FROM col`. Para cada linha:

1. **`type = 0` (New)**: seed = `{ cardId, ...createInitialReviewItemFields() }` tal qual — não roda
   heurística nenhuma (card nunca foi revisado, `createEmptyCard()` já é o "estado inicial razoável"
   correto por definição).
2. Para os demais (`type` 1/2/3): computar os campos comuns (AC-3) e então `stability`/`difficulty` via
   AC-1 (se `data` tiver `s`+`d`) ou AC-4 (senão).

## AC-3 — Campos comuns (state, dueDate, lastReviewedAt, reps, lapses, scheduledDays, learningSteps)

- `state`: `type = 1` → `"Learning"`; `type = 2` → `"Review"`; `type = 3` → `"Relearning"` (mapeamento
  direto de `CardType`, independente de `queue` — inclusive para `queue` negativo/suspenso: um card
  suspenso ainda recebe um seed coerente com o `type` que tinha, já que Personare não tem um conceito de
  "suspenso" e simplesmente não deve perder o estado de revisão desse card).
- `reps` / `lapses`: cópia direta de `cards.reps`/`cards.lapses`.
- `scheduledDays`: `ivl` quando positivo (dias), `0` caso contrário (card ainda não tem um intervalo de
  dias real).
- `learningSteps`: sempre `0` — os passos de (re)aprendizado configurados em Personare não têm
  correspondência com os do Anki (sequências de passos diferentes, potencialmente de tamanhos
  diferentes); iniciar a fase de aprendizado do zero no próprio scheduler do Personare, em vez de tentar
  mapear `cards.left` para um índice de passo que pode nem existir na configuração do Personare, é a
  escolha mais segura.
- `lastReviewedAt`: `new Date(cards.mod * 1000)` (proxy documentado acima — não há outra fonte sem ler
  `revlog`).
- `dueDate`:
  - `queue = 1` ou `queue = 4`: `new Date(due * 1000)` (timestamp Unix direto).
  - `queue = 0`: não deveria ocorrer aqui (`type = 0` já foi tratado no AC-2 passo 1), mas por segurança
    trata-se como `queue = 2` (fallback abaixo) em vez de lançar erro.
  - Qualquer outro valor (`2`, `3`, ou negativo/suspenso): `new Date(col.crt * 1000 + due * 86400000)`
    (dias desde a criação da coleção). **Simplificação assumida**: ignora a hora de virada de dia
    configurável do Anki (padrão 4h, mas o usuário pode mudar) e fuso horário de quando a coleção foi
    criada — suficiente para um "seed razoável" (o próprio Personare vai reagendar a partir da primeira
    revisão real), não para reproduzir o agendamento exato do Anki.

## AC-4 — Heurística SM-2 → FSRS (quando `cards.data` não tem `s`/`d`)

Sem o histórico de revisão (`revlog`, fora de escopo), a heurística usa só o que o card já resume sobre
si mesmo — `ivl` (quão espaçada a revisão ficou) e `factor` (quão fácil o Anki achou que o card é) — e
se ancora nos próprios parâmetros padrão do FSRS para que a conversão faça sentido nesses termos, não em
constantes arbitrárias:

- **`stability`** (dias): a fórmula do FSRS relaciona intervalo e estabilidade por
  `ivl ≈ S × 9 × (1/retenção_alvo - 1)` (retenção alvo = probabilidade de lembrar no dia do due). Na
  retenção padrão do `ts-fsrs` (`default_request_retention = 0.9`), o fator `9 × (1/0.9 - 1)` é
  exatamente `1`, então a própria fórmula colapsa em `S ≈ ivl` — **a estabilidade seed é o intervalo do
  Anki em dias, direto**, com um piso em `S_MIN` do `ts-fsrs` (`0.001`) para os `ivl` zero/negativos de
  cards ainda em Learn/Relearn: `stability = max(ivl > 0 ? ivl : 0, S_MIN)`.
- **`difficulty`** (escala `1`–`10`, `1` = mais fácil): mapeamento linear inverso do `factor` (mais
  fácil no Anki = ease mais alto = difficulty mais baixa no FSRS), ancorado em dois pontos reais do
  Anki — o piso de ease que o Anki reforça (`1300`, "Fator mínimo") e o passo padrão de ajuste de ease
  do próprio Anki (`200`, "Bônus de fácil"/incrementos usuais de ease) — não uma constante inventada:

  ```ts
  const EASE_FLOOR = 1300; // piso de ease que o próprio Anki impõe -> difficulty mais alta (10)
  const EASE_STEP = 200; // passo padrão de ajuste de ease do Anki -> 1 ponto de difficulty por passo
  difficulty = clamp(10 - (factor - EASE_FLOOR) / EASE_STEP, 1, 10);
  ```

  No ease padrão do Anki (`2500`, um card que ninguém ajustou), isso dá `difficulty = 4` — perto da
  difficulty inicial típica do próprio FSRS após um primeiro "Good" (os pesos padrão do FSRS giram em
  torno de `4`–`5` nesse caso), o que valida a âncora escolhida.

## Fora de escopo (não tocar)

- Gravação em `review_items`, IPC, UI — issue de importação futura (ver nota de correlação acima).
- Leitura de `revlog` — decisão do usuário, AC acima.
- Precisão exata do agendamento do Anki (hora de virada de dia configurável, fuso horário da criação da
  coleção, `left`/passos de aprendizado remanescentes) — simplificações documentadas no AC-3.
- Cards de deck filtrado (`odid ≠ 0`, `original_due`/`odue`) — o seed usa `due`/`queue` da linha tal
  qual, sem tentar reconstruir o due "de origem" (isso é responsabilidade de `mapAnkiNotesToFlashcards`
  ao decidir o deck, não deste módulo, que só lida com o estado de revisão).

## Ordem do pipeline

1. **Testador**: RED em `src/tests/unit/anki-review-seed.test.ts`, fixtures SQLite sintéticas
   (`better-sqlite3`, mesmo padrão de `anki-note-mapper.test.ts`) cobrindo: card `type = 0` (usa
   `createInitialReviewItemFields()` tal qual), card Review com `cards.data` tendo `s`/`d` (usa os
   valores nativos), card Review sem `data` (heurística: `ivl`/`factor` → `stability`/`difficulty`
   verificáveis pela fórmula), card Learn com `ivl` negativo (`stability = S_MIN`), card com `queue = 1`
   (due = timestamp direto) vs. `queue = 2` (due = `crt + due dias`), e um card suspenso (`queue = -1`)
   ainda recebendo um seed coerente com seu `type`. Confirmar RED pelo motivo certo, commitar.
2. **Desenvolvedor**: implementar até GREEN, reaproveitando `src/utils/fsrs.ts` sem alterá-lo.
3. **Revisor**: `npm run test:unit`; confirmar que nenhum card é excluído do resultado (ao contrário da
   Issue #30, aqui **toda** linha de `cards` produz um seed); que a fórmula de `stability`/`difficulty`
   bate com o AC-4; que não há leitura de `revlog` nem gravação em `review_items`/IPC/UI.
4. **Redator de Docs**: `CHANGELOG.md`, referenciando a Issue #31 e a nota de correlação com a #30.
