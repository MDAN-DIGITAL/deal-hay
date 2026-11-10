import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  return moduleUrl(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import: ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}
const configuration = transpile("../src/config/advertising.ts")
const { ADCASH_SCRIPT_URL, ADCASH_AUTOTAG_ZONE_ID } = await import(configuration)
const { startAdcashAutoTag, AdcashError } = await import(transpile("../src/lib/adcash-autotag.ts", {
  "@/config/advertising": configuration,
}))

class Script extends EventTarget {
  tagName = "SCRIPT"
  id = ""
  src = ""
  type = ""
  async = false
  constructor(document) {
    super()
    this.document = document
  }
  remove() {
    this.document.scripts = this.document.scripts.filter((script) => script !== this)
  }
}
function setup() {
  const document = {
    scripts: [],
    calls: [],
    timers: new Map(),
    defaultView: {
      setTimeout(callback, delay) {
        const id = Symbol("timer")
        document.timers.set(id, { callback, delay })
        return id
      },
      clearTimeout(id) { document.timers.delete(id) },
    },
    createElement(tagName) {
      assert.equal(tagName, "script")
      return new Script(this)
    },
    getElementById(id) { return this.scripts.find((script) => script.id === id) ?? null },
    head: { appendChild(script) { document.scripts.push(script); return script } },
    install(run) {
      const library = { runAutoTag(options) {
        assert.equal(this, library, "Adcash methods retain their receiver")
        document.calls.push(options)
        run?.(options)
      } }
      this.defaultView.aclib = library
    },
    finish(script = this.scripts[0]) {
      this.install()
      script.dispatchEvent(new Event("load"))
    },
  }
  return document
}

test("the supplied HTTPS library and zone start once after load, including concurrent callers", async () => {
  const document = setup()
  const first = startAdcashAutoTag(document)
  const second = startAdcashAutoTag(document)
  assert.equal(document.scripts.length, 1)
  assert.equal(document.scripts[0].id, "aclib")
  assert.equal(document.scripts[0].src, "https://acscdn.com/script/aclib.js")
  assert.equal(document.scripts[0].src, ADCASH_SCRIPT_URL)
  assert.equal(document.scripts[0].type, "text/javascript")
  assert.equal(document.scripts[0].async, true)
  assert.deepEqual(document.calls, [])
  document.finish()
  await Promise.all([first, second])
  await startAdcashAutoTag(document)
  assert.deepEqual(document.calls, [{ zoneId: "s8qbsqnjo" }])
  assert.equal(document.calls[0].zoneId, ADCASH_AUTOTAG_ZONE_ID)
  assert.equal(document.timers.size, 0)
})

test("each document has its own lifecycle and an existing loaded library is reused", async () => {
  const first = setup(), second = setup()
  first.install()
  second.install()
  await Promise.all([startAdcashAutoTag(first), startAdcashAutoTag(second)])
  assert.equal(first.calls.length, 1)
  assert.equal(second.calls.length, 1)
  assert.equal(first.scripts.length + second.scripts.length, 0)
})

test("an existing trusted script is reused without adding another library", async () => {
  const document = setup()
  const script = document.createElement("script")
  script.src = ADCASH_SCRIPT_URL
  document.head.appendChild(script)
  const result = startAdcashAutoTag(document)
  assert.equal(document.scripts.length, 1)
  document.finish(script)
  await result
  assert.equal(document.calls.length, 1)
})

test("a failed download clears its state and can be retried without a late load starting ads", async () => {
  const document = setup()
  const first = startAdcashAutoTag(document)
  const failed = document.scripts[0]
  failed.dispatchEvent(new Event("error"))
  await assert.rejects(first, (error) => error instanceof AdcashError && error.reason === "script_unreachable")
  assert.equal(document.scripts.length, 0)
  assert.equal(document.timers.size, 0)
  document.finish(failed)
  assert.deepEqual(document.calls, [])
  delete document.defaultView.aclib
  const retry = startAdcashAutoTag(document)
  assert.equal(document.scripts.length, 1)
  document.finish()
  await retry
  assert.equal(document.calls.length, 1)
})

