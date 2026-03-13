import type { CreateConfigValues } from "@paperclipai/adapter-utils";

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildOpenfangConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.baseUrl = v.url;
  if (v.model) ac.hand = v.model;
  ac.timeoutSec = 300;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  const payloadTemplate = parseJsonObject(v.payloadTemplateJson ?? "");
  if (payloadTemplate) ac.payloadTemplate = payloadTemplate;
  return ac;
}
