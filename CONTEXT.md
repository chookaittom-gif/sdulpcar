# Project Context

ระบบจองยานพาหนะ — คำศัพท์ร่วมสำหรับฟอร์มจองและการโหลดข้อมูลเริ่มต้นให้พร้อมใช้งาน

## Language

**Booking form**:
The vehicle-request experience where a requester specifies the work type, project, destination, schedule, passengers, and vehicle requirements.
_Avoid_: request form, reservation UI

**Work type**:
The business concept used to describe why a vehicle is being requested. It is separate from the project name and destination.
_Avoid_: job type (as synonym in product language), purpose

**Other work type**:
A work type that is not represented by the predefined choices and therefore requires the requester to describe it in their own words.

**Other forms**:
Fuel, insurance, maintenance, and other operational forms outside the booking-form scope.

**Initial Data**:
The first set of bookings, vehicles, drivers, and projects required before the app is considered ready for normal use.
_Avoid_: bootstrap payload, main data (as product language)

**System Ready**:
The state after Initial Data is available and the user can use calendar and booking flows without waiting on the loading screen.
_Avoid_: fully loaded (unless every deferred widget is also ready)

**Cold Load**:
An Initial Data fetch that must rebuild from the spreadsheet because no usable cached Initial Data exists.
_Avoid_: first paint, cold start (unless referring specifically to this miss path)

**Warm Load**:
An Initial Data fetch that reuses still-valid cached Initial Data.
_Avoid_: fast path (ambiguous)

**Initial Data Window**:
The recent time range of closed/cancelled/rejected bookings included in Initial Data for System Ready. Open Bookings and Open Blocks are included even outside this range. Exact day width is chosen after Cold Load measurement, not assumed up front.
_Avoid_: full history (unless explicitly required at System Ready)

**Deferred History**:
Older closed/cancelled/rejected bookings outside the Initial Data Window. They are loaded later when the user navigates the calendar outside the window or when search/detail cannot find a booking in Initial Data.
_Avoid_: archived data (unless a real archive process exists)

**Temporary Timing**:
A short-lived diagnostic field returned with Initial Data that reports how long each Cold Load stage took, used only to choose what to speed up next.
_Avoid_: permanent telemetry (unless later approved)

**Open Booking**:
A booking that is still in an actionable or visible active state for operations — typically pending, approved, or special-approved equivalents — and must stay in Initial Data even outside the Initial Data Window.
_Avoid_: unfinished (vague), active booking (ambiguous with vehicle availability)

**Open Block**:
A driver or vehicle unavailability block that is not closed and must remain visible on the calendar even outside the Initial Data Window.
_Avoid_: leave/repair record (too narrow), availability row (implementation-leaning)

## Scope Boundary

