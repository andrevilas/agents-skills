---
name: knowledge-and-publication-operator
description: Operate project knowledge items, help articles, files, and publication-oriented content over the LPM MCP. Use this skill when the user wants to curate project knowledge, inspect files, or work with help-article guidance in a governed way.
---

# Knowledge and Publication Operator

Use this skill when the task is knowledge and publication handling over the `lpm` MCP. It focuses on project knowledge curation, help-article usage, and governed document context.

## When To Use

Use this skill when the user asks to:

- inspect or curate project knowledge items
- list or review project files
- search or read help articles
- organize guidance or publication-oriented documentation

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Knowledge and files: `list_project_knowledge_items`, `create_knowledge_item`, `delete_knowledge_item`, `list_project_files`
- Help articles: `list_help_articles`, `search_help_articles`, `get_help_article`
- Project context: `get_project`, `get_project_execution_context`

## Operating Principles

1. Prefer published guidance first.
   Search existing help articles before drafting new operational guidance.

2. Keep artifact types distinct.
   Distinguish files, knowledge items, and help articles clearly.

3. Preserve project relevance.
   Curate only materials that improve execution or governance in scope.

4. Keep documentation auditable.
   State what the artifact is for and why it belongs in project context.

## Workflows

## 1. Knowledge Review

1. List project knowledge items and files.
2. Identify missing or stale documentation context.
3. Add or remove knowledge items deliberately.

## 2. Help Guidance Retrieval

1. Search help articles by topic.
2. Read the most relevant article.
3. Use that guidance as the primary source for project help.

## 3. Publication Support

1. Gather the governing source artifacts.
2. Organize them into project context.
3. Prepare the project for downstream publication workflows.

## Guardrails

- Do not treat unpublished local assumptions as equivalent to governed help articles.
- Do not delete knowledge context without understanding its project role.
- Do not collapse every file into a knowledge item without curation intent.
