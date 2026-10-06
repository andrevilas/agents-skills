# Validação da retomada — 2026-10-06

Escopo: catálogo agents-skills v2, integração MCP do LPM e instalação local nos
três agentes. O snapshot foi conferido com LPM `5615224`, sem alterações locais:
383 ferramentas, 152 comandos CLI e 23 skills (21 públicas, 2 internas).

## Verificações realizadas

- LPM: 366 arquivos de teste, 3.680 testes aprovados; `npm run lint` aprovado.
- Paridade LPM ↔ catálogo v2: 383/383 ferramentas com dono; todos os contratos
  obrigatórios aprovados, sem avisos da checagem de paridade.
- Catálogo: `check --lpm ../lpm` aprovado, sem falhas; 95 avisos não bloqueantes.
- Roteamento determinístico: 457/457 casos aprovados, incluindo seis casos novos
  de ambiguidades entre backlog, projeto e credenciais.
- Ferramental: 165 testes aprovados, incluindo instalação, atualização, preservação
  de diretórios não gerenciados, servidor MCP falso e regressões dos validadores.
- Os 13 cenários de trace são válidos. Isso valida os cenários e o ferramental;
  não é uma nova avaliação de desempenho de um modelo.
- Os 23 pacotes Codex passaram no `quick_validate.py` do skill-creator.
- `git diff --check` aprovado; a reconstrução reproduz os arquivos distribuídos.

## Correções desta retomada

Foram concluídos vínculos e metadados de playbooks, removidas referências a um
fluxo de governança inexistente e conectados os fluxos de IA, evidências, releases
e runners aos seus pontos de entrada. A janela de governança preserva o limite
existente e usa controle de concorrência ao restaurar o modo.

V20 distingue efeito de leitura de permissão de escrita. V21 aceita valores
tipados vindos de resultados, sem exigir constantes inventadas para gerações e
fencing tokens. Skills híbridas também têm todos os seus playbooks conferidos:
isso detectou argumentos fora do manifesto e valores usados antes de SAVE.

As instruções de OAuth foram corrigidas: `roadmap:manage` é padrão;
`portfolio:manage` é opt-in. Os pontos de entrada ficaram mais compactos,
mantendo os contratos completos nas referências. A autorização já dada para a
ação exata continua válida nos fluxos de confirmação.

## Avisos e limites da evidência

Os avisos incluem diferenças intencionais entre efeito e nível de acesso,
autoridade mais restrita em operações específicas, referências acima do tamanho
preferido mas abaixo do máximo, bundles genéricos grandes e os sete entrypoints
que combinam procedimentos com referências. Esses formatos permanecem suportados;
seus playbooks não ficam fora da validação. Não foram reduzidos os limites de
permissão, a verificação de schema ou os requisitos de evidência para passar nos
checks.

A execução anterior com Haiku foi interrompida pelo limite do Claude. Os testes
locais acima não demonstram uma nova taxa de sucesso de agentes com baixo
reasoning. Nenhuma avaliação de IA em produção nem deploy foi feita nesta retomada.

## Instalação no host

Os 23 pacotes LPM foram instalados nos três destinos de usuário:

- Codex: `~/.codex/skills`.
- Claude Code: `~/.claude/skills`.
- AgY: `~/.gemini/config/skills`.

Em cada destino, `verify` conferiu os hashes, `update` confirmou 23 pacotes
inalterados e `doctor` terminou com zero problemas. Os auxiliares externos
`caveman` e `grill-me` não integram a seleção instalada; `grill-me` depende de
uma skill não importada. Seus arquivos de origem continuam no repositório.

O MCP LPM existente no Codex foi preservado. Claude Code e AgY receberam a
conexão HTTP do LPM, reutilizando a credencial disponível no ambiente, sem
registrá-la neste relatório. Os demais servidores foram preservados; cópias
locais das configurações anteriores foram guardadas com permissões restritas.
Uma verificação autenticada, somente de leitura, obteve HTTP 200 em
`initialize` e `tools/list`, com 383 ferramentas e sem paginação.

A instalação legada `software-project-orchestrator` do Codex foi substituída
pelo catálogo v2 e preservada em backup local. Sessões já abertas devem ser
recarregadas para descobrir as skills e conexões atualizadas.

As integrações foram feitas nos branches `main` locais. Não houve push nem
deploy remoto nesta retomada.
