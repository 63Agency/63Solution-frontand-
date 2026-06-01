const PERMISSION_KEY = "63agency-browser-notif-asked";

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function wasBrowserNotificationPromptShown(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PERMISSION_KEY) === "1";
}

export function markBrowserNotificationPromptShown(): void {
  localStorage.setItem(PERMISSION_KEY, "1");
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  markBrowserNotificationPromptShown();
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function showBrowserNotification(options: {
  title: string;
  body: string;
  href: string;
  tag?: string;
}): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const n = new Notification(options.title, {
    body: options.body,
    tag: options.tag ?? options.href,
    icon: "/images/63AgencyTextwhit.png",
  });

  n.onclick = () => {
    window.focus();
    window.location.href = options.href;
    n.close();
  };
}
