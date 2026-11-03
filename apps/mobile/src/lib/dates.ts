/** "Tuesday 3 November", as in the Today header. */
export function todayCaption(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
