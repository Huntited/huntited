// Liens vers l'app Huntited Chat (Android, docs/app.md) : ouvrir le salon
// d'une chasse dans l'app, avec la clé de chat du membre.
//
// - Lien web : https://huntited.com/app/salon#<chasse>.<clé>. Avec l'app
//   installée (lien d'application vérifié), Android ouvre l'app ; sinon, la
//   page propose de l'installer. La clé est après « # » : jamais envoyée au
//   serveur.
// - Sur Android, depuis le site : lien « intent:// » qui ouvre l'app
//   directement, ou la page d'installation si elle est absente.
import qrcode from "qrcode-generator";

export const APP_PAGE = "https://huntited.com/app/";
export const APP_PACKAGE = "com.huntited.chat";

const valid = (hunt: string, key: string) =>
  /^[0-9a-f]{24}$/.test(hunt) && /^[0-9a-f]{64}$/.test(key);

export function roomLink(hunt: string, key: string): string {
  if (!valid(hunt, key)) throw new Error("invalid_room");
  return `${APP_PAGE}salon#${hunt}.${key}`;
}

export function roomIntent(hunt: string, key: string): string {
  if (!valid(hunt, key)) throw new Error("invalid_room");
  return (
    `intent://salon/${hunt}/${key}#Intent;scheme=huntited;package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(APP_PAGE)};end`
  );
}

/** Page affichée dans l'app Huntited Chat (WebView, pont « HuntitedApp »). */
export const isInApp = () => typeof window !== "undefined" && "HuntitedApp" in window;

export const isAndroid = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** QR code (SVG) d'un texte. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
