export function getBogotaDateAfter(days: number, baseDate: Date = new Date()): string {
  const bogotaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate);
  const [year, month, day] = bogotaDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

export function getBogotaTodayISO(now: Date = new Date()): string {
  return getBogotaDateAfter(0, now);
}
