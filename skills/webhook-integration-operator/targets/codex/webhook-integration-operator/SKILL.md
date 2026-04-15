---
name: webhook-integration-operator
description: Operate webhook subscriptions, tests, and delivery review over the LPM MCP. Use this skill when the user wants to create, test, monitor, or repair webhook integrations in workspace or project scope.
---

# Webhook Integration Operator

Use this skill when the task is webhook integration operation over the `lpm` MCP. It focuses on subscription lifecycle, testing, and delivery diagnosis.

## When To Use

Use this skill when the user asks to:

- create or update a webhook subscription
- test an existing subscription
- inspect recent webhook deliveries
- pause or resume an integration
- troubleshoot webhook failures

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Subscriptions: `create_webhook_subscription`, `list_webhook_subscriptions`, `update_webhook_subscription`, `delete_webhook_subscription`
- Testing and deliveries: `test_webhook_subscription`, `list_webhook_deliveries`
- Scope reads: `get_project`, `get_workspace`

## Operating Principles

1. Define scope first.
   Resolve workspace or project scope before creating a subscription.

2. Treat test delivery as mandatory.
   Validate a new or updated subscription before declaring it operational.

3. Diagnose from delivery evidence.
   Use recent delivery data to explain failure modes.

4. Handle secrets deliberately.
   Treat webhook URL and secret as sensitive configuration.

## Workflows

## 1. Subscription Setup

1. Define scope, name, URL, and event set.
2. Create the subscription.
3. Trigger a test delivery.

## 2. Delivery Diagnosis

1. Read recent deliveries.
2. Identify failing patterns.
3. Decide whether to update config, pause, or remove the subscription.

## 3. Lifecycle Maintenance

1. Update events, URL, secret, or status as needed.
2. Re-test after any meaningful change.

## Guardrails

- Do not mark a subscription healthy without testing it.
- Do not rotate secrets casually without operational reason.
- Do not delete a subscription until you understand whether it is actively used.
