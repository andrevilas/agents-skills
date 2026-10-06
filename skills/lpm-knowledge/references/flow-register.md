# Flow: register a document or file record
Load when: decision row 5

## Preconditions
1. An LPM API key. Document: profile `full`, `requirements` or `custom`. File record: profile `full`, `portfolio` or `custom`, and project manage rights.
2. Only a link to a file that is already stored: no URL → SKILL.md §6 row 2.

## Steps
1. Classify with {{ref:artifact-store-map}}: evidence of work → SKILL.md §6 row 1; reusable reference document → document; entry for the project's file list → file record.
2. Document: {{tool:list_project_knowledge_items}}(projectId); file record: {{tool:list_project_files}}(projectId). All pages (loop `nextCursor` while `hasMore`) → same name or URL → STOP: "already registered as <id>".
3. Document `fileType` from the file extension: `.pdf` → `pdf`; `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` → `image`; `.txt`, `.md` → `text`; any other → ask. File record `type` (MIME) and `size` (bytes) come from the user. Name, type or size unknown → SKILL.md §6 row 4; never guess.
4. Document: {{tool:create_knowledge_item}}(projectId, name, fileUrl, fileType, fileName) [A] → keep the id after "ID: ".
5. File record: {{tool:create_project_file}}(projectId, name, url, type=<MIME>, size=<bytes>) [A] → keep the id after "ID: ".
6. Timeout → run step 2 again before any resend (both creates are not idempotent).
7. Verify: run § Verify.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| same name or URL already listed | "Already registered as <id> (<name>). Register another one anyway?" |
| extension not in step 3 | "Is this file a PDF, an image or a text file?" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| document create | call {{tool:list_project_knowledge_items}}(projectId) again, all pages (never reuse the step 2 list) | the kept id is present |
| file record create | call {{tool:list_project_files}}(projectId) again, all pages (never reuse the step 2 list) | the kept id is present |

## Report fields
Scope (project), kind (document or file record), name and id created, Pending, Next.
