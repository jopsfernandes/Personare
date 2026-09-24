# Spec — Issue #111: Alpha instalado não abre (`Cannot find module 'better-sqlite3'`)

- **Issue:** #111 — "Alpha instalado não abre: Cannot find module 'better-sqlite3'".
- **Branch:** `fix/111-package-external-native-modules`
- **Motivação:** o instalador do `v0.1.0-alpha.1` abre com `Uncaught Exception: Error: Cannot find
  module 'better-sqlite3'` (`resources\app.asar\.vite\build\main.js`). `better-sqlite3` é `external`
  no `vite.main.config.mts` (o binário `.node` não pode ser bundlado), mas o `plugin-vite` do Forge
  só empacota a saída `.vite` + `package.json`: o módulo nunca é copiado para dentro do `app.asar`.
  O bug nunca apareceu antes porque o app empacotado rodava de `out/` dentro do repositório, e o
  `require` subia até o `node_modules` do projeto.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Escolhas técnicas (registradas para o Revisor)

- **Lista única de módulos externos (`scripts/external-modules.ts`)**, importada tanto pelo
  `vite.main.config.mts` (`rollupOptions.external`) quanto pelo hook do Forge: quem marca um módulo
  como `external` passa a ser automaticamente quem o empacota, sem duas listas para manter em sincronia.
- **Hook `packageAfterCopy` (`scripts/copy-external-modules.ts`)** copia cada módulo externo de
  `node_modules/<nome>` para `<buildPath>/node_modules/<nome>`. É o mecanismo documentado do Forge
  para dependências que o Vite não bundla, já que o `plugin-vite` descarta tudo fora de `.vite`.
  Ficam de fora `deps/` e `src/` (fontes C++ do SQLite/binding, ~10 MB que só servem para compilar).
- **`AutoUnpackNativesPlugin`** (já era devDependency, mas não estava ligado) move os `.node` para
  `app.asar.unpacked`, que é onde binários nativos precisam estar para carregar.
- **Módulo ausente falha o build** com mensagem clara, em vez de gerar um instalador quebrado.

## Testes (TDD)

- `src/tests/unit/copy-external-modules.test.ts` (novo): copia `package.json`, `lib/` e `prebuilds/`
  de cada módulo; ignora `deps/` e `src/`; lança erro nomeando o módulo quando ele não existe em
  `node_modules`; a lista exportada contém `better-sqlite3`.
- **Verificação manual do empacotado** (não automatizável no vitest): `npm run package`, copiar
  `out/Personare-win32-x64` para **fora** do repositório e abrir o `.exe` — a janela principal precisa
  abrir sem o diálogo de erro.
