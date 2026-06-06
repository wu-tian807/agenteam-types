/**
 * @desc LLM message-shape protocol types shared between the engine and channels
 *       (ink-renderer renders LLMMessage events). Engine-only provider plumbing
 *       (LLMProvider/LLMResponse/StreamEvent and ToolDefinition coupling) stays
 *       in the host's src/llm/types.ts and re-imports these base types from here.
 *
 *       Zero engine dependency — only ContentPart from ./types.
 */

import type { ContentPart } from "./types.js";

export type ProviderSidecarData = Record<string, unknown>;

export interface SystemBlock {
  name: string;
  text: string;
  /** Cache hint — mirrors ContextSlot.cacheHint after slot pipeline resolution.
   *  - "stable"  — stable system prompt prefix (cache-friendly)
   *  - "dynamic" — changes per turn; lives after the cache marker
   *  When ContextSlot.cacheHint is omitted, this defaults to "dynamic". */
  cacheHint?: "stable" | "dynamic";
  priority: number;
  /** Runtime-only marker on a tombstone block (a retracted dynamic slot). The
   *  fold/native paths still render its retraction text, but providers that
   *  rebuild the full dynamic state fresh each turn (GPT-5 Responses
   *  reconstruct) drop the block entirely instead of showing a tombstone. */
  retracted?: boolean;
}

export interface LLMMessage {
  role: "user" | "assistant" | "tool" | "system";
  /** Normalized content for provider consumption — always ContentPart[].
   *  Event/storage layer may keep raw strings; normalization happens when
   *  constructing LLMMessage (replay / bind / prepareInboundMessages). */
  content: ContentPart[];
  thinking?: string;
  truncated?: boolean;
  ts?: number;
  toolCallId?: string;
  toolName?: string;
  toolStatus?: "pending" | "completed" | "failed" | "synthetic" | "interrupted";
  toolCalls?: LLMToolCall[];
  /** Set only on role:"system" dynamic-delta carriers (materialized from
   *  `hook:systemPrompt` events). Holds the full changed SystemBlock[] so
   *  providers can reconstruct / fold them with block identity intact (e.g.
   *  GPT-5 Responses last-wins by name). Runtime-only; not persisted. */
  systemBlocks?: SystemBlock[];
  providerSidecarData?: ProviderSidecarData;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  providerSidecarData?: ProviderSidecarData;
}

// ─── Tool schema (provider-side view of a tool) ──────────────────────────────
//
// Engine `ToolDefinition` carries runtime concerns (`execute(args, ctx)`,
// `validateInput`, `compactResult`, …) that are bound to AgentContext and have
// no place in a provider adapter. The provider only needs the parts that
// describe the tool to the LLM API:
//
//   { name, description, input_schema }
//
// `ToolSchema` is exactly that subset. The engine's `ToolDefinition` extends
// it, so passing `tools: ToolDefinition[]` to a provider call still type-checks
// without forcing providers to import AgentContext.
//
// Add fields here ONLY if every provider needs them (e.g. JSON-schema fragment
// the LLM API understands). Anything tied to runtime execution stays on
// `ToolDefinition` in the engine.

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON-Schema-shaped argument object. Field names mirror the OpenAI/Anthropic
   *  tool-use shape so providers can pass it through with minimal massaging.
   *  `properties` is `any`-typed because JSON-Schema fragments are
   *  inherently dynamic — providers should not introspect this shape. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

// ─── Model spec (catalog entry) ──────────────────────────────────────────────
//
// NOTE: intentionally NOT defined here yet. The engine has a richer
// `ModelSpec` (input modalities, reasoning flag, context window) that is the
// catalog source-of-truth, and providers don't need most of those fields. A
// provider-side `ModelSpec` will be added when the provider extraction lands;
// the engine spec stays in src/core/types.ts until then.