- Booking-form / Work type changes remain a separate approved scope.
- Speed-up work targets Initial Data / System Ready without changing booking business rules unless explicitly approved.
- Completeness at System Ready is not assumed to mean full booking history; that decision follows measured Cold Load cost and an agreed Initial Data Window.
- Speed success for the first iteration: Cold Load at least 30% faster than measured baseline, with provisional ceilings Cold ≤ 8s and Warm ≤ 3s to System Ready, without breaking calendar/booking correctness.
- If measurement shows row/payload cost dominates, prefer Partial Initial Data on the existing Initial Data fetch over adding new endpoints in the first iteration.
- Outside the Initial Data Window, Initial Data must still include Open Bookings and Open Blocks; closed/cancelled/rejected history becomes Deferred History.
- Initial Data Window width (days) stays undecided until baseline measurement; no day count is locked yet.
- Deferred History loads on calendar navigation outside the window or on search/detail miss against Initial Data — not by silently refetching full history immediately after System Ready.
- First speed iteration keeps vehicles, drivers, and projects complete in Initial Data; booking-row windowing comes before field-stripping.
- Cache freshness stays write-invalidation + existing TTL first; do not lengthen TTL in the first iteration. Warm-path warming of Initial Data is considered only after Warm Load measurement.
- First iteration out of scope: new endpoints, longer TTL, deferring vehicles/drivers, field-stripping, silent full-history prefetch after ready, loading-step animation-only work, and booking approval business-rule changes.
- First speed iteration prioritizes reducing Cold Load server work inside Initial Data rebuild (sheet read / build), not cutting history after a full read. Partial Initial Data remains a later option if the target is still missed.
- Choose the first `getMainData_` optimization target from Apps Script Execution log `[Timing]` on a force-refresh Cold Load, not from code structure guesses alone.
- When Cloud logs are unavailable for Web App executions, Temporary Timing in the Initial Data response is preferred over guessing which sheet read is slow.
- Measured Temporary Timing (prod @644, Cold forceRefresh): `buildBookingsMs` dominates (~6.5s / ~53% of server `totalMs` ~12.3s); next largest are `settingsMs` (~1.3s), `actualEndMs` (~1.0s), `dataSheetMs` (~1.0s), `cacheWriteMs` (~0.9s).
- First Cold optimization target: `buildBookingsMs` via shared date parsers (`parseDateToISO_` / `normalizeDateInputToDate_`) — remove per-call `Session.getScriptTimeZone` + `Utilities.formatDate` on Sheets serial hot path.
- Verified prod @645: `buildBookingsMs` 6492→120–427ms; Cold server `totalMs` 12276→4388–4827ms (~64% faster); client Cold TTFB ~19.5s→~7.3s. Booking count 263 unchanged; sample dates look valid.
- Next check: user Chrome Cold Load → System Ready (Cursor browser blocked by login).
- Chrome/Cursor-tab verification on https://sdulpcar.vercel.app/ (@645): page System Ready (calendar สิงหาคม 2569 + events). Cold `gas(forceRefresh)` client **6574ms**, server `totalMs` **3648** / `buildBookingsMs` **72**. Warm client **2451ms**, cache hit server **103ms**. Meets provisional Cold ≤8s / Warm ≤3s.
- First speed iteration success criteria are met on measured Cold/Warm Load; further speed work is a new decision, not assumed.
- Decision: end first speed iteration by removing Temporary Timing from production Initial Data (not kept as permanent telemetry).
- Temporary Timing removal scope: strip both the response `timing` field and `getMainData_` stage timers / `[Timing]` logs (not flag-gated).
- Decision: deploy Temporary Timing removal to production Apps Script (full strip). Deployed Web App @648; Cold/Warm responses are `{ok,data}` only (`hasTiming:false`, bookings 264).
- Decision: Temporary Timing topic closed; no further Temporary Timing work unless a new measurement round is explicitly requested.
- Decision: pause first speed-up round; no further Cold Load optimization or Initial Data Window work until a new explicit request.
- Connection reset on Vercel `/api/gas` (`Failed to fetch`) is intermittent transport to Apps Script, not caused by `code.gs` speed changes. Local fix: retry `getWebAppInitialData` on network errors (keep POST path); not deployed to Vercel until explicit deploy.
- Network-retry recovery for connection resets covers Initial Data only; other reads and writes stay single-attempt until a separate decision.
- Network-retry fix for Initial Data is deployed to production Vercel (`sdulpcar.vercel.app`). Temporary Timing removal is deployed to Apps Script @648.
- Initial Data retry also covers proxy 5xx responses (Apps Script returning an HTML error page), not just network resets and 404.

## Example dialogue

Dev: After Cold Load, when are we System Ready?
Expert: When Initial Data is in place so calendar and booking work. Fuel widgets can wait.
Dev: And Warm Load?
Expert: Same Initial Data, just served from cache while it is still valid.
Dev: If Initial Data is Partial, did we lose old cancelled trips?
Expert: No — that is Deferred History. Load it when someone opens an old month or searches and misses.
Dev: Why not cut history first?
Expert: Cold Load is mostly server rebuild time. Fix that read/build work first; Partial comes later if needed.
Dev: We only changed code.gs — did the website get faster?
Expert: The page files did not. Cold Load of Initial Data got faster, so System Ready arrives sooner.
