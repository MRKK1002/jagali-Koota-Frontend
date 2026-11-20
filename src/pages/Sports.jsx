import React, { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Users, Search, ChevronLeft, ChevronRight, X, Activity } from "lucide-react"
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const Sports = () => {
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 20

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingSport, setEditingSport] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priceMonthly: "",
    priceYearly: "",
    schedule: "",
    maxMembers: "",
  })
  const [imageFile, setImageFile] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState("")

  // Subscribers modal states
  const [showSubscribersModal, setShowSubscribersModal] = useState(false)
  const [subscribersSport, setSubscribersSport] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [subscriptionsPage, setSubscriptionsPage] = useState(1)
  const [subscriptionsTotalPages, setSubscriptionsTotalPages] = useState(1)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchSports()
  }, [page, search])

  const fetchSports = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/sports", {
        params: { page, limit, search },
      })
      const data = res.data
      setSports(data.sports || data.data || [])
      const pag = data.pagination || {}
      setTotalPages(pag.totalPages || data.totalPages || 1)
      setTotalCount(pag.total || data.total || 0)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch sports")
      setSports([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscriptions = async (sportId, pg = 1) => {
    try {
      setSubscriptionsLoading(true)
      const res = await api.get("/sports/admin/subscriptions", {
        params: { sportId, status: "", page: pg, limit: 20 },
      })
      const data = res.data
      setSubscriptions(data.subscriptions || data.data || [])
      const pag = data.pagination || {}
      setSubscriptionsTotalPages(pag.totalPages || data.totalPages || 1)
      setSubscriptionsPage(pg)
    } catch (err) {
      setSubscriptions([])
    } finally {
      setSubscriptionsLoading(false)
    }
  }

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const openCreateModal = () => {
    setEditingSport(null)
    setFormData({ name: "", description: "", priceMonthly: "", priceYearly: "", schedule: "", maxMembers: "" })
    setImageFile(null)
    setFormError("")
    setShowFormModal(true)
  }

  const openEditModal = (sport) => {
    setEditingSport(sport)
    setFormData({
      name: sport.name || "",
      description: sport.description || "",
      priceMonthly: sport.priceMonthly || "",
      priceYearly: sport.priceYearly || "",
      schedule: sport.schedule || "",
      maxMembers: sport.maxMembers || "",
    })
    setImageFile(null)
    setFormError("")
    setShowFormModal(true)
  }

  const openSubscribersModal = (sport) => {
    setSubscribersSport(sport)
    setSubscriptions([])
    setSubscriptionsPage(1)
    setShowSubscribersModal(true)
    fetchSubscriptions(sport._id, 1)
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError("")

    if (!formData.name.trim()) {
      setFormError("Name is required")
      setFormLoading(false)
      return
    }

    const data = new FormData()
    data.append("name", formData.name.trim())
    data.append("description", formData.description.trim())
    data.append("priceMonthly", Number(formData.priceMonthly))
    data.append("priceYearly", Number(formData.priceYearly))
    data.append("schedule", formData.schedule.trim())
    data.append("maxMembers", Number(formData.maxMembers))
    if (imageFile) data.append("image", imageFile)

    try {
      if (editingSport) {
        await api.put(`/sports/${editingSport._id}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      } else {
        await api.post("/sports", data, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      }
      setShowFormModal(false)
      fetchSports()
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save sport")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/sports/${id}`)
      setDeleteConfirm(null)
      fetchSports()
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete sport")
      setDeleteConfirm(null)
    }
  }

  // Styles
  const styles = {
    container: {
      padding: "24px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      minHeight: "100vh",
      background: "#f9fafb",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      flexWrap: "wrap",
      gap: "12px",
    },
    title: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#1f2937",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    addButton: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "10px 18px",
      background: "#7a1f1f",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
    },
    searchBar: {
      display: "flex",
      alignItems: "center",
      marginBottom: "20px",
      position: "relative",
      maxWidth: "400px",
    },
    searchIcon: {
      position: "absolute",
      left: "12px",
      color: "#6b7280",
    },
    searchInput: {
      width: "100%",
      padding: "10px 12px 10px 40px",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      outline: "none",
    },
    tableWrapper: {
      background: "#fff",
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "14px 16px",
      textAlign: "left",
      fontSize: "12px",
      fontWeight: "600",
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      borderBottom: "1px solid #e5e7eb",
      background: "#f9fafb",
    },
    td: {
      padding: "14px 16px",
      fontSize: "14px",
      color: "#374151",
      borderBottom: "1px solid #f3f4f6",
    },
    badge: (active) => ({
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: "500",
      background: active ? "#dcfce7" : "#fee2e2",
      color: active ? "#166534" : "#991b1b",
    }),
    actionButton: (color) => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "32px",
      height: "32px",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      background: "#fff",
      cursor: "pointer",
      color: color || "#374151",
      marginRight: "6px",
    }),
    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 20px",
      borderTop: "1px solid #e5e7eb",
    },
    pageButton: (disabled) => ({
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "8px 14px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      background: disabled ? "#f3f4f6" : "#fff",
      color: disabled ? "#9ca3af" : "#374151",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "13px",
    }),
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modal: {
      background: "#fff",
      borderRadius: "12px",
      width: "90%",
      maxWidth: "520px",
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px 24px",
      borderBottom: "1px solid #e5e7eb",
    },
    modalTitle: {
      fontSize: "18px",
      fontWeight: "600",
      color: "#1f2937",
    },
    modalBody: {
      padding: "24px",
    },
    formGroup: {
      marginBottom: "16px",
    },
    label: {
      display: "block",
      fontSize: "13px",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "6px",
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      fontSize: "14px",
      outline: "none",
      resize: "vertical",
      minHeight: "80px",
      boxSizing: "border-box",
    },
    submitButton: {
      width: "100%",
      padding: "12px",
      background: "#7a1f1f",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
      marginTop: "8px",
    },
    errorText: {
      color: "#dc2626",
      fontSize: "13px",
      marginBottom: "12px",
    },
    emptyState: {
      textAlign: "center",
      padding: "60px 20px",
      color: "#6b7280",
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#6b7280",
      padding: "4px",
      display: "flex",
    },
    subscribersModal: {
      background: "#fff",
      borderRadius: "12px",
      width: "90%",
      maxWidth: "700px",
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    },
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <Activity size={24} color="#7a1f1f" />
          Sports & Activities
        </h1>
        <button style={styles.addButton} onClick={openCreateModal}>
          <Plus size={16} />
          Add Sport
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <Search size={18} style={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search sports by name..."
          value={search}
          onChange={handleSearchChange}
          style={styles.searchInput}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", marginBottom: "16px", color: "#dc2626", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : sports.length === 0 ? (
          <div style={styles.emptyState}>
            <Activity size={40} color="#d1d5db" />
            <p style={{ marginTop: "12px", fontSize: "15px" }}>No sports found</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Schedule</th>
                    <th style={styles.th}>Monthly Price</th>
                    <th style={styles.th}>Yearly Price</th>
                    <th style={styles.th}>Max Members</th>
                    <th style={styles.th}>Current Members</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sports.map((sport) => (
                    <tr key={sport._id} style={{ transition: "background 0.15s" }}>
                      <td style={{ ...styles.td, fontWeight: "500" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {sport.image ? (
                            <img
                              src={`${api.defaults.baseURL.replace('/api/v1/hotel', '')}${sport.image}`}
                              alt={sport.name}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Activity size={18} color="#d1d5db" />
                            </div>
                          )}
                          {sport.name}
                        </div>
                      </td>
                      <td style={styles.td}>{sport.schedule || "—"}</td>
                      <td style={styles.td}>₹{sport.priceMonthly?.toLocaleString() ?? "—"}</td>
                      <td style={styles.td}>₹{sport.priceYearly?.toLocaleString() ?? "—"}</td>
                      <td style={styles.td}>{sport.maxMembers ?? "—"}</td>
                      <td style={styles.td}>{sport.currentMembers ?? sport.subscriberCount ?? 0}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(sport.active !== false)}>
                          {sport.active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.actionButton("#7a1f1f")}
                          title="View Subscribers"
                          onClick={() => openSubscribersModal(sport)}
                        >
                          <Users size={15} />
                        </button>
                        <button
                          style={styles.actionButton("#2563eb")}
                          title="Edit"
                          onClick={() => openEditModal(sport)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          style={styles.actionButton("#dc2626")}
                          title="Delete"
                          onClick={() => setDeleteConfirm(sport)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={styles.pageButton(page <= 1)}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  style={styles.pageButton(page >= totalPages)}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showFormModal && (
        <div style={styles.overlay} onClick={() => setShowFormModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingSport ? "Edit Sport" : "Add New Sport"}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowFormModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              {formError && <p style={styles.errorText}>{formError}</p>}
              <form onSubmit={handleFormSubmit}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Badminton, Swimming"
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Brief description of the sport/activity"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Monthly Price (₹) *</label>
                    <input
                      style={styles.input}
                      type="number"
                      name="priceMonthly"
                      value={formData.priceMonthly}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Yearly Price (₹) *</label>
                    <input
                      style={styles.input}
                      type="number"
                      name="priceYearly"
                      value={formData.priceYearly}
                      onChange={handleFormChange}
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Schedule</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="schedule"
                    value={formData.schedule}
                    onChange={handleFormChange}
                    placeholder="e.g. Mon, Wed, Fri - 6:00 AM to 8:00 AM"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Max Members *</label>
                  <input
                    style={styles.input}
                    type="number"
                    name="maxMembers"
                    value={formData.maxMembers}
                    onChange={handleFormChange}
                    placeholder="e.g. 50"
                    min="1"
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {editingSport?.image && !imageFile && (
                    <img
                      src={`${api.defaults.baseURL.replace('/api/v1/hotel', '')}${editingSport.image}`}
                      alt=""
                      style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginTop: 8 }}
                    />
                  )}
                </div>
                <button
                  type="submit"
                  style={{ ...styles.submitButton, opacity: formLoading ? 0.7 : 1 }}
                  disabled={formLoading}
                >
                  {formLoading ? "Saving..." : editingSport ? "Update Sport" : "Create Sport"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers Modal */}
      {showSubscribersModal && subscribersSport && (
        <div style={styles.overlay} onClick={() => setShowSubscribersModal(false)}>
          <div style={styles.subscribersModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Subscribers — {subscribersSport.name}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowSubscribersModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              {subscriptionsLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Loading...</div>
              ) : subscriptions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  <Users size={32} color="#d1d5db" />
                  <p style={{ marginTop: "8px" }}>No subscribers yet</p>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Member</th>
                          <th style={styles.th}>Phone</th>
                          <th style={styles.th}>Plan</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Start Date</th>
                          <th style={styles.th}>End Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((sub, idx) => (
                          <tr key={sub._id || idx}>
                            <td style={{ ...styles.td, fontWeight: "500" }}>
                              {sub.memberId?.name || sub.memberName || "—"}
                            </td>
                            <td style={styles.td}>
                              {sub.memberId?.phone || sub.memberPhone || "—"}
                            </td>
                            <td style={styles.td}>
                              {sub.duration || "—"}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.badge(sub.status === "active")}>
                                {sub.status || "—"}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"}
                            </td>
                            <td style={styles.td}>
                              {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Subscribers Pagination */}
                  {subscriptionsTotalPages > 1 && (
                    <div style={{ ...styles.pagination, borderTop: "1px solid #e5e7eb", marginTop: "12px" }}>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>
                        Page {subscriptionsPage} of {subscriptionsTotalPages}
                      </span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={styles.pageButton(subscriptionsPage <= 1)}
                          disabled={subscriptionsPage <= 1}
                          onClick={() => fetchSubscriptions(subscribersSport._id, subscriptionsPage - 1)}
                        >
                          <ChevronLeft size={14} />
                          Prev
                        </button>
                        <button
                          style={styles.pageButton(subscriptionsPage >= subscriptionsTotalPages)}
                          disabled={subscriptionsPage >= subscriptionsTotalPages}
                          onClick={() => fetchSubscriptions(subscribersSport._id, subscriptionsPage + 1)}
                        >
                          Next
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={styles.overlay} onClick={() => setDeleteConfirm(null)}>
          <div
            style={{ ...styles.modal, maxWidth: "400px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Confirm Delete</h2>
              <button style={styles.closeButton} onClick={() => setDeleteConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: "14px", color: "#374151", marginBottom: "20px" }}>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", cursor: "pointer", fontSize: "14px" }}
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  style={{ padding: "8px 16px", border: "none", borderRadius: "6px", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: "14px" }}
                  onClick={() => handleDelete(deleteConfirm._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sports
