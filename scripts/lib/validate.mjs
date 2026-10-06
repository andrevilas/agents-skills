// validate.mjs — `node scripts/skills.mjs check [--json] [--lpm <dir>]` (§5.6, §5.9).
// Runs every validator V1–V19 (V18 only with --lpm). ✖ = failure (exit 1), ⚠ = warning.
//
//   runCheck(opts)            opts = { root, flags, args, log }   (dispatcher contract, API.md)
//   runCheck(model, opts)     same, with an already loaded model
//   validate(model, opts)     pure: → { ok, failures, warnings } (nothing printed)
//
// Each finding is { validator, skill, message }; skill is a v2 skill id or null ("infra").
// Content checks read the committed files (dist/, coverage.json); V15 rebuilds into a
// temporary directory and byte-compares, so a stale dist/ is always reported there.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareStrings, readJson, readText, sha256, sortStrings, walk } from "./fs.mjs";
import {
  BASE_SHARED_REFS,
  ENDPOINT,
  NATIVE_TARGETS,
  TARGETS,
  authorityLetter,
  loadModel,
  refName,
  routingRows,
} from "./model.mjs";
import { bundleRefs, renderedPaths, sectionLines, splitCells, toolMentions } from "./render.mjs";
import { computeSourcesHash, COVERAGE_PATH } from "./coverage.mjs";
import { buildOutputs, writeOutputs } from "./build.mjs";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Validator ids in report order. */
export const VALIDATORS = [
  "V1", "V2", "V3", "V4", "V4g", "V4w", "V5", "V6", "V7", "V8", "V9", "V10",
  "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20",
];

/** §3.3 headings, in order (V7). */
export const SKILL_HEADINGS = [
  "## 1. Use when / Do not use",
  "## 2. Preconditions",
  "## 3. Inputs",
  "## 4. Decision table (first match wins)",
  "## 5. Procedures",
  "## 6. Stop and ask",
  "## 7. Verify",
  "## 8. Report (copy and fill)",
  "## 9. Failures → fix",
  "## 10. Tools and references",
];

/** §3.3 header placeholders that must precede §1 (V7). */
const HEADER_PLACEHOLDERS = ["{{banner:access}}", "{{banner:authority}}", "{{partial:core-rules}}", "{{partial:tool-naming}}"];

/** §3.4 banned words (V7). */
export const BANNED_WORDS = ["consider", "maybe", "might", "if appropriate", "as needed", "etc.", "try to"];

/** §3.3 report fields, in order (V7). */
const REPORT_FIELDS = ["Scope", "Done", "Evidence", "Pending", "Next"];

/** Tool verbs named by §5.6 V2; the snapshot's own first segments are added at run time. */
const SPEC_TOOL_VERBS = ["list", "get", "create", "update", "delete", "set", "upsert", "preview", "apply", "submit", "review", "approve", "archive"];

/** §5.6 V13 secret patterns (scanned everywhere except external/). */
export const SECRET_PATTERNS = [
  { id: "lpm-mcp-credential", re: /lpm_mcp_[A-Za-z0-9]{8,}/ },
  { id: "google-api-key", re: /AIza[0-9A-Za-z_-]{20,}/ },
  { id: "bearer-token", re: /\bBearer\s+(?!<)[A-Za-z0-9._~+/-]{20,}=*/i },
  { id: "private-key", re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/ },
  { id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/ },
];

const RUN_APP_RE = /https?:\/\/[^\s)]*\.run\.app/g;
const CANDIDATE_TAG_RE = /^https:\/\/lpm-candidate---[A-Za-z0-9<>_-]+\.a\.run\.app$/;
const LPM_ROCKS_URL_RE = /https?:\/\/(?:www\.)?lpm\.rocks(?:\/[^\s)`'"<>\]]*)?/g;

/** PT-BR keywords (accent-stripped) for the §3.2 "at least one PT-BR keyword" rules (V1). */
const PT_WORDS = new Set(
  (
    "atividade atividades projeto projetos tarefa tarefas requisito requisitos escopo decisao decisoes roteiro " +
    "demanda demandas entrada custo custos orcamento orcamentos credencial credenciais chave chaves membro membros " +
    "equipe equipes dono donos prazo prazos ciclo ciclos marco marcos bloqueio bloqueios bloqueada bloqueado " +
    "dependencia dependencias evidencia evidencias saude pergunta perguntas codigo repositorio repositorios indice " +
    "conhecimento ajuda integracao integracoes publicar publicacao mudanca mudancas solicitacao solicitacoes fila " +
    "triagem executivo proxima proximo qual quais como para fazer criar crie mostre mostra liste listar atualize " +
    "atualizar feche fechar conclua concluir anexa anexe anexar registre registrar implementa implemente corrija " +
    "corrigir usar usa que com sem sobre esta este isso agente agentes acesso conexao conectar piloto pilotos " +
    "produto producao subir implantar revisao relatorio painel carteira governanca risco riscos prioridade " +
    "responsavel responsaveis estimativa estimativas rotear exportar exportacao segredo convidar convite pessoa " +
    "pessoas organizacao configurar configuracao modelo limite limites gasto gastos verba alocacao alocacoes " +
    "capacidade capacidades itens materializar rastreabilidade lacuna lacunas impacto tecnico executar execucao " +
    "entrega entregas entregar prova liberacao executores maquina maquinas servidor permissoes adicionais " +
    "linha mensagem mensagens grupo grupos rodar rode quanto quem onde quando porque nao sim uma um dos das nas nos " +
    "provar encerrar frota drenar protocolo liberar aprovar despachar abrir reabrir mover vincular desvincular " +
    "remover arquivar restaurar excluir apagar revisar mesclar consolidar converter responder perguntar explicar " +
    "analisar buscar pesquisar indexar ativar reindexar comparar instalar ajustar financiar liquidar pagar alocar " +
    "sugerir importar enviar receber notificar assinar cancelar pausar retomar reiniciar iniciar suspender reativar " +
    "migrar auditar rastrear priorizar estimar atribuir delegar agendar planejar organizar reorganizar desbloquear " +
    "bloquear resolver decidir propor aceitar rejeitar retirar aplicar promover reverter pacote pacotes artefato " +
    "artefatos achado achados auditoria linhagem lote lotes conta contas faturamento fatura consumo cota cotas saldo " +
    "contrato versao versoes arquivo arquivos trecho resposta respostas aviso avisos alerta alertas saida revisor " +
    "revisores aprovacao aprovacoes politica politicas modo regra regras assinatura assinaturas gancho ganchos " +
    "notificacao notificacoes conversa conversas sugestao sugestoes papel papeis funcao funcoes cargo convidado " +
    "semana semanal mensal diario relatorios atencao atrasada atrasadas atrasado pendente pendencias vinculo vinculos " +
    "quadro meta metas objetivo objetivos entregavel entregaveis iniciativa iniciativas chamado chamados incidente " +
    "incidentes duplicado duplicados duplicada duplicadas recibo pedido pedidos cliente clientes senha permissao " +
    "identidade identidades implantacao lancamento deploy-producao homologacao testador testadores"
  ).split(/\s+/),
);

const isSeparatorRow = (line) => /^\s*\|?\s*:?-{3,}/.test(line) && /^[\s|:-]+$/.test(line);

// ─── Small helpers ─────────────────────────────────────────────────────────────

function stripAccents(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** §5.2 tokenizer (lowercase, accent-stripped). */
export function routerTokens(s) {
  return stripAccents(String(s).toLowerCase()).match(/[a-z0-9_]+(?:[.-][a-z0-9_]+)*/g) || [];
}

/** True when text carries a PT-BR keyword or a Portuguese diacritic. */
export function hasPtBr(text) {
  const s = String(text || "");
  if (/[ãõçâêôàÃÕÇÂÊÔ]/.test(s)) return true;
  return routerTokens(s.replace(/[-_]/g, " ")).some((t) => PT_WORDS.has(t));
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Glob (`**`, `*`, `?`) → anchored RegExp over POSIX paths. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += escapeRegex(c);
  }
  return new RegExp(`^${re}$`);
}

function matchesAny(rel, globs) {
  return globs.some((g) => g.test(rel));
}

/** Lines of text with an `inFence` flag (``` / ~~~ fences; the fence lines themselves count as fenced). */
function fencedLines(text) {
  const out = [];
  let inFence = false;
  String(text || "")
    .split("\n")
    .forEach((line, i) => {
      const isFence = /^\s*(```|~~~)/.test(line);
      if (isFence) {
        out.push({ line, n: i + 1, inFence: true, fence: true });
        inFence = !inFence;
        return;
      }
      out.push({ line, n: i + 1, inFence, fence: false });
    });
  return out;
}

/**
 * Line numbers (1-based) exempt as `example:` content: a line that starts with `example:`
 * (after spaces and an optional list marker), or a fenced block whose first content line does.
 */
export function exampleLines(text) {
  const lines = String(text || "").split("\n");
  const exempt = new Set();
  const isExampleLine = (l) => /^\s*(?:[-*]\s+|\d+[.)]\s+)?(?:>\s*)?example:/i.test(l);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !/^\s*(```|~~~)/.test(lines[j])) j++;
      const first = lines.slice(i + 1, j).find((l) => l.trim());
      if (first !== undefined && isExampleLine(first)) for (let k = i; k <= j && k < lines.length; k++) exempt.add(k + 1);
      i = j;
      continue;
    }
    if (isExampleLine(lines[i])) exempt.add(i + 1);
  }
  return exempt;
}

