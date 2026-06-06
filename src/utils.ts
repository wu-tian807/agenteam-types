/**
 * @desc Tiny shared utilities — host-agnostic, zero-dep.
 *
 * `sleep` is the single signal-aware delay primitive used across the
 * monorepo. Callers that don't pass `signal` get a plain timed Promise
 * (equivalent to `new Promise(r => setTimeout(r, ms))`); callers that pass
 * a signal get prompt cancellation: the inner `setTimeout` is cleared and
 * the Promise rejects with `Error("Request cancelled")` the moment the
 * signal aborts, so a caller's outer `try/catch` can surface a typed abort
 * even mid-wait.
 *
 * Lives in @agenteam/types (instead of providers / host) so tests, host
 * boot code, channel subscribers, and adapter retry loops all share one
 * implementation — no inlined copies, no duplicated semantics drift.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Request cancelled"));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(new Error("Request cancelled"));
        },
        { once: true },
      );
    }
  });
}
