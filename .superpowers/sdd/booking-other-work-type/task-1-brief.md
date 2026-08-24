### Task 1: Wire the booking other-work-type control once

**Files:**
- Modify: `src/app.js` near `prepareBookingForm` (currently around line 4640)
- Test: browser/manual booking-form interaction; no new test file

**Interfaces:**
- Consumes: existing DOM IDs `form-purpose`, `form-purpose-other-wrap`, and `form-purpose-other`.
- Produces: one global helper named `setupBookingOtherWorkTypeField()` and a stable `data-booking-other-type-wired="true"` marker on the select.

- [ ] **Step 1: Add the idempotent state helper beside the booking-form preparation helpers**

Use the existing classes and controls. The helper must not disable the input, because the existing named control is already part of the form payload.

```js
function setupBookingOtherWorkTypeField() {
  const purposeSelect = document.getElementById('form-purpose');
  const otherWrap = document.getElementById('form-purpose-other-wrap');
  const otherInput = document.getElementById('form-purpose-other');
  if (!purposeSelect || !otherWrap || !otherInput) return;

  const sync = (shouldFocus) => {
    const isOther = String(purposeSelect.value || '').trim() === 'อื่นๆ';
    otherWrap.classList.toggle('hidden', !isOther);
    otherInput.required = isOther;

    if (!isOther) {
      otherInput.value = '';
    } else if (shouldFocus && typeof otherInput.focus === 'function') {
      setTimeout(() => otherInput.focus(), 0);
    }
  };

  if (purposeSelect.dataset.bookingOtherTypeWired !== 'true') {
    purposeSelect.addEventListener('change', () => sync(true));
    purposeSelect.dataset.bookingOtherTypeWired = 'true';
  }

  sync(false);
}
```

- [ ] **Step 2: Call the helper after `prepareBookingForm` has unlocked and populated fields**

Insert a guarded call after the existing populate loop and before the existing autofocus logic:

```js
try {
  setupBookingOtherWorkTypeField();
} catch (e) {
  console.warn('setupBookingOtherWorkTypeField error:', e);
}
```

This ordering ensures a repeated modal open re-applies the correct hidden/required state after the existing unlock logic, while the dataset marker prevents another listener.

- [ ] **Step 3: Run the source syntax check before continuing**

Run:

```powershell
node --check .\src\app.js
```

Expected: exit code `0` and no syntax error output.

