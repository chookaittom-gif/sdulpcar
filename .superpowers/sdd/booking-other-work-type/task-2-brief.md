### Task 2: Normalize and validate the frontend booking payload

**Files:**
- Modify: `src/app.js` inside `prepareBookingPayload(form)` (currently around line 4589)
- Test: source-level payload assertions and the existing booking submit path

**Interfaces:**
- Consumes: the existing `workType` select and `workTypeOther` named input.
- Produces: the existing payload with `payload.workType` equal to the selected normal option or the trimmed custom text; `payload.workTypeOther` remains present as the existing form key.

- [ ] **Step 1: Add booking-only normalization immediately after the existing work-type mapping**

Keep normal values unchanged. For `อื่นๆ`, reject a blank custom value and throw through `submitBooking`'s existing `catch`/toast path if a caller reaches this function without native form validation.

```js
  const otherWorkTypeInput = document.getElementById('form-purpose-other');
  if (purposeSelect && String(purposeSelect.value || '').trim() === 'อื่นๆ') {
    const customWorkType = otherWorkTypeInput
      ? otherWorkTypeInput.value.trim()
      : '';

    if (!customWorkType) {
      if (otherWorkTypeInput) {
        otherWorkTypeInput.required = true;
        if (typeof otherWorkTypeInput.reportValidity === 'function') {
          otherWorkTypeInput.reportValidity();
        }
        if (typeof otherWorkTypeInput.focus === 'function') {
          otherWorkTypeInput.focus();
        }
      }
      throw new Error('กรุณาระบุประเภทงานอื่นๆ');
    }

    payload.workType = customWorkType;
  }
```

- [ ] **Step 2: Confirm the existing submit flow still owns loading/error/finally behavior**

Do not add a second submit handler or request. Verify that `submitBooking` continues to call `form.checkValidity()` before `prepareBookingPayload(form)`, then calls the existing `googleScriptRun('createBookingAndBroadcast', payload)`, and still resets the submit button in `finally`.

- [ ] **Step 3: Run the frontend syntax check**

Run:

```powershell
node --check .\src\app.js
```

Expected: exit code `0`.

