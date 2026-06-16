import { describe, it, expect } from "vitest";
import {
  OPTION_TIERS,
  OPTION_COUNT,
  REASONING,
  OWNERSHIP,
} from "@/config/decisions";
import { resolveModel } from "@/lib/reasoning";

describe("Phase 0 design decisions", () => {
  it("offers exactly three fixed option tiers at 40/45/50", () => {
    expect(OPTION_COUNT).toBe(3);
    expect(OPTION_TIERS).toEqual([40, 45, 50]);
  });

  it("uses an active reasoning layer", () => {
    expect(REASONING.mode).toBe("active");
  });

  it("splits ownership: Gary owns BOM quantities, Core owns prices", () => {
    expect(OWNERSHIP.bomQuantities).toBe("gary");
    expect(OWNERSHIP.prices).toBe("core");
  });

  it("defaults the reasoning model when ANTHROPIC_MODEL is unset", () => {
    const original = process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    expect(resolveModel()).toBe(REASONING.defaultModel);
    if (original !== undefined) process.env.ANTHROPIC_MODEL = original;
  });

  it("honours an explicit ANTHROPIC_MODEL override", () => {
    const original = process.env.ANTHROPIC_MODEL;
    process.env.ANTHROPIC_MODEL = "some-other-model";
    expect(resolveModel()).toBe("some-other-model");
    if (original === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = original;
  });
});
