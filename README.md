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

Skills disponíveis neste repositório:

- `software-project-orchestrator`: operação SDLC sobre projetos, ciclos, milestones, issues, dependências, comentários, notificações e analytics
- `requirements-lifecycle-manager`: gestão de requisitos, grupos, baselines e rastreabilidade entre requisitos e execução
- `lpm-workspace-admin`: governança estrutural de workspace LPM, incluindo projetos, times, labels, ciclos, milestones, notificações e hygiene operacional
- `portfolio-health-review`: leitura executiva de saúde de projetos e portfólio com analytics, burndown, riscos, concentração de ownership e sinalização operacional

Codex:

```bash
scripts/install-codex-skill.sh software-project-orchestrator
scripts/update-codex-skill.sh software-project-orchestrator
scripts/install-codex-skill.sh requirements-lifecycle-manager
scripts/install-codex-skill.sh lpm-workspace-admin
scripts/install-codex-skill.sh portfolio-health-review
```

Antigravity:

```bash
scripts/install-antigravity-skill.sh software-project-orchestrator
scripts/update-antigravity-skill.sh software-project-orchestrator
scripts/install-antigravity-skill.sh requirements-lifecycle-manager
scripts/install-antigravity-skill.sh lpm-workspace-admin
scripts/install-antigravity-skill.sh portfolio-health-review
```

## Como organizar o catálogo

- mantenha skills por domínio operacional, não por tool isolada
- promova uma nova skill quando o MCP abrir um workflow distinto, com prompt e guardrails próprios
- preserve `software-project-orchestrator` como skill de execução ponta a ponta; mova requisitos e administração estrutural para skills irmãs
- use `portfolio-health-review` quando o foco principal for leitura executiva, revisão semanal, ou diagnóstico sistêmico com analytics
- prefira adicionar referências em `targets/codex/<skill>/references/` quando o fluxo exigir detalhe extra, mantendo `SKILL.md` enxuto
- para validação semântica, mantenha um `references/e2e-examples.md` nas skills com workflow operacional próprio

## Validação

Valide a estrutura do catálogo com:

```bash
scripts/validate-skills.sh
```

No GitHub, a mesma checagem roda automaticamente no workflow `.github/workflows/validate-skills.yml` em `push` para `main` e em `pull_request`.

O validador checa:

- `skill.json` por skill
- `shared/overview.md` via `canonical_source`
- target de Codex com `SKILL.md` e `agents/openai.yaml`
- target de Antigravity com `manifest.json` e `PLAYBOOK.md`
- `references/e2e-examples.md` quando a skill declara workflow operacional no `SKILL.md`

## Destinos padrão

- Codex: `~/.codex/skills`
- Antigravity: `~/.antigravity/skills`

Você pode sobrescrever com:

- `CODEX_SKILLS_DIR`
- `ANTIGRAVITY_SKILLS_DIR`
