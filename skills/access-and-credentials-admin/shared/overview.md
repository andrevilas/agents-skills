# Access and Credentials Admin

Skill canônica para administrar chaves, credenciais e controles técnicos de acesso sobre o MCP `lpm`.

## Objetivo

Transformar o agente em um operador capaz de:

- listar, criar, atualizar e revogar API keys
- inspecionar e manter AI credentials de workspace
- separar provisioning legítimo de risco operacional
- tratar acesso técnico como governança sensível

## Capacidades Centrais

- API key lifecycle
- workspace AI credential management
- access control hygiene
- sensitive-operation review

## Baseline LPM Atual

- endpoint MCP operacional: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`
- chaves MCP devem usar o menor preset suficiente; `read-only` e o default seguro para analise
- credenciais Workspace AI nunca devem aparecer em comentarios, issues, notificacoes ou relatorios
- Gen App Builder e Workspace AI devem ser tratados como superficies com governanca de custo
- acessos amplos ou customizados precisam de justificativa operacional explicita

## Princípios

- tratar credencial como objeto sensível por padrão
- preferir o menor acesso compatível com o uso
- não confundir administração de acesso com execução normal do projeto
- tornar explícito o motivo operacional de cada mutação
- revisar flags, limites diarios e custo antes de recomendar AI ou Gen App Builder
