# Task 5 Manual Review Package

## Artifacts

- Brief: `.superpowers/sdd/booking-other-work-type/task-5-brief.md`
- Verifier report: `.superpowers/sdd/booking-other-work-type/task-5-report.md`
- Feature baseline snapshots: `.superpowers/sdd/booking-other-work-type/baseline/`

## Corrected verification commands approved by the user

- Apps Script parser: `Get-Content -LiteralPath 'gas-deploy\code.gs' -Raw | node --check`
- JavaScript.html parser: read wrapper with explicit `<script>\n` prefix and `\n</script>` suffix, then parse its extracted body with `new Function`.

## Verified static results

- `src/app.js` parser: pass.
- `gas-deploy/app.js` parser: pass.
- `gas-deploy/code.gs` stdin parser: pass.
- `gas-deploy/JavaScript.html` extracted script parser: pass.
- Booking helper, API action, backend entry point, and existing Telegram `ประเภทงาน` mapping: found in expected source/mirror locations.
- Frontend mirrors: synchronized with `build.js` output.
- Out-of-scope snapshots: `index.html`, config, GViz, and CSS artifacts byte-equal to their pre-feature snapshots.
- Expected changed product files only: `src/app.js`, `gas-deploy/app.js`, `gas-deploy/JavaScript.html`, `gas-deploy/code.gs`.

## Known runtime limitation

Browser modal interaction, live Apps Script writes, Telegram delivery, login, real create/cancel booking flows, and mobile visual checks were not run. Fuel/insurance/maintenance functional tests were intentionally excluded by the user-approved scope.

## Review request

Give separate verdicts for Task 5 spec compliance and verification quality. Treat unrun runtime checks as an explicitly recorded limitation, not evidence that they passed. Flag only genuine requirement gaps or new regression risk.
