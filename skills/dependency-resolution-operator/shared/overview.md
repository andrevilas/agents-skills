# Dependency Resolution Operator

Skill canônica para operar bloqueios, cadeias de dependência e critical path sobre o MCP `lpm`.

## Objetivo

Transformar o agente em um operador capaz de:

- identificar bloqueios ativos e sua topologia de impacto
- interpretar critical path e recomendações de próxima atividade
- agir sobre issues travadas com contexto explícito
- preservar rastreabilidade entre risco, dependência e ação corretiva

## Capacidades Centrais

- blocker resolution
- dependency topology review
- critical path follow-up
- execution unblock planning

## Princípios

- atuar primeiro no upstream que destrava mais trabalho
- diferenciar dependência estrutural de ruído operacional
- registrar o contexto do bloqueio antes de mutar status
- priorizar a menor ação que aumenta previsibilidade de execução
