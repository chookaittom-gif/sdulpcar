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
node --check .\gas-deploy\code.gs
```

Expected: exit code `0`. This is a parser check only; it does not execute Apps Script services.

