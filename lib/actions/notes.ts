"use server"

import { getSessionUser } from "@/lib/appwrite/auth"
import { databases } from "@/lib/appwrite/server"
import { ID, Query } from "node-appwrite"
import { APPWRITE } from "@/lib/appwrite/config"
import { revalidatePath } from "next/cache"

const DB = APPWRITE.databaseId
const COL = APPWRITE.collections.notes

export interface Note {
  id: string
  title?: string
  content: string // JSON-serialized BlockNote document
  created_at: string
  updated_at: string
}

function serialize(doc: Record<string, any>): Note {
  return {
    id: doc.$id,
    title: doc.title,
    content: doc.content,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

export async function listNotes(): Promise<Note[]> {
  const res = await databases.listDocuments(DB, COL, [
    Query.orderDesc("created_at"),
    Query.limit(1000),
  ])
  return res.documents.map(serialize)
}

export async function createNote(title?: string, content: string = ""): Promise<Note> {
  const user = await getSessionUser()
  const now = new Date().toISOString()
  const doc = await databases.createDocument(DB, COL, ID.unique(), {
    user_email: user?.email ?? "",
    title: title ?? "Untitled note",
    content,
    created_at: now,
    updated_at: now,
  })
  revalidatePath("/notepad")
  return serialize(doc)
}

export async function updateNote(id: string, content: string): Promise<Note> {
  const doc = await databases.updateDocument(DB, COL, id, {
    content,
    updated_at: new Date().toISOString(),
  })
  revalidatePath("/notepad")
  return serialize(doc)
}

export async function deleteNote(id: string): Promise<void> {
  await databases.deleteDocument(DB, COL, id)
  revalidatePath("/notepad")
}

export async function getNote(id: string): Promise<Note | null> {
  const res = await databases.listDocuments(DB, COL, [Query.equal("$id", id)])
  return res.documents[0] ? serialize(res.documents[0]) : null
}
