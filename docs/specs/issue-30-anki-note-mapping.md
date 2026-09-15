# Spec — Issue #30: Mapeamento de note types/templates do Anki para Flashcard

- **Issue:** #30 — "Mapeamento de note types/templates do Anki para Flashcard" (Plan.md seção 6 e
  Fase 3, item 25).
- **Corpo da issue:** "Converter os note types e templates do Anki para o modelo de Flashcard do
  Personare, incluindo mídia associada."
- **Branch:** `feature/30-anki-note-mapping`
- **Depende de:** Issue #29 (`src/main/anki-apkg-parser.ts`), que já entrega um handle `better-sqlite3`
  aberto sobre o banco de coleção extraído do `.apkg` e a lista de mídia resolvida por nome original.
  Esta issue consome esse `db` (o chamador de `parseApkg` continua responsável por `db.close()` — este
  módulo só lê, nunca fecha).
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Cloze deletion está DENTRO do escopo** (após explicação do que é: note types cujo template usa
     `{{cloze:Campo}}`, onde uma única note gera N cards — um por número de cloze `{{cN::...}}` distinto
     — cada card mascarando só o seu próprio número na frente e revelando tudo no verso).
  2. **Módulo puro, sem DB/IPC/UI** — mesma filosofia da #29: recebe o `db` de `parseApkg` e devolve uma
     estrutura em memória. Gravar `Activities`/`Flashcards` de fato no banco do Personare fica para uma
     issue de "importação" futura, ainda não numerada no `Plan.md`.
  3. **Agrupamento por deck do Anki**: o retorno é agrupado por deck original (um `.apkg` pode conter
     vários decks), já que cada deck do Anki mapeia naturalmente para um futuro Baralho/Activity.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Fora de escopo (issue seguinte)**: heurística de conversão de estado SM-2 → seed inicial de FSRS
  (#31). Esta issue não lê `revlog` nem os campos de agendamento de `cards` (`due`/`ivl`/`factor`/etc.).

## Contexto técnico: schema do banco de coleção

Verificado diretamente no repositório `ankitects/anki` (`rslib/src/storage/schema11.sql`,
`rslib/src/storage/upgrades/schema15_upgrade.sql`, `rslib/src/notetype/schema11.rs`,
`rslib/src/decks/schema11.rs`, `proto/anki/notetypes.proto`, `rslib/src/cloze.rs`, `rslib/src/template.rs`)
para esta spec.

O parser da Issue #29 já normaliza a diferença de **arquivo/compressão** entre as 3 versões de pacote,
mas a diferença de **schema SQL interno** é outra dimensão, ortogonal: `PackageVersion.Legacy1`/
`Legacy2` sempre escrevem `col.ver = 11` (schema legado, tudo em JSON dentro da tabela `col`);
`PackageVersion.Latest` sempre escreve schema `>= 15` (tabelas normalizadas). Este módulo detecta o
schema lendo `SELECT ver FROM col` diretamente — não reaproveita a versão de pacote da Issue #29 (o
`db` chega desacoplado dessa informação, e ler `col.ver` é o que o próprio Anki faz internamente).

### Schema legado (`col.ver <= 11`)

- `col.models`: JSON `Record<string, NotetypeJSON>` (chave = id do notetype como string). Campos
  usados: `flds: { name: string; ord: number }[]`, `tmpls: { name: string; ord: number; qfmt: string;
  afmt: string }[]`, `type: 0 | 1` (0 = Standard, 1 = Cloze — chave JSON é literalmente `"type"`,
  confirmado em `NotetypeSchema11` via `#[serde(rename = "type")] kind`).
- `col.decks`: JSON `Record<string, { id: number; name: string }>`.
- `notes.flds`: campos da note concatenados com o separador `\x1f` (0x1F, "unit separator"), na ordem
  de `ord` do notetype.
- `notes.mid`: id do notetype (chave em `col.models`).
- `cards.nid` / `cards.did` / `cards.ord`: nota, deck e ordinal do template (ou número de cloze, ver
  abaixo).
