#!/usr/bin/env node
// agents-skills v2 — single zero-dependency entrypoint (Node >= 20, ESM). Spec §5.2 / §5.8.
//   node scripts/skills.mjs <snapshot|build|check|eval|new|install|update|verify|doctor|prune> [flags]
// Exit codes: 0 ok, 1 failures, 2 usage.

import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE = `Usage: node scripts/skills.mjs <command> [flags]

Commands:
  snapshot --lpm <dir> [--check] [--json <file>]   store LPM's MCP catalog snapshot (stub cards for new tools)
  build [--skills a,b]                             render dist/, coverage.json, matrix, README blocks, compat files
  check                                            run all validators and the drift rebuild
  eval --router | --triggers [--model <id>] | --trace <flow>
  new <id> [--title <title>]                       scaffold skills/<id>/ from templates/skill-v2
  install --agent codex|claude-code|antigravity|generic [--scope user|project] [--dest DIR]
          [--profile core|connector|internal | --skills a,b | --all] [--include-internal]
          [--include-external] [--prune] [--adopt-legacy] [--allow-untracked] [--dry-run]
  update | verify | doctor | prune                  see §5.8

Global flags: --root <dir> (repository root, default: this checkout), --verbose, --help
`;

const AGENTS = ["codex", "claude-code", "antigravity", "generic"];
const SCOPES = ["user", "project"];
const PROFILES = ["core", "connector", "internal"];

// Per-command flag specs. `strict` commands reject unknown flags; delegated commands pass them through.
const COMMANDS = {
  snapshot: { strict: true, booleans: ["check"], values: ["lpm", "json"] },
  build: { strict: true, booleans: [], values: ["skills"] },
  new: { strict: true, booleans: [], values: ["title"] },
  check: { strict: false, booleans: [], values: [] },
  eval: { strict: false, booleans: ["router", "triggers"], values: ["trace", "model"] },
  install: {
    strict: false,
    booleans: ["all", "include-internal", "include-external", "prune", "adopt-legacy", "dry-run", "allow-untracked", "experimental"],
    values: ["agent", "scope", "dest", "profile", "skills"],
  },
};
for (const c of ["update", "verify", "doctor", "prune"]) COMMANDS[c] = COMMANDS.install;
const GLOBAL_BOOLEANS = ["verbose", "help"];
const GLOBAL_VALUES = ["root"];

class UsageError extends Error {}

/** Parses argv into { command, args, flags }. Throws UsageError. */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || command === "help") return { command: "help", args: [], flags: {} };
  const spec = COMMANDS[command];
  if (!spec) throw new UsageError(`unknown command: ${command}`);
  const booleans = new Set([...spec.booleans, ...GLOBAL_BOOLEANS]);
  const values = new Set([...spec.values, ...GLOBAL_VALUES]);
  const flags = {};
  const args = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h") {
      flags.help = true;
      continue;
    }
    if (!a.startsWith("--")) {
      args.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = a.slice(2, eq > 0 ? eq : undefined);
    const inline = eq > 0 ? a.slice(eq + 1) : undefined;
    if (booleans.has(name)) {
      if (inline !== undefined && !["true", "false"].includes(inline)) throw new UsageError(`--${name} takes no value`);
      flags[name] = inline !== "false";
    } else if (values.has(name)) {
      const v = inline !== undefined ? inline : rest[++i];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`--${name} needs a value`);
      flags[name] = v;
    } else if (!spec.strict) {
      if (inline !== undefined) flags[name] = inline;
      else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith("--")) flags[name] = rest[++i];
      else flags[name] = true;
    } else {
      throw new UsageError(`unknown flag for ${command}: --${name}`);
    }
  }
  return { command, args, flags };
}

