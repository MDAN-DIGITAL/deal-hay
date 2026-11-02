/** Parse a local calendar value without UTC conversion or Date's rollover. */
export function parseLocalDateTime(
  value: string,
  withTime = true
): Date | undefined {
  const match = (
    withTime
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})$/
  ).exec(value)
  if (!match) return undefined

  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText ?? 0)
  const minute = Number(minuteText ?? 0)
  if (year < 1) return undefined

  // setFullYear preserves years below 100 instead of interpreting them as 19xx.
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hour, minute, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    return undefined

  return date
}

/** Serialize local components; ISO slicing would shift dates near midnight. */
export function formatLocalDateTime(date: Date, withTime = true): string {
  if (!Number.isFinite(date.getTime())) return ""
  const pad = (value: number, length = 2) => String(value).padStart(length, "0")
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return withTime
    ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    : day
}

/** Turn an API timestamp into a value for the local date and time picker. */
export function toLocalDateTimeValue(iso: string | null): string {
  return iso ? formatLocalDateTime(new Date(iso)) : ""
}
