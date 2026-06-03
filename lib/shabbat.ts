export function getShabbatThreshold(): string {
  const nowUtc = Date.now();
  const ISRAEL_OFFSET_MS = 3 * 60 * 60 * 1000;
  const israelMs = nowUtc + ISRAEL_OFFSET_MS;
  const israel = new Date(israelMs);

  const day = israel.getUTCDay();
  const hour = israel.getUTCHours();

  const isShabatBeforeEnd = day === 6 && hour < 17;

  let daysToShabbat: number;
  if (isShabatBeforeEnd) {
    daysToShabbat = 0;
  } else if (day === 6) {
    daysToShabbat = 7;
  } else {
    daysToShabbat = (6 - day + 7) % 7;
  }

  const target = new Date(israelMs);
  target.setUTCDate(israel.getUTCDate() + daysToShabbat);

  const yyyy = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(target.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
