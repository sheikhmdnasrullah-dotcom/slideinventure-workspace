import { z } from "zod";
const Schema = z.object({
  description: z.string().optional().nullable(),
});
console.log(Schema.safeParse({ description: "" }).success);
