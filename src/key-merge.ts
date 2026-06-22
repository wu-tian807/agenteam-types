// @desc Unified key/key.json reader — optional deployment-time override of llm_key.json + tools.json.
//
// Background
// ──────────
// Historically, AgenTeam stores API keys in two separate files under
// ~/.agenteam/key/ :
//
//   - llm_key.json   →  { "<section>": { api_key, api, models, ... } }
//   - tools.json     →  { "<tool_key_name>": "<value>" }
//
// For K8s / container deployments, ops typically packs all secrets into a single
// out-of-band-managed unit (one `kubectl create secret --from-file=` invocation,
// one ConfigMap, one Vault path). Two-file shape forces them to either split the
// Secret across multiple keys or to use `--from-file` with two pieces. Either is
// awkward when the same Secret is the unit of rotation.
//
// This module adds an OPTIONAL third file `key/key.json` with merged shape:
//
//   {
//     "llm":   { "openai": { api_key, ... }, "anthropic": { ... }, ... },
//     "tools": { "azure_gpt_image_key": "...", "ark_api_key": "...", ... }
//   }
//
// Read precedence (per section, not whole-file):
//
//   1. If key/key.json exists AND has the "<section>" field as a non-null object,
//      use that.
//   2. Otherwise, fall back to the legacy split file (llm_key.json / tools.json).
//
// The default is unchanged — if key.json is absent, behavior is identical to
// before. Each section is resolved independently: a key.json with only `llm`
// is fine; `tools` will still come from tools.json in that case.
//
// Write semantics: this module is read-only. The framework never writes to
// key.json. Gateway UI write endpoints check `isUnifiedSectionActive()` and
// refuse with 409 when the unified file owns that section — the user is
// expected to edit their out-of-band source (K8s Secret etc.) and let the
// next pod restart pick up the change.

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Section names recognized inside key.json. */
export type UnifiedKeySection = "llm" | "tools";

/** Filename relative to the key directory. */
export const UNIFIED_KEY_FILENAME = "key.json";

/**
 * Absolute path of the unified key file inside a given key directory.
 * Useful for diagnostics and error messages.
 */
export function unifiedKeyPath(keyDir: string): string {
  return join(keyDir, UNIFIED_KEY_FILENAME);
}

/**
 * Read a section from key/key.json. Returns the parsed section object when
 * present, or null when:
 *   - key.json doesn't exist,
 *   - key.json is malformed JSON,
 *   - key.json is not a plain object,
 *   - the section field is missing or not a plain object.
 *
 * Sync variant for callers on hot LLM paths (e.g. providers/provider.ts:loadKeyFile)
 * that have always been sync. Cost is one extra file probe per call when key.json
 * does not exist; trivial compared to the LLM call itself.
 */
export function readUnifiedKeySectionSync(
  keyDir: string,
  section: UnifiedKeySection,
): Record<string, unknown> | null {
  const p = unifiedKeyPath(keyDir);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return pickSection(parsed, section);
  } catch {
    // Malformed JSON — refuse to silently fall back to legacy, since a present
    // but broken key.json is more likely a misconfig than legitimate absence.
    // We return null so callers fall back to the legacy file, but the read
    // failure surfaces later through validation if the legacy file is also
    // missing.
    return null;
  }
}

/** Async variant — preferred for callers that already do async file I/O. */
export async function readUnifiedKeySection(
  keyDir: string,
  section: UnifiedKeySection,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(unifiedKeyPath(keyDir), "utf-8");
    return pickSection(JSON.parse(raw), section);
  } catch {
    return null;
  }
}

/**
 * True iff key/key.json exists AND owns the given section. Useful for write
 * paths that need to refuse user edits when the unified file is authoritative.
 */
export async function isUnifiedSectionActive(
  keyDir: string,
  section: UnifiedKeySection,
): Promise<boolean> {
  return (await readUnifiedKeySection(keyDir, section)) !== null;
}

/** Sync version of isUnifiedSectionActive. */
export function isUnifiedSectionActiveSync(
  keyDir: string,
  section: UnifiedKeySection,
): boolean {
  return readUnifiedKeySectionSync(keyDir, section) !== null;
}

// ─── Internals ───

function pickSection(
  parsed: unknown,
  section: UnifiedKeySection,
): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const sec = (parsed as Record<string, unknown>)[section];
  if (!sec || typeof sec !== "object" || Array.isArray(sec)) return null;
  return sec as Record<string, unknown>;
}
