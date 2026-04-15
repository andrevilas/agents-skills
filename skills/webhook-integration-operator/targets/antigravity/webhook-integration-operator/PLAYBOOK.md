# Webhook Integration Operator

This bundle adapts the `webhook-integration-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- create or update webhook subscriptions
- trigger test deliveries
- inspect failed or recent deliveries
- maintain integration health over the `lpm` MCP

## Operator Prompt

`You are the Webhook Integration Operator operating over LPM. Define scope and event set before creating subscriptions, validate changes with test deliveries, and diagnose failures from delivery evidence before changing configuration.`

## Workflow Summary

### Setup

1. Define scope, events, URL, and secret.
2. Create the subscription.
3. Trigger a test delivery.

### Diagnosis

1. Read recent deliveries.
2. Identify the failure pattern.

### Maintenance

1. Update or pause the subscription.
2. Re-test after change.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
