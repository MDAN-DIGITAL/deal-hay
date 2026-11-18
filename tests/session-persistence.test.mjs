import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/lib/session.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { getSessionId, announceSession, watchBrowserSession, SESSION_CHANGED } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  )

test("tab synchronization sends a signal without accessing browser storage", () => {
  const window = new EventTarget()
  for (const storage of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(window, storage, {
      get() {
        assert.fail("Authentication must not access Web Storage")
      },
    })
  }
  globalThis.window = window
  const originalChannel = globalThis.BroadcastChannel
  const sent = []
  const connections = []
  let events = 0
  window.addEventListener(SESSION_CHANGED, () => events++)
  globalThis.BroadcastChannel = class {
    constructor() {
      connections.push(this)
    }
    postMessage(value) {
      sent.push(value)
    }
    close() {
      this.closed = true
    }
  }
  const stop = watchBrowserSession()
  const [connection] = connections
  try {
    announceSession("new-session")
    assert.equal(getSessionId(), "new-session")
    assert.deepEqual(sent, [null])
    connection.onmessage()
    assert.equal(getSessionId(), null)
    assert.equal(events, 2)
  } finally {
    stop()
    assert.equal(connection.closed, true)
    globalThis.BroadcastChannel = originalChannel
    delete globalThis.window
  }
})
