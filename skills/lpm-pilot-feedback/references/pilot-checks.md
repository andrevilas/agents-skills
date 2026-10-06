# Pilot checks: OAuth, denials, Advisor, code revision
Load when: P2 checks an OAuth, missing-tool, Advisor or code claim
Applies to: lpm-pilot-feedback    Source: lpm `src/server/oauthGrantService.ts` (grant created only by the consent POST; `issuedAt`, `expiresAt` = +30 days, `revokedAt`), `src/pages/OAuthConsentPage.tsx` (GET on page load, POST on approve), `src/server/oauthToolPolicy.ts` (denial reasons), `server.ts` (`[mcp] oauth tool denied`, `[advisor] <feature> fallback`), `scripts/deploy-production.sh`, `firebase-applet-config.json`
## Summary
- Every check is read-only. Print no grant id, token, key or env value.
- The newest active `oauth_grants` doc is the reporter's last real authorization; only a consent POST creates one.
- A denial is a defect only when it contradicts the active grant's scopes and workspace.
- Advisor `fallbackReason` and `correlationId` come from the server log, not from the pilot's screenshot.
- Code proves behaviour only at the revision that served the report; say which revision you read.

## Shell values
| Name | Value |
|---|---|
| `<gcp>` | `gen-lang-client-0962999154` (region `us-west1`, service `little-project-manager`) |
| `<lpm>` | path of the `lpm` main checkout |
| `<since>` | ISO time: the older of the grant's `issuedAt` and the claimed reinstall; else `receivedAt` minus 2 days |
| `<days>` | whole days from `<since>` to now, rounded up, plus 1 |

## OAuth claim
1. Reporter userId: the owner, else {{tool:list_workspace_members}}(workspaceId=managed workspaceId) → `userId` of the one `userEmail` the owner gave; 0 or 2+ → ask. Active grant (read-only; prints no grant id):
```bash
REPORTER_UID='<userId>' NODE_PATH='<lpm>/node_modules' node -e '
const fs=require("fs"),{initializeApp}=require("firebase-admin/app"),{getFirestore}=require("firebase-admin/firestore");
const cfg=JSON.parse(fs.readFileSync("<lpm>/firebase-applet-config.json","utf8"));
const db=getFirestore(initializeApp({projectId:cfg.projectId}),cfg.firestoreDatabaseId||"(default)");
const now=new Date().toISOString();
db.collection("oauth_grants").where("userId","==",process.env.REPORTER_UID)
 .select("clientId","scopes","workspaceAccess","workspaceId","issuedAt","expiresAt","revokedAt").get().then(s=>{
 const g=s.docs.map(d=>d.data()).filter(x=>x.revokedAt==null&&String(x.expiresAt)>now)
  .sort((a,b)=>String(b.issuedAt).localeCompare(String(a.issuedAt)));
 console.log(JSON.stringify({active:g.length,newest:g[0]||null},null,1));process.exit(0);})
 .catch(e=>{console.error(e.message);process.exit(1);});'
```
2. Consents that created a grant (a GET only means the page loaded):
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="little-project-manager" AND httpRequest.requestMethod="POST" AND httpRequest.requestUrl:"/api/oauth/consent" AND timestamp>="<since>"' --project=<gcp> --freshness=<days>d --format='value(timestamp,httpRequest.status,httpRequest.userAgent)'
```
3. Refusals: same query with `textPayload:"oauth tool denied"` in place of the method and URL terms; `--format='value(timestamp,textPayload)'`.
4. The missing tool's scope: its rule in `<lpm>/src/server/oauthToolPolicy.ts` (`<tool>: { scope: ... }`); the box name: {{ref:connection-and-access}}.

First match wins (`active` > 1 means older installs were never revoked; the newest decides):
| Finding | Class |
|---|---|
| `newest` is null, or its `issuedAt` is older than the claimed reinstall | `connection-authorization`: remove, reinstall, tick the box |
| the tool's scope is not in `newest.scopes` | `connection-authorization`: tick "<box of that scope>" |
| denial `reason` `insufficient_scope` (the connector still uses an older grant) | `connection-authorization` |
| denial `access_denied`, `workspaceAccess` `single` | `connection-authorization`: the grant covers another workspace; reinstall, pick the right one |
| denial `access_denied`, `workspaceAccess` `all` | `unverified`: the line names no workspace; owner asks which project |
| denial `workspace_required` or `invalid_arguments`; `field`/`problem` agree with the tool's rule | `expected-behaviour`: the client sent bad or incomplete arguments |
| denial whose `field`/`problem` contradicts the tool's rule or published schema | `product-defect` naming the field |
| scope granted, grant newer than the reinstall, tool still absent or denied | `product-defect` |

## Advisor claim
1. Fallback line around the question (the question precedes `receivedAt`):
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="little-project-manager" AND textPayload:"[advisor]" AND textPayload:"fallback" AND timestamp>="<receivedAt minus 30 min>" AND timestamp<="<receivedAt>"' --project=<gcp> --format='value(timestamp,textPayload)'
```
2. Keep lines whose JSON `workspaceId` is the managed workspaceId; read `fallbackReason`, `correlationId`. Read the answer's fields per {{ref:advisor-semantics}}. Quote `detail` only after removing secrets.
3. Budget: Firestore `workspaces/<workspaceId>/ai_usage_daily/<UTC YYYY-MM-DD>` → used tokens = `totalTokens` + `aiReservedTokens` + `aishReservedTokens`; `totalRequests` (same script shape as step 1 of the OAuth check, `.doc(path).get()`).

| `fallbackReason` | Class |
|---|---|
| no fallback line | AI answer: class from the Code claim table |
| `ai_usage_limit_reached`, `ai_disabled`, `ai_not_requested` | `expected-behaviour` (+ today's `ai_usage_daily` totals) |
| `ai_timeout`, `ai_provider_error`, `ai_provider_unavailable` | `unverified`, with the log line and `correlationId` |
| `ai_invalid_response` | `product-defect` |
| `ai_permission_denied` | `owner-decision` (who may use the Advisor there) |

## Code claim
1. `lpm` code: serving revision = `gcloud run services describe little-project-manager --region=us-west1 --project=<gcp> --format=json | jq -r '.status.traffic[] | select(.percent==100) | .revisionName'`; its time = `gcloud run revisions describe <revision> --region=us-west1 --project=<gcp> --format='value(metadata.creationTimestamp)'`.
2. A deploy uploads a working directory, so no exact commit is recorded: `<sha>` = `git -C <lpm> log -1 --format=%H --before=<time> main`. Read `git -C <lpm> show <sha>:<path>`. `git -C <lpm> log --oneline <sha>..main -- <path>` not empty → Sources: "main differs from revision <revision>".
3. Customer-repo citation `repoUrl@sha:path#Lx-Ly`: {{tool:list_workspace_repository_links}}(workspaceId=managed workspaceId) → `id` whose `canonicalRepositoryUrl` equals `repoUrl`; then {{tool:read_repository_file_excerpt}}(workspaceId=managed workspaceId, repositoryLinkId=that id, path, startLine, endLine). No AI, no code search. Returned `commitSha` ≠ the cited sha → say so in Sources. 0 or 2+ links, or an error → `unverified`: "customer repo, owner checks".

| Cited code (at its commit) | Class |
|---|---|
| contradicts the answer | `product-defect` (Advisor: golden-set fixture) |
| supports the answer | `expected-behaviour` |
| cannot be read | `unverified` |
