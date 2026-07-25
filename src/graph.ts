/**
 * Graph Query Language DSL for Hawk SDK (TypeScript).
 *
 * This module provides a fluent API for building and querying graphs,
 * inspired by Cypher (Neo4j) and LangGraph patterns.
 */

export type NodeType = 'agent' | 'tool' | 'function' | 'start' | 'end' | 'router';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  condition?: string;
  weight: number;
}

export interface GraphJSON {
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    properties: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    condition?: string;
    weight: number;
  }>;
}

/**
 * GraphQuery provides a fluent API for building and querying graphs.
 *
 * @example
 * const graph = new GraphQuery();
 * graph.node('start', 'start')
 *      .edge('start', 'agent')
 *      .node('agent', 'agent')
 *      .edge('agent', 'end')
 *      .node('end', 'end');
 *
 * const path = graph.shortestPath('start', 'end');
 */
export class GraphQuery {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private adj: Map<string, string[]> = new Map();

  /**
   * Add a node to the graph.
   */
  node(id: string, type: NodeType = 'agent', name: string = id, properties: Record<string, unknown> = {}): this {
    if (this.nodes.has(id)) {
      return this;
    }
    this.nodes.set(id, { id, type, name, properties });
    this.adj.set(id, []);
    return this;
  }

  /**
   * Add an edge between two nodes.
   */
  edge(source: string, target: string, condition?: string, weight: number = 1.0): this {
    if (!this.nodes.has(source) || !this.nodes.has(target)) {
      throw new Error(`Node not found: ${!this.nodes.has(source) ? source : target}`);
    }
    this.edges.push({ source, target, condition, weight });
    this.adj.get(source)!.push(target);
    return this;
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes.
   */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges.
   */
  getEdges(): GraphEdge[] {
    return this.edges;
  }

  /**
   * Find all nodes of a specific type.
   */
  findNodesByType(type: NodeType): GraphNode[] {
    return this.getNodes().filter(n => n.type === type);
  }

  /**
   * Find all nodes with a specific property value.
   */
  findNodesByProperty(key: string, value: unknown): GraphNode[] {
    return this.getNodes().filter(n => n.properties[key] === value);
  }

  /**
   * Perform breadth-first search from a start node.
   */
  bfs(start: string): string[] {
    if (!this.nodes.has(start)) {
      throw new Error(`Node not found: ${start}`);
    }

    const visited = new Set<string>();
    const queue: string[] = [start];
    const result: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);

      const neighbors = this.adj.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Perform depth-first search from a start node.
   */
  dfs(start: string): string[] {
    if (!this.nodes.has(start)) {
      throw new Error(`Node not found: ${start}`);
    }

    const visited = new Set<string>();
    const result: string[] = [];

    const dfsVisit = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);
      result.push(node);
      const neighbors = this.adj.get(node) || [];
      for (const neighbor of neighbors) {
        dfsVisit(neighbor);
      }
    };

    dfsVisit(start);
    return result;
  }

  /**
   * Find the shortest path between two nodes using BFS.
   */
  shortestPath(start: string, end: string): string[] {
    if (!this.nodes.has(start)) {
      throw new Error(`Start node not found: ${start}`);
    }
    if (!this.nodes.has(end)) {
      throw new Error(`End node not found: ${end}`);
    }

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === end) break;

      const neighbors = this.adj.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    if (!visited.has(end)) {
      return [];
    }

    // Reconstruct path
    const path: string[] = [];
    let node = end;
    while (node !== start) {
      path.push(node);
      node = parent.get(node)!;
    }
    path.push(start);
    path.reverse();

    return path;
  }

  /**
   * Compute PageRank scores for all nodes.
   */
  pagerank(iterations: number = 20, damping: number = 0.85): Map<string, number> {
    const n = this.nodes.size;
    if (n === 0) return new Map();

    // Build out-degree map
    const outDegree = new Map<string, number>();
    for (const [id, neighbors] of this.adj) {
      outDegree.set(id, neighbors.length);
    }

    // Initialize PageRank
    let pr = new Map<string, number>();
    for (const id of this.nodes.keys()) {
      pr.set(id, 1.0 / n);
    }

    // Iterate
    for (let i = 0; i < iterations; i++) {
      const newPR = new Map<string, number>();
      for (const id of this.nodes.keys()) {
        newPR.set(id, (1 - damping) / n);
      }

      for (const edge of this.edges) {
        const outDeg = outDegree.get(edge.source) || 0;
        if (outDeg > 0) {
          const contribution = damping * (pr.get(edge.source) || 0) / outDeg;
          newPR.set(edge.target, (newPR.get(edge.target) || 0) + contribution);
        }
      }

      pr = newPR;
    }

    return pr;
  }

  /**
   * Export graph as JSON.
   */
  toJSON(): GraphJSON {
    return {
      nodes: this.getNodes().map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        properties: n.properties
      })),
      edges: this.edges.map(e => ({
        source: e.source,
        target: e.target,
        condition: e.condition,
        weight: e.weight
      }))
    };
  }

  /**
   * Get the number of nodes in the graph.
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Check if a node exists in the graph.
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }
}

/**
 * StateGraph represents a LangGraph-style state graph for agent orchestration.
 */
