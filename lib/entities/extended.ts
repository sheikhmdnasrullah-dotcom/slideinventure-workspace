/**
 * Entity/Relation extensions: business entities beyond Obsidian wikilinks.
 * Provides typed entity types, properties, and relation kinds.
 */

import { databases, ID } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { APPWRITE } from "@/lib/appwrite/config";

export type EntityType = "company" | "person" | "project" | "campaign" | "deal" | "document" | "tag";

export const ENTITY_TYPES: EntityType[] = [
  "company",
  "person",
  "project",
  "campaign",
  "deal",
  "document",
  "tag",
];

export type RelationType =
  | "works_at"
  | "owns"
  | "manages"
  | "partner_of"
  | "competitor_of"
  | "parent_of"
  | "child_of"
  | "references"
  | "depends_on"
  | "blocks"
  | "mentions"
  | "cites"
  | "contradicts"
  | "supports"
  | "custom";

export const RELATION_TYPES: RelationType[] = [
  "works_at",
  "owns",
  "manages",
  "partner_of",
  "competitor_of",
  "parent_of",
  "child_of",
  "references",
  "depends_on",
  "blocks",
  "mentions",
  "cites",
  "contradicts",
  "supports",
  "custom",
];

export interface Entity {
  id: string;
  entity_type: EntityType | null;
  name: string;
  properties: Record<string, unknown>;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: RelationType;
  source_knowledge_item_id: string | null;
  source: string | null;
  created_at: string;
}

const ENTITY_COL = APPWRITE.collections.entities;
const RELATION_COL = APPWRITE.collections.relations;
const DB = APPWRITE.databaseId;

function parseProps(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return (value as Record<string, unknown>) ?? {};
}

function serializeEntity(doc: Record<string, any>): Entity {
  return {
    id: doc.entity_id ?? doc.$id,
    entity_type: (doc.entity_type as EntityType) ?? null,
    name: doc.name,
    properties: parseProps(doc.properties),
    source: doc.source ?? null,
    created_at: doc.created_at ?? "",
    updated_at: doc.updated_at ?? "",
  };
}

function serializeRelation(doc: Record<string, any>): Relation {
  return {
    id: doc.$id,
    from_entity_id: doc.from_entity_id,
    to_entity_id: doc.to_entity_id,
    relation_type: doc.relation_type as RelationType,
    source_knowledge_item_id: doc.source_knowledge_item_id ?? null,
    source: doc.source ?? null,
    created_at: doc.created_at ?? "",
  };
}

/**
 * Create or upsert an entity. The entity `id` is used as the document id.
 */
