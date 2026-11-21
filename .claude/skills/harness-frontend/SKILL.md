---
name: harness-frontend
description: Bespoke Frontend Chameleon Engine workflow for WordPress products ("چند چهره بدون انشعاب"). Manages visual physics morphing (flat, material, glass, brutalist, cupertino), upgrade-safe delta manifests (inject, hide, move, replace), zero-waste single-archetype delivery, 6-layer CSS cascade defense, and native HTML5 island behaviors.
---

# Harness Frontend Chameleon Engine (`/harness-frontend`)

Governance, workflow, and verification rules for the Bespoke Frontend Chameleon Engine (`wpdev-chameleon` / `polaris-v2`).
Specification: `plans/bespoke-frontend-chameleon-plan.md` | Target: `packages/polaris-stack` & `packages/framework` (`WPDev\Chameleon\`).

## 1. Architectural Axioms & Invariants

1. **Zero Forked Template Files:**
   - Client websites must never override core PHP template files by copying them into child themes.
   - All customizations patch the Canonical Composition Graph ($G_v$) via the Tenant Delta Manifest filter:
     `add_filter('wpdev_chameleon_layout_manifest', fn(array $manifest) => [...]);`
2. **Orthogonal Separation of Layout vs Styling:**
   - Layout primitives (`Box`, `Stack`, `Grid`, `Cluster`, `Sidebar`, `Switcher`) control spacing and flow only.
   - Styled components control visual tokens and physics only.
3. **Zero-Waste Single-Archetype Delivery:**
   - The runtime conditionally enqueues or inlines ONLY the CSS corresponding to the active archetype (`data-archetype`) and rendered components on the current page.
   - Never bundle, transmit, or enqueue unused archetypes across the wire (e.g. transmitting glass or brutalist CSS when material is active).
4. **Cascade Defense (Spike-P Harmonized):**
   - Reset defense resides in `@layer ps.harden` using allowlisted properties with `!important`.
   - Core component styles are scoped under `.ps-root` and kept **unlayered** so their normal specificity defeats unlayered theme overrides.
5. **Container Queries for Component Autonomy:**
   - All responsive adaptations use CSS Container Queries (`@container`), allowing components to adapt whether in a 300px sidebar or 1200px full container.
6. **Sub-10KB Page-Level JS Ceiling:**
   - Summed JS payload on any page must be $\le 10$KB gzip.
   - 80% of interactions leverage native HTML5 primitives (`<dialog>`, `<details>`, `popover`).
   - Native dialog enhancer provides feature detection with iOS 15.0–15.3 fallback (~0.8KB).
7. **Declarative Data Dependency Batching:**
   - Injected widgets declare required contracts (`requires: ['user.identity@1', 'user.loyalty@1']`).
   - `DataBatchLoader` aggregates dependencies and executes queries in $\le 2 + C$ roundtrips ($C$ = distinct registered contracts).
   - Renderers receive read-only immutable `DashboardContextV1` exposing only allowlisted fields.
8. **RTL by Construction & Persian Typography Invariants:**
   - All stylesheets use CSS Logical Properties (`padding-inline`, `margin-inline-start`, `inset-inline`, `text-align: start`).
   - In Persian/RTL text, `letter-spacing` must remain strictly `0` or `normal` (never positive or negative; non-zero letter-spacing breaks cursive glyph ligatures).
   - Body line-height ratio must be `1.6 - 1.8` to avoid vertical ascender/descender collisions.
   - Mood-based typographic pairings (`formal`, `modern`, `luxury`, `playful`) are specified in `standards/frontend/persian-typography-overlay.json`.
9. **Anti-AI Slop & Micro-Interaction Sanity:**
   - Raw emoji characters (e.g. 🚀, 🔥, 💡) are strictly forbidden as visual UI icons. All icons must be semantic vector SVGs (`stroke="currentColor"`).
   - Cliché generic AI neon gradients (neon purple/pink/cyan on dark backgrounds) are forbidden (`PS-GRADIENT-002`).
   - Interactive state transitions (`:hover`, `:focus`, `:active`) must remain snappy between `150ms` and `300ms`. Instant `0s` (jarring) and sluggish `> 600ms` transitions are rejected (`PS-MOTION-003`).
10. **Minimal Micro-Doc Loading via Router:**
    - Load only the relevant micro-docs resolved by `standards/frontend/router.json` for touched files.

---

## 1.5. Workflow Phases & Governance

### Phase 1: Scoping & Promotion Level
- Evaluate required UI level against the progressive ladder:
  - **S0 (Static)**: HTML5 only.
  - **S1 (Server)**: PHP View components with native `<dialog>`, `<details>`, `popover`.
  - **S1.5 (Interactivity API)**: `data-wp-*` directives with server-rendered initial state.
  - **S2 (Preact Island)**: Complex state machines requiring admission score $\ge 3$ points and zero vetoes.
- If S1.5 or S2 is required, record structured admission in `TASK.md` section 3.6 before writing code.

### Phase 2: Design Intelligence & Contract
- **Pre-Flight Design Strategy**:
  - Calibrate design aesthetic, industry palette, and typography mood (`formal`, `modern`, `luxury`, `playful`) via `standards/frontend/persian-typography-overlay.json`.
  - Enforce anti-AI slop invariants (pure SVGs, no cliché gradients, snappy transitions).
- Author `DESIGN.md` based on `standards/frontend/DESIGN.template.md`.
- Bind existing tokens only (`tokens.json`).
- Include 2–3 reference inspirations (e.g. Linear, Stripe, Raycast, Mobbin/Refero).

### Phase 3: Implementation & Mechanical Gates
- Execute checkpoint by checkpoint.
- Before declaring any checkpoint complete, run mechanical gates:
  ```bash
  node .harness/frontend/governance-css.mjs
  node .harness/frontend/check-budget.mjs
  ```

---

## 2. Visual Physics Archetypes

Five mathematical token regimes morph the DOM via `[data-archetype="..."]`:

| Archetype | Shadow Physics | Corner Geometry | Surface Physics | Border Regime | Motion Dynamic |
|---|---|---|---|---|---|
| **Flat** | `none` | 2px / 4px crisp | 100% opaque, 0% tint | 1px solid | 100ms ease |
| **Material** | Ambient + Key dual light | 6px / 12px | 100% opaque, 4% tonal tint | 0px | 200ms cubic-bezier(0.2, 0, 0, 1) |
| **Glass** | Inset top-sheen | 8px / 16px | 70% opacity, 16px blur | 1px translucent | 240ms cubic-bezier(0.16, 1, 0.3, 1) |
| **Brutalist** | 4px 4px hard black offset | 0px sharp | 100% solid, high contrast | 2px solid black | 80ms steps(2, start) |
| **Cupertino** | Diffused organic | 8px / 14px squircle | 92% opacity, 20px blur | 0.5px solid | 250ms cubic-bezier(0.32, 0.72, 0, 1) |

---

## 3. Client Customization Contract

```php
// 1. Declare active archetype
add_filter('wpdev_chameleon_archetype', fn() => 'material');

// 2. Patch composition graph
add_filter('wpdev_chameleon_layout_manifest', function (array $manifest): array {
    return [
        [
            'op'       => 'inject',
            'slot'     => 'header.actions',
            'id'       => 'loyalty_badge',
            'weight'   => 5,
            'renderer' => function (\WPDev\Chameleon\Contracts\DashboardContextV1 $ctx) {
                $points = (int) $ctx->get('loyalty.points', 0);
                printf('<span class="ps-badge">Points: %d</span>', $points);
            },
            'requires' => ['user.identity@1', 'user.loyalty@1'],
        ],
        [
            'op'     => 'hide',
            'target' => 'section:quick_actions',
        ],
    ];
});
```

---

## 4. Verification & Testing

1. **PHPUnit Suite:**
   ```bash
   tests/docker-phpunit/run-phpunit.sh 'Chameleon'
   ```
   Must pass 100% green with zero errors.
2. **Polaris Asset Build:**
   ```bash
   cd packages/polaris-stack && npm run build
   ```
   Confirms all 5 discrete archetype CSS files compile to `dist/archetypes/`.