- `cards.odid`: deck "de origem" quando o card está temporariamente num deck filtrado (`0` quando não
  está); **usar `odid` como deck efetivo quando `odid !== 0`**, senão `did` — mesma regra que o próprio
  Anki usa para saber a que deck "pertence" um card (`ix_cards_odid` existe exatamente para isso).

### Schema novo (`col.ver >= 15`, inclui a `Latest`/`anki21b` da Issue #29)

Tabelas normalizadas (`rslib/src/storage/upgrades/schema15_upgrade.sql`):

```sql
CREATE TABLE notetypes (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB);
CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT, config BLOB, PRIMARY KEY (ntid, ord));
CREATE TABLE templates (ntid INTEGER, ord INTEGER, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB, PRIMARY KEY (ntid, ord));
CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, common BLOB, kind BLOB);
```

`name` já é coluna em `fields`/`templates`/`decks` — só as colunas `config` (BLOB) são protobuf e
precisam de `decodeFields`/`decodeVarint` de `src/utils/protobuf-lite.ts` (reaproveitado tal qual da
Issue #29, nenhuma dependência nova). Mensagens relevantes, de `proto/anki/notetypes.proto`
(`Notetype.Config`, `Notetype.Template.Config`) — só os 2 campos usados por este módulo:

- `notetypes.config` (`Notetype.Config`): campo 1 = `kind` (varint; `0` = `KIND_NORMAL`, `1` =
  `KIND_CLOZE`). Outros campos (`css`, `latex_pre`/`post`, `reqs`, ...) são ignorados.
- `templates.config` (`Notetype.Template.Config`): campo 1 = `q_format` (length-delimited, UTF-8),
  campo 2 = `a_format` (length-delimited, UTF-8). Outros campos (`target_deck_id`,
  `browser_font_name`, ...) são ignorados.
- `fields.config` (`Notetype.Field.Config`) **não precisa ser decodificado** — o nome do campo já é a
  coluna `fields.name`, e nenhuma outra propriedade (`sticky`, `rtl`, `font_name`, ...) é usada por
  este módulo.

`notes`/`cards` mantêm as mesmas colunas usadas acima (`flds`, `mid`, `nid`, `did`, `odid`, `ord`) em
todas as versões de schema — só `models`/`decks`/notetypes é que migram de JSON para tabela.

### Renderização de template (`rslib/src/template.rs`, `rslib/src/cloze.rs`)

- Sintaxe: `{{Campo}}` (substituição simples), `{{#Campo}}...{{/Campo}}` (seção condicional — mantém o
  conteúdo interno só se o campo, **antes** de qualquer substituição, tiver valor não-vazio),
  `{{^Campo}}...{{/Campo}}` (negado — mantém só se o campo for vazio), `{{FrontSide}}` (só usado no
  `afmt`; é substituído pelo HTML já renderizado do `qfmt` do mesmo card — precisa renderizar a
  pergunta primeiro).
- Um handlebar pode ter filtros encadeados (`{{filtro:Campo}}`, ex. `{{cloze:Text}}`,
  `{{text:Front}}`) — sintaticamente é sempre `{{` + (opcionais `filtro:` repetidos) + nome do campo +
  `}}`, o nome do campo é sempre o último segmento após o último `:` (`classify_handle` em
  `template.rs`, que despacha por prefixo `#`/`/`/`^`, senão trata como `Replacement`).
- **Cloze** (`{{c<N[,N2,...]>::texto[::dica]}}`, `rslib/src/cloze.rs`): ao renderizar o campo alvo de um
  filtro `cloze:` para o número de cloze ativo do card (`card_ord + 1`, já que `cards.ord` é 0-based e
  os números de cloze `{{cN::}}` são 1-based):
  - Lado pergunta (`qfmt`): a(s) marcação(ões) cujo conjunto de números contém o número ativo viram
    `[dica]` (ou `[...]` se não houver dica); qualquer outra marcação de cloze no mesmo campo (número
    diferente) revela seu texto interno sem mascarar.
  - Lado resposta (`afmt`): a marcação ativa revela seu texto interno; as demais também revelam o
    delas — ou seja, no lado resposta toda marcação vira simplesmente seu texto interno.
  - Fora de qualquer marcação, o texto do campo passa inalterado nos dois lados.
  - Aninhamento de clozes (`{{c1::a {{c2::b}} c}}`) e o caso especial `image-occlusion:` **não são
    suportados** — ver "Fora de escopo".

## AC-1 — `src/main/anki-note-mapper.ts`

```ts
export interface AnkiMappedFlashcard {
  front: string; // HTML já renderizado (substituição de {{}}, condicionais e cloze aplicados)
  back: string;
  mediaFilenames: string[]; // nomes originais referenciados em front+back (img src / [sound:...]), deduplicados, na ordem de primeira ocorrência
}

export interface AnkiMappedDeck {
  deckName: string;
  cards: AnkiMappedFlashcard[];
}

export function mapAnkiNotesToFlashcards(
  db: Database.Database
): AnkiMappedDeck[];
```

Passos internos:

1. **Detectar schema**: `SELECT ver FROM col`. `ver <= 11` → ler notetypes/decks de `col.models`/
   `col.decks` (JSON.parse). `ver >= 15` → ler das tabelas `notetypes`/`fields`/`templates`/`decks`,
   decodificando as colunas `config` via `decodeFields` (ver acima). Qualquer outro valor de `ver`
   (entre 12 e 14, versões intermediárias nunca produzidas por um `.apkg` real — só existem
   transitoriamente durante upgrade de uma coleção viva) → tratar como não suportado:
   `throw new Error("Coleção Anki com schema não suportado")`.
2. **Montar índice de notetypes**: `Map<id, { kind: "standard" | "cloze"; fields: string[] /* por ord
   */; templates: { name: string; qfmt: string; afmt: string }[] /* por ord */ }>` — uma forma comum
   para os dois schemas, para que o resto do módulo não precise mais saber qual schema originou os
   dados.
3. **Montar índice de decks**: `Map<id, string>` (nome por id), dos dois schemas.
4. **Iterar `cards`** (`SELECT id, nid, did, odid, ord FROM cards`), para cada uma:
   - Resolver a note (`SELECT flds, mid FROM notes WHERE id = nid`) e o notetype pelo `mid`.
   - Separar `flds` por `\x1f` na ordem de `ord` de cada campo do notetype, montando
     `Map<fieldName, value>`.
   - Resolver o deck efetivo: `odid !== 0 ? odid : did`, e o nome via o índice de decks (deck ausente
     do índice — ex. deck deletado que sobrou como id órfão — usa `"Default"` como fallback, mesmo nome
     que o Anki usa para o deck padrão implícito).
   - Se `notetype.kind === "standard"`: o template é `notetype.templates[ord]` (fora do intervalo →
     pular o card silenciosamente, mesma tolerância da Issue #29 com mídia ausente — um `.apkg`
     malformado não deve derrubar a extração inteira). Renderiza `qfmt` (substituição simples +
     condicionais) para obter `front`; depois `afmt` com `FrontSide` = `front` já renderizado, para
     obter `back`.
   - Se `notetype.kind === "cloze"`: o template é sempre `notetype.templates[0]` (note types cloze têm
     exatamente 1 template — `ord` do card aqui é o número de cloze menos 1, não um índice de
     template). Renderiza `qfmt`/`afmt` da mesma forma, mas com o filtro `cloze:Campo` avaliado usando
     o número de cloze ativo `ord + 1` (regras acima). Um card cujo `ord + 1` não aparece em nenhuma
     marcação de cloze do campo referenciado é pulado silenciosamente (nota editada depois de o card já
     existir, cenário tolerado pelo próprio Anki via a mesma checagem de `cloze_is_empty`).
   - Extrai `mediaFilenames` de `front + back` via regex simples: `src="..."` / `src='...'` (tags
     `<img>`/`<audio>`/`<video>`) e `[sound:...]`.
   - Agrupa o resultado `{ front, back, mediaFilenames }` sob o nome do deck efetivo.
5. Retorna a lista de decks (só os que tiverem pelo menos 1 card — decks vazios nunca aparecem, já que
   a iteração é por `cards`), cada um com seus cards na ordem em que os cards foram varridos
   (`ORDER BY id`, ordem estável e determinística para os testes).

### Tratamento de erros

- Nenhuma condição listada acima lança erro de card individual — cards/campos malformados são pulados
  silenciosamente (mesma tolerância da Issue #29), já que um `.apkg` real pode ter alguma nota órfã ou
  editada de forma inconsistente sem que isso deva impedir a importação do resto.
- Só o schema de coleção não suportado (passo 1) lança `Error`, em português, sem `cause`.

## Fora de escopo (não tocar)

- Gravação em `activities`/`flashcards`/qualquer tabela do Personare, IPC, ou UI — issue futura de
  "importação" (ainda não numerada no `Plan.md`).
- `revlog`, `cards.due`/`ivl`/`factor`/`reps`/`lapses` e qualquer estado de agendamento — Issue #31
  (heurística SM-2 → seed FSRS).
- Filtros de template além de `cloze:` (`{{text:Campo}}`, `{{type:Campo}}`, `{{hint:Campo}}`,
  `{{furigana:Campo}}`, `{{kanji:Campo}}`, `{{kana:Campo}}`): tratados como substituição simples do
  campo, ignorando o filtro (comportamento degradado aceitável, documentado aqui, não um bug).
- Campos especiais `{{Tags}}`, `{{Deck}}`, `{{Subdeck}}`, `{{Card}}`, `{{CardFlag}}`, `{{Type}}` —
  tratados como campo inexistente (substituição vazia), já que nenhum note type padrão do Anki os
  referencia dentro do próprio texto de frente/verso além de `{{FrontSide}}` (que é suportado).
- Aninhamento de clozes e `{{cN::image-occlusion:...}}` (note type "Image Occlusion") — nota inteira
  pulada se o parsing de cloze encontrar aninhamento (sem crash, sem card gerado).
- Sintaxe alternativa de delimitador (`{{=<% %>=}}`) e comentários de template (`{{!...}}`,
  `<!-- -->`) — deixados como texto literal, sem processamento especial.
- Baixar/copiar os bytes de mídia para disco, ou resolver `mediaFilenames` contra a lista `media` da
  Issue #29 — é responsabilidade do consumidor futuro (issue de importação), que já tem os dois
  resultados (`parseApkg().media` e `mapAnkiNotesToFlashcards(db).cards[].mediaFilenames`) para cruzar
  por nome.
- Deduplicação/normalização de HTML de `front`/`back` além do necessário para os testes — o HTML bruto
  do Anki é preservado tal qual (a decisão de como Personare renderiza esse HTML, incluindo se
  `dangerouslySetInnerHTML`-equivalente é seguro, fica para a issue de importação).

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED em `src/tests/unit/anki-note-mapper.test.ts` usando
   fixtures SQLite sintéticas construídas em memória com `better-sqlite3` (`db.serialize()`/`new
   Database(buffer)`, mesmo padrão de `anki-apkg-parser.test.ts`) cobrindo: schema legado (`col.models`/
   `col.decks` JSON) com um note type "Basic" (1 template, condicional `{{#Back}}`), schema novo
   (tabelas `notetypes`/`fields`/`templates`/`decks` com `config` codificado à mão via os helpers de
   protobuf já existentes no teste da Issue #29) com o mesmo caso, um note type cloze com múltiplos
   `{{cN::}}` gerando cards distintos, um card em deck filtrado (`odid !== 0`), um card cujo `ord`
   estoura o array de templates (deve ser pulado), e agrupamento por múltiplos decks. Confirmar RED
   pelo motivo certo (`mapAnkiNotesToFlashcards` não existe), commitar, não implementar produção.
2. **Desenvolvedor**: implementar `src/main/anki-note-mapper.ts`, reaproveitando
   `src/utils/protobuf-lite.ts` sem alterá-lo (a menos que um campo genuinamente faltante seja
   descoberto — documentar no PR se acontecer), até todos os testes passarem.
3. **Revisor**: rodar `npm run test:unit`, revisar o diff contra este spec, confirmar que nenhum card é
   pulado silenciosamente por engano (só os casos documentados acima), que a extração de
   `mediaFilenames` cobre `<img>`/`<audio>`/`<video src>` e `[sound:]`, e que não há vazamento de escopo
   para `revlog`/FSRS (Issue #31) nem para DB/IPC/UI.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #30.
