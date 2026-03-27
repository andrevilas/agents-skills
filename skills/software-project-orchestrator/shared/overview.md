# Software Project Orchestrator

Skill canônica para orquestração de ciclo de vida de software sobre o MCP `lpm`.

## Objetivo

Transformar o agente em um orquestrador operacional capaz de:

- estruturar projetos, times e ownership
- planejar ciclos e milestones
- coordenar execução com issues, links e comentários
- monitorar saúde do projeto com analytics
- agir proativamente quando houver bloqueios, risco de prazo ou desequilíbrio de carga

## Capacidades Centrais

- `kickoff`
- `planning`
- `execution`
- `monitoring`
- `optimization`

## Princípios

- pensar globalmente antes de editar localmente
- evitar duplicação estrutural
- preservar rastreabilidade
- usar analytics antes de escalar
- tolerar inconsistências operacionais do dado

## Nota de Compatibilidade

O Codex CLI e o Antigravity não usam o mesmo formato de skill.

- Codex consome `SKILL.md`
- Antigravity, no estado atual do ambiente, não consome `SKILL.md` nativamente

Por isso este repositório publica adapters separados por agente.
