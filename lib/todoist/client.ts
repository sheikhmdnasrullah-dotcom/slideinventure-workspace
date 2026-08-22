import 'server-only'

export interface TodoistTask {
  id: string
  external_id?: string
  project_id?: string
  content: string
  description?: string
  priority: number
  due_date?: string
  completed: boolean
  assignee?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TodoistProject {
  id: string
  name: string
  color?: string
  parent_id?: string
  is_favorite?: boolean
}

export interface TodoistLabel {
  id: string
  name: string
  color?: string
  is_favorite?: boolean
}

export interface TodoistCreateTaskInput {
  content: string
  description?: string
  project_id?: string
  labels?: string[]
  priority?: number
  due_date?: string
}

export interface TodoistUpdateTaskInput {
  content?: string
  description?: string
  project_id?: string
  labels?: string[]
  priority?: number
  due_date?: string
  completed?: boolean
}

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2"

function getToken(): string {
  const token = process.env.TODOIST_API_TOKEN
  if (!token) throw new Error("TODOIST_API_TOKEN is not configured")
  return token
}

async function todoistFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TODOIST_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Todoist API error ${res.status}: ${text || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listProjects(): Promise<TodoistProject[]> {
  return todoistFetch<TodoistProject[]>("/projects")
}

export async function listLabels(): Promise<TodoistLabel[]> {
  return todoistFetch<TodoistLabel[]>("/labels")
}

export async function listTasks(filters?: { project_id?: string; label?: string; completed?: boolean }): Promise<TodoistTask[]> {
  const params = new URLSearchParams()
  if (filters?.project_id) params.set("project_id", filters.project_id)
  if (filters?.label) params.set("label", filters.label)
  if (filters?.completed !== undefined) params.set("completed", String(filters.completed))
  const qs = params.toString()
  return todoistFetch<TodoistTask[]>(`/tasks${qs ? `?${qs}` : ""}`)
}

export async function getTask(id: string): Promise<TodoistTask> {
  return todoistFetch<TodoistTask>(`/tasks/${id}`)
}

export async function createTask(input: TodoistCreateTaskInput): Promise<TodoistTask> {
  return todoistFetch<TodoistTask>("/tasks", {
    method: "POST",
    body: JSON.stringify({
      content: input.content,
      description: input.description,
      project_id: input.project_id,
      labels: input.labels,
      priority: input.priority ?? 1,
      due_date: input.due_date,
    }),
  })
}

export async function updateTask(id: string, input: TodoistUpdateTaskInput): Promise<TodoistTask> {
  return todoistFetch<TodoistTask>(`/tasks/${id}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function completeTask(id: string): Promise<void> {
  await todoistFetch<void>(`/tasks/${id}/close`, { method: "POST" })
}

export async function deleteTask(id: string): Promise<void> {
  await todoistFetch<void>(`/tasks/${id}`, { method: "DELETE" })
}
