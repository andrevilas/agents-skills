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
- `dependency-resolution-operator`: resolução de bloqueios, leitura de critical path e follow-up operacional de dependências
- `governance-decision-operator`: operação de decision inbox, governance threads e outcomes estruturados
- `scope-baseline-publisher`: revisão de working scope, change sets e publicação de baseline
- `workspace-routing-operator`: triagem de intake e roteamento entre projetos no contexto executivo do workspace
- `workspace-executive-context-operator`: revisão, validação e evolução controlada do contexto executivo do workspace
- `analytics-bridge-operator`: operação de bridge runs, observability e recuperação de cobertura analítica
- `webhook-integration-operator`: gestão de webhook subscriptions, testes e deliveries
- `knowledge-and-publication-operator`: curadoria de knowledge items, arquivos e guidance publicado
- `access-and-credentials-admin`: administração de API keys e AI credentials com guardrails explícitos

Codex:

```bash
scripts/install-codex-skill.sh software-project-orchestrator
scripts/update-codex-skill.sh software-project-orchestrator
scripts/install-codex-skill.sh requirements-lifecycle-manager
scripts/install-codex-skill.sh lpm-workspace-admin
scripts/install-codex-skill.sh portfolio-health-review
scripts/install-codex-skill.sh dependency-resolution-operator
scripts/install-codex-skill.sh governance-decision-operator
scripts/install-codex-skill.sh scope-baseline-publisher
scripts/install-codex-skill.sh workspace-routing-operator
scripts/install-codex-skill.sh workspace-executive-context-operator
scripts/install-codex-skill.sh analytics-bridge-operator
scripts/install-codex-skill.sh webhook-integration-operator
scripts/install-codex-skill.sh knowledge-and-publication-operator
scripts/install-codex-skill.sh access-and-credentials-admin
```

Antigravity:

```bash
scripts/install-antigravity-skill.sh software-project-orchestrator
scripts/update-antigravity-skill.sh software-project-orchestrator
scripts/install-antigravity-skill.sh requirements-lifecycle-manager
scripts/install-antigravity-skill.sh lpm-workspace-admin
scripts/install-antigravity-skill.sh portfolio-health-review
scripts/install-antigravity-skill.sh dependency-resolution-operator
scripts/install-antigravity-skill.sh governance-decision-operator
scripts/install-antigravity-skill.sh scope-baseline-publisher
scripts/install-antigravity-skill.sh workspace-routing-operator
scripts/install-antigravity-skill.sh workspace-executive-context-operator
scripts/install-antigravity-skill.sh analytics-bridge-operator
scripts/install-antigravity-skill.sh webhook-integration-operator
scripts/install-antigravity-skill.sh knowledge-and-publication-operator
scripts/install-antigravity-skill.sh access-and-credentials-admin
```

## Como organizar o catálogo

- mantenha skills por domínio operacional, não por tool isolada
- promova uma nova skill quando o MCP abrir um workflow distinto, com prompt e guardrails próprios
- preserve `software-project-orchestrator` como skill de execução ponta a ponta; mova requisitos e administração estrutural para skills irmãs
- use `portfolio-health-review` quando o foco principal for leitura executiva, revisão semanal, ou diagnóstico sistêmico com analytics
- prefira adicionar referências em `targets/codex/<skill>/references/` quando o fluxo exigir detalhe extra, mantendo `SKILL.md` enxuto
- para validação semântica, mantenha um `references/e2e-examples.md` nas skills com workflow operacional próprio

## Template base

Para criar novas skills do catálogo LPM com compatibilidade entre `Codex` e `Antigravity`, use o scaffold em:

```text
templates/lpm-skill/
```

Esse template explicita a base reutilizável do repositório:

- `skill.json` como manifesto canônico da skill
- `shared/overview.md` como fonte conceitual comum
- target `Codex` com `SKILL.md`, `agents/openai.yaml` e `references/`
- target `Antigravity` com `manifest.json` e `PLAYBOOK.md`

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
