import type { UIAdapterModule } from "../types";
import { parseOpenfangStdoutLine } from "@paperclipai/adapter-openfang-http/ui";
import { buildOpenfangConfig } from "@paperclipai/adapter-openfang-http/ui";
import { OpenfangConfigFields } from "./config-fields";

export const openfangHttpUIAdapter: UIAdapterModule = {
  type: "openfang_http",
  label: "OpenFang",
  parseStdoutLine: parseOpenfangStdoutLine,
  ConfigFields: OpenfangConfigFields,
  buildAdapterConfig: buildOpenfangConfig,
};
