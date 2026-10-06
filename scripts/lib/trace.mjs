// E3 step-trace eval (§5.7): a scripted fake LPM MCP server plus a call-log checker.
//
//   node scripts/skills.mjs eval --trace <flow> --serve [--port N] [--log file]   start the fake server
//   node scripts/skills.mjs eval --trace <flow> --log <file> [--json] [--transcript file]   check a call log
//   node scripts/skills.mjs eval --trace <flow|all>                                   validate flow file(s), print the prompt
//
// The fake server speaks MCP Streamable HTTP (JSON responses only, no SSE) on 127.0.0.1:
// `initialize`, `ping`, `tools/list` (from catalog/lpm-tools.snapshot.json) and `tools/call`
// (answered from the flow's recorded fixtures). Every tools/call is appended to a JSONL log.
// No network call leaves the machine, no LPM AI budget is spent, no secret is read.
//
// Flow files: evals/trace/<flow>.json — see scripts/lib/API.md "Trace eval".

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { compareStrings, listDir, readJson, sortKeysDeep } from "./fs.mjs";
import { loadModel } from "./model.mjs";

export const FLOW_DIR = "evals/trace";
export const SERVER_NAME = "LPM";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const FLOW_ID = /^[a-z0-9][a-z0-9-]*$/;

class TraceUsageError extends Error {}

// ---------------------------------------------------------------------------
// Matchers: a call spec is "tool" (glob `*` allowed), {tool, args}, {anyOf: [spec]} or {unordered: [spec]}.

function globRegex(glob) {
  const escaped = String(glob).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9_]*");
  return new RegExp(`^${escaped}$`);
}

/** Match operators usable anywhere inside `args` (an object whose only key is one of these). */
export const MATCH_OPERATORS = ["$absent", "$present", "$contains", "$anyOf", "$not"];

function matchOperator(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const keys = Object.keys(v);
  return keys.length === 1 && MATCH_OPERATORS.includes(keys[0]) ? keys[0] : null;
}

const isBlank = (v) => v === undefined || v === null;

/**
 * True when every key of `expected` is present in `actual` with an equal value (objects recurse; arrays and
 * scalars compare exactly). Operators: `{"$absent": true}` (key missing or null), `{"$present": true}`,
 * `{"$contains": [partial, …]}` (an array where each partial matches some element), `{"$anyOf": [value, …]}`,
 * `{"$not": value}`.
 */
export function partialMatch(expected, actual) {
  const op = matchOperator(expected);
  if (op === "$absent") return isBlank(actual) === Boolean(expected.$absent);
  if (op === "$present") return !isBlank(actual) === Boolean(expected.$present);
  if (op === "$contains") {
    const want = Array.isArray(expected.$contains) ? expected.$contains : [expected.$contains];
    return Array.isArray(actual) && want.every((w) => actual.some((a) => partialMatch(w, a)));
  }
  if (op === "$anyOf") return (Array.isArray(expected.$anyOf) ? expected.$anyOf : []).some((w) => partialMatch(w, actual));
  if (op === "$not") return !partialMatch(expected.$not, actual);
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    return Object.keys(expected).every((k) => partialMatch(expected[k], actual[k]));
  }
  return JSON.stringify(sortKeysDeep(expected)) === JSON.stringify(sortKeysDeep(actual));
}

/** Human label of a call spec. */
export function specLabel(spec) {
  if (typeof spec === "string") return spec;
  if (spec && Array.isArray(spec.anyOf)) return `anyOf(${spec.anyOf.map(specLabel).join(" | ")})`;
  if (spec && Array.isArray(spec.unordered)) return `unordered(${spec.unordered.map(specLabel).join(", ")})`;
  if (spec && spec.tool) return spec.args ? `${spec.tool}(${JSON.stringify(sortKeysDeep(spec.args))})` : spec.tool;
  return JSON.stringify(spec);
}

/** True when the call `{tool, arguments}` matches a single-call spec (string, {tool,args} or {anyOf}). */
export function callMatches(spec, call) {
  if (typeof spec === "string") return globRegex(spec).test(call.tool);
  if (!spec || typeof spec !== "object") return false;
  if (Array.isArray(spec.anyOf)) return spec.anyOf.some((s) => callMatches(s, call));
  if (typeof spec.tool !== "string") return false;
  if (!globRegex(spec.tool).test(call.tool)) return false;
  return spec.args === undefined || partialMatch(spec.args, call.arguments || {});
}

/** Tool names (or globs) named by a spec, flattened. */
export function specTools(spec) {
  if (typeof spec === "string") return [spec];
  if (!spec || typeof spec !== "object") return [];
  if (Array.isArray(spec.anyOf)) return spec.anyOf.flatMap(specTools);
  if (Array.isArray(spec.unordered)) return spec.unordered.flatMap(specTools);
  return typeof spec.tool === "string" ? [spec.tool] : [];
}

