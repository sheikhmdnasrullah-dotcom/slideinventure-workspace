/**
 * Entity/Relation extensions — business entities beyond Obsidian wikilinks.
 * Provides typed entity types, properties, and relation kinds.
 */

import { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Create or upsert an entity.
 */
export async function upsertEntity(
  supabase: SupabaseClient,
  input: {
    id: string;
    entity_type: EntityType;
    name: string;
    properties?: Record<string, unknown>;
    source?: string;
  }
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const entity = {
    id: input.id,
    entity_type: input.entity_type,
    name: input.name,
    properties: input.properties ?? {},
    source: input.source ?? "manual",
  };

  const { data, error } = await supabase
    .from("entities")
    .upsert(entity, { onConflict: "id" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, entity: data };
}

/**
 * Create a relation between two entities.
 */
export async function createRelation(
  supabase: SupabaseClient,
  input: {
    from_entity_id: string;
    to_entity_id: string;
    relation_type: RelationType;
    source_knowledge_item_id?: string;
    source?: string;
  }
): Promise<{ success: boolean; relation?: Relation; error?: string }> {
  const relation = {
    from_entity_id: input.from_entity_id,
    to_entity_id: input.to_entity_id,
    relation_type: input.relation_type,
    source_knowledge_item_id: input.source_knowledge_item_id ?? null,
    source: input.source ?? "manual",
  };

  const { data, error } = await supabase
    .from("relations")
    .upsert(relation, { onConflict: "from_entity_id,to_entity_id,relation_type,source_knowledge_item_id" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, relation: data };
}

/**
 * Get entity with its relations (one hop).
 */
export async function getEntityWithRelations(
  supabase: SupabaseClient,
  entityId: string
): Promise<{ entity: Entity | null; outgoing: Relation[]; incoming: Relation[] }> {
  const [{ data: entity }, { data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from("entities").select("*").eq("id", entityId).single(),
    supabase.from("relations").select("*").eq("from_entity_id", entityId),
    supabase.from("relations").select("*").eq("to_entity_id", entityId),
  ]);

  return {
    entity: entity.data,
    outgoing: outgoing ?? [],
    incoming: incoming ?? [],
  };
}

/**
 * Find entities by type with optional property filter.
 */
export async function findEntities(
  supabase: SupabaseClient,
  entityType: EntityType,
  propertyFilter?: Record<string, unknown>,
  limit = 100
): Promise<Entity[]> {
  const query = supabase
    .from("entities")
    .select("*")
    .eq("entity_type", entityType)
    .limit(limit);

  // Note: propertyFilter would require Postgres jsonb containment queries
  // which are not directly supported by PostgREST. Implement via RPC if needed.
  // For now, fetch and filter in memory for small datasets.

  const { data, error } = await query;
  if (error) throw new Error(`Entity find failed: ${error.message}`);

  if (!propertyFilter) return (data ?? []) as Entity[];

  return (data ?? []).filter((e: Entity) =>
    Object.entries(propertyFilter).every(([k, v]) => e.properties[k] === v)
  ) as Entity[];
}

/**
 * Traverse relations from an entity (BFS up to depth).
 */
export async function traverseRelations(
  supabase: SupabaseClient,
  startEntityId: string,
  options: { maxDepth?: number; relationTypes?: RelationType[]; direction?: "outgoing" | "incoming" | "both" } = {}
): Promise<{ entities: Entity[]; relations: Relation[] }> {
  const maxDepth = options.maxDepth ?? 2;
  const allowedTypes = new Set(options.relationTypes ?? RELATION_TYPES);
  const direction = options.direction ?? "both";

  const visited = new Set<string>();
  const entities: Entity[] = [];
  const relations: Relation[] = [];

  let currentLevel = [startEntityId];
  visited.add(startEntityId);

  for (let depth = 0; depth <= maxDepth; depth++) {
    if (currentLevel.length === 0) break;

    const nextLevel: string[] = [];

    for (const entityId of currentLevel) {
      if (depth > 0 && !visited.has(entityId)) {
        visited.add(entityId);
        const { data: entity } = await supabase.from("entities").select("*").eq("id", entityId).single();
        if (entity) entities.push(entity as Entity);
      }

      if (depth === maxDepth) continue;

      let query = supabase.from("relations").select("*");
      if (direction === "outgoing" || direction === "both") {
        query = query.or(`from_entity_id.in.(${currentLevel.join(",")})`);
      }
      if (direction === "incoming" || direction === "both") {
        query = query.or(`to_entity_id.in.(${currentLevel.join(",")})`);
      }
      if (options.relationTypes) {
        query = query.in("relation_type", options.relationTypes);
      }

      const { data: rels } = await query;
      if (rels) {
        relations.push(...(rels as Relation[]));
        for (const rel of rels) {
          const nextId = direction === "outgoing" ? rel.to_entity_id : rel.from_entity_id;
          if (!visited.has(nextId)) nextLevel.push(nextId);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Fetch all unique entities
  const entityIds = [...visited];
  if (entityIds.length > 0) {
    const { data: ents } = await supabase.from("entities").select("*").in("id", entityIds);
    if (ents) entities.push(...(ents as Entity[]));
  }

  return { entities, relations };
}

/**
 * Helper: create company entity with standard properties.
 */
export async function createCompany(
  supabase: SupabaseClient,
  name: string,
  properties: Record<string, unknown> = {},
  source = "manual"
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const id = `company-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return upsertEntity(supabase, {
    id,
    entity_type: "company",
    name,
    properties,
    source,
  });
}

/**
 * Helper: create person entity with standard properties.
 */
export async function createPerson(
  supabase: SupabaseClient,
  name: string,
  properties: Record<string, unknown> = {},
  source = "manual"
): Promise<{ success: boolean; entity?: Entity; error?: string }> {
  const id = `person-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return upsertEntity(supabase, {
    id,
    entity_type: "person",
    name,
    properties,
    source,
  });
}