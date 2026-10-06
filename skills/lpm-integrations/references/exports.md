# Data exports
Load when: export work
Applies to: lpm-integrations    Source: lpm `createExportRequestCommand`, `processExportRequestCommand`, `listExportRequestsCommand`, `SENSITIVE_ADMIN_TOOLS` (`src/lib/mcpToolCatalog.ts`); cards {{tool:create_export_request}}, {{tool:list_export_requests}}
## Summary
{{tool:create_export_request}} queues a background job that packs ALL data of one workspace or one project into a JSON zip.
It is a data-exfiltration path: name the recipient and get a yes before every call. `filters` are stored but ignored.
Poll {{tool:list_export_requests}} until `completed` or `failed`. MCP returns no download link: the requester downloads it in the LPM web app (Settings).
Each call queues a new full export; there is no idempotency key. List before creating and before any retry.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `scope: "workspace"` | every project and record of the workspace | needs `workspaceId`; caller must be the workspace owner or an active member |
| `scope: "project"` | one project's records | needs `projectId`; caller must read the project |
| membership check | {{tool:list_workspaces}} rows carry `access.canManage` only (no role); any row for workspaceId is enough to try; `canManage` does not matter | never ask the user about membership; a project owner who is not a member gets "You do not have access to this workspace" on a workspace export → report it and offer a project export |
| `idempotencyKey` | {{tool:create_export_request}} has no such parameter | never add one; after a timeout list first (rule 5) |
| `format: "json-zip"` | the only format | do not promise CSV or other formats |
| `filters` | stored, ignored by the job | never tell the user the export is partial |
| `status` `queued` / `running` | the job is waiting or packing | do not create another export for the same scope |
| `status` `completed` | zip ready; `recordCounts`, `checksum` (sha256), `storagePath` set | report counts and checksum; download in the web app |
| `status` `failed` | `errorMessage` set | report it; a new export only when the user asks |
| `signedUrlExpiresAt` | informational; no code sets `status` `expired` on an export | a `completed` export stays downloadable in the web app; never report it as expired |
| `queued`/`running` after 10 reads (5 min) | the job is still packing | Pending "export still packing"; re-check later with {{tool:list_export_requests}} |
| completion side effects | the requester gets an in-app notification ("Export concluído"); webhooks with `export.completed` fire | a completed export is also a real webhook test event |
| visibility | {{tool:list_export_requests}} returns only the caller's own exports, newest first (default 20) | exports by other users are invisible: never report "none exist" |
| access | {{tool:create_export_request}} needs a `full`/`custom` key; {{tool:list_export_requests}} also `read-only`; neither is on connectors | missing tool → core rule 2 |
| web UI | Settings → Integrações groups credentials, exports and webhooks | send the user there to download |

## Rules
1. Ask who receives the zip (system and person) before showing the [C] call; no named recipient → no export.
2. Say in the confirmation that the zip holds every record of the scope.
3. Prefer the smallest scope: a project export when the user names one project.
4. Never create a second export while one of the same scope is `queued` or `running`.
5. After a timeout, list first; create again only when no matching row exists.
6. Report `recordCounts` and `checksum` from the completed row; never invent a link.
7. An export before a project delete is evidence for the owner; the delete itself belongs to another skill.

## Examples
```text
example: list_export_requests(workspaceId="<workspaceId>", projectId="<projectId>")
→ [{id: "<exportRequestId>", scope: "project", status: "completed", recordCounts: {issues: 120, requirements: 34}, checksum: "<sha256>"}]
Report: export <exportRequestId> completed (120 issues, 34 requirements); download it in the LPM web app → Settings.

example: create_export_request(scope="project", projectId="<projectId>")      # project scope
example: create_export_request(scope="workspace", workspaceId="<workspaceId>")  # workspace scope
```
