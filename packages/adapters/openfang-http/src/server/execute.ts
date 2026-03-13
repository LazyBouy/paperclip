import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { asString, asNumber, parseObject, renderTemplate } from "@paperclipai/adapter-utils/server-utils";

const DEFAULT_PROMPT_TEMPLATE =
  "You are agent {{agent.name}} ({{agent.id}}). " +
  "{{#if context.wakeReason}}Wake reason: {{context.wakeReason}}. {{/if}}" +
  "Continue your Paperclip work.";

const DEFAULT_TIMEOUT_SEC = 300;

type OpenAIChunk = {
  id?: string;
  choices?: Array<{
    delta?: { content?: string | null; role?: string };
    finish_reason?: string | null;
    index?: number;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function parseSSEChunk(raw: string): OpenAIChunk | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as OpenAIChunk;
  } catch {
    return null;
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, context, config, onLog, onMeta } = ctx;

  const baseUrl = asString(config.baseUrl, "http://127.0.0.1:4200").replace(/\/$/, "");
  const hand = asString(config.hand, "researcher");
  const apiKey = asString(config.apiKey, "");
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PROMPT_TEMPLATE);
  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);
  const payloadExtra = parseObject(config.payloadTemplate);

  const prompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId },
    context,
  });

  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim()
      ? context.wakeReason.trim()
      : null;
  const issueId =
    typeof context.issueId === "string" && context.issueId.trim()
      ? context.issueId.trim()
      : typeof context.taskId === "string" && context.taskId.trim()
        ? context.taskId.trim()
        : null;

  const endpoint = `${baseUrl}/v1/chat/completions`;

  const body = {
    model: hand,
    stream: true,
    messages: [{ role: "user", content: prompt }],
    ...payloadExtra,
    metadata: {
      paperclip: {
        runId,
        agentId: agent.id,
        companyId: agent.companyId,
        ...(issueId ? { issueId } : {}),
        ...(wakeReason ? { wakeReason } : {}),
      },
    },
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }

  if (onMeta) {
    await onMeta({
      adapterType: "openfang_http",
      command: "POST",
      commandArgs: [endpoint],
      prompt,
      context,
    });
  }

  await onLog("stderr", `[openfang] POST ${endpoint} (hand=${hand})\n`);

  const controller = new AbortController();
  const timer = timeoutSec > 0 ? setTimeout(() => controller.abort(), timeoutSec * 1000) : null;

  let inputTokens = 0;
  let outputTokens = 0;
  let fullText = "";
  let timedOut = false;
  let errorMessage: string | null = null;

  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        timedOut = true;
        return {
          exitCode: null,
          signal: null,
          timedOut: true,
          errorMessage: `Timed out after ${timeoutSec}s`,
        };
      }
      throw err;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      errorMessage = `OpenFang returned HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`;
      await onLog("stderr", `[openfang] ${errorMessage}\n`);
      return {
        exitCode: response.status,
        signal: null,
        timedOut: false,
        errorMessage,
      };
    }

    if (!response.body) {
      errorMessage = "OpenFang response has no body";
      await onLog("stderr", `[openfang] ${errorMessage}\n`);
      return { exitCode: 1, signal: null, timedOut: false, errorMessage };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await reader.read());
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          timedOut = true;
          break;
        }
        throw err;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = parseSSEChunk(line);
        if (!chunk) continue;

        // Accumulate usage from final chunk
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          await onLog("stdout", delta);
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const chunk = parseSSEChunk(buffer);
      if (chunk?.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        await onLog("stdout", delta);
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (timedOut) {
    return {
      exitCode: null,
      signal: null,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  await onLog("stderr", `[openfang] Run complete (in=${inputTokens} out=${outputTokens})\n`);

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    errorMessage,
    usage:
      inputTokens > 0 || outputTokens > 0
        ? { inputTokens, outputTokens }
        : undefined,
    summary: fullText.trim() || null,
  };
}
