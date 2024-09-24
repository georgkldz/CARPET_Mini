import { z } from "zod";

export default z
  .object({
    edges: z
      .record(z.union([z.array(z.number()), z.never()]))
      .superRefine((value, ctx) => {
        for (const key in value) {
          let evaluated = false;
          if (key.match(new RegExp("^[0-9]+$"))) {
            evaluated = true;
            const result = z.array(z.number()).safeParse(value[key]);
            if (!result.success) {
              ctx.addIssue({
                path: [...ctx.path, key],
                code: "custom",
                message: `Invalid input: Key matching regex /${key}/ must match schema`,
                params: {
                  issues: result.error.issues,
                },
              });
            }
          }
          if (!evaluated) {
            const result = z.never().safeParse(value[key]);
            if (!result.success) {
              ctx.addIssue({
                path: [...ctx.path, key],
                code: "custom",
                message: `Invalid input: must match catchall schema`,
                params: {
                  issues: result.error.issues,
                },
              });
            }
          }
        }
      }),
    feedbackLevel: z
      .enum([
        "correctness",
        "none",
        "unpromptedFeedback",
        "unpromptedHints",
        "validity",
      ])
      .optional(),
    layoutSize: z.any().optional(),
    nodes: z.record(z.union([z.any(), z.never()])).superRefine((value, ctx) => {
      for (const key in value) {
        let evaluated = false;
        if (key.match(new RegExp("^[0-9]+$"))) {
          evaluated = true;
          const result = z.any().safeParse(value[key]);
          if (!result.success) {
            ctx.addIssue({
              path: [...ctx.path, key],
              code: "custom",
              message: `Invalid input: Key matching regex /${key}/ must match schema`,
              params: {
                issues: result.error.issues,
              },
            });
          }
        }
        if (!evaluated) {
          const result = z.never().safeParse(value[key]);
          if (!result.success) {
            ctx.addIssue({
              path: [...ctx.path, key],
              code: "custom",
              message: `Invalid input: must match catchall schema`,
              params: {
                issues: result.error.issues,
              },
            });
          }
        }
      }
    }),
    rootNode: z.number().optional(),
    taskData: z.any().optional(),
  })
  .strict();
