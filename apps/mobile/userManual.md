# Taku Mobile User Manual (Operational + Navigation Flow)

## Purpose

This document explains:

- Keep-awake behavior (`expo-keep-awake`)
- Screen dim behavior (`expo-brightness`)
- Full `DailyCloseFeature` NavigationStack behavior and step flow

It is written to help another AI generate a visual/manual guide.

## Runtime Configuration

Configured in code at `constants/config.ts` (no runtime `.env` dependency):

- `keepAwake.enabled = true`
- `keepAwake.from = "9:00"`
- `keepAwake.to = "18:00"`
- `dimScreen.enabled = true`
- `dimScreen.timeout = "1"`
- `dimScreen.to = 0.2`

## Keep-Awake Behavior

Source: `App.tsx`

- Keep-awake is enabled only if `APP_CONFIG.keepAwake.enabled` is `true`.
- Active window is defined by:
  - `APP_CONFIG.keepAwake.from` (HH:mm)
  - `APP_CONFIG.keepAwake.to` (HH:mm)
- For `9:00` to `18:00`, app stays awake:
  - From `09:00` inclusive
  - Until `18:00` exclusive
- Re-checks happen:
  - Every 60 seconds
  - When app returns to foreground (`AppState: active`)
- Invalid time format logs warning and disables keep-awake logic.

## Dim Screen Behavior

Source: `App.tsx` + `useIntervalTasks`

- Dim mode is enabled only if `APP_CONFIG.dimScreen.enabled` is `true`.
- Timeout source:
  - `APP_CONFIG.dimScreen.timeout`
  - Supports `5` (minutes) or `5:00` (mm:ss)
- Target brightness:
  - `APP_CONFIG.dimScreen.to` (clamped between `0` and `1`)
  - Current config: `0.2`
- Inactivity logic:
  - Every app touch updates last activity timestamp.
  - When idle time reaches timeout, brightness is set to dim level.
- Restore logic:
  - On any touch, brightness is restored to the brightness level that existed right before dimming.
  - On app foreground (`active`), activity is also registered.
- Important timing note:
  - Checks run on the shared interval loop (default every 60 seconds), so dim can happen up to ~59 seconds after exact timeout threshold.

## NavigationStack Overview

Source: `app/DailyCloseFeature/NavigationStack.tsx`

Registered screens:

1. `LandingScreen`
2. `DailySalesScreen`
3. `DailySalesConfirmScreen`
4. `IncomeReportScreen`
5. `OutcomeReportScreen`
6. `IncomeOutputResumeScreen`
7. `AllReportsScreen`

Global stack behavior:

- Headers hidden for all screens.
- Gestures/back navigation disabled (`gestureEnabled: false`).
- Hardware back button is blocked.
- `beforeRemove` prevents `GO_BACK`, `POP`, `POP_TO_TOP`.
- Every screen is wrapped in a frame with `SyncStatusBar` on top.

Initial route behavior:

- If `temporalSale.stepPosition` exists, stack starts at `wizzardSteps[stepPosition]`.
- Otherwise starts at `LandingScreen`.

## Sync Status Bar Behavior

Source: `app/DailyCloseFeature/SyncStatusBar.tsx`

- Icon shown at top-right in every screen frame.
- Red upload cloud (`cloud-upload-outline`) when local closes need sync.
- Green done cloud (`cloud-done-outline`) when local data is synced.
- Sync decision uses store `shouldSync()`:
  - true when newest local close date is after `lastSyncedDate`.

## Wizard Data Model (Store)

Source: `app/DailyCloseFeature/useDailyCloseStore.ts`

- Persistent storage key: `daily-close-store` (AsyncStorage via Zustand persist).
- Main buckets:
  - `closesByDate`: saved final daily closes
  - `temporalSale`: in-progress wizard data
  - `lastSyncedDate`: last successful sync date
- Product prices are stored in cents (integers).
- Wizard step fields update `temporalSale.stepPosition` progressively.

## Screen-by-Screen Behavior

### 1) LandingScreen

Source: `app/DailyCloseFeature/LandingScreen.tsx`

Visual intent:

- Centered title + clock.
- Reminder text about close time (after 5:00pm).
- Main action button area.
- Secondary top-right button for history.

Functional behavior:

- Shows live time (`HH:mm`) updated every minute.
- Reads today date and checks if close already exists in `closesByDate`.
- If not closed:
  - Shows `Iniciar el cierre!` -> navigates to `DailySalesScreen`.