export async function upsertEntity(
  input: {
    id: string;
    entity_type: EntityType;
    name: string;
    properties?: Record<string, unknown>;
    source?: string;
  }
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const existing = await databases.listDocuments(DB, ENTITY_COL, [Query.equal("entity_id", input.id)]);

  const data = {
    entity_id: input.id,
    type: input.entity_type,
    entity_type: input.entity_type,
    name: input.name,
    properties: JSON.stringify(input.properties ?? {}),
    source: input.source ?? "manual",
  };

  try {
    const doc =
      existing.documents.length > 0
        ? await databases.updateDocument(DB, ENTITY_COL, existing.documents[0].$id, data)
        : await databases.createDocument(DB, ENTITY_COL, ID.unique(), data);
    return { success: true, entity: serializeEntity(doc) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to upsert entity" };
  }
}

/**
 * Create a relation between two entities (deduplicated on the 4-tuple).
 */
export async function createRelation(
  input: {
    from_entity_id: string;
    to_entity_id: string;
    relation_type: RelationType;
    source_knowledge_item_id?: string;
    source?: string;
  }
): Promise<{ success: boolean; relation?: Relation; error?: string }> {
  const dedupe = await databases.listDocuments(DB, RELATION_COL, [
    Query.equal("from_entity_id", input.from_entity_id),
    Query.equal("to_entity_id", input.to_entity_id),
    Query.equal("relation_type", input.relation_type),
    Query.equal("source_knowledge_item_id", input.source_knowledge_item_id ?? ""),
  ]);

  if (dedupe.documents.length > 0) {
    return { success: true, relation: serializeRelation(dedupe.documents[0]) };
  }

  try {
    const doc = await databases.createDocument(DB, RELATION_COL, ID.unique(), {
      from_entity_id: input.from_entity_id,
      to_entity_id: input.to_entity_id,
      relation_type: input.relation_type,
      source_knowledge_item_id: input.source_knowledge_item_id ?? null,
      source: input.source ?? "manual",
    });
    return { success: true, relation: serializeRelation(doc) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to create relation" };
  }
}

/**
 * Get entity with its relations (one hop).
 */
export async function getEntityWithRelations(
  entityId: string
): Promise<{ entity: Entity | null; outgoing: Relation[]; incoming: Relation[] }> {
  const [entityRes, outgoingRes, incomingRes] = await Promise.all([
    databases.listDocuments(DB, ENTITY_COL, [Query.equal("entity_id", entityId)]),
    databases.listDocuments(DB, RELATION_COL, [Query.equal("from_entity_id", entityId)]),
    databases.listDocuments(DB, RELATION_COL, [Query.equal("to_entity_id", entityId)]),
  ]);

  return {
    entity: entityRes.documents[0] ? serializeEntity(entityRes.documents[0]) : null,
    outgoing: outgoingRes.documents.map(serializeRelation),
    incoming: incomingRes.documents.map(serializeRelation),
  };
}

/**
 * Find entities by type with optional property filter.
 */
export async function findEntities(
  entityType: EntityType,
  propertyFilter?: Record<string, unknown>,
  limit = 100
): Promise<Entity[]> {
  const res = await databases.listDocuments(DB, ENTITY_COL, [
    Query.equal("entity_type", entityType),
    Query.limit(limit),
  ]);

  const entities = res.documents.map(serializeEntity);
  if (!propertyFilter) return entities;

  return entities.filter((e) =>
    Object.entries(propertyFilter).every(([k, v]) => e.properties[k] === v)
  );
}

/**
 * Traverse relations from an entity (BFS up to depth).
 * Note: Appwrite has no `.in()` operator, so all relations are fetched once and
 * filtered in memory (acceptable for the small relation sets in this app).
 */
export async function traverseRelations(
  startEntityId: string,
  options: { maxDepth?: number; relationTypes?: RelationType[]; direction?: "outgoing" | "incoming" | "both" } = {}
): Promise<{ entities: Entity[]; relations: Relation[] }> {
  const maxDepth = options.maxDepth ?? 2;
  const allowedTypes = new Set(options.relationTypes ?? RELATION_TYPES);
  const direction = options.direction ?? "both";

  const allRelations = (await databases.listDocuments(DB, RELATION_COL, [Query.limit(5000)]))
    .documents.map(serializeRelation)
    .filter((r) => allowedTypes.has(r.relation_type));

  const visited = new Set<string>();
  const entities: Entity[] = [];
  const relations: Relation[] = [];

  let currentLevel = [startEntityId];
  visited.add(startEntityId);

  for (let depth = 0; depth <= maxDepth; depth++) {
    if (currentLevel.length === 0) break;

    const nextLevel: string[] = [];
    const levelSet = new Set(currentLevel);

    const matches = allRelations.filter((rel) => {
      const out = direction === "outgoing" || direction === "both";
      const inc = direction === "incoming" || direction === "both";
      return (out && levelSet.has(rel.from_entity_id)) || (inc && levelSet.has(rel.to_entity_id));
    });

    for (const rel of matches) {
      relations.push(rel);
      const nextId = direction === "incoming" ? rel.from_entity_id : rel.to_entity_id;
      if (!visited.has(nextId)) nextLevel.push(nextId);
    }

    for (const entityId of nextLevel) {
      visited.add(entityId);
      const res = await databases.listDocuments(DB, ENTITY_COL, [Query.equal("entity_id", entityId)]);
      if (res.documents[0]) entities.push(serializeEntity(res.documents[0]));
    }

    currentLevel = nextLevel;
  }

  // Ensure start + any visited entities not yet collected are present
  for (const id of visited) {
    if (!entities.some((e) => e.id === id)) {
      const res = await databases.listDocuments(DB, ENTITY_COL, [Query.equal("entity_id", id)]);
      if (res.documents[0]) entities.push(serializeEntity(res.documents[0]));
    }
  }

  return { entities, relations };
}

/**
 * Helper: create company entity with standard properties.
 */
export async function createCompany(
  name: string,
  properties: Record<string, unknown> = {},
  source = "manual"
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const id = `company-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return upsertEntity({ id, entity_type: "company", name, properties, source });
}

/**
 * Helper: create person entity with standard properties.
 */
export async function createPerson(
  name: string,
  properties: Record<string, unknown> = {},
  source = "manual"
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const id = `person-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return upsertEntity({ id, entity_type: "person", name, properties, source });
}
