# Task 4 Independent Review — booking-other-work-type

Date: 2026-08-04  
Reviewer: Independent reviewer

## Scope Reviewed

- Brief: `.superpowers/sdd/booking-other-work-type/task-4-brief.md`
- Implementer report: `.superpowers/sdd/booking-other-work-type/task-4-report.md`
- Review package: `.superpowers/sdd/booking-other-work-type/task-4-review-package.md`
- Build script: `build.js`
- Frontend source: `src/app.js`
- Generated files: `gas-deploy/app.js`, `gas-deploy/JavaScript.html`, `gas-deploy/index.html`, `gas-deploy/config.js`, `gas-deploy/gviz-service.js`, `gas-deploy/gviz-service.html`, `gas-deploy/style.css`, `gas-deploy/Style.html`
- Baseline snapshots: `.superpowers/sdd/booking-other-work-type/baseline/`

## Method

1. Read the Task 4 brief, implementer report, and review package.
2. Inspected `build.js` to verify the authoritative generation logic.
3. Verified `src/app.js` ↔ `gas-deploy/app.js` equality and `gas-deploy/JavaScript.html` equality against the exact wrapper produced by `build.js`.
4. Compared current generated files against the listed baseline snapshots using hashes and line-level diff checks.
5. Checked the required booking markers with:

```powershell
rg -n -S "form-purpose-other|setupBookingOtherWorkTypeField|workTypeOther" src\app.js gas-deploy\app.js gas-deploy\JavaScript.html gas-deploy\index.html
```

## Fact / Assumption / Missing Information

### Facts

- `build.js` wraps generated HTML as:

```js
const wrapped = `<${tagName}>\n${content}\n</${tagName}>`;
```

- `build.js` directly copies:
  - `src/app.js` -> `gas-deploy/app.js`
  - `src/style.css` -> `gas-deploy/style.css`
  - `src/config.js` -> `gas-deploy/config.js`
  - `src/gviz-service.js` -> `gas-deploy/gviz-service.js`

- `src/app.js` and `gas-deploy/app.js` match exactly byte-for-byte.
- `gas-deploy/JavaScript.html` matches the exact `build.js` wrapper output `<script>\n` + `src/app.js` + `\n</script>` and does not end with a final trailing newline.
- The required booking markers appear in `src/app.js`, `gas-deploy/app.js`, `gas-deploy/JavaScript.html`, and existing approved markup in `gas-deploy/index.html`.
- `gas-deploy/index.html` matches `.superpowers/sdd/booking-other-work-type/baseline/index.html`.
- `gas-deploy/gviz-service.js` matches `.superpowers/sdd/booking-other-work-type/baseline/gviz-service.js`.
- `gas-deploy/gviz-service.html` matches `.superpowers/sdd/booking-other-work-type/baseline/gviz-service.html`.
- `gas-deploy/config.js` does **not** match `.superpowers/sdd/booking-other-work-type/baseline/config.js`.
- `gas-deploy/style.css` and `.superpowers/sdd/booking-other-work-type/baseline/style.css` have different byte hashes, but line-by-line normalized content is identical.
- `gas-deploy/Style.html` and `.superpowers/sdd/booking-other-work-type/baseline/Style.html` have different byte hashes, but line-by-line normalized content is identical.
- The observed CSS snapshot differences are caused by line-ending / serialization drift, not by changed CSS rules:
  - baseline `style.css`: LF line endings
  - current `gas-deploy/style.css`: CRLF line endings
  - baseline `Style.html`: LF line endings
  - current `gas-deploy/Style.html`: wrapper plus CRLF-normalized embedded CSS

### Assumptions

- The files under `.superpowers/sdd/booking-other-work-type/baseline/` are the intended acceptance snapshots for this review.

### Missing Information

- There is no authoritative evidence in the review materials proving whether the current `config.js` drift and CSS EOL drift were introduced by Task 4 itself or were already present before this review window.
- I did not rerun `npm run build` in this review turn because the user explicitly restricted writes to the review artifact and prohibited product-file edits.

## Verdict 1 — Spec Compliance

Verdict: FAIL

### Evidence

1. Frontend mirror synchronization passes when measured against the actual generator logic in `build.js`:

```text
appEqual: true
wrapperEqual: true
wrapperEndsWithNewline: false
```

