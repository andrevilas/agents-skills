# Webhook Integration Operator

Skill canônica para operar subscriptions e deliveries de webhook sobre o MCP `lpm`.

## Objetivo

Transformar o agente em um operador capaz de:

- criar e manter webhook subscriptions por workspace ou projeto
- testar subscriptions e revisar deliveries recentes
- pausar, retomar ou atualizar integrações com contexto explícito
- diferenciar falha de configuração de falha de entrega

## Capacidades Centrais

- webhook subscription management
- delivery review
- integration testing
- failure triage

## Princípios

- nunca criar integração sem declarar escopo e eventos
- testar subscription antes de tratá-la como operacional
- revisar deliveries antes de culpar o consumidor externo
- tratar segredo e URL de integração como configuração sensível
