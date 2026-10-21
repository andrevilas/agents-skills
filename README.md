# agents-skills

Catálogo de skills que permite a qualquer agente de IA (Claude Code, Codex, Antigravity, Gemini CLI, Cursor, Windsurf e outros) operar o **LPM** (`https://lpm.rocks/mcp`) com bons resultados, mesmo com pouco esforço de raciocínio.

Cada skill cobre um trabalho que o usuário pede ("entregar uma atividade", "planejar o backlog", "revisar a saúde do projeto"), não uma tool isolada. Toda tool MCP do LPM tem exatamente uma skill dona; os totais atuais estão em `docs/lpm-coverage-matrix.md`. As skills seguem o mesmo esqueleto: quando usar, pré-condições, tabela de decisão (a primeira linha que casar vence), procedimentos, quando parar e perguntar, verificação, relatório e falhas comuns.

Os fluxos de execução usam playbooks com chamadas completas, origem de cada valor e verificação após escritas. Procedimentos extensos já existentes continuam suportados; nas skills híbridas, cada playbook também passa pelos validadores V20/V21. O formato e seus limites estão em [docs/playbook-standard.md](docs/playbook-standard.md).

- **Pacote `core`**: as skills públicas do LPM. Comece sempre por `lpm-start` quando nenhuma outra skill servir claramente: ela resolve IDs, diagnostica conexão e roteia para uma única skill.
- **Pacote `internal`**: `lpm-release-product` e `lpm-pilot-feedback`, só para mantenedores do LPM; instalam apenas com `--include-internal` e escopo de usuário.
- **Roteamento determinístico**: `lpm-start/references/route.md` (e `INDEX.md` no target genérico) traz as linhas de roteamento geradas de `skill.json.routing[]`; o mesmo algoritmo roda em `eval --router` com gate de 100 %.

## Estrutura

```text
catalog/      snapshot do catálogo MCP do LPM, cards verificados por tool, aliases, contratos, exemplos de roteamento (fontes)
              + coverage.json (gerado)
shared/       partials e referências compartilhadas entre skills; shared/internal/ só para o pacote internal
skills/<id>/  skill.json (manifesto), SKILL.src.md (corpo neutro de agente), references/*.md
templates/    skill-v2/: scaffold usado por `skills.mjs new`
dist/         GERADO: codex/, claude-code/, antigravity/, generic/ — nunca edite à mão
external/     bundles de terceiros copiados sem alteração (instalados só com --include-external)
scripts/      skills.mjs (ponto único, Node >= 20, sem dependências), wrappers .sh obsoletos, sync de externos, hooks/
docs/         lpm-coverage-matrix.md (gerado) e documentos históricos
```

Regra de ouro: edite apenas fontes (`catalog/`, `shared/`, `skills/`, `templates/`) e rode `node scripts/skills.mjs build`. Tudo em `dist/`, `catalog/coverage.json`, `docs/lpm-coverage-matrix.md` e o bloco gerado deste README é reconstruído byte a byte e conferido pelo `check`.

## Instalação por agente

Requisito: Node.js >= 20. Rode a partir da raiz deste repositório:

```bash
node scripts/skills.mjs install --agent codex        # ${CODEX_SKILLS_DIR:-~/.codex/skills}
node scripts/skills.mjs install --agent claude-code  # ${CLAUDE_SKILLS_DIR:-~/.claude/skills}
node scripts/skills.mjs install --agent antigravity  # ${ANTIGRAVITY_SKILLS_DIR:-~/.gemini/config/skills}
node scripts/skills.mjs install --agent generic --dest ~/lpm-skills   # Gemini CLI, Cursor, Windsurf, outros
```

