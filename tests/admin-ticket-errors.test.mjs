import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const runtime = moduleUrl(`
  export const state = { result: null, fields: [], errors: [], successes: [], pending: null }
  export const useTransition = () => [false, (callback) => { state.pending = Promise.resolve(callback()) }]
  export const useForm = () => ({
    control: {},
    setError: (...args) => state.fields.push(args),
    handleSubmit: (callback) => () => callback({status:"approved",admin_note:""}),
  })
  export const zodResolver = () => ({})
  export const toast = { error: (message) => state.errors.push(message), success: (message) => state.successes.push(message) }
  export const reviewTicketAction = async () => state.result
  export const reviewTicketSchema = {}
  export const Surface="surface",FormSelect="select",FormSubmitButton="submit",DataPagination="pagination",EmptyState="empty",PageHeader="heading",Badge="badge"
  export const Card="card",CardContent="content",CardHeader="header",CardTitle="title"
  export const Form="form-provider",FormControl="control",FormField="field",FormItem="item",FormLabel="label",FormMessage="message"
  export const Textarea="textarea",UserAvatar="avatar",AdminNavigation="navigation"
`)
const jsx = moduleUrl(`
  export const jsx=(type,props,key)=>({type,props,key})
  export const jsxs=jsx
`)
const formUtils = moduleUrl(
  ts.transpileModule(
    readFileSync(new URL("../src/lib/form-utils.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText
)
const source = ts
  .transpileModule(
    readFileSync(
      new URL(
        "../src/modules/admin/components/admin-tickets-client.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    const dependency =
      name === "react/jsx-runtime"
        ? jsx
        : name === "@/lib/form-utils"
          ? formUtils
          : runtime
    return `from ${quote}${dependency}${quote}`
  })
const { AdminTicketsClient } = await import(moduleUrl(source))
const { state } = await import(runtime)

function nodes(node) {
  if (!node || typeof node !== "object") return []
  return [
    node,
    ...[]
      .concat(node.props?.children ?? [])
      .flat(Infinity)
      .flatMap(nodes),
  ]
}

async function submit(result) {
  state.result = result
  const tree = AdminTicketsClient({
    tickets: {
      data: [{ id: "ticket-1", status: "pending", admin_note: null }],
      current_page: 1,
      last_page: 1,
    },
  })
  const ticket = nodes(tree).find((node) => node.type?.name === "TicketForm")
  const form = nodes(ticket.type(ticket.props)).find(
    (node) => node.type === "form"
  )
  form.props.onSubmit()
  await state.pending
}

test.beforeEach(() => {
  state.fields = []
  state.errors = []
  state.successes = []
  state.pending = null
})

test("a general ticket review rejection is visible instead of being assigned to a hidden field", async () => {
  const message = "Email hoặc số điện thoại trong yêu cầu đã được sử dụng."
  await submit({
    success: false,
    message: "The given data was invalid.",
    errors: { general: [message] },
  })
  assert.deepEqual(state.errors, [message])
  assert.deepEqual(state.fields, [])
})

test("general ticket errors remain visible alongside errors on the editable fields", async () => {
  await submit({
    success: false,
    message: "Không thể xử lý ticket.",
    errors: {
      general: ["Ticket này đã được xử lý bởi quản trị viên khác."],
      admin_note: ["Vui lòng nhập lý do từ chối ticket."],
    },
  })
  assert.deepEqual(state.errors, [
    "Ticket này đã được xử lý bởi quản trị viên khác.",
  ])
  assert.deepEqual(state.fields, [
    [
      "admin_note",
      { type: "server", message: "Vui lòng nhập lý do từ chối ticket." },
    ],
  ])
})

test("ordinary ticket field validation stays inline without a duplicate error toast", async () => {
  await submit({
    success: false,
    message: "Dữ liệu ticket chưa hợp lệ.",
    errors: { status: ["Trạng thái ticket không hợp lệ."] },
  })
  assert.deepEqual(state.errors, [])
  assert.equal(state.fields[0][0], "status")
})
