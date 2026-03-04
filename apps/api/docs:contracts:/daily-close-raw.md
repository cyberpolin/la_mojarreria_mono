// Purpose
// Problem solved: We need to save every day closing report, so we can process them later.
// Who consumes it: Kiosks/tablets used in the store to take orders and close sales.
// breaks: In future, will brake the reports in dashboards and sales analytics until processed.

//Contract:
//Input: deviceId (string), date (string, YYYY-MM-DD), payload (JSON, full report)
//Output: { success: boolean, date: string, syncedAt: string (ISO) }
// SideEffects: Saves or updates a DailyCloseRaw record in the database with status "RECEIVED", will trigger final tables processing later.

// Invariants:
// - deviceId + date is unique
// - payload is stored as-is
// - status is set to "RECEIVED"
// - receivedAt is set to current timestamp
// - If record exists, payload and receivedAt are updated, status reset to "RECEIVED", errorMessage and processedAt cleared.
// - Minimal validation on date format (YYYY-MM-DD) can be added to avoid garbage data.
// - Received report can't be updated to "PROCESSED" or "FAILED" here, only "RECEIVED".

// Data States:
// - New Record: Created with provided data, status "RECEIVED", current timestamp.
// - after processing: status updated to "PROCESSED" or "FAILED", processedAt set, errorMessage if failed.

// Idempotency:
// - Re Sending a error report with same deviceId and date will update the existing record, not create a new one.
// - This allows retries from kiosks/tablets without duplicating data.

// Error Handling:
// - If date format is invalid, throw an error.
// - If database operation fails, propagate the error.
