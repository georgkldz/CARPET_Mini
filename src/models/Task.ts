// src/models/Task.ts
export interface Task {
  taskId: number;
  description: string;
  solution: string;
  hint?: string;
  // Weitere Felder (z.B. createdAt, updatedAt) je nach Bedarf
}
