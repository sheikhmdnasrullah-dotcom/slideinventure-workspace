import * as lancedb from "@lancedb/lancedb";
const db = await lancedb.connect("./.lancedb-data");
const names = await db.tableNames();
console.log("tables:", names);
if (names.includes("search_index")) {
  const t = await db.openTable("search_index");
  const rows = await t.query().limit(20).toArray();
  console.log("row count sample:", rows.length);
  for (const r of rows) console.log(r.id, r.collection, r.doc_id, JSON.stringify(r.text).slice(0,80));
}
