---
name: harness-security-audit
description: On-demand, adversarial 360-degree security audit for WordPress codebases. Combines Cloudflare-style dual-verification (Hunter vs Verifier) with deep WordPress-native attack classes (SQLi, Nonce!=Cap, REST exposure, SSRF, XSS, IDOR).
---

# Harness Security Audit (`/harness-security-audit`)

An on-demand, adversarial security audit pipeline specialized for Enterprise WordPress development under full `agent-harness` governance.
Source of Truth: `/Users/moeini/Dev/agent-harness/AGENTS.md` (Team D: Review Board & Specialist Security Reviewer).

---

## 1. Operating Invariants & Governance

1. **Strictly On-Demand (Never in Routine CI/Pre-Commit):**
   This workflow does **not** run in routine commits or daily task iterations. It is summoned explicitly by the human lead (e.g. prior to final client delivery, major releases, or when evaluating untrusted codebases).
2. **Dual-Agent Adversarial Verification (Cloudflare Principle):**
   The agent that hypothesizes a vulnerability (The Hunter) is never the agent that certifies it. Every unique candidate finding must pass an independent adversarial verifier whose mandate is to **disprove** the candidate and eliminate false positives.
3. **Evidence-Backed Findings (No Hallucinated Fluff):**
   A vulnerability is logged as confirmed only when:
   - The complete source trace is mapped (Source $\rightarrow$ Transform $\rightarrow$ Sink).
   - An actionable Exploit Proof-of-Concept (PoC) or reproduction vector is formulated.
   - The underlying protection mechanism is proven absent or bypassable.
4. **Zero Code Mutation:**
   This workflow is strictly **read-only and report-driven**. It audits and outputs findings into `SECURITY-AUDIT.md` without altering production code.

---

## 2. The 6 WordPress Attack Classes (WAC Matrix)

Unlike generic AST scanners that hunt for C/Rust memory bugs, this engine focuses 100% on the attack vectors specific to WordPress architectures:

### WAC-1: SQL Injection & Database Bypasses
- **Vulnerable Sink:** `$wpdb->query()`, `$wpdb->get_results()`, `$wpdb->get_var()`, `$wpdb->get_row()`.
- **Core Checks:**
  - Direct string concatenation or `sprintf()` without `$wpdb->prepare()`.
  - Misuse of `$wpdb->prepare()` with dynamic table names or column identifiers (requires identifier escaping or `%i` in modern WordPress).
  - Unsanitized inputs inside `IN (...)` clauses or raw clauses inside `WP_Query` (`meta_query`, `tax_query`).

### WAC-2: Broken Access Control & Nonce Misconceptions
- **Core Rule:** `wp_verify_nonce()` protects against CSRF; **it does not authorize user actions**.
- **Core Checks:**
  - Executing administrative state changes (settings save, deletion, export) with only nonce verification and no `current_user_can()`.
  - Inadequate capability checks (e.g. checking `edit_posts` instead of `manage_options` for global plugin settings).
  - Privilege escalation in user registration, password reset, or role update flows.

### WAC-3: REST API & AJAX Surface Exposure
- **Vulnerable Sink:** `register_rest_route()`, `wp_ajax_*`, `wp_ajax_nopriv_*`.
- **Core Checks:**
  - REST endpoints missing `'permission_callback'` or configured with `'permission_callback' => '__return_true'` on state-mutating (`POST`, `PUT`, `DELETE`) routes.
  - Leaking sensitive user data (hashes, tokens, phone numbers, PII) in public REST responses.
  - State manipulation via `wp_ajax_nopriv_*` without rate-limiting, IP bounds, or state verification.

### WAC-4: Server-Side Request Forgery (SSRF) & Remote HTTP
- **Vulnerable Sink:** `wp_remote_get()`, `wp_remote_post()`, `wp_safe_remote_get()`.
- **Core Checks:**
  - Fetching user-supplied URLs without restricting IP ranges or protocols (accessing `127.0.0.1`, `169.254.169.254` AWS metadata, or private RFC 1918 subnets).
  - Webhook delivery logic susceptible to DNS rebinding attacks.

