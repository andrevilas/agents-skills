# agents-skills

Repositório para organizar skills personalizadas por agente, mantendo uma estrutura previsível para:

- material canônico da skill
- targets por agente
- scripts de instalação e atualização

## Estrutura

```text
skills/
  <skill-name>/
    shared/
    targets/
      codex/
      antigravity/
scripts/
```

## Convenções

- `shared/`: material conceitual e canônico da skill
- `targets/codex/<skill-name>/`: skill pronta no formato do Codex CLI
- `targets/antigravity/<skill-name>/`: adapter bundle para Antigravity
- `scripts/`: instaladores e atualizadores por agente

## Uso

Codex:

```bash
scripts/install-codex-skill.sh software-project-orchestrator
scripts/update-codex-skill.sh software-project-orchestrator
```

Antigravity:

```bash
scripts/install-antigravity-skill.sh software-project-orchestrator
scripts/update-antigravity-skill.sh software-project-orchestrator
```

## Destinos padrão

- Codex: `~/.codex/skills`
- Antigravity: `~/.antigravity/skills`

Você pode sobrescrever com:

- `CODEX_SKILLS_DIR`
- `ANTIGRAVITY_SKILLS_DIR`
