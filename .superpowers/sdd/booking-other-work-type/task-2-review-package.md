# Task 2 Manual Review Package

This repository has no Git metadata, so this package identifies the approved Task 2 change directly. Task 1 was separately reviewed clean; the helper block is shown only as existing context.

## Brief

`.superpowers/sdd/booking-other-work-type/task-2-brief.md`

## Implementer report

`.superpowers/sdd/booking-other-work-type/task-2-report.md`

## Changed file/anchor

- `src/app.js` inside `prepareBookingPayload(form)` immediately after the existing `purposeSelect`/`projectNameInput` mapping.

## Task 2 diff

```diff
@@ prepareBookingPayload(form): after existing payload.workType mapping @@
+  const otherWorkTypeInput = document.getElementById('form-purpose-other');
+  if (purposeSelect && String(purposeSelect.value || '').trim() === 'อื่นๆ') {
+    const customWorkType = otherWorkTypeInput
+      ? otherWorkTypeInput.value.trim()
+      : '';
+
+    if (!customWorkType) {
+      if (otherWorkTypeInput) {
+        otherWorkTypeInput.required = true;
+        if (typeof otherWorkTypeInput.reportValidity === 'function') {
+          otherWorkTypeInput.reportValidity();
+        }
+        if (typeof otherWorkTypeInput.focus === 'function') {
+          otherWorkTypeInput.focus();
+        }
+      }
+      throw new Error('กรุณาระบุประเภทงานอื่นๆ');
+    }
+
+    payload.workType = customWorkType;
+  }
```

## Binding constraints

- Keep `payload.workTypeOther` unchanged and present as the existing named form control.
- Normal work types and `submitBooking` loading/error/finally flow remain unchanged.
- Task 1 helper and its guarded call remain unchanged.
- No backend, HTML, CSS, config, generated mirror, or other-form changes.
- Source syntax command: `node --check .\src\app.js` passed with exit code `0`.
