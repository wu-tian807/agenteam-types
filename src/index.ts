/**
 * @desc @agenteam/types — shared protocol types and utilities.
 *
 *       This package is the single source of truth for protocol types,
 *       event structures, and shared utilities between the agenteam engine
 *       and its channels (ink-renderer, wechat, engine-channel, etc.).
 *
 *       Zero engine dependency — only Node.js standard library + ws (peer).
 */

// ─── Types ───
export * from "./types.js";

// ─── Content utilities ───
export * from "./content-utils.js";

// ─── Slash-command parser ───
export * from "./command-parser.js";

// ─── LLM message-shape protocol types ───
export * from "./llm.js";

// ─── Thinking/text extraction helpers ───
export * from "./thinking.js";

// ─── Lifecycle hooks ───
export * from "./hooks.js";

// ─── Shared path utilities ───
export * from "./state-dir.js";

// ─── Gateway protocol client ───
export * from "./gateway-conn.js";

// ─── Input segment utilities ───
export * from "./input-segments.js";

// ─── ANSI helpers ───
export * from "./ansi.js";

// ─── Media persistence ───
export * from "./media-dir.js";
