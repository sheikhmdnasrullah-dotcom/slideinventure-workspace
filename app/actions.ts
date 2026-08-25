"use server";

import { deleteCurrentSession } from "@/lib/appwrite/auth";
import { redirect } from "next/navigation";

export async function signOut() {
  await deleteCurrentSession();
  redirect("/login");
}