- If already closed:
  - Shows hint text and optional placeholder action (`Ver el resumen de hoy!`, not implemented).
- Always shows `Ver cierres anteriores` -> `AllReportsScreen`.

### 2) DailySalesScreen

Source: `app/DailyCloseFeature/DailySales.tsx`

Visual intent:

- Left column: product list with quantity inputs.
- Right column: custom numeric keypad.

Functional behavior:

- Displays all `availableProducts`.
- User selects an input; keypad writes digits to selected product quantity.
- `canSubmit` only when all products have a quantity entry.
- On submit:
  - Saves items to `temporalSale.items`
  - Sets wizard step
  - Navigates to `DailySalesConfirmScreen`

### 3) DailySalesConfirmScreen

Source: `app/DailyCloseFeature/DailySalesConfirm.tsx`

Visual intent:

- Product quantity summary + line totals + grand total.
- Footer with Cancel and Confirm.

Functional behavior:

- Reads current `temporalSale.items`.
- Cancel:
  - `resetTemporalSales()`
  - `navigation.goBack()`
- Confirm:
  - Navigates to `IncomeReportScreen`

### 4) IncomeReportScreen

Source: `app/DailyCloseFeature/IncomeReport.tsx`

Visual intent:

- Inputs for:
  - Cash in register
  - Bank transfers/deposits
- Running income total
- Numeric keypad on right

Functional behavior:

- Numeric fields are captured as text then converted to cents.
- Valid submit requires both fields non-empty.
- On submit:
  - Saves `cashReceived` + `bankTransfersReceived` into `temporalSale`
  - Navigates to `OutcomeReportScreen`

### 5) OutcomeReportScreen

Source: `app/DailyCloseFeature/OutcomeReport.tsx`

Visual intent:

- Inputs for:
  - Delivery payouts (cash)
  - Other cash expenses
- Notes multi-line area
- Running expense total
- Numeric keypad on right

Functional behavior:

- Numeric fields use keypad; notes use keyboard.
- Valid submit requires both expense fields non-empty.
- On submit:
  - Saves delivery/other/notes in `temporalSale`
  - Navigates to `IncomeOutputResumeScreen`

### 6) IncomeOutputResumeScreen

Source: `app/DailyCloseFeature/IncomeOutputResume.tsx`

Visual intent:

- High-level cards:
  - Ingresos
  - Egresos
  - Total
- Detailed table of product income lines
- Footer actions

Functional behavior:

- Computes and displays totals from `temporalSale`.
- `Confirmar y Guardar`:
  - Builds final close record
  - Sets:
    - `createdAt` (ISO now)
    - `date` normalized (`YYYY-MM-DD`)
    - `expectedTotal` from products
    - Default numeric fields to `0` when missing
  - Saves with `upsertClose(close)`
  - Navigates to `LandingScreen`
- `Cancelar`:
  - Confirms via alert
  - Resets temporal data
  - Navigates to `LandingScreen`

### 7) AllReportsScreen

Source: `app/DailyCloseFeature/AllReports.tsx`

Visual intent:

- Historical summary table (latest 7 closes):
  - Date
  - Ingresos
  - Egresos
  - Total
- Weekly income total
- Bottom `Ok` button

Functional behavior:

- Reads all closes, sorts descending by date, slices last 7.
- `Ok` returns to previous screen.

## End-to-End Flow Summary

Primary close workflow:

1. `LandingScreen` -> Start close
2. `DailySalesScreen` -> Enter product quantities
3. `DailySalesConfirmScreen` -> Confirm product revenue
4. `IncomeReportScreen` -> Enter cash + bank income
5. `OutcomeReportScreen` -> Enter expenses + notes
6. `IncomeOutputResumeScreen` -> Review and save
7. Back to `LandingScreen`

Secondary workflow:

1. `LandingScreen` -> `AllReportsScreen` -> `Ok` -> back

## Important UX Constraints for Visual Manual

- Back actions are intentionally blocked in stack flow.
- Wizard progression is forward-driven by submit buttons.
- Numeric money entry uses custom keypad on most financial screens.
- Monetary values are formatted MXN and internally stored as cents.
- `SyncStatusBar` is globally visible at the top of every wizard screen.
- Dimming is inactivity-based and touch immediately restores full brightness.
- Dimming is inactivity-based and touch restores pre-dim device/app brightness.
- Keep-awake and dim behavior can be changed from `constants/config.ts`.
