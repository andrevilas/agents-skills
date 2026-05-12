# Runbook do fork `impeccable`

Este runbook descreve o fluxo mínimo para operar o fork de `impeccable` e sincronizar o bundle distribuído por `agents-skills`.

## Premissas

- existe um fork próprio de `pbakaus/impeccable`
- o fork mantém `upstream` apontando para `pbakaus/impeccable`
- o bundle consumido continua sendo `dist/agents/.agents/skills/impeccable/`

## Setup inicial do fork

1. Criar o fork em GitHub.
2. Clonar o fork localmente.
3. Configurar remotes:

```bash
git remote add upstream git@github.com:pbakaus/impeccable.git
git fetch upstream --tags
```

4. Validar que o projeto builda localmente no fork, seguindo o fluxo nativo do próprio repositório.
5. Registrar o fork em [external/impeccable/metadata.json](/home/andre/Trabalho/Pessoal/repos/agents-skills/external/impeccable/metadata.json:1).

## Primeiro sync para `agents-skills`

1. Escolher a tag ou commit de upstream que será a base.
2. Atualizar o fork para essa base.
3. Aplicar qualquer patch local apenas no fork.
4. Rodar o build do `impeccable`.
5. Sincronizar o bundle para `agents-skills`:

```bash
scripts/sync-external-impeccable.sh --source-repo ../impeccable
```

6. Instalar localmente para smoke test:

```bash
scripts/install-external-codex-skill.sh impeccable --force
```

7. Atualizar `external/impeccable/metadata.json` com:

- `status`
- `fork_repo`
- `upstream_ref`
- `fork_ref`
- `synced_at`
- `synced_by`

## Fluxo de atualização recorrente

1. No fork, buscar upstream:

```bash
git fetch upstream --tags
```

2. Escolher nova tag ou commit de upstream.
3. Rebasear ou mergear no fork, conforme a política do time.
4. Reaplicar ou revisar patches locais, se houver.
5. Rodar o build do `impeccable`.
6. Sincronizar o bundle para `agents-skills`.
7. Reinstalar localmente com `--force`.
8. Validar o comportamento mínimo esperado no Codex.
9. Atualizar `metadata.json`.
10. Commitar no `agents-skills`.

## Checklist de release interna

- fork sincronizado com a base desejada
- build do `impeccable` concluído sem erro
- bundle existe em `dist/agents/.agents/skills/impeccable/`
- sync executado para `external/impeccable/codex/impeccable/`
- `metadata.json` atualizado
- instalação local executada com `scripts/install-external-codex-skill.sh impeccable --force`
- smoke test manual feito no Codex
- commit do `agents-skills` pronto para revisão

## Guardrails

- não editar manualmente o bundle importado se a origem correta for o fork
- não aplicar patches diretamente em `external/impeccable/codex/impeccable/` sem registrar desvio explícito
- não usar submódulo Git para encaixar `impeccable` em `agents-skills`
- não mover `impeccable` para `skills/` até existir decisão explícita de internalização

## Critério para internalização futura

Só internalizar `impeccable` no modelo nativo de `agents-skills` se houver pelo menos um destes fatores:

- necessidade forte de adaptar o conteúdo ao padrão canônico de `skill.json` e targets múltiplos
- volume recorrente de patches locais que torne o fork dominante sobre o upstream
- necessidade de validação estrutural unificada com as demais skills autorais
