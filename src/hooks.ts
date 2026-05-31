/**
 * @desc Lifecycle hook constants — shared between engine and channels.
 *
 *       `hook:*` is a naming convention for observer-only lifecycle events.
 *       Channels (ink-renderer, wechat) subscribe to these via EventBus;
 *       engine publishes them throughout agent turns.
 *
 *       Usage:
 *         import { Hook } from "@agenteam/types";
 *         eventBus.hook(Hook.TurnEnd, { turn: 1, aborted: false });
 */

/** Prefix for ephemeral stream events — not persisted to events.jsonl. */
export const STREAM_PREFIX = "stream:" as const;

export const Hook = {
  AssistantMessage: "hook:assistantMessage",
  TurnStart:        "hook:turnStart",
  TurnEnd:          "hook:turnEnd",
  ToolCall:         "hook:toolCall",
  ToolResult:       "hook:toolResult",
  StreamLLM:        `${STREAM_PREFIX}llm` as const,
  SystemPrompt:     "hook:systemPrompt",
  LLMFallback:      "hook:llmFallback",
  LLMRetry:         "hook:llmRetry",
  SessionChange:    "hook:sessionChange",

  AgentAttach:      "hook:agentAttach",
  AgentDetach:      "hook:agentDetach",
  AgentCreate:      "hook:agentCreate",
  AgentFree:        "hook:agentFree",
} as const;

export type HookType = typeof Hook[keyof typeof Hook] | `hook:${string}` | `${typeof STREAM_PREFIX}${string}`;

/** Extensible hook constants table — passed via AgentContext so plugins don't need direct imports. */
export type HookTable = typeof Hook & { readonly [k: string]: string };
