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
  export const useState=(initial)=>[globalThis.__siteNavigation.open??initial,(next)=>{globalThis.__siteNavigation.open=next}]
  export const usePathname=()=>globalThis.__siteNavigation.path
  export const useSession=()=>({user:globalThis.__siteNavigation.user})
  export const useRealtime=()=>({unreadCounts:{messages:2,notifications:1}})
  export const buttonVariants=({variant='default'}={})=>variant
  export const BellIcon='bell',ChevronDownIcon='chevron',MessageCircleIcon='message',ActivityIcon='activity',HouseIcon='home',LayoutDashboardIcon='dashboard',MenuIcon='menu',ShieldCheckIcon='shield',StoreIcon='store',TicketPercentIcon='ticket',UserRoundIcon='user'
  export const DropdownMenu='menu-root',DropdownMenuTrigger='menu-trigger',DropdownMenuContent='menu-content',DropdownMenuGroup='menu-group',DropdownMenuLabel='menu-label',DropdownMenuItem='menu-item',DropdownMenuSeparator='separator'
  export const Sheet='sheet-root',SheetContent='sheet-content',SheetDescription='sheet-description',SheetHeader='sheet-header',SheetTitle='sheet-title',SheetTrigger='sheet-trigger'
  export const Button='button',Brand='brand',MobileNavigation='mobile-navigation',NotificationSoundToggle='sound-toggle',SignOutButton='sign-out',ThemeToggle='theme-toggle',UnreadCountBadge='unread-badge',UnreadNavigationLink='unread-link',UserAvatar='avatar',ServerPing='ping',Separator='separator',Card='card',CardContent='card-content'
  export const ChatPageLink='chat-link'
  export const BadgeCheckIcon='badge-check',HeartHandshakeIcon='heart-handshake'
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
const { MobileNavigation } = await load(
  "../src/components/layout/mobile-navigation.tsx"
)
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

test("desktop and mobile navigation preserve role-specific links while marking the current destination", () => {
  for (const role of [null, "customer", "shop_owner", "administrator"]) {
    globalThis.__siteNavigation = {
      user: user(role),
      path: "/admin/shops",
      open: false,
    }
    const header = nodes(SiteHeader())
    const mobile = nodes(MobileNavigation({ user: user(role) }))
    const headerHrefs = header.map(({ props }) => props?.href).filter(Boolean)
    const mobileHrefs = mobile.map(({ props }) => props?.href).filter(Boolean)
    for (const hrefs of [headerHrefs, mobileHrefs]) {
      assert.equal(hrefs.includes("/diagnostics"), role === "administrator")
      assert.equal(hrefs.includes("/admin/users"), role === "administrator")
      assert.equal(hrefs.includes("/shop-manage"), role === "shop_owner")
      assert.equal(hrefs.includes("/discount-codes"), !!role)
    }
    if (role === "administrator") {
      for (const tree of [header, mobile])
        assert.equal(
          tree.find(({ props }) => props?.href === "/admin/users").props[
            "aria-current"
          ],
          "page"
        )
    }
    if (!role) {
      assert.ok(headerHrefs.includes("/sign-in"))
      assert.ok(mobileHrefs.includes("/sign-up"))
    }
  }
})

test("account and mobile menus activate only their ping probe and retain sound and logout controls", () => {
  globalThis.__siteNavigation = {
    user: user("customer"),
    path: "/profile",
    open: false,
  }
  let tree = nodes(SiteHeader())
  assert.equal(tree.find(({ type }) => type === "ping").props.active, false)
  tree.find(({ type }) => type === "menu-root").props.onOpenChange(true)
  tree = nodes(SiteHeader())
  assert.equal(tree.find(({ type }) => type === "ping").props.active, true)
  assert.ok(tree.some(({ type }) => type === "sound-toggle"))
  assert.ok(tree.some(({ type }) => type === "sign-out"))
  globalThis.__siteNavigation.open = false
  tree = nodes(MobileNavigation({ user: user("customer") }))
  assert.equal(tree.find(({ type }) => type === "ping").props.active, false)
  tree.find(({ type }) => type === "sheet-root").props.onOpenChange(true)
  tree = nodes(MobileNavigation({ user: user("customer") }))
  assert.equal(tree.find(({ type }) => type === "ping").props.active, true)
  assert.ok(tree.some(({ type }) => type === "sound-toggle"))
  assert.ok(tree.some(({ type }) => type === "sign-out"))
})

test("desktop, mobile and footer chat entries use the shared new-tab link", () => {
  globalThis.__siteNavigation = {
    user: user("customer"),
    path: "/",
    open: false,
  }
  for (const tree of [
    nodes(SiteHeader()),
    nodes(MobileNavigation({ user: user("customer") })),
    nodes(SiteFooter()),
  ]) {
    const entry = tree.find((node) => node.props?.href === "/chats")
    assert.equal(entry.type, "chat-link")
  }
})
