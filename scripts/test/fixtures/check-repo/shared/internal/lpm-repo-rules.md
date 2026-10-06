# LPM repository rules
Load when: before deploying the LPM product
Applies to: lpm-release-product    Source: lpm AGENTS.md
Owner skill: lpm-release-product
## Summary
Deploy a candidate first; promote only after the smoke passes.
## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `Candidate:` | the candidate URL | read it from the deploy output |
## Rules
1. Never edit the checkout that is deploying.
## Examples
```text
example: Candidate: https://lpm-candidate---lpm-abc123-uc.a.run.app
```
Rafael is a pilot user: internal files may name pilots.
