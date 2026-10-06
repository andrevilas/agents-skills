# Flow: roadmap knowledge note
Load when: decision rows 9 and 10

## Preconditions
1. All four note tools need an LPM API key (not on connectors).
2. Accept and reject need the workspace owner or an admin and the owner's decision in this conversation (SKILL.md §6 row 3).
3. Field values and defaults: {{ref:roadmap-knowledge}}.
4. Scope: an item named → {{tool:list_workspace_roadmap_items}}(workspaceId, compact=true) → match `title` → `id` (itemId); a roadmap named → {{tool:list_workspace_roadmaps}}(workspaceId) → match `title` → `id` (roadmapId); neither → whole workspace. 0 or 2+ matches → ask.
5. artifactId: {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="draft") → `id`; none → "no draft note". Note target projectId: {{tool:list_workspace_projects}}(workspaceId) → `id`.
6. Article key: `<prefix>` = the first 8 characters of artifactId, lowercased. The accepted article's slug ends with "-<prefix>" unless the title is longer than 55 characters (the slug is cut at 64).

## Steps
Draft (row 9):
1. {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="draft", itemId for an item, roadmapId for a roadmap, no scope filter for the workspace) → keep only the same scope: item → `itemId == itemId`; roadmap → `itemId == null`; workspace → `roadmapId == null` and `itemId == null`. Any left → Stop and ask row 1.
2. Preview (no AI spent): {{tool:analyze_workspace_roadmap_item}}(workspaceId, itemId) or {{tool:analyze_workspace_roadmap}}(workspaceId, roadmapId).
3. {{tool:draft_roadmap_knowledge}}(workspaceId, itemId or roadmapId, projectId, title) [A] → keep `id`, `summary`, `content`. No projectId → LPM uses the first grounding project: say so. Timeout → step 1 before any retry (each call creates a draft).
4. Show `summary` and `content`: "Not project knowledge until the owner accepts it."
5. Verify: run § Verify (call the list again; never reuse the step 1 list).

Accept or reject (row 10):
6. {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="draft") → artifactId not listed → STOP: "the note is no longer a draft". Keep its `title` and `projectId`.
7. Accept values: projectId = the note's `projectId` from step 6 unless the owner named another project; `status` = the owner's choice between `draft` (default) and `published`; `guidanceLevel="informational"` unless the owner named one (`guardrail`/`forbidden` only on order).
8. [C] Show the exact call and, for `draft`: "Saved as a draft article; agents will not read it until someone publishes it in the LPM web app"; for `published`: "agents will read this article". Wait for the owner's "yes".
9. {{tool:accept_roadmap_knowledge_artifact}}(workspaceId, artifactId, projectId, status, guidanceLevel, confirmed=true) [C], or {{tool:reject_roadmap_knowledge_artifact}}(workspaceId, artifactId, reason=<owner's words>, confirmed=true) [C].
10. Accept timed out → never resend first: {{tool:search_help_articles}}(projectId, query=<prefix>, status=<status sent>, agentVisibleOnly=false) → an item whose `slug` ends with "-<prefix>" (0 items → once more with query=<note title>, match `name`). Then step 6 again: note `accepted` → step 11; article found and note still a draft → Stop and ask row 4; neither → resend step 9 once.
11. Verify: run § Verify.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| a draft already exists for the scope | "Draft <id> exists. Use it, or create a new one?" |
| no owner decision for accept or reject | SKILL.md §6 row 3; STOP |
| `access_denied` on accept or reject | "Only the workspace owner or an admin can decide notes." STOP |
| article found after a timeout, note still a draft | STOP. Pending: "article <id> was created but note <artifactId> is still a draft; do not accept again; the owner decides (reject the note, or keep the article)" |
| "Only draft roadmap knowledge artifacts can be accepted." | already decided: read `acceptedKnowledgeItemId`; no retry |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| draft | call {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="draft") again | the draft `id` is listed |
| reject | {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="rejected") (never filter by projectId) | an item `id == artifactId` |
| accept | {{tool:list_roadmap_knowledge_artifacts}}(workspaceId, status="accepted") (never filter by projectId); {{tool:search_help_articles}}(projectId, query=<prefix>, status=<status sent>, agentVisibleOnly=false), all pages (0 items → query=<note title>) | an item `id == artifactId` with `acceptedKnowledgeItemId`; an article item `id == acceptedKnowledgeItemId` |

## Report fields
Scope (workspace, project, roadmapId or itemId), note artifactId and state (draft, accepted, rejected), acceptedKnowledgeItemId, the owner's instruction quoted, Pending (accepted as `draft` → "publish article <id> in the web app"), Next.
