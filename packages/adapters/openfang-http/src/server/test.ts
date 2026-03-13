import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const baseUrl = asString(config.baseUrl, "").replace(/\/$/, "");
  const hand = asString(config.hand, "");
  const apiKey = asString(config.apiKey, "");

  if (!baseUrl) {
    checks.push({
      code: "openfang_base_url_missing",
      level: "error",
      message: "OpenFang adapter requires a baseUrl.",
      hint: "Set adapterConfig.baseUrl to the OpenFang server URL, e.g. http://127.0.0.1:4200",
    });
    return { adapterType: ctx.adapterType, status: "fail", checks, testedAt: new Date().toISOString() };
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    checks.push({
      code: "openfang_base_url_invalid",
      level: "error",
      message: `Invalid baseUrl: ${baseUrl}`,
    });
    return { adapterType: ctx.adapterType, status: "fail", checks, testedAt: new Date().toISOString() };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    checks.push({
      code: "openfang_base_url_protocol_invalid",
      level: "error",
      message: `Unsupported protocol: ${parsedUrl.protocol}`,
      hint: "Use an http:// or https:// URL.",
    });
    return { adapterType: ctx.adapterType, status: "fail", checks, testedAt: new Date().toISOString() };
  }

  checks.push({
    code: "openfang_base_url_valid",
    level: "info",
    message: `Base URL: ${baseUrl}`,
  });

  if (!hand) {
    checks.push({
      code: "openfang_hand_missing",
      level: "error",
      message: "OpenFang adapter requires a hand (agent type).",
      hint: "Set adapterConfig.hand to one of: researcher, lead, collector, predictor, twitter, browser, clip",
    });
  } else {
    checks.push({
      code: "openfang_hand_configured",
      level: "info",
      message: `Hand: ${hand}`,
    });
  }

  // Probe /health endpoint
  const healthUrl = `${baseUrl}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(healthUrl, { method: "GET", headers, signal: controller.signal });
    if (res.ok) {
      checks.push({
        code: "openfang_health_ok",
        level: "info",
        message: `OpenFang health check passed (HTTP ${res.status}).`,
      });
    } else {
      checks.push({
        code: "openfang_health_unexpected_status",
        level: "warn",
        message: `OpenFang health endpoint returned HTTP ${res.status}.`,
        hint: "OpenFang may be running but returning an unexpected status. Verify the server is healthy.",
      });
    }
  } catch (err) {
    // Fall back to probing /v1/models if /health is not available
    try {
      const modelsUrl = `${baseUrl}/v1/models`;
      const headers2: Record<string, string> = {};
      if (apiKey) headers2["authorization"] = `Bearer ${apiKey}`;
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 5000);
      try {
        const res2 = await fetch(modelsUrl, { method: "GET", headers: headers2, signal: controller2.signal });
        if (res2.ok || res2.status === 401) {
          checks.push({
            code: "openfang_models_reachable",
            level: "info",
            message: `OpenFang API reachable at ${modelsUrl} (HTTP ${res2.status}).`,
          });
        } else {
          checks.push({
            code: "openfang_probe_unexpected_status",
            level: "warn",
            message: `OpenFang probe returned HTTP ${res2.status}.`,
            hint: "Verify OpenFang is running with `openfang status`.",
          });
        }
      } finally {
        clearTimeout(timer2);
      }
    } catch {
      checks.push({
        code: "openfang_unreachable",
        level: "warn",
        message: `Could not reach OpenFang at ${baseUrl}.`,
        detail: err instanceof Error ? err.message : String(err),
        hint: "Start OpenFang with `openfang start` and verify the baseUrl is correct.",
      });
    }
  } finally {
    clearTimeout(timer);
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