- O perfil padrão é `core`. Use `--profile connector`, `--skills a,b` ou `--all` para outra seleção, e `--dry-run` para ver o que mudaria.
- **Genérico**: o install imprime a linha para colar no `AGENTS.md`, `GEMINI.md` ou nas regras do editor: "LPM: read `<dest>/INDEX.md` first, then exactly one `<id>.md`." (modelo em `dist/generic/AGENTS-snippet.md`).
- **Escopo de projeto** (`--scope project`): instala em `<repo>/.agents/skills` (Codex, Antigravity) ou `<repo>/.claude/skills` (Claude Code), somente se o destino estiver no `.gitignore` (ou com `--allow-untracked`). Nunca instale dentro de um checkout do LPM que possa estar em deploy.
- **Mantenedores do LPM**: acrescente `--include-internal` (apenas `--scope user`).
- **Primeira instalação v2** numa máquina com as skills antigas: `install … --prune --adopt-legacy` remove os 15 diretórios legados reconhecidos (nunca toca `.system/` nem `synced/`).
- **Depois**: `update` reaplica a seleção gravada em `.agents-skills-manifest.json`; `verify --agent X` lista arquivos ausentes, alterados, órfãos e legados; `doctor` mostra quais agentes têm o servidor MCP do LPM configurado (só nomes, nunca valores) e a próxima ação para cada problema.
- Bundles externos ativos (`external/`): `--include-external` nos targets nativos (codex, claude-code, antigravity).
- **Genérico, arquivos**: cada skill instala `<id>.md` (o corpo), `<id>.refs.md` (referências), `<id>.flows.md` (quando há fluxos) e `<id>.tools.md` (contratos das ferramentas). Leia apenas a seção do fluxo escolhido; não carregue os demais fluxos ou o catálogo completo sem necessidade.
- **Manifesto** `<destino>/.agents-skills-manifest.json` (escrito por `install`/`update`, lido por `verify`, `update`, `prune` e `doctor`): `sourceCommit` (HEAD deste repositório na instalação, ou `null`), `agent`, `scope` (`user`|`project`), `selection` (`mode` `profile`|`skills`|`all`, `profile`, `skills[]`, `includeInternal`, `includeExternal`), `shared` (só no genérico: hashes de `INDEX.md` e `AGENTS-snippet.md`) e `skills` (`id` → `version`, `pack`, `files` com sha256). Só ids listados em `skills` são removidos.
- **Vários repositórios** (`--scope project`): crie `install-targets.json` na raiz deste repositório, por exemplo `{"projects": ["~/work/app", {"path": "~/work/api", "agents": ["codex"]}]}`. Cada entrada é um caminho ou `{path, agents[]}` (sem `agents` = todos os agentes). `verify --scope project` sem `--project` verifica `<path>/.agents/skills` (Claude Code: `<path>/.claude/skills`) de cada entrada; sem o arquivo, verifica só o repositório atual.
- **`doctor` no Claude Code**: sem servidor MCP local do LPM, o `doctor` só mostra uma nota (o conector LPM do claude.ai basta) e o comando para adicionar um servidor local.

## Convenção LPM-Activity

Todo commit que entrega uma atividade do LPM termina com o trailer, uma linha por atividade, depois de uma linha em branco:

```text
fix: corrige redirecionamento após login

LPM-Activity: <issueId>
```

O LPM liga o commit à atividade pelo trailer (grafia exata, início de linha, case-sensitive). `<issueId>` é o ID da atividade lido no LPM, nunca inventado. Detalhes, incluindo hooks e evidências de fechamento, em `shared/references/delivery-tracking.md` e na skill `lpm-deliver-activity`.

## Como adicionar uma skill

1. `node scripts/skills.mjs new lpm-<id> --title "<Título>"` cria `skills/lpm-<id>/{skill.json, SKILL.src.md, references/}` a partir de `templates/skill-v2`.
2. Preencha `skill.json`: descrição "Use when … Not for … (use <irmã>)", `jobs`, `routing[]` (com `order` único), `notFor`, `owns`/`uses` (toda tool tem um único dono) e `codex`.
3. Escreva `SKILL.src.md` seguindo os títulos do template (a ordem é validada) e as referências locais em `references/`.
4. Acrescente ao menos 3 prompts (EN e PT-BR) em `catalog/routing-examples.json`.
5. Rode `node scripts/skills.mjs build`, depois `check`, `eval --router` e `node --test scripts/test/`, e faça commit das fontes junto com os arquivos gerados.

