/** Portable hawk-eco graph wire models. SDKs consume but do not own these facts. */

export const graphNodeKinds = [
  "system",
  "knowledge",
  "execution",
  "policy",
  "quality",
  "operations",
] as const;
export type GraphNodeKind = (typeof graphNodeKinds)[number];

export const graphEdgeKinds = [
  "contains",
  "depends_on",
  "references",
  "produced",
  "governed_by",
  "validated_by",
] as const;
export type GraphEdgeKind = (typeof graphEdgeKinds)[number];

export const graphEventTypes = [
  "created",
  "updated",
  "transitioned",
  "observed",
  "deleted",
] as const;
export type GraphEventType = (typeof graphEventTypes)[number];

export interface GraphScope {
  tenant_id?: string;
  project_id?: string;
  repository_id?: string;
}

export interface GraphRef {
  kind: GraphNodeKind;
  id: string;
}

export interface GraphArtifactRef {
  uri: string;
  digest?: string;
  media_type?: string;
}

export interface GraphProvenance {
  producer: string;
  version?: string;
  source_id?: string;
  evidence?: GraphArtifactRef[];
}

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  scope?: GraphScope;
  created_at: string;
  effective_at?: string;
  provenance: GraphProvenance;
  attributes?: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  from: GraphRef;
  to: GraphRef;
  scope?: GraphScope;
  created_at: string;
  effective_at?: string;
  provenance: GraphProvenance;
  attributes?: Record<string, string>;
}

export interface GraphEvent {
  id: string;
  type: GraphEventType;
  subject: GraphRef;
  scope?: GraphScope;
  occurred_at: string;
  correlation_id?: string;
  causation_id?: string;
  idempotency_key?: string;
  provenance: GraphProvenance;
}

export interface GraphExport {
  schema_version: string;
  generated_at: string;
  query_sha256?: string;
  scope?: GraphScope;
  nodes: GraphNode[];
  edges: GraphEdge[];
  events: GraphEvent[];
}

/** GraphOptions controls optional scope and Trace links for a session graph. */
export interface GraphOptions {
  repository?: string;
  traceCheckpoints?: string[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, label);
}

function timestamp(value: unknown, label: string): string {
  const parsed = requiredString(value, label);
  if (Number.isNaN(Date.parse(parsed))) throw new TypeError(`Invalid ${label}`);
  return parsed;
}

function stringRecord(value: unknown, label: string): void {
  if (value === undefined) return;
  const parsed = record(value, label);
  if (Object.values(parsed).some((item) => typeof item !== "string")) {
    throw new TypeError(`Invalid ${label}`);
  }
}

function scope(value: unknown, label: string): void {
  if (value === undefined) return;
  const item = record(value, label);
  optionalString(item.tenant_id, `${label}.tenant_id`);
  optionalString(item.project_id, `${label}.project_id`);
  optionalString(item.repository_id, `${label}.repository_id`);
}

function enumValue<T extends readonly string[]>(
  values: T,
  value: unknown,
  label: string,
): T[number] {
  const parsed = requiredString(value, label);
  if (!(values as readonly string[]).includes(parsed))
    throw new TypeError(`Invalid ${label}`);
  return parsed as T[number];
}

function graphRef(value: unknown, label: string): GraphRef {
  const item = record(value, label);
  return {
    kind: enumValue(graphNodeKinds, item.kind, `${label}.kind`),
    id: requiredString(item.id, `${label}.id`),
  };
}

function provenance(value: unknown, label: string): GraphProvenance {
  const item = record(value, label);
  optionalString(item.version, `${label}.version`);
  optionalString(item.source_id, `${label}.source_id`);
  if (item.evidence !== undefined) {
    if (!Array.isArray(item.evidence))
      throw new TypeError(`Invalid ${label}.evidence`);
    for (const [index, value] of item.evidence.entries()) {
      const evidence = record(value, `${label}.evidence[${index}]`);
      requiredString(evidence.uri, `${label}.evidence[${index}].uri`);
      optionalString(evidence.digest, `${label}.evidence[${index}].digest`);
      optionalString(
        evidence.media_type,
        `${label}.evidence[${index}].media_type`,
      );
    }
  }
  return { producer: requiredString(item.producer, `${label}.producer`) };
}

