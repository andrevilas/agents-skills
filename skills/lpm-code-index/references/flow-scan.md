# Playbook: scan
Use when: scan a linked repository (branch, commit, languages)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id)" |
| repository | the user: `https://github.com/<owner>/<repo>` or a repository link id | STOP. Say: "Which repository? (https://github.com/<owner>/<repo> or link id)" |
| level | "project" when the link belongs to one project, else "workspace" | "workspace" |
| projectId | the project that owns a project link | level "project" → STOP. Say: "Which LPM project? (id)"; else "none" |
| vault | "yes" only when a workspace owner/admin explicitly asked to scan with the workspace GitHub token | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was scanned."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "A scan needs an LPM API key; this connector cannot scan."
2. SAVE: source = "workspace" when <input:vault> == "yes", else "default"
   IF <input:vault> == "no" → go to step 4.
3. CALL {{tool:get_workspace_repository_credential}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.configured != true → STOP. This belongs to skill {{skill:lpm-access}}. Say: "No workspace GitHub token is configured in <input:workspaceId>."
4. IF <input:level> == "project" → go to step 7.
5. CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git"; url = its canonicalRepositoryUrl
   IF no item matches → STOP. Say: "<input:repository> has no active workspace link. Link it first with playbook link."
6. CALL {{tool:scan_workspace_repository_readonly}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>","credentialSource":"<saved:source>"} [A]
   Make this call once. A failed scan still counts toward the 10 scans per workspace hour; never repeat it in a loop.
   IF the call returns an error that contains "rate limit" → STOP. Say: "The workspace used its 10 scans of this hour. Scan again in up to one hour."
   IF the call returns an error → STOP. Say: "The scan of <saved:url> failed: <error text>. It still counted toward the hourly limit; I did not repeat it."
   SAVE: branch, commitSha, visibility, scannedAt = those fields of result
   VERIFY: CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or item <saved:linkId> has lastScanStatus != "completed" → STOP. Say: "Link <saved:linkId> shows lastScanStatus <lastScanStatus>, not completed."
   SAVE: next = "a scan never refreshes the code index: check it with playbook check"; go to Answer.
7. CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git"; url = its canonicalRepositoryUrl
   IF no item matches → STOP. Say: "<input:repository> has no active link in project <input:projectId>. Link it first with playbook link."
8. CALL {{tool:scan_project_repository_readonly}} {"projectId":"<input:projectId>","repositoryLinkId":"<saved:linkId>","credentialSource":"<saved:source>"} [A]
   Make this call once. A failed scan still counts toward the 10 scans per workspace hour; never repeat it in a loop.
   IF the call returns an error that contains "rate limit" → STOP. Say: "The workspace used its 10 scans of this hour. Scan again in up to one hour."
   IF the call returns an error → STOP. Say: "The scan of <saved:url> failed: <error text>. It still counted toward the hourly limit; I did not repeat it."
   SAVE: branch, commitSha, visibility, scannedAt = those fields of result
   VERIFY: CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or item <saved:linkId> has lastScanStatus != "completed" → STOP. Say: "Link <saved:linkId> shows lastScanStatus <lastScanStatus>, not completed."
   SAVE: next = "none — scan done (a project link never gets a code index)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <saved:url> (<input:level> link <saved:linkId>)
Done: <scanned <saved:url>: branch <saved:branch>, commit <saved:commitSha>, <saved:visibility>, at <saved:scannedAt>; credential <saved:source> | nothing scanned>
Evidence: <lastScanStatus completed, read after the scan | none>
Pending: none
Next: <the ASK or STOP text that ended the run | <saved:next>>
```
lastScanStatus: never_scanned | completed | failed | rate_limited. Never claim a scan that the VERIFY above did not list as completed; a scan is metadata only and older than 24 h it is stale.