Quando o LPM ganhar tools novas, `node scripts/skills.mjs snapshot --lpm <checkout-do-lpm>` atualiza o snapshot e cria cards `stub`, que falham no `check` até serem preenchidos.

## Validação e CI

```bash
node scripts/skills.mjs check          # validadores + reconstrução byte a byte (drift)
node scripts/skills.mjs eval --router  # roteamento determinístico, gate 100 %
node scripts/skills.mjs eval --trace all # valida os cenários do MCP simulado; não executa um modelo
node --test scripts/test/              # testes do build, install e validadores
```

O workflow `.github/workflows/validate-skills.yml` roda os três em `pull_request` e em `push` para `main`. Para rodar `check` e `eval --router` antes de cada commit, ative o hook opcional uma vez por clone:

```bash
git config core.hooksPath scripts/hooks
```

O hook verifica a árvore de trabalho, não o que está no stage: depois de `build`, faça commit de tudo o que ele regenerou (`dist/`, `catalog/coverage.json`, `docs/`, `README.md`), senão o CI falha no drift (V15).

## Scripts antigos

Os `scripts/*.sh` antigos viraram wrappers por uma release: imprimem um aviso de obsolescência e chamam `skills.mjs` (`install-*.sh` → `install`, `update-*.sh` → `update`, `validate-*.sh` → `check`, `verify-governed-distribution.sh` → `verify`, `install-external-codex-skill.sh` → `install --include-external`). Nomes de skills antigas passados a `install-*.sh` são convertidos para a skill v2 principal. Continuam mantidos os scripts de sincronização de externos:

```bash
scripts/sync-external-mattpocock-skill.sh caveman --source-repo ../skills
scripts/sync-external-impeccable.sh --source-repo ../impeccable
```

<!-- GENERATED:catalog -->
<!-- GENERATED by agents-skills scripts/skills.mjs from skills/*/skill.json and external/*/metadata.json — do not edit -->

### Skills

