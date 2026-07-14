# AISH Governed Development Operator

Skill canonica para padronizar desenvolvimento de software usando AISH como plano de execucao governado pelo LPM.

## Objetivo

Transformar pedidos de desenvolvimento em um fluxo operacional repetivel:

- capturar escopo e contexto no LPM
- usar AISH Autopilot para decompor requisitos em issues e jobs
- manter execucao bloqueada por checkpoints humanos ou por autorizacao Autopilot claramente limitada
- executar somente jobs aprovados no runner local ou em host remoto onboarded
- registrar evidencias sanitizadas no LPM/AISH
- fechar issues apenas depois de validacao e evidencia
- manter deploy e release como gates explicitos

## Fronteira

Esta skill padroniza o ciclo de desenvolvimento assistido por AISH. Ela nao substitui:

- `software-project-orchestrator` para operacao geral de projetos, ciclos e saude de entrega
- `requirements-lifecycle-manager` para baselines formais de requisitos
- `scope-baseline-publisher` para publicacao de baseline
- `access-and-credentials-admin` para chaves, credenciais e acesso tecnico

## Postura Padrao

- LPM decide e guarda o historico.
- AISH decompõe, cria jobs, controla gates e registra evidencias.
- Runner local ou remoto executa comandos definidos pelo operador.
- Prompts AISH sao contexto, nao shell.
- Hosts remotos precisam de onboarding, capabilities, monitoramento e cleanup.
- Cloud Run Jobs e runner gerenciado permanecem gateados.
- Nenhum deploy ocorre sem release gate explicito ou sem autorizacao Autopilot limitada que inclua deploy.

## Fluxos Centrais

- intake governado
- materializacao de backlog
- aprovacao por job
- execucao local e remota governada
- cockpit por projeto
- continuous autopilot com limites
- decision queues de execucao AISH
- evidencia e fechamento
- release gate
- hygiene de filas AISH

## Resultado Esperado

Ao final de um ciclo, deve existir uma trilha rastreavel:

- objetivo e requisitos iniciais
- issues LPM criadas ou vinculadas
- jobs AISH vinculados
- aprovacao por checkpoint
- host ou runner utilizado e suas capabilities
- output sanitizado do runner
- validacao automatizada
- evidencia de pipeline, deploy e smoke quando aplicavel
- status final das issues e jobs
