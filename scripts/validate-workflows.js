#!/usr/bin/env node
/**
 * validate-workflows.js
 * WeFlow-X — n8n Workflow JSON Validator
 *
 * Checks every JSON file in workflows/ for:
 *   1. Valid JSON syntax
 *   2. Required top-level fields (name, nodes, connections)
 *   3. Each node has: name, type, position
 *   4. Connections reference nodes that actually exist
 *   5. No unfilled placeholder values (YOUR_*, <REPLACE_ME>, etc.)
 *   6. Meta block present with at least: description, tool/tools, verified
 *
 * Exit 0 = all valid. Exit 1 = one or more failures.
 */

const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKFLOWS_DIR = path.resolve(__dirname, "../workflows");

const REQUIRED_TOP_LEVEL = ["name", "nodes", "connections"];
const REQUIRED_NODE_FIELDS = ["name", "type", "position"];

// Regex patterns that indicate an unfilled placeholder
const PLACEHOLDER_PATTERNS = [
  /YOUR_[A-Z_]+/,
  /YOUR-[A-Z0-9-]+/,
  /<REPLACE_ME>/i,
  /INSERT_[A-Z_]+/,
  /FIXME/,
  /TODO:/i,
];

// Placeholders that are intentionally left in template files — skip these
const ALLOWED_PLACEHOLDERS = new Set([
  "YOUR_VOICE_CLONE_ID",
  "YOUR_AVATAR_ID",
  "YOUR_VOICE_ID",
  "YOUR_GOOGLE_DRIVE_FOLDER_ID",
  "YOUR_TELEGRAM_CHAT_ID",
  "YOUR-N8N-INSTANCE.com",
  "YOUR-N8N-INSTANCE",
  "YOUR-N8N.com",
  "YOUR_API_KEY",  // intentional in meta.auth documentation strings
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;

function error(file, msg) {
  console.error(`  ❌  ${msg}`);
  totalErrors++;
}

function warn(file, msg) {
  console.warn(`  ⚠️   ${msg}`);
  totalWarnings++;
}

function ok(msg) {
  console.log(`  ✅  ${msg}`);
}

/**
 * Recursively walk all string values in an object and check for placeholders.
 * Returns an array of { path, value } hits.
 */
function findPlaceholders(obj, pathParts = []) {
  const hits = [];
  if (typeof obj === "string") {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = obj.match(pattern);
      if (match) {
        const token = match[0];
        if (!ALLOWED_PLACEHOLDERS.has(token)) {
          hits.push({ path: pathParts.join("."), value: obj });
        }
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      hits.push(...findPlaceholders(item, [...pathParts, `[${i}]`]))
    );
  } else if (obj && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      hits.push(...findPlaceholders(val, [...pathParts, key]));
    }
  }
  return hits;
}

// ─── Validator ───────────────────────────────────────────────────────────────

function validateWorkflow(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📄 ${filename}`);

  // 1. Parse JSON
  let workflow;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    workflow = JSON.parse(raw);
  } catch (e) {
    error(filename, `Invalid JSON: ${e.message}`);
    return;
  }
  ok("Valid JSON syntax");

  // 2. Required top-level fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in workflow)) {
      error(filename, `Missing required top-level field: "${field}"`);
    }
  }
  if (REQUIRED_TOP_LEVEL.every((f) => f in workflow)) {
    ok(`Top-level fields present: ${REQUIRED_TOP_LEVEL.join(", ")}`);
  }

  // 3. nodes is a non-empty array
  const nodes = workflow.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    error(filename, `"nodes" must be a non-empty array`);
    return;
  }
  ok(`${nodes.length} node(s) found`);

  // 4. Each node has required fields
  const nodeNames = new Set();
  for (const [i, node] of nodes.entries()) {
    for (const field of REQUIRED_NODE_FIELDS) {
      if (!(field in node)) {
        error(filename, `Node[${i}] ("${node.name ?? "?"}") missing field: "${field}"`);
      }
    }
    if (node.name) {
      if (nodeNames.has(node.name)) {
        error(filename, `Duplicate node name: "${node.name}"`);
      }
      nodeNames.add(node.name);
    }
  }
  ok(`All nodes have required fields`);

  // 5. Connections reference existing nodes
  const connections = workflow.connections ?? {};
  for (const [sourceName, outputs] of Object.entries(connections)) {
    if (!nodeNames.has(sourceName)) {
      error(filename, `Connection source "${sourceName}" is not a defined node`);
    }
    const allTargets = Object.values(outputs)
      .flat(2)
      .filter(Boolean)
      .map((t) => t.node);
    for (const target of allTargets) {
      if (target && !nodeNames.has(target)) {
        error(filename, `Connection target "${target}" is not a defined node`);
      }
    }
  }
  ok(`Connections reference valid nodes`);

  // 6. Unfilled placeholders (warn, not error — templates are expected to have them)
  const hits = findPlaceholders(workflow);
  if (hits.length > 0) {
    for (const h of hits) {
      warn(filename, `Unfilled placeholder at ${h.path}: ${h.value.substring(0, 80)}`);
    }
  } else {
    ok(`No unexpected placeholders found`);
  }

  // 7. Meta block
  if (!workflow.meta) {
    warn(filename, `No "meta" block — consider adding description, tool, verified`);
  } else {
    const meta = workflow.meta;
    if (!meta.description) warn(filename, `meta.description is missing`);
    if (!meta.tool && !meta.tools) warn(filename, `meta.tool / meta.tools is missing`);
    if (!meta.verified) warn(filename, `meta.verified date is missing`);
    ok(`Meta block present`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("🔍 WeFlow-X n8n Workflow Validator\n");

  if (!fs.existsSync(WORKFLOWS_DIR)) {
    console.error(`workflows/ directory not found at ${WORKFLOWS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(WORKFLOWS_DIR, f));

  if (files.length === 0) {
    console.warn("No JSON files found in workflows/");
    process.exit(0);
  }

  console.log(`Found ${files.length} workflow file(s) to validate.\n`);

  for (const file of files) {
    validateWorkflow(file);
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`Results: ${files.length} files — ${totalErrors} error(s), ${totalWarnings} warning(s)`);

  if (totalErrors > 0) {
    console.error("\n❌ Validation FAILED — fix errors above before merging.\n");
    process.exit(1);
  } else {
    console.log("\n✅ All workflows valid.\n");
    process.exit(0);
  }
}

main();
