// Missions d'une chasse (docs/missions.md) : le créateur demande une action,
// chaque membre la prouve, la preuve est vérifiée sans rien publier. Tout
// passe par des messages chiffrés du salon (champ `mission`).
//
// Deux sortes de preuve :
// - « code » : pendant la fenêtre (10 min), le créateur montre un code (QR sur
//   place, dit ou affiché en ligne). Avant, il publie son empreinte ; après, il
//   le révèle. Chaque membre prouve qu'il le connaissait sans le divulguer
//   (HMAC), et tout le monde peut tout vérifier, créateur compris.
// - « pairs » : le membre décrit ce qu'il a fait ; trois autres membres, tirés
//   au sort de façon vérifiable, votent « faite » ou « pas faite ».
// - « lettre » : le créateur rédige une lettre ; chaque membre la signe dans le
//   salon (nom choisi, ou anonyme). La signature est l'action : validée d'office.
// - « X » : retweet ou commentaire d'un post X. Le membre envoie son lien
//   chiffré pour ses trois vérificateurs seulement (tirés au sort, connus
//   d'avance) ; ils votent, puis revérifient à un moment secret pendant le
//   délai de maintien (l'action doit rester en ligne).
// Inspiré des vérificateurs de Ta-da, sans jeton ni argent en jeu.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { ChatMessage } from "./p2p-chat";

export type MissionKind = "code" | "peer" | "sign" | "x";
export type XAction = "retweet" | "reply";

export type MissionMsg =
  | {
      t: "create";
      id: string;
      text: string;
      kind: MissionKind;
      /** X : post visé, action demandée, durée de maintien (ms). */
      target?: string;
      action?: XAction;
      hold?: number;
    }
  | { t: "open"; id: string; hash: string; opensAt: number; closesAt: number }
  | {
      t: "proof";
      id: string;
      mac?: string;
      text?: string;
      signed?: true;
      /** X : lien chiffré pour chaque vérificateur (début de sa clé → chiffré). */
      links?: Record<string, string>;
    }
  | { t: "reveal"; id: string; code: string; seen: string[] }
  | {
      t: "vote";
      id: string;
      proof: string;
      ok: boolean;
      /** X : contrôle de maintien (toujours en ligne ?), pas le premier contrôle. */
      hold?: true;
    };

/** Durées de maintien proposées pour une mission X (jours). */
export const HOLD_DAYS = [1, 3, 7, 30] as const;
/** Un contrôle de maintien n'est pas pris en compte dans les 12 premières heures. */
export const MIN_HOLD_CHECK_MS = 12 * 3_600_000;
/** Temps laissé aux vérificateurs après la fin du délai. */
export const HOLD_GRACE_MS = 3 * 24 * 3_600_000;

const X_POST =
  /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})/;
const X_PROFILE =
  /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/;

