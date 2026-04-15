# LPM Skill Template

Template base para criar novas skills do catálogo `agents-skills` com compatibilidade para `Codex` e `Antigravity`.

## Estrutura

```text
templates/lpm-skill/
  skill.json
  shared/
    overview.md
  targets/
    codex/
      __SKILL_ID__/
        SKILL.md
        agents/
          openai.yaml
        references/
          lpm-capabilities.md
          e2e-examples.md
    antigravity/
      __SKILL_ID__/
        manifest.json
        PLAYBOOK.md
```

## Placeholders

- `__SKILL_ID__`: identificador estável em `kebab-case`
- `__DISPLAY_NAME__`: nome legível da skill
- `__ONE_LINE_DESCRIPTION__`: descrição curta e objetiva
- `__WORKFLOW_SCOPE__`: workflow principal operado pela skill
- `__PRIMARY_TOOLS__`: grupo de tools MCP que sustentam o workflow
- `__OPERATOR_STANCE__`: postura operacional do agente ao usar a skill

## Regras Base

1. Separe material canônico de adapters por agente.
2. Mantenha uma skill por workflow operacional distinto.
3. Preserve `Codex` e `Antigravity` como targets de primeira classe.
4. Adicione `references/` apenas quando o workflow exigir contexto auxiliar.
5. Atualize `README.md` quando uma nova skill entrar no catálogo ativo.
