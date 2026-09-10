import React, { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Search, ChevronLeft, ChevronRight, X, Users2 } from "lucide-react"
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: { "Content-Type": "application/json" },
})

const AffiliatedMembers = () => {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", clubName: "", clubLocation: "", membershipId: "", purpose: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { fetchMembers() }, [page, search])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const res = await api.get("/affiliated-members", { params: { page, limit: 20, search } })
      setMembers(res.data.members || [])
      const pag = res.data.pagination || {}
      setTotalPages(pag.totalPages || 1)
      setTotal(pag.total || 0)
    } catch (e) {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: "", phone: "", email: "", address: "", clubName: "", clubLocation: "", membershipId: "", purpose: "", notes: "" })
    setShowModal(true)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({
      name: m.name || "", phone: m.phone || "", email: m.email || "",
      address: m.address || "", clubName: m.clubName || "", clubLocation: m.clubLocation || "",
      membershipId: m.membershipId || "", purpose: m.purpose || "", notes: m.notes || "",
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/affiliated-members/${editing._id}`, form)
      } else {
        await api.post("/affiliated-members", form)
      }
      setShowModal(false)
      fetchMembers()
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/affiliated-members/${id}`)
      setDeleteConfirm(null)
      fetchMembers()
    } catch (err) {
      alert("Failed to delete")
      setDeleteConfirm(null)
    }
  }

  const s = {
    container: { padding: "24px", fontFamily: "'Inter', sans-serif", minHeight: "100vh", background: "#f9fafb" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" },
    title: { fontSize: "24px", fontWeight: "700", color: "#1f2937", display: "flex", alignItems: "center", gap: "10px" },
    addBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", background: "#7a1f1f", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" },
    searchWrap: { position: "relative", maxWidth: "400px", marginBottom: "20px" },
    searchIcon: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6b7280" },
    searchInput: { width: "100%", padding: "10px 12px 10px 40px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" },
    tableWrap: { background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" },
    td: { padding: "12px 16px", fontSize: "14px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
    actionBtn: (color) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", cursor: "pointer", color, marginRight: "6px" }),
    pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid #e5e7eb" },
    pageBtn: (disabled) => ({ display: "flex", alignItems: "center", gap: "4px", padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: "6px", background: disabled ? "#f3f4f6" : "#fff", color: disabled ? "#9ca3af" : "#374151", cursor: disabled ? "not-allowed" : "pointer", fontSize: "13px" }),
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: "#fff", borderRadius: "12px", width: "90%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto" },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e5e7eb" },
    modalTitle: { fontSize: "18px", fontWeight: "600", color: "#1f2937" },
    modalBody: { padding: "24px" },
    formGroup: { marginBottom: "14px" },
    label: { display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "5px" },
    input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
    textarea: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", resize: "vertical", minHeight: "60px", boxSizing: "border-box" },
    submitBtn: { width: "100%", padding: "12px", background: "#7a1f1f", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", marginTop: "8px" },
    empty: { textAlign: "center", padding: "60px 20px", color: "#6b7280" },
    closeBtn: { background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: "4px", display: "flex" },
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}><Users2 size={24} color="#7a1f1f" /> Affiliated Members</h1>
        <button style={s.addBtn} onClick={openCreate}><Plus size={16} /> Add Member</button>
      </div>

      <div style={s.searchWrap}>
        <Search size={18} style={s.searchIcon} />
        <input placeholder="Search by name, phone, or club..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={s.searchInput} />
      </div>

      <div style={s.tableWrap}>
        {loading ? <div style={s.empty}>Loading...</div> : members.length === 0 ? (
          <div style={s.empty}><Users2 size={40} color="#d1d5db" /><p style={{ marginTop: "12px" }}>No affiliated members found</p></div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>Club</th>
                    <th style={s.th}>Club Location</th>
                    <th style={s.th}>Member ID</th>
                    <th style={s.th}>Visit Date</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m._id}>
                      <td style={{ ...s.td, fontWeight: "500" }}>{m.name}</td>
                      <td style={s.td}>{m.phone}</td>
                      <td style={s.td}>{m.clubName}</td>
                      <td style={s.td}>{m.clubLocation || "—"}</td>
                      <td style={s.td}>{m.membershipId || "—"}</td>
                      <td style={s.td}>{m.visitDate ? new Date(m.visitDate).toLocaleDateString() : "—"}</td>
                      <td style={s.td}>
                        <button style={s.actionBtn("#2563eb")} onClick={() => openEdit(m)} title="Edit"><Edit2 size={15} /></button>
                        <button style={s.actionBtn("#dc2626")} onClick={() => setDeleteConfirm(m)} title="Delete"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={s.pagination}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Page {page} of {totalPages} ({total} total)</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={s.pageBtn(page <= 1)} disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /> Prev</button>
                <button style={s.pageBtn(page >= totalPages)} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editing ? "Edit Member" : "Add Affiliated Member"}</h2>
              <button style={s.closeBtn} onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={s.modalBody}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={s.formGroup}>
                    <label style={s.label}>Name *</label>
                    <input style={s.input} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Phone *</label>
                    <input style={s.input} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} required />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Email</label>
                    <input style={s.input} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Club Name *</label>
                    <input style={s.input} value={form.clubName} onChange={(e) => setForm({...form, clubName: e.target.value})} required />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Club Location</label>
                    <input style={s.input} value={form.clubLocation} onChange={(e) => setForm({...form, clubLocation: e.target.value})} />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Membership ID</label>
                    <input style={s.input} value={form.membershipId} onChange={(e) => setForm({...form, membershipId: e.target.value})} />
                  </div>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Address</label>
                  <textarea style={s.textarea} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Purpose of Visit</label>
                  <input style={s.input} value={form.purpose} onChange={(e) => setForm({...form, purpose: e.target.value})} placeholder="e.g. Dining, Event, Sports" />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Notes</label>
                  <textarea style={s.textarea} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
                </div>
                <button type="submit" style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Update Member" : "Add Member"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={s.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...s.modal, maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Confirm Delete</h2>
              <button style={s.closeBtn} onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <div style={s.modalBody}>
              <p style={{ fontSize: "14px", color: "#374151", marginBottom: "20px" }}>
                Delete <strong>{deleteConfirm.name}</strong> from affiliated members?
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", cursor: "pointer" }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button style={{ padding: "8px 16px", border: "none", borderRadius: "6px", background: "#dc2626", color: "#fff", cursor: "pointer" }} onClick={() => handleDelete(deleteConfirm._id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AffiliatedMembers
