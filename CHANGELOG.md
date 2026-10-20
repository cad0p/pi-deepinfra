# Changelog

All notable changes to this project will be documented in this file.

## [calver-released]

<!-- USER-EDITABLE SECTION START -->
<!-- Add your curated release notes here. -->
<!-- USER-EDITABLE SECTION END -->

### 🚀 Features

- Service tiers (flex/priority) + cost that matches the invoice (closes #14)

### 🐛 Bug Fixes

- Ship pricing.ts, and fail CI when a module is not packaged (closes #16)

### ⚙️ Miscellaneous Tasks

- Rename the npm package to @cad0p/pi-deepinfra-provider (closes #9)
- Drop the billing footer and /deepinfra-billing (closes #7)
- Point the manifest and README at the renamed repo (closes #12)


## [0.1.5] - 2026-10-20

<!-- USER-EDITABLE SECTION START -->
Fork of [puetsua/pi-deepinfra](https://github.com/puetsua/pi-deepinfra). Two behaviour changes, both driven by what the live DeepInfra API and pi actually do: thinking levels now cover the whole `reasoning_effort` enum (so `max` is reachable), and the footer no longer repeats the session token/cost line pi already renders.
<!-- USER-EDITABLE SECTION END -->

### 🚀 Features

- Full reasoning-effort vocabulary: `off/minimal/low/medium/high/xhigh/max` map to `none/minimal/low/medium/high/xhigh/max`. pi hides `xhigh`/`max` unless a model's `thinkingLevelMap` names them explicitly, so the previous `{ off: "none" }` map capped the selector at `high` and silently clamped `max` back down. DeepInfra validates one global enum for every chat model (an invalid value returns HTTP 422 listing `none, minimal, low, medium, high, xhigh, max`), so the complete map is correct for every model.
- `PI_DEEPINFRA_FOOTER=off` suppresses the statusline.

### 🐛 Bug Fixes

- Footer no longer duplicates pi's own footer: session input/output tokens and cost are gone, only the DeepInfra monthly spend (and configured limit) remains. This also drops the per-message footer recomputation.
