import { STAFF_DATA_ACCESS } from '@loadwise/shared';
import type { DataCategory, SquadRole } from '@loadwise/shared';

/**
 * #11: the role-to-data rule, as pure functions with no database or framework, so the whole
 * matrix can be unit tested exhaustively and read in one place. The matrix itself lives in
 * @loadwise/shared so the app can show athletes exactly what each role will see.
 *
 * Squad membership and consent are not decided here: StaffAccessService checks those against the
 * database on every request.
 */
export function allowedCategories(role: SquadRole): ReadonlySet<DataCategory> {
  // A new Set each call, so no caller can change the shared rule by mutating the result.
  return new Set(STAFF_DATA_ACCESS[role]);
}

export function canView(role: SquadRole, category: DataCategory): boolean {
  return STAFF_DATA_ACCESS[role].includes(category);
}
