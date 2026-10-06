// E3 step-trace (§5.7): fake MCP server over HTTP, flow validation, checker pass/fail per violation, shipped flows.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { SCRIPTS, tempDir } from "./helpers.mjs";
import {
  checkTrace,
  evalTrace,
  exampleArgs,
  fillTemplates,
  flowPrompt,
  listFlows,
  loadFlow,
  loadTraceCatalog,
  missingRequired,
  parseLog,
  partialMatch,
  resolveFixture,
  startTraceServer,
  synthesizeLog,
  validateFlow,
} from "../lib/trace.mjs";

const REPO = path.resolve(SCRIPTS, "..");
const CLI = path.join(SCRIPTS, "skills.mjs");
const silent = { info() {}, warn() {}, error() {} };

const SNAPSHOT = {
  schemaVersion: 1,
  tools: [
    { name: "get_thing", category: "portfolio", accessLevel: "read", sensitive: false, oauthScope: "portfolio:read", profiles: ["full"], required: ["thingId"], params: { thingId: "string" } },
    { name: "update_thing", category: "portfolio", accessLevel: "write", sensitive: false, oauthScope: null, profiles: ["full"], required: ["thingId"], params: { status: "string|null", thingId: "string" } },
    { name: "owner_thing", category: "portfolio", accessLevel: "write", sensitive: true, oauthScope: null, profiles: ["full"], required: ["thingId"], params: { thingId: "string" } },
    { name: "other_owner_thing", category: "portfolio", accessLevel: "write", sensitive: true, oauthScope: null, profiles: ["full"], required: [], params: {} },
    { name: "delete_thing", category: "portfolio", accessLevel: "write", sensitive: true, oauthScope: null, profiles: ["full"], required: ["thingId"], params: { thingId: "string" } },
    { name: "answer_thing_question", category: "ai", accessLevel: "read", sensitive: false, oauthScope: null, profiles: ["full"], required: [], params: { question: "unknown" } },
  ],
};

const FLOW = {
  id: "demo",
  title: "Demo flow",
  skill: "lpm-demo",
  request: "Close thing t1.",
  ownerInstruction: "Owner: run owner_thing on t1.",
  fixtures: {
    get_thing: {
      $when: [{ after: { tool: "update_thing", args: { status: "done" } }, response: { id: "t1", status: "done" } }],
      $default: { id: "t1", status: "open" },
    },
    update_thing: "Thing t1 updated.",
    owner_thing: { ok: true },
    delete_thing: { $error: "Thing is locked" },
  },
  expect: {
    orderedCalls: ["get_thing", { tool: "update_thing", args: { thingId: "t1", status: "done" } }, "owner_thing", "get_thing"],
    forbiddenCalls: ["delete_*", "answer_*"],
    requiresVerify: [{ after: "update_thing", read: "get_thing" }],
    ownerOnlyTools: ["owner_thing"],
    maxCalls: { owner_thing: 1 },
  },
};

/** A temporary repo with the small snapshot and the demo flow. */
function demoRoot(flow = FLOW) {
  const root = tempDir("trace");
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  fs.writeFileSync(path.join(root, "catalog", "lpm-tools.snapshot.json"), JSON.stringify(SNAPSHOT));
  fs.mkdirSync(path.join(root, "evals", "trace"), { recursive: true });
  fs.writeFileSync(path.join(root, "evals", "trace", `${flow.id}.json`), JSON.stringify(flow, null, 2));
  return root;
}

const call = (tool, args = {}) => ({ kind: "call", flow: "demo", tool, arguments: args });
const INIT = { kind: "initialize", flow: "demo" };
const GOOD = [INIT, call("get_thing", { thingId: "t1" }), call("update_thing", { thingId: "t1", status: "done" }), call("owner_thing", { thingId: "t1" }), call("get_thing", { thingId: "t1" })];
const codes = (result) => result.failures.map((f) => f.code);

async function rpc(url, body, headers = {}) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

