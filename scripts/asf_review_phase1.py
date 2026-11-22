#!/usr/bin/env python3
"""ASF Independent Plan Reviewer for BidarCRM Phase 1.

Executes an independent review of docs/plans/asf-phase-1-tasks.md using the
asf-v6 router and the 5-stage EGM checklist (Plan 05 §4.3 / T19).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add asf-v6 packages to path if needed
ASF_PATH = Path("/Users/moeini/Dev/asf-v6")
if str(ASF_PATH / "packages" / "asf-router" / "src") not in sys.path:
    sys.path.insert(0, str(ASF_PATH / "packages" / "asf-router" / "src"))
if str(ASF_PATH / "packages" / "asf-factory" / "src") not in sys.path:
    sys.path.insert(0, str(ASF_PATH / "packages" / "asf-factory" / "src"))

from asf_router.sdk import AsfClient
from asf_factory.contracts import Review

CHECKLIST = """Review the execution plan (docs/plans/asf-phase-1-tasks.md) against this 5-stage checklist (EGM):
1. Purpose/value: Is what the product is for and why it is worth building clear?
2. Clarity/contradictions: Are any requirements in conflict? Any ambiguous wording or conflicting dependencies in the Task DAG?
3. Design & security risks: Any missing auth/data-handling requirements, CORS issues, timing attacks, or AGPL-3.0 compliance breaches?
4. Drift from user intent:
   - Does the plan strictly BAN Phase 2 from starting (INV-12)?
   - Does the plan enforce the UX/UI golden balance: UX very similar (~95% workflow parity), UI similar in structure, but ZERO 100% asset copying / Clean-Room IP (INV-14)?
5. Implementation readiness: Could a worker agent (e.g. Codex) write acceptance tests and code from these 26 tasks alone?

Return your evaluation in strict JSON matching the ASF Review schema:
{
  "verdict": "approve" | "revise",
  "issues": [
    {
      "severity": "blocker" | "major" | "minor",
      "stage": 1 | 2 | 3 | 4 | 5,
      "feature_key": "string or null",
      "problem": "detailed description of the issue",
      "fix": "actionable fix"
    }
  ],
  "summary": "comprehensive Persian review summary explaining the verdict, audit of Phase 2 isolation, UX/UI clean-room compliance, and technical readiness"
}
Note: verdict must be 'approve' if there are zero blocker and zero major issues."""

async def main():
    plan_path = Path("/Users/moeini/Dev/didar/docs/plans/asf-phase-1-tasks.md")
    if not plan_path.exists():
        print(f"Error: {plan_path} does not exist", file=sys.stderr)
        sys.exit(1)

    plan_content = plan_path.read_text(encoding="utf-8")

    prompt = f"""You are the ASF Factory Independent Plan Reviewer.
Conduct an exhaustive, independent review of the BidarCRM Phase 1 execution plan.

{CHECKLIST}

=== EXECUTION PLAN (asf-phase-1-tasks.md) ===
{plan_content}

Return ONLY valid JSON matching the schema above."""

    print("Sending plan to ASF Router for independent review...", file=sys.stderr)
    client = AsfClient()
    
    # Use tier 3 (e.g., gemini-api or agy)
    reply = await client.ask_once(prompt, tier=3)
    print(f"Received reply from executor: {reply.executor_id}", file=sys.stderr)

    text = reply.text.strip()
    # Extract JSON if enclosed in markdown code fences
    if text.startswith("```json"):
        text = text[len("```json"):].strip()
    elif text.startswith("```"):
        text = text[len("```"):].strip()
    if text.endswith("```"):
        text = text[:-len("```")].strip()

    try:
        data = json.loads(text)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Raw output (failed to parse as json: {e}):\n{reply.text}")

if __name__ == "__main__":
    asyncio.run(main())
