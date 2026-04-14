#!/usr/bin/env node
/**
 * check-pricing.js
 * WeFlow-X — Pricing Page Change Detector
 *
 * Fetches the pricing pages for ElevenLabs, HeyGen, and Kling AI,
 * extracts key pricing signals (plan names, prices, credit amounts),
 * compares against the last known snapshot stored in .pricing-cache/,
 * and writes a JSON report to stdout (for GitHub Actions to consume).
 *
 * Output JSON:
 * {
 *   changes: [{ tool, field, old, new, url }],
 *   checked_at: ISO string,
 *   all_ok: boolean
 * }
 *
 * Exit 0 always — change detection is non-blocking.
 * The GitHub Actions workflow reads the output and opens issues.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.resolve(__dirname, "../.pricing-cache");

// ─── Pricing targets ─────────────────────────────────────────────────────────

const TARGETS = [
  {
    tool: "ElevenLabs",
    url: "https://elevenlabs.io/pricing",
    // Signals: price strings we expect to see on the page
    signals: [
      { key: "starter_price", pattern: /\$5\s*\/\s*mo/i, label: "Starter plan $5/mo" },
      { key: "creator_price", pattern: /\$22\s*\/\s*mo/i, label: "Creator plan $22/mo" },
      { key: "pro_price", pattern: /\$99\s*\/\s*mo/i, label: "Pro plan $99/mo" },
      { key: "scale_price", pattern: /\$330\s*\/\s*mo/i, label: "Scale plan $330/mo" },
      { key: "creator_chars", pattern: /100[,\s]?000\s*(chars|characters)/i, label: "Creator 100K chars" },
    ],
  },
  {
    tool: "HeyGen",
    url: "https://www.heygen.com/pricing",
    signals: [
      { key: "creator_price", pattern: /\$29\s*\/\s*(mo|month)/i, label: "Creator plan $29/mo" },
      { key: "pro_price", pattern: /\$99\s*\/\s*(mo|month)/i, label: "Pro plan $99/mo" },
      { key: "scale_price", pattern: /\$330\s*\/\s*(mo|month)/i, label: "Scale API $330/mo" },
      { key: "avatar_iv_credits", pattern: /20\s*(premium\s*)?credits?\s*(\/\s*min|per\s*min)/i, label: "Avatar IV 20 credits/min" },
      { key: "creator_credits", pattern: /200\s*(premium\s*)?credits?/i, label: "Creator 200 credits" },
    ],
  },
  {
    tool: "Kling AI",
    url: "https://klingai.com/pricing",
    signals: [
      { key: "pro_price", pattern: /\$37\s*\/\s*(mo|month)/i, label: "Pro plan $37/mo" },
      { key: "premier_price", pattern: /\$92\s*\/\s*(mo|month)/i, label: "Premier plan $92/mo" },
      { key: "pro_credits", pattern: /3[,\s]?000\s*credits/i, label: "Pro 3,000 credits" },
      { key: "api_rate_5s", pattern: /\$0\.14/i, label: "API $0.14/5s video" },
      { key: "api_rate_per_sec", pattern: /\$0\.075\s*\/\s*s/i, label: "API $0.075/s" },
    ],
  },
];

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

function fetchPage(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; WeFlowX-PricingBot/1.0; +https://github.com/ishaycopy-wq/weflow-podcast-n8n)",
          Accept: "text/html,application/xhtml+xml",
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Follow one redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchPage(res.headers.location, timeoutMs).then(resolve).catch(reject);
        }
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheFile(tool) {
  return path.join(CACHE_DIR, `${tool.replace(/\s+/g, "-").toLowerCase()}.json`);
}

function loadCache(tool) {
  const f = cacheFile(tool);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

function saveCache(tool, data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(tool), JSON.stringify(data, null, 2));
}

// ─── Signal extraction ────────────────────────────────────────────────────────

function extractSignals(tool, body) {
  const result = {};
  // Strip HTML tags for cleaner matching
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const signal of tool.signals) {
    result[signal.key] = signal.pattern.test(text);
  }
  // Also store a hash of the full price-relevant portion so we catch
  // anything the signals don't explicitly cover
  const priceSection = text.match(/(\$[\d,.]+[\s\S]{0,200}){3,}/)?.[0] ?? text.substring(0, 5000);
  result._content_hash = crypto.createHash("sha256").update(priceSection).digest("hex").substring(0, 16);
  return result;
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

function diff(tool, url, oldSnapshot, newSnapshot, signals) {
  const changes = [];

  // Check each named signal
  for (const signal of signals) {
    const wasPresent = oldSnapshot?.[signal.key];
    const isPresent = newSnapshot[signal.key];
    if (wasPresent !== undefined && wasPresent !== isPresent) {
      changes.push({
        tool,
        url,
        field: signal.key,
        label: signal.label,
        old: wasPresent ? "FOUND" : "NOT FOUND",
        new: isPresent ? "FOUND" : "NOT FOUND",
        severity: "high",
        detail: isPresent
          ? `"${signal.label}" is now present on the page (was missing — price may have been re-added)`
          : `"${signal.label}" is NO LONGER found on the page — price may have changed or plan removed`,
      });
    }
  }

  // Content hash change (catch anything signals miss)
  if (
    oldSnapshot?._content_hash &&
    oldSnapshot._content_hash !== newSnapshot._content_hash
  ) {
    // Only add a hash change entry if no signal changes were already found
    // (avoids duplicate noise)
    if (changes.length === 0) {
      changes.push({
        tool,
        url,
        field: "_content_hash",
        label: "Pricing page content changed",
        old: oldSnapshot._content_hash,
        new: newSnapshot._content_hash,
        severity: "medium",
        detail: "The pricing page content changed but no specific price signal was lost. Manual review recommended.",
      });
    }
  }

  return changes;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const allChanges = [];
  const errors = [];
  const checkedAt = new Date().toISOString();

  for (const target of TARGETS) {
    process.stderr.write(`Checking ${target.tool} (${target.url})... `);

    let body;
    try {
      const res = await fetchPage(target.url);
      if (res.status < 200 || res.status >= 400) {
        throw new Error(`HTTP ${res.status}`);
      }
      body = res.body;
      process.stderr.write(`HTTP 200, ${body.length} bytes\n`);
    } catch (e) {
      process.stderr.write(`FAILED: ${e.message}\n`);
      errors.push({ tool: target.tool, error: e.message });
      continue;
    }

    const newSnapshot = extractSignals(target, body);
    newSnapshot._checked_at = checkedAt;
    newSnapshot._url = target.url;

    const oldSnapshot = loadCache(target.tool);
    const changes = diff(target.tool, target.url, oldSnapshot, newSnapshot, target.signals);

    allChanges.push(...changes);

    // Update cache only if fetch succeeded
    saveCache(target.tool, newSnapshot);
  }

  const report = {
    checked_at: checkedAt,
    all_ok: allChanges.length === 0 && errors.length === 0,
    changes: allChanges,
    fetch_errors: errors,
    summary: allChanges.length > 0
      ? `⚠️ ${allChanges.length} pricing change(s) detected across ${[...new Set(allChanges.map(c => c.tool))].join(", ")}`
      : errors.length > 0
      ? `⚠️ ${errors.length} pricing page(s) could not be fetched`
      : "✅ All pricing signals match last known snapshot",
  };

  // Write JSON report to stdout — GitHub Actions reads this
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(`Fatal error: ${e.message}\n`);
  process.stdout.write(JSON.stringify({ all_ok: false, error: e.message, changes: [], checked_at: new Date().toISOString() }) + "\n");
  process.exit(0); // always exit 0 — issue creation is handled by the workflow
});
