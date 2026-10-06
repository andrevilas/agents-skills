# Artifact store map
Load when: unsure where something belongs
Applies to: lpm-knowledge    Source: lpm `createKnowledgeItemCommand`, `listProjectKnowledgeItemsPageCommand`, `createProjectFileCommand`, `src/server/requirementsDocumentSource.ts`; process-rules "Evidence"; cards `create_knowledge_item`, `create_project_file`, `create_skills_context`, `draft_roadmap_knowledge`; digest legacy-knowledge-and-publication-operator §2.3 #2, #15

## Summary
- Evidence of work goes on the activity ({{skill:lpm-deliver-activity}}), never into a knowledge item or a project file record.
- Knowledge items (assets) and help articles live in one project knowledge base; {{tool:list_project_knowledge_items}} sees assets only, the help tools see articles only.
- Project file records are a separate list ({{tool:list_project_files}}).
- No MCP tool uploads or reads file bytes: knowledge items and file records register a link to a file that is already stored.

## Facts
| What you have | Store | Skill / tool |
|---|---|---|
| proof of work on one activity (screenshot, log, test report) | activity attachment | {{skill:lpm-deliver-activity}} |
| WhatsApp or protocol media of an intake entry | protocol evidence | {{skill:lpm-intake-triage}} |
| output of an AISH job (document, runbook, report) | AISH delivery artifact | {{skill:lpm-aish-delivery}} |
| a reusable reference document already uploaded (spec, contract, manual) | knowledge item, `kind=asset`, `fileType` `pdf`, `image` or `text` | {{tool:create_knowledge_item}} |
| an entry for the project's file list (url, MIME type, size known) | project file record | {{tool:create_project_file}} |
| project-specific agent instructions, glossary, repository or tooling notes | skills context | {{tool:create_skills_context}} ({{ref:skills-contexts}}) |
| a roadmap or item analysis to keep | roadmap knowledge note → help article after the owner accepts | {{tool:draft_roadmap_knowledge}} ({{ref:roadmap-knowledge}}) |
| a rule or how-to for people and agents | help article | web UI only ({{ref:ui-only}}) |
| a discussion that needs a decision | governance thread | {{skill:lpm-governance-decisions}} |
| the source document of requirements | knowledge item referenced by a requirement `sourceDocumentId` | {{skill:lpm-requirements-scope}} |

| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `kind: "asset"` / `kind: "article"` | the two kinds in the project knowledge base | {{tool:delete_knowledge_item}} deletes either |
| knowledge item created over MCP | has no `agentVisible` flag (defaults to false) | it is not indexed for search or grounding; say so if asked |
| create result | plain text "... created with ID: <id>" | take the id after "ID: " |
| create retry | both creates are not idempotent | re-list before any retry |
| audit | creates log `file_uploaded`, deletes log `file_deleted` in the project activity feed | the feed shows who registered or removed it |
| delete | removes the record only; the stored file stays | tell the user the file itself is not deleted |
| requirement `sourceDocumentId` | points at a knowledge asset id | check requirements before deleting an asset |

## Rules
1. Evidence of work never goes into a knowledge item or a project file record.
2. Register only a URL the user gave for a file that is already stored.
3. One record per purpose: re-list before creating, to avoid duplicates.
4. Never put a secret in any field.
5. Curate only material that helps execution or governance in this project; state why it belongs.

## Examples
```text
example: "save the test screenshot for activity <issueId>" → evidence → lpm-deliver-activity
example: "add the signed contract PDF (link <url>) to the project knowledge" → create_knowledge_item(fileType="pdf")
example: "add the agent glossary for this project" → skills context (decision row 8)
```
