export interface Task {
  taskId: number;
  description: string;
  hint?: string;

  degree: number;
  symmetry: "even" | "odd" | "none";

  textFieldEquation1?: string;
  textFieldEquation2?: string;
  textFieldEquation3?: string;
  textFieldEquation4?: string;
  textFieldEquation5?: string;

  sampleSolutionCollaborativeWork?: string;
}
