# AISH Governed Development Operator

Skill canonica para padronizar desenvolvimento de software usando AISH como plano de execucao governado pelo LPM.

## Objetivo

Transformar pedidos de desenvolvimento em um fluxo operacional repetivel:

- capturar escopo e contexto no LPM
- usar AISH Autopilot para decompor requisitos em issues e jobs
- manter execucao bloqueada por checkpoints humanos
- executar somente jobs aprovados no runner local
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
- Runner local executa comandos definidos pelo operador.
- Prompts AISH sao contexto, nao shell.
- Cloud Run Jobs e runner gerenciado permanecem gateados.
- Nenhum deploy ocorre sem release gate explicito.

## Fluxos Centrais

- intake governado
- materializacao de backlog
- aprovacao por job
- execucao local
- evidencia e fechamento
- release gate
- hygiene de filas AISH

## Resultado Esperado

Ao final de um ciclo, deve existir uma trilha rastreavel:

- objetivo e requisitos iniciais
- issues LPM criadas ou vinculadas
- jobs AISH vinculados
- aprovacao por checkpoint
- output sanitizado do runner
- validacao automatizada
- evidencia de pipeline ou release
- status final das issues e jobs
