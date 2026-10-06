# Flow: skills context write
Load when: decision row 8

## Preconditions
1. An LPM API key with a `full` or `custom` profile (create, update and delete) and project manage rights.
2. Field semantics and rules: {{ref:skills-contexts}}.
3. skillsContextId: {{tool:list_skills_contexts}}(projectId) → `id` with `status == "active"`; 0 or 2+ → ask.

## Steps
1. {{tool:list_skills_contexts}}(projectId) → an active context for the same purpose → update it, never create a second.
2. {{tool:get_skills_context}}(projectId, skillsContextId) → keep every field's current text.
3. Build the change ({{ref:skills-contexts}}): only changed fields, each with its complete new text; `""` clears; no `defaultModel` unless the owner named it; no secret.
4. [C] Show the call with before → after per field (`isDefault=true` unsets the other default); wait for "yes".
5. {{tool:create_skills_context}}(projectId, name, instructions, <optional fields>) [C] (timeout → step 1 for the `name` before any retry), or {{tool:update_skills_context}}(projectId, skillsContextId, <fields> or status="archived") [C].
6. Only on "delete" (else archive): show the step 2 text that will be lost, then {{tool:delete_skills_context}}(projectId, skillsContextId) [C].
7. Verify: run § Verify (call the tools again; never reuse the step 1 list).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| `defaultModel` without the owner's order | SKILL.md §6 row 3; STOP |
| 2+ active contexts for the same purpose | "Which context: <id> <name> or <id> <name>?" |
| "You do not have permission to manage this project" | "A project manager must run this change." STOP |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create, update, archive | {{tool:get_skills_context}}(projectId, skillsContextId) | each sent field equals its new value after trimming; a `""` sent for an optional field reads `null` |
| `isDefault=true` sent | call {{tool:list_skills_contexts}}(projectId) again | exactly one context has `isDefault == true`: this one |
| delete | call {{tool:list_skills_contexts}}(projectId) again | the id is absent |

## Report fields
Scope (project, skillsContextId), fields before → after, the user's "yes" quoted, Pending, Next.