/** Removes fenced blocks and inline code spans (for prose-only checks). */
function proseOnly(text) {
  return fencedLines(text)
    .map((l) => (l.inFence ? "" : l.line.replace(/`[^`\n]*`/g, " ")))
    .join("\n");
}

/** `## …` heading lines outside fences. */
function h2Headings(text) {
  return fencedLines(text)
    .filter((l) => !l.inFence && /^##\s/.test(l.line))
    .map((l) => l.line.trim().replace(/\s+/g, " "));
}

/** Lines of the section that starts at the exact heading line (until the next `## `). */
function sectionByHeading(text, heading) {
  const lines = String(text || "").split("\n");
  const start = lines.findIndex((l) => l.trim().replace(/\s+/g, " ") === heading.trim());
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

/** Simple frontmatter parse: { keys: [...], values: {key: raw string}, body } or null. */
export function parseFrontmatter(text) {
  const s = String(text || "");
  if (!s.startsWith("---\n")) return null;
  const end = s.indexOf("\n---\n", 4);
  if (end < 0) return null;
  const block = s.slice(4, end);
  const keys = [];
  const values = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!m) continue;
    keys.push(m[1]);
    values[m[1]] = m[2];
  }
  return { keys, values, block, body: s.slice(end + 5) };
}

function yamlScalar(raw) {
  const v = String(raw || "").trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v.replace(/^'(.*)'$/, "$1");
}

/** Text of `{{tool:x}}(…)` arguments starting at index `i` (the "("), or null. */
function balancedArgs(text, i) {
  if (text[i] !== "(") return null;
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    if (text[j] === "(") depth++;
    else if (text[j] === ")") {
      depth--;
      if (depth === 0) return text.slice(i + 1, j);
    }
  }
  return null;
}

/** Splits an argument list on top-level commas (ignores commas inside quotes, <>, (), [], backticks). */
function splitArgs(s) {
  const out = [];
  let cur = "";
  let depth = 0;
  let quote = null;
  for (const c of String(s)) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "`") {
      quote = c;
      cur += c;
      continue;
    }
    if ("(<[{".includes(c)) depth++;
    if (")>]}".includes(c)) depth = Math.max(0, depth - 1);
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const AUTH_RANK = { A: 0, C: 1, O: 2 };

// ─── Findings ──────────────────────────────────────────────────────────────────

function sortFindings(list) {
  const rank = (v) => {
    const i = VALIDATORS.indexOf(v);
    return i < 0 ? VALIDATORS.length : i;
  };
  return [...list].sort(
    (a, b) =>
      rank(a.validator) - rank(b.validator) ||
      compareStrings(a.skill || "", b.skill || "") ||
      compareStrings(a.message, b.message),
  );
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((f) => {
    const k = `${f.validator}\0${f.skill}\0${f.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Context ───────────────────────────────────────────────────────────────────

function makeCtx(model, opts) {
  const root = model.root;
  const failures = [];
  const warnings = [];
  const textCache = new Map();
  const read = (rel) => {
    if (!textCache.has(rel)) textCache.set(rel, readText(path.join(root, rel)));
    return textCache.get(rel);
  };
  const snapNames = new Set(model.catalog.snapshot ? model.catalog.snapshot.tools.map((t) => t.name) : []);
  const allow = new Map();
  const allowRaw = model.catalog.allowlist;
  const allowList = Array.isArray(allowRaw) ? allowRaw : allowRaw && Array.isArray(allowRaw.tokens) ? allowRaw.tokens : [];
  for (const e of allowList) {
    if (typeof e === "string") allow.set(e, "token");
    else if (e && e.token) allow.set(e.token, e.kind || "token");
  }
  const verbs = new Set(SPEC_TOOL_VERBS);
  for (const n of snapNames) verbs.add(n.split("_")[0]);
  const toolTokenRe = new RegExp(`^(?:${sortStrings([...verbs]).map(escapeRegex).join("|")})_[a-z0-9_]+$`);
  const distFiles = walk(path.join(root, "dist")).map((p) => `dist/${p}`);
  let built = null;
  const ctx = {
    model,
    root,
    opts,
    read,
    snapNames,
    allow,
    toolTokenRe,
    distFiles,
    distSet: new Set(distFiles),
    today: opts.today || new Date().toISOString().slice(0, 10),
    fail: (validator, skill, message) => failures.push({ validator, skill: skill || null, message }),
    warn: (validator, skill, message) => warnings.push({ validator, skill: skill || null, message }),
    failures,
    warnings,
    /** In-memory build of the current sources (shared by V12 parity contracts and V15). */
    build() {
      if (!built) {
        const fresh = loadModel(root);
        built = buildOutputs(fresh);
      }
      return built;
    },
  };
  ctx.skillOfPath = (rel) => {
    let m = rel.match(/^skills\/([^/]+)\//);
    if (m) return model.skillById[m[1]] ? m[1] : null;
    m = rel.match(/^dist\/(?:codex|claude-code|antigravity)\/([^/]+)\//);
    if (m) return model.skillById[m[1]] ? m[1] : null;
    m = rel.match(/^dist\/generic\/([^/]+?)(?:\.refs)?\.md$/);
    if (m) return model.skillById[m[1]] ? m[1] : null;
    return null;
  };
  ctx.isToolName = (name) => snapNames.has(name);
  ctx.tool = (name) => model.tools[name] || null;
  ctx.effectOf = (name) => {
    const t = model.tools[name];
    if (!t) return null;
    return (t.card && t.card.effect) || t.accessLevel || null;
  };
  ctx.isWrite = (name) => {
    const e = ctx.effectOf(name);
    return e !== null && e !== "read";
  };
  return ctx;
}

/** Repo-relative source files of v2 skills (src, manifest, local references) and shared/. */
function sourceTextFiles(ctx) {
  const out = [];
  for (const s of ctx.model.skills) {
    if (s.src !== null) out.push(s.srcPath);
    for (const r of s.references) out.push(r.path);
  }
  for (const r of Object.values(ctx.model.shared.references)) out.push(r.path);
  for (const f of walk(path.join(ctx.root, "shared/partials"))) out.push(`shared/partials/${f}`);
  return sortStrings([...new Set(out)]);
}

function internalSkillIds(model) {
  return model.skills.filter((s) => s.manifest.pack === "internal").map((s) => s.id);
}

// ─── V1 skill.json schema ──────────────────────────────────────────────────────

const REQUIRED_FIELDS = ["id", "title", "version", "pack", "kind", "description", "doneWhen", "jobs", "routing", "owns", "uses", "codex"];
const KNOWN_FIELDS = new Set([
  ...REQUIRED_FIELDS,
  "invocation", "authorityCeiling", "notFor", "cli", "sharedRefs", "references", "behaviorContracts", "related", "$comment", "name",
]);
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function V1(ctx) {
  const { model } = ctx;
  for (const w of model.warnings) {
    if (w.code === "invalid-json" && /^skills\//.test(w.file || "")) ctx.fail("V1", null, w.message);
    if (w.code === "missing-source" && /skill\.json is missing/.test(w.message)) ctx.fail("V1", null, w.message);
    if (w.code === "duplicate-skill") ctx.fail("V1", null, w.message);
  }
  const behaviorIds = new Set();
  const bc = model.catalog.behaviorContracts;
  for (const c of (bc && Array.isArray(bc.contracts) ? bc.contracts : Array.isArray(bc) ? bc : [])) if (c && c.id) behaviorIds.add(c.id);
  for (const c of model.catalog.contracts) behaviorIds.add(c.id);

  for (const s of model.skills) {
    const id = s.id;
    const raw = readJson(path.join(ctx.root, s.manifestPath)).value || {};
    const m = s.manifest;
    for (const f of REQUIRED_FIELDS) if (raw[f] === undefined) ctx.fail("V1", id, `skill.json: missing field "${f}"`);
    for (const k of Object.keys(raw)) if (!KNOWN_FIELDS.has(k)) ctx.warn("V1", id, `skill.json: unknown field "${k}"`);
    if (raw.id !== undefined && raw.id !== s.dir) ctx.fail("V1", id, `skill.json: id "${raw.id}" != directory "${s.dir}"`);
    if (!KEBAB_RE.test(id) || id.length > 64) ctx.fail("V1", id, `skill.json: id must be kebab-case and at most 64 characters`);
    if (raw.version !== undefined && !SEMVER_RE.test(String(raw.version))) ctx.fail("V1", id, `skill.json: version "${raw.version}" is not semver`);
    if (!["core", "internal"].includes(m.pack)) ctx.fail("V1", id, `skill.json: pack "${m.pack}" must be core or internal`);
    if (!["tools", "process"].includes(m.kind)) ctx.fail("V1", id, `skill.json: kind "${m.kind}" must be tools or process`);
    if (!["implicit", "explicit"].includes(m.invocation)) ctx.fail("V1", id, `skill.json: invocation "${m.invocation}" must be implicit or explicit`);
    if (m.pack === "internal" && m.invocation === "explicit") ctx.fail("V1", id, "skill.json: an internal skill must be implicit (pack keeps it out of default installs)");
    for (const f of ["title", "description", "doneWhen"]) {
      if (raw[f] !== undefined && (typeof raw[f] !== "string" || !raw[f].trim())) ctx.fail("V1", id, `skill.json: ${f} must be a non-empty string`);
    }
    for (const f of ["jobs", "routing", "owns", "uses", "notFor", "cli", "sharedRefs", "references", "behaviorContracts", "related"]) {
      if (raw[f] !== undefined && !Array.isArray(raw[f])) ctx.fail("V1", id, `skill.json: ${f} must be an array`);
    }

    // description
    const d = m.description;
    if (d) {
      if (!/^Use (when|first|only (when|inside|for))\b/.test(d)) {
        ctx.fail("V1", id, 'description must start with "Use when", "Use first" or "Use only (when|inside|for)"');
      }
      if (m.pack === "internal" && !/^Use only (inside the LPM product repository|for LPM maintainers)/.test(d)) {
        ctx.fail("V1", id, 'internal description must start with "Use only inside the LPM product repository" or "Use only for LPM maintainers"');
      }
      if (/[<>]/.test(d)) ctx.fail("V1", id, "description must not contain < or >");
      if (!hasPtBr(d)) ctx.fail("V1", id, "description has no PT-BR keyword");
      const named = [...d.matchAll(/\(use ([a-z0-9-]+)\)/g)].map((x) => x[1]);
      if (m.notFor.length && !named.length) ctx.fail("V1", id, 'description must name a sibling with "(use <id>)" (notFor is non-empty)');
      for (const n of named) if (!model.skillById[n]) ctx.fail("V1", id, `description names unknown skill "(use ${n})"`);
      // "Old name: <legacy id>" lets a description-only picker route an old skill name; it must name the primary.
      for (const [, old] of d.matchAll(/\bOld names?: ([a-z0-9-]+(?:, [a-z0-9-]+)*)/g)) {
        for (const o of old.split(", ")) {
          const l = (model.catalog.legacyIds || []).find((x) => x.legacy === o);
          if (!l) ctx.fail("V1", id, `description names "Old name: ${o}", which is not in catalog/legacy-ids.json`);
          else if (l.skill !== id) ctx.fail("V1", id, `description names "Old name: ${o}", but legacy-ids.json routes it to ${l.skill}`);
        }
      }
    }

    // jobs
    if (m.jobs.length < 5) ctx.fail("V1", id, `jobs: ${m.jobs.length} entries, at least 5 required`);
    const ptJobs = m.jobs.filter(hasPtBr).length;
    if (ptJobs < 2) ctx.fail("V1", id, `jobs: ${ptJobs} PT-BR entries, at least 2 required`);

    // targets: notFor, related, routing firstCall
    m.notFor.forEach((n, i) => {
      if (!n.skill || !model.skillById[n.skill]) ctx.fail("V1", id, `notFor[${i}]: skill "${n.skill}" does not exist`);
      if (!n.when) ctx.fail("V1", id, `notFor[${i}]: "when" is empty`);
    });
    for (const r of Array.isArray(raw.related) ? raw.related : []) {
      const rid = typeof r === "string" ? r : r && (r.skill || r.id);
      if (!rid || !model.skillById[rid]) ctx.fail("V1", id, `related: skill "${rid}" does not exist`);
    }
    const bundled = new Set(bundleRefs(model, s).map((r) => r.name));
    m.routing.forEach((row) => {
      const fc = String(row.firstCall || "");
      for (const tok of fc.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g) || []) {
        if (ctx.toolTokenRe.test(tok) && !ctx.isToolName(tok) && !ctx.allow.has(tok)) {
          ctx.fail("V1", id, `routing order ${row.order}: firstCall names unknown tool "${tok}"`);
        }
      }
      for (const ref of fc.match(/references\/[A-Za-z0-9._-]+\.md/g) || []) {
        if (!bundled.has(refName(ref))) ctx.fail("V1", id, `routing order ${row.order}: firstCall names ${ref}, which is not in the bundle`);
      }
    });

    // references and shared refs
    for (const r of m.sharedRefs) {
      if (!model.shared.references[r.name]) ctx.fail("V1", id, `sharedRefs: "${r.name}" does not exist in shared/references or shared/internal`);
    }
    for (const r of m.references) {
      const name = refName(r.file);
      if (["tools", "aliases", "route"].includes(name)) continue;
      if (!s.references.some((x) => x.name === name)) ctx.fail("V1", id, `references: ${r.file} does not exist`);
    }
    for (const local of s.references) {
      if (model.shared.references[local.name] && m.sharedRefs.some((x) => x.name === local.name)) {
        ctx.fail("V1", id, `references/${local.name}.md has the same name as a linked shared reference`);
      }
    }
    for (const b of m.behaviorContracts) if (!behaviorIds.has(b)) ctx.warn("V1", id, `behaviorContracts: "${b}" is not defined in behavior-contracts.json or contracts.json`);

    // codex
    const c = m.codex || {};
    const sd = c.shortDescription;
    if (typeof sd !== "string" || sd.length < 25 || sd.length > 64) {
      ctx.fail("V1", id, `codex.shortDescription must be 25–64 characters (has ${typeof sd === "string" ? sd.length : "none"})`);
    }
    if (typeof c.defaultPrompt !== "string" || !c.defaultPrompt.includes(`$${id}`)) ctx.fail("V1", id, `codex.defaultPrompt must contain $${id}`);
  }

  // unique routing.order across the catalog
  const byOrder = {};
  for (const r of routingRows(model)) (byOrder[r.order] ||= []).push(r.skill);
  for (const [order, skills] of Object.entries(byOrder)) {
    if (skills.length > 1) ctx.fail("V1", null, `routing order ${order} is used ${skills.length} times (${uniq(skills).join(", ")})`);
  }
}

const uniq = (l) => [...new Set(l)];

// ─── V2 tool names ─────────────────────────────────────────────────────────────

function V2(ctx) {
  const { model } = ctx;
  if (!model.catalog.snapshot) {
    ctx.fail("V2", null, "catalog/lpm-tools.snapshot.json is missing or invalid; tool names cannot be checked");
    return;
  }
  const unknownMsg = (name) => (ctx.allow.has(name) ? `"${name}" is allowlisted as ${ctx.allow.get(name)}, not a tool` : `"${name}" is not in the snapshot`);
  for (const s of model.skills) {
    for (const f of ["owns", "uses"]) {
      for (const t of s.manifest[f]) if (!ctx.isToolName(t)) ctx.fail("V2", s.id, `skill.json ${f}: ${unknownMsg(t)}`);
    }
  }
  const files = [...sourceTextFiles(ctx), ...ctx.distFiles];
  for (const rel of files) {
    const text = ctx.read(rel);
    if (text === null) continue;
    const skill = ctx.skillOfPath(rel);
    const seen = new Set();
    for (const m of text.matchAll(/\{\{tool:([^}]*)\}\}/g)) {
      const name = m[1].trim();
      if (ctx.isToolName(name) || seen.has(`t:${name}`)) continue;
      seen.add(`t:${name}`);
      ctx.fail("V2", skill, `${rel}: {{tool:${name}}}: ${unknownMsg(name)}`);
    }
    for (const m of text.matchAll(/`([^`\n]+)`/g)) {
      const tok = m[1].trim();
      if (!ctx.toolTokenRe.test(tok)) continue;
      if (ctx.isToolName(tok) || ctx.allow.has(tok) || seen.has(`b:${tok}`)) continue;
      seen.add(`b:${tok}`);
      ctx.fail("V2", skill, `${rel}: \`${tok}\` is not in the snapshot or allowlist.json`);
    }
  }
}

// ─── V3 ownership ──────────────────────────────────────────────────────────────

/** Tool names a SKILL.src.md names: {{tool:x}} plus backticked snapshot tool names. */
function namedTools(ctx, text) {
  const out = new Set(toolMentions(text));
  for (const m of String(text || "").matchAll(/`([a-z][a-z0-9_]*)`/g)) if (ctx.isToolName(m[1])) out.add(m[1]);
  return [...out];
}

function V3(ctx) {
  const { model } = ctx;
  const pendingByTool = {};
  for (const p of model.catalog.pending) pendingByTool[p.tool] = p;
  const pendingValid = (tool) => {
    const p = pendingByTool[tool];
    return Boolean(p && p.until && String(p.until) >= ctx.today && p.reason && p.approvedBy);
  };
  for (const t of model.catalog.snapshot ? model.catalog.snapshot.tools : []) {
    const info = model.tools[t.name];
    const owners = info ? info.owners : [];
    if (owners.length > 1) ctx.fail("V3", null, `${t.name} is owned by ${owners.length} skills (${owners.join(", ")})`);
    if (owners.length === 0) {
      if (pendingValid(t.name)) ctx.warn("V3", null, `${t.name} has no owner (pending until ${pendingByTool[t.name].until})`);
      else if (pendingByTool[t.name]) ctx.fail("V3", null, `${t.name} has no owner and its pending entry is expired or incomplete (until ${pendingByTool[t.name].until || "—"})`);
      else ctx.fail("V3", null, `${t.name} has no owner skill and no pending entry`);
    }
  }
  for (const p of model.catalog.pending) {
    if (!ctx.isToolName(p.tool)) ctx.warn("V3", null, `pending entry ${p.tool} is not in the snapshot`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.until || ""))) ctx.fail("V3", null, `pending entry ${p.tool}: "until" must be YYYY-MM-DD`);
  }
  for (const s of model.skills) {
    const m = s.manifest;
    const owns = new Set(m.owns);
    for (const t of m.uses) if (owns.has(t)) ctx.fail("V3", s.id, `${t} is in both owns and uses`);
    for (const list of ["owns", "uses"]) {
      const dup = m[list].filter((t, i) => m[list].indexOf(t) !== i);
      for (const t of uniq(dup)) ctx.fail("V3", s.id, `${t} is listed twice in ${list}`);
    }
    if (m.kind === "tools" && !m.owns.length) ctx.fail("V3", s.id, 'kind "tools" must own at least one tool');
    if (m.kind === "process" && m.owns.length) ctx.warn("V3", s.id, `kind "process" owns ${m.owns.length} tools`);
    if (s.src !== null) {
      const all = new Set([...m.owns, ...m.uses]);
      for (const t of namedTools(ctx, s.src)) {
        if (!all.has(t) && ctx.isToolName(t)) ctx.fail("V3", s.id, `SKILL.src.md names ${t}, which is not in owns or uses`);
      }
    }
  }
  const review = model.skillById["lpm-review-health"];
  if (review) {
    for (const t of review.manifest.owns) {
      if (ctx.effectOf(t) !== "read") ctx.fail("V3", review.id, `lpm-review-health may own only read tools; ${t} is ${ctx.effectOf(t) || "unknown"}`);
    }
  }
}

// ─── V4 cards ↔ snapshot (+ errata), V4g gotcha provenance, V4w effect mismatch ─

const ERRATA_TEXT_FIELDS = ["purpose", "useWhen", "avoidWhen", "gotchas", "errors", "returns", "preconditions", "inputs"];

function fieldTexts(card, field) {
  const v = card[field];
  if (v === undefined || v === null) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) {
    return v.flatMap((x) => {
      if (typeof x === "string") return [x];
      if (x && typeof x === "object") {
        if (field === "gotchas") return [String(x.text || "")];
        if (field === "errors") return [String(x.when || ""), String(x.fix || ""), `${x.when || ""} ${x.fix || ""}`];
        if (field === "inputs") return [String(x.param || ""), String(x.source || ""), String(x.notes || "")];
        return [JSON.stringify(x)];
      }
      return [String(x)];
    });
  }
  if (typeof v === "object") return [JSON.stringify(v)];
  return [String(v)];
}