| Skill | Use when | Access | Owner-only |
|---|---|---|---|
| `lpm-access` | Use when managing LPM credentials (credenciais, chave de API): API keys and profiles, lpm_mcp_ agent credentials, agent principals, specialist assignments, AI provider keys, the workspace GitHub token. Writes are owner-only; secrets never printed. Not for a missing connector tool (use lpm-start). | KEY | 14 |
| `lpm-ai-cost` | Use when asked about LPM AI or AISH cost and limits (custo, orçamento): workspace AI policy, models, token/request budgets, Advisor limits, code-search quota, AISH budgets, pools, funding, consumption, accounting. Reads and proposes; changes are owner-only. Not for API keys (use lpm-access). | KEY | 9 |
| `lpm-aish-delivery` | Use when AISH job work must be proven, closed or released (evidência, encerrar): delivery artifacts, DoD audit, findings, execution packs, release packages (pacote de release: create, approve, claim, deploy, complete), requeue, disposition, lineage. Not for creating jobs (use lpm-aish-jobs). | KEY | 2 |
| `lpm-aish-jobs` | Use when work must run on AISH runners: create or approve AISH jobs, add intake reference files or transcripts, run a cockpit execution session (sessão de execução: plan, dispatch, pause, checkpoint). Not for job evidence (use lpm-aish-delivery) or commit-tracked work (use lpm-deliver-activity). | KEY | 4 |
| `lpm-aish-runners` | Use when operating AISH runner hosts (frota, drenar o host): install or start a runner, onboard or manage hosts (drain, suspend, reactivate, remove, legacy migration), lease and execute jobs, and submit job evidence, traces or consumption. Not for planning or approving jobs (use lpm-aish-jobs). | KEY | 0 |
| `lpm-ask-advisor` | Use when a project's code or roadmap question must be answered from the indexed repository (LPM Advisor): does the code do X, onde está Y, technical impact, roadmap analysis, exact source lines. Read-only. Not for building or refreshing the index (use lpm-code-index). | OAuth mostly | 0 |
| `lpm-code-index` | Use when LPM code evidence is missing or stale (no_active_index, scan older than 24 h, índice de código desatualizado): link a GitHub repository to a project or workspace, scan it, refresh, activate, roll back or purge the code index, or compare commits. Not for code questions (use lpm-ask-advisor). | mostly KEY | 0 |
| `lpm-deliver-activity` | Use when implementing, fixing or closing one LPM activity (atividade/issue): commit with the LPM-Activity trailer, comment progress, attach evidence (prints, logs, tests). Old name: software-project-orchestrator. Not for planning many activities (use lpm-plan-work) or AISH jobs (use lpm-aish-jobs). | mixed | 0 |
| `lpm-executive-context` | Use when reviewing or changing the LPM workspace executive context (contexto executivo): readiness (prontidão), gaps, operating model, executive roles, routing/escalation policy, unowned domains or capabilities (sem dono), alignment. Not for project settings (use lpm-workspace-admin). | mixed | 1 |
| `lpm-governance-decisions` | Use when a scope/business decision must be raised or recorded in an LPM governance thread (requirement, baseline, roadmap item), for the decision inbox (decisões pendentes), or to turn a decided thread into an activity, requirement or change set. Not for deciding a change request (use lpm-roadmap). | mixed | 2 |
| `lpm-intake-triage` | Use when handling incoming LPM requests: route an intake entry or WhatsApp protocol (protocolo) to a project, triage operational entries (bugs, incidents), merge duplicates, convert one to an activity, record a reply. Old name: workspace-routing-operator. Not for AISH job files (use lpm-aish-jobs). | KEY | 0 |
| `lpm-integrations` | Use when LPM must send data out: outgoing webhooks (create, test, debug failed deliveries), data exports or backups (exportar dados), or the analytics bridge to BigQuery. Writes need an API key. Not for incoming GitHub commit tracking (use lpm-deliver-activity). | mixed | 4 |
| `lpm-knowledge` | Use when reading or curating LPM guidance: search help articles (ajuda) for a rule, register or delete knowledge items or project files, manage project skills contexts (agent instructions), or draft, accept or reject roadmap knowledge notes. Not for activity evidence (use lpm-deliver-activity). | mixed | 1 |
| `lpm-pilot-feedback` (internal) | Use only for LPM maintainers when a pilot or tester (piloto, homologação) reports an LPM problem: verify read-only, classify, register only confirmed defects in the pilot milestone, record processed reports, report to the owner; never reply to the pilot. Not for deploys (use lpm-release-product). | process skill | 0 |
| `lpm-plan-work` | Use when creating or organizing LPM backlog work: create activities (single or batch), edit fields, plan cycles/sprints and milestones (marcos), labels, owners, estimates, due dates, unassigned/unestimated/overdue queues, escalations. Not for doing or closing one activity (use lpm-deliver-activity). | mixed | 0 |
| `lpm-release-product` (internal) | Use only inside the LPM product repository (lpm) to ship LPM to production (deploy, subir para produção): checks, candidate, golden set, promote, smoke, rollback, deploy evidence (Cloud Run revision, smoke) on the activity, pilot notice. Not for an AISH pacote de release (use lpm-aish-delivery). | process skill | 0 |
| `lpm-requirements-scope` | Use when handling LPM requirements (requisitos) and scope (escopo): create, edit, group, link requirements, check drift, reconcile orphans, review change sets before publishing, publish a baseline on owner order. Not for roadmap items or change requests (use lpm-roadmap). | mostly KEY | 6 |
| `lpm-review-health` | Use when a read-only health, status, risk or integrity review of an LPM project or portfolio is asked (saúde, revisão semanal, 'what needs my attention'). Names the fixing skill per finding; never edits. Not for fixes (use lpm-plan-work) or unowned capabilities (use lpm-executive-context). | mixed | 0 |
| `lpm-roadmap` | Use when reading, tracing an LPM roadmap (rastreabilidade), creating a roadmap, one item or a capability (even on owner order), or change requests (pedido de mudança): submit, review, decide, apply. Not for direct owner commits (use lpm-roadmap-owner-ops) or change sets (use lpm-requirements-scope). | OAuth mostly | 9 |
| `lpm-roadmap-owner-ops` | Use only when the LPM workspace owner orders a direct roadmap edit (ordem do dono): commit, item edit, archive/restore, bulk, TSV import, dependencies, allocations, item approval (aprovar), materialização, governance mode. Not for one new item or capability, or change requests (use lpm-roadmap). | mostly KEY | 21 |
| `lpm-start` | Use first for an LPM (lpm.rocks) request when no other lpm-* skill clearly fits, an ID is unknown, a tool is missing or denied (-32003, ferramenta ausente), to connect an agent (conectar, configurar MCP) or read your notificações. Routes to one skill. Not for changing API keys (use lpm-access). | OAuth mostly | 0 |
| `lpm-unblock-work` | Use when LPM activities are blocked (bloqueada) or depend on other work: find blockers, record or resolve a blocker reason, add or remove dependency links (any project or workspace), read the dependency graph/critical path. Not for roadmap-item dependencies (use lpm-roadmap-owner-ops). | mostly KEY | 0 |
| `lpm-workspace-admin` | Use when creating or kicking off (kickoff, novo projeto) an LPM project or workspace, changing its settings, roles, routing profile, archive or delete, or managing members and teams. Not for cycles, milestones or labels alone (use lpm-plan-work) or credentials (use lpm-access). | mostly KEY | 1 |

