# Template: release report and pilot notice
Use in: flow-rollback-evidence step 9 (release report comment; after a rollback its Rollback line), step 10 (pilot notice); step 3 has its own fixed text
```text
Release <revision> — <one-line summary of the change>
What changed: <PR number or commit shas + subjects>; activities: LPM-Activity: <issueId>[, <issueId>]
Revision: <revision> (from the "Revision:" line); traffic: <revision>=100 since <UTC time>
Rollback target: <rollback target> (served 100 % before promotion)
Tests: npx vitest run <passed>/<total>; npm run lint <ok|fail>; npm run check:mcp-parity <ok|fail>
Upload check: list-files-for-upload worktree vs main checkout = <identical | only the change's files>
Golden set: ids <subset ids | full>; pass rate <prev> -> <now>; regressions <none | ids>; report <reportFile>
Smoke: <"MCP smoke passed: ..." line>
Rollback: <none | rolled back to <rollback target> at <UTC time>; smoke after rollback: <line>>
Evidence: <fileName (attachment id)> for each uploaded file
Pending: <none | exact item — who must act>
What to retest: <user-visible checks, one per line>
```

Pilot notice (only after promotion and a passing smoke; the user sends it):
```text
Correção: <what changed, in the pilot's words>
Teste reproduzível: <steps the pilot can repeat>
Evidência registrada: atividade <issueId>, revisão <revision>
Resultado: <aprovado no smoke e no golden set | pendência específica: <item>>
Próximo passo: <what to retest and how to report back>
```

## Fill rules
1. Every value comes from a command output or a tool result of this run; unknown → write "unknown", never guess.
2. Copy the revision and the rollback target exactly as `gcloud` printed them.
3. Golden-set lines carry ids, pass/fail and rates only; never answer text.
4. No secrets or tokens. Comment under 20,000 characters; long logs go in an attachment.
5. After a rollback, no pilot notice; the Pending line names the failing check.
6. The pilot notice is written in the pilot's language (Portuguese for the current pilots).
