import pc from "picocolors";

export function printOpenfangStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;
  console.log(pc.green(line));
}
