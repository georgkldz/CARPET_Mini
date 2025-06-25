// test/vitest/__tests__/stores/taskGraphStore.spec.ts
import { setActivePinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { TaskGraphState, useTaskGraphStore } from "../../../../src/stores/taskGraphStore";
import type { StoreSetterPayload } from "carpet-component-library";

function isSetterPayload(arg: unknown): arg is StoreSetterPayload {
  return typeof arg === "object" && arg !== null && "path" in arg && "value" in arg;
}

function mockCommentStore() {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  let current: any = null;           // “Speicher” im Stub

  return {
    __esModule: true,
    useCommentStore: () => ({
      get currentSessionDetails() {
        return current;
      },
      fetchSessionDetails: vi.fn(async (id: number) => {
        // Simuliertes Backend-Objekt
        current = {
          sessionId: id,
          taskId: 99,
          timestamp: "",
          collaborationNodes: { "2": { dummy: "node" } },
          taskData: { foo: "bar" },
        };
        return current;              // exakt wie das Original
      }),
    }),
  };
}

/* ───── globale Mocks ─────────────────────────────────────────────── */
vi.mock("axios");

/* Evaluation-Service für submitForEvaluation */
vi.mock("../../../../src/services/evaluationService", () => ({
  postEvaluation: vi.fn().mockResolvedValue(undefined),
}));

/* Automerge-Sync – nur die Funktion, die setProperty aufruft */
vi.mock("stores/sync/automergeSync", () => ({
  syncSingleComponentChange: vi.fn(),
}));

/* Comment-Store für loadSessionForCommentMode */
vi.mock("stores/commentStore", mockCommentStore);
vi.mock("../../../../src/stores/commentStore", mockCommentStore);

/* ───── Test-Suite ────────────────────────────────────────────────── */
describe("taskGraphStore – eigene Methoden", () => {
  let store: ReturnType<typeof useTaskGraphStore>;

  beforeEach(() => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
    setActivePinia(pinia);
    store = useTaskGraphStore();
    vi.clearAllMocks();

    /* Minimal-State: documentReady + zwei Knoten (single & collab) */
    store.$patch(state => {
      state.myCollabRoleId = 0;

      // Minimaler Graph für Tests
      state.nodes = {
        0: {
          collaboration: { mode: "single", transferToCollab: ["fieldValue"] },
          components: {
            c1: {
              nestedComponents: {
                formComponents: {
                  input1: {
                    componentConfiguration: { isCommentable: true },
                    state: { fieldValue: "foo" },
                  },
                },
              },
            },
          },
        },
        2: {
          collaboration: { mode: "collaboration" },
          components: {
            c1: {
              nestedComponents: { formComponents: {} },
            },
          },
        },
      } as unknown as TaskGraphState["nodes"]; // einmalig grob casten
    });
  });

  /* -------------------------------------------------------------- */
  it("getCurrentCollaborationMode liefert 'single' bzw. 'collaboration'", () => {
    store.currentNode = 0;
    expect(store.getCurrentCollaborationMode).toBe("single");
    store.currentNode = 2;
    expect(store.getCurrentCollaborationMode).toBe("collaboration");
  });

  /* -------------------------------------------------------------- */
  it("transferStateValuesToCollab kopiert fieldValue in Ziel-Komponente", async () => {
    const spy = vi.spyOn(store, "setProperty");
    await store.transferStateValuesToCollab();

    // erwarteter Ziel-Pfad
    const dstPath =
      "$.nodes.2.components.c1.nestedComponents.formComponents.r0_input1.state.fieldValue";
    expect(
      spy.mock.calls.some(
        ([arg]) => isSetterPayload(arg) && arg.path === dstPath && arg.value === "foo",
      ),
    ).toBe(true);
  });

  /* -------------------------------------------------------------- */
  it("submitForEvaluation gibt true bei erfolgreichem Service-Aufruf", async () => {
    const ok = await store.submitForEvaluation();
    expect(ok).toBe(true);
  });

  /* -------------------------------------------------------------- */
  it("extractSessionData sammelt alle collab-Nodes und taskData", () => {
    const res = store.extractSessionData();
    expect(Object.keys(res.collaborationNodes)).toEqual(["2"]);
    expect(res.taskData).toEqual({});
  });

  /* -------------------------------------------------------------- */
  it("loadSessionForCommentMode trägt Session-Daten ein und schaltet readonly", async () => {
    const spy = vi.spyOn(store, "setProperty");
    const done = await store.loadSessionForCommentMode(7);
    expect(done).toBe(true);
    // eine exemplarische Prüfung: currentNode gesetzt?
    expect(
      spy.mock.calls.some(
        ([arg]) => isSetterPayload(arg) && arg.path === "$.currentNode" && arg.value === 2,
      ),
    ).toBe(true);
    expect(store.isCommentMode).toBe(true);
  });

  /* -------------------------------------------------------------- */
  it("clearSinglePhaseValues setzt fieldValue im Single-Node auf ''", async () => {
    const spy = vi.spyOn(store, "setProperty");
    await store.clearSinglePhaseValues();
    expect(
      spy.mock.calls.some(
        ([arg]) =>
          isSetterPayload(arg) && arg.path.endsWith(".input1.state.fieldValue") &&
          arg.value === "",
      ),
    ).toBe(true);
  });

  /* -------------------------------------------------------------- */
  it("resetValuesByPath setzt alle angegebenen Pfade auf leeren String", () => {
    const spy = vi.spyOn(store, "setProperty");
    store.resetValuesByPath([
      "$.nodes.0.components.c1.nestedComponents.formComponents.input1.state.fieldValue",
    ]);
    expect(
      spy.mock.calls[0][0],
    ).toEqual({
      path: "$.nodes.0.components.c1.nestedComponents.formComponents.input1.state.fieldValue",
      value: "",
    });
  });
});
