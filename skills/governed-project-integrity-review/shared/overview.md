# Governed Project Integrity Review

Skill canônica para verificar se governança, escopo, execução, evidência e saúde reportada permanecem coerentes entre LPM e AISH.

## Objetivos

- detectar drift e estados inválidos antes que analytics os mascare
- prevenir duplicação em materializações e retries
- reconciliar issue, job e evidência em transições terminais
- diferenciar baseline estável de implementação concluída
- produzir correções mínimas, reversíveis e auditáveis

## Princípio

Saúde é composta: métricas de entrega só podem ser consideradas saudáveis quando os invariantes de integridade também estão saudáveis.
