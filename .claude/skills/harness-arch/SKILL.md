---
name: harness-arch
description: On-demand evolutionary architecture under agent-harness governance. Trigger-based (NOT per-task): structural milestones only — new modules, structural refactors, threshold crossings. Runs baseline, staged triple-gate verification, offline ratchet, and manifesto compliance.
---

# Harness Arch (`/harness-arch`)

On-demand architecture governance. Source of Truth: `plans/per-task-architecture-plan.md` (v2.3.0).

## 1. Trigger check (no ceremony by default)
Activate ONLY on structural milestones: new `src/Modules/<Slug>/`, structural refactor (Strangler Fig), numeric threshold (>5 files or DB/Auth/REST touch), or new public surface. Routine tasks and hotfixes: Clean-on-Touch gate only, no manifesto.

## 2. Modes
1. **Baseline:** `.harness/arch/harness-arch-verify --bootstrap-baseline` at init; day-0 stays GREEN.
2. **Manifesto (structural tasks):** write `.harness/tasks/active/<id>/manifesto.json` per `templates/tasks/manifesto.schema.json`; link from TASK.md CP-1; human approves before code.
3. **Verify:** `harness-arch-verify --verify-staged` runs in `pre-commit` (read-only triple-gate: count ceiling + fingerprint set + multiset frequency).
4. **Ratchet:** `.harness/arch/harness-arch-verify --ratchet` offline at task end; human commits baseline + hash-pin atomically. NEVER in hooks.
5. **Review:** `principal-review` checks code against `manifesto.json`; exceptions become Precedent cards with Semgrep rules (never silent baseline edits).

## 3. Guards
Deptrac = class graph; `WpdbLeakRule` (PHPStan AST) = `$wpdb`/query leaks; Semgrep = procedural WP functions. Baseline is hash-pinned; direct writes denied. `merge=union` needs sorted keys; duplicates fail closed.