function normScope(v) {
  return v === undefined || v === null || v === "" ? null : String(v);
}

function V4(ctx) {
  const { model } = ctx;
  const cards = model.catalog.cards;
  const snap = model.catalog.snapshot ? model.catalog.snapshot.tools : [];
  const pending = new Set(model.catalog.pending.filter((p) => p.until && String(p.until) >= ctx.today).map((p) => p.tool));
  for (const w of model.warnings) {
    if (w.code === "duplicate-card" || w.code === "invalid-card") ctx.fail("V4", null, w.message);
    if (w.code === "invalid-json" && /^catalog\/cards\//.test(w.file || "")) ctx.fail("V4", null, w.message);
  }
  for (const t of snap) {
    const card = cards[t.name];
    if (!card) {
      ctx.fail("V4", null, `${t.name}: no card in catalog/cards`);
      continue;
    }
    if (card.status === "stub") {
      if (pending.has(t.name)) ctx.warn("V4", null, `${t.name}: stub card (pending entry present)`);
      else ctx.fail("V4", null, `${t.name}: stub card; fill it (${card.file}) or add a dated pending entry`);
    }
    if (normScope(card.oauthScope) !== normScope(t.oauthScope)) {
      ctx.fail("V4", null, `${t.name}: card oauthScope ${normScope(card.oauthScope) || "null"} != snapshot ${normScope(t.oauthScope) || "null"}`);
    }
    const cardReq = sortStrings(card.inputs.filter((i) => i.required).map((i) => i.param));
    const snapReq = sortStrings(t.required);
    if (cardReq.join(",") !== snapReq.join(",")) {
      ctx.fail("V4", null, `${t.name}: card required [${cardReq.join(", ")}] != snapshot required [${snapReq.join(", ")}]`);
    }
  }
  const snapSet = ctx.snapNames;
  for (const card of Object.values(cards)) {
    if (!snapSet.has(card.name)) ctx.warn("V4", null, `${card.name}: card has no snapshot tool (${card.file})`);
    for (const p of card.pairsWith) {
      const name = String(p).trim().match(/^[a-z][a-z0-9_]*/);
      if (!name || !snapSet.has(name[0])) ctx.fail("V4", null, `${card.name}: pairsWith "${p}" is not a snapshot tool`);
    }
    for (const a of card.avoidWhen) {
      for (const tok of String(a).match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g) || []) {
        if (ctx.toolTokenRe.test(tok) && !snapSet.has(tok) && !ctx.allow.has(tok)) ctx.fail("V4", null, `${card.name}: avoidWhen names unknown tool "${tok}"`);
      }
    }
  }
  // Errata: a known-wrong statement must not come back.
  const errataRaw = model.catalog.cardErrata;
  const errata = Array.isArray(errataRaw) ? errataRaw : errataRaw && Array.isArray(errataRaw.errata) ? errataRaw.errata : [];
  for (const e of errata) {
    if (!e || !e.badPattern) continue;
    let re;
    try {
      re = new RegExp(e.badPattern, "u");
    } catch (err) {
      ctx.fail("V4", null, `card-errata.json: invalid badPattern for ${e.tool}.${e.field}: ${err.message}`);
      continue;
    }
    const own = cards[e.tool];
    if (e.tool && !own) ctx.warn("V4", null, `card-errata.json: ${e.tool} has no card`);
    const targets = [];
    if (own) targets.push([own, e.field ? [e.field] : ERRATA_TEXT_FIELDS]);
    if (ERRATA_TEXT_FIELDS.includes(e.field)) for (const c of Object.values(cards)) if (c !== own) targets.push([c, ERRATA_TEXT_FIELDS]);
    for (const [card, fields] of targets) {
      for (const f of fields) {
        if (fieldTexts(card, f).some((txt) => re.test(txt))) {
          ctx.fail("V4", null, `${card.name}.${f} matches errata badPattern /${e.badPattern}/ (${e.tool}.${e.field}); correction: ${e.correction || "see card-errata.json"}`);
        }
      }
    }
  }
  V4cards(ctx);
}

