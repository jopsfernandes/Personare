# Spec — Issue #29: Parser de arquivos .apkg do Anki

- **Issue:** #29 — "Parser de arquivos .apkg do Anki" (Plan.md seção 6 e Fase 3, item 24).
- **Corpo da issue:** "Implementar a extracao do arquivo .apkg (zip contendo um banco SQLite interno +
  midia) para leitura dos decks/notes/cards do Anki."
- **Branch:** `feature/29-anki-apkg-parser`
- **Decisão do usuário (confirmada antes deste spec, não deduzida)**: suportar tanto o formato legado
  do Anki (`collection.anki2`/`.anki21`, SQLite puro) quanto o formato atual (`collection.anki21b`,
  SQLite comprimido em zstd), já que exports feitos com Anki 2.1.50+ (padrão desde 2022) usam o formato
  novo por padrão.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Fora de escopo (issues seguintes)**: mapear note types/templates do Anki para o modelo de Flashcard
  do Personare (#30) e a heurística de conversão de estado SM-2 → seed inicial de FSRS (#31). Esta issue
  entrega só a extração: um handle de banco SQLite consultável (tabelas cruas do Anki: `col`, `notes`,
  `cards`, `decks`/`notetypes` conforme a versão de schema) e os arquivos de mídia resolvidos por nome
  original. Nenhuma UI, nenhum IPC — é um módulo puro de leitura, consumido pelas issues seguintes.

## Contexto técnico: formato `.apkg`

Um `.apkg` é um arquivo zip. O código-fonte do Anki (`rslib/src/import_export/package/meta.rs` e
`media.rs`, verificados diretamente no repositório `ankitects/anki` para esta spec) define 3 versões de
pacote, identificadas por um arquivo `meta` (protobuf) na raiz do zip:

| `meta` (protobuf `PackageMetadata.version`) | Banco de coleção      | Comprimido em zstd? | Lista de mídia                          |
| -------------------------------------------- | --------------------- | -------------------- | ---------------------------------------- |
| Ausente + `collection.anki21` presente        | `collection.anki21`   | Não                   | JSON (`{"0": "arquivo.jpg", ...}`)       |
| Ausente + só `collection.anki2` presente      | `collection.anki2`    | Não                   | JSON (`{"0": "arquivo.jpg", ...}`)       |
| `VERSION_LEGACY_1` (1)                        | `collection.anki2`    | Não                   | JSON                                      |
| `VERSION_LEGACY_2` (2)                        | `collection.anki21`   | Não                   | JSON                                      |
| `VERSION_LATEST` (3)                          | `collection.anki21b`  | Sim                   | Protobuf `MediaEntries` (também zstd)    |
| `VERSION_UNKNOWN` (0)                         | —                      | —                     | Erro: pacote de uma versão não suportada |

Quando comprimido em zstd (`VERSION_LATEST`), tanto o banco de coleção quanto a entrada `media` (a
lista) **e cada arquivo de mídia individual** (as entradas do zip nomeadas `"0"`, `"1"`, ...) estão
comprimidos em zstd separadamente — não é um zip com compressão diferente, é conteúdo já
zstd-comprimido dentro de entradas zip armazenadas (`STORED`).

A lista de mídia mapeia o nome da entrada no zip (um índice numérico) para o nome de arquivo original
referenciado no HTML das notes (ex.: `<img src="foto.jpg">`):

- Formato legado: entrada `media` é um JSON `Record<string, string>` (`{"<índice>": "<nome original>"}`).
- Formato novo: entrada `media` é um protobuf `MediaEntries { repeated MediaEntry entries = 1; }` com
  `MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }` — a posição de cada `MediaEntry` no
  array (0-based) é o índice/nome da entrada no zip (`decode_safe_entries`/`from_entry` em `media.rs`
  usam `.enumerate()`, não um campo explícito).
- Se a entrada `media` não existir no zip, a lista é vazia (`{}`) — mesmo fallback do Anki, para
  compatibilidade com versões antigas do AnkiDroid que exportavam sem mapa de mídia.

O protobuf de ambas as mensagens (`PackageMetadata`, `MediaEntries`) é suficientemente simples (poucos
campos, tipos primitivos) para decodificar à mão via um parser genérico de wire format
(varint/length-delimited), sem depender de uma lib de protobuf completa nem do `.proto` compilado do
Anki.

## AC-1 — Nova dependência: `zstd-codec`

Lib WASM (sem binário nativo, evita o mesmo problema de compilação já documentado para
`better-sqlite3` no `CONTRIBUTING.md`), zero dependências transitivas. Usada tanto para decodificar
pacotes reais (`Simple#decompress`) quanto, nos testes, para comprimir fixtures sintéticas
(`Simple#compress`) — uma só lib para as duas direções. Sem tipos publicados: adicionar uma declaração
de módulo mínima em `src/types.d.ts` cobrindo só a superfície usada (`ZstdCodec.run`, classe `Simple`
com `compress`/`decompress`).

## AC-2 — Nova dependência: `adm-zip` (+ `@types/adm-zip`)

Leitura de zip pura em JS (sem binário nativo), API síncrona (`new AdmZip(buffer)`,
`zip.getEntry(name)`, `entry.getData()`) — mesmo estilo síncrono já usado por `better-sqlite3` no
projeto.

## AC-3 — `src/utils/protobuf-lite.ts`: parser genérico de wire format

Não é uma implementação de protobuf completa — só o necessário para ler os 2 campos que este parser
precisa, de forma testável isoladamente:

- `decodeVarint(buffer: Uint8Array, offset: number): { value: number; nextOffset: number }`.
- `decodeFields(buffer: Uint8Array): Map<number, (Uint8Array | number)[]>` — percorre o buffer inteiro
  decodificando tag (`fieldNumber << 3 | wireType`) + payload por wire type (`0` varint → `number`, `2`
  length-delimited → `Uint8Array`), ignorando (mas avançando corretamente sobre) wire types `1`/`5`
  (64/32-bit fixos) caso apareçam em campos que este parser não usa. Agrupa por `fieldNumber` porque
  `repeated` no proto3 são só o mesmo `fieldNumber` repetido na sequência de bytes.

## AC-4 — `src/main/anki-apkg-parser.ts`

```ts
export interface AnkiApkgMedia {
  filename: string; // nome original (ex.: "foto.jpg"), já resolvido via a lista de mídia
  data: Buffer;
}

export interface AnkiApkgContents {
  db: Database.Database; // better-sqlite3, aberto em memória a partir do banco extraído
  media: AnkiApkgMedia[];
}

export async function parseApkg(filePath: string): Promise<AnkiApkgContents>;
```

Passos internos (`filePath` lido via `fs.readFileSync`, depois `new AdmZip(buffer)`):

1. **Versão do pacote**: ler a entrada `meta`, se existir, `decodeFields` + `decodeVarint` no campo 1
   para obter o enum de versão. Se ausente, usar `Legacy2` se `collection.anki21` existir no zip, senão
   `Legacy1` (mesma regra de `Meta::from_archive` no Anki). Versão `0`/desconhecida →
   `throw new Error("Pacote .apkg de uma versão não suportada")`.
2. **Banco de coleção**: nome do arquivo pela versão (`collection.anki2` / `.anki21` / `.anki21b`); se a
   entrada não existir no zip → `throw new Error("Arquivo .apkg inválido: banco de coleção não encontrado")`.
   Bytes brutos da entrada; se a versão for `Latest`, `zstdDecompress` antes de abrir. Abre com
   `new Database(bytes)` (better-sqlite3 aceita `Buffer`/`Uint8Array` para banco em memória — validado
   manualmente antes desta spec).
3. **Lista de mídia**: entrada `media`; ausente → lista vazia. Presente → se `Latest`, `zstdDecompress`
   primeiro; depois, se legado, `JSON.parse` como `Record<string, string>`; se `Latest`, `decodeFields`
   no campo 1 (repetido) e, para cada ocorrência, `decodeFields` de novo no sub-buffer para extrair o
   campo 1 (`name`, wire type 2, decodificado como UTF-8) — ignora `size`/`sha1`, não usados por este
   parser.
4. **Arquivos de mídia**: para cada `{ index, filename }` resolvido no passo 3, ler a entrada do zip
   nomeada pelo índice (`String(index)`); ausente → pular silenciosamente (arquivo referenciado que não
   veio no export, mesmo comportamento tolerante do Anki com uma mídia faltante). Se `Latest`,
   `zstdDecompress` os bytes; senão, usar tal qual. Resultado: `{ filename, data }`.
5. Retorna `{ db, media }`. **O chamador é responsável por `db.close()`** — este módulo não fecha o
   banco, pois quem chama ainda precisa consultá-lo (issues #30/#31).

### Tratamento de erros

- Arquivo não é um zip válido: deixa o erro do `adm-zip` propagar (mensagem já é clara o suficiente,
  não vale a pena envolver).
- Qualquer uma das condições descritas nos passos 1–2 acima: `Error` com mensagem em português,
  descritiva, sem `cause` (não há uma causa técnica subjacente a anexar — é uma constatação de formato).

## Fora de escopo (não tocar)

- Qualquer leitura/interpretação do conteúdo de `notes`/`cards`/`decks`/`notetypes` além de abrir o
  banco e devolver o handle — o mapeamento fica para a Issue #30.
- UI, IPC, ou qualquer wiring para acionar o parser a partir da interface — não há botão "Importar do
  Anki" nesta issue.
- `sha1` dos `MediaEntry` — não há verificação de integridade dos arquivos de mídia nesta issue.
- Suporte a `.colpkg` (export de coleção inteira, formato irmão do `.apkg` mas para todos os decks de
  uma vez, com metadados adicionais) — só `.apkg` (export de deck(s) específico(s)).

## Ordem do pipeline

1. **Testador**: RED em `src/tests/unit/protobuf-lite.test.ts` (varint/fields com bytes construídos à
   mão, incluindo casos de múltiplos bytes de varint e wire types mistos) e
   `src/tests/unit/anki-apkg-parser.test.ts` (fixtures sintéticas construídas em memória com `AdmZip` —
   uma cobrindo cada versão de pacote: `Legacy1` sem `meta`, `Legacy2` sem `meta`, `Latest` com `meta` +
   zstd real via `zstd-codec` nos testes, e o caso de versão desconhecida/pacote inválido).
2. **Desenvolvedor**: implementar o mínimo para o GREEN.
3. **Revisor**: confirmar que `db` nunca é fechado dentro do próprio `parseApkg` (o handle precisa
   sobreviver para quem chama), que o parser de protobuf não assume nenhum campo além dos 2 usados
   (ignora campos desconhecidos sem quebrar), e que a resolução de índice de mídia bate exatamente com a
   posição no array para o formato novo (não com nenhum campo do próprio `MediaEntry`).
4. **Redator de Docs**: `CHANGELOG.md`.
