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

1. `npm run check` — lint/format (Ultracite/Biome). Falhas aqui bloqueiam o CI (workflow `Check`).
2. `npm run test:unit` (ou `npm run test:all` para incluir e2e).
3. Se `package.json` mudou, confira que `package-lock.json` está em sincronia rodando `npm ci` localmente antes de commitar — um merge/rebase pode gerar um lockfile textualmente válido porém inconsistente (`npm ci` falha com `EUSAGE`/pacotes "Missing"/"Invalid" mesmo sem conflito aparente). Nesse caso, regenere com `npm install` a partir de uma base consistente, ou restaure o lockfile da branch base quando `package.json` não mudou de fato as dependências resolvidas.

Só abra o PR depois que os três passarem localmente.

## Escopo de arquivos

Ao planejar múltiplas issues em paralelo, declare explicitamente quais arquivos cada uma vai tocar antes de começar. Isso permite identificar issues sem sobreposição (podem rodar em paralelo, em branches/worktrees isoladas) e issues com dependência real (ex.: uma issue que define schema de banco depende da issue que configura o ORM). `package.json`/`package-lock.json` costumam ser tocados por qualquer issue que adiciona dependência — trate como zona de baixo risco (linhas diferentes raramente conflitam), mas sempre valide com `npm ci` após reconciliar.
