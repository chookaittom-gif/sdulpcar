# Task 4 Manual Review Package

This repository has no Git metadata. Review the build-generated output against the explicit snapshots and constraints.

## Artifacts

- Brief: `.superpowers/sdd/booking-other-work-type/task-4-brief.md`
- Implementer report: `.superpowers/sdd/booking-other-work-type/task-4-report.md`
- Frontend source: `src/app.js`
- Generated mirrors: `gas-deploy/app.js`, `gas-deploy/JavaScript.html`
- Snapshots: `.superpowers/sdd/booking-other-work-type/baseline/`

## Verified build behavior

- `npm run build` succeeded.
- `src/app.js` equals `gas-deploy/app.js` byte-for-byte.
- `gas-deploy/JavaScript.html` equals the exact `build.js` wrapper: `<script>\n` + source + `\n</script>` with no final trailing newline.
- `gas-deploy/index.html`, `gas-deploy/config.js`, `gas-deploy/gviz-service.js`, and `gas-deploy/gviz-service.html` match their Task 4 snapshots.

## Scope evidence requiring review

The build also regenerated CSS files that differ from their snapshots even though no CSS source was modified for this feature:

- `gas-deploy/style.css` differs from `.superpowers/sdd/booking-other-work-type/baseline/style.css`.
- `gas-deploy/Style.html` differs from `.superpowers/sdd/booking-other-work-type/baseline/Style.html`.

The approved global constraints explicitly say: `Add no dependencies and make no CSS changes.` Determine whether these generated CSS differences are an out-of-scope task finding. Do not change files in the review.

## Binding constraints

- Production source is `src/app.js`; generated frontend files may be changed only through `npm run build`.
- This feature must not change CSS, HTML markup, config, GViz, fuel/insurance/maintenance forms, or API/backend behavior during Task 4.
- Do not run `npm run push`.
