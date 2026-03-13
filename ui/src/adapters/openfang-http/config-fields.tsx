import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const HANDS = ["researcher", "lead", "collector", "predictor", "twitter", "browser", "clip"];

function ApiKeyField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label="API key" hint="Bearer token sent in the Authorization header (optional).">
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder="sk-..."
        />
      </div>
    </Field>
  );
}

export function OpenfangConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const effectiveHand = isCreate
    ? values!.model
    : eff("adapterConfig", "hand", String(config.hand ?? "researcher"));

  return (
    <>
      <Field label="Base URL" hint="OpenFang server URL. Defaults to http://127.0.0.1:4200.">
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:4200"
        />
      </Field>

      <Field label="Hand (agent type)" hint="The OpenFang Hand to activate for this agent.">
        <select
          value={effectiveHand}
          onChange={(e) =>
            isCreate
              ? set!({ model: e.target.value })
              : mark("adapterConfig", "hand", e.target.value)
          }
          className={inputClass}
        >
          {HANDS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Field>

      <ApiKeyField
        value={
          isCreate
            ? ""
            : eff("adapterConfig", "apiKey", String(config.apiKey ?? ""))
        }
        onCommit={(v) =>
          isCreate ? undefined : mark("adapterConfig", "apiKey", v || undefined)
        }
      />
    </>
  );
}