/** Card `idempotency` vocabulary (§5.6 V4): a label, optionally followed by ": <note>". */
export const IDEMPOTENCY_LABEL_RE = /^(not idempotent|naturally idempotent|idempotencyKey supported|keyed by ([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*))(?:: \S.*)?$/;

/**
 * Tools whose schema declares `idempotencyKey` but whose card says "naturally idempotent": LPM stores
 * the key (or dedupes by content) without replaying a result, so the card label stays the semantic one.
 */
export const NATURALLY_IDEMPOTENT_WITH_KEY = [
  "apply_workspace_roadmap_change",
  "apply_workspace_roadmap_v2_migration",
  "process_workspace_roadmap_notification_outbox",
  "refresh_repository_code_index",
  "rollback_workspace_roadmap_governance_migration",
];

/** V4 card-file and idempotency checks (ported from the card migration's validate_cards.py). */
function V4cards(ctx) {
  const { model } = ctx;
  const dir = path.join(ctx.root, "catalog/cards");
  for (const f of sortStrings(walk(dir).filter((x) => x.endsWith(".json") && !x.includes("/")))) {
    const rel = `catalog/cards/${f}`;
    const text = readText(path.join(dir, f));
    if (text === null) continue;
    if (text.includes("\r") || !text.endsWith("\n")) ctx.fail("V4", null, `${rel}: line endings must be LF with a final newline`);
    let list;
    try {
      list = JSON.parse(text);
    } catch {
      continue; // reported by loadModel (invalid-json)
    }
    if (!Array.isArray(list)) list = (list && (list.cards || list.tools)) || [];
    const names = list.map((c) => String((c && (c.name || c.tool)) || ""));
    const sorted = [...names].sort(compareStrings);
    const at = names.findIndex((n, i) => n !== sorted[i]);
    if (at >= 0) ctx.fail("V4", null, `${rel}: cards are not sorted by name (first out of order: ${names[at]})`);
  }
  const snapByName = Object.fromEntries((model.catalog.snapshot ? model.catalog.snapshot.tools : []).map((t) => [t.name, t]));
  for (const card of Object.values(model.catalog.cards)) {
    const seen = new Set();
    for (const p of card.pairsWith) {
      const name = (String(p).trim().match(/^[a-z][a-z0-9_]*/) || [""])[0];
      if (name === card.name) ctx.fail("V4", null, `${card.name}: pairsWith names the tool itself`);
      if (seen.has(name)) ctx.fail("V4", null, `${card.name}: pairsWith repeats ${name}`);
      seen.add(name);
    }
    if (card.status === "stub") continue;
    const label = card.idempotency === null || card.idempotency === undefined ? "" : String(card.idempotency);
    const m = label.match(IDEMPOTENCY_LABEL_RE);
    if (!m) {
      ctx.fail("V4", null, `${card.name}: idempotency "${label}" is not one of: not idempotent, naturally idempotent, idempotencyKey supported, keyed by <param>`);
      continue;
    }
    const snap = snapByName[card.name];
    if (!snap) continue;
    const params = Object.keys(snap.params || {});
    const declaresKey = params.includes("idempotencyKey");
    if (m[1] === "idempotencyKey supported" && !declaresKey) {
      ctx.fail("V4", null, `${card.name}: idempotency "idempotencyKey supported" but the LPM schema declares no idempotencyKey`);
    }
    if (m[2] && !params.includes(m[2].split(".")[0])) {
      ctx.fail("V4", null, `${card.name}: idempotency "keyed by ${m[2]}" but the LPM schema has no parameter ${m[2].split(".")[0]}`);
    }
    if (declaresKey && m[1] !== "idempotencyKey supported") {
      if (m[1] === "naturally idempotent" && NATURALLY_IDEMPOTENT_WITH_KEY.includes(card.name)) continue;
      const msg = `${card.name}: the LPM schema declares idempotencyKey but the card says "${m[1]}" (use "idempotencyKey supported", or add the tool to NATURALLY_IDEMPOTENT_WITH_KEY with a reason)`;
      if (m[1] === "naturally idempotent") ctx.warn("V4", null, msg);
      else ctx.fail("V4", null, msg);
    }
  }
}

const VERIFIED_FROM_RE = /^(?:[A-Za-z0-9_.@/-]+:\d+(?:-\d+)?|help:[a-z0-9][a-z0-9-]*)$/;

/** V4g level: "fail" once catalog/contracts.json policy.gotchaVerifiedFrom is "fail" (first release: warn). */
function gotchaLevel(ctx) {
  const raw = readJson(path.join(ctx.root, "catalog/contracts.json")).value;
  const p = raw && raw.policy && raw.policy.gotchaVerifiedFrom;
  return p === "fail" ? "fail" : "warn";
}

function V4g(ctx) {
  const level = gotchaLevel(ctx);
  const report = level === "fail" ? ctx.fail : ctx.warn;
  for (const card of Object.values(ctx.model.catalog.cards)) {
    card.gotchas.forEach((g, i) => {
      const vf = g.verifiedFrom ? String(g.verifiedFrom).trim() : "";
      if (!vf) report("V4g", null, `${card.name}: gotcha ${i + 1} has no verifiedFrom`);
      else if (!vf.split(/\s*[;,]\s*/).every((x) => VERIFIED_FROM_RE.test(x))) {
        report("V4g", null, `${card.name}: gotcha ${i + 1} verifiedFrom "${vf}" is not <file>:<line>[-<line>] or help:<slug>`);
      }
    });
  }
}

function V4w(ctx) {
  for (const t of ctx.model.catalog.snapshot ? ctx.model.catalog.snapshot.tools : []) {
    const card = ctx.model.catalog.cards[t.name];
    if (!card || !card.effect || !t.accessLevel) continue;
    const cardRead = card.effect === "read";
    const lpmRead = t.accessLevel === "read";
    if (cardRead !== lpmRead) ctx.warn("V4w", null, `${t.name}: card effect "${card.effect}" vs LPM accessLevel "${t.accessLevel}"`);
  }
}

// ─── V5 authority ──────────────────────────────────────────────────────────────

/** [{ tool, tag, line, lineNo }] for every {{tool:x}} with the [A|C|O] tag that follows it on its line. */
function taggedMentions(text) {
  const out = [];
  String(text || "")
    .split("\n")
    .forEach((line, i) => {
      const ms = [...line.matchAll(/\{\{tool:([a-z0-9_]+)\}\}/g)];
      ms.forEach((m, k) => {
        const end = k + 1 < ms.length ? ms[k + 1].index : line.length;
        const seg = line.slice(m.index + m[0].length, end);
        const tag = seg.match(/\[(A|C|O)\]/);
        out.push({ tool: m[1], tag: tag ? tag[1] : null, line, lineNo: i + 1 });
      });
    });
  return out;
}

function V5(ctx) {
  const { model } = ctx;
  const overrides = model.catalog.authorityOverrides;
  const byTool = {};
  for (const o of overrides) (byTool[o.tool] ||= []).push(o);
  for (const t of model.catalog.snapshot ? model.catalog.snapshot.tools : []) {
    const card = model.catalog.cards[t.name];
    if (!t.sensitive || !card || authorityLetter(card.authority) !== "A") continue;
    const decided = (byTool[t.name] || []).some((o) => o.decision === "keep" || o.decision === "raise");
    if (!decided) ctx.fail("V5", null, `${t.name} is sensitive and carded autonomous but has no keep|raise decision in authority-overrides.json`);
  }
  for (const o of overrides) {
    if (!["keep", "raise"].includes(o.decision)) ctx.fail("V5", null, `authority-overrides: ${o.tool}: decision "${o.decision}" must be keep or raise`);
    if (!o.reason || !String(o.reason).trim()) ctx.fail("V5", null, `authority-overrides: ${o.tool}: reason is empty`);
    if (!ctx.isToolName(o.tool)) ctx.fail("V5", null, `authority-overrides: ${o.tool} is not in the snapshot`);
    const card = model.catalog.cards[o.tool];
    const cardLetter = card ? authorityLetter(card.authority) : null;
    if (o.decision === "raise") {
      if (!o.to) ctx.fail("V5", null, `authority-overrides: ${o.tool}: raise needs "to"`);
      else if (cardLetter && AUTH_RANK[o.to] <= AUTH_RANK[cardLetter]) ctx.fail("V5", null, `authority-overrides: ${o.tool}: raise to [${o.to}] is not stricter than the card [${cardLetter}]`);
    }
    if (o.decision === "keep" && o.to && cardLetter && o.to !== cardLetter) ctx.fail("V5", null, `authority-overrides: ${o.tool}: keep but "to" [${o.to}] != card [${cardLetter}]`);
  }

  for (const s of model.skills) {
    const files = [];
    if (s.src !== null) files.push([s.srcPath, s.src]);
    for (const r of s.references) files.push([r.path, r.content || ""]);
    for (const [rel, text] of files) {
      for (const m of taggedMentions(text)) {
        const rendered = model.tools[m.tool] ? model.tools[m.tool].authority : null;
        if (!rendered) continue;
        if (m.tag && AUTH_RANK[m.tag] < AUTH_RANK[rendered]) {
          ctx.fail("V5", s.id, `${rel}:${m.lineNo}: ${m.tool} is tagged [${m.tag}] but renders [${rendered}]`);
        } else if (m.tag && m.tag !== rendered) {
          ctx.warn("V5", s.id, `${rel}:${m.lineNo}: ${m.tool} is tagged [${m.tag}], stricter than its rendered [${rendered}]`);
        }
      }
    }
    if (s.src === null) continue;
    // Procedure steps that call a write tool carry a tag.
    const sec5 = sectionLines(s.src, 5).join("\n");
    for (const m of taggedMentions(sec5)) {
      if (!/^\s*\d+\.\s/.test(m.line) || /^\s*\d+\.\s+Verify:/.test(m.line)) continue;
      if (!m.tag && ctx.isWrite(m.tool)) {
        const first = (m.line.match(/\{\{tool:([a-z0-9_]+)\}\}/) || [])[1];
        if (first === m.tool) ctx.warn("V5", s.id, `§5 step "${m.line.trim().slice(0, 60)}…": write ${m.tool} has no [A|C|O] tag`);
      }
    }
    // Every [O] tool used in §4–§5 has a §6 row.
    const used = toolMentions([...sectionLines(s.src, 4), ...sectionLines(s.src, 5)].join("\n"));
    const sec6 = sectionLines(s.src, 6).join("\n");
    for (const t of used) {
      if (!model.tools[t] || model.tools[t].authority !== "O") continue;
      if (!new RegExp(`(?<![a-z0-9_])${t}(?![a-z0-9_])`).test(sec6)) ctx.fail("V5", s.id, `[O] tool ${t} is used in §4–§5 but has no §6 Stop-and-ask row`);
    }
  }
}

// ─── V6 alias policy ───────────────────────────────────────────────────────────

function V6(ctx) {
  const { model } = ctx;
  const raw = readJson(path.join(ctx.root, "catalog/aliases.json")).value;
  const exceptions = (raw && Array.isArray(raw.stepExceptions) ? raw.stepExceptions : []).filter((e) => e && e.alias);
  const aliases = model.catalog.aliases;
  const canon = new Set(aliases.map((a) => a.canonical));
  const seen = new Set();
  for (const a of aliases) {
    if (seen.has(a.alias)) ctx.fail("V6", null, `aliases.json: ${a.alias} is listed twice`);
    seen.add(a.alias);
    if (!ctx.isToolName(a.alias)) ctx.fail("V6", null, `aliases.json: alias ${a.alias} is not in the snapshot`);
    if (!ctx.isToolName(a.canonical)) ctx.fail("V6", null, `aliases.json: canonical ${a.canonical} is not in the snapshot`);
    if (canon.has(a.alias)) ctx.fail("V6", null, `aliases.json: ${a.alias} is both an alias and a canonical name`);
    if (a.alias === a.canonical) ctx.fail("V6", null, `aliases.json: ${a.alias} is its own canonical`);
    const owner = a.owner ? model.skillById[a.owner] : null;
    if (!owner) ctx.fail("V6", null, `aliases.json: ${a.alias}: owner skill "${a.owner}" does not exist`);
    else {
      for (const t of [a.alias, a.canonical]) {
        if (!owner.manifest.owns.includes(t)) ctx.fail("V6", owner.id, `${t} (${t === a.alias ? "alias" : "canonical"} of the pair ${a.canonical}/${a.alias}) must be owned by ${owner.id}`);
      }
    }
  }
  const aliasSet = new Map(aliases.map((a) => [a.alias, a.canonical]));
  const excepted = (alias, skill) => exceptions.some((e) => e.alias === alias && (!e.skill || e.skill === skill || (Array.isArray(e.skills) && e.skills.includes(skill))));
  const scan = [];
  for (const s of model.skills) {
    if (s.src !== null) scan.push([s.srcPath, s.src, s.id]);
    for (const r of s.references) scan.push([r.path, r.content || "", s.id]);
  }
  for (const r of Object.values(model.shared.references)) scan.push([r.path, r.content || "", null]);
  for (const [rel, text, skill] of scan) {
    for (const [alias, canonical] of aliasSet) {
      const re = new RegExp(`(?<![a-z0-9_])${alias}(?![a-z0-9_])`);
      if (re.test(text) && !excepted(alias, skill)) {
        ctx.fail("V6", skill, `${rel} names the alias ${alias}; use the canonical ${canonical} (aliases appear only in tools.md/aliases.md)`);
      }
    }
  }
  for (const e of exceptions) if (!aliasSet.has(e.alias)) ctx.fail("V6", null, `aliases.json stepExceptions: ${e.alias} is not an alias`);
}

// ─── V7 structure ──────────────────────────────────────────────────────────────

function procedures(src) {
  const lines = sectionLines(src, 5);
  const procs = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^###\s+(P\d+)\b(.*)$/);
    if (h) {
      cur = { id: h[1], title: h[2].trim(), lines: [] };
      procs.push(cur);
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  return procs.map((p) => ({ ...p, steps: p.lines.filter((l) => /^\s*\d+\.\s/.test(l)) }));
}

function tableDataRows(lines) {
  const rows = [];
  let seenSep = false;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      if (seenSep && rows.length) break;
      continue;
    }
    if (isSeparatorRow(line)) {
      seenSep = true;
      continue;
    }
    if (seenSep) rows.push(splitCells(line));
  }
  return rows;
}

