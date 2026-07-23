/**
 * Version of the hawk-sdk library. Used in the User-Agent header on outbound
 * HTTP requests so a misbehaving SDK can be identified by daemon logs and
 * operators.
 *
 * Source of truth: the VERSION file at the repo root (used by release
 * tooling). Keep this constant in sync with VERSION — bump VERSION and update
 * this constant together (or let release-please do it).
 */
export const Version = "0.1.0";

/** userAgent returns the User-Agent string for outbound HTTP requests. */
export function userAgent(): string {
  return `hawk-sdk-typescript/${Version}`;
}
