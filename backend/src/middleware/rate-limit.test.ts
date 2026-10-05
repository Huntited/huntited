import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { rateLimit } from "./rate-limit.js";

function call(mw: ReturnType<typeof rateLimit>, ip: string) {
  const next = vi.fn() as unknown as NextFunction;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as unknown as Response;
  mw({ ip } as Request, res, next);
  return { next, res };
}

describe("rateLimit", () => {
  it("bloque au-delà du maximum puis repart à la fenêtre suivante", () => {
    let now = 0;
    const mw = rateLimit({ windowMs: 1000, max: 2, now: () => now });
    expect(call(mw, "1.1.1.1").next).toHaveBeenCalled();
    expect(call(mw, "1.1.1.1").next).toHaveBeenCalled();
    const blocked = call(mw, "1.1.1.1");
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    // Une autre IP n'est pas affectée.
    expect(call(mw, "2.2.2.2").next).toHaveBeenCalled();
    now = 1000;
    expect(call(mw, "1.1.1.1").next).toHaveBeenCalled();
  });
});
