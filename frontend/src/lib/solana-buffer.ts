import { Buffer } from "buffer/";

export function installSolanaBuffer() {
  if (typeof globalThis.Buffer !== "undefined") return;
  Object.defineProperty(globalThis, "Buffer", {
    configurable: true,
    value: Buffer,
    writable: true,
  });
}
