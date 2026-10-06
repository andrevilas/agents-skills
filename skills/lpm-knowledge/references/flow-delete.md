# Flow: delete a knowledge item, article or file record
Load when: decision row 7

## Preconditions
1. An LPM API key with a `full` or `custom` profile; file records need project manage rights.
2. itemId, fileId: step 1 (the SKILL.md §3 article list hides draft, deprecated and hidden articles). baselineIds: {{tool:list_requirement_baselines}}(projectId) → every `id`.

## Steps
1. Resolve the id and keep `name`, kind and, for an article, `slug`. kind = document (from {{tool:list_project_knowledge_items}}), article or file record; never show the raw `kind` field value ("asset"). Document: {{tool:list_project_knowledge_items}}(projectId). Article: {{tool:list_help_articles}}(projectId, agentVisibleOnly=false, limitCount=100) once per status (`draft`, `published`, `deprecated`). File: {{tool:list_project_files}}(projectId). All pages each; 0 or 2+ name matches → Stop and ask row 2.
2. Document only: {{tool:list_requirement_baselines}}(projectId) → for EVERY baseline `id` (isCurrent true AND false; list each {{tool:list_requirements}} call you make): {{tool:list_requirements}}(projectId, baselineId) → a `sourceDocumentId == itemId` → STOP: Stop and ask row 1. End the turn. Report Done: nothing deleted; Pending: your decision on deleting <id>. A yes to row 1 is not the step-3 confirmation: still show step 3 and wait for a second "yes". A result with `truncated: true` → Stop and ask row 3. No baseline → say "no baseline to check".
3. [C] Show "Delete <name> (<kind>, id <id>)? No undo; the stored file stays." Document: add "Requirements not yet in a baseline cannot be checked." Article: add "No MCP tool can recreate it." Wait for "yes".
4. {{tool:delete_knowledge_item}}(projectId, itemId) [C] or {{tool:delete_project_file}}(projectId, fileId) [C] (these two tools take no idempotencyKey; send only projectId and itemId/fileId). "not found" → re-list; no retry.
5. Verify: run § Verify (call the tool again; never reuse the step 1 list).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| a requirement uses the document | "Requirement <id> (baseline <baseline name>) uses <name> as its source; deleting breaks that link. Delete anyway?" |
| 0 or 2+ entries match the name | "Which one: <id> <name> or <id> <name>?" |
| {{tool:list_requirements}} returned `truncated: true` | "Baseline <baseline name> is too large to check completely; a requirement may still use <name>. Delete anyway?" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| document delete | call {{tool:list_project_knowledge_items}}(projectId) again, all pages | the id is absent |
| article delete | {{tool:get_help_article}}(projectId, slug, publishedOnly=false, agentVisibleOnly=false) | the error is "Help article not found" |
| file record delete | call {{tool:list_project_files}}(projectId) again, all pages | the id is absent |

## Report fields
Scope (project), kind, name and id deleted, the user's "yes" quoted, Pending, Next.
