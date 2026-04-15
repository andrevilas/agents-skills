# LPM Coverage Matrix

Esta matriz documenta a cobertura funcional do catálogo `agents-skills` sobre a superfície MCP do LPM.

## Leitura

- A cobertura é organizada por workflow/capability, não por endpoint isolado.
- Uma skill pode cobrir várias tools relacionadas do LPM.
- Algumas tools aparecem em mais de uma skill de forma intencional, quando servem a workflows diferentes.
- O objetivo desta matriz é responder se o catálogo cobre a funcionalidade do LPM de forma operacional.

## Status

- Cobertura funcional atual: completa
- Cobertura 1:1 por endpoint: não é o objetivo do catálogo
- Lacunas funcionais abertas: nenhuma identificada no estado atual

## Matrix

| Skill | Domínio principal | Capacidades LPM cobertas | Tools MCP explicitamente referenciadas |
| --- | --- | --- | --- |
| `software-project-orchestrator` | Execução SDLC de projeto | projetos, issues, ciclos, milestones, links, comentários, notificações, analytics | `list_projects`, `create_project`, `update_project`, `archive_project`, `unarchive_project`, `create_team`, `add_team_member`, `create_cycle`, `create_milestone`, `list_labels`, `create_label`, `list_issues`, `get_issue`, `update_issue`, `create_issue_link`, `list_issue_links`, `list_comments`, `create_comment`, `create_notification`, `get_project_analytics` |
| `requirements-lifecycle-manager` | Requisitos e baseline | requisitos, grupos, baselines, rastreabilidade de escopo | `list_requirements`, `create_requirement`, `update_requirement`, `delete_requirement`, `list_requirement_baselines`, `create_requirement_baseline`, `update_requirement_baseline`, `delete_requirement_baseline`, `list_requirement_groups`, `create_requirement_group`, `update_requirement_group`, `delete_requirement_group`, `get_project`, `list_issues`, `get_issue` |
| `scope-baseline-publisher` | Governança de scope publication | working scope, delta, change sets, publicação de baseline | `get_project_scope_resolution_context`, `list_working_scope_delta_entities`, `create_change_set`, `update_project_change_set_status`, `list_change_sets`, `publish_project_baseline_from_resolution`, `publish_change_set`, `list_requirement_baselines`, `list_requirements` |
| `governance-decision-operator` | Decisão e governança | decision inbox, governance threads, outcomes estruturados, drafting assistido | `get_project_decision_inbox`, `list_project_decision_queue`, `get_governance_thread_resolution_context`, `get_governance_thread_messages`, `reply_to_governance_thread`, `update_governance_thread`, `resolve_governance_thread_with_outcome`, `prepare_issue_draft_from_governance_thread`, `prepare_requirement_draft_from_governance_thread`, `prepare_change_set_draft_from_governance_thread` |
| `dependency-resolution-operator` | Dependências e bloqueios | graph, summary, resolution context, blocker follow-up, next activity | `get_project_dependency_graph`, `get_project_dependency_summary`, `list_issue_links`, `list_blocked_project_issues`, `get_project_resolution_context`, `get_project_resolution_action_catalog`, `get_issue`, `update_issue`, `set_project_issue_blocker_context`, `create_comment`, `recommend_next_activity` |
| `workspace-routing-operator` | Intake e roteamento | preview de routing, review de routing, alinhamento workspace/projetos | `get_workspace_executive_context`, `preview_workspace_routing`, `review_workspace_routing`, `list_workspace_projects`, `list_unowned_domains_or_capabilities`, `validate_workspace_project_alignment`, `get_workspace_decision_inbox` |
| `workspace-executive-context-operator` | Contexto executivo do workspace | executive context, owner surface, gaps, readiness, operating model, routing policy | `get_workspace_executive_context`, `get_workspace_owner_surface`, `get_workspace_read_model`, `validate_workspace_context_completeness`, `validate_workspace_project_alignment`, `generate_workspace_readiness_report`, `list_workspace_context_gaps`, `list_missing_governance_assignments`, `list_unowned_domains_or_capabilities`, `draft_workspace_operating_model`, `draft_workspace_routing_policy`, `apply_workspace_context_update` |
| `lpm-workspace-admin` | Administração estrutural | projetos, times, ciclos, milestones, labels, notificações, hygiene administrativa | `list_projects`, `get_project`, `create_project`, `update_project`, `archive_project`, `unarchive_project`, `delete_project`, `list_teams`, `get_team`, `create_team`, `update_team`, `delete_team`, `list_team_members`, `add_team_member`, `remove_team_member`, `list_cycles`, `get_cycle`, `create_cycle`, `update_cycle`, `delete_cycle`, `list_milestones`, `get_milestone`, `create_milestone`, `update_milestone`, `delete_milestone`, `list_labels`, `create_label`, `update_label`, `delete_label`, `list_notifications`, `mark_notification_read`, `create_notification`, `list_api_keys`, `create_api_key`, `delete_api_key` |
| `portfolio-health-review` | Saúde executiva e portfólio | health review, analytics, burndown, ownership concentration, follow-up executivo | `get_project_analytics`, `list_projects`, `get_project`, `list_issues`, `get_issue`, `list_issue_links`, `list_comments`, `list_notifications`, `create_notification` |
| `analytics-bridge-operator` | Analytics bridge | runs, processamento, observability, sync coverage | `create_analytics_bridge_run`, `process_analytics_bridge_run`, `list_analytics_bridge_runs`, `get_analytics_bridge_observability`, `get_project`, `get_workspace` |
| `webhook-integration-operator` | Webhooks | subscriptions, testes, deliveries | `create_webhook_subscription`, `list_webhook_subscriptions`, `update_webhook_subscription`, `delete_webhook_subscription`, `test_webhook_subscription`, `list_webhook_deliveries`, `get_project`, `get_workspace` |
| `knowledge-and-publication-operator` | Conhecimento e publicação | knowledge items, project files, help articles, publicação documental | `list_project_knowledge_items`, `create_knowledge_item`, `delete_knowledge_item`, `list_project_files`, `list_help_articles`, `search_help_articles`, `get_help_article`, `get_project`, `get_project_execution_context` |
| `access-and-credentials-admin` | Acesso técnico | API keys, AI credentials, controles de acesso de workspace | `list_api_keys`, `create_api_key`, `update_api_key`, `delete_api_key`, `list_workspace_ai_credentials`, `upsert_workspace_ai_credential`, `delete_workspace_ai_credential`, `get_workspace` |

## Interpretação da cobertura

### Cobertura funcional completa

O catálogo cobre as áreas operacionais relevantes do LPM:

- execução de projeto
- governança de requisitos e baselines
- governança de decisão
- dependências e critical path
- administração de workspace
- contexto executivo e roteamento
- analytics bridge e observability
- webhooks
- knowledge/publication
- credenciais e acesso

### Sobreposição intencional

Há sobreposição deliberada entre algumas skills:

- `software-project-orchestrator` e `portfolio-health-review` compartilham parte da leitura de issues e analytics, mas com finalidades diferentes
- `workspace-executive-context-operator` e `workspace-routing-operator` compartilham leitura de contexto de workspace, mas não o mesmo workflow
- `lpm-workspace-admin` e `access-and-credentials-admin` encostam em access control, mas a segunda concentra guardrails técnicos

### O que não significa

Esta matriz não afirma que exista:

- uma skill por tool do LPM
- uma referência explícita a toda tool secundária disponível
- ausência de evolução futura no catálogo

Ela afirma que, no estado atual, não há capability relevante do LPM sem uma skill dona no catálogo.
