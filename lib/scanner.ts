/**
 * Multi-word symbol scanner.
 *
 * Scans source files for multi-word identifiers (camelCase, snake_case,
 * PascalCase, kebab-case, SCREAMING_SNAKE) and returns structured results.
 */

import { walk } from "https://deno.land/std/fs/walk.ts";
import { relative, extname } from "https://deno.land/std/path/mod.ts";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SymbolHit {
  symbol: string;
  words: string[];
  kind: string;
  file: string;
  line: number;
}

export interface ScanOptions {
  root: string;
  extensions?: string[];
  exclude?: string[];
  minWords?: number;
}

// ── Patterns ───────────────────────────────────────────────────────────────

const ALL_PATTERNS: Record<string, RegExp> = {
  "camelCase":        /\b[a-z]\w*[A-Z]\w*\b/g,
  "_camelCase":       /\b_[a-z]\w*[A-Z]\w*\b/g,
  "#camelCase":       /#[a-z]\w*[A-Z]\w*\b/g,
  "PascalCase":       /\b(?:[A-Z][a-z][a-zA-Z0-9]*){2,}\b/g,
  "_PascalCase":      /\b_[A-Z]\w*[a-z]\w*\b/g,
  "#PascalCase":      /#[A-Z]\w*[a-z]\w*\b/g,
  "snake_case":       /\b[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+\b/g,
  "_snake_case":      /\b_[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+\b/g,
  "#snake_case":      /#[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+\b/g,
  "SCREAMING_SNAKE":  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
  "_SCREAMING_SNAKE": /\b_[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
  "#SCREAMING_SNAKE": /#[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
  "kebab-case":       /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g,
};

const DEFAULT_SKIP = new Set([
  ".git", "node_modules", "vendor", "dist", ".cache", "build",
]);

const DEFAULT_EXTS = new Set([
  ".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs", ".yaml", ".yml",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

export function splitWords(sym: string): string[] {
  const clean = sym.replace(/^[#_]+/, "");
  let parts = clean.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z]|$)/g);
  if (!parts) {
    parts = clean.split("_");
  }
  return parts.filter(Boolean).map((p) => p.toLowerCase());
}

function wordCount(sym: string): number {
  return splitWords(sym).length;
}

function lineOf(lineStarts: number[], pos: number): number {
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function buildLineIndex(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

// ── Scanner ────────────────────────────────────────────────────────────────

export async function scan(options: ScanOptions): Promise<SymbolHit[]> {
  const {
    root,
    extensions,
    exclude,
    minWords = 2,
  } = options;

  const extSet = extensions
    ? new Set(extensions.map((e) => (e.startsWith(".") ? e : `.${e}`)))
    : DEFAULT_EXTS;

  const skipSet = exclude
    ? new Set([...DEFAULT_SKIP, ...exclude])
    : DEFAULT_SKIP;

  const results: SymbolHit[] = [];

  for await (const entry of walk(root, {
    includeDirs: false,
    skip: [...skipSet].map((s) => new RegExp(`(^|/)${s}(/|$)`)),
  })) {
    const ext = extname(entry.path);
    if (!extSet.has(ext)) continue;

    let text: string;
    try {
      text = await Deno.readTextFile(entry.path);
    } catch {
      continue;
    }

    const rel = relative(root, entry.path);
    const lineStarts = buildLineIndex(text);

    for (const [kind, pattern] of Object.entries(ALL_PATTERNS)) {
      // Reset regex state
      const re = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const sym = m[0];
        if (wordCount(sym) < minWords) continue;
        results.push({
          symbol: sym,
          words: splitWords(sym),
          kind,
          file: rel,
          line: lineOf(lineStarts, m.index),
        });
      }
    }
  }

  return results;
}
