// test/helpers/wsMock.ts
import { vi, Mock } from "vitest";

interface WebSocketMockInstance {
  url: string;
  sent: string[];
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  close: Mock;
  send: Mock;
  emitServer: (payload: unknown) => void;
}

// Erstelle eine statische Liste von Mock-Instanzen
const mockInstances: WebSocketMockInstance[] = [];

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export const WebSocketMock = vi.fn().mockImplementation(function (this: any, url: string) {
  const instance: WebSocketMockInstance = {
    url,
    sent: [] as string[],
    readyState: 1, // 1 == WebSocket.OPEN
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    close: vi.fn(() => {
      instance.readyState = 3; // WebSocket.CLOSED
      if (instance.onclose) {
        instance.onclose(new CloseEvent("close"));
      }
    }),
    send: vi.fn((d: string) => {
      instance.sent.push(d);
    }),
    // Helper für Server-Push im Test
    emitServer: (payload: unknown) => {
      if (instance.onmessage) {
        instance.onmessage(new MessageEvent("message", {
          data: JSON.stringify(payload)
        }));
      }
    }
  };

  // Kopiere Eigenschaften auf this
  Object.assign(this, instance);

  // Füge diese Instanz zur Liste hinzu
  mockInstances.push(this);

  // 🟢 sofort „open" simulieren (nächste Mikro-Task)
  queueMicrotask(() => {
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  });

  return this;
});

// Erstelle ein separates Objekt für die Mock-Verwaltung
export const WebSocketMockControl = {
  get instances() {
    return mockInstances;
  },
  clear: () => {
    mockInstances.length = 0;
  }
};

// Füge WebSocket Konstanten direkt zu WebSocketMock hinzu
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
const mockWithConstants = WebSocketMock as any;
mockWithConstants.CONNECTING = 0;
mockWithConstants.OPEN = 1;
mockWithConstants.CLOSING = 2;
mockWithConstants.CLOSED = 3;

// Export helper zum Zurücksetzen
export const clearWebSocketMocks = () => {
  mockInstances.length = 0;
  WebSocketMock.mockClear();
};

// Export types
export type { WebSocketMockInstance };
