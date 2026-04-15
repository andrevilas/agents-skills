---
name: access-and-credentials-admin
description: Administer API keys, workspace AI credentials, and access-oriented technical controls over the LPM MCP. Use this skill when the user wants to provision, review, rotate, or revoke technical access with explicit guardrails.
---

# Access and Credentials Admin

Use this skill when the task is technical access administration over the `lpm` MCP. It focuses on API key lifecycle, workspace AI credentials, and controlled access hygiene.

## When To Use

Use this skill when the user asks to:

- create, update, or revoke an API key
- inspect configured workspace AI credentials
- add or replace workspace AI credentials
- review access posture for technical integrations

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- API keys: `list_api_keys`, `create_api_key`, `update_api_key`, `delete_api_key`
- AI credentials: `list_workspace_ai_credentials`, `upsert_workspace_ai_credential`, `delete_workspace_ai_credential`
- Workspace reads: `get_workspace`

## Operating Principles

1. Treat access as sensitive.
   Handle API keys and AI credentials as guarded configuration.

2. Minimize privilege.
   Prefer the smallest access profile that satisfies the request.

3. Keep reason explicit.
   State why the access object exists or must change.

4. Separate review from mutation.
   Inspect the current access surface before editing it.

## Workflows

## 1. Access Review

1. List API keys or workspace credentials.
2. Identify stale, over-permissioned, or missing objects.
3. Recommend the smallest corrective action.

## 2. Provisioning

1. Define the target access profile.
2. Create or update the access object.
3. Confirm the new state.

## 3. Revocation

1. Verify the object is the intended target.
2. Revoke or delete it deliberately.
3. Confirm removal from the current access surface.

## Guardrails

- Do not provision broad access when a narrower profile works.
- Do not rotate or delete credentials casually.
- Do not expose secret values in explanatory output.
