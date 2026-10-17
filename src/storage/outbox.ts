
import { getDatabase } from "./database";

export type EmergencyReport = {
  id: string;
  category: string;
  description: string;
  location_text?: string;
};

/**
 * Save an emergency report locally and add it to the
 * outbox in the same transaction.
 */
export async function saveEmergencyReport(
  report: EmergencyReport
) {
  const db = await getDatabase();
  const now = Date.now();

  const payload = JSON.stringify({
    schema_version: 1,
    message_id: report.id,
    category: report.category,
    description: report.description,
    location_text: report.location_text ?? null,
    created_at: now,
  });

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO emergency_reports
       (id, category, description, location_text, created_at, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      report.id,
      report.category,
      report.description,
      report.location_text ?? null,
      now
    );

    await db.runAsync(
      `INSERT INTO outbox
       (id, report_id, payload, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      report.id,
      report.id,
      payload,
      now
    );
  });

  return {
    id: report.id,
    status: "pending" as const,
  };
}

/** Get reports ready for another delivery attempt. */
export async function getPendingReports() {
  const db = await getDatabase();

  return db.getAllAsync<{
    id: string;
    report_id: string;
    payload: string;
    attempts: number;
  }>(
    `SELECT id, report_id, payload, attempts
     FROM outbox
     WHERE status IN ('pending', 'retry')
       AND next_attempt_at <= ?
     ORDER BY created_at ASC`,
    Date.now()
  );
}

/** Schedule a retry after a failed transfer. */
export async function markRetry(
  id: string,
  errorMessage: string
) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ attempts: number }>(
      "SELECT attempts FROM outbox WHERE id = ?",
      id
    );

    if (!row) return;

    const attempts = row.attempts + 1;
    const delay = Math.min(
      60 * 60 * 1000,
      2000 * 2 ** Math.min(attempts - 1, 10)
    );

    await db.runAsync(
      `UPDATE outbox
       SET status = 'retry',
           attempts = ?,
           next_attempt_at = ?,
           last_error = ?
       WHERE id = ?`,
      attempts,
      Date.now() + delay,
      errorMessage.slice(0, 300),
      id
    );
  });
}

/** Call only after verifying a server acknowledgement. */
export async function markServerDelivered(id: string) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE outbox
       SET status = 'delivered', last_error = NULL
       WHERE id = ?`,
      id
    );

    await db.runAsync(
      `UPDATE emergency_reports
       SET status = 'server_received'
       WHERE id = ?`,
      id
    );
  });
}
