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

// Instance lifecycle ONLY — describes the worker process state. Two orthogonal
// dimensions are kept separate:
//   - `ContainerStatus` (below): sandbox/workspace container, observable while
//     the instance is `running`.
//   - `InstanceMeta.hasTeam` (gateway-conn.ts): whether the instance has a
//     team manifest on disk. Static, read by the gateway from the instance
//     directory; NOT a transient state. Picker uses it to route Enter on an
//     idle instance to either restart (hasTeam) or pack picker (!hasTeam).
//
// `idle` is the "no worker is running" terminal/initial state (instance exists
// on disk but the worker process is not up). It covers: just-created, never
// started, stopped, or auto-restart-exhausted-then-stopped.
export type InstanceStatus =
  | "idle"
  // Instance-env provisioning: git clone + pnpm install, owned by the gateway
  // BEFORE the worker is forked. The instance does not exist as a runnable
  // process yet, so the picker must NOT let the user "enter" it.
  | "preparing"
  | "starting"
  | "running"
  | "stopping"
  | "restarting"
  | "error";

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

// ── Container status (separate, decoupled state machine) ──
//
// The sandbox/workspace container has its own lifecycle that is *orthogonal* to
// the instance lifecycle (`InstanceStatus`): per docs/draft/workspace-docker-
// decoupling.md the container will eventually be gateway-managed and shared
// N:1 across instances, so it cannot be expressed as a single instance state.
//
// The worker reports this dimension while the container is being built/recovered
// (carrying a `provisioningPhase`). A container can be `provisioning` while its
// instance is merely `starting` (initial boot) OR already `running` (a live
// instance recovering/rebuilding its container) — UIs combine the two machines
// via `displayStatus` / `isInstanceSelectable` below.
//
//   - "provisioning": container is being built / created / started
//   - "running":      container is up and usable
//   - "stopped":      container is not running (torn down / never started)
export type ContainerStatus = "provisioning" | "running" | "stopped";

// Instance-lifecycle transient states — the *instance itself* is coming up, so
// it's worth waiting for / routing to. `idle` is intentionally absent: it is
// a stable "not-running" state, not a pending one. Container provisioning is
// also absent: it lives on the separate `ContainerStatus` machine, not here.
export const INSTANCE_STATUS_PENDING: ReadonlySet<InstanceStatus> = new Set(["preparing", "starting"]);

// Stable states from which the picker offers a manual restart. Both `error`
// (failed, possibly with crash-budget exhausted) and `idle` (cleanly stopped
// or never started) are user-actionable here.
export const INSTANCE_STATUS_TERMINAL: ReadonlySet<InstanceStatus> = new Set(["error", "idle"]);

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