function V7(ctx) {
  const { model } = ctx;
  for (const s of model.skills) {
    const src = s.src;
    if (src === null) {
      ctx.fail("V7", s.id, "SKILL.src.md is missing");
      continue;
    }
    // headings in order
    const heads = h2Headings(src);
    const expected = SKILL_HEADINGS;
    if (heads.join("\n") !== expected.join("\n")) {
      const missing = expected.filter((h) => !heads.includes(h));
      const extra = heads.filter((h) => !expected.includes(h));
      const parts = [];
      if (missing.length) parts.push(`missing ${missing.map((h) => `"${h}"`).join(", ")}`);
      if (extra.length) parts.push(`unexpected ${extra.map((h) => `"${h}"`).join(", ")}`);
      if (!parts.length) parts.push("out of order");
      ctx.fail("V7", s.id, `headings: ${parts.join("; ")}`);
    }
    const lines = src.split("\n");
    const s1 = lines.findIndex((l) => /^##\s+1[.\s]/.test(l));
    const header = (s1 < 0 ? lines : lines.slice(0, s1)).map((l) => l.trim());
    if (!header.some((l) => /^#\s+\S/.test(l))) ctx.fail("V7", s.id, "header: no `# {{title}}` line before §1");
    if (!header.some((l) => /^>\s*Done when:/.test(l))) ctx.fail("V7", s.id, "header: no `> Done when: {{doneWhen}}` line before §1");
    for (const p of HEADER_PLACEHOLDERS) if (!header.includes(p)) ctx.fail("V7", s.id, `header: ${p} must sit alone on a line before §1`);
    const sec10 = sectionLines(src, 10).map((l) => l.trim());
    if (s.manifest.owns.length + s.manifest.uses.length && !sec10.includes("{{tools:index}}")) ctx.fail("V7", s.id, "§10 must contain {{tools:index}}");
    if (!sec10.includes("{{refs:index}}")) ctx.fail("V7", s.id, "§10 must contain {{refs:index}}");
    if (!sectionLines(src, 9).some((l) => /^\{\{errors:auto(?::[a-z0-9_,\s]+)?\}\}$/.test(l.trim()))) ctx.warn("V7", s.id, "§9 has no {{errors:auto}}");

    // decision table
    const rows = tableDataRows(sectionLines(src, 4)).filter((c) => /^\d+$/.test((c[0] || "").trim()));
    if (rows.length > 14) ctx.fail("V7", s.id, `§4 decision table has ${rows.length} rows (max 14)`);
    if (!rows.length && s.manifest.kind === "tools") ctx.fail("V7", s.id, "§4 decision table has no numbered rows");

    // procedures
    const procs = procedures(src);
    if (procs.length > 6) ctx.fail("V7", s.id, `§5 has ${procs.length} procedures (max 6)`);
    for (const p of procs) {
      if (p.steps.length > 10) ctx.fail("V7", s.id, `§5 ${p.id} has ${p.steps.length} steps (max 10; move it to references/flow-<name>.md)`);
      // A write procedure is closed by a `Verify:` step after its last write step (report steps may follow).
      const isVerify = (l) => /^\s*\d+\.\s+Verify:/.test(l);
      const writeSteps = p.steps.map((l, i) => [i, l]).filter(([, l]) => !isVerify(l) && toolMentions(l).some((t) => ctx.isWrite(t)));
      if (writeSteps.length) {
        const [lastWrite, lastLine] = writeSteps[writeSteps.length - 1];
        if (!p.steps.slice(lastWrite + 1).some(isVerify)) {
          const tools = toolMentions(lastLine).filter((t) => ctx.isWrite(t));
          ctx.fail("V7", s.id, `§5 ${p.id}: no "Verify:" step after its last write (${tools.join(", ")}, step ${lastWrite + 1})`);
        }
      }
    }

    // §3 covers every ID passed in §5
    const sec3 = sectionLines(src, 3).join("\n");
    const sec5 = sectionLines(src, 5);
    for (let i = 0; i < sec5.length; i++) {
      const line = sec5[i];
      const before = sec5.slice(0, i).join("\n");
      for (const m of line.matchAll(/\{\{tool:([a-z0-9_]+)\}\}/g)) {
        const args = balancedArgs(line, m.index + m[0].length);
        if (args === null) continue;
        const prefix = line.slice(0, m.index);
        for (const arg of splitArgs(args)) {
          const bare = arg.match(/^([a-z][A-Za-z0-9]*(?:Id|Ids))$/);
          if (!bare) continue;
          const name = bare[1];
          const word = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`);
          if (word.test(sec3) || word.test(before) || word.test(prefix)) continue;
          ctx.fail("V7", s.id, `§5 passes ${name} to ${m[1]} but no §3 Inputs row or earlier step provides it`);
        }
      }
    }

    // banned words (prose only)
    const prose = proseOnly(src);
    for (const w of BANNED_WORDS) {
      const re = new RegExp(`(?<![A-Za-z])${escapeRegex(w)}${/[a-z]$/.test(w) ? "(?![A-Za-z])" : ""}`, "i");
      if (re.test(prose)) ctx.fail("V7", s.id, `banned word "${w}" in SKILL.src.md`);
    }
    for (const r of s.references) {
      const p = proseOnly(r.content || "");
      for (const w of BANNED_WORDS) {
        const re = new RegExp(`(?<![A-Za-z])${escapeRegex(w)}${/[a-z]$/.test(w) ? "(?![A-Za-z])" : ""}`, "i");
        if (re.test(p)) ctx.fail("V7", s.id, `banned word "${w}" in ${r.path}`);
      }
    }

    // prose paragraphs ≤ 3 lines
    let run = 0;
    let runStart = 0;
    const flush = (n) => {
      if (run > 3) ctx.fail("V7", s.id, `SKILL.src.md:${runStart}: prose paragraph of ${run} lines (max 3)`);
      run = 0;
      runStart = n;
    };
    for (const l of fencedLines(src)) {
      const t = l.line.trim();
      const structural = l.inFence || !t || /^(#|\||>|[-*+]\s|\d+[.)]\s|\{\{)/.test(t);
      if (structural) flush(l.n + 1);
      else {
        if (!run) runStart = l.n;
        run++;
      }
    }
    flush(0);

    // 5-field report
    const sec8 = sectionLines(src, 8);
    const fence = [];
    let inF = false;
    for (const l of sec8) {
      if (/^\s*```/.test(l)) {
        if (inF) break;
        inF = true;
        continue;
      }
      if (inF) fence.push(l);
    }
    const labels = fence.map((l) => (l.match(/^\s*([A-Za-z][A-Za-z ]*):/) || [])[1]).filter(Boolean);
    if (labels.join(",") !== REPORT_FIELDS.join(",")) {
      ctx.fail("V7", s.id, `§8 report must be one fenced block with exactly ${REPORT_FIELDS.join(", ")} (has ${labels.join(", ") || "none"})`);
    }

    // flow references (R3): at most 15 steps
    for (const r of s.references.filter((x) => /^flow-/.test(x.name))) {
      const steps = sectionByHeading(r.content || "", "## Steps");
      if (steps === null) {
        ctx.fail("V7", s.id, `${r.path}: flow reference has no "## Steps" section`);
        continue;
      }
      const n = steps.split("\n").filter((l) => /^\s*\d+\.\s/.test(l)).length;
      if (n > 15) ctx.fail("V7", s.id, `${r.path}: flow has ${n} steps (max 15)`);
    }
  }
}

// ─── V8 links ──────────────────────────────────────────────────────────────────

function headingAnchors(text) {
  const out = new Set();
  for (const l of fencedLines(text)) {
    if (l.inFence) continue;
    const m = l.line.match(/^#{1,6}\s+(.*)$/);
    if (m) {
      const slug = m[1]
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-");
      out.add(slug);
    }
    for (const a of l.line.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) out.add(a[1]);
    for (const a of l.line.matchAll(/\{#([A-Za-z0-9_-]+)\}/g)) out.add(a[1]);
  }
  return out;
}

function markdownLinks(text) {
  const out = [];
  for (const l of fencedLines(text)) {
    if (l.inFence) continue;
    const line = l.line.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
    for (const m of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) out.push({ href: m[1], lineNo: l.n });
  }
  return out;
}

const isExternalHref = (h) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(h);

function V8(ctx) {
  const { model } = ctx;
  const internal = new Set(internalSkillIds(model));

  // Sources: {{skill:}} and {{ref:}} resolve in every bundle that renders them.
  for (const s of model.skills) {
    const refs = bundleRefs(model, s);
    const names = new Set(refs.map((r) => r.name));
    const texts = [];
    if (s.src !== null) texts.push([s.srcPath, s.src]);
    for (const r of refs) if (r.kind !== "generated" && r.content) texts.push([r.sourcePath, r.content]);
    for (const [rel, text] of texts) {
      for (const m of text.matchAll(/\{\{skill:([^}]*)\}\}/g)) {
        if (!model.skillById[m[1].trim()]) ctx.fail("V8", s.id, `${rel}: {{skill:${m[1]}}} does not exist`);
      }
      for (const m of text.matchAll(/\{\{ref:([^}]*)\}\}/g)) {
        const name = refName(m[1].trim());
        if (!names.has(name)) ctx.fail("V8", s.id, `${rel}: {{ref:${m[1]}}} is not in this skill's bundle (declare it in sharedRefs or references/)`);
      }
    }
    if (s.manifest.pack !== "internal") {
      for (const r of refs) if (r.kind === "internal") ctx.fail("V8", s.id, `core bundle links internal reference ${r.sourcePath}`);
    }
  }

  // dist: relative links, generic links, $<id>, internal skills from core bundles.
  for (const rel of ctx.distFiles) {
    if (!/\.(md|ya?ml)$/.test(rel)) continue;
    const text = ctx.read(rel) || "";
    const skill = ctx.skillOfPath(rel);
    const generic = rel.startsWith("dist/generic/");
    for (const { href, lineNo } of markdownLinks(text)) {
      if (isExternalHref(href) || href.startsWith("#")) continue;
      if (generic) {
        ctx.fail("V8", skill, `${rel}:${lineNo}: generic files must not hold relative links (${href})`);
        continue;
      }
      const [file, anchor] = href.split("#");
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), decodeURI(file)));
      const bundle = rel.split("/").slice(0, 3).join("/") + "/";
      if (!target.startsWith(bundle)) {
        ctx.fail("V8", skill, `${rel}:${lineNo}: link ${href} leaves the bundle ${bundle}`);
        continue;
      }
      if (!ctx.distSet.has(target)) {
        ctx.fail("V8", skill, `${rel}:${lineNo}: link ${href} does not resolve (${target})`);
        continue;
      }
      if (anchor && !headingAnchors(ctx.read(target) || "").has(anchor)) {
        ctx.warn("V8", skill, `${rel}:${lineNo}: anchor #${anchor} not found in ${target}`);
      }
    }
    for (const m of text.matchAll(/(?<![\w$])\$([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/g)) {
      if (!model.skillById[m[1]] && !model.external.some((e) => e.id === m[1])) ctx.fail("V8", skill, `${rel}: $${m[1]} does not resolve to a skill`);
    }
    const ownerSkill = skill ? model.skillById[skill] : null;
    if (ownerSkill && ownerSkill.manifest.pack !== "internal") {
      for (const id of internal) {
        const linkRe = new RegExp(`\\]\\([^)]*${escapeRegex(id)}[^)]*\\)`);
        if (linkRe.test(text)) ctx.fail("V8", skill, `${rel}: links internal skill ${id}; render it as plain text "(LPM maintainers only)"`);
        if (/\/references\/(tools|aliases|route)\.md$/.test(rel)) continue;
        for (const m of text.matchAll(new RegExp(`\`${escapeRegex(id)}(?:\\.md)?\``, "g"))) {
          const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
          if (!/^\s*\(LPM maintainers only\)/.test(after)) {
            ctx.warn("V8", skill, `${rel}: \`${id}\` is named without "(LPM maintainers only)"`);
            break;
          }
        }
      }
    }
  }
}

// ─── V9 CLI mentions ───────────────────────────────────────────────────────────

function cliWords(s) {
  const words = [];
  for (const w of String(s).trim().split(/\s+/)) {
    if (!/^[a-z][a-z0-9-]*$/.test(w)) break;
    words.push(w);
  }
  return words;
}

/** CLI mentions in text: code spans / fenced lines starting with `lpm ` or `aish `. */
export function cliMentions(text) {
  const out = [];
  const consider = (s) => {
    const t = String(s).trim().replace(/^\$\s+/, "");
    const m = t.match(/^(lpm|aish)\s+(.*)$/);
    if (!m) return;
    const words = cliWords(m[2]);
    if (!words.length) return;
    out.push({ raw: t.split(/\s+/).slice(0, 1 + words.length).join(" "), key: m[1] === "aish" ? ["aish", ...words] : words });
  };
  for (const l of fencedLines(text)) {
    if (l.fence) continue;
    if (l.inFence) consider(l.line);
    else for (const m of l.line.matchAll(/`([^`\n]+)`/g)) consider(m[1]);
  }
  return out;
}

function V9(ctx) {
  const { model } = ctx;
  const keys = model.catalog.cli.map((c) => c.key.split(/\s+/));
  const keySet = new Set(model.catalog.cli.map((c) => c.key));
  if (!keys.length) ctx.fail("V9", null, "catalog/lpm-cli.snapshot.json has no CLI keys");
  const startsWith = (a, b) => b.length <= a.length && b.every((w, i) => a[i] === w);
  const known = (words) => keys.some((k) => startsWith(words, k) || startsWith(k, words));
  const owners = {};
  for (const s of model.skills) {
    for (const k of s.manifest.cli) {
      (owners[k] ||= []).push(s.id);
      if (!keySet.has(k)) ctx.fail("V9", s.id, `skill.json cli "${k}" is not a key of the CLI snapshot`);
    }
  }
  for (const [k, ids] of Object.entries(owners)) if (ids.length > 1) ctx.fail("V9", null, `CLI key "${k}" is assigned to ${ids.length} skills (${ids.join(", ")})`);
  const unassigned = model.catalog.cli.filter((c) => !owners[c.key]).map((c) => c.key);
  if (unassigned.length && model.skills.length) ctx.warn("V9", null, `${unassigned.length} CLI keys are assigned to no skill (e.g. ${unassigned.slice(0, 5).join("; ")})`);
  if (!keys.length) return;
  const files = sourceTextFiles(ctx);
  for (const rel of files) {
    const text = ctx.read(rel) || "";
    for (const m of cliMentions(text)) if (!known(m.key)) ctx.fail("V9", ctx.skillOfPath(rel), `${rel}: CLI mention \`${m.raw}\` matches no CLI snapshot key`);
  }
  for (const card of Object.values(model.catalog.cards)) {
    if (!card.cli) continue;
    for (const m of cliMentions(`\`${String(card.cli).replace(/`/g, "")}\``)) {
      if (!known(m.key)) ctx.fail("V9", null, `card ${card.name}: cli \`${m.raw}\` matches no CLI snapshot key`);
    }
  }
}

// ─── V10 endpoint ──────────────────────────────────────────────────────────────

function V10(ctx) {
  const { model } = ctx;
  if (ENDPOINT !== "https://lpm.rocks/mcp") ctx.fail("V10", null, `endpoint constant is ${ENDPOINT}, expected https://lpm.rocks/mcp`);
  const internal = internalSkillIds(model);
  const exemptGlobs = ["shared/internal/**", ...internal.flatMap((id) => [`skills/${id}/**`, `dist/*/${id}/**`, `dist/generic/${id}.md`, `dist/generic/${id}.refs.md`, `dist/generic/${id}.tools.md`])].map(globToRegExp);
  const files = [...sourceTextFiles(ctx), ...model.skills.map((s) => s.manifestPath), ...ctx.distFiles, ...walk(path.join(ctx.root, "catalog/cards")).map((f) => `catalog/cards/${f}`)];
  for (const rel of sortStrings(uniq(files))) {
    const text = ctx.read(rel);
    if (text === null) continue;
    const skill = ctx.skillOfPath(rel);
    const exemptFile = matchesAny(rel, exemptGlobs);
    const examples = exampleLines(text);
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(RUN_APP_RE)) {
        const url = m[0];
        const after = line.slice(m.index + url.length);
        if (/^\/mcp\b/.test(after)) {
          ctx.fail("V10", skill, `${rel}:${i + 1}: ${url}/mcp — a run.app MCP URL is never allowed; use ${ENDPOINT}`);
          continue;
        }
        const allowed = exemptFile && CANDIDATE_TAG_RE.test(url) && (examples.has(i + 1) || /\bjq\b/.test(line));
        if (!allowed) ctx.fail("V10", skill, `${rel}:${i + 1}: ${url} — *.run.app URLs are not allowed; use ${ENDPOINT}`);
      }
      for (const m of line.matchAll(LPM_ROCKS_URL_RE)) {
        const url = m[0].replace(/[.,;:]+$/, "");
        const p = url.replace(/^https?:\/\/(?:www\.)?lpm\.rocks/, "");
        if (/^\/mcp\b/.test(p) && url !== ENDPOINT) ctx.fail("V10", skill, `${rel}:${i + 1}: MCP endpoint ${url} must be exactly ${ENDPOINT}`);
      }
    });
  }
}