// ---------------------------------------------------------------------------
// Catalog context

/**
 * Loads what the trace eval needs from the repository: snapshot tools, the rendered [O] set and card purposes.
 * Returns { tools: Map<name, snapshotTool>, ownerOnly: Set<name>, purposes: Map<name, string>, warnings[] }.
 */
export function loadTraceCatalog(root) {
  const warnings = [];
  const snap = readJson(path.join(root, "catalog", "lpm-tools.snapshot.json"));
  if (snap.missing) throw new Error("catalog/lpm-tools.snapshot.json is missing");
  if (snap.error) throw new Error(`catalog/lpm-tools.snapshot.json: ${snap.error}`);
  const list = Array.isArray(snap.value?.tools) ? snap.value.tools : [];
  const tools = new Map([...list].sort((a, b) => compareStrings(a.name, b.name)).map((t) => [t.name, t]));
  const ownerOnly = new Set();
  const purposes = new Map();
  try {
    const model = loadModel(root);
    for (const info of Object.values(model.tools)) {
      if (!tools.has(info.name)) continue;
      if (info.authority === "O") ownerOnly.add(info.name);
      if (info.card && info.card.purpose) purposes.set(info.name, String(info.card.purpose));
    }
  } catch (err) {
    warnings.push(`model not loaded (rendered authority unknown): ${err.message}`);
  }
  return { tools, ownerOnly, purposes, warnings };
}

function jsonSchemaType(type) {
  if (typeof type !== "string" || !type || type === "unknown") return {};
  const parts = type.split("|").map((s) => s.trim()).filter(Boolean);
  return { type: parts.length === 1 ? parts[0] : parts };
}

/** MCP tool definitions for tools/list, sorted by name. */
export function toolDefinitions(catalog) {
  return [...catalog.tools.values()].map((t) => {
    const properties = {};
    for (const p of Object.keys(t.params || {}).sort(compareStrings)) properties[p] = jsonSchemaType(t.params[p]);
    const inputSchema = { type: "object", properties };
    if (Array.isArray(t.required) && t.required.length) inputSchema.required = [...t.required].sort(compareStrings);
    const description = catalog.purposes.get(t.name) || t.description || `LPM ${t.category || ""} ${t.accessLevel || ""} tool.`.replace(/\s+/g, " ");
    return {
      name: t.name,
      description,
      inputSchema,
      annotations: { readOnlyHint: t.accessLevel === "read" },
    };
  });
}

// ---------------------------------------------------------------------------
// Flows

/** Sorted flow ids under evals/trace/. */
export function listFlows(root) {
  return listDir(path.join(root, FLOW_DIR))
    .filter((f) => f.endsWith(".json") && FLOW_ID.test(f.slice(0, -5)))
    .map((f) => f.slice(0, -5));
}

/** Reads evals/trace/<id>.json. Throws TraceUsageError for a bad or unknown id, Error for invalid JSON. */
export function loadFlow(root, id) {
  if (typeof id !== "string" || !FLOW_ID.test(id)) throw new TraceUsageError(`invalid flow name: ${String(id)}`);
  const file = path.join(root, FLOW_DIR, `${id}.json`);
  const res = readJson(file);
  if (res.missing) {
    const known = listFlows(root);
    throw new TraceUsageError(`unknown flow: ${id}${known.length ? ` (known: ${known.join(", ")})` : ""}`);
  }
  if (res.error) throw new Error(`${FLOW_DIR}/${id}.json: ${res.error}`);
  return { ...res.value, id: res.value?.id ?? id, file: `${FLOW_DIR}/${id}.json` };
}

/** Normalized expect block (missing arrays become []). */
export function flowExpect(flow) {
  const e = (flow && flow.expect) || {};
  return {
    orderedCalls: Array.isArray(e.orderedCalls) ? e.orderedCalls : [],
    forbiddenCalls: Array.isArray(e.forbiddenCalls) ? e.forbiddenCalls : [],
    requiresVerify: Array.isArray(e.requiresVerify) ? e.requiresVerify : [],
    ownerOnlyTools: Array.isArray(e.ownerOnlyTools) ? e.ownerOnlyTools : [],
    maxCalls: e.maxCalls && typeof e.maxCalls === "object" ? e.maxCalls : {},
    answer: {
      mustInclude: Array.isArray(e.answer?.mustInclude) ? e.answer.mustInclude : [],
      mustNotInclude: Array.isArray(e.answer?.mustNotInclude) ? e.answer.mustNotInclude : [],
    },
  };
}

