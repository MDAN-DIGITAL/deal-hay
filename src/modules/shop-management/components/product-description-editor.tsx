"use client"

import { useEffect, useRef, useState } from "react"
import { NodeSelection } from "@tiptap/pm/state"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import {
  BoldIcon,
  Heading2Icon,
  ImagePlusIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Surface } from "@/components/ui/surface"
import {
  productDescriptionFormatting,
  productImageId,
} from "@/lib/product-description"
import { cn } from "@/lib/utils"

const ProductImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageId: { default: null, rendered: false },
    }
  },
  // Allow only photos selected in this product form.
  parseHTML() {
    return []
  },
})

const extensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: { levels: [2, 3] },
    horizontalRule: false,
    link: false,
  }),
  ProductImage.configure({ allowBase64: false }),
]
const descriptionPlaceholder = "Nhập thông tin nổi bật và chi tiết sản phẩm"

type Props = Pick<
  React.ComponentProps<"div">,
  "id" | "aria-describedby" | "aria-invalid"
> & {
  primary?: File
  gallery: File[]
  canUpload: boolean
  disabled: boolean
  toolbarClassName?: string
  onChange: (value: string) => void
  onBlur: () => void
  onUpload: (file: File, insert: (image: File) => void) => void
}

export function ProductDescriptionEditor({
  primary,
  gallery,
  canUpload,
  disabled,
  toolbarClassName,
  onChange,
  onBlur,
  onUpload,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: Props) {
  const upload = useRef<HTMLInputElement>(null)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const previews = useRef(new Map<string, string>())
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        role: "textbox",
        "aria-label": "Nội dung mô tả",
        "aria-multiline": "true",
        "aria-placeholder": descriptionPlaceholder,
        class: `min-h-40 outline-none ${productDescriptionFormatting}`,
      },
    },
    onUpdate: ({ editor }) =>
      onChange(editor.isEmpty ? "" : JSON.stringify(editor.getJSON())),
    onBlur,
  })

  useEffect(() => {
    const urls = previews.current
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  useEffect(() => {
    editor?.setEditable(!disabled, false)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor || previews.current.size === 0) return

    const files = primary ? [primary, ...gallery] : gallery
    const available = new Set(files.map(productImageId))
    const removed = new Set(
      [...previews.current.keys()].filter((id) => !available.has(id))
    )
    if (removed.size === 0) return

    const transaction = editor.state.tr
    const positions: Array<{ position: number; size: number }> = []
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "image" && removed.has(node.attrs.imageId)) {
        positions.push({ position, size: node.nodeSize })
      }
    })
    for (const { position, size } of positions.reverse()) {
      transaction.delete(position, position + size)
    }
    if (transaction.docChanged)
      editor.view.dispatch(transaction.setMeta("addToHistory", false))

    for (const id of removed) {
      const url = previews.current.get(id)
      if (url) URL.revokeObjectURL(url)
      previews.current.delete(id)
    }
  }, [editor, primary, gallery])

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isEmpty: editor?.isEmpty ?? true,
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      heading: editor?.isActive("heading", { level: 2 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
    }),
  })

  function insertImage(file: File) {
    if (!editor || editor.isDestroyed) return
    const imageId = productImageId(file)
    let url = previews.current.get(imageId)
    if (!url) {
      url = URL.createObjectURL(file)
      previews.current.set(imageId, url)
    }
    const selection = editor.state.selection
    const position =
      selection instanceof NodeSelection && selection.node.type.name === "image"
        ? selection.to
        : { from: selection.from, to: selection.to }
    editor
      .chain()
      .focus()
      .insertContentAt(position, {
        type: "image",
        attrs: { src: url, imageId, alt: file.name },
      })
      .run()
  }

  const formatOptions = [
    {
      title: "In đậm",
      icon: BoldIcon,
      active: active?.bold,
      apply: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      title: "In nghiêng",
      icon: ItalicIcon,
      active: active?.italic,
      apply: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      title: "Gạch chân",
      icon: UnderlineIcon,
      active: active?.underline,
      apply: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      title: "Tiêu đề",
      icon: Heading2Icon,
      active: active?.heading,
      apply: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: "Danh sách gạch đầu dòng",
      icon: ListIcon,
      active: active?.bulletList,
      apply: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      title: "Danh sách đánh số",
      icon: ListOrderedIcon,
      active: active?.orderedList,
      apply: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ]
  const images = [
    ...(primary ? [{ file: primary, label: "Ảnh chính" }] : []),
    ...gallery.map((file, index) => ({ file, label: `Ảnh phụ ${index + 1}` })),
  ]

  return (
    <Surface padding="none" variant="inset">
      <div
        role="toolbar"
        aria-label="Định dạng mô tả"
        className={cn(
          "sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-[inherit] border-b border-border bg-background p-2",
          toolbarClassName
        )}
      >
        {formatOptions.map(({ title, icon: Icon, active, apply }) => (
          <Button
            key={title}
            type="button"
            size="icon-sm"
            variant={active ? "secondary" : "ghost"}
            aria-label={title}
            aria-pressed={Boolean(active)}
            tooltip={title}
            disabled={!editor || disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={apply}
          >
            <Icon />
          </Button>
        ))}
        <Popover open={imageMenuOpen} onOpenChange={setImageMenuOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!editor || disabled}
              />
            }
          >
            <ImagePlusIcon /> Chèn ảnh
          </PopoverTrigger>
          <PopoverContent align="start" className="gap-1">
            {images.map(({ file, label }) => (
              <Button
                key={label}
                className="justify-start"
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImageMenuOpen(false)
                  insertImage(file)
                }}
              >
                {label}
              </Button>
            ))}
            <Button
              className="justify-start"
              type="button"
              size="sm"
              variant="outline"
              disabled={!canUpload}
              onClick={() => {
                setImageMenuOpen(false)
                upload.current?.click()
              }}
            >
              Tải ảnh từ máy
            </Button>
          </PopoverContent>
        </Popover>
        <Input
          ref={upload}
          type="file"
          hidden
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file) onUpload(file, insertImage)
          }}
        />
      </div>
      <div className="relative">
        <EditorContent editor={editor} className="cursor-text p-3" />
        {(active?.isEmpty ?? true) && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-3 leading-7 text-muted-foreground/85"
          >
            {descriptionPlaceholder}
          </span>
        )}
      </div>
    </Surface>
  )
}
