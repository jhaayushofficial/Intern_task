import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import cytoscape from "cytoscape";
import "./App.css";

const API = "http://localhost:3000";

const edgeColors = {
  MADE: "#1976d2",
  TO: "#388e3c",
  SHARES_PHONE: "#8e24aa",
  SHARES_EMAIL: "#5e35b1",
  SHARES_IP: "#f4511e",
  SHARES_DEVICE: "#6d4c41",
  SHARES_ADDRESS: "#795548",
  SHARES_PAYMENT_METHOD: "#ad1457",
  SAME_IP: "#fb8c00",
  SAME_DEVICE: "#00897b",
  SAME_SENDER: "#00acc1",
  SAME_RECEIVER: "#c0ca33",
  // New per-party transaction relations
  SAME_SENDER_IP: "#ff8f00",
  SAME_RECEIVER_IP: "#ffa000",
  SAME_SENDER_DEVICE: "#26a69a",
  SAME_RECEIVER_DEVICE: "#80cbc4",
};

// Human-friendly explanations for each relation and when they are created
const relationDescriptions = {
  // Directional edges
  MADE: "User -> Transaction. Created when a transaction is inserted; links the sender user to the new transaction.",
  TO: "Transaction -> User. Created when a transaction is inserted; points from the transaction to the receiver user.",

  // Undirected (collapsed) user-user signals
  SHARES_EMAIL:
    "User — User. Created when two users have the exact same email address.",
  SHARES_PHONE:
    "User — User. Created when two users have the exact same phone number.",
  SHARES_IP:
    "User — User. Created when two users are observed using the same IP address in their activity.",
  SHARES_DEVICE:
    "User — User. Created when two users are observed using the same device (fingerprint).",
  SHARES_ADDRESS:
    "User — User. Created when two users have the exact same address.",
  SHARES_PAYMENT_METHOD:
    "User — User. Created when two users have the same payment method.",

  // Undirected (collapsed) transaction-transaction signals
  SAME_IP:
    "Transaction — Transaction. Created when two transactions share the same IP address.",
  SAME_DEVICE:
    "Transaction — Transaction. Created when two transactions share the same device (fingerprint).",
  SAME_SENDER:
    "Transaction — Transaction. Created when two transactions have the same sender user.",
  SAME_RECEIVER:
    "Transaction — Transaction. Created when two transactions have the same receiver user.",
  SAME_SENDER_IP:
    "Transaction — Transaction. Created when two transactions have the same sender IP.",
  SAME_RECEIVER_IP:
    "Transaction — Transaction. Created when two transactions have the same receiver IP.",
  SAME_SENDER_DEVICE:
    "Transaction — Transaction. Created when two transactions have the same sender device.",
  SAME_RECEIVER_DEVICE:
    "Transaction — Transaction. Created when two transactions have the same receiver device.",
};

const undirectedTypes = new Set([
  "SHARES_EMAIL",
  "SHARES_PHONE",
  "SHARES_IP",
  "SHARES_DEVICE",
  "SHARES_ADDRESS",
  "SHARES_PAYMENT_METHOD",
  "SAME_IP",
  "SAME_DEVICE",
  "SAME_SENDER",
  "SAME_RECEIVER",
  "SAME_SENDER_IP",
  "SAME_RECEIVER_IP",
  "SAME_SENDER_DEVICE",
  "SAME_RECEIVER_DEVICE",
]);

function useFetch(url) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let mounted = true;
    if (!url) {
      setData([]);
      setLoading(false);
      setError(null);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);
    axios
      .get(url)
      .then((r) => {
        if (mounted) setData(r.data);
      })
      .catch((e) => {
        if (mounted) setError(e);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [url]);
  return { data, loading, error };
}

