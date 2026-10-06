# Flow: label merge
Load when: decision row 4 of SKILL.md (merge duplicated labels)

## Preconditions
1. API key: {{tool:list_labels}} and {{tool:delete_label}} are not on connectors; {{tool:delete_label}} needs the full or custom profile.
2. Labels are universal: one label is shared by every workspace on the platform, and the server has no duplicate check.
3. {{tool:delete_label}} hard-deletes the label without detaching it: activities keep the dead id in `labelIds`. Relabel first, delete last.
4. The user named the label to keep, the duplicates and the projects whose activities must be relabeled.

## Steps
1. {{tool:list_labels}}() → keep the canonical `id` and each duplicate `id`, matched by the names the user gave.
2. [C] Ask "Keep <canonical> and delete <duplicates>? Labels are universal: this affects every workspace on the platform. (yes/no)". Continue only on "yes".
3. For each named project: {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` → keep issues whose `labelIds` hold a duplicate id.
4. For each kept issue build `labelIds` = old `labelIds` minus the duplicate ids plus the canonical id (the field replaces the whole list).
5. {{tool:batch_issue_operations}}(operations=[{tool: {{tool:update_issue}}, arguments: {projectId, issueId, labelIds}}], stopOnError=true, idempotencyKey="relabel-<labelId>-<projectId>-<n>") [A], at most 25 operations per batch.
6. `failed` or `skipped` > 0 → fix the arguments named in `items[].error` and resend only those items with a NEW key.
7. {{tool:list_issues}}(projectId, limitCount=100) again, loop `nextCursor` while `hasMore` → no issue holds a duplicate id. Any left → step 5 with a NEW key.
8. {{tool:delete_label}}(labelId=<duplicate id>) [C], once per duplicate.
9. Verify: {{tool:list_labels}}() → every duplicate id is absent and the canonical id is present.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| the label to keep is not named | "Which label do we keep: <a> or <b>?" |
| two labels look alike but the user did not call them duplicates | "Are <a> and <b> the same meaning? I merge only labels you name." |
| projects other than the named ones can carry the duplicate | "Other workspaces and projects can still use <duplicate>. Delete it anyway? (yes/no)" |
| connector or a key without full/custom | "Deleting a label needs an LPM API key with the full or custom profile." STOP |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| relabel batches | {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` | no issue of the named projects holds a duplicate id |
| {{tool:delete_label}} | {{tool:list_labels}}() | the duplicate id is absent (the delete reports success even for an unknown id) |

## Report fields
Scope (projects), canonical label (name, id), deleted label ids, relabeled activity count per project, failed items with their error, Pending, Next.
