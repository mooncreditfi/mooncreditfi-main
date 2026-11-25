import { Buffer as BrowserBuffer } from "buffer/";
import { afterEach, describe, expect, it } from "vitest";
import { installSolanaBuffer } from "@/lib/solana-buffer";

const originalBuffer = globalThis.Buffer;

afterEach(() => {
  Object.defineProperty(globalThis, "Buffer", {
    configurable: true,
    value: originalBuffer,
    writable: true,
  });
});

describe("Solana Buffer polyfill", () => {
  it("installs Buffer when the runtime has none", () => {
    Object.defineProperty(globalThis, "Buffer", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    installSolanaBuffer();

    expect(globalThis.Buffer).toBe(BrowserBuffer);
    expect(globalThis.Buffer.from("solana").toString()).toBe("solana");
  });
});
