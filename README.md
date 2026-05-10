# symbol-audit

GitHub Action that scans code for multi-word symbols, classifies them with AI team alignment, and creates tracking issues.

## Pipeline

1. **Scan** — Detect multi-word identifiers (camelCase, snake_case, PascalCase, kebab-case, SCREAMING_SNAKE) using heuristic regex matching
2. **External classification** — AI team (via `sw2m/ci-agents`) classifies symbols as external (dependency-defined) or internal
3. **Label classification** — AI team assigns refactoring labels; only consensus labels are kept
4. **Post-process** — Remaining unclassified symbols get `human-review`

## Usage

```yaml
- uses: sw2m/symbol-audit@main
  with:
    target: repo          # repo | pr | commit:<sha> | branch:<name> | range:<sha1>...<sha2>
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    org: my-org
    actor: ${{ github.actor }}
```

## Labels

| Label | Description |
|---|---|
| `subject.verb` | Property/action belongs on an existing entity; refactor to natural OOP |
| `state-machine` | Process/action should be a first-class object |
| `truncate` | Symbol can be shortened without collision |
| `prefix-grouping` | Multiple prefix* locals → grouped object |
| `suffix-grouping` | Multiple *suffix locals → grouped object |
| `kv-ify` | Key/value pairs → structured object |
| `snakify` | camelCase → snake_case |
| `kebabify` | Event names → kebab-case |
| `serde` | Serialized/constant field naming |
| `external` | Defined by a dependency |
| `as-is` | Human-only: intentionally multi-word |

## Dependencies

- [sw2m/ci-agents](https://github.com/sw2m/ci-agents) — AI agent team orchestration
- [sw2m/octoscript](https://github.com/sw2m/octoscript) — Runtime and shared state
