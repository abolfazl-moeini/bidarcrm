# Principal Engineering Review Checklist (Sub-Review 2: `principal`)

Detailed audit checklist and evaluation rules for Sub-Review 2 (`principal-review`) of `/harness-review`.
Synthesizes the L8 Principal Engineer standards defined in `principal` (`ENTRY.md`, `OPINIONS.md`, `CUSTOM_GUIDELINES.md`).

---

## 1. Architecture & Hexagonal Membrane (P1 / P2)
- [ ] **Manifesto Compliance (P1, structural tasks only):** If the task carries `.harness/tasks/active/<id>/manifesto.json`, does the diff respect its declared layers, ingress, and egress? Any deviation is P1 unless covered by a Precedent/ADR exception ref.
- [ ] **Domain Decoupling (P1):** Is core domain/business logic isolated in `Domain/` and `Application/` without direct WordPress globals or functions (`get_option`, `wp_remote_get`, `$wpdb`)?
- [ ] **Infrastructure Adapters (P2):** Are WordPress-specific concerns (CPT registration, hooks, REST controllers, WP CLI) strictly confined to `Infrastructure/WordPress/` adapters?
- [ ] **Dependency Scoping (P1):** Are third-party Composer dependencies prefixed using Strauss (`BrianHenryIE/strauss`) to prevent class collisions across plugins?
- [ ] **Zero Cold-Boot DI Reflection Tax (P2):** Is Dependency Injection lightweight (pure factories or `lucatume/di52`) without heavy reflection-based container boot penalties on every WordPress request?
- [ ] **Chesterton's Fence (P2):** Does the diff respect existing code structure? Are gratuitous refactors of working legacy code rejected unless explicitly bounded by an ADR?
- [ ] **Anti-Polyfill & Upstream Defect Concealment (P1 FATAL):** Does consumer/client code attempt to monkey-patch, unblock, or bypass bugs in upstream framework (Tier 2) or tooling (Tier 1) components (e.g. directly manipulating foreign private runtime state, overriding framework global event lifecycles, or injecting consumer-side shims to mask upstream contract failures)? Consumer workarounds for upstream defects are strictly forbidden; the defect MUST be triaged as `UPSTREAM_T1` or `UPSTREAM_T2` and resolved in the authoritative upstream repository.

## 2. Security Invariants & Two-Gate Defense (P1)
- [ ] **Nonce != Authorization (P1 FATAL):** Is a nonce check (`wp_verify_nonce`, `check_admin_referer`, `check_ajax_referer`) NEVER used as an authorization mechanism?
  *(CSRF tokens prove origin, not privilege. Execution must verify capabilities explicitly using `current_user_can()`)*.
- [ ] **Two-Gate Defense (P1):** Are administrative, AJAX, and REST actions protected by both Gate 1 (`current_user_can()`) and Gate 2 (domain resource/ownership check)?
- [ ] **Prepared SQL Statements (P1):** Are all dynamic database queries parameterized with `$wpdb->prepare()`? Zero string interpolation or raw concatenated query fragments.
- [ ] **Strict Late-Escaping (P1):** Are all dynamic outputs escaped at the exact point of rendering using appropriate late-escaping functions (`esc_html`, `esc_attr`, `esc_url`, `wp_kses`)?
- [ ] **IDOR Prevention (P1):** When fetching or mutating an object by ID (e.g. `$_POST['id']`), is user ownership or domain access capability verified before performing mutations?
- [ ] **WAF & Security Firewall Compatibility for HTML / Embed Payloads (P1):** Does any admin form, metabox, or postmeta handler accept HTML markup or iframe embeds? Ensure payloads are not transmitted as raw, unencoded strings in standard HTTP POST bodies where security plugins (Wordfence, ModSecurity, Cloudflare WAF) trigger false-positive XSS blocks (403 Forbidden). Either accept clean provider URLs/identifiers (rendered server-side) or require client-side transport encoding (e.g. Base64) with server-side decoding prior to `wp_kses()` sanitization.

## 3. Database & Scale Invariants (P1 / P2)
- [ ] **Custom Tables vs Postmeta (P1 / P2):** Is high-velocity or transactional data (orders, ledger, queues, logs) persisted in typed custom database tables rather than unindexed `wp_postmeta`?
- [ ] **Storage Engine Integrity (P1 FATAL):** Are all custom transactional tables, queues, ledgers, and WooCommerce HPOS tables declared with `ENGINE=InnoDB`? MyISAM is strictly forbidden in transactional/operational flows due to table-level locking and lack of transaction rollback (ACID/MVCC).
- [ ] **Unbounded Queries (`posts_per_page => -1`) Ban (P1 FATAL):** Is `posts_per_page => -1` or `numberposts => -1` strictly prohibited? Unbounded queries cause Out-Of-Memory (OOM) crashes and table locks on growing tables.
- [ ] **Unindexed Meta Query Ban (P1):** Is `WP_Meta_Query` with multiple clauses on unindexed `meta_value` columns forbidden on collections expected to exceed 10,000 records?
- [ ] **`post__not_in` on Large Collections (P1 / P2):** Is `post__not_in` forbidden on datasets > 1,000 items? (Degrades indexes into full table scans; filter in PHP or invert into indexed `post__in` / taxonomy queries).
- [ ] **The Non-Existent Options Trap (P2):** Are high-frequency options pre-seeded with defaults and `autoload = 'yes'`? (Calling `get_option()` on non-existent keys bypasses `alloptions`, firing 70–160 redundant `SELECT option_value ... LIMIT 1` queries per page load).
- [ ] **Frontend Database Writes Ban (P1 FATAL):** Are `update_option()`, `add_option()`, and `wp_update_post()` strictly blocked during non-administrative frontend GET requests?
- [ ] **Composite Indexing (P2):** Do custom tables have explicit composite indexes covering common multi-column lookup dimensions?
- [ ] **Autoload Bloat Prevention (P2):** Are options with large payloads or low access frequency registered with `autoload = 'no'`? (Total autoloaded options must remain < 512 KB).
- [ ] **Atomic Schema Migrations (P1):** Do schema migrations provide both forward execution (`up`) and deterministic rollback (`down`) or verification gates?

