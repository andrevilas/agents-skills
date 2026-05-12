# Integração de `impeccable`

Este documento define como incorporar `pbakaus/impeccable` ao ecossistema de `agents-skills` sem diluir o papel deste repositório como catálogo canônico de skills autorais.

## Decisão

`impeccable` deve entrar por um `fork` mantido por nós, com sincronização controlada para dentro de `agents-skills`.

Não usar:

- submódulo Git dentro de `agents-skills`
- cópia manual do output gerado em `dist/agents/.agents/skills/`
- remodelagem imediata do repositório externo para o shape nativo de `skills/<skill>/...`

## Objetivos

- preservar rastreabilidade do upstream
- permitir patches locais no fork
- manter `agents-skills` como catálogo e camada de distribuição
- isolar dependências externas do modelo canônico interno

## Estrutura proposta

O `agents-skills` continua sendo o catálogo principal. O material externo entra em área isolada:

```text
docs/
  impeccable-integration.md
external/
  impeccable/
    README.md
    codex/
      impeccable/
        SKILL.md
        agents/
          openai.yaml
        references/
    metadata.json
scripts/
  sync-external-impeccable.sh
```

### Papel de cada diretório

- `external/impeccable/`: espelho versionado do artefato consumível por nós, nunca fonte autoral primária
- `external/impeccable/codex/impeccable/`: bundle pronto para instalação no formato esperado pelo Codex
- `external/impeccable/metadata.json`: ponteiro explícito para fork, upstream e versão sincronizada
- `scripts/sync-external-impeccable.sh`: automação de sync a partir do fork

O runbook operacional do fork fica em:

```text
docs/impeccable-fork-runbook.md
```

## Modelo operacional

### Repositório de origem

Criar fork próprio de:

- `git@github.com:<org-ou-user>/impeccable.git`

Esse fork é o ponto de customização. O upstream original continua sendo:

- `git@github.com:pbakaus/impeccable.git`

### Fonte importada

Importamos apenas o output voltado ao Codex, gerado no fork:

- `dist/agents/.agents/skills/impeccable/`

Isso evita acoplar `agents-skills` ao build system inteiro de `impeccable`, mas preserva o bundle que realmente será distribuído.

### Área canônica versus área externa

As skills internas seguem em `skills/`.

As skills externas ficam em `external/` e não precisam fingir compatibilidade estrutural com:

- `skill.json`
- `shared/overview.md`
- `targets/codex/...`
- `targets/antigravity/...`

Se um dia quisermos “internalizar” `impeccable`, isso vira uma segunda etapa, feita conscientemente.

## Versionamento

`external/impeccable/metadata.json` deve registrar no mínimo:

```json
{
  "id": "impeccable",
  "source_type": "external-fork",
  "upstream_repo": "git@github.com:pbakaus/impeccable.git",
  "fork_repo": "git@github.com:<org-ou-user>/impeccable.git",
  "upstream_ref": "skill-v3.0.7",
  "fork_ref": "<commit-ou-tag-do-fork>",
  "imported_path": "dist/agents/.agents/skills/impeccable",
  "synced_at": "2026-05-12"
}
```

Regras:

- `status`: `planned`, `active` ou `deprecated`
- `upstream_ref`: release/tag de origem que queremos rastrear
- `fork_ref`: commit exato efetivamente importado
- `synced_at`: data do sync incorporado em `agents-skills`

## Fluxo de atualização

### Atualização normal

1. Atualizar o fork com o upstream.
2. Aplicar patches locais, se existirem.
3. Rodar build no fork.
4. Sincronizar `dist/agents/.agents/skills/impeccable/` para `external/impeccable/codex/impeccable/`.
5. Atualizar `external/impeccable/metadata.json`.
6. Validar instalação local do bundle.
7. Commitar no `agents-skills`.

### Atualização com quebra

Se o upstream mudar o formato do bundle, a quebra deve ficar contida no importador, não espalhada pelo catálogo.

A regra é:

- adaptar `scripts/sync-external-impeccable.sh`
- manter estável o destino em `external/impeccable/codex/impeccable/`

## Instalação e distribuição

Para `impeccable`, o `agents-skills` deve tratar o bundle como skill externa distribuível, não como skill canônica validada por `validate-skills.sh`.

Isso implica:

- não incluir `external/` na validação estrutural atual
- criar, se necessário, um instalador dedicado para external bundles

Sugestão mínima:

- `scripts/install-external-codex-skill.sh impeccable`

Esse instalador copia:

- `external/impeccable/codex/impeccable/`

para:

- `~/.codex/skills/impeccable/`

Exemplo:

```bash
scripts/sync-external-impeccable.sh --source-repo ../impeccable
scripts/install-external-codex-skill.sh impeccable --force
```

## Quando evoluir para umbrella separado

Criar um repositório umbrella faz sentido se surgirem duas ou mais integrações externas relevantes, por exemplo:

- `impeccable`
- outro catálogo de prompts/skills
- bundles cross-agent de terceiros

Nesse cenário:

- `agents-skills` fica autoral
- `agents-skills-external` ou `agents-umbrella` faz composição

Hoje isso ainda parece prematuro.

## Recomendação final

No estágio atual:

1. manter `agents-skills` como catálogo autoral
2. trazer `impeccable` por fork
3. sincronizar apenas o bundle de Codex para `external/`
4. instalar via script dedicado
5. só considerar umbrella quando houver mais de um fornecedor externo relevante
