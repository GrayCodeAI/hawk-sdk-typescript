import assert from "node:assert/strict";
import test from "node:test";
import { parseGraphExport } from "../src/index.js";

function graph() {
  const now = new Date().toISOString();
  return {
    schema_version: "hawk.graph/v1",
    generated_at: now,
    nodes: [
      {
        id: "session-1",
        kind: "execution",
        created_at: now,
        provenance: { producer: "hawk" },
      },
    ],
    edges: [],
    events: [
      {
        id: "event-1",
        type: "observed",
        subject: { kind: "execution", id: "session-1" },
        occurred_at: now,
        provenance: { producer: "hawk" },
      },
    ],
  };
}

test("parseGraphExport validates portable graph topology", () => {
  const parsed = parseGraphExport(graph());
  assert.equal(parsed.nodes[0]?.kind, "execution");
  assert.equal(parsed.events[0]?.subject.id, "session-1");
});

test("parseGraphExport rejects dangling events", () => {
  const value = graph();
  value.nodes = [];
  assert.throws(() => parseGraphExport(value), /Dangling graph event/);
});

test("parseGraphExport rejects non-string portable attributes", () => {
  const value = graph();
  Object.assign(value.nodes[0]!, { attributes: { tokens: 42 } });
  assert.throws(() => parseGraphExport(value), /graph.nodes\[0\].attributes/);
});
