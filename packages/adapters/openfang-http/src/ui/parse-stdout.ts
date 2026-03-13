import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function parseOpenfangStdoutLine(line: string, ts: string): TranscriptEntry[] {
  if (!line.trim()) return [];
  return [{ kind: "assistant", ts, text: line }];
}