// ─── V11 target conformance ────────────────────────────────────────────────────

const CODEX_KEYS = new Set(["name", "description", "license", "allowed-tools", "metadata"]);

function V11(ctx) {
  const { model } = ctx;
  for (const s of model.skills) {
    const id = s.id;
    const explicit = s.manifest.invocation === "explicit";
    // codex
    const codexMd = ctx.read(`dist/codex/${id}/SKILL.md`);
    if (codexMd !== null) {
      const fm = parseFrontmatter(codexMd);
      if (!fm) ctx.fail("V11", id, "codex SKILL.md has no frontmatter");
      else {
        for (const k of fm.keys) if (!CODEX_KEYS.has(k)) ctx.fail("V11", id, `codex SKILL.md frontmatter key "${k}" is not allowed`);
        if (yamlScalar(fm.values.name) !== id) ctx.fail("V11", id, `codex SKILL.md name "${yamlScalar(fm.values.name)}" != ${id}`);
        if (!yamlScalar(fm.values.description)) ctx.fail("V11", id, "codex SKILL.md has no description");
        for (const k of ["pack", "kind", "version"]) if (!new RegExp(`^\\s+${k}:\\s*\\S`, "m").test(fm.block)) ctx.fail("V11", id, `codex SKILL.md metadata.${k} is missing`);
      }
    }
    const yaml = ctx.read(`dist/codex/${id}/agents/openai.yaml`);
    if (yaml !== null) {
      const field = (k) => {
        const m = yaml.match(new RegExp(`^\\s+${k}:\\s*(.*)$`, "m"));
        return m ? yamlScalar(m[1]) : null;
      };
      const sd = field("short_description");
      if (sd === null || sd.length < 25 || sd.length > 64) ctx.fail("V11", id, `openai.yaml short_description must be 25–64 characters (has ${sd === null ? "none" : sd.length})`);
      const dp = field("default_prompt");
      if (!dp || !dp.includes(`$${id}`)) ctx.fail("V11", id, `openai.yaml default_prompt must contain $${id}`);
      if (!field("display_name")) ctx.fail("V11", id, "openai.yaml has no interface.display_name");
      const policyOff = /allow_implicit_invocation:\s*false/.test(yaml);
      if (explicit !== policyOff) ctx.fail("V11", id, `openai.yaml policy.allow_implicit_invocation must be ${explicit ? "false" : "absent"} for invocation ${s.manifest.invocation}`);
      if (s.manifest.owns.length + s.manifest.uses.length && !yaml.includes(ENDPOINT)) ctx.fail("V11", id, `openai.yaml dependencies must point at ${ENDPOINT}`);
    }
    // antigravity
    const ag = ctx.read(`dist/antigravity/${id}/SKILL.md`);
    if (ag !== null) {
      const fm = parseFrontmatter(ag);
      if (!fm) ctx.fail("V11", id, "antigravity SKILL.md has no frontmatter");
      else {
        const name = yamlScalar(fm.values.name);
        if (!KEBAB_RE.test(name || "") || name !== id) ctx.fail("V11", id, `antigravity name "${name}" must be lowercase-hyphen and equal ${id}`);
        for (const k of fm.keys) if (!["name", "description"].includes(k)) ctx.fail("V11", id, `antigravity SKILL.md frontmatter key "${k}" is not allowed`);
        if (!/^Use\b/.test(yamlScalar(fm.values.description) || "")) ctx.fail("V11", id, 'antigravity description must start with "Use …"');
      }
    }
    // claude-code
    const cc = ctx.read(`dist/claude-code/${id}/SKILL.md`);
    if (cc !== null) {
      const fm = parseFrontmatter(cc);
      if (!fm) ctx.fail("V11", id, "claude-code SKILL.md has no frontmatter");
      else {
        if (yamlScalar(fm.values.name) !== id) ctx.fail("V11", id, `claude-code name "${yamlScalar(fm.values.name)}" != ${id}`);
        if (fm.keys.includes("allowed-tools") && /mcp__/.test(fm.block)) ctx.fail("V11", id, "claude-code SKILL.md must not carry prefixed allowed-tools (the server prefix varies)");
        const dmi = /^disable-model-invocation:\s*true\s*$/m.test(fm.block);
        if (dmi !== explicit) ctx.fail("V11", id, `claude-code disable-model-invocation must be ${explicit ? "true" : "absent"} for invocation ${s.manifest.invocation}`);
        for (const k of fm.keys) if (!["name", "description", "disable-model-invocation", "allowed-tools"].includes(k)) ctx.fail("V11", id, `claude-code SKILL.md frontmatter key "${k}" is not allowed`);
      }
    }
    // generic
    const gen = ctx.read(`dist/generic/${id}.md`);
    if (gen !== null && gen.startsWith("---\n")) ctx.fail("V11", id, "generic files carry no frontmatter");
  }
}

// ─── V12 behavior contracts (+ LPM parity contracts) ───────────────────────────

function resolveScopeFiles(ctx, scopes, scope, target, id) {
  const patterns = (scopes && scopes[scope] && scopes[scope][target]) || null;
  const defaults = {
    skill: { generic: ["dist/generic/<id>.md"], native: ["dist/<target>/<id>/SKILL.md"] },
    bundle: { generic: ["dist/generic/<id>.md", "dist/generic/<id>.refs.md", "dist/generic/<id>.tools.md"], native: ["dist/<target>/<id>/**"] },
  };
  const list = patterns || (defaults[scope] || defaults.skill)[target === "generic" ? "generic" : "native"];
  const out = [];
  for (const p of list) {
    const pat = p.replace(/<id>/g, id).replace(/<target>/g, target);
    if (pat.includes("*")) {
      const re = globToRegExp(pat);
      out.push(...ctx.distFiles.filter((f) => re.test(f)));
    } else out.push(pat);
  }
  return uniq(out);
}

function V12(ctx) {
  const { model } = ctx;
  const raw = model.catalog.behaviorContracts;
  if (!raw) ctx.fail("V12", null, "catalog/behavior-contracts.json is missing or invalid");
  const contracts = raw && Array.isArray(raw.contracts) ? raw.contracts : [];
  for (const c of contracts) {
    const targets = Array.isArray(c.targets) && c.targets.length ? c.targets : TARGETS;
    const scope = c.scope || "skill";
    for (const id of Array.isArray(c.skills) ? c.skills : []) {
      if (!model.skillById[id]) {
        ctx.fail("V12", null, `behavior contract ${c.id}: skill ${id} does not exist`);
        continue;
      }
      for (const target of targets) {
        const files = resolveScopeFiles(ctx, raw.scopes, scope, target, id);
        const texts = [];
        for (const f of files) {
          const t = ctx.read(f);
          if (t === null) {
            ctx.fail("V12", id, `behavior contract ${c.id} (${target}): ${f} does not exist`);
            continue;
          }
          let body = t;
          if (c.section) {
            body = sectionByHeading(t, c.section);
            if (body === null) {
              ctx.fail("V12", id, `behavior contract ${c.id} (${target}): ${f} has no section "${c.section}"`);
              continue;
            }
          }
          texts.push([f, body]);
        }
        if (!files.length) ctx.fail("V12", id, `behavior contract ${c.id} (${target}): no file matches scope ${scope}`);
        for (const a of Array.isArray(c.assertions) ? c.assertions : []) {
          const cs = a.caseSensitive !== false;
          const has = (body) => (cs ? body.includes(a.text) : body.toLowerCase().includes(String(a.text).toLowerCase()));
          if (a.kind === "contains") {
            if (scope === "bundle") {
              if (texts.length && !texts.some(([, b]) => has(b))) ctx.fail("V12", id, `behavior contract ${c.id} (${target}): "${a.text}" is missing from the bundle`);
            } else {
              for (const [f, b] of texts) if (!has(b)) ctx.fail("V12", id, `behavior contract ${c.id} (${target}): "${a.text}" is missing from ${f}${c.section ? ` § ${c.section}` : ""}`);
            }
          } else if (a.kind === "absent") {
            for (const [f, b] of texts) if (has(b)) ctx.fail("V12", id, `behavior contract ${c.id} (${target}): "${a.text}" must not appear in ${f}`);
          } else {
            ctx.fail("V12", id, `behavior contract ${c.id}: unknown assertion kind "${a.kind}"`);
          }
        }
      }
    }
  }
  // LPM parity contracts (§7.1): every tool and phrase appears in every renderIn file.
  const { coverage } = ctx.build();
  for (const c of coverage.contracts) {
    if (!c.renderIn.length) ctx.fail("V12", null, `parity contract ${c.id}: renderIn resolves to no file`);
    for (const f of c.renderIn) {
      const text = ctx.read(f);
      if (text === null) continue; // V19 reports missing files
      for (const t of c.tools) if (!new RegExp(`(?<![a-z0-9_])${t}(?![a-z0-9_])`).test(text)) ctx.fail("V12", ctx.skillOfPath(f), `parity contract ${c.id}: ${f} does not mention ${t}`);
      for (const p of c.phrases) if (!text.includes(p)) ctx.fail("V12", ctx.skillOfPath(f), `parity contract ${c.id}: ${f} does not contain "${p}"`);
    }
  }
}

// ─── V13 secrets and denylist ──────────────────────────────────────────────────

