# Task 1 Manual Review Package

This repository has no Git metadata, so this package replaces the Git-based review-package artifact. Review against the baseline snapshot and current file.

## Brief

`.superpowers/sdd/booking-other-work-type/task-1-brief.md`

## Implementer report

`.superpowers/sdd/booking-other-work-type/task-1-report.md`

## Baseline/current pair

- Baseline: `.superpowers/sdd/booking-other-work-type/baseline/src-app.js`
- Current: `src/app.js`

## Diff

```diff
@@ prepareBookingForm() after existing populate loop @@
+  try {
+    setupBookingOtherWorkTypeField();
+  } catch (e) {
+    console.warn('setupBookingOtherWorkTypeField error:', e);
+  }
+
@@ new booking-form helper near prepareBookingForm() @@
+function setupBookingOtherWorkTypeField() {
+  const purposeSelect = document.getElementById('form-purpose');
+  const otherWrap = document.getElementById('form-purpose-other-wrap');
+  const otherInput = document.getElementById('form-purpose-other');
+  if (!purposeSelect || !otherWrap || !otherInput) return;
+
+  const sync = (shouldFocus) => {
+    const isOther = String(purposeSelect.value || '').trim() === 'อื่นๆ';
+    otherWrap.classList.toggle('hidden', !isOther);
+    otherInput.required = isOther;
+
+    if (!isOther) {
+      otherInput.value = '';
+    } else if (shouldFocus && typeof otherInput.focus === 'function') {
+      setTimeout(() => otherInput.focus(), 0);
+    }
+  };
+
+  if (purposeSelect.dataset.bookingOtherTypeWired !== 'true') {
+    purposeSelect.addEventListener('change', () => sync(true));
+    purposeSelect.dataset.bookingOtherTypeWired = 'true';
+  }
+
+  sync(false);
+}
```

## Binding constraints

- Booking form only; no backend, fuel, insurance, maintenance, CSS, config, or generated mirror changes in this task.
- The existing named `workTypeOther` input stays enabled so the existing FormData key shape is not changed.
- The helper must be idempotent and the source must parse with `node --check .\src\app.js`.