function hasOwnerInstruction(flow) {
  return typeof flow.ownerInstruction === "string" && flow.ownerInstruction.trim().length > 0;
}

/** Errors in one fixture's `$when` entries (each needs `after` and/or `args`, plus `response`). */
function fixtureErrors(tool, value, known, depth = 0) {
  const errors = [];
  if (depth > 8 || !value || typeof value !== "object" || Array.isArray(value) || !("$when" in value || "$default" in value)) return errors;
  if (value.$when !== undefined && !Array.isArray(value.$when)) return [`fixture ${tool}: $when must be an array`];
  for (const [i, w] of (value.$when || []).entries()) {
    if (!w || typeof w !== "object" || (w.after === undefined && w.args === undefined) || !("response" in w)) {
      errors.push(`fixture ${tool}: $when[${i}] needs "after" and/or "args", and "response"`);
      continue;
    }
    if (w.args !== undefined && (!w.args || typeof w.args !== "object" || Array.isArray(w.args))) errors.push(`fixture ${tool}: $when[${i}].args must be an object`);
    for (const t of w.after === undefined ? [] : specTools(w.after)) if (!t.includes("*") && !known(t)) errors.push(`fixture ${tool}: $when[${i}].after names unknown tool ${t}`);
    errors.push(...fixtureErrors(tool, w.response, known, depth + 1));
  }
  if ("$default" in value) errors.push(...fixtureErrors(tool, value.$default, known, depth + 1));
  return errors;
}

/** Validates a flow definition against the catalog. Returns a list of error strings ([] = valid). */
export function validateFlow(flow, catalog, expectedId = null) {
  const errors = [];
  const known = (name) => catalog.tools.has(name);
  if (!flow || typeof flow !== "object") return ["flow is not a JSON object"];
  if (expectedId && flow.id !== expectedId) errors.push(`id "${flow.id}" differs from the file name "${expectedId}"`);
  if (typeof flow.request !== "string" || !flow.request.trim()) errors.push("request must be a non-empty string");
  if (!(flow.ownerInstruction === null || flow.ownerInstruction === undefined || hasOwnerInstruction(flow)))
    errors.push("ownerInstruction must be null or a non-empty string");
  const fixtures = flow.fixtures;
  if (!fixtures || typeof fixtures !== "object" || Array.isArray(fixtures)) errors.push("fixtures must be an object {tool: response}");
  else
    for (const t of Object.keys(fixtures)) {
      if (!known(t)) errors.push(`fixture for unknown tool ${t}`);
      errors.push(...fixtureErrors(t, fixtures[t], known));
    }
  if (flow.requireArgs !== undefined) {
    if (Array.isArray(flow.requireArgs)) for (const t of flow.requireArgs) { if (!known(t)) errors.push(`requireArgs: unknown tool ${t}`); }
    else if (typeof flow.requireArgs !== "boolean") errors.push("requireArgs must be a boolean or a list of tool names");
  }
  if (!flow.expect || typeof flow.expect !== "object") {
    errors.push("expect must be an object");
    return errors;
  }
  const e = flowExpect(flow);
  for (const key of ["orderedCalls", "forbiddenCalls", "requiresVerify", "ownerOnlyTools"])
    if (flow.expect[key] !== undefined && !Array.isArray(flow.expect[key])) errors.push(`expect.${key} must be an array`);
  if (!e.orderedCalls.length && !e.forbiddenCalls.length) errors.push("expect needs orderedCalls or forbiddenCalls");

  const orderedTools = e.orderedCalls.flatMap(specTools);
  for (const t of orderedTools) {
    if (t.includes("*")) errors.push(`orderedCalls: globs are not allowed (${t})`);
    else if (!known(t)) errors.push(`orderedCalls: unknown tool ${t}`);
    else if (!fixtures || !Object.prototype.hasOwnProperty.call(fixtures, t)) errors.push(`orderedCalls: no fixture for ${t}`);
  }
  for (const spec of e.forbiddenCalls) {
    for (const t of specTools(spec)) {
      if (![...catalog.tools.keys()].some((name) => globRegex(t).test(name))) errors.push(`forbiddenCalls: ${t} matches no catalog tool`);
    }
    if (typeof spec === "string") {
      for (const t of orderedTools) if (globRegex(spec).test(t)) errors.push(`${t} is both ordered and forbidden (${spec})`);
    }
  }
  for (const v of e.requiresVerify) {
    if (!v || typeof v !== "object" || v.after === undefined || v.read === undefined) {
      errors.push("requiresVerify entries are {after, read}");
      continue;
    }
    for (const t of [...specTools(v.after), ...specTools(v.read)]) if (!known(t)) errors.push(`requiresVerify: unknown tool ${t}`);
  }
  for (const t of e.ownerOnlyTools) {
    if (!known(t)) errors.push(`ownerOnlyTools: unknown tool ${t}`);
    else if (catalog.ownerOnly.size && !catalog.ownerOnly.has(t)) errors.push(`ownerOnlyTools: ${t} is not [O] in the catalog`);
  }
  if (flow.expect.answer !== undefined) {
    const a = flow.expect.answer;
    if (!a || typeof a !== "object" || Array.isArray(a)) errors.push("expect.answer must be {mustInclude?, mustNotInclude?}");
    else
      for (const k of ["mustInclude", "mustNotInclude"])
        if (a[k] !== undefined && (!Array.isArray(a[k]) || a[k].some((x) => typeof x !== "string" || !x.trim()))) errors.push(`expect.answer.${k} must be an array of non-empty strings`);
  }
  for (const t of Object.keys(e.maxCalls)) {
    if (!known(t)) errors.push(`maxCalls: unknown tool ${t}`);
    if (!Number.isInteger(e.maxCalls[t]) || e.maxCalls[t] < 0) errors.push(`maxCalls.${t} must be a non-negative integer`);
  }
  const owner = new Set([...e.ownerOnlyTools, ...catalog.ownerOnly]);
  for (const t of new Set(orderedTools)) {
    if (!owner.has(t)) continue;
    if (!e.ownerOnlyTools.includes(t)) errors.push(`orderedCalls: [O] tool ${t} must be listed in ownerOnlyTools`);
    if (!hasOwnerInstruction(flow)) errors.push(`orderedCalls: [O] tool ${t} needs an ownerInstruction`);
  }
  return errors;
}

