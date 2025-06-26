/*
 * Integration test for the **commenting flow** that spans
 * `commentStore` ↔ `taskGraphStore`.
 *
 * Folder suggestion: `test/vitest/__tests__/integration/commentFlow.spec.ts`
 *
 * WHAT IS COVERED
 * 1. Loading a collaboration session in *comment mode* via
 *    `taskGraphStore.loadSessionForCommentMode()`.
 * 2. Fetching existing comments + lazy‑loading nicknames with
 *    `commentStore.fetchCommentsForSession()`.
 * 3. Persisting a new comment with `commentStore.addComment()`.
 *
 * All HTTP calls (`axios.get` / `axios.post`) are stubbed with *vi.mock* so the
 * test remains fully isolated from the backend.
 */

import {describe, it, expect, beforeEach, vi, afterEach, Mock} from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Stores under test – import through the same aliases you use in the app
import { useCommentStore} from "../../../../src/stores/commentStore";
import { useTaskGraphStore} from "../../../../src/stores/taskGraphStore";

// ────────────────────────────────────────────────────────────────────────────
// 1)  Axios *must* be mocked before the stores are imported/instantiated
//     so that every HTTP request in actions hits the stub implementation.
// ────────────────────────────────────────────────────────────────────────────
import axios from "axios";
vi.mock("axios");

// Helper to cast the imported mock into a typed object we can configure
const mockedAxios = axios as unknown as {
  get: Mock;
  post: Mock;
};

// ────────────────────────────────────────────────────────────────────────────
// Test fixtures – keep them small but realistic
// ────────────────────────────────────────────────────────────────────────────
const SESSION_ID = 1;
const USER_ID = 10;

const sessionDetails = {
  sessionId: SESSION_ID,
  taskId: 42,
  timestamp: "2025-06-25T12:00:00Z",
  collaborationNodes: {
    "1": {
      components: {},
      collaboration: { mode: "collaboration" },
    },
  },
  taskData: {
    taskId: 42,
    taskDescription: "Example task description",
  },
};

const commentsFromBackend = [
  {
    id: 1,
    sessionId: SESSION_ID,
    fieldId: "textFieldA",
    userId: USER_ID,
    text: "Existing comment",
    timestamp: "2025-06-25T13:00:00Z",
  },
];

const nicknames = { [USER_ID]: "Alice" } as Record<number, string>;

// Utility to register the Pinia instance fresh for every test run
function initStores() {
  setActivePinia(createPinia());
  const commentStore = useCommentStore();
  const taskGraphStore = useTaskGraphStore();

  // Provide the *minimum* state that the actions rely on
  taskGraphStore.setProperty({
    path: "$.userId",
    value: USER_ID,
  });

  return { commentStore, taskGraphStore };
}

// ────────────────────────────────────────────────────────────────────────────
//                         THE ACTUAL TESTS
// ────────────────────────────────────────────────────────────────────────────
describe("Integration › Comment flow", () => {
  beforeEach(() => {
    // Reset the mock and stores before *each* test case so there is no leakage
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads session details into taskGraphStore when entering comment mode", async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({ data: sessionDetails }); // for /sessionData/:id

    const { taskGraphStore } = initStores();

    // Act
    const ok = await taskGraphStore.loadSessionForCommentMode(SESSION_ID);

    // Assert – Happy path
    expect(ok).toBe(true);
    expect(taskGraphStore.isCommentMode).toBe(true);

    // The store should now point to the first collaboration node
    expect(taskGraphStore.getProperty("$.currentNode")).toBe(1);

    // The task description should also be present
    expect(
      taskGraphStore.getProperty("$.taskData.taskDescription")
    ).toBe(sessionDetails.taskData.taskDescription);
  });

  it("fetches comments and nicknames for a session", async () => {
    // Arrange – sequence of calls: 1) comments 2) nicknames
    mockedAxios.get
      .mockResolvedValueOnce({ data: commentsFromBackend }) // comments
      .mockResolvedValueOnce({ data: nicknames }); // nicknames

    const { commentStore } = initStores();

    // Act
    await commentStore.fetchCommentsForSession(SESSION_ID);

    // Assert
    expect(commentStore.comments).toHaveLength(1);
    expect(commentStore.comments[0].text).toBe("Existing comment");
    expect(commentStore.userNicknames[USER_ID]).toBe("Alice");
  });

  it("adds a new comment and updates the store", async () => {
    // Arrange – first fetch  + then add
    mockedAxios.get
      .mockResolvedValueOnce({ data: commentsFromBackend }) // comments list
      .mockResolvedValueOnce({ data: nicknames }); // nicknames

    const newComment = {
      id: 2,
      sessionId: SESSION_ID,
      fieldId: "textFieldA",
      userId: USER_ID,
      text: "Second comment",
      timeStamp: new Date().toISOString(),
    };

    mockedAxios.post.mockResolvedValueOnce({ data: newComment });

    const { commentStore } = initStores();

    // Pre‑load existing comments so we can assert the increment later
    await commentStore.fetchCommentsForSession(SESSION_ID);
    const initialCount = commentStore.comments.length;

    // Act – this should push the new comment to the store
    await commentStore.addComment(newComment);

    // Assert
    expect(commentStore.comments).toHaveLength(initialCount + 1);
    expect(commentStore.comments.at(-1)).toMatchObject({
      id: 2,
      text: "Second comment",
    });
  });
});
