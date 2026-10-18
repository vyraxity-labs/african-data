/**
 * Format a Date for display in historical checks (e.g., "20 Sep" or "20 Sep 2026").
 * Safe for use in both Client and Server Components.
 */
export function formatHistoryDate(date: Date | string | number): { short: string; full: string; time: string } {
  const d = new Date(date);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return {
    short: `${day} ${month}`,
    full: `${day} ${month} ${year}`,
    time: `${hours}:${minutes}:${seconds}`,
  };
}