/** Default scratch directory named by `{{scratch}}` when no log file is known. */
export function defaultScratchDir() {
  return path.join(os.tmpdir(), "agents-skills-trace");
}

/**
 * The prompt given to the agent under test: the request plus the owner's instruction, when there is one.
 * `{{scratch}}` becomes the run's scratch directory (the log file's directory) and `{{run}}` the log file's
 * base name without extension, so a flow can point any local file the skill writes (a state file) away from
 * the user's real paths. `ctx = { logFile }`.
 */
export function flowPrompt(flow, ctx = {}) {
  const scratch = ctx.logFile ? path.dirname(path.resolve(ctx.logFile)) : defaultScratchDir();
  const run = ctx.logFile ? path.basename(ctx.logFile).replace(/\.[^.]*$/, "") : `agents-skills-trace-${flow.id}`;
  const fill = (text) => String(text).trim().replace(/\{\{scratch\}\}/g, scratch).replace(/\{\{run\}\}/g, run);
  const lines = [fill(flow.request)];
  if (hasOwnerInstruction(flow)) lines.push("", `Owner instruction (the workspace owner, verbatim): "${fill(flow.ownerInstruction)}"`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Fixtures

const TEMPLATE = /\{\{(call|last\.([a-z0-9_]+))\.args\.([A-Za-z0-9_.]+)\}\}/g;

function pathGet(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

/**
 * Fills response templates: `{{call.args.<path>}}` (this call's argument) and `{{last.<tool>.args.<path>}}`
 * (the argument of the most recent earlier call to <tool>). A string that is exactly one template takes the
 * raw value (null when absent); a template inside a longer string is interpolated ("" when absent).
 */
export function fillTemplates(value, call, previousCalls) {
  const lookup = (who, tool, p) => {
    const src = who === "call" ? call : [...previousCalls].reverse().find((c) => c.tool === tool);
    return src ? pathGet(src.arguments || {}, p) : undefined;
  };
  if (typeof value === "string") {
    const whole = /^\{\{(call|last\.([a-z0-9_]+))\.args\.([A-Za-z0-9_.]+)\}\}$/.exec(value);
    if (whole) {
      const v = lookup(whole[1], whole[2], whole[3]);
      return v === undefined ? null : v;
    }
    return value.replace(TEMPLATE, (_, who, tool, p) => {
      const v = lookup(who, tool, p);
      return v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => fillTemplates(v, call, previousCalls));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillTemplates(v, call, previousCalls)]));
  return value;
}

/**
 * Resolves the fixture response for a call. A fixture is a JSON value (object → JSON text, string → text),
 * `{"$error": "text"}` (an isError result), or `{"$when": [{after?: spec, args?: partial, response}], "$default": response}`:
 * the first `$when` entry wins whose `after` call already happened in this session (when given) and whose
 * `args` partially match this call's arguments (when given; match operators allowed). Responses may hold
 * templates (see fillTemplates).
 */
export function resolveFixture(fixtures, call, previousCalls) {
  if (!fixtures || !Object.prototype.hasOwnProperty.call(fixtures, call.tool)) return { found: false };
  let value = fixtures[call.tool];
  for (let depth = 0; depth < 8 && value && typeof value === "object" && !Array.isArray(value) && ("$when" in value || "$default" in value); depth++) {
    const hit = (Array.isArray(value.$when) ? value.$when : []).find(
      (w) =>
        w &&
        (w.after !== undefined || w.args !== undefined) &&
        (w.after === undefined || previousCalls.some((c) => callMatches(w.after, c))) &&
        (w.args === undefined || partialMatch(w.args, call.arguments || {})),
    );
    value = hit ? hit.response : value.$default;
  }
  value = fillTemplates(value, call, previousCalls);
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.$error === "string") {
    return { found: true, isError: true, text: value.$error };
  }
  return { found: true, isError: false, text: typeof value === "string" ? value : JSON.stringify(value === undefined ? null : value, null, 2) };
}

// ---------------------------------------------------------------------------
// Fake MCP server (Streamable HTTP, JSON responses)

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } };
}