2. `gas-deploy/index.html`, `gas-deploy/gviz-service.js`, and `gas-deploy/gviz-service.html` remain aligned with their listed snapshots.

3. `gas-deploy/config.js` is not unchanged versus the listed snapshot. The current file contains extra standalone routing logic that is absent from baseline:

```diff
+      var isStandalone = (typeof google === 'undefined' || !google.script || !google.script.run);
       var webAppUrl = normalizeUrl(cfg.webAppUrl);
-      if (!webAppUrl || webAppUrl === 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE') {
+      if (!isStandalone && (!webAppUrl || webAppUrl === 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE')) {
...
-          var useGet = isReadAction(action);
-          var requestUrl = useGet ? buildGetUrl(webAppUrl, action, payload) : webAppUrl;
+          var useGet = !isStandalone && isReadAction(action);
+          var requestUrl = isStandalone ? '/api/gas' : (useGet ? buildGetUrl(webAppUrl, action, payload) : webAppUrl);
```

### Findings

1. Severity: High  
   Finding: `gas-deploy/config.js` is out of sync with the listed baseline snapshot, so the requested unchanged `index/config/GViz` condition is not fully satisfied.  
   Evidence: SHA-256 mismatch plus line-level diff around lines 170-191 introducing `isStandalone` and `/api/gas` routing behavior.  
   Impact: Task 4 cannot be accepted as fully compliant on the current artifact set because an out-of-scope generated file differs materially from the stated snapshot expectation.  
   Recommendation: Reconcile `gas-deploy/config.js` against the intended approved baseline before accepting Task 4, or explicitly rebaseline with written approval if this drift is already sanctioned.

## Verdict 2 — Task Quality

Verdict: PASS WITH FINDINGS

### Evidence

1. The core Task 4 objective was achieved cleanly for the frontend JS mirrors:
   - `src/app.js === gas-deploy/app.js`
   - `gas-deploy/JavaScript.html` matches the exact current `build.js` output

2. The implementer report correctly recognized that the brief’s initial wrapper verification command expected an extra trailing newline that `build.js` does not generate.

3. The generated CSS snapshot differences are real at the byte level but not at the CSS-rule/content level.

### Findings

1. Severity: Medium  
   Finding: `gas-deploy/style.css` and `gas-deploy/Style.html` differing from baseline **do count as an out-of-scope task finding**, because the task carries an explicit “make no CSS changes” constraint and the generated CSS artifacts are not byte-identical to the approved snapshots.  
   Evidence:
   - `gas-deploy/style.css` hash differs from baseline.
   - `gas-deploy/Style.html` hash differs from baseline.
   - Normalized line-by-line comparison shows no CSS-rule/content deltas; the drift is EOL/serialization only.  
   Assessment: This is a process/artifact-stability violation, not a functional CSS behavior change.  
   Impact: Low functional risk, but it still violates the strict no-CSS-change constraint if acceptance is based on artifact equality rather than semantic CSS equivalence.  
   Recommendation: Either normalize line endings in the build/output pipeline and baseline snapshots, or explicitly define that byte-only EOL churn is acceptable; until then, keep this as an out-of-scope finding.

2. Severity: Medium  
   Finding: The review package statement that `gas-deploy/config.js` matches its Task 4 snapshot is incorrect for the current workspace state.  
   Evidence: Current hash `4BAD525C73DCE043A952CAE4D8742F34F3CC75D3B0D45196E239121A1C8153EA` differs from baseline hash `7CA6B2A4CD8410064D6E2EEB03D02F0BEB6BE3843C0B1858644FB0CF26C0E771`, with substantive line-level differences.  
   Impact: The package overstates the verified unchanged scope.  
   Recommendation: Correct the review package or acceptance notes before sign-off.

## Unverifiable Items

1. I cannot prove from the provided materials alone whether the `config.js` drift originated in Task 4 or pre-existed it.
2. I cannot prove from the provided materials alone whether the CSS EOL drift was introduced by a prior build environment, prior task, or this exact task execution.

## Final Recommendation

Do not approve Task 4 as fully compliant in its current state. The JS mirror objective passes, but the current generated artifact set still has:

- a High-severity out-of-scope `gas-deploy/config.js` snapshot mismatch, and
- a Medium-severity CSS artifact drift finding that violates the strict no-CSS-change constraint at the file/artifact level, even though no semantic CSS rule change was evidenced.
