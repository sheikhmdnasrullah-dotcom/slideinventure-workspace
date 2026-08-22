import { validate } from "./lib/api/validation";
import { TerminalCommandSchema } from "./lib/api/schemas";
const CreateSchema = TerminalCommandSchema.omit({ id: true, createdAt: true, updatedAt: true });
const body = {
  title: "VPS Root",
  command: "ssh root@123",
  description: "",
  category: "",
  tags: [],
  notes: "",
  variables: {},
  favorite: false
};
try {
  const validated = validate(CreateSchema, body);
  console.log("Validation success", validated);
} catch (e) {
  console.error("Validation failed", e);
}
