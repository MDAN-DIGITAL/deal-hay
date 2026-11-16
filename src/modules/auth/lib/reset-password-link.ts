export function readResetPasswordLink(href: string) {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const fragmentHasToken = fragment.has("token")
  const singleValue = (name: string) => {
    const values = [
      ...url.searchParams.getAll(name),
      ...(fragmentHasToken ? fragment.getAll(name) : []),
    ]
    return values.length === 1 && values[0].trim() ? values[0] : undefined
  }
  const token = singleValue("token")
  const email = singleValue("email")
  url.searchParams.delete("token")
  if (fragmentHasToken) {
    fragment.delete("token")
    url.hash = fragment.toString()
  }

  return { token, email, cleanHref: `${url.pathname}${url.search}${url.hash}` }
}
