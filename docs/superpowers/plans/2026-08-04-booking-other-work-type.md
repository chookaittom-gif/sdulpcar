# Booking Other Work Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing booking-form `อื่นๆ โปรดระบุ` field required when selected, normalize its value into the existing `workType` contract, and preserve the existing Telegram notification path without changing schema or API actions.

**Architecture:** Keep `src/app.js` as the frontend source of truth. A booking-specific, idempotently wired UI helper controls the existing field, and `prepareBookingPayload` maps the trimmed custom text into `workType`. `gas-deploy/code.gs` repeats only the boundary validation/normalization in `createBookingAndBroadcast`, so Sheet storage and the existing Telegram message builder receive the canonical text. `npm run build` regenerates the frontend mirrors.

**Tech Stack:** Google Apps Script, browser JavaScript, HTML5 form validation, Google Sheets, Telegram notification helper, Node.js build script, PowerShell verification.

## Global Constraints

- Minimal Change only; do not rewrite, refactor, rename, or reformat unrelated code.
- Preserve `createBookingAndBroadcast(payload)` signature, request/response shape, API action name, Sheet schema, status values, UI flow, and backward compatibility.
- Use the existing booking controls `#form-purpose`, `#form-purpose-other-wrap`, and `#form-purpose-other`; do not modify the fuel form.
- Keep the existing `workTypeOther` key in the frontend `FormData` payload; do not add a new request key or Sheet column.
- Do not change duplicate guards, `LockService`, availability checks, write order, retry/timeout behavior, or Telegram message format.
- Add no dependencies and make no CSS changes.
- Edit `src/app.js` and `gas-deploy/code.gs` only at the approved anchors; regenerate `gas-deploy/app.js` and `gas-deploy/JavaScript.html` from the source.
- Do not run `npm run push` or deploy; verification must be local unless separately authorized.

## File Map

- Modify `src/app.js` near `prepareBookingPayload` and `prepareBookingForm`: booking-only progressive disclosure, duplicate-listener guard, and frontend normalization.
- Modify `gas-deploy/code.gs` inside `createBookingAndBroadcast`: direct-caller validation and canonical `workType` calculation.
- Regenerate `gas-deploy/app.js` and `gas-deploy/JavaScript.html` with `npm run build`; do not hand-edit their logic.
- Do not modify `gas-deploy/index.html`: the booking markup already exists at `#form-purpose-other`.
- Do not modify `src/style.css`, `gas-deploy/style.css`, or `gas-deploy/Style.html`.
- Do not add automated test dependencies; use the repository's existing Node/PowerShell checks and safe browser/manual checks.

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

### Task 3: Add backend boundary validation without changing the contract

**Files:**
- Modify: `gas-deploy/code.gs` inside `createBookingAndBroadcast(payload)` (currently around line 986 and the existing `workType` initialization around line 1011)
- Test: Apps Script syntax/static checks and safe direct-call validation where a test environment is available

**Interfaces:**
- Consumes: existing `payload.workType`, existing `payload.jobType` fallback, and existing `payload.workTypeOther`.
- Produces: existing `{ ok: false, error }` for an unresolved `อื่นๆ`, or the same successful response shape with canonical `workType` written to the existing Sheet column and passed to Telegram.

- [ ] **Step 1: Compute the raw and custom values before the duplicate cache is populated**

Insert this immediately after the function declaration and before `cache.put` so an invalid request does not consume the duplicate-processing cache window:

```js
  const rawWorkType = String(payload.workType || payload.jobType || '').trim();
  const customWorkType = String(payload.workTypeOther || '').trim();

  if (rawWorkType === 'อื่นๆ' && !customWorkType) {
    return { ok: false, error: 'กรุณาระบุประเภทงานอื่นๆ' };
  }
```

Do not add a general blank `workType` rejection; that would change existing backend behavior for callers outside this feature.

- [ ] **Step 2: Replace only the existing `workType` initialization**

Replace the existing declaration inside the locked `try` block:

```js
let workType = String(payload.workType || payload.jobType || '').trim();
```

with:

```js
let workType = rawWorkType === 'อื่นๆ' ? customWorkType : rawWorkType;
```

Leave `workName`, availability checks, lock handling, row writes, duplicate guard, file upload, Telegram call, return value, and `finally` unchanged.

- [ ] **Step 3: Verify the notification receives the normalized value**

Confirm the existing object remains structurally equivalent and still uses the local `workType` variable:

```js
const notifyPayload = {
  ...payload,
  bookingId: bookingId,
  workType: workType,
  workName: workName,
  status: 'pending'
};
```

Do not change `sendTelegramNotify` or `buildBookingStatusMessage`.

- [ ] **Step 4: Run a JavaScript syntax check on the Apps Script source**

Run:

```powershell
Get-Content -LiteralPath 'gas-deploy\code.gs' -Raw | node --check
```

Expected: exit code `0`. This is a parser check only; it does not execute Apps Script services.

### Task 4: Regenerate the frontend mirrors from source

**Files:**
- Modify via build: `gas-deploy/app.js`
- Modify via build: `gas-deploy/JavaScript.html`
- Do not modify: `gas-deploy/index.html`, `src/style.css`, `gas-deploy/style.css`, `gas-deploy/Style.html`

