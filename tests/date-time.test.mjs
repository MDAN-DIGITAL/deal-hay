import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/lib/date-time.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { parseLocalDateTime, formatLocalDateTime, toLocalDateTimeValue } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  )

function inTimezone(timezone, callback) {
  const original = process.env.TZ
  process.env.TZ = timezone
  try {
    callback()
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
}

test("Bangkok local time round-trips API timestamps without shifting the selected day", () => {
  inTimezone("Asia/Bangkok", () => {
    const date = parseLocalDateTime("2026-11-02T00:15")
    assert.equal(date.toISOString(), "2026-11-01T17:15:00.000Z")
    assert.equal(formatLocalDateTime(date), "2026-11-02T00:15")
    assert.equal(formatLocalDateTime(date, false), "2026-11-02")
    assert.equal(toLocalDateTimeValue(date.toISOString()), "2026-11-02T00:15")
    assert.equal(
      parseLocalDateTime("2026-11-02T16:30").toISOString(),
      "2026-11-02T09:30:00.000Z"
    )
  })
})

test("UTC parsing supports date-only values and preserves years below 100", () => {
  inTimezone("UTC", () => {
    assert.equal(
      parseLocalDateTime("2026-11-02T16:30").toISOString(),
      "2026-11-02T16:30:00.000Z"
    )
    const leapDay = parseLocalDateTime("2028-02-29", false)
    assert.equal(leapDay.toISOString(), "2028-02-29T00:00:00.000Z")
    assert.equal(formatLocalDateTime(leapDay, false), "2028-02-29")
    const ancientDate = parseLocalDateTime("0012-02-29T03:04")
    assert.equal(ancientDate.getFullYear(), 12)
    assert.equal(formatLocalDateTime(ancientDate), "0012-02-29T03:04")
  })
})

test("New York uses the selected date's winter or summer offset", () => {
  inTimezone("America/New_York", () => {
    for (const [local, iso] of [
      ["2026-01-15T16:30", "2026-01-15T21:30:00.000Z"],
      ["2026-07-15T16:30", "2026-07-15T20:30:00.000Z"],
    ]) {
      const date = parseLocalDateTime(local)
      assert.equal(date.toISOString(), iso)
      assert.equal(formatLocalDateTime(date), local)
      assert.equal(toLocalDateTimeValue(iso), local)
    }
  })
})

test("a nonexistent DST time is rejected instead of silently moving forward", () => {
  inTimezone("America/New_York", () => {
    assert.equal(parseLocalDateTime("2026-03-08T02:30"), undefined)
    assert.equal(
      parseLocalDateTime("2026-03-08T01:30").toISOString(),
      "2026-03-08T06:30:00.000Z"
    )
    assert.equal(
      parseLocalDateTime("2026-03-08T03:30").toISOString(),
      "2026-03-08T07:30:00.000Z"
    )
    // An overlapping fall-back hour follows Date's earlier occurrence.
    assert.equal(
      parseLocalDateTime("2026-11-01T01:30").toISOString(),
      "2026-11-01T05:30:00.000Z"
    )
  })
})

test("blank, malformed and impossible dates cannot roll into another date", () => {
  inTimezone("UTC", () => {
    for (const value of [
      "",
      " ",
      "2026-11-02",
      "2026-11-02 16:30",
      "2026-1-02T16:30",
      "2026-11-02T1:30",
      "2026-11-02T16:30:00",
      "2026-11-02T16:30Z",
      "2026-11-02T16:30+07:00",
      "2026-11-02T24:00",
      "2026-11-02T23:60",
      "2026-02-29T16:30",
      "2028-02-30T16:30",
      "2026-04-31T16:30",
      "2026-13-01T16:30",
      "2026-00-01T16:30",
      "2026-11-00T16:30",
      "0000-01-01T00:00",
    ])
      assert.equal(parseLocalDateTime(value), undefined, value)

    for (const value of ["", "2026-02-29", "2026-11-02T00:00"])
      assert.equal(parseLocalDateTime(value, false), undefined, value)
    assert.equal(formatLocalDateTime(new Date(NaN)), "")
    assert.equal(formatLocalDateTime(new Date(NaN), false), "")
    assert.equal(toLocalDateTimeValue(null), "")
    assert.equal(toLocalDateTimeValue(""), "")
    assert.equal(toLocalDateTimeValue("invalid"), "")
  })
})