## 4. Cache & Concurrency Defense (P1 / P2)
- [ ] **Production `wp_cache_flush()` Ban (P1 FATAL):** Is calling `wp_cache_flush()` strictly prohibited in production runtime paths?
  *(Global flush drops cache hit rate to 0% server-wide, triggering a massive Thundering Herd and pinning database CPU at 100%)*.
- [ ] **Page Cache Session Leak Ban (P1 FATAL):** Are `session_start()` and persistent cookie writing (`setcookie()`) prohibited on public frontend GET routes? (Emitting `Set-Cookie` or `Cache-Control: no-cache` invalidates Nginx FastCGI, Varnish, and Cloudflare edge caches).
- [ ] **Dynamic Transient Key Anti-Pattern (P2):** Are dynamic transient keys (`set_transient("prefix_{$id}", ...)`) prohibited unless backed by a guaranteed external object cache drop-in? (Without Redis/Memcached, each transient creates two rows in `wp_options`, causing multi-megabyte table bloat).
- [ ] **Cache Stampede Prevention (P2):** Are high-traffic cache operations protected against Thundering Herd using Soft/Hard TTL, versioned group keys, or distributed atomic locks?
- [ ] **Transient Expiration & Grouping (P2):** Do transients specify sensible TTL bounds, and do group invalidations use atomic version counters rather than scanning all keys?

## 5. Verification, Evidence & Modern PHP Standards (P1 / P2)
- [ ] **The Result Contract Invariant (P1 FATAL):** Does every performance refactoring or query optimization preserve the EXACT Result Contract (sort order, filters, pagination bounds, visibility, multisite scoping)? A faster query that alters results is rejected as a bug.
- [ ] **Evidence-Based Baseline & Budget (P2):** Is any performance claim backed by empirical before/after measurements (cURL TTFB, query count, memory)? A review is read-only first—claims without baselines remain hypotheses.
- [ ] **Strict Types & Modern PHP (P2):** Do new PHP files declare `declare(strict_types=1);` and utilize modern PHP 8.2+ typing (typed properties, return types, enums, match expressions)?
- [ ] **Distribution Compatibility (P1):** Is backward compatibility to PHP 7.4+ guaranteed through the automated Rector downgrade pipeline (`DOWN_TO_PHP_74`)?
- [ ] **Zero Speculative Error Suppression (P2):** Are speculative `isset()`, `empty()`, or empty `try/catch` blocks that merely conceal upstream data corruption rejected?
- [ ] **Empirical Verification Receipts (P2):** Is every non-trivial bugfix or feature accompanied by a failing test that now passes (PHPUnit or `WP_UnitTestCase`)?

---

## 6. Mechanical Regex Quick-Scan Suite (`ripgrep`)

Run these mechanical scan patterns across the codebase during Sub-Review 2 to detect critical performance regressions in seconds:

```bash
# 1. Critical unbounded queries (P1 FATAL)
rg -n "posts_per_page\s*.*-1|numberposts\s*.*-1" . -g '*.php'

# 2. Page Cache session leaks on frontend (P1 FATAL)
rg -n "session_start\s*\(" . -g '*.php'

# 3. Database writes on frontend GET lifecycles (P1 FATAL)
rg -n "update_option|add_option|wp_update_post" . -g '*.php'

# 4. Dangerous query anti-patterns
rg -n "query_posts\s*\(" . -g '*.php'
rg -n "post__not_in" . -g '*.php'

# 5. Dynamic transient key explosion (P2)
rg -n "set_transient\s*\([^,]+\\$" . -g '*.php'

# 6. Uncached remote HTTP calls (P2)
rg -n "wp_remote_get|wp_remote_post|file_get_contents\s*\(\s*['\"]https?://" . -g '*.php'

# 7. Unbounded polling loops / self-DDoS (P1)
rg -n "setInterval.*(fetch|ajax|\\$\\.)" . -g '*.{js,ts,jsx,tsx,php}'

# 8. Uncached expensive post lookups (P2)
rg -n "url_to_postid|attachment_url_to_postid|count_user_posts" . -g '*.php'
```

