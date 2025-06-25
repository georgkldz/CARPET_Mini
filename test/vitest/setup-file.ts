import { vi } from "vitest";

/* ---------- EIN Singleton für TaskGraphStore ---------- */
const taskGraphStub = { setProperty: vi.fn() };

/**
 * Wichtig: Der String in vi.mock **muss** exakt dem Pfad entsprechen,
 * der in userStore.ts importiert wird.  In deinem Code lautet er
 *   import { useTaskGraphStore } from "stores/taskGraphStore";
 */
vi.mock("stores/taskGraphStore", () => ({
  __esModule: true,
  useTaskGraphStore: () => taskGraphStub,
}));

/* ---------- Automerge-Slim komplett aushebeln ---------- */
vi.mock("@automerge/automerge/slim", () => {
  const fake = {
    initializeWasm: vi.fn().mockResolvedValue(undefined),
    init:           vi.fn(() => ({})),
    change:         vi.fn(<T>(d: T, cb: (x: T)=>void) => { cb(d); return d; }),
    merge:          vi.fn(<T>(a: T) => a),
  };
  return { __esModule: true, default: fake, next: fake };
});