function V13(ctx) {
  const { model, root } = ctx;
  const scanRoots = ["catalog", "shared", "skills", "dist", "docs", "templates"];
  const all = [];
  for (const d of scanRoots) for (const f of walk(path.join(root, d))) all.push(`${d}/${f}`);
  if (readText(path.join(root, "README.md")) !== null) all.push("README.md");
  const textFiles = all.filter((f) => /\.(md|json|ya?ml|txt|sh|mjs|js|ts)$/.test(f));
  for (const rel of textFiles) {
    const text = ctx.read(rel) || "";
    text.split("\n").forEach((line, i) => {
      for (const p of SECRET_PATTERNS) if (p.re.test(line)) ctx.fail("V13", ctx.skillOfPath(rel), `${rel}:${i + 1}: possible secret (${p.id})`);
    });
  }
  const dl = model.catalog.denylist;
  if (!dl) {
    ctx.fail("V13", null, "catalog/denylist.json is missing or invalid");
    return;
  }
  const entries = (Array.isArray(dl.entries) ? dl.entries : Array.isArray(dl) ? dl : []).filter((e) => e && (e.pattern || e.literal));
  const compiled = [];
  for (const e of entries) {
    try {
      const src = e.pattern || escapeRegex(e.literal);
      compiled.push({ id: e.id || src, re: new RegExp(src, `u${(e.flags || "").replace(/[gu]/g, "")}`) });
    } catch (err) {
      ctx.fail("V13", null, `denylist.json: entry ${e.id}: invalid pattern (${err.message})`);
    }
  }
  const scan = (Array.isArray(dl.scan) && dl.scan.length ? dl.scan : ["catalog/cards/**", "dist/**", "shared/**", "skills/**"]).map(globToRegExp);
  const exempt = [...(Array.isArray(dl.exemptPaths) ? dl.exemptPaths : []), "shared/internal/**", "catalog/denylist.json"].map(globToRegExp);
  const legacy = model.legacySkillDirs.map((d) => globToRegExp(`skills/${d}/**`));
  let legacySkipped = 0;
  for (const rel of textFiles) {
    if (!matchesAny(rel, scan) || matchesAny(rel, exempt)) continue;
    if (matchesAny(rel, legacy)) {
      legacySkipped++;
      continue;
    }
    const text = ctx.read(rel) || "";
    const examples = exampleLines(text);
    text.split("\n").forEach((line, i) => {
      if (examples.has(i + 1)) return;
      for (const c of compiled) {
        const m = line.match(c.re);
        if (m) ctx.fail("V13", ctx.skillOfPath(rel), `${rel}:${i + 1}: denylisted literal (${c.id}) "${m[0]}"`);
      }
    });
  }
  if (legacySkipped) ctx.warn("V13", null, `denylist scan skipped ${legacySkipped} files of legacy skill directories (${model.legacySkillDirs.length} dirs, removed by §6.6)`);
}

// ─── V14 sizes ─────────────────────────────────────────────────────────────────

const KB = 1024;
const lineCount = (t) => String(t).replace(/\n$/, "").split("\n").length;
const byteLen = (t) => Buffer.byteLength(String(t), "utf8");

