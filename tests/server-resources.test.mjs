import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const transport = url(`
export class ApiError extends Error { constructor(status,message="private diagnostics details"){super(message);this.status=status} }
export function apiFetch(options){globalThis.__resources.calls.push({target:'backend',options});return globalThis.__resources.reply()}
export function wssFetch(options){globalThis.__resources.calls.push({target:'wss',options});return globalThis.__resources.reply()}
`)
const imports = {
  zod: import.meta.resolve("zod"),
  "@/api/client": transport,
  "@/api/wss-client": transport,
}
const source = ts
  .transpileModule(
    readFileSync(
      new URL(
        "../src/modules/diagnostics/resource-actions.ts",
        import.meta.url
      ),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, q, name) => {
    assert.ok(imports[name], name)
    return `from ${q}${imports[name]}${q}`
  })
const { loadServerResources, serverResourcesSchema } = await import(url(source))
const { ApiError } = await import(transport)
const snapshot = () => ({
  sampled_at: "2026-11-03T00:00:00Z",
  sample_window_ms: 1000,
  instance_id: "fixture-instance",
  cpu: {
    percent: 23.5,
    allocated_cores: 0.5,
    visible_logical_cores: 16,
    model: "Fixture processor",
    scope: "container",
    source: "cgroup-v2",
  },
  memory: {
    used_bytes: 128,
    limit_bytes: 512,
    available_bytes: 384,
    percent: 25,
    scope: "container",
    source: "cgroup-v2",
  },
  disk: {
    used_bytes: 100,
    total_bytes: 500,
    available_bytes: 400,
    percent: 20,
    allocated_bytes: null,
    scope: "filesystem",
    source: "statfs",
  },
  os: {
    name: "Fixture Linux",
    platform: "linux",
    release: "fixture",
    architecture: "x64",
  },
  process: { rss_bytes: 64, uptime_seconds: 300 },
})
test.beforeEach(() => {
  globalThis.__resources = { calls: [], reply: async () => snapshot() }
})

test("each admin resource request uses its fixed server transport and propagates cancellation", async () => {
  for (const target of ["backend", "wss"]) {
    const controller = new AbortController()
    assert.deepEqual(
      await loadServerResources(target, controller.signal),
      snapshot()
    )
    const request = globalThis.__resources.calls.at(-1)
    assert.equal(request.target, target)
    assert.equal(request.options.path, "/diagnostics/resources")
    assert.equal(request.options.signal, controller.signal)
  }
})
test("unavailable measurements remain null and CPU bursts are not falsified to 100 percent", () => {
  const value = snapshot()
  value.cpu.percent = 123.25
  value.cpu.allocated_cores = null
  value.memory.limit_bytes = null
  value.memory.percent = null
  const result = serverResourcesSchema.parse(value)
  assert.equal(result.cpu.percent, 123.25)
  assert.equal(result.memory.limit_bytes, null)
  assert.equal(result.memory.percent, null)
  assert.equal(result.disk.allocated_bytes, null)
})
test("invalid or incomplete metrics cannot appear as authoritative server numbers", () => {
  for (const invalid of [-1, NaN, Infinity, undefined]) {
    const value = snapshot()
    value.cpu.percent = invalid
    assert.equal(serverResourcesSchema.safeParse(value).success, false)
  }
  const value = snapshot()
  value.sampled_at = "yesterday"
  assert.equal(serverResourcesSchema.safeParse(value).success, false)
})
test("authorization and rollout errors are actionable without returning backend diagnostics", async () => {
  for (const [status, expected] of [
    [401, /hết hạn/],
    [403, /quản trị/],
    [404, /chưa cập nhật/],
    [429, /giới hạn/],
    [500, /Không lấy được/],
  ]) {
    globalThis.__resources.reply = async () => {
      throw new ApiError(status)
    }
    await assert.rejects(
      loadServerResources("backend", new AbortController().signal),
      (error) =>
        expected.test(error.message) &&
        !error.message.includes("private diagnostics")
    )
  }
})
test("an abort settles while WSS session bootstrap is still pending", async () => {
  globalThis.__resources.reply = () => new Promise(() => {})
  const controller = new AbortController()
  const request = loadServerResources("wss", controller.signal)
  await Promise.resolve()
  controller.abort(new DOMException("Deadline", "TimeoutError"))
  await assert.rejects(request, (error) => error.name === "TimeoutError")
})
