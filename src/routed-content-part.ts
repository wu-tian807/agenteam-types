/**
 * @desc Routed ContentPart — base ContentPart augmented with an environment
 *       routing marker on path-based variants.
 *
 *       Path-based parts (`text_file` / `file` / `image_file` / `video_file` /
 *       `audio_file`) carry a path that, depending on the host, may live in
 *       different environments (sandbox container vs pure host fs, …).
 *       `RoutedContentPart` extends `ContentPart` with an `inContainer`
 *       marker so producers can declare which environment a path belongs to
 *       and the consuming `MediaReaders` impl can route accordingly.
 *
 *       The marker lives ONLY here — it is intentionally NOT part of
 *       `ContentPart` so that `@agenteam/providers` (which only ever sees
 *       `ContentPart` / `FilePathPart`) stays sandbox-agnostic. AgenTeam
 *       producers (renderer, wechat, …) type their literals against
 *       `RoutedContentPart`; the host's `MediaReaders` (`media-storage.ts`
 *       in the engine) narrows incoming parts to `RoutedFilePathPart` to
 *       read the marker.
 *
 *       A separate consumer of `@agenteam/providers` (CLI tool, third-party
 *       host) that doesn't have a container/host distinction can ignore
 *       this file entirely — they pass plain `ContentPart` and use
 *       `defaultMediaReaders`, which never inspects this field.
 */

import type { ContentPart } from "./types.js";

/**
 * Routing marker — recognised by hosts that route between environments.
 *
 * - `false`  → pure host-fs path, read via `node:fs`.
 * - omitted / `true` → sandbox-container path, read via the host's bridge
 *   (e.g. `sandboxFs` in AgenTeam).
 *
 * Producers that emit container/sandbox paths (the common case) leave the
 * field unset — absence equals "container".
 */
export interface RoutingMarker {
  inContainer?: boolean;
}

/** Path-based ContentPart variant with environment routing marker. */
export type RoutedFilePathPart = Extract<ContentPart, { path: string }> & RoutingMarker;

/** Media-file variant (image_file / video_file / audio_file) with routing marker. */
export type RoutedFileMediaContentPart = Extract<
  ContentPart,
  { type: "image_file" | "video_file" | "audio_file" }
> & RoutingMarker;

/**
 * Full ContentPart union with environment routing — inline / text variants
 * stay as they are; path-based variants gain the routing marker.
 */
export type RoutedContentPart =
  | Extract<ContentPart, { type: "text" | "image" | "video" | "audio" }>
  | RoutedFilePathPart;
