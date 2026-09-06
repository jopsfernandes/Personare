# Contribuindo com o Personare

Este documento existe para orientar quem (humano ou agente) for implementar as issues das próximas fases do [`Plan.md`](./Plan.md). Ele registra convenções já em uso no projeto, não regras novas.

## Metodologia

O projeto segue **Spec Driven Development com TDD** (Red-Green-Refactor): primeiro descreva a especificação/critérios de aceite da issue, depois escreva testes que falhem contra esses critérios (RED), implemente o mínimo necessário para passá-los (GREEN), e só então revise e documente.

## Branches

Cada feature/issue recebe sua própria branch — **nunca commitar direto em `main`**. Convenção de nome:

```
feature/<numero-da-issue>-<slug-curto>
```

Exemplos: `feature/1-rebrand-personare`, `feature/2-sqlite-drizzle`.

## Commits

Mensagem no imperativo, resumindo a mudança e o motivo (não apenas o "o quê"):

```
Add CONTRIBUTING.md documenting branch/commit conventions (#5)

Documents the workflow already in use so sub-agents executing future
phase issues have a single source of truth to follow.
```

## Antes de abrir o PR

Rode, nessa ordem:

1. `npm run check` — lint/format (Ultracite/Biome). Falhas aqui bloqueiam o CI (workflow `Check`). Rode escopado aos arquivos tocados (`npx ultracite check <arquivos>`) se estiver em uma checkout Windows — o repo tem arquivos versionados em LF e o Git local costuma reescrever para CRLF no checkout (`core.autocrlf=true`), o que faz um `npm run check` completo acusar dezenas de falsos positivos de formatação em arquivos que você nem tocou. Arquivos gerados pelo `drizzle-kit generate` (`drizzle/meta/*.json`) quase sempre precisam de um `npx ultracite fix` antes de commitar (o gerador não colapsa arrays curtos numa linha nem garante newline final, e o Biome exige os dois).
2. `npm run test:unit`, e **rode `npm run test:e2e` (ou `test:all`) sempre que a mudança tocar a rota inicial ("/") ou o layout raiz** — o e2e é pesado (empacota o app) e é tentador pular, mas `npm run test:unit` sozinho não pega quando uma tela substitui conteúdo que o smoke test do e2e verificava (ex.: a Issue #8 substituiu a home page placeholder pela Data Table de Programas, quebrando a asserção antiga do e2e sobre o `<h1>` da home). Prefira que o smoke test do e2e verifique algo estável entre reescritas de página (ex.: o `document.title`) em vez de conteúdo específico de uma rota que pode virar feature real depois.
3. Se `package.json` mudou, confira que `package-lock.json` está em sincronia rodando `npm ci` localmente antes de commitar — um merge/rebase pode gerar um lockfile textualmente válido porém inconsistente (`npm ci` falha com `EUSAGE`/pacotes "Missing"/"Invalid" mesmo sem conflito aparente). Em checkouts Windows isso também acontece SEM merge nenhum: um simples `npm install`/`npm ci` pode silenciosamente derrubar entradas de dependências opcionais/multiplataforma do lockfile (ex.: `@emnapi/*`, `encoding`/`iconv-lite`) mesmo quando a dependência sendo adicionada não tem nada a ver com elas, e cada execução pode derrubar um conjunto diferente. `npm ci` nunca reescreve o lockfile (só valida), então é seguro para checar; `npm install` reescreve e pode corromper de novo. Se isso acontecer, não regenere tudo do zero — compare contra o lockfile de `main` (ex.: com um script que diffa as chaves de `packages` entre os dois arquivos) e restaure só as entradas que sumiram, preservando o resto do arquivo.

Só abra o PR depois que os três passarem localmente.

## Escopo de arquivos

Ao planejar múltiplas issues em paralelo, declare explicitamente quais arquivos cada uma vai tocar antes de começar. Isso permite identificar issues sem sobreposição (podem rodar em paralelo, em branches/worktrees isoladas) e issues com dependência real (ex.: uma issue que define schema de banco depende da issue que configura o ORM). `package.json`/`package-lock.json` costumam ser tocados por qualquer issue que adiciona dependência — trate como zona de baixo risco (linhas diferentes raramente conflitam), mas sempre valide com `npm ci` após reconciliar.