/**
 * `flow.requireArgs`: `true` (every tool) or a list of tool names whose LPM handler rejects a call without its
 * snapshot-required arguments. Returns the first required argument that is missing, null or blank; else null.
 * Use a list when a handler resolves a "required" argument itself (list_comments derives projectId from issueId).
 */
export function missingRequired(flow, tool, args) {
  if (!flow || !tool || !Array.isArray(tool.required)) return null;
  const on = flow.requireArgs === true || (Array.isArray(flow.requireArgs) && flow.requireArgs.includes(tool.name));
  if (!on) return null;
  return tool.required.find((k) => isBlank(args[k]) || (typeof args[k] === "string" && !args[k].trim())) || null;
}

/**
 * Starts the fake LPM MCP server for one flow.
 * Returns Promise<{ url, port, logFile, calls, close() }>. The log file is truncated at start.
 */
export function startTraceServer({ flow, catalog, logFile, port = 0, host = "127.0.0.1" }) {
  const definitions = toolDefinitions(catalog);
  const calls = [];
  let seq = 0;
  let sessions = 0;
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, "");
  const append = (entry) => fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");

  function handle(msg, res) {
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return rpcError(msg && msg.id, -32600, "Invalid Request");
    }
    const { id, method } = msg;
    const params = msg.params || {};
    const isNotification = id === undefined;
    switch (method) {
      case "initialize": {
        const requested = params.protocolVersion;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : DEFAULT_PROTOCOL_VERSION;
        sessions += 1;
        res.setHeader("Mcp-Session-Id", `trace-${flow.id}-${sessions}`);
        append({ seq: ++seq, kind: "initialize", flow: flow.id, clientInfo: params.clientInfo || null, protocolVersion });
        return isNotification
          ? null
          : rpcResult(id, {
              protocolVersion,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: SERVER_NAME, title: `LPM fake server (trace flow ${flow.id})`, version: "trace-1" },
              instructions: "Fake LPM MCP server for the agents-skills E3 step-trace eval. Responses are recorded fixtures.",
            });
      }
      case "ping":
        return isNotification ? null : rpcResult(id, {});
      case "tools/list":
        return isNotification ? null : rpcResult(id, { tools: definitions });
      case "resources/list":
        return isNotification ? null : rpcResult(id, { resources: [] });
      case "resources/templates/list":
        return isNotification ? null : rpcResult(id, { resourceTemplates: [] });
      case "prompts/list":
        return isNotification ? null : rpcResult(id, { prompts: [] });
      case "tools/call": {
        const tool = typeof params.name === "string" ? params.name : "";
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        const call = { tool, arguments: args };
        if (!catalog.tools.has(tool)) {
          append({ seq: ++seq, kind: "call", flow: flow.id, tool, arguments: args, fixture: false, isError: true, unknown: true });
          calls.push(call);
          return isNotification ? null : rpcError(id, -32602, `Unknown tool: ${tool}`);
        }
        const missing = missingRequired(flow, catalog.tools.get(tool), args);
        const fx = missing ? { found: true, isError: true, text: `INVALID_ARGUMENT: field=${missing} problem=missing_required` } : resolveFixture(flow.fixtures, call, calls);
        calls.push(call);
        const text = fx.found ? fx.text : `No recorded fixture for ${tool} in trace flow ${flow.id}. Treat this as a failed call.`;
        const isError = fx.found ? fx.isError : true;
        append({ seq: ++seq, kind: "call", flow: flow.id, tool, arguments: args, fixture: fx.found, isError, ...(missing ? { missingRequired: missing } : {}) });
        if (isNotification) return null;
        const result = { content: [{ type: "text", text }] };
        if (isError) result.isError = true;
        return rpcResult(id, result);
      }
      default:
        if (method.startsWith("notifications/")) return null;
        return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
    }
  }

  const server = http.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    if (pathname !== "/mcp" && pathname !== "/") {
      res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (req.method === "DELETE") {
      res.writeHead(200).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST, DELETE", "Content-Type": "application/json" }).end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify(rpcError(null, -32700, "Parse error")));
        return;
      }
      const batch = Array.isArray(body);
      const replies = (batch ? body : [body]).map((m) => handle(m, res)).filter(Boolean);
      if (!replies.length) {
        res.writeHead(202).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(batch ? replies : replies[0]));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        url: `http://${host}:${actual}/mcp`,
        port: actual,
        logFile,
        calls,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Checker

/** Parses a JSONL call log. Returns { entries, errors }. */
export function parseLog(text) {
  const entries = [];
  const errors = [];
  String(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        const e = JSON.parse(line);
        if (!e || typeof e !== "object" || Array.isArray(e)) throw new Error("not an object");
        entries.push(e);
      } catch (err) {
        errors.push(`line ${i + 1}: ${err.message}`);
      }
    });
  return { entries, errors };
}