### Install

```bash
node scripts/skills.mjs install --agent codex --profile core
node scripts/skills.mjs install --agent claude-code --profile core
node scripts/skills.mjs install --agent antigravity --profile core
node scripts/skills.mjs install --agent generic --dest <dir> --profile core
# first v2 install on a machine that still has the legacy skills:
node scripts/skills.mjs install --agent codex --profile core --prune --adopt-legacy
# LPM maintainers only (user scope, never inside the lpm checkout):
node scripts/skills.mjs install --agent claude-code --scope user --include-internal
node scripts/skills.mjs verify --agent codex
```

### Profiles

| Profile | Skills |
|---|---|
| `core` (default) | `lpm-access`, `lpm-ai-cost`, `lpm-aish-delivery`, `lpm-aish-jobs`, `lpm-aish-runners`, `lpm-ask-advisor`, `lpm-code-index`, `lpm-deliver-activity`, `lpm-executive-context`, `lpm-governance-decisions`, `lpm-intake-triage`, `lpm-integrations`, `lpm-knowledge`, `lpm-plan-work`, `lpm-requirements-scope`, `lpm-review-health`, `lpm-roadmap`, `lpm-roadmap-owner-ops`, `lpm-start`, `lpm-unblock-work`, `lpm-workspace-admin` |
| `connector` | `lpm-ask-advisor`, `lpm-code-index`, `lpm-deliver-activity`, `lpm-executive-context`, `lpm-governance-decisions`, `lpm-integrations`, `lpm-knowledge`, `lpm-plan-work`, `lpm-requirements-scope`, `lpm-review-health`, `lpm-roadmap`, `lpm-roadmap-owner-ops`, `lpm-start`, `lpm-unblock-work`, `lpm-workspace-admin` |
| `internal` (`--include-internal`, user scope) | `lpm-pilot-feedback`, `lpm-release-product` |

### External bundles

| Bundle | Status | Source | Upstream ref |
|---|---|---|---|
| `caveman` | active | https://github.com/mattpocock/skills.git | f304057d61d3df3c9fd992ac2b6e3833cb9325fb |
| `grill-me` | active | https://github.com/mattpocock/skills.git | 6654f6b60cd9d5be8b54c6fafe44346dabeb3b76 |
| `impeccable` | planned | git@github.com:pbakaus/impeccable.git | <set-me> |

<!-- /GENERATED:catalog -->
