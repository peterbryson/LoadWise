/** "Tuesday 3 November", as in the Today header. */
export function todayCaption(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * The phone's calendar date as YYYY-MM-DD, for the API's date fields. Not toISOString(), which gives
 * the UTC date: in Belfast that is still yesterday at 00:30 during British Summer Time.
 */
export function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
