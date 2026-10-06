import { describe, expect, it } from "vitest";

import { huntReplyText, parseTweetId, xReplyIntentUrl } from "./share";

describe("parseTweetId", () => {
  it("reconnaît les adresses de tweet x.com et twitter.com", () => {
    expect(parseTweetId("https://x.com/nom/status/1234567890")).toBe("1234567890");
    expect(parseTweetId(" https://twitter.com/nom_2/status/42?s=20 ")).toBe("42");
    expect(parseTweetId("https://mobile.twitter.com/nom/status/42/photo/1")).toBe("42");
    expect(parseTweetId("https://www.x.com/nom/statuses/7")).toBe("7");
  });

  it("refuse tout le reste", () => {
    for (const bad of [
      "",
      "pas une adresse",
      "https://x.com/nom",
      "https://x.com/nom/status/abc",
      "https://evil.com/nom/status/1",
      "https://x.com.evil.com/nom/status/1",
      "javascript:alert(1)",
    ]) {
      expect(parseTweetId(bad)).toBeNull();
    }
  });
});

describe("xReplyIntentUrl", () => {
  it("ouvre une réponse préremplie au tweet, avec le lien de la chasse", () => {
    const text = huntReplyText({ title: "Rassemblement & co", threshold: 7 });
    const u = new URL(xReplyIntentUrl("42", text, "https://huntited.test/hunt/h1"));
    expect(u.origin + u.pathname).toBe("https://x.com/intent/tweet");
    expect(u.searchParams.get("in_reply_to")).toBe("42");
    expect(u.searchParams.get("url")).toBe("https://huntited.test/hunt/h1");
    expect(u.searchParams.get("text")).toContain("« Rassemblement & co »");
    expect(u.searchParams.get("text")).toContain("au moins 7 personnes");
  });
});
