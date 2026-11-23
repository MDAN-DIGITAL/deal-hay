import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const jsx = moduleUrl(
  "export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment'"
)
const widgets = moduleUrl(`
  export const useRef=(current)=>({current})
  export const useState=(initial)=>{
    const fixture=globalThis.__siteNavigation
    const index=fixture.stateIndex++
    return [fixture.state[index]??initial,(next)=>{fixture.state[index]=next}]
  }
  export const usePathname=()=>globalThis.__siteNavigation.path
  export const useSession=()=>({user:globalThis.__siteNavigation.user,loading:globalThis.__siteNavigation.loading??false})
  export const useRealtime=()=>({unreadCounts:{messages:2,notifications:1}})
  export const cn=(...classes)=>classes.filter(Boolean).join(' ')
  export const StorefrontSearch='product-search'
  export const buttonVariants=({variant='default'}={})=>variant
  export const BellIcon='bell',ChevronDownIcon='chevron',MessageCircleIcon='message',ActivityIcon='activity',HouseIcon='home',LayoutDashboardIcon='dashboard',ShieldCheckIcon='shield',ShoppingCartIcon='cart',StoreIcon='store',TicketPercentIcon='ticket',UserRoundIcon='user',Volume2Icon='volume'
  export const DropdownMenu='menu-root',DropdownMenuTrigger='menu-trigger',DropdownMenuContent='menu-content',DropdownMenuGroup='menu-group',DropdownMenuLabel='menu-label',DropdownMenuItem='menu-item',DropdownMenuSeparator='separator'
  export const Button='button',Brand='brand',NotificationSoundDialog='sound-dialog',SignOutButton='sign-out',ThemeToggle='theme-toggle',UnreadCountBadge='unread-badge',UnreadNavigationLink='unread-link',UserAvatar='avatar',ServerPing='ping',Separator='separator',Card='card',CardContent='card-content'
  export const ChatPageLink='chat-link'
  export const NotificationMenu='notification-menu'
  export const BadgeCheckIcon='badge-check',HeartHandshakeIcon='heart-handshake'
  export const LogInIcon='log-in',UserPlusIcon='user-plus',BadgePercentIcon='badge-percent',CircleHelpIcon='help',FileTextIcon='file',ReceiptTextIcon='receipt',RotateCcwIcon='rotate'
`)
function load(file) {
  const source = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText
  return import(
    moduleUrl(
      source.replace(
        /from (["'])([^"']+)\1/g,
        (_match, quote, name) =>
          `from ${quote}${name === "react/jsx-runtime" ? jsx : name === "next/link" ? moduleUrl("export default 'link'") : widgets}${quote}`
      )
    )
  )
}
const { SiteHeader } = await load("../src/components/layout/site-header.tsx")
const { SiteFooter } = await load("../src/components/layout/site-footer.tsx")
function nodes(node) {
  if (!node || typeof node !== "object") return []
  return [
    node,
    ...[]
      .concat(node.props?.children ?? [])
      .flat(Infinity)
      .flatMap(nodes),
    ...nodes(node.props?.render),
  ]
}
const user = (role) =>
  role
    ? {
        id: role,
        role,
        full_name: "Khách hàng",
        email: "user@example.test",
        avatar_url: null,
      }
    : null

function renderHeader(options) {
  globalThis.__siteNavigation.state ??= []
  globalThis.__siteNavigation.stateIndex = 0
  const header = nodes(SiteHeader(options))
  const menu = nodes(header.find(({ type }) => type === "menu-content"))
  const links = menu.filter(({ props }) => props?.href)
  return {
    header,
    menu,
    links,
    toolbar: header.filter((node) => !menu.includes(node)),
  }
}

test("secondary navigation lives in one account dropdown on the storefront and other public pages", () => {
  for (const storefront of [false, true]) {
    for (const role of [null, "customer", "shop_owner", "administrator"]) {
      globalThis.__siteNavigation = {
        user: user(role),
        path: "/admin/shops",
      }
      const { header, menu, links, toolbar } = renderHeader({ storefront })
      const hrefs = links.map(({ props }) => props.href)
      assert.equal(
        header.filter(({ type }) => type === "menu-trigger").length,
        1
      )
      assert.equal(
        header.filter(({ type }) => type === "product-search").length,
        Number(storefront)
      )
      assert.deepEqual(
        toolbar
          .filter(({ type }) =>
            ["unread-link", "notification-menu", "theme-toggle"].includes(type)
          )
          .map(({ type }) => type),
        ["unread-link", "notification-menu", "theme-toggle"]
      )
      assert.deepEqual(
        toolbar.map(({ props }) => props?.href).filter(Boolean),
        ["/", "/chats"]
      )
      assert.ok(hrefs.includes("/shops"))
      assert.ok(hrefs.includes("/cart"))
      assert.ok(!hrefs.includes("/notifications"))
      assert.ok(!hrefs.includes("/chats"))
      assert.equal(hrefs.includes("/profile"), !!role)
      assert.equal(hrefs.includes("/discount-codes"), !!role)
      assert.equal(hrefs.includes("/diagnostics"), role === "administrator")
      assert.equal(hrefs.includes("/admin"), role === "administrator")
      assert.equal(hrefs.includes("/shop-manage"), role === "shop_owner")
      assert.equal(hrefs.includes("/sign-in"), !role)
      assert.equal(hrefs.includes("/sign-up"), !role)
      assert.equal(
        menu.some(({ type }) => type === "sign-out"),
        !!role
      )
      if (role === "administrator") {
        assert.equal(
          links.find(({ props }) => props.href === "/admin").props[
            "aria-current"
          ],
          "page"
        )
      }
    }
  }
})

test("the account dropdown starts the ping probe and opens the notification settings dialog", () => {
  globalThis.__siteNavigation = {
    user: user("customer"),
    path: "/profile",
  }
  const closed = renderHeader()
  assert.equal(
    closed.header.find(({ type }) => type === "ping").props.active,
    false
  )
  assert.equal(
    closed.header.find(({ type }) => type === "sound-dialog").props.open,
    false
  )
  closed.header
    .find(({ type }) => type === "menu-root")
    .props.onOpenChange(true)
  const opened = renderHeader()
  assert.equal(
    opened.header.find(({ type }) => type === "ping").props.active,
    true
  )
  const settingsItem = opened.menu.find(
    ({ type, props }) => type === "menu-item" && props.onClick
  )
  settingsItem.props.onClick()
  assert.equal(
    renderHeader().header.find(({ type }) => type === "sound-dialog").props
      .open,
    true
  )
})

test("pending account hydration never flashes signed-out actions", () => {
  globalThis.__siteNavigation = {
    user: null,
    loading: true,
    path: "/",
  }
  const { header, links } = renderHeader()
  assert.equal(links.length, 0)
  assert.equal(
    header.some(({ type }) => type === "menu-trigger"),
    false
  )
  assert.ok(
    header.some(
      ({ props }) =>
        props?.["aria-busy"] === "true" &&
        props?.["aria-label"] === "Đang tải tài khoản"
    )
  )
})

test("the header shows the unread chat shortcut and the footer uses the shared new-tab link", () => {
  globalThis.__siteNavigation = {
    user: user("customer"),
    path: "/",
  }
  const { toolbar } = renderHeader()
  const shortcut = toolbar.find(({ props }) => props?.href === "/chats")
  assert.equal(shortcut.type, "unread-link")
  assert.equal(shortcut.props.kind, "messages")
  const footer = nodes(SiteFooter()).find(
    ({ props }) => props?.href === "/chats"
  )
  assert.equal(footer.type, "chat-link")
})

test("seller links in the account dropdown and footer open a separate authenticated tab", () => {
  globalThis.__siteNavigation = {
    user: user("shop_owner"),
    path: "/shops",
  }
  const { links } = renderHeader({ storefront: true })
  assert.equal(
    links.find(({ props }) => props.href === "/shops").props["aria-current"],
    "page"
  )
  for (const tree of [links, nodes(SiteFooter())]) {
    const entry = tree.find(({ props }) => props?.href === "/shop-manage")
    assert.equal(entry.props.target, "_blank")
    assert.equal(entry.props.rel, "noopener noreferrer")
    assert.equal(entry.props.onAuxClick, undefined)
  }
})
