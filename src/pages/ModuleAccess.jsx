import { useState, useEffect } from "react"
import { Users, Plus, Edit, Trash2, Shield, Eye, Pencil, X, Check } from "lucide-react"

const API_URL = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

// All modules matching the sidebar
const MODULES = [
  { key: "branches", label: "Branches" },
  { key: "categories", label: "Categories" },
  { key: "menu", label: "Menu" },
  { key: "tableQrGenerator", label: "Table QR Generator" },
  { key: "tables", label: "Tables" },
  { key: "tableReservations", label: "Table Reservations" },
  { key: "categorizedOrders", label: "Categorized Orders" },
  { key: "salesReports", label: "Sales Reports" },
  { key: "qrUploads", label: "QR Uploads" },
  { key: "contactMessages", label: "Contact Messages" },
  { key: "members", label: "Members" },
  { key: "events", label: "Events" },
  { key: "gallery", label: "Gallery" },
  { key: "staffUsers", label: "Staff Users" },
  { key: "counterUsers", label: "Counter Users" },
  { key: "servers", label: "Servers / Waiters" },
  { key: "purchaseUsers", label: "Purchase Users" },
  { key: "categoryAccess", label: "Category Access" },
  { key: "moduleAccess", label: "Module Access" },
]

// ─── User Modal ──────────────────────────────────────────────────────────────
const UserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    isSuperAdmin: user?.isSuperAdmin || false,
    isActive: user?.isActive !== false,
    permissions: user?.permissions || {},
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const getPermission = (moduleKey, action) => {
    return formData.permissions?.[moduleKey]?.[action] || false
  }

  const setPermission = (moduleKey, action, value) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions?.[moduleKey],
          [action]: value,
        },
      },
    }))
  }

  const toggleAllForModule = (moduleKey) => {
    const current = formData.permissions?.[moduleKey] || {}
    const allTrue = current.view && current.edit && current.delete
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: { view: !allTrue, edit: !allTrue, delete: !allTrue },
      },
    }))
  }

  const selectAll = () => {
    const allPerms = {}
    MODULES.forEach((m) => { allPerms[m.key] = { view: true, edit: true, delete: true } })
    setFormData((prev) => ({ ...prev, permissions: allPerms }))
  }

  const clearAll = () => {
    const emptyPerms = {}
    MODULES.forEach((m) => { emptyPerms[m.key] = { view: false, edit: false, delete: false } })
    setFormData((prev) => ({ ...prev, permissions: emptyPerms }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!formData.name.trim()) { setError("Name is required"); return }
    if (!formData.email.trim()) { setError("Email is required"); return }
    if (!user && !formData.password.trim()) { setError("Password is required for new user"); return }
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      setError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "20px"
    }}>
      <div style={{
        background: "white", borderRadius: "16px", padding: "28px",
        maxWidth: "750px", width: "100%", maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b" }}>
            {user ? "Edit User" : "Add New User"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: "#dc2626", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Name *</label>
              <input
                type="text" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Ravi Manager"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "0.85rem", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Email *</label>
              <input
                type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g., ravi@jagalikoota.com"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "0.85rem", marginTop: "4px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                Password {user ? "(leave blank to keep)" : "*"}
              </label>
              <input
                type="password" value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={user ? "••••••••" : "Enter password"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "0.85rem", marginTop: "4px" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox" checked={formData.isSuperAdmin}
                  onChange={(e) => setFormData({ ...formData, isSuperAdmin: e.target.checked })}
                />
                <Shield size={14} /> Super Admin
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox" checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          {/* Permissions Table */}
          {!formData.isSuperAdmin && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "0.9rem", color: "#1e293b" }}>Module Permissions</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={selectAll} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer" }}>
                    Select All
                  </button>
                  <button type="button" onClick={clearAll} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #dc2626", background: "#fef2f2", color: "#dc2626", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer" }}>
                    Clear All
                  </button>
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "700", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Module</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: "700", color: "#64748b", borderBottom: "1px solid #e2e8f0", width: "80px" }}>View</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: "700", color: "#64748b", borderBottom: "1px solid #e2e8f0", width: "80px" }}>Edit</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: "700", color: "#64748b", borderBottom: "1px solid #e2e8f0", width: "80px" }}>Delete</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: "700", color: "#64748b", borderBottom: "1px solid #e2e8f0", width: "60px" }}>All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, i) => (
                      <tr key={mod.key} style={{ borderBottom: i < MODULES.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "8px 14px", fontWeight: "500", color: "#1e293b" }}>{mod.label}</td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <input type="checkbox" checked={getPermission(mod.key, "view")} onChange={(e) => setPermission(mod.key, "view", e.target.checked)} />
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <input type="checkbox" checked={getPermission(mod.key, "edit")} onChange={(e) => setPermission(mod.key, "edit", e.target.checked)} />
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <input type="checkbox" checked={getPermission(mod.key, "delete")} onChange={(e) => setPermission(mod.key, "delete", e.target.checked)} />
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <button type="button" onClick={() => toggleAllForModule(mod.key)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: "0.7rem", fontWeight: "600" }}>
                            Toggle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {formData.isSuperAdmin && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", color: "#166534", fontSize: "0.85rem" }}>
              <Shield size={14} style={{ marginRight: "6px" }} />
              Super Admin has full access to all modules. No permission configuration needed.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#69221b", color: "white", fontSize: "0.85rem", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : user ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const ModuleAccess = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [successMsg, setSuccessMsg] = useState("")

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/admin-access`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (err) {
      setError("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleSave = async (formData) => {
    const isEdit = !!editingUser
    const url = isEdit ? `${API_URL}/admin-access/${editingUser._id}` : `${API_URL}/admin-access`
    const method = isEdit ? "PUT" : "POST"

    // Don't send empty password on edit
    const payload = { ...formData }
    if (isEdit && !payload.password) delete payload.password

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || "Failed to save")

    setSuccessMsg(isEdit ? "User updated successfully" : "User created successfully")
    setTimeout(() => setSuccessMsg(""), 3000)
    fetchUsers()
  }

  const handleDelete = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      const res = await fetch(`${API_URL}/admin-access/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSuccessMsg("User deleted")
      setTimeout(() => setSuccessMsg(""), 3000)
      fetchUsers()
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(""), 3000)
    }
  }

  const countPermissions = (permissions) => {
    if (!permissions) return 0
    let count = 0
    Object.values(permissions).forEach((p) => {
      if (p.view) count++
      if (p.edit) count++
      if (p.delete) count++
    })
    return count
  }

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Shield size={24} /> Module Access
        </h1>
        <button
          className="btn btn-primary"
          onClick={() => { setEditingUser(null); setShowModal(true) }}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {successMsg && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "10px 16px", marginBottom: "16px", color: "#166534", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
          <Check size={14} /> {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 16px", marginBottom: "16px", color: "#dc2626", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading users...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>
          <Users size={48} strokeWidth={1} style={{ marginBottom: "12px", opacity: 0.4 }} />
          <p style={{ fontSize: "1rem", fontWeight: "600", color: "#475569" }}>No users yet</p>
          <p style={{ fontSize: "0.82rem" }}>Click "Add User" to create module-access users</p>
        </div>
      ) : (
        <div className="data-card">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td style={{ fontWeight: "600" }}>{user.name}</td>
                  <td style={{ color: "#64748b", fontSize: "0.85rem" }}>{user.email}</td>
                  <td>
                    {user.isSuperAdmin ? (
                      <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
                        Super Admin
                      </span>
                    ) : (
                      <span style={{ background: "#f0f7fa", color: "#3f5d6b", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
                        User
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    {user.isSuperAdmin ? "Full Access" : `${countPermissions(user.permissions)} permissions`}
                  </td>
                  <td>
                    {user.isActive ? (
                      <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "600" }}>Active</span>
                    ) : (
                      <span style={{ background: "#f3f4f6", color: "#9ca3af", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "600" }}>Inactive</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => { setEditingUser(user); setShowModal(true) }}
                        className="action-btn edit"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="action-btn delete"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => { setShowModal(false); setEditingUser(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default ModuleAccess
