# Spec — Release para Linux com AppImage

- **Branch:** `feature/linux-appimage-release`
- **Motivação:** o release não tem nenhum artefato para Linux. O workflow `publish.yaml` roda só em
  `windows-2022`, e os makers do Forge só geram pacotes para a plataforma em que rodam, então nem o
  `.deb`/`.rpm` já configurados chegam ao release. Usuários de Linux precisam de um **AppImage**, um
  arquivo único que roda em qualquer distro, sem instalação.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. `forge.config.ts` declara o maker de AppImage (`@reforged/maker-appimage`) restrito a `linux`.
2. O workflow `Publish Release` roda também em um runner Linux, com as ferramentas de sistema que os
   makers Linux exigem, e publica no mesmo release rascunho que o job Windows.
3. O release gerado contém `Personare-<versão>-x64.AppImage` (além de `.deb` e `.rpm`).

## Escolhas técnicas (registradas para o Revisor)

- **`@reforged/maker-appimage`**: o Forge não tem maker oficial de AppImage. Esse é o mantido pelo
  projeto ReForged, compatível com Forge 7. Ele usa o runtime AppImage *type 2*, que é estático e não
  exige `libfuse2` na máquina do usuário.
- **Referenciado pelo nome (`name: "@reforged/maker-appimage"`) em vez de `new MakerAppImage()`**: o
  pacote é ESM-only, e o Forge o carrega com o próprio `import()`. Evita depender de como o
  `forge.config.ts` é transpilado.
- **`platforms: ["linux"]` obrigatório**: o maker declara `isSupportedOnCurrentPlatform = () => true`.
  Sem a restrição, o job Windows tentaria gerar o AppImage e falharia por falta do `mksquashfs`.
- **`bin: "Personare"`**: o `@electron/packager` nomeia o executável Linux com o `productName`, e o
  maker, por padrão, procuraria pelo `name` do `package.json` (`personare`). O mesmo vale para
  `MakerDeb` e `MakerRpm`: o primeiro publish falhou no `.deb` com `could not find the Electron app
  binary at ".../personare"`. Por isso os três recebem `bin`. Não usamos
  `packagerConfig.executableName`, porque ele renomearia também o `.exe` do Windows usado pelo Squirrel.
- **Matriz no workflow com `max-parallel: 1`**: os dois jobs publicam no mesmo release rascunho
  (`v<versão>`). Em paralelo, os dois poderiam não encontrar o rascunho e criar dois releases.
  Rodando em sequência, o segundo job encontra o rascunho do primeiro e anexa seus arquivos.
- **Pacotes de sistema no runner Ubuntu**: `squashfs-tools` (`mksquashfs`, AppImage), `rpm` (maker-rpm)
  e `fakeroot`/`dpkg` (maker-deb).
- **`better-sqlite3`** já traz o prebuild `linux-x64` em `prebuilds/`, copiado pelo hook
  `copyExternalModules` (#111), então não precisa de rebuild no runner.

## Testes (TDD)

- `src/tests/unit/forge-makers.test.ts` (novo): o `forge.config.ts` inclui o maker
  `@reforged/maker-appimage` com `platforms` igual a `["linux"]` e `bin` igual ao `productName`.
- **Verificação manual** (não automatizável no vitest, a máquina de desenvolvimento é Windows): rodar o
  workflow `Publish Release` e conferir que o rascunho do release tem o `.AppImage`. Baixar o arquivo em
  uma distro Linux, rodar `chmod +x` e abrir o app.