function normalizeSpace(s) {
  return String(s).replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Checks a call log against a flow (§5.7 E3). Pure: no I/O.
 * opts: { knownTools?: Set, ownerOnly?: Set (catalog [O] tools), transcript?: string }
 * Returns { ok, calls: [tool], failures: [{ code, message }] }.
 */
export function checkTrace(flow, entries, opts = {}) {
  const e = flowExpect(flow);
  const failures = [];
  const fail = (code, message) => failures.push({ code, message });
  const calls = [];
  let sawSession = false;
  for (const entry of entries) {
    if (entry.flow !== undefined && entry.flow !== flow.id) {
      fail("flow-mismatch", `log entry ${entry.seq ?? "?"} belongs to flow "${entry.flow}", not "${flow.id}"`);
      continue;
    }
    if (entry.kind === "initialize") sawSession = true;
    if ((entry.kind === undefined || entry.kind === "call") && typeof entry.tool === "string") {
      calls.push({ tool: entry.tool, arguments: entry.arguments && typeof entry.arguments === "object" ? entry.arguments : {} });
    }
  }
  if (!sawSession && !calls.length) fail("no-session", "the log has no initialize and no tool call: the agent never reached the fake server");

  // 1. Unknown tools.
  if (opts.knownTools) {
    for (const c of calls) if (!opts.knownTools.has(c.tool)) fail("unknown-tool", `called ${c.tool}, which is not in the LPM catalog`);
  }

  // 2. Call order: orderedCalls must appear as a subsequence; {unordered:[…]} steps match in any order.
  let pos = 0;
  for (let i = 0; i < e.orderedCalls.length; i++) {
    const step = e.orderedCalls[i];
    if (step && typeof step === "object" && Array.isArray(step.unordered)) {
      const used = new Set();
      let end = pos;
      let missing = null;
      for (const member of step.unordered) {
        let hit = -1;
        for (let j = pos; j < calls.length; j++) {
          if (!used.has(j) && callMatches(member, calls[j])) {
            hit = j;
            break;
          }
        }
        if (hit < 0) {
          missing = member;
          break;
        }
        used.add(hit);
        end = Math.max(end, hit + 1);
      }
      if (missing !== null) {
        fail("order", `step ${i + 1} ${specLabel(step)}: no ${specLabel(missing)} after call #${pos}`);
        break;
      }
      pos = end;
      continue;
    }
    let hit = -1;
    for (let j = pos; j < calls.length; j++) {
      if (callMatches(step, calls[j])) {
        hit = j;
        break;
      }
    }
    if (hit < 0) {
      const sameTool = calls.slice(pos).some((c) => specTools(step).some((t) => globRegex(t).test(c.tool)));
      fail("order", `step ${i + 1} ${specLabel(step)}: ${sameTool ? "called, but not with the expected arguments" : "not called"} after call #${pos}`);
      break;
    }
    pos = hit + 1;
  }

  // 3. Forbidden calls.
  calls.forEach((c, j) => {
    for (const spec of e.forbiddenCalls) {
      if (callMatches(spec, c)) fail("forbidden", `call #${j + 1} ${c.tool} matches forbidden ${specLabel(spec)}`);
    }
  });

  // 4. Owner-only tools: never without an owner instruction; with one, only the tools the flow authorizes.
  const owner = hasOwnerInstruction(flow);
  const ownerOnly = new Set([...e.ownerOnlyTools, ...(opts.ownerOnly || [])]);
  const authorized = new Set(owner ? e.ownerOnlyTools : []);
  let ownerCalled = false;
  calls.forEach((c, j) => {
    if (!ownerOnly.has(c.tool)) return;
    ownerCalled = true;
    if (!owner) fail("owner-only", `call #${j + 1} ${c.tool} is [O] and the flow has no owner instruction`);
    else if (!authorized.has(c.tool)) fail("owner-only", `call #${j + 1} ${c.tool} is [O] and the owner instruction does not cover it`);
  });
  if (owner && ownerCalled && typeof opts.transcript === "string" && !normalizeSpace(opts.transcript).includes(normalizeSpace(flow.ownerInstruction))) {
    fail("transcript", "an [O] tool was called but the owner instruction does not appear in the transcript");
  }

  // 5. Call caps (non-idempotent or once-only writes).
  for (const [tool, max] of Object.entries(e.maxCalls)) {
    const n = calls.filter((c) => c.tool === tool).length;
    if (n > max) fail("max-calls", `${tool} called ${n} times (max ${max})`);
  }

  // 6. Verify read-back: after the LAST matching write, the read must run.
  for (const v of e.requiresVerify) {
    let last = -1;
    calls.forEach((c, j) => {
      if (callMatches(v.after, c)) last = j;
    });
    if (last < 0) {
      fail("verify", `verify of ${specLabel(v.after)}: the write never ran`);
      continue;
    }
    if (!calls.slice(last + 1).some((c) => callMatches(v.read, c))) {
      fail("verify", `no ${specLabel(v.read)} read-back after ${specLabel(v.after)} (call #${last + 1})`);
    }
  }

  // 7. Final answer (only with opts.answer): required and forbidden text, case- and space-insensitive.
  if (typeof opts.answer === "string") {
    const text = normalizeSpace(opts.answer);
    for (const s of e.answer.mustInclude) if (!text.includes(normalizeSpace(s))) fail("answer", `the final answer does not contain "${s}"`);
    for (const s of e.answer.mustNotInclude) if (text.includes(normalizeSpace(s))) fail("answer", `the final answer contains forbidden text "${s}"`);
  }

  return { ok: failures.length === 0, calls: calls.map((c) => c.tool), failures };
}

/** Example arguments for a spec's `args` (operators resolved: $absent dropped, $contains/$anyOf → first). */
export function exampleArgs(expected) {
  const op = matchOperator(expected);
  if (op === "$absent") return undefined;
  if (op === "$present") return "x";
  if (op === "$contains") return (Array.isArray(expected.$contains) ? expected.$contains : [expected.$contains]).map(exampleArgs);
  if (op === "$anyOf") return exampleArgs(expected.$anyOf[0]);
  if (op === "$not") return undefined;
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const out = {};
    for (const [k, v] of Object.entries(expected)) {
      const x = exampleArgs(v);
      if (x !== undefined) out[k] = x;
    }
    return out;
  }
  return expected;
}