function validateFlags(command, flags, args) {
  const list = (v) => String(v).split(",").map((s) => s.trim()).filter(Boolean);
  if (command === "snapshot" && !flags.lpm && !flags.json) throw new UsageError("snapshot needs --lpm <dir> (or --json <file>)");
  if (command === "new" && args.length !== 1) throw new UsageError("new needs exactly one <id>");
  if (command === "build" && flags.skills !== undefined && !list(flags.skills).length) throw new UsageError("--skills needs a,b");
  if (command === "eval") {
    const modes = ["router", "triggers", "trace"].filter((m) => flags[m]);
    if (modes.length !== 1) throw new UsageError("eval needs exactly one of --router, --triggers, --trace <flow>");
  }
  if (COMMANDS[command] === COMMANDS.install) {
    if ((command === "install" || command === "verify") && !flags.agent) throw new UsageError(`${command} needs --agent ${AGENTS.join("|")}`);
    if (flags.agent && !AGENTS.includes(flags.agent)) throw new UsageError(`--agent must be one of ${AGENTS.join(", ")}`);
    if (flags.scope && !SCOPES.includes(flags.scope)) throw new UsageError(`--scope must be one of ${SCOPES.join(", ")}`);
    if (flags.profile && !PROFILES.includes(flags.profile)) throw new UsageError(`--profile must be one of ${PROFILES.join(", ")}`);
    const selectors = [flags.profile, flags.skills, flags.all].filter(Boolean).length;
    if (selectors > 1) throw new UsageError("use only one of --profile, --skills, --all");
  }
}

const log = {
  info: (...a) => console.log(...a),
  warn: (...a) => console.error(...a),
  error: (...a) => console.error(...a),
};

function exitCodeOf(result) {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    if (typeof result.exitCode === "number") return result.exitCode;
    if (result.ok === false) return 1;
  }
  return 0;
}

function printWarnings(warnings, verbose) {
  const max = verbose ? Infinity : 40;
  warnings.slice(0, max).forEach((w) => log.warn(`warning [${w.code}] ${w.message}`));
  if (warnings.length > max) log.warn(`… ${warnings.length - max} more warnings (use --verbose)`);
}

async function delegate(modulePath, fnName, opts) {
  const mod = await import(new URL(modulePath, import.meta.url));
  if (typeof mod[fnName] !== "function") throw new Error(`${modulePath} does not export ${fnName}()`);
  return mod[fnName](opts);
}

/** Runs the CLI; returns the exit code. */
export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    if (parsed.command !== "help" && !parsed.flags.help) validateFlags(parsed.command, parsed.flags, parsed.args);
  } catch (err) {
    if (err instanceof UsageError) {
      log.error(`error: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
  const { command, args, flags } = parsed;
  if (command === "help" || flags.help) {
    log.info(USAGE);
    return 0;
  }
  const root = flags.root ? path.resolve(flags.root) : DEFAULT_ROOT;
  const opts = { root, flags, args, log };
  try {
    switch (command) {
      case "snapshot": {
        const { runSnapshot } = await import("./lib/snapshot.mjs");
        return runSnapshot(root, { lpm: flags.lpm, json: flags.json, check: Boolean(flags.check), log }).exitCode;
      }
      case "build": {
        const { runBuild } = await import("./lib/build.mjs");
        const skills = flags.skills ? String(flags.skills).split(",").map((s) => s.trim()).filter(Boolean) : null;
        const { result, warnings, model } = runBuild(root, { skills });
        printWarnings(warnings, flags.verbose);
        log.info(
          `build: ${model.skills.length} skills · ${result.written.length} written · ${result.unchanged.length} unchanged · ${result.removed.length} removed · ${warnings.length} warnings`,
        );
        return 0;
      }
      case "new": {
        const { scaffoldSkill, UsageError: BuildUsageError } = await import("./lib/build.mjs");
        try {
          const written = scaffoldSkill(root, args[0], { title: flags.title || null });
          written.forEach((f) => log.info(`created ${f}`));
          return 0;
        } catch (err) {
          if (err instanceof BuildUsageError) {
            log.error(`error: ${err.message}`);
            return 2;
          }
          throw err;
        }
      }
      case "check":
        return exitCodeOf(await delegate("./lib/validate.mjs", "runCheck", opts));
      case "eval":
        if (flags.router) return exitCodeOf(await delegate("./lib/router.mjs", "evalRouter", opts));
        if (flags.triggers) return exitCodeOf(await delegate("./lib/router.mjs", "evalTriggers", opts));
        return exitCodeOf(await delegate("./lib/trace.mjs", "evalTrace", { ...opts, flow: flags.trace }));
      default:
        return exitCodeOf(await delegate("./lib/install.mjs", command, opts));
    }
  } catch (err) {
    log.error(`error: ${err.message}`);
    if (flags.verbose && err.stack) log.error(err.stack);
    return 1;
  }
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`error: ${err.message}`);
      process.exit(1);
    },
  );
}
