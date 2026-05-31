# @agenteam/types 审计报告

## 一、导出完整性检查 ✅

| 类别 | @agenteam/types 提供了 | 主仓库重导出匹配 |
|:----|----------------------|:--------------:|
| 事件信封 | Event, EventBase, EventPayload, EventHandoff, SelfEvent, ContentPayload | ✅ |
| 多模态内容 | ContentPart, EventContent, ContentPart 子类型 | ✅ |
| 配置声明 | ModelsConfig, CapabilitiesConfig, AgentJson, AgentTeamConfig, AgentTeamLang | ✅ |
| Agent 拓扑 | AgentRole, AgentNodeData, AgentTreeNode | ✅ |
| 实例状态 | InstanceStatus, ProvisioningPhase, 3 个常量 | ✅ |
| 命令协议 | CommandSpec, CommandResult | ✅ |
| 共享路径 | SharedLayerAPI | ✅ |
| 内容工具 | isBinaryFile, fileToContentPart 等 7 个函数 | ✅ |
| 路径工具 | resolveStateDir, getSharedPaths | ✅ |
| 通道工具 | gateway-conn, input-segments, ansi, media-dir | ✅ |
| 输入段类型 | InputSegment, PasteSource, SegmentHit | ✅ |

## 二、问题修复 ✅

| 问题 | 状态 |
|:----|:----:|
| `gateway-conn.ts` L35/L37 inline `import("../../core/types.js")` | ✅ 已改为 `import("@agenteam/types")` |
| 其余所有 channels/ctl-command 的 import | ✅ 全部通过 core/types.ts 重导出可解析 |

## 三、未来应共享的类型建议

### 高优先级（零/低依赖，可安全提取）

1. **`Hook` 常量**（`src/hooks/types.ts`）
   - `Hook.TurnEnd`, `Hook.TurnStart`, `Hook.ToolCall` 等纯字符串常量
   - 目前 channels 里硬编码了 `"hook:turnEnd"`、`"hook:assistantMessage"` 等字符串
   - 放入 `@agenteam/types` 后，channels 可以直接 `import { Hook } from "@agenteam/types"`
   - 零依赖，纯 `as const` 对象

2. **`STREAM_PREFIX`**（`src/hooks/types.ts`）
   - `"stream:"` 前缀常量

### 中优先级（有少量依赖，需要重构）

3. **`LLMMessage`、`LLMToolCall`、`LLMResponse` 等 LLM 消息类型**
   - channels 中 `event-formatter.ts` 需要解析 LLM 消息格式
   - 但当前依赖 `src/llm/types.ts` 中的 `ModelSpec` 等引擎类型
   - 需要先剥离出纯协议子集再提取

### 低优先级

4. **`AGENT_DEFAULTS`** — 只有 UI 面板编辑 agent 配置时才需要
5. **`HookPayloadMap`** — 包含 LLM 类型引用，依赖较深