// Convert backend graph to Cytoscape elements
// options: { nameById?: Record<string,string>, txLabelById?: Record<string,string> }
function toCytoscape(graph, options = {}) {
  if (!graph) return [];
  const rawNodes = [...(graph.nodes || [])];
  const rawEdges = [...(graph.edges || [])];
  const nameById = options.nameById || {};
  const txLabelById = options.txLabelById || {};

  // 1) Pre-compute a type map with multiple heuristics
  const typeMap = new Map(); // id -> 'User' | 'Transaction' | 'Node'
  const nodeMap = new Map(); // id -> raw node
  for (const n of rawNodes) {
    const id = String(n.id ?? n.identity ?? n.nodeId ?? n.uid ?? n.key ?? n);
    nodeMap.set(id, n);
    let t =
      n.labelType ||
      n.type ||
      n.kind ||
      (Array.isArray(n.labels) && n.labels[0]) ||
      (typeof n.labels === "string" ? n.labels : undefined) ||
      (typeof n.label === "string" &&
      (n.label === "User" || n.label === "Transaction")
        ? n.label
        : undefined);
    if (!t) {
      // Fallback heuristic from typical properties
      if (
        n.amount !== undefined ||
        n.timestamp !== undefined ||
        n.fromUserId !== undefined ||
        n.toUserId !== undefined ||
        n?.properties?.amount !== undefined ||
        n?.properties?.timestamp !== undefined ||
        n?.properties?.fromUserId !== undefined ||
        n?.properties?.toUserId !== undefined
      ) {
        t = "Transaction";
      } else if (
        n.email !== undefined ||
        n.phone !== undefined ||
        n.address !== undefined ||
        n?.properties?.email !== undefined ||
        n?.properties?.phone !== undefined ||
        n?.properties?.address !== undefined ||
        n?.properties?.name !== undefined
      ) {
        t = "User";
      }
    }
    typeMap.set(id, t || "Node");
  }

  // 2) Refine types based on edge semantics
  for (const e of rawEdges) {
    const type = e.type ?? e.relation ?? e.label ?? "RELATED";
    const source = String(e.source ?? e.from ?? e.start ?? e.src ?? "");
    const target = String(e.target ?? e.to ?? e.end ?? e.dst ?? "");
    if (type === "MADE") {
      // User -> Transaction
      if (source) typeMap.set(source, "User");
      if (target) typeMap.set(target, "Transaction");
    }
    if (type === "TO") {
      // Transaction -> User
      if (source) typeMap.set(source, "Transaction");
      if (target) typeMap.set(target, "User");
    }
  }

  // 3) Build Cytoscape nodes with final types and labels
  const nodes = rawNodes.map((n) => {
    const id = String(n.id ?? n.identity ?? n.nodeId ?? n.uid ?? n.key ?? n);
    const businessId = String(
      n.domainId ?? n?.properties?.id ?? n.businessId ?? n.externalId ?? id
    );
    const labelType = typeMap.get(id) || "Node";
    let label;
    if (labelType === "User") {
      // Prefer provided map, then common name fields; if nothing, synthesize a readable fallback
      const possibleName =
        nameById[businessId] ??
        n.name ??
        n?.properties?.name ??
        (typeof n.displayName === "string" ? n.displayName : undefined) ??
        n.username ??
        n.fullName ??
        n.userName;
      const safeName =
        (possibleName && String(possibleName).trim()) || `${businessId}`;
      // match card style without extra space before parens
      label = `${safeName}(${businessId})`;
    } else if (labelType === "Transaction") {
      const txText =
        txLabelById[businessId] ??
        n.transactionId ??
        n?.properties?.id ??
        n.txId ??
        n.tid ??
        n.uuid ??
        n.externalId ??
        `${businessId}`;
      label = `${txText}`;
    } else {
      // If the backend uses 'label' for type, avoid echoing it as the text
      const isTypeLike = n.label === "User" || n.label === "Transaction";
      label = isTypeLike ? `${id}` : n.label ?? n.name ?? `${id}`;
    }
    return { data: { id, label, labelType } };
  });

  // 4) Build Cytoscape edges with de-duplication for undirected relations
  const edgeMap = new Map();
  const edges = [];
  rawEdges.forEach((e, idx) => {
    const type = e.type ?? e.relation ?? e.label ?? "RELATED";
    const source = String(e.source ?? e.from ?? e.start ?? e.src ?? "");
    const target = String(e.target ?? e.to ?? e.end ?? e.dst ?? "");
    const color = edgeColors[type] || "#9e9e9e";

    if (undirectedTypes.has(type)) {
      // normalize pair order so A-B equals B-A
      const [a, b] = source < target ? [source, target] : [target, source];
      const key = `${a}|${b}|${type}`;
      if (!edgeMap.has(key)) {
        const id = e.id ?? `${a}-${type}-${b}`;
        const entry = {
          key,
          data: { id, source: a, target: b, type, color },
        };
        edgeMap.set(key, entry);
        edges.push({ data: entry.data });
      }
      // ignore duplicates by design (keeps a single line)
    } else {
      // keep directional edges; also skip exact duplicates in same direction
      const key = `${source}|${target}|${type}`;
      if (!edgeMap.has(key)) {
        const id = e.id ?? `${source}-${type}-${target}-${idx}`;
        const entry = { key, data: { id, source, target, type, color } };
        edgeMap.set(key, entry);
        edges.push({ data: entry.data });
      }
    }
  });
  return [...nodes, ...edges];
}

