import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import axios from "axios";
import { useTaskGraphStore} from "../../../../src/stores/taskGraphStore";
import { useUserStore} from "../../../../src/stores/userStore";
import { joinCollaboration} from "../../../../src/services/collaborationService";
import { useCollaborationStore} from "../../../../src/stores/collaborationStore";

// --- axios-Stub (Proficiency-Upload & /grouping/status)
vi.mock("axios", () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),               // /grouping/proficiency
    get : vi.fn().mockResolvedValue({                  // /grouping/status
      data: {
        groups: [
          {
            groupId: 99,
            taskId : 42,
            size   : 2,
            memberIds: [1, 2],
            members: [
              { userId: 1, collabRoleId: 0, nickname: "A" },
              { userId: 2, collabRoleId: 1, nickname: "B" },
            ],
          },
        ],
      },
    }),
  },
}));

// --- Mock EventSource (SSE)

const EventSourceMock = vi        // Konstruktor selbst ist vi.fn() ⇒ mock.instances vorhanden
  .fn()
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  .mockImplementation(function (this: any, url: string) {
    this.url = url;
    this.onmessage = null;
    this.onerror   = null;
    this.close     = vi.fn();
    this.emit = (payload: unknown) => {
      // nur auslösen, wenn ein onmessage-Handler gesetzt ist …
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify(payload) } as MessageEvent);
      }
    };
  });

vi.stubGlobal("EventSource", EventSourceMock as unknown as typeof EventSource);


// --- Store-Initialisierung
function initStores() {
  setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }));
  const task = useTaskGraphStore();
  const user = useUserStore();
  task.setCurrentTask("Steckbriefaufgabe");
  task.setProperty({ path: "$.taskData.taskId", value: 42 });
  user.currentUser = { userId: 1, email: "demo@mail.com", role: 0 };
  // Hinterlege bereits gespeicherte Proficiency
  user.setProficiency({ taskId: 42, score: 6 });


}

describe("Collaboration-Flow", () => {
  beforeEach(initStores);

  it("setzt groupId & roleId nach SSE-Event", async () => {
    await joinCollaboration();
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const es = (EventSourceMock as any).mock.instances[0];
    es.emit({
      groupId  : 99,
      taskId   : 42,
      size     : 2,
      memberIds: [1, 2],
      members  : [
        { userId: 1, collabRoleId: 0, nickname: "A" },
        { userId: 2, collabRoleId: 1, nickname: "B" },
      ],
    });
    await Promise.resolve();

    const collab = useCollaborationStore();
    const task   = useTaskGraphStore();
    expect(collab.groupId).toBe(99);
    expect(task.myCollabRoleId).toBe(0);
    expect(axios.post).toHaveBeenCalledOnce();
  });
});
