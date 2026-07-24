import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react"

const API_BASE_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/servers"
const BRANCH_API_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/branch"

export default function Servers() {
  const [servers, setServers] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingServer, setEditingServer] = useState(null)
  const [formName, setFormName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchBranches()
  }, [])

  useEffect(() => {
    if (selectedBranch) fetchServers()
  }, [selectedBranch])

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API_URL)
      const data = await response.json()
      const branchList = data.branches || data || []
      setBranches(branchList)
      if (branchList.length > 0) {
        setSelectedBranch(branchList[0]._id)
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err)
    }
  }

  const fetchServers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/all?branchId=${selectedBranch}`)
      const data = await response.json()
      setServers(data.servers || [])
    } catch (err) {
      console.error("Failed to fetch servers:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("Please enter a name")
      return
    }
    setSaving(true)
    setError("")

    try {
      if (editingServer) {
        const response = await fetch(`${API_BASE_URL}/${editingServer._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim() })
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || "Failed to update")
      } else {
        const response = await fetch(API_BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), branchId: selectedBranch })
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || "Failed to add")
      }

      setShowForm(false)
      setEditingServer(null)
      setFormName("")
      fetchServers()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete")
      fetchServers()
    } catch (err) {
      alert("Failed to delete: " + err.message)
    }
  }

  const handleEdit = (server) => {
    setEditingServer(server)
    setFormName(server.name)
    setShowForm(true)
    setError("")
  }

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "1.5rem", fontWeight: "700", color: "#1a202c", display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={24} /> Servers / Waiters
          </h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#718096" }}>
            Manage server/waiter names for KOT orders
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingServer(null); setFormName(""); setError("") }}
          style={{
            background: "#69221b",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "0.875rem",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Plus size={16} /> Add Server
        </button>
      </div>

      {/* Branch Selector */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#4a5568", display: "block", marginBottom: "6px" }}>
          Select Branch:
        </label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "2px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: "0.875rem",
            minWidth: "200px"
          }}
        >
          {branches.map(branch => (
            <option key={branch._id} value={branch._id}>{branch.name}</option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          background: "#f8fafc",
          border: "2px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#1a202c" }}>
            {editingServer ? "Edit Server/Waiter" : "Add New Server/Waiter"}
          </h3>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#4a5568", display: "block", marginBottom: "4px" }}>
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setError("") }}
                placeholder="Enter server/waiter name"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  outline: "none"
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "0.875rem",
                fontWeight: "600",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? "Saving..." : (editingServer ? "Update" : "Add")}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingServer(null); setFormName(""); setError("") }}
              style={{
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "10px 16px",
                fontSize: "0.875rem",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p style={{ margin: "8px 0 0 0", fontSize: "0.8rem", color: "#dc2626" }}>{error}</p>
          )}
        </div>
      )}

      {/* Servers List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> Loading...
        </div>
      ) : servers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#718096", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
          <Users size={40} style={{ marginBottom: "8px", opacity: 0.5 }} />
          <p style={{ margin: 0 }}>No servers/waiters added yet. Click "Add Server" to get started.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
          {servers.map((server, index) => (
            <div
              key={server._id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: index < servers.length - 1 ? "1px solid #e2e8f0" : "none",
                background: server.isActive ? "white" : "#f9fafb"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#69221b",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "0.875rem"
                }}>
                  {server.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: "600", color: "#1a202c" }}>{server.name}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#718096" }}>
                    {server.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleEdit(server)}
                  style={{
                    background: "#eef2ff",
                    color: "#4f46e5",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(server._id, server.name)}
                  style={{
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
