# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Added

- **Integração de banco de dados local com SQLite + Drizzle** ([#2](https://github.com/jopsfernandes/Personare/issues/2)).
  Adiciona persistência local ao app via `better-sqlite3` e `drizzle-orm`/`drizzle-kit`:
  - `src/database/client.ts`: client de conexão SQLite criado no processo main.
  - `src/database/migrate.ts`: execução automática das migrations no startup, com suporte a build empacotado via `process.resourcesPath` (e `extraResource: ["./drizzle"]` em `forge.config.ts`).
  - `drizzle/0000_init.sql`: primeira migration, vazia.
  - Novo namespace de IPC/oRPC `database` (`src/ipc/database/`), expondo `getDatabaseStatus` ao renderer.
- **Dependência `ts-fsrs` e teste de corretude do algoritmo FSRS** ([#3](https://github.com/jopsfernandes/Personare/issues/3)).
  Adicionada a biblioteca `ts-fsrs` (`^5.4.2`) como dependência do projeto, base para o agendamento de repetição espaçada (FSRS) previsto na Fase 1.
  - Novo teste de regressão `src/tests/unit/fsrs-correctness.test.ts`, validando `stability`, `difficulty` e os intervalos (`scheduled_days`) calculados pelo algoritmo FSRS-6 (pesos padrão da biblioteca) contra sequências de ratings (`again`/`hard`/`good`/`easy`).
  - Os valores de referência usados no teste são copiados literalmente da suíte de testes oficial do `ts-fsrs` (`FSRS-6.test.ts`, upstream `open-spaced-repetition/ts-fsrs`), garantindo que nossa integração se comporte de forma idêntica à implementação de referência.

### Changed

- **Rebranding do boilerplate `electron-shadcn` para Personare** ([#1](https://github.com/jopsfernandes/Personare/issues/1)).
  Removidas todas as referências ao boilerplate original (`electron-shadcn`) e ao autor original (`LuanRoger`), substituídas pela identidade do projeto Personare:
  - `README.md`: textos e links atualizados para o Personare.
  - `package.json`: campo `author` alterado para `Personare <contato@devfernandes.com>`.
  - `forge.config.ts`: publisher do Electron Forge (GitHub) atualizado para `owner: jopsfernandes`, `name: Personare`.
  - `src/main.ts`: configuração do `update-electron-app` atualizada para o novo repositório.
  - `src/localization/i18n.ts`: `appName` alterado para `Personare` e `madeBy` para `Made by Personare` / `Feito por Personare` (en e pt-BR).
  - `index.html`, `src/components/navigation-menu.tsx`, `src/layouts/base-layout.tsx`, `src/routes/index.tsx`: referências de UI/título atualizadas.
  - `src/tests/e2e/example.test.ts`: teste de título de janela atualizado para o novo nome do app.
  - Cobertura de testes adicionada (`src/tests/unit/branding-config.test.ts`, `src/tests/unit/branding-i18n.test.ts`, `src/tests/unit/no-legacy-branding.test.ts`) garantindo que nenhuma ocorrência de `electron-shadcn` ou `LuanRoger` permaneça no código-fonte.
