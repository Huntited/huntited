import { describe, expect, it } from "vitest";

import { invitationFromLocation } from "./pass";

describe("lien d'invitation au pass", () => {
  it("version statique : « #/pass » est la page, pas un code", () => {
    expect(invitationFromLocation({ pathname: "/", hash: "#/pass" })).toBeNull();
    expect(invitationFromLocation({ pathname: "/", hash: "#/pass#abc123" })).toEqual({
      code: "abc123",
      cleanUrl: "/#/pass",
    });
  });

  it("version avec serveur : le code suit directement « # »", () => {
    expect(invitationFromLocation({ pathname: "/pass", hash: "" })).toBeNull();
    expect(invitationFromLocation({ pathname: "/pass", hash: "#abc123" })).toEqual({
      code: "abc123",
      cleanUrl: "/pass",
    });
  });
});
