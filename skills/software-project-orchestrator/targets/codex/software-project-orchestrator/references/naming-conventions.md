# Naming Conventions

Use these conventions to keep LPM structure predictable and easy to query.

## Projects

Preferred pattern:

`<Domain or Product> <Initiative>`

Examples:

- `MOB Checkout Revamp`
- `Platform CI Reliability`
- `Growth Referral Program`

Guidelines:

- Keep names human-readable.
- Avoid redundant prefixes like `Project`, `Team`, or `Initiative`.
- Use a short, stable project key when the tool asks for one.
- Prefer 3 to 6 uppercase characters for keys.

Examples:

- `MOB`
- `PLAT`
- `GROW`

## Teams

Preferred pattern:

`<Function> Team`

Examples:

- `Platform Team`
- `Mobile Team`
- `Growth Team`

If the organization already uses a naming scheme, reuse it.

## Cycles

Preferred pattern:

`<YYYY-MM-DD> to <YYYY-MM-DD>`

Alternative pattern:

`Sprint <number> <YYYY>`

Examples:

- `2026-03-30 to 2026-04-10`
- `Sprint 08 2026`

Guidelines:

- Prefer date-based names when multiple teams collaborate.
- Avoid vague names like `Current Sprint`.

## Milestones

Preferred pattern:

`<Outcome>`

Examples:

- `MVP`
- `Beta`
- `Production Release`
- `Internal Pilot`

Guidelines:

- Name the outcome, not the activity.
- Avoid milestone names that duplicate cycle names.

## Labels

Prefer a small, reusable taxonomy. Good label families:

- domain: `Frontend`, `Backend`, `Infra`, `Mobile`
- work type: `Bug`, `Feature`, `Tech Debt`
- severity or urgency: `Critical`, `High Risk`
- release or workflow tags only if they materially help filtering

Guidelines:

- Do not create synonyms such as `Backend` and `API` unless they represent meaningfully different slices.
- Use title case for readability.
- Prefer global labels that can be reused across projects.

## Issues

Preferred pattern:

`<Verb> <object> <qualifier>`

Examples:

- `Add retry logic to payment webhook`
- `Fix mobile login session refresh`
- `Split report generation job by tenant`

Guidelines:

- Start with a verb.
- Make the outcome legible without opening the issue.
- Avoid titles that are just component names.