**Interfaces:**
- Consumes: `src/app.js`.
- Produces: a direct-copy `gas-deploy/app.js` and a `<script>`-wrapped `gas-deploy/JavaScript.html` containing exactly the same frontend logic.

- [ ] **Step 1: Run the repository build**

Run:

```powershell
npm run build
```

Expected: `build.js` reports successful creation of `JavaScript.html`, `gviz-service.html`, `Style.html`, and direct copies without error.

- [ ] **Step 2: Verify the direct mirror and wrapper content**

Run:

```powershell
node -e "const fs=require('fs'); const s=fs.readFileSync('src/app.js','utf8'); const d=fs.readFileSync('gas-deploy/app.js','utf8'); if (s!==d) throw new Error('gas-deploy/app.js is not synchronized'); const w=fs.readFileSync('gas-deploy/JavaScript.html','utf8'); const expected='<script>\n'+s+'\n</script>'; if (w!==expected) throw new Error('gas-deploy/JavaScript.html wrapper is not synchronized'); console.log('Frontend mirrors synchronized');"
```

Expected: `Frontend mirrors synchronized`.

- [ ] **Step 3: Confirm no unrelated CSS/HTML logic was changed**

Run:

```powershell
rg -n -S "form-purpose-other|setupBookingOtherWorkTypeField|workTypeOther" src\app.js gas-deploy\app.js gas-deploy\JavaScript.html gas-deploy\index.html
```

Expected: booking references appear only in the approved frontend locations and existing markup; no fuel IDs are changed.

### Task 5: Run static and regression verification

**Files:**
- Test: `src/app.js`, `gas-deploy/app.js`, `gas-deploy/JavaScript.html`, `gas-deploy/code.gs`, `gas-deploy/index.html`

**Interfaces:**
- Consumes: the completed source and generated mirrors.
- Produces: recorded local verification results; no deployment.

- [ ] **Step 1: Run all parser checks**

Run:

```powershell
node --check .\src\app.js
node --check .\gas-deploy\app.js
Get-Content -LiteralPath 'gas-deploy\code.gs' -Raw | node --check
node -e "const fs=require('fs'); const h=fs.readFileSync('gas-deploy/JavaScript.html','utf8'); const prefix='<script>\n'; const suffix='\n</script>'; if(!h.startsWith(prefix)||!h.endsWith(suffix)) throw new Error('JavaScript.html wrapper not found'); new Function(h.slice(prefix.length, -suffix.length)); console.log('JavaScript.html script parses');"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run targeted declaration and mapping checks**

Run:

```powershell
rg -n -S "function setupBookingOtherWorkTypeField|createBookingAndBroadcast|googleScriptRun\('createBookingAndBroadcast'\)|form-purpose-other|workTypeOther|ประเภทงาน" src\app.js gas-deploy\app.js gas-deploy\JavaScript.html gas-deploy\code.gs gas-deploy\index.html
```

Expected: one source declaration of the new helper, one generated copy in each mirror, one existing create-booking action call, the existing backend entry point, and the existing Telegram rendering line; no renamed action.

- [ ] **Step 3: Run safe browser/manual booking checks**

Using a non-production/test environment or a mocked request boundary, verify:

1. Normal work type: other field remains hidden and submit behavior is unchanged.
2. `อื่นๆ โปรดระบุ`: field appears, receives focus, and is required.
3. Blank or whitespace-only custom text: browser validation blocks the request and the existing loading state is released.
4. Valid custom text: payload contains the trimmed value as `workType`, the existing `workTypeOther` key remains available, and the backend writes the custom text to the existing `workType` column.
5. Telegram: the existing `🎯 ประเภทงาน` line contains the custom text, including after a status update.
6. Reopening the modal: no duplicate listener or duplicate request is created; the field state resets according to the selected option.
7. Scope isolation: inspect the patch and confirm no fuel, insurance, maintenance, or other out-of-scope form file/anchor was changed. Do not run functional tests for those forms as part of this feature.
8. Booking-form mobile viewport behavior remains usable without horizontal overflow.

- [ ] **Step 4: Record limitations and rollback**

Do not run `npm run push`. The repository has no `.git` metadata, so no commit can be created without changing repository governance. Rollback is limited to the feature patch: revert the added helper/call, payload normalization, and backend normalization in `src/app.js` and `gas-deploy/code.gs`, then run `npm run build` to regenerate the two mirrors. Do not restore the older broad backup directory because it predates unrelated completed work.

## Self-review

- **Spec coverage:** UI visibility/required state is Task 1; payload and validation are Task 2; backend safety and Telegram preservation are Task 3; production/legacy synchronization is Task 4; acceptance and regression checks are Task 5.
- **Placeholder scan:** The plan contains no unresolved placeholder or unspecified implementation step.
- **Type/contract consistency:** The plan uses the existing `workType`, `workTypeOther`, `createBookingAndBroadcast(payload)`, `{ ok, error }`, and `googleScriptRun('createBookingAndBroadcast', payload)` names consistently.
- **Scope check:** Frontend booking, backend booking, generated frontend mirrors, and verification form one deployable feature; fuel, CSS, schema, API actions, and deployment are explicitly excluded.
