/** Minimal structured console logger with step grouping for CI readability. */

const ts = (): string => new Date().toISOString().slice(11, 19);

type Level = "info" | "warn" | "error" | "step" | "ok";

const ICON: Record<Level, string> = {
  info: "·",
  warn: "!",
  error: "✗",
  step: "▸",
  ok: "✓",
};

function emit(level: Level, msg: string, extra?: unknown): void {
  const line = `${ts()} ${ICON[level]} ${msg}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra === undefined) fn(line);
  else fn(line, extra);
}

export const log = {
  info: (msg: string, extra?: unknown) => emit("info", msg, extra),
  warn: (msg: string, extra?: unknown) => emit("warn", msg, extra),
  error: (msg: string, extra?: unknown) => emit("error", msg, extra),
  ok: (msg: string, extra?: unknown) => emit("ok", msg, extra),
  /** Marks the start of a pipeline step. */
  step: (n: number, title: string) => emit("step", `Step ${n} — ${title}`),
};
