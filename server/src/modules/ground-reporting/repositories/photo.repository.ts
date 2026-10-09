import type { PhotoMimeType } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface StoredPhoto {
  mimeType: PhotoMimeType;
  sizeBytes: number;
  data: Buffer;
}

/** One optional photo per report; saving again replaces it. */
export class PhotoRepository {
  constructor(private readonly db: Db) {}

  /**
   * Stores the photo and points `hazard_reports.photo_path` at the route that serves it, because
   * UC-DIST-02's minimum evidence rule (GPS + photo) reads that column.
   */
  save(reportId: number, mimeType: PhotoMimeType, data: Uint8Array): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO report_photos (report_id, mime_type, size_bytes, data) VALUES (?, ?, ?, ?)
           ON CONFLICT (report_id) DO UPDATE SET
             mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, data = excluded.data,
             created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .run(reportId, mimeType, data.length, data);
      this.db
        .prepare('UPDATE hazard_reports SET photo_path = ? WHERE id = ?')
        .run(`/api/v1/reports/${reportId}/photo`, reportId);
    })();
  }

  find(reportId: number): StoredPhoto | null {
    const row = this.db
      .prepare('SELECT mime_type, size_bytes, data FROM report_photos WHERE report_id = ?')
      .get(reportId) as { mime_type: PhotoMimeType; size_bytes: number; data: Buffer } | undefined;
    return row ? { mimeType: row.mime_type, sizeBytes: row.size_bytes, data: row.data } : null;
  }
}
