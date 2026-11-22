export const notificationMenuQuery = "notifications"
export const notificationMenuHref = `/?${notificationMenuQuery}=open`
export const notificationMenuEvent = "dealhay:open-notification-menu"

export function requestNotificationMenu(): boolean {
  return !window.dispatchEvent(
    new Event(notificationMenuEvent, { cancelable: true })
  )
}
