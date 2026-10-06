# Routing profile
Load when: before editing a routing profile
Applies to: lpm-workspace-admin    Source: cards {{tool:update_project}}, {{tool:get_project}}, {{tool:list_unowned_domains_or_capabilities}}; lpm `server.ts` updateProjectCommand (routingProfile branch), `src/lib/projectRoutingProfile.ts`, `src/lib/workspaceRouting.ts`; digest legacy-workspace-routing-operator

## Summary
- `routingProfile` says which domains, capabilities, components and systems a project owns; intake routing ranks projects by it.
- {{tool:update_project}} replaces it wholesale: read {{tool:get_project}} first, send all nine arrays; an omitted array becomes `[]`; `null` clears the profile.
- The project must belong to a workspace. Change it only on the owner's explicit instruction: it changes where requests land.
- An unowned domain or capability gap closes when a non-archived project lists the exact string in `domains` or `ownedCapabilities`.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `domains` | business areas the project owns; routing weight 1.2 | exact strings; they close `unowned-domain` gaps |
| `aliases` | other names of the project; weight 1.2 | add the names users type in requests |
| `intakeKeywords` | words that should route here; weight 1.1 | short, distinctive terms |
| `ownedCapabilities` | capabilities owned; weight 1 | exact strings; they close `unowned-capability` gaps |
| `ownedComponents`, `ownedSystems` | components and systems owned; weight 1 each | names as the code or ops team uses them |
| `excludedKeywords` | words that must not route here | each match costs 0.2, at most 0.5 in total |
| `escalationRules`, `maintainedBy` | stored, not used in scoring | free text lists |
| each array | strings are trimmed; empty strings and duplicates are dropped | a non-array value fails with "... must be an array of strings" |
| omitted array | stored as `[]` | always resend the arrays you keep |
| `routingProfile: null` | clears the whole profile | never send `null` unless the owner asked to clear it |
| project without `workspaceId` | "Project routing profile requires the project to belong to a workspace" | set `workspaceId` first (owner decision) or drop the field |
| `workspaceId` moved without `routingProfile` | the server re-saves the old profile under the new workspace | re-read {{tool:get_project}} after a move |
| ranker | deterministic token match, no AI; only non-archived projects of the same workspace | a project with no profile rarely wins a routing match |
| gap `alignmentIssues` | a project's profile points to another workspace | re-save the profile with {{tool:update_project}} |

## Rules
1. {{tool:get_project}}(projectId) → copy `routingProfile` → change only the named strings → send all nine arrays.
2. Add a gap string exactly as {{tool:list_unowned_domains_or_capabilities}} returns it (same spelling and case).
3. Never put secrets, people's emails or customer data in profile strings.
4. Show the before → after arrays and wait for "yes" ([C]) before {{tool:update_project}}.
5. After the update, re-read {{tool:get_project}}; for a gap, re-run {{tool:list_unowned_domains_or_capabilities}}(workspaceId).

## Examples
```text
example: update_project(projectId=<id>, routingProfile={
  domains:["pagamentos"], ownedCapabilities:["parcelamento"], ownedComponents:["checkout-api"],
  ownedSystems:[], aliases:["checkout"], intakeKeywords:["pix","boleto"], excludedKeywords:["frete"],
  escalationRules:[], maintainedBy:[] })
```
