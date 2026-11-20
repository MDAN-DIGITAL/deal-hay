import { Fragment, type ReactNode } from "react"

import { ImagePreview } from "@/components/image-preview"
import {
  productDescriptionFormatting,
  type ProductDescriptionDocument,
} from "@/lib/product-description"
import { cn } from "@/lib/utils"
import type { PublicProduct } from "@/types/catalog"

export function ProductDescriptionContent({
  product,
}: {
  product: Pick<
    PublicProduct,
    "description" | "description_content" | "image_url" | "images" | "name"
  >
}) {
  const imageUrls = new Map(
    product.images.map((image) => [image.id, image.image_url])
  )
  if (product.image_url) imageUrls.set("primary", product.image_url)

  function render(node: ProductDescriptionDocument): ReactNode {
    const children = Array.isArray(node.content)
      ? node.content.map((child, index) => (
          <Fragment key={index}>{render(child)}</Fragment>
        ))
      : null
    switch (node.type) {
      case "doc":
        return children
      case "paragraph":
        return <p>{children?.length ? children : <br />}</p>
      case "heading":
        return node.attrs?.level === 3 ? (
          <h4>{children}</h4>
        ) : (
          <h3 className="text-lg">{children}</h3>
        )
      case "bulletList":
        return <ul>{children}</ul>
      case "orderedList":
        return <ol start={Number(node.attrs?.start) || 1}>{children}</ol>
      case "listItem":
        return <li>{children}</li>
      case "hardBreak":
        return <br />
      case "image": {
        const url = imageUrls.get(node.attrs?.imageId)
        return url ? (
          <ImagePreview
            src={url}
            alt={
              typeof node.attrs?.alt === "string" && node.attrs.alt
                ? node.attrs.alt
                : product.name
            }
            thumbnailClassName="aspect-[4/3] w-96 max-w-full [&_img]:object-contain"
          />
        ) : null
      }
      case "text":
        return (node.marks ?? []).reduce<ReactNode>((text, mark) => {
          switch (mark.type) {
            case "bold":
              return <strong>{text}</strong>
            case "italic":
              return <em>{text}</em>
            case "underline":
              return <u>{text}</u>
            case "strike":
              return <s>{text}</s>
            default:
              return text
          }
        }, node.text)
      default:
        return null
    }
  }

  if (product.description_content?.content?.length) {
    return (
      <div className={productDescriptionFormatting}>
        {render(product.description_content)}
      </div>
    )
  }

  return (
    <p
      className={cn(
        productDescriptionFormatting,
        "whitespace-pre-wrap text-muted-foreground"
      )}
    >
      {product.description ||
        "Cửa hàng chưa bổ sung mô tả chi tiết cho sản phẩm này."}
    </p>
  )
}
