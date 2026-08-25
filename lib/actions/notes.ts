"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Note {
  id: string
  title?: string
  content: string // JSON-serialized BlockNote document
  created_at: string
  updated_at: string
}

export async function listNotes(): Promise<Note[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function createNote(title?: string, content: string = ""): Promise<Note> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notes")
    .insert({ title, content })
    .select()
    .single()

  if (error) throw error
  revalidatePath("/notepad")
  return data
}

export async function updateNote(id: string, content: string): Promise<Note> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notes")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/notepad")
  return data
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)

  if (error) throw error
  revalidatePath("/notepad")
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  return data || null
}
