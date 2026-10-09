# Fermenter Copilot

Copilot is an integrated **offline demo assistant**, not a live language model.
It uses the same localStorage-backed services and existing health engine as the
Control Tower. No environment variables or API keys are required.

The primary workspace is a single floating panel mounted in the authenticated
Shell. It remains mounted when minimized or when navigating, and resets on user
change/logout. The old `#/copilot` route opens this same panel over the dashboard.
Project/blocker shortcuts open it in place without navigation. Desktop uses a
416 × 640 panel constrained by the viewport; mobile leaves the bottom navigation
and safe areas clear. Shared overlays temporarily hide the panel.

The six welcome actions execute service requests: My Tasks, What Should I Do
Next?, At-Risk Projects, Report a Delay, Project Status and Today's Summary.
Report a Delay asks for a project/component and reported days rather than
inventing values. The consistent demo date is **9 October 2026** across modules.

## Verification

- `pnpm exec tsc --noEmit`
- `pnpm build`
- `node tests/copilot.mjs`

The isolated test harness bundles the service with Vite and uses an in-memory
storage adapter. It never edits the running browser's demo records.

## Supported operations

Personal pending, due/overdue tasks and ranked priorities; project status and
calculated health/risk; blockers; vendor work packages; pending document
approvals; milestones; recorded task dependencies; scoped activity history.
Daily summaries are role-aware and include relevant exceptions and commitments.

Confirmed writes: task completion (checks dependencies), task/blocker
assignment, blocker resolution, vendor work-package forecast changes, blocker
creation, and comments/progress notes. Tasks have no progress percentage field,
so progress reports are recorded as comments rather than invented percentages.

Writes revalidate demo session, record scope, ownership, input, and stale
snapshots in the service. Shared-service operations, audit history, notifications
where existing services support them, and stored health recalc are staged into
one persisted transaction. Failed persistence publishes nothing. Identical open
blockers are rejected. Different descriptions of the same issue still require
human duplicate review.

## Limitations and production boundary

- No backend exists. Demo authorization is **not server-side security**.
  The role switcher and browser storage are intentionally editable demo tools.
- No live AI, provider endpoint, external database, cross-device persistence,
  model timeout/rate-limit handling, or secure model integration is claimed.
  A production deployment needs authenticated server-side action execution
  before connecting a provider. Never add provider keys to `VITE_*` variables.
- The small deterministic grammar supports the documented common phrases;
  unsupported messages ask for clarification. It is not general-purpose NLU.
- “First one” and selected-record references use a small in-memory context;
  ambiguous plural references request a selection. New Conversation clears it.
  History survives navigation/minimization but not logout or browser reload.
- No critical-path or schedule-buffer model exists. Dependency evidence is
  shown, and final delivery impact is explicitly unconfirmed.
- New blockers default to Medium / Engineering with impact under assessment.
  Use the detailed blocker module for category, severity, financial impact and
  escalation. Vendor delays match the actual selected component/vendor, update
  a matching unresolved blocker or create a vendor blocker, append a comment,
  and synchronize matching open purchase orders. Additional reported delay
  accumulates on the blocker, not on the customer delivery date. Repeated
  confirmation of the same stale proposal is rejected.
- Browser-based desktop/mobile interaction and console checks require manual
  verification in the preview; no browser automation capability was available.
