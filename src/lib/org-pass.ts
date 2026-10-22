// Pass d'organisation (docs/pass-groupe.md) : un syndicat, une association
// ou un collectif donne à chaque adhérent un lien personnel permanent, puis
// ouvre des chasses à ses adhérents. Ils s'engagent sans wallet ni KAS ; la
// chaîne voit l'organisation, jamais l'adhérent.
//
// Pour chaque chasse, la place d'un adhérent est une clé dérivée de son
// secret et de la chasse : on ne peut pas relier ses engagements d'une chasse
// à l'autre. L'organisation, qui connaît les secrets, inscrit d'un coup les
// places de tous ses adhérents pour une chasse (message `places`), puis les
// engagements reçus par lots (`gcommit`), comme pour le pass de groupe.
import { schnorr } from "@noble/curves/secp256k1.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import type { Group } from "./group-pass";
import { chatPublicKey } from "./p2p-chat";

const STORAGE = "huntited:orgs";
const MAX_MEMBERS = 2000;

export interface OrgMember {
  /** Secret de l'adhérent (hex) : sa clé de place pour chaque chasse en dérive. */
  secret: string;
  /** Repère local (« adhérent 12 »), jamais publié. */
  label: string;
  addedAt: number;
}

export interface Org {
  id: string;
  /** Nom local (jamais publié). */
  name: string;
  /** Clé de la boîte de réception des demandes (hex). */
  inbox: string;
  members: OrgMember[];
  /** Chasses ouvertes aux adhérents. */
  hunts: { hunt: string; title: string }[];
  createdAt: number;
}

const newSecret = () => bytesToHex(schnorr.utils.randomSecretKey());

/** Clé de place d'un adhérent pour une chasse (privée, hex). */
export function memberPlaceKey(secret: string, hunt: string): string {
  for (let i = 0; ; i++) {
    const k = bytesToHex(
      hkdf(
        sha256,
        hexToBytes(secret),
        undefined,
        utf8ToBytes(`huntited-org-place-v1:${hunt}:${i}`),
        32,
      ),
    );
    try {
      schnorr.getPublicKey(hexToBytes(k)); // clé valide (presque toujours au premier essai)
      return k;
    } catch {
      /* hors de la courbe : essai suivant */
    }
  }
}

export function orgs(): Org[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as unknown;
    return Array.isArray(raw)
      ? (raw as Org[]).filter((o) => o && typeof o.id === "string" && Array.isArray(o.members))
      : [];
  } catch {
    return [];
  }
}

function save(all: Org[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(all));
}

export function updateOrg(org: Org): Org {
  save([org, ...orgs().filter((o) => o.id !== org.id)]);
  return org;
}

export function createOrg(name: string, members: number): Org {
  const org: Org = {
    id: newSecret().slice(0, 16),
    name: name.trim().slice(0, 80) || "Organisation",
    inbox: newSecret(),
    members: [],
    hunts: [],
    createdAt: Date.now(),
  };
  return addMembers(org, members);
}

export function addMembers(org: Org, count: number): Org {
  const n = Math.max(0, Math.min(MAX_MEMBERS - org.members.length, Math.floor(count)));
  const start = org.members.length;
  const added = Array.from({ length: n }, (_, i) => ({
    secret: newSecret(),
    label: `#${start + i + 1}`,
    addedAt: Date.now(),
  }));
  return updateOrg({ ...org, members: [...org.members, ...added] });
}

export function openHunt(org: Org, hunt: string, title: string): Org {
  if (org.hunts.some((h) => h.hunt === hunt)) return org;
  return updateOrg({ ...org, hunts: [{ hunt, title }, ...org.hunts] });
}

/** Vue « pass de groupe » d'une chasse : les places des adhérents pour cette chasse. */
export function orgGroup(org: Org, hunt: string, title = ""): Group {
  return {
    hunt,
    title,
    inbox: org.inbox,
    places: org.members.map((m) => memberPlaceKey(m.secret, hunt)),
    createdAt: org.createdAt,
  };
}

/** Lien personnel permanent d'un adhérent. */
export function memberLink(base: string, org: Org, m: OrgMember): string {
  return `${base}#/member/${chatPublicKey(org.inbox)}/${m.secret}`;
}

export const exportOrg = (o: Org) => JSON.stringify({ format: "huntited-org-v1", ...o }, null, 2);

export function importOrg(text: string): Org | null {
  try {
    const o = JSON.parse(text) as Org & { format?: string };
    if (
      o.format !== "huntited-org-v1" ||
      typeof o.inbox !== "string" ||
      !Array.isArray(o.members)
    ) {
      return null;
    }
    const { format: _f, ...org } = o;
    return updateOrg(org);
  } catch {
    return null;
  }
}