### WAC-5: Cross-Site Scripting (XSS) & Late Escaping Breaches
- **Vulnerable Sink:** `echo`, `print`, `_e()`, admin table cells, AJAX HTML templates.
- **Core Checks:**
  - Outputting variables from `$_GET`, `$_POST`, `$_REQUEST`, or database options without late escaping (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`).
  - Stored XSS in metabox inputs or settings fields accessible to lower-privileged roles (Contributor/Author).
  - DOM-based XSS in frontend scripts using `innerHTML` or unescaped jQuery templates.

### WAC-6: Insecure Direct Object Reference (IDOR) & Business Logic Flaws
- **Vulnerable Sink:** Download handlers, course playback, invoice generation, OTP authentication.
- **Core Checks:**
  - Serving protected media or digital assets based on an unverified query parameter (e.g. `?download_file_id=123`) without verifying user ownership.
  - Replay attacks on OTP / SMS verification (failure to delete transients immediately upon first successful use).
  - Cart or checkout price tampering via client-side manipulation of AJAX payloads.

---

## 3. The 3-Phase Audit Workflow

```
[Phase 1: Recon & Static Probe] -> [Phase 2: Hunter Analysis] -> [Phase 3: Adversarial Validation] -> [SECURITY-AUDIT.md]
```

### Phase 1: Surface Reconnaissance (Zero-Token Static Scan)
Execute surgical static probes using AST and regex scanners across the target codebase:

```bash
# WAC-1 (SQL Injection): Unprepared queries with string concatenation or interpolation (-P enables PCRE2 lookahead)
rg -P '\$wpdb->(?:query|get_results|get_row|get_var)\s*\(\s*(?!\$wpdb->prepare|"[^"$]*"|\x27[^$\x27]*\x27|\$query\s*\))' src/

# WAC-2 (Access Control): Nonce verification present without capability checks
rg 'check_admin_referer|wp_verify_nonce' src/

# WAC-3 (REST Exposure): Public REST routes configured with __return_true
rg "'permission_callback'\s*=>\s*['\"]?__return_true['\"]?" src/

# WAC-4 (SSRF): Remote HTTP calls handling arbitrary URLs
rg 'wp_(?:safe_)?remote_(?:get|post|request)\s*\(' src/

# WAC-5 (XSS): Unescaped outputs of superglobals or request variables (-P enables PCRE2 lookahead)
rg -P 'echo\s+(?!\$this->|esc_html|esc_attr|esc_url|wp_kses|\$wpdb|true|false|\d+)\$[a-zA-Z0-9_]+' src/

# AST Verification: High-precision AST node validator (eliminates string false positives)
php /Users/moeini/Dev/wpdev-platform/agent-harness/bin/ast-validator.php --dir=src/
```
Establish an attack surface ledger of endpoints, parameters, and database sinks.

### Phase 2: WordPress-Native Hunter
- The Hunter agent evaluates the attack surface against the 6 WAC classes.
- For each potential flaw, formulates a formal **Candidate Record**:
  - `candidate_id`: `[WAC-XX-NN]`
  - `sink_file`: Path and line number
  - `vector`: Vulnerability mechanism
  - `exploit_hypothesis`: Narrative of how an attacker could trigger it

### Phase 3: Adversarial Validation Gate
- A fresh evaluation context acts as the **Adversarial Verifier**.
- Verifier attempts to disprove the finding:
  - Is the input already sanitized upstream by framework middleware?
  - Does WordPress Core sanitize this parameter automatically (e.g. `rest_sanitize_request_arg`)?
  - Is there an implicit capability check or unbypassable nonce upstream?
- **Result:**
  - **CONFIRMED:** Verifier could not disprove; exploit vector is viable.
  - **REJECTED (False Positive):** Disproved with concrete code proof.
  - **NEEDS_REVIEW:** Theoretical risk depending on host environment configuration.

---

## 4. Deliverable: `SECURITY-AUDIT.md`

The audit concludes by writing a structured, actionable report to `<target-project>/.harness/SECURITY-AUDIT.md`:

```markdown
# 🛡️ WordPress Security Audit Report

- **Date:** YYYY-MM-DD
- **Target:** <Project Name>
- **Audit Profile:** On-Demand Full Surface
- **Verified Findings:** N Critical | N High | N Medium | N Low

## 1. Executive Summary
Brief high-level posture overview and immediate action items.

## 2. Findings Matrix

| ID | Class | Severity | File & Line | Status |
|---|---|---|---|---|
| WAC-02-01 | Broken Access Control | Critical | `src/Modules/Settings/Save.php:42` | CONFIRMED |

## 3. Detailed Vulnerability Dossiers

### [WAC-02-01] Missing Capability Check on Settings Update
- **Severity:** Critical
- **File:** `src/Modules/Settings/Save.php:42`
- **Sink:** `update_option('site_gateway_keys', $keys)`
- **Vulnerability Mechanism:** Action verifies nonce but omits `current_user_can('manage_options')`. Any authenticated subscriber can post to this endpoint and overwrite payment keys.
- **PoC Vector:** `POST /wp-admin/admin-ajax.php?action=save_gateway_keys` with valid nonce.
- **Recommended Fix:**
  ```php
  if ( ! current_user_can( 'manage_options' ) ) {
      wp_die( esc_html__( 'Unauthorized', 'text-domain' ), 403 );
  }
  ```
```
