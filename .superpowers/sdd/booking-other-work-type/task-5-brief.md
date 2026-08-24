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
node --check .\gas-deploy\code.gs
node -e "const fs=require('fs'); const h=fs.readFileSync('gas-deploy/JavaScript.html','utf8'); const m=h.match(/^<script>\r?\n([\s\S]*)\r?\n<\\/script>\s*$/); if(!m) throw new Error('JavaScript.html wrapper not found'); new Function(m[1]); console.log('JavaScript.html script parses');"
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