/** Lien d'un post X, ramené à https://x.com/<compte>/status/<n> ; null sinon. */
export function xPostUrl(url: string): string | null {
  const m = X_POST.exec(url.trim());
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

/** Lien d'un profil X, ramené à https://x.com/<compte> ; null sinon. */
export function xProfileUrl(url: string): string | null {
  const m = X_PROFILE.exec(url.trim());
  if (!m || ["home", "explore", "search", "i", "settings", "notifications"].includes(m[1]!))
    return null;
  return `https://x.com/${m[1]}`;
}

/** Lien attendu du membre : son profil (retweet) ou son commentaire (réponse). */
export const xProofUrl = (action: XAction, url: string) =>
  action === "retweet" ? xProfileUrl(url) : xPostUrl(url);

export const CODE_WINDOW_MS = 10 * 60_000;
/** Délai accepté après la fermeture (horloges et réseau). */
const GRACE_MS = 2 * 60_000;
export const CHECKERS = 3;
const MAX_TEXT = 500;
/** Lettre collective : texte plus long. */
export const MAX_LETTER = 4000;
const MAX_SIGNATURE = 80;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const HEX = (n: number) => new RegExp(`^[0-9a-f]{${n}}$`);
const str = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;

/** Message de mission bien formé, ou undefined. */
export function cleanMission(m: unknown): MissionMsg | undefined {
  if (!m || typeof m !== "object") return undefined;
  const o = m as Partial<
    Record<
      | "t"
      | "id"
      | "text"
      | "kind"
      | "hash"
      | "opensAt"
      | "closesAt"
      | "mac"
      | "code"
      | "seen"
      | "proof"
      | "ok"
      | "signed"
      | "target"
      | "action"
      | "links"
      | "hold",
      unknown
    >
  >;
  if (typeof o.id !== "string" || !HEX(16).test(o.id)) return undefined;
  const id = o.id;
  switch (o.t) {
    case "create": {
      if (!str(o.text, o.kind === "sign" ? MAX_LETTER : MAX_TEXT)) return undefined;
      const text = (o.text as string).trim();
      if (o.kind === "code" || o.kind === "peer" || o.kind === "sign")
        return { t: "create", id, text, kind: o.kind };
      if (o.kind !== "x") return undefined;
      const target = typeof o.target === "string" ? xPostUrl(o.target) : null;
      const hold = (HOLD_DAYS as readonly number[]).map((d) => d * 24 * 3_600_000);
      if (!target || (o.action !== "retweet" && o.action !== "reply")) return undefined;
      if (typeof o.hold !== "number" || !hold.includes(o.hold)) return undefined;
      return { t: "create", id, text, kind: "x", target, action: o.action, hold: o.hold };
    }
    case "open":
      return typeof o.hash === "string" &&
        HEX(64).test(o.hash) &&
        typeof o.opensAt === "number" &&
        typeof o.closesAt === "number" &&
        o.closesAt > o.opensAt &&
        o.closesAt - o.opensAt <= 60 * 60_000
        ? { t: "open", id, hash: o.hash, opensAt: o.opensAt, closesAt: o.closesAt }
        : undefined;
    case "proof": {
      // Signature : nom affiché sous la lettre (facultatif, sinon anonyme).
      if (o.signed === true) {
        const name = str(o.text, MAX_SIGNATURE) ? (o.text as string).trim() : "";
        return { t: "proof", id, signed: true, ...(name ? { text: name } : {}) };
      }
      // X : un lien chiffré par vérificateur (au plus 3).
      if (o.links !== undefined) {
        if (!o.links || typeof o.links !== "object") return undefined;
        const entries = Object.entries(o.links as Record<string, unknown>);
        const ok =
          entries.length > 0 &&
          entries.length <= CHECKERS &&
          entries.every(
            ([k, v]) =>
              HEX(16).test(k) && typeof v === "string" && /^[A-Za-z0-9+/=]{1,800}$/.test(v),
          );
        return ok
          ? { t: "proof", id, links: Object.fromEntries(entries) as Record<string, string> }
          : undefined;
      }
      const mac = typeof o.mac === "string" && HEX(64).test(o.mac) ? o.mac : undefined;
      const text = str(o.text, MAX_TEXT) ? (o.text as string).trim() : undefined;
      if (!mac && !text) return undefined;
      return { t: "proof", id, ...(mac ? { mac } : {}), ...(text ? { text } : {}) };
    }
    case "reveal": {
      // seen : preuves reçues avant la révélation (16 premiers caractères de leur identifiant).
      const seen = Array.isArray(o.seen) ? o.seen : [];
      if (seen.length > 5000 || !seen.every((x) => typeof x === "string" && HEX(16).test(x)))
        return undefined;
      return typeof o.code === "string" && /^[A-Z0-9]{6}$/.test(o.code)
        ? { t: "reveal", id, code: o.code, seen: seen as string[] }
        : undefined;
    }
    case "vote":
      return typeof o.proof === "string" && HEX(64).test(o.proof) && typeof o.ok === "boolean"
        ? {
            t: "vote",
            id,
            proof: o.proof,
            ok: o.ok,
            ...(o.hold === true ? { hold: true as const } : {}),
          }
        : undefined;
    default:
      return undefined;
  }
}

export const newMissionId = () => bytesToHex(crypto.getRandomValues(new Uint8Array(8)));

/** Code de présence : 6 caractères faciles à lire et à dire (sans 0/O, 1/I/L). */
export function newCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Empreinte publiée avant la fenêtre : engage le créateur sur le code. */
export const codeHash = (id: string, code: string) =>
  bytesToHex(sha256(utf8ToBytes(`huntited-mission|${id}|${code}`)));

/** Preuve d'un membre : il connaît le code, sans le révéler aux autres. */
export const codeProof = (code: string, id: string, memberPub: string) =>
  bytesToHex(hmac(sha256, utf8ToBytes(code), utf8ToBytes(`huntited-proof|${id}|${memberPub}`)));

/** Vérificateurs d'une preuve : tirage vérifiable par tous (empreinte de la preuve). */
export function checkersOf(proofId: string, author: string, members: string[]): string[] {
  return members
    .filter((m) => m !== author)
    .map((m) => ({ m, k: bytesToHex(sha256(utf8ToBytes(`${proofId}|${m}`))) }))
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .slice(0, CHECKERS)
    .map((x) => x.m);
}

/** X : vérificateurs d'un membre, connus d'avance (le lien leur est chiffré avant l'envoi). */
export const xCheckersOf = (missionId: string, author: string, members: string[]) =>
  checkersOf(`x|${missionId}|${author}`, author, members);

export type ProofStatus = "valid" | "invalid" | "pending";

export interface MissionProof {
  /** Message de preuve (identifiant de l'événement). */
  msgId: string;
  author: string;
  at: number;
  text?: string;
  /** Code : preuve de connaissance du code. */
  mac?: string;
  /** Lettre : signature. */
  signed?: true;
  status: ProofStatus;
  /** Pairs : vérificateurs tirés au sort, et leurs votes. */
  checkers: string[];
  votes: Record<string, boolean>;
  /** X : lien chiffré pour chaque vérificateur. */
  links?: Record<string, string>;
  /** X : votes du contrôle de maintien, et son résultat. */
  holdVotes: Record<string, boolean>;
  held?: "confirmed" | "removed";
}

export interface Mission {
  id: string;
  text: string;
  kind: MissionKind;
  createdAt: number;
  /** Code : fenêtre ouverte par le créateur, et code révélé (vérifié contre l'empreinte). */
  window?: { hash: string; opensAt: number; closesAt: number };
  revealed?: string;
  /** Preuves reçues par le créateur avant la révélation : seules celles-ci comptent. */
  seen?: Set<string>;
  /** Révélation qui ne correspond pas à l'empreinte : le créateur a triché. */
  badReveal: boolean;
  proofs: MissionProof[];
  /** X : post visé, action demandée, durée de maintien (ms). */
  target?: string;
  action?: XAction;
  hold?: number;
}

/** Missions d'un salon, reconstruites à partir de ses messages (dans l'ordre). */
export function missionsOf(
  messages: ChatMessage[],
  creator: string | undefined,
  members: string[],
): Mission[] {
  const sorted = [...messages].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const byId = new Map<string, Mission>();
  const proofs = new Map<string, Map<string, MissionProof>>(); // mission → auteur → preuve
  const votes: { m: ChatMessage; v: Extract<MissionMsg, { t: "vote" }> }[] = [];

  for (const m of sorted) {
    const x = m.mission;
    if (!x || !members.includes(m.author)) continue;
    const fromCreator = m.author === creator;
    if (x.t === "create" && fromCreator && !byId.has(x.id)) {
      byId.set(x.id, {
        id: x.id,
        text: x.text,
        kind: x.kind,
        createdAt: m.at,
        badReveal: false,
        proofs: [],
        ...(x.target ? { target: x.target } : {}),
        ...(x.action ? { action: x.action } : {}),
        ...(x.hold ? { hold: x.hold } : {}),
      });
      continue;
    }
    const mission = byId.get(x.id);
    if (!mission) continue;
    if (x.t === "open" && fromCreator && mission.kind === "code" && !mission.window) {
      mission.window = { hash: x.hash, opensAt: x.opensAt, closesAt: x.closesAt };
    } else if (x.t === "reveal" && fromCreator && mission.window && !mission.revealed) {
      if (codeHash(mission.id, x.code) === mission.window.hash) {
        mission.revealed = x.code;
        mission.seen = new Set(x.seen);
      } else mission.badReveal = true;
    } else if (x.t === "proof") {
      const list = proofs.get(mission.id) ?? new Map<string, MissionProof>();
      // Code et lettre : la première preuve compte ; pairs : la dernière remplace.
      if (mission.kind !== "peer" && list.has(m.author)) continue;
      list.set(m.author, {
        msgId: m.id,
        author: m.author,
        at: m.at,
        ...(x.text ? { text: x.text } : {}),
        status: "pending",
        checkers:
          mission.kind === "peer"
            ? checkersOf(m.id, m.author, members)
            : mission.kind === "x"
              ? xCheckersOf(mission.id, m.author, members)
              : [],
        votes: {},
        holdVotes: {},
        ...(x.links ? { links: x.links } : {}),
        ...(x.mac ? { mac: x.mac } : {}),
        ...(x.signed ? { signed: true as const } : {}),
      });
      proofs.set(mission.id, list);
    } else if (x.t === "vote") {
      votes.push({ m, v: x });
    }
  }

  // Votes : seulement les vérificateurs tirés pour cette preuve (le dernier vote compte).
  for (const { m, v } of votes) {
    const list = proofs.get(v.id);
    const p = list && [...list.values()].find((q) => q.msgId === v.proof);
    if (!p || !p.checkers.includes(m.author)) continue;
    if (!v.hold) {
      p.votes[m.author] = v.ok;
      continue;
    }
    // Maintien : seulement pendant le délai (après les 12 premières heures), plus la marge.
    const mission = byId.get(v.id);
    const hold = mission?.hold ?? 0;
    if (m.at >= p.at + MIN_HOLD_CHECK_MS && m.at <= p.at + hold + HOLD_GRACE_MS)
      p.holdVotes[m.author] = v.ok;
  }

  for (const mission of byId.values()) {
    const list = [...(proofs.get(mission.id)?.values() ?? [])];
    for (const p of list) {
      p.status = statusOf(mission, p);
      if (mission.kind === "x" && p.status === "valid") {
        const held = majority(p.holdVotes, p.checkers);
        if (held !== "pending") p.held = held === "valid" ? "confirmed" : "removed";
      }
    }
    mission.proofs = list;
  }
  return [...byId.values()];
}

/** Identifiant court d'une preuve (liste « seen » de la révélation). */
export const shortId = (msgId: string) => msgId.slice(0, 16);

function statusOf(mission: Mission, p: MissionProof): ProofStatus {
  if (mission.kind === "sign") return p.signed ? "valid" : "invalid";
  if (mission.kind === "code") {
    if (!mission.window || !mission.revealed || !p.mac)
      return mission.badReveal ? "invalid" : "pending";
    const inTime =
      p.at >= mission.window.opensAt - GRACE_MS && p.at <= mission.window.closesAt + GRACE_MS;
    const received = mission.seen?.has(shortId(p.msgId)) ?? false;
    return inTime && received && p.mac === codeProof(mission.revealed, mission.id, p.author)
      ? "valid"
      : "invalid";
  }
  if (mission.kind === "x" && !p.links) return "invalid";
  return majority(p.votes, p.checkers);
}

/** Décision des vérificateurs : la majorité (de ceux qui existent, s'il y en a moins de 3). */
function majority(votes: Record<string, boolean>, checkers: string[]): ProofStatus {
  const yes = Object.values(votes).filter(Boolean).length;
  const no = Object.values(votes).length - yes;
  const needed = Math.min(Math.floor(CHECKERS / 2) + 1, Math.floor(checkers.length / 2) + 1);
  if (checkers.length === 0) return "pending";
  if (yes >= needed) return "valid";
  if (no >= needed) return "invalid";
  return "pending";
}

/** Lettre signée, prête à envoyer : le texte, puis les signataires (dans l'ordre). */
export function signedLetter(mission: Mission, anonymous: string, header: string): string {
  const names = mission.proofs.filter((p) => p.status === "valid").map((p) => p.text ?? anonymous);
  return [mission.text, "", header, ...names.map((n) => `- ${n}`)].join("\n");
}

/** Membres dont la mission est validée (au moins une mission du salon, action X non retirée). */
export function validatedMembers(missions: Mission[]): Set<string> {
  return new Set(
    missions.flatMap((m) =>
      m.proofs.filter((p) => p.status === "valid" && p.held !== "removed").map((p) => p.author),
    ),
  );
}

/**
 * X : moment secret du contrôle de maintien, tiré par chaque vérificateur et
 * gardé sur son appareil. `random` dans [0, 1).
 */
export const holdCheckAt = (proofAt: number, hold: number, random: number) =>
  proofAt + MIN_HOLD_CHECK_MS + Math.floor(random * Math.max(0, hold - MIN_HOLD_CHECK_MS));

/** Fiabilité d'un vérificateur : votes conformes à la décision finale. */
export function checkerRecord(
  missions: Mission[],
  member: string,
): { agree: number; total: number } {
  let agree = 0;
  let total = 0;
  for (const m of missions)
    for (const p of m.proofs) {
      if (p.status === "pending" || !(member in p.votes)) continue;
      total++;
      if (p.votes[member] === (p.status === "valid")) agree++;
    }
  return { agree, total };
}