export interface GraphState {
  data: Record<string, unknown>;
  messages: Array<{
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  version: number;
  timestamp: Date;
}

export type NodeHandler = (state: GraphState) => Promise<Partial<GraphState> | null>;
export type EdgeCondition = (state: GraphState) => string | null;

export interface StateGraphNode {
  id: string;
  type: NodeType;
  name: string;
  handler: NodeHandler;
  metadata?: Record<string, unknown>;
}

export interface StateGraphEdge {
  from: string;
  to: string;
  condition?: EdgeCondition;
}

/**
 * StateGraph provides LangGraph-style state management for agent orchestration.
 */
export class StateGraph {
  private nodes: Map<string, StateGraphNode> = new Map();
  private edges: Map<string, StateGraphEdge[]> = new Map();
  private state: GraphState;

  constructor(initialState: GraphState = {
    data: {},
    messages: [],
    version: 0,
    timestamp: new Date()
  }) {
    this.state = initialState;
  }

  /**
   * Add a node to the state graph.
   */
  addNode(node: StateGraphNode): this {
    this.nodes.set(node.id, node);
    return this;
  }

  /**
   * Add an edge between two nodes.
   */
  addEdge(from: string, to: string, condition?: EdgeCondition): this {
    const edge: StateGraphEdge = { from, to, condition };
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from)!.push(edge);
    return this;
  }

  /**
   * Validate the graph structure.
   */
  compile(): void {
    for (const edges of this.edges.values()) {
      for (const edge of edges) {
        if (!this.nodes.has(edge.from)) {
          throw new Error(`Edge from non-existent node: ${edge.from}`);
        }
        if (!this.nodes.has(edge.to)) {
          throw new Error(`Edge to non-existent node: ${edge.to}`);
        }
      }
    }

    if (!this.nodes.has('start')) {
      throw new Error('Graph must have a start node');
    }
  }

  /**
   * Run the graph from start to end.
   */
  async invoke(): Promise<GraphState> {
    this.compile();

    let currentNode = 'start';

    while (currentNode !== 'end') {
      const node = this.nodes.get(currentNode);
      if (!node) {
        throw new Error(`Node not found: ${currentNode}`);
      }

      // Execute node handler
      const result = await node.handler(this.state);

      // Update state
      if (result) {
        this.state = {
          ...this.state,
          ...result,
          version: this.state.version + 1,
          timestamp: new Date()
        };
      }

      // Determine next node
      const nodeEdges = this.edges.get(currentNode) || [];

      if (nodeEdges.length === 0) {
        break;
      }

      if (nodeEdges.length === 1 && !nodeEdges[0].condition) {
        currentNode = nodeEdges[0].to;
        continue;
      }

      // Evaluate conditions
      let nextNode: string | null = null;
      for (const edge of nodeEdges) {
        if (edge.condition) {
          const target = edge.condition(this.state);
          if (target) {
            nextNode = target;
            break;
          }
        }
      }

      if (!nextNode) {
        break;
      }
      currentNode = nextNode;
    }

    return this.state;
  }

  /**
   * Get the current state.
   */
  getState(): GraphState {
    return this.state;
  }
}