function V14(ctx) {
  const { model } = ctx;
  for (const s of model.skills) {
    const id = s.id;
    const d = s.manifest.description;
    if (d.length > 330) ctx.fail("V14", id, `description is ${d.length} characters (max 330)`);
    else if (d.length > 300) ctx.warn("V14", id, `description is ${d.length} characters (target ≤300)`);
    for (const t of NATIVE_TARGETS) {
      const rel = `dist/${t}/${id}/SKILL.md`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const n = lineCount(text);
      const b = byteLen(text);
      if (n > 200) ctx.fail("V14", id, `${rel}: ${n} lines (max 200)`);
      if (b > 14 * KB) ctx.fail("V14", id, `${rel}: ${(b / KB).toFixed(1)} KB (max 14 KB)`);
      const lines = text.split("\n");
      const a = lines.findIndex((l) => /^##\s+1[.\s]/.test(l));
      const z = lines.findIndex((l) => /^##\s+10[.\s]/.test(l));
      if (a >= 0) {
        const body = (z > a ? z : lines.length) - a;
        if (body > 150) ctx.fail("V14", id, `${rel}: §1–§9 are ${body} lines (max 150)`);
      }
    }
    const gen = ctx.read(`dist/generic/${id}.md`);
    if (gen !== null && byteLen(gen) > 24 * KB) ctx.fail("V14", id, `dist/generic/${id}.md: ${(byteLen(gen) / KB).toFixed(1)} KB (max 24 KB)`);
    const refs = ctx.read(`dist/generic/${id}.refs.md`);
    if (refs !== null && byteLen(refs) > 64 * KB) ctx.warn("V14", id, `dist/generic/${id}.refs.md: ${(byteLen(refs) / KB).toFixed(1)} KB (above 64 KB)`);
    // Tool cards are split out of <id>.refs.md: a generic agent opens them only when a call fails.
    const cards = ctx.read(`dist/generic/${id}.tools.md`);
    if (cards !== null && byteLen(cards) > 128 * KB) ctx.warn("V14", id, `dist/generic/${id}.tools.md: ${(byteLen(cards) / KB).toFixed(1)} KB (above 128 KB)`);
    for (const r of bundleRefs(model, s)) {
      if (r.kind === "generated") continue;
      const rel = `dist/codex/${id}/references/${r.name}.md`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const template = /-template$/.test(r.name);
      const maxLines = template ? 60 : 120;
      const n = lineCount(text);
      const b = byteLen(text);
      const report = r.kind === "local" ? ctx.fail : ctx.warn;
      if (n > maxLines) report("V14", id, `${r.kind} reference ${r.name}.md: ${n} lines (max ${maxLines})`);
      if (b > 8 * KB) report("V14", id, `${r.kind} reference ${r.name}.md: ${(b / KB).toFixed(1)} KB (max 8 KB)`);
    }
  }
}

// ─── V15 drift ─────────────────────────────────────────────────────────────────

function V15(ctx) {
  const { root } = ctx;
  const { outputs } = ctx.build();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agents-skills-check-"));
  try {
    writeOutputs(tmp, outputs);
    const rendered = new Set(outputs.keys());
    for (const rel of outputs.keys()) {
      let fresh;
      let committed;
      try {
        fresh = fs.readFileSync(path.join(tmp, rel));
      } catch {
        fresh = Buffer.from(outputs.get(rel));
      }
      try {
        committed = fs.readFileSync(path.join(root, rel));
      } catch {
        ctx.fail("V15", ctx.skillOfPath(rel), `${rel} is missing; run node scripts/skills.mjs build`);
        continue;
      }
      if (!fresh.equals(committed)) ctx.fail("V15", ctx.skillOfPath(rel), `${rel} differs from a fresh build; run node scripts/skills.mjs build`);
    }
    for (const rel of ctx.distFiles) {
      if (!rendered.has(rel)) ctx.fail("V15", ctx.skillOfPath(rel), `${rel} is not produced by the build (stale); run node scripts/skills.mjs build`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const committed = readJson(path.join(root, COVERAGE_PATH)).value;
  const expected = computeSourcesHash(root, ctx.model);
  const actual = committed && committed.source ? committed.source.sourcesHash : null;
  if (actual !== expected) ctx.fail("V15", null, `coverage.json source.sourcesHash ${actual || "missing"} != recomputed ${expected}`);
}

// ─── V16 router ────────────────────────────────────────────────────────────────

function decidedByOrders(v) {
  if (v === undefined || v === null) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.flatMap((x) => (typeof x === "number" ? [x] : String(x).match(/\d+/g) || []).map(Number));
}

async function V16(ctx) {
  const { model } = ctx;
  const rows = routingRows(model);
  const orders = new Set();
  for (const r of rows) {
    const where = `routing order ${r.order}`;
    if (!Number.isInteger(Number(r.order)) || r.order === null || r.order === "") ctx.fail("V16", r.skill, `${where}: order must be an integer`);
    orders.add(Number(r.order));
    if (!Array.isArray(r.all) || !r.all.length) ctx.fail("V16", r.skill, `${where}: "all" must be a non-empty list of groups`);
    r.all.forEach((g, gi) => {
      if (!g.length) ctx.fail("V16", r.skill, `${where}: group ${gi + 1} of "all" is empty`);
      for (const term of g) if (!routerTokens(String(term).replace(/\*$/, "")).length) ctx.fail("V16", r.skill, `${where}: term "${term}" is empty after normalization`);
    });
    for (const term of r.unless) if (!routerTokens(String(term).replace(/\*$/, "")).length) ctx.fail("V16", r.skill, `${where}: unless term "${term}" is empty after normalization`);
    if (!String(r.firstCall || "").trim()) ctx.fail("V16", r.skill, `${where}: firstCall is empty`);
    if (r.pack === "internal") {
      const rawRow = model.skillById[r.skill].manifest.routing.find((x) => x.order === r.order) || {};
      if (rawRow.internal !== true) ctx.fail("V16", r.skill, `${where}: an internal skill's row needs "internal": true`);
      if (!String(rawRow.stopText || "").trim()) ctx.fail("V16", r.skill, `${where}: an internal row needs a stopText`);
    }
  }
  for (const s of model.skills) if (s.manifest.pack === "core" && !s.manifest.routing.length) ctx.fail("V16", s.id, "core skill has no routing row");

  const legacyRaw = readJson(path.join(ctx.root, "catalog/legacy-ids.json")).value;
  const legacyRow = legacyRaw && Number.isInteger(legacyRaw.routerRow) ? legacyRaw.routerRow : null;
  const maxOrder = Math.max(0, ...orders, legacyRow || 0);
  const validRows = new Set([...orders, ...(legacyRow ? [legacyRow] : []), maxOrder + 1]);
  const examples = model.catalog.routingExamples;
  if (!examples.length) ctx.fail("V16", null, "catalog/routing-examples.json has no entries");
  for (const e of examples) {
    const id = e.id || JSON.stringify(e.prompt).slice(0, 40);
    if (!e.expected || !model.skillById[e.expected]) ctx.fail("V16", null, `routing example ${id}: expected skill "${e.expected}" does not exist`);
    if (!e.prompt || (Array.isArray(e.prompt) && !e.prompt.length)) ctx.fail("V16", null, `routing example ${id}: prompt is empty`);
    if (e.collision === true) {
      const d = decidedByOrders(e.decidedBy);
      if (!d.length) ctx.fail("V16", null, `collision row ${id}: decidedBy is missing`);
      for (const o of d) if (!validRows.has(o)) ctx.fail("V16", null, `collision row ${id}: decidedBy row ${o} does not exist`);
      if (!e.says) ctx.fail("V16", null, `collision row ${id}: "says" is missing (it renders the §2.3 table)`);
    }
  }
  if (!examples.some((e) => e.collision === true)) ctx.warn("V16", null, "routing-examples.json has no collision rows (§2.3)");

  // Every skill.json job is a routing case for its own skill (warning: jobs are not gated examples).
  const router = await loadRouterMatch();
  if (router) {
    const table = router.routerTable(model);
    for (const s of model.skills) {
      for (const job of s.manifest.jobs) {
        const m = router.matchRequest(table, String(job));
        const got = m && (m.skill || (m.row && m.row.skill));
        if (got !== s.id) {
          const order = m && (m.order ?? (m.row && m.row.order));
          ctx.warn("V16", s.id, `job "${job}" routes to ${got || "no skill"}${order !== undefined && order !== null ? ` (row ${order})` : ""}, not to ${s.id}; fix the routing rows and add the job to routing-examples.json`);
        }
      }
    }
  }

  // eval --router must score 100 %.
  const evalFn = ctx.opts.evalRouter || (await loadRouterEval());
  if (!evalFn) {
    ctx.warn("V16", null, "eval --router is not available (scripts/lib/router.mjs evalRouter missing)");
    return;
  }
  const lines = [];
  const capture = (...a) => lines.push(a.join(" "));
  let code;
  try {
    const r = await evalFn({ root: ctx.root, flags: { router: true }, args: [], log: { info: capture, warn: capture, error: capture }, model });
    code = typeof r === "number" ? r : r && typeof r.exitCode === "number" ? r.exitCode : r && r.ok === false ? 1 : 0;
  } catch (err) {
    if (/not implemented/i.test(err.message)) {
      ctx.warn("V16", null, `eval --router not implemented yet (${err.message})`);
      return;
    }
    ctx.fail("V16", null, `eval --router threw: ${err.message}`);
    return;
  }
  if (code !== 0) {
    const detail = lines.filter((l) => l.trim()).slice(0, 5).join(" | ");
    ctx.fail("V16", null, `eval --router is below 100 % (exit ${code})${detail ? `: ${detail}` : ""}`);
  }
}

async function loadRouterMatch() {
  try {
    const mod = await import("./router.mjs");
    return typeof mod.matchRequest === "function" && typeof mod.routerTable === "function" ? mod : null;
  } catch {
    return null;
  }
}

async function loadRouterEval() {
  try {
    const mod = await import("./router.mjs");
    return typeof mod.evalRouter === "function" ? mod.evalRouter : null;
  } catch {
    return null;
  }
}

// ─── V17 external ──────────────────────────────────────────────────────────────

const EXTERNAL_STATUS = ["planned", "active", "deprecated"];
const PINNED_REF_RE = /^(?:[0-9a-f]{7,40}|v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?|refs\/tags\/\S+)$/;

function V17(ctx) {
  const { model, root } = ctx;
  for (const e of model.external) {
    const rel = `${e.path}/metadata.json`;
    const m = e.metadata;
    if (!m) {
      ctx.fail("V17", null, `${rel} is missing or invalid`);
      continue;
    }
    for (const f of ["id", "source_type", "status", "upstream_repo", "upstream_ref"]) {
      if (typeof m[f] !== "string" || !m[f].trim()) ctx.fail("V17", null, `${rel}: field "${f}" is missing`);
    }
    if (m.id && m.id !== e.id) ctx.fail("V17", null, `${rel}: id "${m.id}" != directory "${e.id}"`);
    if (!EXTERNAL_STATUS.includes(m.status)) ctx.fail("V17", null, `${rel}: status "${m.status}" must be one of ${EXTERNAL_STATUS.join(", ")}`);
    if (m.status === "active" && !PINNED_REF_RE.test(String(m.upstream_ref || ""))) {
      ctx.fail("V17", null, `${rel}: active bundle must pin upstream_ref to a commit or tag (has "${m.upstream_ref}")`);
    }
    const files = walk(path.join(root, e.path)).filter((f) => f !== "metadata.json");
    if (m.files_sha256 === undefined) {
      ctx.warn("V17", null, `${rel}: files_sha256 is missing (record it at the next sync)`);
    } else if (!m.files_sha256 || typeof m.files_sha256 !== "object" || Array.isArray(m.files_sha256)) {
      ctx.fail("V17", null, `${rel}: files_sha256 must be a {path: sha256} map`);
    } else {
      const listed = m.files_sha256;
      for (const f of files) {
        if (!(f in listed)) {
          ctx.fail("V17", null, `${e.path}/${f} is not listed in files_sha256`);
          continue;
        }
        const actual = sha256(fs.readFileSync(path.join(root, e.path, f)));
        const want = String(listed[f]).replace(/^sha256:/, "");
        if (actual !== want) ctx.fail("V17", null, `${e.path}/${f}: sha256 differs from files_sha256 (rewritten?)`);
      }
      for (const f of Object.keys(listed)) if (!files.includes(f)) ctx.fail("V17", null, `${rel}: files_sha256 lists ${f}, which does not exist`);
    }
    for (const t of TARGETS) {
      const hit = ctx.distFiles.find((f) => f.startsWith(`dist/${t}/${e.id}/`) || f === `dist/generic/${e.id}.md`);
      if (hit) ctx.fail("V17", null, `external bundle ${e.id} is rendered into dist/ (${hit}); external bundles are never rendered`);
    }
  }
}

// ─── V18 snapshot --check (local, with --lpm) ──────────────────────────────────

async function V18(ctx) {
  const lpm = ctx.opts.lpm;
  if (!lpm) return;
  const runSnapshot = ctx.opts.runSnapshot || (await import("./snapshot.mjs")).runSnapshot;
  const lines = [];
  const capture = (...a) => lines.push(a.join(" "));
  let res;
  try {
    res = runSnapshot(ctx.root, { lpm: path.resolve(String(lpm)), check: true, log: { info: capture, warn: capture, error: capture } });
  } catch (err) {
    ctx.fail("V18", null, `snapshot --check --lpm ${lpm} failed: ${err.message}`);
    return;
  }
  if (!res || res.exitCode !== 0) {
    const detail = [...(res && res.changed ? res.changed.map((c) => `changed ${c}`) : []), ...(res && res.stubs && res.stubs.length ? [`${res.stubs.length} tools without a card`] : []), ...lines]
      .filter(Boolean)
      .slice(0, 6)
      .join(" | ");
    ctx.fail("V18", null, `snapshot --check --lpm ${lpm}: the snapshot differs from LPM${detail ? `: ${detail}` : ""}`);
  }
}

// ─── V19 rendered completeness ─────────────────────────────────────────────────

function V19(ctx) {
  const { model, root } = ctx;
  const cov = readJson(path.join(root, COVERAGE_PATH));
  if (!cov.value) {
    ctx.fail("V19", null, `${COVERAGE_PATH} is ${cov.missing ? "missing" : "invalid"}; run node scripts/skills.mjs build`);
    return;
  }
  const c = cov.value;
  const listed = new Set();
  for (const s of Array.isArray(c.skills) ? c.skills : []) {
    listed.add(s.id);
    const rendered = s.rendered || {};
    for (const t of TARGETS) {
      const p = rendered[t];
      if (!p) ctx.fail("V19", s.id, `coverage.json skills[${s.id}].rendered.${t} is missing`);
      else if (!fs.existsSync(path.join(root, p))) ctx.fail("V19", s.id, `coverage.json rendered.${t} ${p} does not exist in dist/`);
    }
  }
  for (const s of model.skills) if (!listed.has(s.id)) ctx.fail("V19", s.id, "skill is missing from coverage.json skills[]; run build");
  for (const k of Array.isArray(c.contracts) ? c.contracts : []) {
    if (!Array.isArray(k.renderIn) || !k.renderIn.length) ctx.fail("V19", null, `coverage.json contract ${k.id} has no renderIn path`);
    for (const p of Array.isArray(k.renderIn) ? k.renderIn : []) {
      if (!fs.existsSync(path.join(root, p))) ctx.fail("V19", ctx.skillOfPath(p), `coverage.json contract ${k.id}: renderIn ${p} does not exist`);
    }
  }
}

// ─── V20 trace flows ↔ skills ──────────────────────────────────────────────────

/** Groups of tool names a trace spec requires: a plain/unordered spec → one group per tool; anyOf → one group. */
function traceSpecGroups(spec) {
  if (typeof spec === "string") return [[spec]];
  if (!spec || typeof spec !== "object") return [];
  if (Array.isArray(spec.anyOf)) return [spec.anyOf.flatMap((x) => traceSpecGroups(x).flat())];
  if (Array.isArray(spec.unordered)) return spec.unordered.flatMap(traceSpecGroups);
  return typeof spec.tool === "string" ? [[spec.tool]] : [];
}

/**
 * Trace flows (evals/trace/<flow>.json) are hand-kept copies of skill procedures. Each flow's skill
 * must exist, and every tool the flow expects to be called (orderedCalls, requiresVerify) must be
 * named in that skill's sources: SKILL.src.md, its references, or a shared reference it bundles.
 */
function V20(ctx) {
  const { model, root } = ctx;
  const dir = path.join(root, "evals/trace");
  for (const f of sortStrings(walk(dir).filter((x) => x.endsWith(".json") && !x.includes("/")))) {
    const rel = `evals/trace/${f}`;
    const flow = readJson(path.join(dir, f)).value;
    if (!flow || typeof flow !== "object") {
      ctx.fail("V20", null, `${rel}: invalid JSON`);
      continue;
    }
    const skill = model.skillById[flow.skill];
    if (!skill) {
      ctx.fail("V20", null, `${rel}: skill "${flow.skill}" does not exist`);
      continue;
    }
    const texts = [skill.src || "", ...bundleRefs(model, skill).map((r) => r.content || "")].join("\n");
    const named = (t) => !t.includes("*") && new RegExp(`(?<![a-z0-9_])${escapeRegex(t)}(?![a-z0-9_])`).test(texts);
    const e = (flow.expect && typeof flow.expect === "object" && flow.expect) || {};
    const specs = [...(Array.isArray(e.orderedCalls) ? e.orderedCalls : [])];
    for (const v of Array.isArray(e.requiresVerify) ? e.requiresVerify : []) if (v && typeof v === "object") specs.push(v.after, v.read);
    const missing = new Set();
    for (const spec of specs) {
      for (const group of traceSpecGroups(spec)) {
        const real = group.filter((t) => !t.includes("*"));
        if (real.length && !real.some(named)) missing.add(real.join(" | "));
      }
    }
    for (const m of sortStrings([...missing])) ctx.fail("V20", skill.id, `${rel}: expects ${m}, which ${skill.id} never names (SKILL.src.md, references, bundled shared refs)`);
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────────

const IMPL = { V1, V2, V3, V4, V4g, V4w, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, V15, V16, V17, V18, V19, V20 };

/** Model warnings that are not owned by a validator, reported as warnings ("load"). */
const LOAD_HANDLED = new Set(["duplicate-card", "invalid-card", "duplicate-skill", "duplicate-owner"]);

/**
 * Runs the validators against a loaded model. Prints nothing.
 * @param {object} model loadModel(root)
 * @param {{lpm?: string, only?: string[], today?: string, evalRouter?: Function, runSnapshot?: Function}} [opts]
 *   `evalRouter` / `runSnapshot` replace router.mjs evalRouter (V16) and snapshot.mjs runSnapshot (V18), for tests.
 * @returns {Promise<{ok: boolean, failures: object[], warnings: object[]}>}
 */
export async function validate(model, opts = {}) {
  const ctx = makeCtx(model, opts);
  const only = opts.only ? new Set(opts.only) : null;
  for (const w of model.warnings) {
    if (LOAD_HANDLED.has(w.code)) continue;
    if (w.code === "invalid-json" && !/^(skills|catalog\/cards)\//.test(w.file || "")) ctx.fail("load", null, w.message);
    else if (w.code !== "invalid-json") ctx.warn("load", null, `[${w.code}] ${w.message}`);
  }
  for (const v of VALIDATORS) {
    if (only && !only.has(v)) continue;
    if (v === "V18" && !opts.lpm) continue;
    try {
      await IMPL[v](ctx);
    } catch (err) {
      ctx.fail(v, null, `validator crashed: ${err.message}`);
    }
  }
  const failures = sortFindings(dedupe(ctx.failures));
  const warnings = sortFindings(dedupe(ctx.warnings));
  return { ok: failures.length === 0, failures, warnings };
}

function formatFinding(f) {
  return `${f.validator} ${f.skill || "infra"} ${f.message}`;
}

/**
 * `skills.mjs check [--json] [--lpm <dir>]`.
 * Accepts the dispatcher's opts ({root, flags, args, log}) or (model, opts).
 * @returns {Promise<{exitCode: number, ok: boolean, failures: object[], warnings: object[]}>}
 */
export async function runCheck(a, b) {
  const isModel = a && typeof a === "object" && a.catalog && Array.isArray(a.skills);
  const opts = (isModel ? b : a) || {};
  const flags = opts.flags || {};
  const log = opts.log || { info: (...x) => console.log(...x), warn: (...x) => console.error(...x), error: (...x) => console.error(...x) };
  const root = isModel ? a.root : path.resolve(opts.root || process.cwd());
  const model = isModel ? a : loadModel(root);
  const lpm = opts.lpm || (typeof flags.lpm === "string" ? flags.lpm : null);
  if (flags.lpm === true) {
    log.error("error: --lpm needs a directory");
    return { exitCode: 2, ok: false, failures: [], warnings: [] };
  }
  const json = Boolean(opts.json || flags.json);
  const result = await validate(model, { lpm, today: opts.today, evalRouter: opts.evalRouter, runSnapshot: opts.runSnapshot, only: opts.only });
  if (json) {
    log.info(JSON.stringify({ ok: result.ok, failures: result.failures, warnings: result.warnings }, null, 2));
  } else {
    for (const f of result.failures) log.info(formatFinding(f));
    const max = flags.verbose ? Infinity : 50;
    result.warnings.slice(0, max).forEach((w) => log.warn(`warning ${formatFinding(w)}`));
    if (result.warnings.length > max) log.warn(`… ${result.warnings.length - max} more warnings (use --verbose)`);
    const ran = VALIDATORS.filter((v) => v !== "V18" || lpm).length;
    log.info(
      `check: ${result.ok ? "ok" : "FAILED"} · ${result.failures.length} failures · ${result.warnings.length} warnings · ${ran} validators${lpm ? "" : " (V18 skipped: no --lpm)"}`,
    );
  }
  return { exitCode: result.ok ? 0 : 1, ...result };
}
