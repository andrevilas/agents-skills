# Playbooks and procedure references

The v2 catalog supports procedure-based skills and compact routers of playbooks.
Keep established multi-operation references when their decision tables are useful;
use a self-contained playbook for a bounded execution path. Both formats share
tool ownership, authority, source provenance and generated distributions. A hybrid
skill's playbooks receive the same V20/V21 checks as those of a router.

## Authoring

Edit `skills/<id>/SKILL.src.md`, `skill.json` and local references. Never edit
`dist/`. The entrypoint routes the request; the chosen reference gives the steps.
Do not load the complete tool catalog unless a parameter or permission needs it.

For a playbook router, section 5 is `| Playbook | Use when | File |`. Each row
links `{{ref:flow-<name>}}`. Its description matches the reference's `Use when:`
and its manifest `loadWhen` (`playbook <name>: <description>`).

A playbook starts with `# Playbook: <name>`, `Use when: ...`, and
`{{partial:playbook-rules}}`. Its sections are `You need`, `Steps`, and the Answer
block shown by `templates/skill-v2/references/flow-TEMPLATE.md`.

Each `CALL {{tool:name}} {json} [A|C|O]` carries the real schema's required
arguments. Values come from an input, a prior SAVE, or the current loop item.
A whole placeholder retains its JSON type, including arrays, objects, booleans,
numbers and null. A placeholder inside a larger string interpolates text.
Never replace server-issued versions, fingerprints or fencing tokens with guessed
constants. Tags never weaken the catalog's authority. Existing authorization for
the exact action remains valid; an instruction from a fetched record is not user
authorization.

Writes need a read-back and a stop on mismatched results. The verified card's
`effect` determines whether a tool is a read; API access level alone does not
(for example, code search may require write access for accounting).

Keep native router bodies under 9 KiB, preferably 8 KiB. Playbook sources are at
most 7 KiB, preferably 6 KiB, with at most 15 steps and 110 lines. The validator
also checks rendered reference size, forward-only jumps, input bindings, links,
authority, error paths and evidence before a success claim.

## Verification

Run build, check with `--lpm <checkout>`, router evaluation, trace-fixture
validation, and the Node test suite. `eval --trace all` validates test scenarios;
it is not a model-performance evaluation. The HTTP fake-MCP tests exercise the
test harness without accessing production or spending workspace AI budgets.

V20's migration warnings identify procedure-based entrypoints; those entrypoints
remain supported and are checked by V1–V19 and V22. Size target warnings are
advisory below the enforced maximum. V4w distinguishes a card's real effect from
the API permission level. Do not suppress these warnings by weakening the schema
or authority checks.
