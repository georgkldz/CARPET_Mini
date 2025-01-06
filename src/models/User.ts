// src/models/User.ts
export interface User {
  userId: number;
  email: string;
  password: string; // eventuell hashed
  role: number; // 1 = Student, 2 = Lehrender
}
