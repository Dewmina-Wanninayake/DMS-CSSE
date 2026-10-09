import type { Db } from '../../../core/db/connection';

/** Which districts a volunteer is certified for (critique CV-003 #7). */
export class CertificationRepository {
  constructor(private readonly db: Db) {}

  isCertified(userId: number, districtId: number): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM volunteer_certifications WHERE user_id = ? AND district_id = ?')
        .get(userId, districtId) !== undefined
    );
  }
}
