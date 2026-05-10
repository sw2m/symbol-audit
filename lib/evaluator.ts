/**
 * Team alignment evaluator.
 *
 * Compares outputs from two AI agents and produces aligned labels.
 * Handles as-is enforcement per agent configuration.
 */

export interface SymbolEntry {
  symbol: string;
  words: string[];
  kind: string;
  file: string;
  line: number;
  label?: string;
  to?: string;
}

export interface AgentResult {
  symbol: string;
  label: string;
  to?: string;
}

export interface AsIsConfig {
  gemini: boolean;
  claude: boolean;
}

export interface AsIsAttempt {
  symbol: string;
  agent: string;
}

export interface EvaluatorResult {
  symbols: SymbolEntry[];
  asIsAttempts: AsIsAttempt[];
  aligned: number;
  misaligned: number;
}

/**
 * Evaluate alignment between two agents' classification results.
 *
 * For each symbol:
 * - If both agents agree on the exact same label, use it.
 * - If either agent marked as-is but is not allowed, remap to blank and track.
 * - Mismatches are left blank (post-process fills with human-review).
 */
export function evaluate(
  symbols: SymbolEntry[],
  agentA: AgentResult[], // gemini
  agentB: AgentResult[], // claude
  asIsConfig: AsIsConfig,
): EvaluatorResult {
  const mapA = new Map(agentA.map((r) => [r.symbol, r]));
  const mapB = new Map(agentB.map((r) => [r.symbol, r]));
  const asIsAttempts: AsIsAttempt[] = [];
  let aligned = 0;
  let misaligned = 0;

  const result = symbols.map((sym) => {
    const a = mapA.get(sym.symbol);
    const b = mapB.get(sym.symbol);

    let labelA = a?.label ?? "";
    let labelB = b?.label ?? "";

    // Track and remap disallowed as-is
    if (labelA === "as-is" && !asIsConfig.gemini) {
      asIsAttempts.push({ symbol: sym.symbol, agent: "gemini" });
      labelA = "";
    }
    if (labelB === "as-is" && !asIsConfig.claude) {
      asIsAttempts.push({ symbol: sym.symbol, agent: "claude" });
      labelB = "";
    }

    if (labelA && labelB && labelA === labelB) {
      aligned++;
      return { ...sym, label: labelA, to: a?.to || b?.to };
    }

    if (labelA || labelB) misaligned++;
    return { ...sym, label: sym.label ?? "" };
  });

  return { symbols: result, asIsAttempts, aligned, misaligned };
}

/**
 * Post-process: fill all blank labels with human-review.
 */
export function postProcess(symbols: SymbolEntry[]): SymbolEntry[] {
  return symbols.map((s) => ({
    ...s,
    label: s.label || "human-review",
  }));
}
