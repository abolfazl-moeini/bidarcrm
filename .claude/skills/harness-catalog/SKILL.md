---
name: harness-catalog
description: Feature & Option Manifest manager under agent-harness governance. Catalogs business features, Persian aliases, WordPress options, post meta, hooks, and files in .harness/features.json to eliminate blind grep. Enforces anti-bitrot physical file validation and exposes fast sub-60-token MCP retrieval.
---

# Harness Catalog (`/harness-catalog`)

Git-tracked Feature & Option Manifest manager for WordPress projects under `agent-harness` governance.  
Authoritative source of truth: `/Users/moeini/Dev/wpdev-platform/agent-harness/AGENTS.md` and `plans/harness-catalog-plan.md`.

> [!NOTE]
> **Discovery Precedence (Opt-In Catalog):**
> 1. **Default & Automatic:** Codebase structural discovery, AST call graphs, blast radius, and symbol tracking are handled automatically with zero developer overhead via `bin/harness-graph`.
> 2. **Opt-In (`.harness/features.json`):** `harness-catalog` is strictly opt-in for projects where the team explicitly wants manual Persian aliases (e.g. «خرید سریع»), business domain tags, or curated feature-to-option mappings. If `.harness/features.json` is absent, codebase navigation proceeds seamlessly via `bin/harness-graph`.

---

## 1. Usage (CLI & Subcommands)

```bash
# Search features (supports Persian text, synonyms, or technical identifiers)
harness-catalog search "خرید سریع"
harness-catalog search "gift_options"
harness-catalog search "shop_collector_edition"

# List and inspect catalog entries
harness-catalog list [--status active]
harness-catalog show <feature_id>

# Add or update feature definitions
harness-catalog add \
  --id="quick_buy_1click" \
  --title-fa="خرید سریع با ۱ کلیک" \
  --aliases="خرید آنی, پرداخت تک مرحله‌ای" \
  --options="shop_quick_buy_enabled,shop_quick_buy_btn_title" \
  --meta="_quick_buy_allowed" \
  --hooks="shop_before_quick_buy,shop_after_quick_buy" \
  --files="src/Modules/QuickBuy/Module.php,src/Modules/QuickBuy/Assets/quick-buy.js"

# Remove feature
harness-catalog remove <feature_id>

# Anti-Bitrot validation (verifies JSON syntax, schema, and on-disk file existence)
harness-catalog validate

# AST auto-scaffolding (scans directory for get_option, get_post_meta, add_action, add_filter)
harness-catalog scaffold src/Modules/QuickBuy/ --title-fa="خرید سریع با ۱ کلیک"
```

---

## 2. Fast MCP Tool Integration

Agents and LLMs access the catalog via `bin/harness-memory-mcp`:
- `catalog_search_features(query="...", limit=5)`: Returns concise, sub-60 token summaries per feature (`id`, `title`, matching keys, primary file).
- `catalog_get_feature(id="...")`: Retrieves complete feature card with all options, meta keys, hooks, files, and notes.

---

## 3. Invariants & Governance

1. **Git-Tracked Single Source of Truth:** `.harness/features.json` is committed directly to Git (never gitignored).
2. **Merge-Conflict Resilient Keyed Dictionary:** Features are stored in a keyed dictionary (`features: { [id]: { ... } }`) sorted alphabetically.
3. **Persian Normalization & Dual-Mode Search:** Queries undergo a 6-stage normalization pipeline (NFKC, ASCII digits, ZWNJ space folding, Arabic yeh/kaf normalization, diacritic removal) while technical symbols (`db_options`, `post_meta`, `hooks`) are matched raw.
4. **Anti-Bitrot File Verification:** Every path in `files` for `active` features MUST physically exist on disk. Renamed or removed files cause `harness-catalog validate` and `pre-commit` to fail closed.
5. **Path Traversal Defense:** Canonical path ancestry (`is_safe_target_path`) prevents directory traversal outside the target project root.
