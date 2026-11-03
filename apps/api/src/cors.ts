/**
 * Parses CORS_ORIGINS, a comma-separated list of exact origins allowed to call the API from a
 * browser (e.g. the Expo web app on http://localhost:8081). Unset or empty means no cross-origin
 * browser access at all, so a deployment only opens up to the origins it names. Native apps are
 * not browsers and are unaffected.
 */
export function corsOrigins(value: string | undefined): string[] | false {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : false;
}