function Graph({ elements }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  const stylesheet = useMemo(
    () => [
      {
        selector: "node",
        style: {
          "background-color": "#90caf9",
          label: "data(label)",
          "font-size": 12,
          color: "#eaeaea",
          "text-outline-width": 2,
          "text-outline-color": "#333333",
        },
      },
      {
        selector: 'node[labelType = "User"]',
        style: {
          "background-color": "#64b5f6",
          shape: "ellipse", // circle
          width: 40,
          height: 40,
        },
      },
      {
        selector: 'node[labelType = "Transaction"]',
        style: {
          "background-color": "#81c784",
          shape: "round-rectangle", // rounded square
          width: 42,
          height: 42,
        },
      },
      {
        selector: "edge",
        style: {
          "line-color": "data(color)",
          "target-arrow-color": "data(color)",
          "source-arrow-color": "data(color)",
          "target-arrow-shape": "none",
          "source-arrow-shape": "none",
          width: 2,
          "curve-style": "bezier",
          opacity: 0.9,
          label: "data(type)",
          color: "#ffffff", // make relation names clearly visible
          "font-size": 9,
          "text-background-color": "#1f1f1f",
          "text-background-opacity": 1,
          "text-background-padding": 2,
        },
      },
      {
        selector: "edge[type = 'MADE'], edge[type = 'TO']",
        style: {
          "target-arrow-shape": "triangle",
        },
      },
      {
        selector:
          "edge[type = 'SHARES_EMAIL'], edge[type = 'SHARES_PHONE'], edge[type = 'SHARES_IP'], edge[type = 'SHARES_DEVICE'], edge[type = 'SHARES_ADDRESS'], edge[type = 'SHARES_PAYMENT_METHOD'], edge[type = 'SAME_IP'], edge[type = 'SAME_DEVICE'], edge[type = 'SAME_SENDER'], edge[type = 'SAME_RECEIVER'], edge[type = 'SAME_SENDER_IP'], edge[type = 'SAME_RECEIVER_IP'], edge[type = 'SAME_SENDER_DEVICE'], edge[type = 'SAME_RECEIVER_DEVICE']",
        style: {
          "target-arrow-shape": "none",
          "source-arrow-shape": "none",
        },
      },
    ],
    []
  );

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;
    cyRef.current = cytoscape({
      container: containerRef.current,
      style: stylesheet,
      wheelSensitivity: 0.2,
      pixelRatio: 1,
    });
    cyRef.current.minZoom(0.2);
    cyRef.current.maxZoom(3);

    let ro;
    if (window.ResizeObserver && wrapperRef.current) {
      ro = new ResizeObserver(() => {
        if (!cyRef.current) return;
        cyRef.current.resize();
        cyRef.current.fit(undefined, 30);
      });
      ro.observe(wrapperRef.current);
    } else {
      const onResize = () => {
        if (!cyRef.current) return;
        cyRef.current.resize();
        cyRef.current.fit(undefined, 30);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    return () => {
      if (ro) ro.disconnect();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [stylesheet]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.elements().remove();
    if (elements && elements.length) cy.add(elements);
    const layout = cy.layout({ name: "cose", animate: true, padding: 30 });
    layout.run();
    setTimeout(() => cy.fit(undefined, 40), 0);
  }, [elements]);

  return (
    <div
      ref={wrapperRef}
      style={{
        height: "600px",
        border: "1px solid #444",
        borderRadius: 8,
        background: "#1f1f1f",
      }}
    >
      <div
        ref={containerRef}
        style={{
          height: "100%",
          width: "100%",
          boxSizing: "content-box",
          padding: 0,
          margin: 0,
        }}
      />
    </div>
  );
}

function Legend() {
  return (
    <div style={{ marginTop: 8 }}>
      <strong>Legend:</strong>{" "}
      <span style={{ opacity: 0.7, fontSize: 12 }}>
        (hover items to see what they mean)
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 4,
        }}
      >
        {Object.entries(edgeColors).map(([k, v]) => (
          <span
            key={k}
            title={relationDescriptions[k] || k}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "help",
            }}
          >
            <span
              style={{
                width: 12,
                height: 2,
                background: v,
                display: "inline-block",
              }}
            />{" "}
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsersPage() {
  const [pageKey, setPageKey] = useState(0);
  const { data: users = [] } = useFetch(`${API}/users?rk=${pageKey}`);
  const { data: transactions = [] } = useFetch(
    `${API}/transactions?rk=${pageKey}`
  );
  const [selectedUserId, setSelectedUserId] = useState("");
  const [graphKey, setGraphKey] = useState(0);
  const { data: userGraph } = useFetch(
    selectedUserId
      ? `${API}/relationships/user/${encodeURIComponent(
          selectedUserId
        )}?rk=${graphKey}`
      : null
  );

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.id, u.name, u.email, u.phone, u.address]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [users, query]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    ip: "",
    deviceId: "",
    paymentMethod: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");
  const formRef = useRef(null);
  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        formRef.current?.querySelector("input")?.focus();
      }, 0);
    }
  }, [showForm]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      id: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      ip: "",
      deviceId: "",
      paymentMethod: "",
    });
    setShowForm(true);
  };
  const openEdit = (u) => {
    setEditing(u.id);
    setForm({
      id: u.id || "",
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || "",
      address: u.address || "",
      ip: u.ip || "",
      deviceId: u.deviceId || "",
      paymentMethod: u.paymentMethod || "",
    });
    setShowForm(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setSaveOk("");
    try {
      if (editing) {
        const payload = { ...form };
        delete payload.id;
        await axios.put(`${API}/users/${encodeURIComponent(form.id)}`, payload);
        setSaveOk("User updated");
      } else {
        await axios.post(`${API}/users`, form);
        setSaveOk("User saved");
      }
      setShowForm(false);
      setPageKey((k) => k + 1);
      if (selectedUserId) setGraphKey((k) => k + 1);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Save failed";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, padding: "8px 16px" }}>
      <aside
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRight: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            onClick={openAdd}
            style={{
              background: "#1976d2",
              color: "white",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            + Add User
          </button>
        </div>

        {showForm && (
          <form
            ref={formRef}
            onSubmit={submit}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 8,
              padding: 12,
              borderBottom: "1px solid #333",
              background: "#0f0f1f",
            }}
          >
            <input
              required
              placeholder="ID"
              value={form.id}
              readOnly={!!editing}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <input
              placeholder="IP Address"
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
            />
            <input
              placeholder="Device ID"
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
            />
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
            >
              <option value="">Select payment method</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="UPI">UPI</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                style={{
                  background: "#2e7d32",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : editing ? "Update" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  background: "#2a2a3a",
                  color: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #3a3a4a",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              {saveOk && <span style={{ color: "#81c784" }}>{saveOk}</span>}
              {saveError && (
                <span style={{ color: "#ef5350" }}>{saveError}</span>
              )}
            </div>
          </form>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {filtered.map((u) => (
            <div
              key={u.id}
              style={{
                background: "#1f1f2f",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #2e2e3e",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {u.name || u.id}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    style={{
                      background: "#1976d2",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUserId((prev) => (prev === u.id ? "" : u.id))
                    }
                    style={{
                      background:
                        selectedUserId === u.id ? "#455a64" : "#d32f2f",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {selectedUserId === u.id ? "Clear" : "Visualize"}
                  </button>
                </div>
              </div>
              <div>Email: {u.email || "-"}</div>
              <div>Phone: {u.phone || "-"}</div>
              <div>Address: {u.address || "-"}</div>
              <div>IP: {u.ip || "-"}</div>
              <div>Device ID: {u.deviceId || "-"}</div>
              <div>Payment Method: {u.paymentMethod || "-"}</div>
            </div>
          ))}
        </div>
      </aside>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 12px",
            borderBottom: "1px solid #333",
          }}
        >
          <h3 style={{ margin: 0 }}>Relationship Visualization</h3>
          {selectedUserId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ opacity: 0.85 }}>User: {selectedUserId}</strong>
              <button
                onClick={() => setSelectedUserId("")}
                style={{
                  background: "#2a2a3a",
                  color: "#ffffff",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #3a3a4a",
                  fontWeight: 700,
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Graph
            elements={toCytoscape(
              selectedUserId ? userGraph : { nodes: [], edges: [] },
              {
                nameById: Object.fromEntries(
                  (users || []).map((u) => [String(u.id), u.name || ""])
                ),
                txLabelById: Object.fromEntries(
                  (transactions || []).map((t) => [String(t.id), `Tx: ${t.id}`])
                ),
              }
            )}
          />
          <Legend />
        </div>
      </section>
    </div>
  );
}

function TransactionsPage() {
  const [pageKey, setPageKey] = useState(0);
  const { data: transactions = [] } = useFetch(
    `${API}/transactions?rk=${pageKey}`
  );
  const { data: users = [] } = useFetch(`${API}/users?rk=${pageKey}`);
  const [selectedTxId, setSelectedTxId] = useState("");
  const [graphKey, setGraphKey] = useState(0);
  const { data: txGraph } = useFetch(
    selectedTxId
      ? `${API}/relationships/transaction/${encodeURIComponent(
          selectedTxId
        )}?rk=${graphKey}`
      : null
  );

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    amount: "",
    timestamp: new Date().toISOString(),
    fromUserId: "",
    toUserId: "",
    // New per-party fields
    senderIp: "",
    receiverIp: "",
    senderDeviceId: "",
    receiverDeviceId: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");
  const formRef = useRef(null);
  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        formRef.current?.querySelector("input,select")?.focus();
      }, 0);
    }
  }, [showForm]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      id: "",
      amount: "",
      timestamp: new Date().toISOString(),
      fromUserId: "",
      toUserId: "",
      senderIp: "",
      receiverIp: "",
      senderDeviceId: "",
      receiverDeviceId: "",
    });
    setShowForm(true);
  };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({
      id: t.id || "",
      amount: t.amount ?? "",
      timestamp: t.timestamp || "",
      fromUserId: t.fromUserId || "",
      toUserId: t.toUserId || "",
      senderIp: t.senderIp || t.ip || "",
      receiverIp: t.receiverIp || "",
      senderDeviceId: t.senderDeviceId || t.deviceId || "",
      receiverDeviceId: t.receiverDeviceId || "",
    });
    setShowForm(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setSaveOk("");
    try {
      if (editing) {
        const payload = {
          amount: form.amount === "" ? null : Number(form.amount),
        };
        await axios.put(
          `${API}/transactions/${encodeURIComponent(form.id)}`,
          payload
        );
        setSaveOk("Transaction updated");
      } else {
        const payload = {
          ...form,
          amount: form.amount === "" ? null : Number(form.amount),
        };
        await axios.post(`${API}/transactions`, payload);
        setSaveOk("Transaction saved");
      }
      setShowForm(false);
      setPageKey((k) => k + 1);
      if (selectedTxId) setGraphKey((k) => k + 1);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Save failed";
      if (err?.response?.status === 409) {
        setSaveError("Transaction id already exists");
      } else {
        setSaveError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, padding: "8px 16px" }}>
      <aside
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRight: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={openAdd}
            style={{
              background: "#1976d2",
              color: "white",
              padding: "8px 12px",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            + Add Transaction
          </button>
        </div>

        {showForm && (
          <form
            ref={formRef}
            onSubmit={submit}
            style={{
              display: "grid",
              gridTemplateColumns: editing
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(1, minmax(0, 1fr))",
              gap: 8,
              padding: 12,
              borderBottom: "1px solid #333",
              background: "#0f0f1f",
            }}
          >
            <input
              required
              placeholder="ID"
              value={form.id}
              readOnly={!!editing}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <input
              placeholder="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            {!editing && (
              <>
                <input
                  placeholder="Timestamp"
                  value={form.timestamp}
                  onChange={(e) =>
                    setForm({ ...form, timestamp: e.target.value })
                  }
                />
                <select
                  value={form.fromUserId}
                  onChange={(e) =>
                    setForm({ ...form, fromUserId: e.target.value })
                  }
                >
                  <option value="">Select sender user…</option>
                  {(users || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.id} ({u.id})
                    </option>
                  ))}
                </select>
                <select
                  value={form.toUserId}
                  onChange={(e) =>
                    setForm({ ...form, toUserId: e.target.value })
                  }
                >
                  <option value="">Select receiver user…</option>
                  {(users || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.id} ({u.id})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Sender IP"
                  value={form.senderIp}
                  onChange={(e) =>
                    setForm({ ...form, senderIp: e.target.value })
                  }
                />
                <input
                  placeholder="Receiver IP"
                  value={form.receiverIp}
                  onChange={(e) =>
                    setForm({ ...form, receiverIp: e.target.value })
                  }
                />
                <input
                  placeholder="Sender Device ID"
                  value={form.senderDeviceId}
                  onChange={(e) =>
                    setForm({ ...form, senderDeviceId: e.target.value })
                  }
                />
                <input
                  placeholder="Receiver Device ID"
                  value={form.receiverDeviceId}
                  onChange={(e) =>
                    setForm({ ...form, receiverDeviceId: e.target.value })
                  }
                />
              </>
            )}
            <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
              <button
                type="submit"
                style={{
                  background: "#2e7d32",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : editing ? "Update" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  background: "#2a2a3a",
                  color: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #3a3a4a",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              {saveOk && <span style={{ color: "#81c784" }}>{saveOk}</span>}
              {saveError && (
                <span style={{ color: "#ef5350" }}>{saveError}</span>
              )}
            </div>
          </form>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {transactions.map((t) => (
            <div
              key={t.id}
              style={{
                background: "#1f1f2f",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #2e2e3e",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>Tx: {t.id}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    style={{
                      background: "#1976d2",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTxId((prev) => (prev === t.id ? "" : t.id))
                    }
                    style={{
                      background: selectedTxId === t.id ? "#455a64" : "#d32f2f",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {selectedTxId === t.id ? "Clear" : "Visualize"}
                  </button>
                </div>
              </div>
              <div>Amount: {t.amount ?? "-"}</div>
              <div>Sender IP: {t.senderIp ?? t.ip ?? "-"}</div>
              <div>Receiver IP: {t.receiverIp ?? "-"}</div>
              <div>Sender Device: {t.senderDeviceId ?? t.deviceId ?? "-"}</div>
              <div>Receiver Device: {t.receiverDeviceId ?? "-"}</div>
              <div style={{ marginTop: 4 }}>
                <div style={{ fontWeight: 600 }}>Sender</div>
                <div>{t.senderName ?? "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {t.senderEmail ?? ""}
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{ fontWeight: 600 }}>Receiver</div>
                <div>{t.receiverName ?? "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {t.receiverEmail ?? ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 12px",
            borderBottom: "1px solid #333",
          }}
        >
          <h3 style={{ margin: 0 }}>Relationship Visualization</h3>
          {selectedTxId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ opacity: 0.85 }}>Tx: {selectedTxId}</strong>
              <button
                onClick={() => setSelectedTxId("")}
                style={{
                  background: "#2a2a3a",
                  color: "#ffffff",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #3a3a4a",
                  fontWeight: 700,
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Graph
            elements={toCytoscape(
              selectedTxId ? txGraph : { nodes: [], edges: [] },
              {
                nameById: Object.fromEntries(
                  (users || []).map((u) => [String(u.id), u.name || ""])
                ),
                txLabelById: Object.fromEntries(
                  (transactions || []).map((t) => [String(t.id), `Tx: ${t.id}`])
                ),
              }
            )}
          />
          <Legend />
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("users");
  return (
    <div className="app" style={{ width: "100%" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #333",
          background: "#0b0b18",
          color: "#eaeaea",
        }}
      >
        <div style={{ fontWeight: 800 }}>Flagright</div>
        <nav style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => setPage("users")}
            style={{
              background: page === "users" ? "#1976d2" : "#2a2a3a",
              color: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border:
                page === "users" ? "1px solid #1976d2" : "1px solid #3a3a4a",
              fontWeight: 700,
            }}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setPage("transactions")}
            style={{
              background: page === "transactions" ? "#1976d2" : "#2a2a3a",
              color: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border:
                page === "transactions"
                  ? "1px solid #1976d2"
                  : "1px solid #3a3a4a",
              fontWeight: 700,
            }}
          >
            Transactions
          </button>
        </nav>
      </header>
      {page === "users" && <UsersPage />}
      {page === "transactions" && <TransactionsPage />}
    </div>
  );
}
