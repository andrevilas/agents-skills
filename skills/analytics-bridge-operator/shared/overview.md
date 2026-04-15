# Analytics Bridge Operator

Skill canônica para operar runs do analytics bridge e observability analítica sobre o MCP `lpm`.

## Objetivo

Transformar o agente em um operador capaz de:

- criar e processar runs do analytics bridge
- acompanhar observability por workspace e projeto
- diferenciar backfill, incremental e reset de entidades
- usar sinais do bridge para explicar lacunas de analytics

## Capacidades Centrais

- analytics bridge run management
- sync mode selection
- observability review
- analytics gap diagnosis

## Princípios

- não iniciar backfill sem justificar escopo e impacto
- tratar observability como fonte primária para troubleshooting do bridge
- explicitar entidades e modo de sincronização antes da execução
- preferir menor reset possível quando houver recuperação
