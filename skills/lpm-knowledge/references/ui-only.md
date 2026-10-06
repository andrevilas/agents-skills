# Actions that exist only in the web UI
Load when: no MCP tool performs the action
Applies to: lpm-knowledge    Source: lpm `server.ts` (declared MCP schemas of the knowledge tools), REST routes `POST /api/projects/:projectId/help-articles`, `POST /api/projects/:projectId/help-articles/:slug/feedback`, `GET /api/help-articles`, `POST /api/projects/:projectId/requirements/analyze-document`; `scripts/backfill-gen-app-builder-documents.ts`, `scripts/backfill-project-help-center-wave1.ts`; digest legacy-knowledge-and-publication-operator §2.3, §3

## Summary
- No MCP tool or CLI command writes, edits, deprecates or rates a help article, uploads file bytes or returns file content.
- Tell the user the exact action to do in the LPM web app, then STOP. Never improvise a workaround and never call the REST API.
- Indexing project knowledge for search and grounding is an operator script, not an agent action.

## Facts
| Action | Where it exists | What to tell the user |
|---|---|---|
| create or edit a help article | web app, the project's help / knowledge area | "No MCP tool writes help articles. Please create or edit it in the LPM web app; I can then read it." |
| deprecate or republish a help article | web app (no update tool) | "Please change its status in the LPM web app." |
| rate an article (useful, outdated) | web app feedback | "Please send the feedback from the article page in the LPM web app." |
| upload a file to the knowledge base or the project files | web app upload | "Upload it in the LPM web app, or give me the URL of the stored file; I only register links." |
| read a file's content | the stored file at its `url` / `fileUrl` | "MCP returns file metadata only. Open the link to read the file." |
| requirements document analysis | web app: Requirements → Análise de documento (reads a knowledge asset by `sourceDocumentId`) | "Document analysis runs only in the LPM web UI (Requirements → Análise de documento)." Requirements follow-up → {{skill:lpm-requirements-scope}} |
| the LPM application Help Center | web app help center | "The LPM Help Center is not served over MCP in this project. Read it in the web app." |
| copy the LPM Help Center into a project | operator backfill script | "An LPM operator must copy the Help Center into this project." |
| index project knowledge for search or grounding | operator backfill script | "Knowledge indexing is run by an LPM operator, not by agents." The repository code index is different → {{skill:lpm-code-index}} |

## Rules
1. Say the exact web UI action from the table and STOP.
2. Never call an `/api/...` route; agents use MCP tools only.
3. After the user says the UI action is done, re-read with the matching list tool before reporting.

## Examples
```text
example: "publique um artigo de ajuda com a nova regra de deploy"
→ "No MCP tool writes help articles. Please create it in the LPM web app; I can then read it."
```
