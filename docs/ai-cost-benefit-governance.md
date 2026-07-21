# AI Cost-Benefit Governance

Este documento define a politica transversal para uso prudente de Workspace AI, Gen App Builder e AISH nas skills LPM.

## Principio

Use IA quando ela reduzir ambiguidade, retrabalho, tempo de triagem ou risco de decisao. Nao use IA apenas porque a feature esta habilitada.

## Ordem Padrao

1. Use sinais deterministas primeiro: LPM, historico, analytics, requirements, issue links, ownership, arquivos e testes.
2. Use IA leve quando houver volume ou ambiguidade: embeddings, busca semantica, sugestoes operacionais e analise assistida.
3. Use IA cara apenas com justificativa: ranking, grounding, analise documental extensa, modelos fortes e loops Autopilot prolongados.
4. Registre o motivo quando a chamada orientar decisao, backlog, roteamento, release ou custo.

## Gates Por Recurso

### Workspace AI

- `embeddings`: usar para deduplicacao, matching semantico e busca quando texto simples nao for suficiente.
- `requirementsDocumentAnalysis`: usar para documentos longos, contraditorios ou com risco de perda de requisito; evitar para pequenas edicoes manuais.
- `operationalEntrySuggestion`: usar para entrada operacional ambigua, volumosa ou com possivel conversao em backlog; evitar para entradas triviais.

### Gen App Builder

- `indexing`: executar em lote, apos mudanca relevante de conhecimento; evitar reindexacao por rotina sem diff.
- `search`: usar quando a base de conhecimento puder responder melhor que leitura manual curta.
- `ranking`: usar quando existirem varios candidatos plausiveis e a ordem impactar decisao ou custo de entrega.
- `grounding`: usar quando a resposta precisar de fontes/citacoes ou quando a decisao depender de contexto distribuido.

### AISH

- Usar Autopilot para decomposicao e execucao governada, nao como loop aberto de tentativa.
- Definir max jobs, timeout, runner/host permitido, release boundary e evidencias esperadas antes de continuous Autopilot.
- Preferir validacoes deterministicas no runner. Usar modelo forte para planejamento/revisao quando o risco justificar.

## Checklist Antes De Habilitar Ou Expandir IA

- Confirmar feature flags e escopo: workspace, projeto ou conta.
- Consultar uso real, erros, limites diarios e fallback.
- Confirmar credencial e billing sem expor segredo.
- Estimar beneficio operacional esperado.
- Definir rollback: reduzir limite, desligar feature ou voltar ao fallback deterministico.

## Sinais De Exagero

- Feature habilitada por varios dias sem uso real.
- Ranking ou grounding ativo sem decisao que justifique custo.
- Reindexacao sem mudanca de fonte.
- Autopilot rodando sem limite claro.
- Sumarios por IA quando analytics ou estado LPM ja respondem.

## Resultado Esperado

Toda skill que toca IA deve deixar claro:

- qual sinal deterministico foi consultado antes;
- por que a IA foi necessaria;
- qual limite/custo/fallback foi verificado;
- qual evidencia ou decisao resultou do uso.
