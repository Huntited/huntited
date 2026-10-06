// Service worker Huntited : uniquement pour les notifications « me prévenir ».
// Enregistré seulement quand une personne demande à être prévenue.
// Pas de cache, pas de suivi : il affiche le message reçu, puis ouvre la chasse.

const TEXTS = {
  fr: {
    activated: (title) => ({
      title: "🎯 Chasse déclenchée !",
      body: `« ${title} » a atteint son seuil : l'action a lieu. Le chat est ouvert.`,
    }),
    failed: (title) => ({
      title: "Chasse non déclenchée",
      body: `« ${title} » n'a pas atteint son seuil. Les dépôts sont rendus.`,
    }),
  },
  en: {
    activated: (title) => ({
      title: "🎯 Hunt triggered!",
      body: `"${title}" reached its threshold: the action is on. The chat is open.`,
    }),
    failed: (title) => ({
      title: "Hunt not triggered",
      body: `"${title}" didn't reach its threshold. Deposits are returned.`,
    }),
  },
};

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  const texts = TEXTS[data.locale] || TEXTS.fr;
  const make = texts[data.kind];
  if (!make || typeof data.huntId !== "string") return;
  const { title, body } = make(String(data.title || "").slice(0, 80));
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      tag: `hunt-${data.huntId}`,
      data: { url: `/hunt/${encodeURIComponent(data.huntId)}` },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
