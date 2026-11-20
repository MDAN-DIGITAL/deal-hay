import type { JSONContent } from "@tiptap/react"

export type ProductDescriptionDocument = JSONContent

export const productDescriptionFormatting =
  "min-w-0 space-y-2 leading-7 [overflow-wrap:anywhere] [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_img]:max-w-full [&_img]:rounded-lg"

const imageIds = new WeakMap<File, string>()
let nextImageId = 0

export function productImageId(file: File): string {
  let id = imageIds.get(file)
  if (!id) {
    id = String(++nextImageId)
    imageIds.set(file, id)
  }
  return id
}

export function serializeProductDescription(
  draft: string | undefined,
  primary: File,
  gallery: File[]
): string | null {
  if (!draft) return null

  const references = new Map(
    gallery.map((file, index) => [productImageId(file), `gallery:${index}`])
  )
  references.set(productImageId(primary), "primary")

  function convert(
    node: ProductDescriptionDocument
  ): ProductDescriptionDocument[] {
    if (node.type === "image") {
      const imageId = references.get(node.attrs?.imageId)
      if (!imageId) return []
      return [{ type: "image", attrs: { imageId, alt: node.attrs?.alt } }]
    }

    return [
      {
        ...node,
        ...(node.content ? { content: node.content.flatMap(convert) } : {}),
      },
    ]
  }

  return JSON.stringify(convert(JSON.parse(draft))[0])
}
