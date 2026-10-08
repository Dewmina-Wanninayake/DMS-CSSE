/**
 * Today's calendar date (`YYYY-MM-DD`) in an IANA time zone.
 *
 * The server clock runs in UTC but the business day is the Sri Lankan one: at 01:00 on 9 October in
 * Colombo it is still 8 October in UTC, and an analyst must be able to pick "today" as the end of a
 * period. All business-date rules therefore compare against this value, never against `new Date()`.
 */
export function dayInZone(now: Date, timeZone: string): string {
  // The `en-CA` locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}
