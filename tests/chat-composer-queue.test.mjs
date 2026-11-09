import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(file, imports = {}) {
  return moduleUrl(
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import: ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}
const runtime = moduleUrl(`
  export const useState=(value)=>globalThis.__composer.state(value)
  export const useRef=(value)=>globalThis.__composer.ref(value)
  export const useEffect=(effect,deps)=>globalThis.__composer.effect(effect,deps)
  export const useForm=(options)=>globalThis.__composer.getForm(options)
  export const useWatch=({name})=>globalThis.__composer.values[name]
  export const zodResolver=()=>({})
  export const getAccessToken=()=>globalThis.__composer.token
  export const useImageUpload=()=>({prepareUploads:globalThis.__composer.prepareUploads,uploadProgress:null})
  export const sendMessageAction=(slug,payload)=>globalThis.__composer.send(slug,payload)
  export const uploadChatFile=async(file)=>'https://chat.test/files/'+file.name
  export const toast={error:()=>{}}
  export const CHAT_ATTACHMENT_ACCEPT='image/*'
  export const chatAttachmentFileSchema=()=>({safeParse:(file)=>({success:true,data:file})})
  export const sendMessageSchema={safeParse:(values)=>{
    const data={...values,body:values.body.trim(),attachments:[...values.attachments],mention_admin_ids:[...values.mention_admin_ids]}
    return data.body||data.attachments.length||data.mention_admin_ids.length?{success:true,data}:{success:false}
  }}
  export const AtSignIcon='at',LoaderCircleIcon='loader',PaperclipIcon='paperclip',PlusIcon='plus',RotateCcwIcon='retry-icon',SendIcon='send-icon',XIcon='close-icon'
  export const Button='button',Badge='badge',Checkbox='checkbox',Label='label',SelectedFilePreview='selected-file'
  export const Item='item',ItemActions='item-actions',ItemContent='item-content',ItemDescription='item-description',ItemGroup='item-group',ItemTitle='item-title'
  export const Form='form-provider',FormControl='control',FormField='field',FormItem='form-item',FormLabel='label',FormMessage='form-message'
  export const InputGroup='input-group',InputGroupAddon='input-addon',InputGroupButton='input-button',InputGroupTextarea='textarea'
  export const ImageUploadProgress='upload-progress',ChatEmojiPicker='emoji-picker',ChatReplyPreview='reply-preview'
`)
const imports = {
  "react/jsx-runtime": moduleUrl("export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx"),
  "@/modules/chats/lib/chat-send-attempt": transpile("../src/modules/chats/lib/chat-send-attempt.ts"),
  "@/lib/form-utils": transpile("../src/lib/form-utils.ts"),
}
for (const name of [
  "react", "@hookform/resolvers/zod", "lucide-react", "react-hook-form", "sonner",
  "@/components/ui/button", "@/components/ui/badge", "@/components/ui/checkbox", "@/components/ui/label", "@/components/ui/item",
  "@/components/selected-file-preview", "@/components/ui/form", "@/components/ui/input-group", "@/lib/session", "@/lib/validation",
  "@/components/image-upload-progress", "@/hooks/use-image-upload", "@/modules/chats/actions", "@/lib/chat-upload",
  "@/modules/chats/components/chat-emoji-picker", "@/modules/chats/components/chat-reply-preview", "@/modules/chats/schemas/chats",
]) imports[name] = runtime
const { ChatComposer } = await import(transpile("../src/modules/chats/components/chat-composer.tsx", imports))

function nodes(node) {
  if (!node || typeof node !== "object") return []
  if (node.type === "field") {
    const name = node.props.name
    return nodes(node.props.render({ field: {
      name, value: globalThis.__composer.values[name], ref: () => {}, onBlur: () => {},
      onChange: (value) => globalThis.__composer.form.setValue(name, value?.target?.value ?? value),
    } }))
  }
  return [node, ...[].concat(node.props?.children ?? []).flat(Infinity).flatMap(nodes)]
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
function mount(t, props = {}) {
  const slots = []
  let cursor = 0, dirty = false, effects = []
  const screen = {
    token: "account-one", values: null, form: null, tree: null, sent: [], requests: [], focusCount: 0,
    props: { conversationSlug: "first-room", onSent: (message) => screen.sent.push(message), ...props },
    prepareUploads: async (payload) => payload,
    send(slug, payload) {
      const response = deferred()
      this.requests.push({ slug, payload, response })
      return response.promise
    },
    state(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true }
      }]
    },
    ref(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: value }
      return slots[index]
    },
    effect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position])))
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
    },
    getForm({ defaultValues }) {
      if (this.form) return this.form
      this.values = { ...defaultValues }
      this.form = {
        control: {}, formState: { errors: {} },
        clearErrors: () => {}, trigger: async () => true,
        getValues: (name) => name ? this.values[name] : { ...this.values },
        setValue: (name, value) => { this.values[name] = value; dirty = true },
        reset: (value) => { this.values = { ...value }; dirty = true },
      }
      return this.form
    },
    render(next = {}) {
      Object.assign(this.props, next)
      let renders = 0
      do {
        assert.ok(++renders < 20, "composer effects must settle")
        dirty = false; cursor = 0; effects = []
        this.tree = ChatComposer(this.props)
        for (const node of nodes(this.tree)) if (node.type === "textarea")
          node.props.ref({ focus: () => { this.focusCount++ }, isConnected: true })
        for (const effect of effects) effect()
      } while (dirty)
      return this.tree
    },
    type(body) { this.form.setValue("body", body); this.render() },
    submit() {
      nodes(this.tree).find((node) => node.type === "form").props.onSubmit({ preventDefault() {} })
      this.render()
    },
    succeed(index) {
      const { slug, payload, response } = this.requests[index]
      response.resolve({ success: true, message: "Sent", data: {
        id: `message-${index}`, conversation_id: slug, body: payload.get("body") ?? "",
        client_message_id: payload.get("client_message_id"),
      } })
    },
    async until(check) {
      for (let index = 0; index < 100; index++) {
        if (dirty) this.render()
        if (check()) return
        await Promise.resolve()
      }
      assert.ok(check(), "composer network work must settle")
    },
    dispose() { for (const slot of slots) slot?.cleanup?.() },
  }
  const previous = globalThis.__composer
  globalThis.__composer = screen
  t.after(() => { screen.dispose(); globalThis.__composer = previous })
  screen.render()
  return screen
}

