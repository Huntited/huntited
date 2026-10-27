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
// Inspiré des vérificateurs de Ta-da, sans jeton ni argent en jeu.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { ChatMessage } from "./p2p-chat";

export type MissionKind = "code" | "peer";

export type MissionMsg =
  | { t: "create"; id: string; text: string; kind: MissionKind }
  | { t: "open"; id: string; hash: string; opensAt: number; closesAt: number }
  | { t: "proof"; id: string; mac?: string; text?: string }
  | { t: "reveal"; id: string; code: string; seen: string[] }
  | { t: "vote"; id: string; proof: string; ok: boolean };

export const CODE_WINDOW_MS = 10 * 60_000;
/** Délai accepté après la fermeture (horloges et réseau). */
const GRACE_MS = 2 * 60_000;
export const CHECKERS = 3;
const MAX_TEXT = 500;
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
      | "ok",
      unknown
    >
  >;
  if (typeof o.id !== "string" || !HEX(16).test(o.id)) return undefined;
  const id = o.id;
  switch (o.t) {
    case "create":
      return str(o.text, MAX_TEXT) && (o.kind === "code" || o.kind === "peer")
        ? { t: "create", id, text: (o.text as string).trim(), kind: o.kind }
        : undefined;
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
        ? { t: "vote", id, proof: o.proof, ok: o.ok }
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

export type ProofStatus = "valid" | "invalid" | "pending";

export interface MissionProof {
  /** Message de preuve (identifiant de l'événement). */
  msgId: string;
  author: string;
  at: number;
  text?: string;
  /** Code : preuve de connaissance du code. */
  mac?: string;
  status: ProofStatus;
  /** Pairs : vérificateurs tirés au sort, et leurs votes. */
  checkers: string[];
  votes: Record<string, boolean>;
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
      // Code : la première preuve compte ; pairs : la dernière remplace.
      if (mission.kind === "code" && list.has(m.author)) continue;
      list.set(m.author, {
        msgId: m.id,
        author: m.author,
        at: m.at,
        ...(x.text ? { text: x.text } : {}),
        status: "pending",
        checkers: mission.kind === "peer" ? checkersOf(m.id, m.author, members) : [],
        votes: {},
        ...(x.mac ? { mac: x.mac } : {}),
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
    if (p && p.checkers.includes(m.author)) p.votes[m.author] = v.ok;
  }

  for (const mission of byId.values()) {
    const list = [...(proofs.get(mission.id)?.values() ?? [])];
    for (const p of list) p.status = statusOf(mission, p);
    mission.proofs = list;
  }
  return [...byId.values()];
}

/** Identifiant court d'une preuve (liste « seen » de la révélation). */
export const shortId = (msgId: string) => msgId.slice(0, 16);

function statusOf(mission: Mission, p: MissionProof): ProofStatus {
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
  const yes = Object.values(p.votes).filter(Boolean).length;
  const no = Object.values(p.votes).length - yes;
  const majority = Math.floor(CHECKERS / 2) + 1;
  // Moins de membres que de vérificateurs : la majorité de ceux qui existent.
  const needed = Math.min(majority, Math.floor(p.checkers.length / 2) + 1);
  if (p.checkers.length === 0) return "pending";
  if (yes >= needed) return "valid";
  if (no >= needed) return "invalid";
  return "pending";
}

/** Membres dont la mission est validée (au moins une mission du salon). */
export function validatedMembers(missions: Mission[]): Set<string> {
  return new Set(
    missions.flatMap((m) => m.proofs.filter((p) => p.status === "valid").map((p) => p.author)),
  );
}

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