/** parseGraphExport validates identity, vocabulary, timestamps, and topology. */
export function parseGraphExport(value: unknown): GraphExport {
  const graph = record(value, "graph export");
  const schemaVersion = requiredString(
    graph.schema_version,
    "graph schema_version",
  );
  if (!/^[a-z0-9-]+\.graph\/v1$/.test(schemaVersion)) {
    throw new TypeError("Invalid graph schema_version");
  }
  const generatedAt = timestamp(graph.generated_at, "graph generated_at");
  scope(graph.scope, "graph.scope");
  if (
    graph.query_sha256 !== undefined &&
    (typeof graph.query_sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(graph.query_sha256))
  ) {
    throw new TypeError("Invalid graph query_sha256");
  }
  if (
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !Array.isArray(graph.events)
  ) {
    throw new TypeError("Invalid graph fact arrays");
  }

  const nodeKindsByID = new Map<string, GraphNodeKind>();
  const nodes = graph.nodes.map((value, index): GraphNode => {
    const item = record(value, `graph.nodes[${index}]`);
    const id = requiredString(item.id, `graph.nodes[${index}].id`);
    const kind = enumValue(
      graphNodeKinds,
      item.kind,
      `graph.nodes[${index}].kind`,
    );
    if (nodeKindsByID.has(id))
      throw new TypeError(`Duplicate graph node ${id}`);
    nodeKindsByID.set(id, kind);
    timestamp(item.created_at, `graph.nodes[${index}].created_at`);
    if (item.effective_at !== undefined)
      timestamp(item.effective_at, `graph.nodes[${index}].effective_at`);
    scope(item.scope, `graph.nodes[${index}].scope`);
    stringRecord(item.attributes, `graph.nodes[${index}].attributes`);
    provenance(item.provenance, `graph.nodes[${index}].provenance`);
    return item as unknown as GraphNode;
  });

  const edgeIDs = new Set<string>();
  const edges = graph.edges.map((value, index): GraphEdge => {
    const item = record(value, `graph.edges[${index}]`);
    const id = requiredString(item.id, `graph.edges[${index}].id`);
    enumValue(graphEdgeKinds, item.kind, `graph.edges[${index}].kind`);
    if (edgeIDs.has(id)) throw new TypeError(`Duplicate graph edge ${id}`);
    edgeIDs.add(id);
    const from = graphRef(item.from, `graph.edges[${index}].from`);
    const to = graphRef(item.to, `graph.edges[${index}].to`);
    if (
      nodeKindsByID.get(from.id) !== from.kind ||
      nodeKindsByID.get(to.id) !== to.kind
    ) {
      throw new TypeError(`Dangling graph edge ${id}`);
    }
    timestamp(item.created_at, `graph.edges[${index}].created_at`);
    if (item.effective_at !== undefined)
      timestamp(item.effective_at, `graph.edges[${index}].effective_at`);
    scope(item.scope, `graph.edges[${index}].scope`);
    stringRecord(item.attributes, `graph.edges[${index}].attributes`);
    provenance(item.provenance, `graph.edges[${index}].provenance`);
    return item as unknown as GraphEdge;
  });

  const eventIDs = new Set<string>();
  const events = graph.events.map((value, index): GraphEvent => {
    const item = record(value, `graph.events[${index}]`);
    const id = requiredString(item.id, `graph.events[${index}].id`);
    enumValue(graphEventTypes, item.type, `graph.events[${index}].type`);
    if (eventIDs.has(id)) throw new TypeError(`Duplicate graph event ${id}`);
    eventIDs.add(id);
    const subject = graphRef(item.subject, `graph.events[${index}].subject`);
    if (nodeKindsByID.get(subject.id) !== subject.kind) {
      throw new TypeError(`Dangling graph event ${id}`);
    }
    timestamp(item.occurred_at, `graph.events[${index}].occurred_at`);
    scope(item.scope, `graph.events[${index}].scope`);
    optionalString(
      item.correlation_id,
      `graph.events[${index}].correlation_id`,
    );
    optionalString(item.causation_id, `graph.events[${index}].causation_id`);
    optionalString(
      item.idempotency_key,
      `graph.events[${index}].idempotency_key`,
    );
    provenance(item.provenance, `graph.events[${index}].provenance`);
    return item as unknown as GraphEvent;
  });

  return {
    ...(graph as unknown as GraphExport),
    schema_version: schemaVersion,
    generated_at: generatedAt,
    nodes,
    edges,
    events,
  };
}
