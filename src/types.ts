/**
 * @desc agenteam protocol types — shared between engine, channels, and external tools.
 *
 *       These types describe: event envelopes, multimodal content, agent topology,
 *       system configuration, instance lifecycle, and command protocol.
 *
 *       Engine-internal types (Provider, Scheduler, Tree lifecycle, etc.) are NOT
 *       part of this package — they belong in the engine repo.
 *
 *       Convention: purely structural — no function implementations here.
 *       Pure-type utility functions live in content-utils.ts.
 */

// ─── Event System ───

export type EventHandoff = "silent" | "passive" | "turn" | "innerLoop" | "steer";

export interface ContentPayload {
  content: EventContent;
  [key: string]: unknown;
}

export interface EventPayload {
  /** Event-level content for display / logging — `string | ContentPart[]`.
   *  NOT directly fed to LLM. For LLM prompt, use `llmMessage`. */
  content?: EventContent;
  /** Human/AI-readable display text for files & UI. */
  visual_display?: string;
  /** Present → renderer shows red error, highest display priority. */
  error?: string;
  /** Present → renderer shows yellow warning, second priority. */
  warning?: string;

  [key: string]: unknown;
}

export interface EventBase {
  source: string;       // e.g. "user", "heartbeat", "hook:TurnEnd"
  type: string;         // e.g. "message", "tick", "block_break"
  payload: EventPayload;
  ts: number;

  priority?: number;    // 0=immediate, 1=normal(default), 2=low

  // ── Runtime event controls (attached by EventBus.publish before observers run) ──
  block?: (reason?: string) => void;
  isBlocked?: () => boolean;
  blockReason?: string;
}

// handoff is only meaningful when routing to a queue (i.e. `to` is set).
// TypeScript enforces: you cannot set handoff without to.
export type Event = EventBase & (
  | { to: string; handoff?: EventHandoff }   // routed: agentId, "*" broadcast
  | { to?: undefined; handoff?: undefined }   // observers-only (publish)
);

export type SelfEvent = EventBase & { handoff?: EventHandoff };

// ─── Multimodal Content ───

export type InputModality = "text" | "image" | "video" | "audio";

export type ContentPart =
  | {
      type: "text";
      text: string;
    }
  | { type: "text_file"; path: string; mimeType: string; inContainer?: boolean }
  | { type: "file"; path: string; mimeType: string; inContainer?: boolean }
  | { type: "image"; data: string; mimeType: string; name?: string }
  | { type: "video"; data: string; mimeType: string; name?: string }
  | { type: "audio"; data: string; mimeType: string; name?: string }
  | { type: "image_file"; path: string; mimeType: string; inContainer?: boolean }
  | { type: "video_file"; path: string; mimeType: string; inContainer?: boolean }
  | { type: "audio_file"; path: string; mimeType: string; inContainer?: boolean };

export type EventContent = string | ContentPart[];

export type InlineMediaContentPart = Extract<ContentPart, { type: "image" | "video" | "audio" }>;

/**
 * Media content referenced by path (image_file / video_file / audio_file).
 *
 * ## Path ownership marker (`inContainer`)
 *
 * - `inContainer: true | undefined` (default) — path lives in the sandbox
 *   container's view. Consumers read via `sandboxFs`.
 *
 * - `inContainer: false` — path is a pure host path, unreachable from inside
 *   the container. Set explicitly for user-supplied host files, channel-side caches, etc.
 */
export type FileMediaContentPart = Extract<ContentPart, { type: "image_file" | "video_file" | "audio_file" }>;

export type MediaContentPart = InlineMediaContentPart | FileMediaContentPart;

// ─── Config / Agent Types ───

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface CapabilitiesConfig {
  global?: "all" | "none";
  team?: "all" | "none";
  enable?: string[];
  disable?: string[];
  config?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface ModelsConfig {
  model?: string | string[] | null;
  routing?: {
    stickiness?: {
      enabled?: boolean;
      ttlMs?: number;
      cooldownMs?: number;
    };
  };
  temperature?: number | null;
  maxTokens?: number | null;
  reasoningEffort?: ReasoningEffort | null;
  fast?: boolean;
  showThinking?: boolean;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeout?: number;
}

export interface AgentJson {
  models?: ModelsConfig;
  coalesceMs?: number;
  maxIterations?: number;
  capabilities?: CapabilitiesConfig;
  session?: {
    keepRecentTools?: number;
    keepRecentMedias?: number;
    idleGapMs?: number;
  };
  timezone?: string;
  defaultDir?: string;
  defaultStatus?: string;
  groups?: string[] | null;
}

export type AgentTeamLang = "en" | "zh";

export interface AgentTeamConfig {
  models?: ModelsConfig;
  sandbox?: {
    sshKeyPath?: string;
    sshPort?: number;
  };
  lang?: AgentTeamLang | null;
  prebuildMirror?: string;
}

// ─── Agent Tree (topology + roles) ───

export type AgentRole = "admin" | "steward" | "worker";

export interface AgentNodeData {
  id: string;
  readonly role: AgentRole;
  parentId: string | null;
  childIds: string[];
  spawnedAt: number;
}

export interface AgentTreeNode {
  node: AgentNodeData;
  children: AgentTreeNode[];
}

// ─── Instance Status ───

export type InstanceStatus =
  | "idle"
  | "provisioning"
  | "starting"
  | "running"
  | "stopping"
  | "restarting"
  | "error"
  | "unloaded";

export type ProvisioningPhase =
  | "scaffolding"
  | "initializing_sandbox"
  | "rebuilding_image"
  | "configuring_team"
  | "creating_container"
  | "starting_container";

export const PROVISIONING_PHASE_LABEL: Record<ProvisioningPhase, string> = {
  scaffolding:          "正在初始化项目结构...",
  initializing_sandbox: "正在初始化沙箱环境...",
  rebuilding_image:     "正在构建 Docker 镜像（可能需要几分钟）...",
  configuring_team:     "正在配置 Team 目录...",
  creating_container:   "正在创建容器...",
  starting_container:   "正在启动容器...",
};

export const INSTANCE_STATUS_PENDING: ReadonlySet<InstanceStatus> = new Set(["idle", "provisioning", "starting"]);

export const INSTANCE_STATUS_TERMINAL: ReadonlySet<InstanceStatus> = new Set(["error", "unloaded"]);

// ─── Command Protocol ───

export interface CommandSpec {
  name: string;
  description: string;
  hasQuery: boolean;
  hasExecute: boolean;
  params_schema?: Array<{
    name: string;
    description: string;
  }>;
}

export type CommandResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

// ─── Shared Paths ───

export interface SharedLayerAPI {
  root(): string;
  keyDir(): string;
  toolsKey(): string;
  packsDir(): string;
  gatewayConfig(): string;
  gatewayLog(): string;
  instancesDir(): string;
  instanceDir(instanceId: string): string;
  agenteamConfig(): string;
  cacheDir(): string;
  adapterCache(adapterName: string): string;
}
