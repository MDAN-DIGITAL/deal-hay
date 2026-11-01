import { z } from "zod"
import { wssFetch } from "@/api/wss-client"
import { storageUploadUrl } from "@/lib/storage-upload"

/** Non-image chat files use the same direct-to-storage flow as prepared images. */
export async function uploadChatFile(file: File): Promise<string> {
  const session = z
    .object({
      uploads: z
        .array(
          z.object({
            token: z.string().min(1).max(2048),
            url: z.url(),
            headers: z.record(z.string(), z.string()),
            asset_url: z.url().max(2048),
          })
        )
        .length(1),
    })
    .parse(
      await wssFetch({
        method: "POST",
        path: "/chat-uploads/files",
        body: {
          size: file.size,
          content_type: file.type || "application/octet-stream",
          filename: file.name,
        },
      })
    ).uploads[0]
  try {
    storageUploadUrl(session.url)
    if (storageUploadUrl(session.asset_url).search)
      throw new Error("Invalid chat attachment reference")
    for (const header of Object.keys(session.headers))
      if (!/^(content-type|x-amz-[a-z0-9-]+)$/i.test(header))
        throw new Error("Invalid chat upload header")
    const response = await fetch(session.url, {
      method: "PUT",
      headers: session.headers,
      body: file,
      credentials: "omit",
      redirect: "error",
    })
    if (!response.ok)
      throw new Error("Không thể tải tệp đính kèm lên kho lưu trữ.")
    return session.asset_url
  } catch (error) {
    await wssFetch({
      method: "DELETE",
      path: "/chat-uploads/staged",
      body: { tokens: [session.token] },
    }).catch(() => {})
    throw error
  }
}
