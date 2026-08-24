# Booking Other Work Type Design

**Date:** 2026-08-04
**Status:** Design approved by user; implementation not started

## Goal

When a user selects `อื่นๆ โปรดระบุ` in the vehicle-booking form, show the existing text input, require a non-blank value, persist that value through the existing `workType` field, and show it in the existing Telegram `ประเภทงาน` line. Normal work-type choices, the Sheet schema, API action names, response shape, UI flow, and backward compatibility must remain unchanged.

## Repository Facts

- `gas-deploy/index.html:803-821` already contains the booking select `#form-purpose`, the hidden wrapper `#form-purpose-other-wrap`, and the input `#form-purpose-other` with `name="workTypeOther"`.
- `src/app.js:4589-4665` builds the booking payload and currently maps the selected value to `payload.workType`, but does not bind the booking other-type controls or validate their value.
- `src/app.js:2034` is the canonical booking submit path and already owns form submission validation and the existing `google.script.run`/adapter call.
- `gas-deploy/code.gs:986-1138` contains `createBookingAndBroadcast(payload)`, which validates and writes `workType`, then passes the written value to `sendTelegramNotify`.
- `gas-deploy/code.gs:2434-2537` reads the existing Sheet `workType` value and renders it in the existing Telegram line `🎯 ประเภทงาน`.
- `gas-deploy/code.gs:27` maps the existing `workType` Sheet column; no new column is required.
- `gas-deploy/index.html:316-329` contains a separate fuel form with similarly named controls. The implementation must select the booking controls by ID and must not change the fuel form.
- `build.js` synchronizes the frontend production source into `gas-deploy/app.js` and the GAS wrapper `gas-deploy/JavaScript.html`.

## Scope

### In scope

- Booking-form progressive disclosure and required validation for `#form-purpose-other`.
- Frontend normalization into the existing `payload.workType` contract.
- Backend validation/normalization in `createBookingAndBroadcast` for direct callers.
- Verification that the existing Telegram path receives and displays the normalized value.
- Synchronization of the frontend mirror files using the repository build process.

### Out of scope

- Behavior changes in any other form.
- New Sheet columns, migrations, or status values.
- New API actions, Telegram endpoints, or message formats.
- CSS redesign or unrelated UI polish.
- Changes to repair-job classification heuristics.

## Design

### Frontend interaction

Add one guarded booking-specific event binding in `src/app.js`:

1. Locate `#form-purpose`, `#form-purpose-other-wrap`, and `#form-purpose-other` by ID.
2. Bind the select change handler only once, even if booking-form setup runs more than once.
3. On `value === 'อื่นๆ'`, remove the hidden state, keep the existing named input in the form payload, set `required`, and focus it after the user changes the select.
4. On any other value, hide the wrapper, clear its value, and remove `required`. Do not disable the input, because the existing `FormData` shape already includes the named `workTypeOther` control.
5. Run the same synchronization once during booking-form setup so an initial value is rendered correctly.

The implementation must use the existing form classes and browser validation behavior. No new component, modal, CSS rule, or dependency is needed.

### Payload and backend contract

- Keep the public `createBookingAndBroadcast(payload)` signature unchanged.
- Keep the existing `workType` and `workTypeOther` field names; do not add a new API action or Sheet column. Do not remove the existing `workTypeOther` key from the frontend payload when the control is empty.
- For the booking form, a selected normal option continues to pass through unchanged.
- For `อื่นๆ`, trim `workTypeOther`; reject a blank value through the existing validation/error path; otherwise use the trimmed custom text as the canonical `workType` value before the Sheet row is written.
- Perform the same normalization and blank check in `createBookingAndBroadcast` so callers that bypass the UI cannot create a booking with an unresolved `อื่นๆ` value.
- Preserve the existing duplicate guard, lock, availability checks, write order, return shape, and notification timing.

### Telegram behavior

Do not change `sendTelegramNotify` or the message schema. Because `createBookingAndBroadcast` already passes its normalized `workType` to the notification payload and the message builder reads the existing `workType` value, the existing line will become:

`🎯 ประเภทงาน: <custom text>`

Subsequent status messages will continue to read the same stored Sheet value.

## Safety and compatibility

- Existing normal work types remain unchanged.
- The Sheet schema and column mapping remain unchanged.
- Existing GAS entry points and API action names remain unchanged.
- The booking event handler is guarded against duplicate listeners.
- Existing submit duplicate-request protection remains in place; no second request path is introduced.
- The backend remains the final validation boundary for direct API callers.
- The two `workTypeOther` inputs are isolated by booking-specific IDs; the fuel form is not modified.
- Existing repair detection uses text matching on `workType`/project data. That heuristic is deliberately not changed; a custom description intended to represent repair work must continue to use the existing repair keywords for the old heuristic to recognize it.

## Acceptance criteria

1. Opening the booking form with a normal work type keeps the other field hidden, disabled, and not required.
2. Selecting `อื่นๆ โปรดระบุ` shows the field and makes it required.
3. Submitting `อื่นๆ` with blank or whitespace-only text is blocked in the UI.
4. Submitting `อื่นๆ` with text writes that text to the existing `workType` Sheet column.
5. The create-booking Telegram notification contains the custom text on the existing `ประเภทงาน` line.
6. A direct backend call with `workType: 'อื่นๆ'` and no usable `workTypeOther` is rejected.
7. Normal work types, response shape, duplicate protection, availability checks, and status notifications remain unchanged.
8. No out-of-scope form markup or logic is changed.
9. `src/app.js`, `gas-deploy/app.js`, and the script body in `gas-deploy/JavaScript.html` remain synchronized after the build step.

## Verification plan

- Run repository syntax/build checks available in `package.json`.
- Compare the frontend source and generated mirrors after build.
- Search for duplicate booking helper declarations and duplicate booking event bindings.
- Verify `workType` action mapping and `createBookingAndBroadcast` references.
- Run targeted static checks for booking create, validation, Telegram mapping, out-of-scope file isolation, and undefined IDs.
- Perform browser/manual checks only for normal selection, custom selection, blank validation, modal reset, duplicate click, responsive/mobile layout, and Telegram payload/message output where the deployment credentials/environment permit.

## Implementation decision

Use the existing booking `workType` field and existing Telegram rendering path. Do not add schema, API, or CSS changes. Implementation remains limited to the approved frontend/backend anchors and generated frontend mirrors.
