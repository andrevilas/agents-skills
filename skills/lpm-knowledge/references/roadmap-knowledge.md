# Roadmap knowledge notes
Load when: a roadmap note's fields or defaults matter
Applies to: lpm-knowledge    Source: lpm `src/lib/roadmapKnowledge.ts`, `draftRoadmapKnowledgeCommand`, `acceptRoadmapKnowledgeArtifactCommand`, `rejectRoadmapKnowledgeArtifactCommand`, `src/cli/lpm.ts` (roadmap knowledge-*); cards `draft_roadmap_knowledge`, `list_roadmap_knowledge_artifacts`, `accept_roadmap_knowledge_artifact`, `reject_roadmap_knowledge_artifact`; card errata (accept retry check)

## Summary
- Draft is deterministic: it reuses the rule-based roadmap analysis and spends no AI budget. It is not project knowledge until accepted.
- Every draft call creates a new note (no dedupe): list drafts first.
- Accept creates a help article. Its defaults are `status=published`, `agentVisible=true`, `guidanceLevel=informational`: send `status: "draft"` unless the owner approved publication.
- Accept and reject need the workspace owner or an admin and `confirmed: true`, sent only after an explicit yes. Reject is final.
- All four tools need an LPM API key (not on connectors).

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| draft scope | `itemId` (wins), else `roadmapId`, else the whole workspace | pass one scope; archived items cannot be drafted |
| draft `projectId` | target project for a later accept; default = first grounding project; not validated at draft time | an accept fails later if it is outside the workspace |
| draft `title` | default "Roadmap item analysis note" or "Roadmap analysis note" | pass the owner's title when given |
| draft result | `id` (artifactId), `status: "draft"`, `title`, `summary`, `content` (Facts, Inferences, Technical Coverage, Risks, Recommended Actions), `confidence`, `projectId`, `roadmapId`, `itemId`, `sourceTypes[]`, `groundingSources[]` | show `title`, `summary`, `content` to the owner |
| `confidence` | fixed by the deterministic analysis | never present it as an AI score |
| status values | `draft`, `accepted`, `rejected`, `superseded` | nothing sets `superseded` today |
| list | newest first, no pagination, full `content` per note; filters `roadmapId`, `itemId`, `projectId`, `status` match exactly and only when sent | an item note also carries its `roadmapId`; accept never changes the note's `projectId`: never filter by `projectId` to find a decided note |
| accept `status` | article status `published` (default) or `draft` | `draft` unless the owner approved publication; a draft article is hidden from default help reads and no MCP tool can publish it (web app only) |
| accept `agentVisible` | default `true`: every agent that reads the project's help sees it | tell the owner before accepting |
| accept `guidanceLevel` | `informational` (default), `recommended`, `guardrail`, `forbidden` | `guardrail`/`forbidden` make it a rule for agents: only on the owner's explicit order |
| accepted article | `articleType=reference`, audiences human-operator + agent, journey operate, topics roadmap + governance, slug `<slug of title>-<first 8 characters of artifactId>`, `sourceOfTruth` `roadmap-knowledge-artifact:<artifactId>` | find it with {{tool:search_help_articles}}(query=<first 8 characters of artifactId, lowercased>, status=<status sent>, agentVisibleOnly=false); a title longer than 55 characters cuts that suffix (slug max 64): search the title instead |
| accept result | `status: "accepted"`, `acceptedKnowledgeItemId`, `acceptedBy`, `acceptedAt` | `acceptedKnowledgeItemId` is the article id |
| accept failure midway | the article is created before the note is marked accepted | before a retry, look for the article with {{tool:search_help_articles}} as in the row above; {{tool:list_project_knowledge_items}} returns assets only and cannot see it |
| reject | needs a non-empty `reason`; final; nothing is added to project knowledge | a new draft is the only way back |
| audit | `roadmap_knowledge_artifact_drafted`, `_accepted`, `_rejected` events | the owner can trace who decided |

## Rules
1. List drafts for the scope before drafting.
2. Show the full note to the owner; the owner decides accept or reject.
3. Send `confirmed: true` only after the owner's explicit yes in this conversation.
4. Accept with `status: "draft"` unless the owner approved publication; never `guardrail`/`forbidden` without the owner.
5. Reject with the owner's reason, never your own.
6. Never retry an accept before checking the article list.

## Examples
```text
example: CLI equivalents (API key)
lpm roadmap knowledge-list --workspace <workspaceId> --status draft --json
lpm roadmap knowledge-draft --workspace <workspaceId> --item <itemId> --project <projectId> --json
lpm roadmap knowledge-accept --workspace <workspaceId> --artifact <artifactId> --confirm --status draft --json
lpm roadmap knowledge-reject --workspace <workspaceId> --artifact <artifactId> --reason "<owner reason>" --confirm --json
```