test("a browser rejecting script insertion releases its timeout and permits retry", async () => {
  const document = setup()
  const append = document.head.appendChild
  document.head.appendChild = () => { throw new Error("Blocked by browser policy") }
  await assert.rejects(startAdcashAutoTag(document), /Không tải được quảng cáo/)
  assert.equal(document.timers.size, 0)
  assert.equal(document.scripts.length, 0)
  document.head.appendChild = append
  const retry = startAdcashAutoTag(document)
  document.finish()
  await retry
  assert.equal(document.calls.length, 1)
})

test("a script without runAutoTag fails and retries rather than claiming initialization succeeded", async () => {
  const document = setup()
  const first = startAdcashAutoTag(document)
  document.defaultView.aclib = {}
  document.scripts[0].dispatchEvent(new Event("load"))
  await assert.rejects(first, (error) => error instanceof AdcashError && error.reason === "library_unavailable")
  assert.equal(document.scripts.length, 0)
  const retry = startAdcashAutoTag(document)
  document.finish()
  await retry
  assert.equal(document.calls.length, 1)
})

test("a blocked script times out after fifteen seconds and supports a fresh retry", async () => {
  const document = setup()
  const first = startAdcashAutoTag(document)
  const timer = [...document.timers.values()][0]
  assert.equal(timer.delay, 15000)
  timer.callback()
  await assert.rejects(first, (error) => error instanceof AdcashError && error.reason === "script_timeout")
  assert.equal(document.timers.size, 0)
  assert.equal(document.scripts.length, 0)
  assert.deepEqual(document.calls, [])
  const retry = startAdcashAutoTag(document)
  document.finish()
  await retry
  assert.equal(document.calls.length, 1)
})

test("an already aborted caller never inserts a script", async () => {
  const document = setup(), controller = new AbortController()
  controller.abort()
  await assert.rejects(startAdcashAutoTag(document, controller.signal), { name: "AbortError" })
  assert.equal(document.scripts.length, 0)
  assert.deepEqual(document.calls, [])
})

test("unmounting rejects promptly and a later library load cannot initialize an abandoned attempt", async () => {
  const document = setup(), controller = new AbortController()
  const result = startAdcashAutoTag(document, controller.signal)
  controller.abort()
  await assert.rejects(result, { name: "AbortError" })
  document.finish()
  await Promise.resolve()
  assert.deepEqual(document.calls, [])
  await startAdcashAutoTag(document)
  assert.equal(document.calls.length, 1)
  assert.equal(document.scripts.length, 1)
})

test("Strict Mode remounts reuse the pending library while only the current caller starts the zone", async () => {
  const document = setup(), firstMount = new AbortController()
  const first = startAdcashAutoTag(document, firstMount.signal)
  firstMount.abort()
  const second = startAdcashAutoTag(document)
  await assert.rejects(first, { name: "AbortError" })
  assert.equal(document.scripts.length, 1)
  document.finish()
  await second
  assert.deepEqual(document.calls, [{ zoneId: ADCASH_AUTOTAG_ZONE_ID }])
})

test("aborting between the load event and its continuation prevents zone initialization", async () => {
  const document = setup(), controller = new AbortController()
  const result = startAdcashAutoTag(document, controller.signal)
  document.finish()
  controller.abort()
  await assert.rejects(result, { name: "AbortError" })
  assert.deepEqual(document.calls, [])
})

test("initialization errors are reported and retry reuses the library", async () => {
  const document = setup()
  const cause = new Error("Unavailable")
  document.install(() => { throw cause })
  await assert.rejects(startAdcashAutoTag(document), (error) => error instanceof AdcashError && error.reason === "initialization_failed" && error.cause === cause)
  document.install()
  await startAdcashAutoTag(document)
  assert.equal(document.calls.length, 2)
  assert.equal(document.scripts.length, 0)
})

test("a conflicting aclib element is rejected without deleting or executing it", async () => {
  const document = setup()
  const existing = document.createElement("script")
  existing.id = "aclib"
  existing.src = "https://unrelated.example.test/library.js"
  document.head.appendChild(existing)
  await assert.rejects(startAdcashAutoTag(document), /Không thể khởi tạo quảng cáo/)
  assert.deepEqual(document.scripts, [existing])
  assert.deepEqual(document.calls, [])
  assert.equal(document.timers.size, 0)
})