/** A log that follows the flow exactly (used by self-tests): initialize + every ordered call with its expected args. */
export function synthesizeLog(flow) {
  const entries = [{ seq: 1, kind: "initialize", flow: flow.id }];
  const push = (spec) => {
    if (typeof spec === "string") entries.push({ seq: entries.length + 1, kind: "call", flow: flow.id, tool: spec, arguments: {} });
    else if (Array.isArray(spec.anyOf)) push(spec.anyOf[0]);
    else if (Array.isArray(spec.unordered)) spec.unordered.forEach(push);
    else entries.push({ seq: entries.length + 1, kind: "call", flow: flow.id, tool: spec.tool, arguments: exampleArgs(spec.args || {}) || {} });
  };
  flowExpect(flow).orderedCalls.forEach(push);
  return entries;
}

// ---------------------------------------------------------------------------
// Command

function defaultLogFile(flowId) {
  return path.join(os.tmpdir(), `agents-skills-trace-${flowId}.jsonl`);
}

function waitForStop() {
  return new Promise((resolve) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

/** `eval --trace <flow>` (see the header). Returns an exit code: 0 pass, 1 failure, 2 usage. */
export async function evalTrace(opts) {
  const { root, flags = {}, log } = opts;
  const flowArg = opts.flow ?? flags.trace;
  const json = flags.json === true;
  try {
    if (typeof flowArg !== "string" || !flowArg) throw new TraceUsageError("eval --trace needs a flow name (or `all`)");
    for (const f of ["log", "port", "transcript", "answer"]) {
      if (flags[f] === true) throw new TraceUsageError(`--${f} needs a value`);
    }
    const catalog = loadTraceCatalog(root);
    catalog.warnings.forEach((w) => log.warn(`warning: ${w}`));

    if (flowArg === "all") {
      if (flags.serve || flags.log) throw new TraceUsageError("--serve and --log take one flow, not `all`");
      const ids = listFlows(root);
      if (!ids.length) throw new Error(`no flows under ${FLOW_DIR}/`);
      const results = ids.map((id) => {
        let errors;
        try {
          errors = validateFlow(loadFlow(root, id), catalog, id);
        } catch (err) {
          errors = [err.message];
        }
        return { flow: id, ok: errors.length === 0, errors };
      });
      if (json) log.info(JSON.stringify({ ok: results.every((r) => r.ok), flows: results }, null, 2));
      else for (const r of results) log.info(`${r.ok ? "ok  " : "FAIL"} ${r.flow}${r.errors.map((x) => `\n  - ${x}`).join("")}`);
      return results.every((r) => r.ok) ? 0 : 1;
    }

    const flow = loadFlow(root, flowArg);
    const errors = validateFlow(flow, catalog, flowArg);
    if (errors.length) {
      log.error(`flow ${flowArg} is invalid:\n${errors.map((x) => `  - ${x}`).join("\n")}`);
      return 1;
    }

    if (flags.serve) {
      let port = 0;
      if (flags.port !== undefined) {
        port = Number(flags.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TraceUsageError(`--port must be 0-65535, got ${flags.port}`);
      }
      const logFile = path.resolve(flags.log ? String(flags.log) : defaultLogFile(flow.id));
      const server = await startTraceServer({ flow, catalog, logFile, port });
      log.info(`trace server: flow ${flow.id}${flow.skill ? ` (skill ${flow.skill})` : ""}`);
      log.info(`url: ${server.url}`);
      log.info(`log: ${logFile}`);
      log.info(`Point the agent's "${SERVER_NAME}" MCP server at the url (streamable HTTP, no auth), then give it this prompt:`);
      log.info("----- prompt -----");
      log.info(flowPrompt(flow, { logFile }));
      log.info("------------------");
      log.info(`Stop with Ctrl+C, then: node scripts/skills.mjs eval --trace ${flow.id} --log ${logFile}`);
      await (opts.stopSignal || waitForStop());
      await server.close();
      log.info(`trace server stopped: ${server.calls.length} tool calls logged`);
      return 0;
    }

    if (flags.log) {
      const file = path.resolve(String(flags.log));
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        throw new Error(`cannot read log ${file}`);
      }
      const { entries, errors: parseErrors } = parseLog(text);
      let transcript;
      if (flags.transcript) {
        try {
          transcript = fs.readFileSync(path.resolve(String(flags.transcript)), "utf8");
        } catch {
          throw new Error(`cannot read transcript ${flags.transcript}`);
        }
      }
      let answer;
      if (flags.answer) {
        try {
          answer = fs.readFileSync(path.resolve(String(flags.answer)), "utf8");
        } catch {
          throw new Error(`cannot read answer ${flags.answer}`);
        }
      }
      const result = checkTrace(flow, entries, { knownTools: new Set(catalog.tools.keys()), ownerOnly: catalog.ownerOnly, transcript, answer });
      const answerChecks = flowExpect(flow).answer;
      if (answer === undefined && (answerChecks.mustInclude.length || answerChecks.mustNotInclude.length)) {
        log.warn(`note: flow ${flow.id} has expect.answer checks; pass --answer <file> (the agent's final answer) to run them`);
      }
      for (const pe of parseErrors) result.failures.unshift({ code: "invalid-log", message: pe });
      result.ok = result.failures.length === 0;
      if (json) {
        log.info(JSON.stringify({ flow: flow.id, skill: flow.skill || null, ok: result.ok, calls: result.calls, failures: result.failures }, null, 2));
      } else {
        log.info(`trace ${flow.id}: ${result.ok ? "PASS" : "FAIL"} (${result.calls.length} tool calls)`);
        for (const f of result.failures) log.info(`  - [${f.code}] ${f.message}`);
      }
      return result.ok ? 0 : 1;
    }

    // No --serve and no --log: the flow is valid; show how to run it.
    if (json) log.info(JSON.stringify({ flow: flow.id, skill: flow.skill || null, ok: true, prompt: flowPrompt(flow) }, null, 2));
    else {
      log.info(`flow ${flow.id} is valid${flow.skill ? ` (skill ${flow.skill})` : ""}. Prompt:`);
      log.info(flowPrompt(flow));
      log.info(`Run: node scripts/skills.mjs eval --trace ${flow.id} --serve [--port N] [--log file]`);
    }
    return 0;
  } catch (err) {
    if (err instanceof TraceUsageError) {
      log.error(`error: ${err.message}`);
      return 2;
    }
    throw err;
  }
}
