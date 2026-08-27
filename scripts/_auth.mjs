const ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const PROJECT = "6a8cf7090015800700cc";
const email = "tanimsyt@gmail.com";
const password = "Trimtales@2026";

const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
  method: "POST",
  headers: {
    "X-Appwrite-Project": PROJECT,
    "content-type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({ email, password }),
});

console.log("auth status:", res.status);
const getSetCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
const prefix = `a_session_${PROJECT}=`;
for (const c of getSetCookie) {
  if (c.startsWith(prefix)) {
    const val = c.slice(prefix.length).split(";")[0];
    console.log("COOKIE=" + val);
    process.exit(0);
  }
}
console.log("no cookie found");
process.exit(2);
