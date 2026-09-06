# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

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
