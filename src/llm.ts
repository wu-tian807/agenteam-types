/**
 * @desc LLM message-shape protocol types shared between the engine, channels,
 *       and `@agenteam/providers`. ink-renderer renders LLMMessage events;
 *       providers package consumes ContentPart / SystemBlock / LLMMessage and
 *       re-exports the engine-side `LLMProvider` / `LLMResponse` / `StreamEvent`
 *       (those live in `packages/providers/src/types.ts` because they couple to
 *       the streaming runtime, not the wire protocol).
 *
 *       Zero engine dependency — only ContentPart from ./types.
 */

import type { ContentPart, InputModality } from "./types.js";

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
  /** Per-model gate. When present, the chain provider drops this tool from the
   *  payload sent to any model where the predicate returns false. Lives on the
   *  schema (not the engine-side `ToolDefinition`) because the chain provider
   *  is the single point that knows which model is currently being tried, and
   *  the gate has to fire on the same `tools` array passed to chatStream.
   *  Filtering still discards the tool BEFORE it crosses the API boundary, so
   *  raw adapters never observe `modelFilter` themselves. */
  modelFilter?: (model: string) => boolean;
}

// ─── Model spec (catalog entry) ──────────────────────────────────────────────
//
// Owned by `@agenteam/providers` (the chain provider needs it for prompt-budget
// math, modality filtering, effort downgrade). Hosted here in @agenteam/types
// because the engine catalog (`key/models.json`) is also typed against it and
// must agree byte-for-byte with what providers consume.

export interface ModelSpec {
  /** Modalities accepted on input. Anything else is degraded to a text
   *  placeholder by `prepareMessagesForModel`. */
  input: InputModality[];
  /** Whether the model can emit `<thinking>` blocks; gates effort downgrade. */
  reasoning: boolean;
  /** Total context window in tokens (prompt + output combined). */
  contextWindow: number;
  /** Maximum output tokens per call. Subtracted from `contextWindow` to
   *  compute the usable prompt budget — see `usableContextWindow`. */
  maxOutput: number;
  /** Default sampling temperature when `ModelsConfig.temperature` is unset.
   *  `undefined` means the model rejects a temperature parameter (e.g.
   *  Claude Opus 4.7+). */
  defaultTemperature?: number;
}
