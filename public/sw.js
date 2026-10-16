/*
 * Alumnity's service worker: it only shows notifications (Web Push) and opens the right
 * page when one is tapped. It caches nothing and never touches the site's requests.
 */

self.addEventListener("push", (event) => {
  let data = { title: "Alumnity", body: "Something new for you.", link: "/notifications", tag: "alumnity" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // Not ours, or empty: show the plain one.
  }
  // Only links on this site.
  const link = typeof data.link === "string" && data.link.startsWith("/") && !data.link.startsWith("//") ? data.link : "/notifications";
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/assets/brand/icon-192.png",
      badge: "/assets/brand/badge-72.png",
      data: { link }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || "/notifications", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