test("fake server answers initialize, tools/list and tools/call over HTTP and logs every call", async () => {
  const root = demoRoot();
  const catalog = loadTraceCatalog(root);
  const flow = loadFlow(root, "demo");
  const logFile = path.join(tempDir("trace-log"), "nested", "demo.jsonl");
  const server = await startTraceServer({ flow, catalog, logFile });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);

    const init = await rpc(server.url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
    assert.equal(init.status, 200);
    assert.equal(init.body.result.protocolVersion, "2025-03-26");
    assert.equal(init.body.result.serverInfo.name, "LPM");
    assert.ok(init.body.result.capabilities.tools);
    assert.equal(init.headers.get("mcp-session-id"), "trace-demo-1");
    const odd = await rpc(server.url, { jsonrpc: "2.0", id: 9, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    assert.equal(odd.body.result.protocolVersion, "2025-06-18");

    const note = await rpc(server.url, { jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(note.status, 202);
    assert.equal(note.body, null);

    const list = await rpc(server.url, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = list.body.result.tools.map((t) => t.name);
    assert.deepEqual(names, [...SNAPSHOT.tools.map((t) => t.name)].sort());
    const upd = list.body.result.tools.find((t) => t.name === "update_thing");
    assert.deepEqual(upd.inputSchema, { type: "object", properties: { status: { type: ["string", "null"] }, thingId: { type: "string" } }, required: ["thingId"] });
    assert.equal(upd.annotations.readOnlyHint, false);
    assert.deepEqual(list.body.result.tools.find((t) => t.name === "answer_thing_question").inputSchema.properties.question, {});

    const tc = (id, name, args) => rpc(server.url, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
    const before = await tc(3, "get_thing", { thingId: "t1" });
    assert.deepEqual(JSON.parse(before.body.result.content[0].text), { id: "t1", status: "open" });
    assert.equal(before.body.result.isError, undefined);
    const text = await tc(4, "update_thing", { thingId: "t1", status: "done" });
    assert.deepEqual(text.body.result.content, [{ type: "text", text: "Thing t1 updated." }]);
    const after = await tc(5, "get_thing", { thingId: "t1" });
    assert.equal(JSON.parse(after.body.result.content[0].text).status, "done", "$when switches after the write");
    const err = await tc(6, "delete_thing", { thingId: "t1" });
    assert.equal(err.body.result.isError, true);
    assert.equal(err.body.result.content[0].text, "Thing is locked");
    const nofx = await tc(7, "other_owner_thing", {});
    assert.equal(nofx.body.result.isError, true);
    assert.match(nofx.body.result.content[0].text, /No recorded fixture for other_owner_thing/);
    const unknown = await tc(8, "no_such_tool", {});
    assert.equal(unknown.body.error.code, -32602);

    const batch = await rpc(server.url, [{ jsonrpc: "2.0", id: 10, method: "ping" }, { jsonrpc: "2.0", method: "notifications/cancelled" }, { jsonrpc: "2.0", id: 11, method: "bogus/method" }]);
    assert.equal(batch.body.length, 2);
    assert.deepEqual(batch.body[0].result, {});
    assert.equal(batch.body[1].error.code, -32601);

    const parse = await rpc(server.url, "{not json");
    assert.equal(parse.status, 400);
    assert.equal(parse.body.error.code, -32700);
    const get = await fetch(server.url);
    assert.equal(get.status, 405);
    await get.text();

    const { entries, errors } = parseLog(fs.readFileSync(logFile, "utf8"));
    assert.deepEqual(errors, []);
    assert.deepEqual(entries.map((e) => e.kind), ["initialize", "initialize", "call", "call", "call", "call", "call", "call"]);
    assert.deepEqual(entries.filter((e) => e.kind === "call").map((e) => e.tool), ["get_thing", "update_thing", "get_thing", "delete_thing", "other_owner_thing", "no_such_tool"]);
    assert.deepEqual(entries[3], { seq: 4, kind: "call", flow: "demo", tool: "update_thing", arguments: { thingId: "t1", status: "done" }, fixture: true, isError: false });
    assert.equal(entries.at(-1).unknown, true);
    assert.equal(server.calls.length, 6);
  } finally {
    await server.close();
  }
});

test("eval --trace --serve runs until SIGTERM; the checker then reads its log (CLI end to end)", async () => {
  const root = demoRoot();
  const logFile = path.join(tempDir("trace-cli"), "demo.jsonl");
  const child = spawn(process.execPath, [CLI, "eval", "--trace", "demo", "--serve", "--port", "0", "--log", logFile, "--root", root], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  // "close" (not "exit") fires only after the child's stdio is drained, so `out` is complete.
  let closed = false;
  const done = new Promise((resolve) => {
    child.on("close", (code, signal) => {
      closed = true;
      resolve({ code, signal });
    });
  });
  // Resolves with `promise`, or rejects after `ms`; the timer is cleared on every path.
  const within = (promise, ms, what) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} (after ${ms}ms)\nstdout:\n${out}\nstderr:\n${err}`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };
  try {
    // Wait for the whole banner: the prompt is printed after the url line, possibly in a later chunk.
    const started = new Promise((resolve, reject) => {
      const onData = () => {
        if (!/Stop with Ctrl\+C/.test(out)) return;
        const m = out.match(/url: (http:\/\/127\.0\.0\.1:\d+\/mcp)/);
        child.stdout.off("data", onData);
        if (m) resolve(m[1]);
        else reject(new Error(`banner has no url:\n${out}`));
      };
      child.stdout.on("data", onData);
      done.then(({ code, signal }) => reject(new Error(`server exited early (code ${code}, signal ${signal})\nstdout:\n${out}\nstderr:\n${err}`)));
    });
    const url = await within(started, 10000, "server did not start");
    assert.match(out, /Owner instruction \(the workspace owner, verbatim\): "Owner: run owner_thing on t1\."/);
    await rpc(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    let id = 2;
    for (const c of GOOD.slice(1)) await rpc(url, { jsonrpc: "2.0", id: id++, method: "tools/call", params: { name: c.tool, arguments: c.arguments } });
    child.kill("SIGTERM");
    const { code } = await within(done, 10000, "server did not stop on SIGTERM");
    assert.equal(code, 0, `stdout:\n${out}\nstderr:\n${err}`);
    assert.match(out, /4 tool calls logged/);
  } finally {
    // Never leave the server running: its open stdout pipe would keep the test runner alive.
    if (!closed) {
      child.kill("SIGKILL");
      await within(done, 5000, "server did not die on SIGKILL").catch(() => {});
    }
    child.stdout.destroy();
    child.stderr.destroy();
  }

  const pass = spawnSync(process.execPath, [CLI, "eval", "--trace", "demo", "--log", logFile, "--json", "--root", root], { encoding: "utf8" });
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  const report = JSON.parse(pass.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.calls, ["get_thing", "update_thing", "owner_thing", "get_thing"]);

  fs.appendFileSync(logFile, "garbage line\n");
  const bad = spawnSync(process.execPath, [CLI, "eval", "--trace", "demo", "--log", logFile, "--root", root], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /FAIL/);
  assert.match(bad.stdout, /\[invalid-log\] line 6/);
});

test("checker passes a correct synthetic log", () => {
  const result = checkTrace(FLOW, GOOD, { knownTools: new Set(SNAPSHOT.tools.map((t) => t.name)), ownerOnly: new Set(["owner_thing", "other_owner_thing"]) });
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
  // Extra reads between steps are allowed.
  const chatty = [INIT, call("get_thing"), call("get_thing"), call("update_thing", { thingId: "t1", status: "done", note: "x" }), call("get_thing"), call("owner_thing"), call("get_thing")];
  assert.equal(checkTrace(FLOW, chatty).ok, true);
});

test("checker fails each violation", () => {
  const opts = { knownTools: new Set(SNAPSHOT.tools.map((t) => t.name)), ownerOnly: new Set(["owner_thing", "other_owner_thing"]) };
  const run = (entries, flow = FLOW, extra = {}) => checkTrace(flow, entries, { ...opts, ...extra });

  // Call order: a missing step, a reversed pair, a call with the wrong arguments.
  const missing = run([INIT, call("get_thing"), call("owner_thing"), call("get_thing")]);
  assert.deepEqual(codes(missing), ["order", "verify"]);
  assert.match(missing.failures[0].message, /step 2 update_thing.*not called/);
  const reversed = run([INIT, call("get_thing"), call("owner_thing"), call("update_thing", { thingId: "t1", status: "done" }), call("get_thing")]);
  assert.deepEqual(codes(reversed), ["order"]);
  const wrongArgs = run([INIT, call("get_thing"), call("update_thing", { thingId: "t1", status: "blocked" }), call("owner_thing"), call("get_thing")]);
  assert.deepEqual(codes(wrongArgs), ["order"]);
  assert.match(wrongArgs.failures[0].message, /not with the expected arguments/);

  // Forbidden calls (globs).
  const forbidden = run([...GOOD, call("delete_thing"), call("answer_thing_question")]);
  assert.deepEqual(codes(forbidden), ["forbidden", "forbidden"]);

  // [O] without an owner instruction; [O] not covered by the instruction.
  const noOwner = run(GOOD, { ...FLOW, ownerInstruction: null });
  assert.deepEqual(codes(noOwner), ["owner-only"]);
  assert.match(noOwner.failures[0].message, /owner_thing is \[O\] and the flow has no owner instruction/);
  const blank = run(GOOD, { ...FLOW, ownerInstruction: "   " });
  assert.deepEqual(codes(blank), ["owner-only"]);
  const notCovered = run([...GOOD, call("other_owner_thing")]);
  assert.deepEqual(codes(notCovered), ["owner-only"]);
  assert.match(notCovered.failures[0].message, /does not cover it/);

  // Verify: the read-back must follow the LAST matching write.
  const noVerify = run([INIT, call("get_thing"), call("update_thing", { thingId: "t1", status: "done" }), call("owner_thing"), call("get_thing"), call("update_thing", { thingId: "t1", status: "done" })]);
  assert.deepEqual(codes(noVerify), ["verify"]);
  assert.match(noVerify.failures[0].message, /no get_thing read-back after update_thing \(call #5\)/);

  // Caps, unknown tools, empty log, foreign flow log, transcript without the owner's words.
  assert.deepEqual(codes(run([...GOOD.slice(0, 4), call("owner_thing"), call("get_thing")])), ["max-calls"]);
  assert.deepEqual(codes(run([...GOOD, call("ghost_tool")])), ["unknown-tool"]);
  assert.deepEqual(codes(run([])), ["no-session", "order", "verify"]);
  assert.deepEqual(codes(run([...GOOD, { kind: "call", flow: "other", tool: "get_thing" }])), ["flow-mismatch"]);
  assert.deepEqual(codes(run(GOOD, FLOW, { transcript: "user: close thing t1" })), ["transcript"]);
  assert.equal(run(GOOD, FLOW, { transcript: "user: Close thing t1.\nOWNER:   run owner_thing\non t1." }).ok, true);
});

test("ordered steps support unordered groups and anyOf alternatives", () => {
  const flow = {
    ...FLOW,
    ownerInstruction: null,
    expect: {
      orderedCalls: [{ unordered: ["get_thing", "answer_thing_question"] }, { anyOf: ["update_thing", "delete_thing"] }],
      forbiddenCalls: [],
      requiresVerify: [],
      ownerOnlyTools: [],
    },
  };
  assert.equal(checkTrace(flow, [INIT, call("answer_thing_question"), call("get_thing"), call("delete_thing")]).ok, true);
  assert.equal(checkTrace(flow, [INIT, call("get_thing"), call("answer_thing_question"), call("update_thing")]).ok, true);
  const r = checkTrace(flow, [INIT, call("get_thing"), call("update_thing"), call("answer_thing_question")]);
  assert.deepEqual(codes(r), ["order"]);
});

test("resolveFixture: plain values, text, $error and $when", () => {
  const fx = FLOW.fixtures;
  assert.deepEqual(resolveFixture(fx, { tool: "missing" }, []), { found: false });
  assert.equal(resolveFixture(fx, { tool: "update_thing" }, []).text, "Thing t1 updated.");
  assert.equal(JSON.parse(resolveFixture(fx, { tool: "get_thing" }, []).text).status, "open");
  assert.equal(JSON.parse(resolveFixture(fx, { tool: "get_thing" }, [{ tool: "update_thing", arguments: { status: "x" } }]).text).status, "open");
  assert.equal(JSON.parse(resolveFixture(fx, { tool: "get_thing" }, [{ tool: "update_thing", arguments: { status: "done" } }]).text).status, "done");
  assert.deepEqual(resolveFixture(fx, { tool: "delete_thing" }, []), { found: true, isError: true, text: "Thing is locked" });
});

test("partialMatch operators: $absent, $present, $contains, $anyOf, $not; exampleArgs resolves them", () => {
  assert.equal(partialMatch({ a: { $absent: true } }, { b: 1 }), true);
  assert.equal(partialMatch({ a: { $absent: true } }, { a: null }), true);
  assert.equal(partialMatch({ a: { $absent: true } }, { a: "x" }), false);
  assert.equal(partialMatch({ a: { $present: true } }, { a: 0 }), true);
  assert.equal(partialMatch({ a: { $present: true } }, {}), false);
  const ops = [{ type: "update_item", itemId: "i1", patch: { title: "T", extra: 1 } }, { type: "create_item", values: { title: "N" } }];
  assert.equal(partialMatch({ ops: { $contains: [{ type: "create_item", values: { title: "N" } }, { type: "update_item", patch: { title: "T" } }] } }, { ops }), true);
  assert.equal(partialMatch({ ops: { $contains: [{ type: "update_item", title: "T" }] } }, { ops }), false, "flat fields do not match patch fields");
  assert.equal(partialMatch({ ops: { $contains: [{ type: "x" }] } }, { ops: "not an array" }), false);
  assert.equal(partialMatch({ q: { $anyOf: ["a", "b"] } }, { q: "b" }), true);
  assert.equal(partialMatch({ q: { $not: { $anyOf: ["a", "b"] } } }, { q: "c" }), true);
  assert.equal(partialMatch({ q: { $not: "c" } }, { q: "c" }), false);
  assert.deepEqual(exampleArgs({ a: 1, b: { $absent: true }, c: { $contains: [{ x: 1 }] }, d: { $anyOf: ["p", "q"] }, e: { $not: "z" } }), { a: 1, c: [{ x: 1 }], d: "p" });
});

test("resolveFixture: $when on the current call's args, and response templates", () => {
  const fx = {
    list_files: { $when: [{ args: { activityId: "act_1" }, response: [{ id: "f1" }] }], $default: { $error: "Activity {{call.args.activityId}} not found" } },
    publish: { $when: [{ args: { changeSetId: { $present: true } }, response: { $error: "Immutable proposal not found" } }], $default: { ok: true } },
    list_comments: { $when: [{ after: "create_comment", response: [{ id: "c1", content: "{{last.create_comment.args.content}}" }] }], $default: [] },
    echo: { reason: "{{call.args.reason}}", missing: "{{call.args.nope}}", text: "r={{call.args.reason}}; n={{call.args.n}}" },
  };
  assert.deepEqual(JSON.parse(resolveFixture(fx, { tool: "list_files", arguments: { activityId: "act_1" } }, []).text), [{ id: "f1" }]);
  assert.deepEqual(resolveFixture(fx, { tool: "list_files", arguments: { activityId: "iss_1" } }, []), { found: true, isError: true, text: "Activity iss_1 not found" });
  assert.equal(resolveFixture(fx, { tool: "publish", arguments: { changeSetId: "cs" } }, []).isError, true);
  assert.equal(resolveFixture(fx, { tool: "publish", arguments: {} }, []).isError, false);
  const prev = [{ tool: "create_comment", arguments: { content: "old" } }, { tool: "create_comment", arguments: { content: "Closure: new" } }];
  assert.equal(JSON.parse(resolveFixture(fx, { tool: "list_comments", arguments: {} }, prev).text)[0].content, "Closure: new");
  assert.deepEqual(JSON.parse(resolveFixture(fx, { tool: "echo", arguments: { reason: "why", n: 2 } }, []).text), { reason: "why", missing: null, text: "r=why; n=2" });
  assert.deepEqual(fillTemplates({ a: ["{{call.args.x.y}}"] }, { arguments: { x: { y: 3 } } }, []), { a: [3] });
});

test("requireArgs rejects a call without snapshot-required arguments; flowPrompt fills {{scratch}} and {{run}}", () => {
  const tool = SNAPSHOT.tools.find((t) => t.name === "update_thing");
  assert.equal(missingRequired({ requireArgs: true }, tool, {}), "thingId");
  assert.equal(missingRequired({ requireArgs: true }, tool, { thingId: "  " }), "thingId");
  assert.equal(missingRequired({ requireArgs: true }, tool, { thingId: "t1" }), null);
  assert.equal(missingRequired({ requireArgs: ["get_thing"] }, tool, {}), null, "only the listed tools");
  assert.equal(missingRequired({}, tool, {}), null, "off by default");
  const flow = { ...FLOW, request: "State file: {{scratch}}/{{run}}.state.json" };
  assert.equal(flowPrompt(flow, { logFile: "/tmp/x/demo-2.jsonl" }).split("\n")[0], "State file: /tmp/x/demo-2.state.json");
  assert.doesNotMatch(flowPrompt(flow), /\{\{/);
});

test("expect.answer: required and forbidden text in the final answer (only with opts.answer)", () => {
  const flow = { ...FLOW, expect: { ...FLOW.expect, answer: { mustInclude: ["LPM_WEBHOOK_SECRET"], mustNotInclude: ["s3cr3t-value"] } } };
  assert.deepEqual(codes(checkTrace(flow, GOOD)), [], "no answer given: skipped");
  assert.deepEqual(codes(checkTrace(flow, GOOD, { answer: "Put a fresh one in LPM_WEBHOOK_SECRET." })), []);
  assert.deepEqual(codes(checkTrace(flow, GOOD, { answer: "export LPM_WEBHOOK_SECRET='S3CR3T-value'" })), ["answer"]);
  assert.deepEqual(codes(checkTrace(flow, GOOD, { answer: "done" })), ["answer"]);
});

test("validateFlow reports bad flow definitions", () => {
  const catalog = { tools: new Map(SNAPSHOT.tools.map((t) => [t.name, t])), ownerOnly: new Set(["owner_thing"]), purposes: new Map() };
  assert.deepEqual(validateFlow(FLOW, catalog, "demo"), []);
  const bad = {
    ...FLOW,
    id: "other",
    request: "",
    ownerInstruction: null,
    fixtures: { ghost: {}, get_thing: { $when: [{ response: 1 }, { after: "nope_tool", response: 2 }], $default: 0 } },
    requireArgs: "yes",
    expect: {
      orderedCalls: ["get_thing", "update_*", "owner_thing", "delete_thing", "nope"],
      forbiddenCalls: ["delete_thing", "zzz_*"],
      requiresVerify: [{ after: "update_thing" }],
      ownerOnlyTools: ["get_thing"],
      maxCalls: { owner_thing: -1 },
    },
  };
  const errors = validateFlow(bad, catalog, "demo").join("\n");
  for (const want of [
    /differs from the file name/,
    /request must be a non-empty string/,
    /fixture for unknown tool ghost/,
    /fixture get_thing: \$when\[0\] needs "after" and\/or "args"/,
    /fixture get_thing: \$when\[1\]\.after names unknown tool nope_tool/,
    /requireArgs must be a boolean or a list of tool names/,
    /globs are not allowed \(update_\*\)/,
    /unknown tool nope/,
    /zzz_\* matches no catalog tool/,
    /delete_thing is both ordered and forbidden/,
    /requiresVerify entries are \{after, read\}/,
    /ownerOnlyTools: get_thing is not \[O\]/,
    /maxCalls.owner_thing must be a non-negative integer/,
    /\[O\] tool owner_thing must be listed in ownerOnlyTools/,
    /\[O\] tool owner_thing needs an ownerInstruction/,
  ]) {
    assert.match(errors, want);
  }
});

test("evalTrace: usage errors exit 2; a flow without --serve/--log is validated and prints its prompt", async () => {
  const root = demoRoot();
  const lines = [];
  const log = { info: (s) => lines.push(s), warn() {}, error: (s) => lines.push(s) };
  assert.equal(await evalTrace({ root, flags: { trace: "nope" }, log }), 2);
  assert.match(lines.join("\n"), /unknown flow: nope \(known: demo\)/);
  assert.equal(await evalTrace({ root, flags: { trace: "../x" }, log: silent }), 2);
  assert.equal(await evalTrace({ root, flags: { trace: true }, log: silent }), 2);
  assert.equal(await evalTrace({ root, flags: { trace: "all", serve: true }, log: silent }), 2);
  assert.equal(await evalTrace({ root, flags: { trace: "demo", log: true }, log: silent }), 2);
  assert.equal(await evalTrace({ root, flags: { trace: "demo", serve: true, port: "99999" }, log: silent }), 2);
  lines.length = 0;
  assert.equal(await evalTrace({ root, flags: { trace: "demo" }, log }), 0);
  assert.match(lines.join("\n"), /flow demo is valid/);
  assert.equal(await evalTrace({ root, flags: { trace: "all" }, log: silent }), 0);
  await assert.rejects(evalTrace({ root, flags: { trace: "demo", log: path.join(root, "missing.jsonl") }, log: silent }), /cannot read log/);

  // serve through evalTrace with an injected stop signal
  let stop;
  const stopSignal = new Promise((r) => (stop = r));
  const out = [];
  const logFile = path.join(root, "served.jsonl");
  const done = evalTrace({ root, flags: { trace: "demo", serve: true, log: logFile }, log: { info: (s) => out.push(s), warn() {}, error() {} }, stopSignal });
  while (!out.some((l) => l.startsWith("url: "))) await new Promise((r) => setTimeout(r, 10));
  const url = out.find((l) => l.startsWith("url: ")).slice(5);
  await rpc(url, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_thing", arguments: { thingId: "t1" } } });
  stop();
  assert.equal(await done, 0);
  assert.equal(parseLog(fs.readFileSync(logFile, "utf8")).entries.length, 1);
});

// --- The 13 shipped flows (§5.7 E3) ---------------------------------------------------------

const SHIPPED = [
  "ai-config-update",
  "aish-job-approve",
  "baseline-publish",
  "deliver-close",
  "evidence-attach",
  "index-refresh-activate",
  "intake-routing-approve",
  "owner-roadmap-commit",
  "pilot-duplicate",
  "roadmap-cr-apply",
  "roadmap-item-create-enforce",
  "roadmap-item-create-owner-order",
  "webhook-create",
];

test("the 13 §5.7 flows exist, validate against the catalog and pass their own synthetic log", () => {
  assert.deepEqual(listFlows(REPO), SHIPPED);
  const catalog = loadTraceCatalog(REPO);
  assert.ok(catalog.ownerOnly.size > 0, "rendered [O] tools are known");
  const knownTools = new Set(catalog.tools.keys());
  for (const id of SHIPPED) {
    const flow = loadFlow(REPO, id);
    assert.deepEqual(validateFlow(flow, catalog, id), [], id);
    const result = checkTrace(flow, synthesizeLog(flow), { knownTools, ownerOnly: catalog.ownerOnly });
    assert.deepEqual(result.failures, [], id);
    const owned = flow.expect.ownerOnlyTools.filter((t) => result.calls.includes(t));
    if (owned.length) {
      const noOwner = checkTrace({ ...flow, ownerInstruction: null }, synthesizeLog(flow), { knownTools, ownerOnly: catalog.ownerOnly });
      assert.ok(codes(noOwner).includes("owner-only"), `${id}: [O] call without an owner instruction must fail`);
    }
  }
});

test("shipped flows catch the high-risk mistakes they were written for", () => {
  const catalog = loadTraceCatalog(REPO);
  const opts = { knownTools: new Set(catalog.tools.keys()), ownerOnly: catalog.ownerOnly };
  const check = (id, edit) => {
    const flow = loadFlow(REPO, id);
    return codes(checkTrace(flow, edit(synthesizeLog(flow), flow), opts));
  };
  const c = (flow, tool, args = {}) => ({ kind: "call", flow, tool, arguments: args });

  // enforce mode: creating the item directly (or via changeType create) fails.
  assert.deepEqual(check("roadmap-item-create-enforce", (log) => [...log, c("roadmap-item-create-enforce", "get_workspace")]), []);
  assert.deepEqual(check("roadmap-item-create-enforce", (log) => [...log, c("roadmap-item-create-enforce", "create_workspace_roadmap_item", { title: "Offline mode" })]), ["forbidden", "owner-only"]);
  assert.deepEqual(
    check("roadmap-item-create-enforce", (log) => [...log, c("roadmap-item-create-enforce", "submit_workspace_roadmap_change", { changeType: "create", workspaceId: "ws_trace" })]),
    ["forbidden"],
  );
  // owner-ordered create in enforce mode: sending lifecycle or using changeType create fails.
  assert.ok(check("roadmap-item-create-owner-order", (log) => log.map((e) => (e.tool === "create_workspace_roadmap_item" ? { ...e, arguments: { ...e.arguments, lifecycle: "approved" } } : e))).includes("forbidden"));
  assert.ok(check("roadmap-item-create-owner-order", (log) => [log[0], c("roadmap-item-create-owner-order", "submit_workspace_roadmap_change", { changeType: "create", workspaceId: "ws_trace" }), ...log.slice(1)]).includes("forbidden"));
  // pilot duplicate: a new issue or an AI/code-search call fails.
  assert.deepEqual(check("pilot-duplicate", (log) => [...log, c("pilot-duplicate", "create_issue"), c("pilot-duplicate", "search_project_code"), c("pilot-duplicate", "answer_project_question")]), ["forbidden", "forbidden", "forbidden"]);
  // evidence: the issueId passed as activityId fails.
  assert.ok(check("evidence-attach", (log) => [log[0], c("evidence-attach", "upload_activity_attachment", { activityId: "iss_102" }), ...log.slice(1)]).includes("forbidden"));
  // deliver close: done without the get_issue read-back fails.
  assert.deepEqual(check("deliver-close", (log) => { const i = log.map((e) => e.tool).lastIndexOf("get_issue"); return log.filter((_, j) => j !== i); }), ["order", "verify"]);
  // deliver close: the issueId passed as activityId fails; so does skipping the closure-comment read-back.
  assert.ok(check("deliver-close", (log) => [...log, c("deliver-close", "list_activity_attachments", { activityId: "iss_101" })]).includes("forbidden"));
  assert.deepEqual(check("deliver-close", (log) => log.filter((e) => e.tool !== "list_comments")), ["order", "verify"]);
  // baseline: a live publish carrying changeSetId (proposal path → "Immutable proposal not found") fails.
  assert.ok(check("baseline-publish", (log) => log.map((e) => (e.tool === "publish_baseline_from_working_scope" ? { ...e, arguments: { ...e.arguments, changeSetId: "cs_42" } } : e))).includes("forbidden"));
  // owner roadmap commit: flat operation fields (no patch/values) fail the preview step.
  assert.ok(check("owner-roadmap-commit", (log) => log.map((e) => (e.tool === "preview_owner_roadmap_change" ? { ...e, arguments: { workspaceId: "ws_trace", operations: [{ type: "update_item", itemId: "ri_12", title: "Checkout v2" }] } } : e))).includes("order"));
  // webhook with a pasted secret: any create fails.
  assert.ok(check("webhook-create", (log) => [...log, c("webhook-create", "create_webhook_subscription", { workspaceId: "ws_trace" })]).includes("forbidden"));
  // roadmap CR apply: a self-review on the way fails ([O] not covered + forbidden).
  assert.deepEqual(check("roadmap-cr-apply", (log) => [log[0], c("roadmap-cr-apply", "review_workspace_roadmap_change"), ...log.slice(1)]), ["forbidden", "owner-only"]);
  // index: a second refresh fails the cap.
  assert.deepEqual(check("index-refresh-activate", (log) => [...log.slice(0, 4), log[3], ...log.slice(4)]), ["max-calls"]);
});

test("eval --trace all (repo) exits 0", () => {
  const r = spawnSync(process.execPath, [CLI, "eval", "--trace", "all", "--json"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.flows.length, 13);
  assert.ok(report.flows.every((f) => f.ok));
});