test("sending clears only the submitted snapshot and leaves the composer enabled while two requests are pending", async (t) => {
  const screen = mount(t)
  screen.type("First message")
  screen.submit()
  assert.equal(screen.values.body, "")
  const textarea = nodes(screen.tree).find((node) => node.type === "textarea")
  assert.notEqual(textarea.props.disabled, true)
  await screen.until(() => screen.requests.length === 1)
  screen.type("Second message")
  screen.submit()
  assert.equal(screen.values.body, "")
  screen.type("Unsubmitted third draft")
  screen.succeed(0)
  await screen.until(() => screen.requests.length === 2)
  assert.equal(screen.values.body, "Unsubmitted third draft")
  assert.equal(screen.requests[1].payload.get("body"), "Second message")
  screen.succeed(1)
  await screen.until(() => screen.sent.length === 2)
  assert.equal(screen.values.body, "Unsubmitted third draft")
})

test("a failed message keeps a retry preview without changing a newer draft or reply target", async (t) => {
  let cancelled = 0
  const screen = mount(t, { replyTo: { id: "original-reply" }, onCancelReply: () => { cancelled++ } })
  screen.type("Reply to first target")
  screen.submit()
  assert.equal(cancelled, 1)
  await screen.until(() => screen.requests.length === 1)
  screen.render({ replyTo: { id: "new-reply" } })
  screen.type("Fresh draft")
  const firstId = screen.requests[0].payload.get("client_message_id")
  screen.requests[0].response.resolve({ success: false, message: "Connection lost" })
  await screen.until(() => nodes(screen.tree).some((node) => node.props?.role === "alert"))
  assert.equal(screen.values.body, "Fresh draft")
  const retry = nodes(screen.tree).find((node) => node.type === "button" && node.props.children?.some?.((child) => child === " Gửi lại"))
  assert.ok(retry, "failed snapshot has its own retry action")
  retry.props.onClick()
  await screen.until(() => screen.requests.length === 2)
  assert.equal(screen.requests[1].payload.get("client_message_id"), firstId)
  assert.equal(screen.requests[1].payload.get("reply_to_id"), "original-reply")
  screen.succeed(1)
  await screen.until(() => screen.sent.length === 1)
  assert.equal(screen.values.body, "Fresh draft")
  assert.equal(screen.props.replyTo.id, "new-reply")
  assert.equal(cancelled, 1)
})

test("socket acknowledgement removes the pending preview and late failure cannot restore it", async (t) => {
  const screen = mount(t)
  screen.type("Socket confirms this")
  screen.submit()
  await screen.until(() => screen.requests.length === 1)
  const id = screen.requests[0].payload.get("client_message_id")
  screen.render({ confirmedClientMessageIds: [id] })
  assert.equal(nodes(screen.tree).filter((node) => node.type === "item").length, 0)
  screen.requests[0].response.resolve({ success: false, message: "Response lost" })
  await screen.until(() => true)
  await Promise.resolve()
  await Promise.resolve()
  screen.render()
  assert.equal(nodes(screen.tree).filter((node) => node.type === "item").length, 0)
})

test("switching accounts stops later queued requests and suppresses acknowledgements into the new session", async (t) => {
  const screen = mount(t)
  screen.type("In flight")
  screen.submit()
  await screen.until(() => screen.requests.length === 1)
  screen.type("Queued old account draft")
  screen.submit()
  screen.token = "account-two"
  screen.succeed(0)
  for (let index = 0; index < 20; index++) await Promise.resolve()
  assert.equal(screen.sent.length, 0)
  assert.equal(screen.requests.length, 1)
})

test("socket success unlocks the next queued send and a late HTTP success is not published twice", async (t) => {
  const screen = mount(t)
  screen.type("First already committed")
  screen.submit()
  await screen.until(() => screen.requests.length === 1)
  screen.type("Second can send now")
  screen.submit()
  screen.type("Still composing third")
  const firstId = screen.requests[0].payload.get("client_message_id")
  screen.render({ confirmedClientMessageIds: [firstId] })
  await screen.until(() => screen.requests.length === 2)
  assert.equal(screen.values.body, "Still composing third")
  screen.succeed(0)
  screen.succeed(1)
  await screen.until(() => screen.sent.length === 1)
  assert.equal(screen.sent[0].body, "Second can send now")
  assert.equal(screen.values.body, "Still composing third")
})

test("disposing a composer stops remaining queued sends after an in-flight response", async (t) => {
  const screen = mount(t)
  screen.type("In flight")
  screen.submit()
  await screen.until(() => screen.requests.length === 1)
  screen.type("Queued")
  screen.submit()
  screen.dispose()
  screen.succeed(0)
  for (let index = 0; index < 30; index++) await Promise.resolve()
  assert.equal(screen.sent.length, 0)
  assert.equal(screen.requests.length, 1)
})
