import { describe, expect, it } from "vitest";

import {
  MAX_LETTER,
  checkerRecord,
  checkersOf,
  cleanMission,
  codeHash,
  codeProof,
  missionsOf,
  newCode,
  newMissionId,
  shortId,
  signedLetter,
  validatedMembers,
  type MissionMsg,
} from "./missions";
import type { ChatMessage } from "./p2p-chat";

const CREATOR = "c".repeat(64);
const A = "a".repeat(64);
const B = "b".repeat(64);
const D = "d".repeat(64);
const E = "e".repeat(64);
const MEMBERS = [CREATOR, A, B, D, E];
let n = 0;
const msg = (author: string, at: number, mission: MissionMsg): ChatMessage => ({
  id: (++n).toString(16).padStart(64, "0"),
  author,
  text: "",
  at,
  mission,
});

describe("missions", () => {
  it("refuse les messages mal formés", () => {
    expect(cleanMission({ t: "create", id: "zz", text: "x", kind: "code" })).toBeUndefined();
    expect(cleanMission({ t: "proof", id: "0".repeat(16) })).toBeUndefined();
    expect(cleanMission({ t: "reveal", id: "0".repeat(16), code: "abc" })).toBeUndefined();
    expect(newCode()).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("seul le créateur crée une mission", () => {
    const id = newMissionId();
    const ms = missionsOf(
      [msg(A, 1, { t: "create", id, text: "x", kind: "peer" })],
      CREATOR,
      MEMBERS,
    );
    expect(ms).toHaveLength(0);
  });

  describe("code de présence", () => {
    const id = newMissionId();
    const code = "K7M2QX";
    const opensAt = 1_000_000;
    const closesAt = opensAt + 600_000;
    const create = msg(CREATOR, 0, { t: "create", id, text: "Rassemblement 18 h", kind: "code" });
    const open = msg(CREATOR, opensAt, {
      t: "open",
      id,
      hash: codeHash(id, code),
      opensAt,
      closesAt,
    });

    it("valide les membres qui connaissaient le code pendant la fenêtre", () => {
      const pa = msg(A, opensAt + 60_000, { t: "proof", id, mac: codeProof(code, id, A) });
      const pb = msg(B, opensAt + 90_000, { t: "proof", id, mac: codeProof("WRONG1", id, B) });
      const reveal = msg(CREATOR, closesAt + 1, {
        t: "reveal",
        id,
        code,
        seen: [shortId(pa.id), shortId(pb.id)],
      });
      const [m] = missionsOf([create, open, pa, pb, reveal], CREATOR, MEMBERS);
      expect(m!.revealed).toBe(code);
      expect(m!.proofs.find((p) => p.author === A)!.status).toBe("valid");
      expect(m!.proofs.find((p) => p.author === B)!.status).toBe("invalid");
      expect(validatedMembers([m!])).toEqual(new Set([A]));
    });

    it("avant la révélation : en attente ; preuve sans le code : rien n'est divulgué", () => {
      const pa = msg(A, opensAt + 60_000, { t: "proof", id, mac: codeProof(code, id, A) });
      const [m] = missionsOf([create, open, pa], CREATOR, MEMBERS);
      expect(m!.proofs[0]!.status).toBe("pending");
      expect(JSON.stringify(pa)).not.toContain(code);
    });

    it("une preuve envoyée après la révélation (antidatée) ne compte pas", () => {
      const reveal = msg(CREATOR, closesAt + 1, { t: "reveal", id, code, seen: [] });
      // Un tricheur qui a lu le code révélé, et antidate sa preuve.
      const late = msg(D, opensAt + 30_000, { t: "proof", id, mac: codeProof(code, id, D) });
      const [m] = missionsOf([create, open, reveal, late], CREATOR, MEMBERS);
      expect(m!.proofs[0]!.status).toBe("invalid");
    });

    it("le créateur ne peut pas changer de code après coup", () => {
      const reveal = msg(CREATOR, closesAt + 1, { t: "reveal", id, code: "OTHER2", seen: [] });
      const [m] = missionsOf([create, open, reveal], CREATOR, MEMBERS);
      expect(m!.revealed).toBeUndefined();
      expect(m!.badReveal).toBe(true);
    });
  });

  describe("vérification par les pairs", () => {
    const id = newMissionId();
    const create = msg(CREATOR, 0, { t: "create", id, text: "Écrire au maire", kind: "peer" });

    it("trois vérificateurs tirés au sort, pareils pour tout le monde, jamais l'auteur", () => {
      const c = checkersOf("f".repeat(64), A, MEMBERS);
      expect(c).toHaveLength(3);
      expect(c).not.toContain(A);
      expect(checkersOf("f".repeat(64), A, [...MEMBERS].reverse())).toEqual(c);
    });

    it("la majorité des vérificateurs décide ; les autres votes ne comptent pas", () => {
      const proof = msg(A, 10, { t: "proof", id, text: "Lettre envoyée ce matin" });
      const [c1, c2, c3] = checkersOf(proof.id, A, MEMBERS);
      const outsider = MEMBERS.find((m) => m !== A && ![c1, c2, c3].includes(m))!;
      const votes = [
        msg(outsider, 11, { t: "vote", id, proof: proof.id, ok: false }),
        msg(c1!, 12, { t: "vote", id, proof: proof.id, ok: true }),
      ];
      let [m] = missionsOf([create, proof, ...votes], CREATOR, MEMBERS);
      expect(m!.proofs[0]!.status).toBe("pending");
      const yes = msg(c2!, 13, { t: "vote", id, proof: proof.id, ok: true });
      const no = msg(c3!, 14, { t: "vote", id, proof: proof.id, ok: false });
      [m] = missionsOf([create, proof, ...votes, yes, no], CREATOR, MEMBERS);
      expect(m!.proofs[0]!.status).toBe("valid");
      expect(checkerRecord([m!], c1!)).toEqual({ agree: 1, total: 1 });
      expect(checkerRecord([m!], c3!)).toEqual({ agree: 0, total: 1 });
    });
  });

  describe("lettre collective", () => {
    const id = newMissionId();
    const letter = "Madame la Maire,\n\nNous demandons un banc.";
    const create = msg(CREATOR, 0, { t: "create", id, text: letter, kind: "sign" });

    it("signer valide d'office ; une seule signature par membre ; la lettre liste les signataires", () => {
      const ms = missionsOf(
        [
          create,
          msg(A, 1, { t: "proof", id, signed: true, text: "Alice, Lyon" }),
          msg(B, 2, { t: "proof", id, signed: true }),
          msg(A, 3, { t: "proof", id, signed: true, text: "Autre nom" }),
          msg(D, 4, { t: "proof", id, text: "pas une signature" }),
        ],
        CREATOR,
        MEMBERS,
      );
      const m = ms[0]!;
      expect(validatedMembers(ms)).toEqual(new Set([A, B]));
      expect(signedLetter(m, "Anonyme", "Signataires (2) :")).toBe(
        `${letter}\n\nSignataires (2) :\n- Alice, Lyon\n- Anonyme`,
      );
    });

    it("accepte une lettre longue, pas les autres missions", () => {
      const long = "x".repeat(MAX_LETTER);
      expect(cleanMission({ t: "create", id, text: long, kind: "sign" })).toBeDefined();
      expect(cleanMission({ t: "create", id, text: long, kind: "peer" })).toBeUndefined();
      expect(cleanMission({ t: "proof", id, signed: true })).toEqual({
        t: "proof",
        id,
        signed: true,
      });
    });
  });
});
