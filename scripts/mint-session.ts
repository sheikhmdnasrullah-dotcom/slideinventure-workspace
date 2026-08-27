/**
 * Mints a real Appwrite session for the first workspace user and prints the
 * session cookie header. Used by manual smoke checks and the Playwright suite
 * so no password ever has to be typed into a test.
 */
import { Client, Users, Query } from "node-appwrite";

async function main() {
  const projectId = process.env.APPWRITE_PROJECT_ID ?? "";

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
    .setProject(projectId)
    .setKey(process.env.APPWRITE_API_KEY || "");

  const users = new Users(client);
  const list = await users.list([Query.limit(1)]);
  const user = list.users[0];
  if (!user) throw new Error("No Appwrite user found");

  const session = await users.createSession(user.$id);
  process.stdout.write(`a_session_${projectId}=${session.secret}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
