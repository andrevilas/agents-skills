# Operating Templates

Use these templates when you need concise, repeatable communication through `create_comment` or `create_notification`.

Adapt the tone to the project, but keep the message short and action-oriented.

## Comment Templates

### Stale In-Progress Issue

`Status check: this item appears inactive for the last 48h. Is there a blocker, pending decision, or scope change needed to move it forward?`

### Blocker Clarification

`This task looks blocked. Please confirm the dependency, current blocker owner, and the next action needed to unblock it.`

### Scope Reduction Prompt

`This item is at risk for the current cycle. Can we reduce scope or split a smaller deliverable to keep flow moving?`

### Done-State Confirmation

`Before closing this issue: are all linked blockers resolved and is there any follow-up work that should be split into a new item?`

### Dependency Release Notice

`This blocker appears resolved. Please confirm whether dependent work can now move forward.`

## Notification Templates

### Due-Date Risk

`Issue approaching due date. Please review status and confirm delivery confidence.`

### Assignment Escalation

`You were assigned work that is on the critical path for the current cycle. Please confirm next step and timing.`

### Blocker Escalation

`A blocked issue is now affecting delivery flow. Please review the dependency and update the unblock plan.`

### Burndown Alert

`Project burndown has flattened in the current cycle. Please review blockers, WIP, and assignment load.`

## Usage Rules

- Prefer comments for issue-local follow-up.
- Prefer notifications for deadline, blocker, or ownership escalation.
- Do not send both a comment and a notification unless the issue is both stale and time-critical.
- When escalating, state the concrete risk, not a generic reminder.
