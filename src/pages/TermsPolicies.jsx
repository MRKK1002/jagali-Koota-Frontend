import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, FileText } from "lucide-react"

const TermModal = ({ term, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: term?.title || "",
    description: term?.description || "",
    category: term?.category || "Terms of Service",
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{term ? "Edit Policy" : "Add New Policy"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="title">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                className="form-input"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="form-select"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="Order Policy">Order Policy</option>
                <option value="Delivery Policy">Delivery Policy</option>
                <option value="Privacy Policy">Privacy Policy</option>
                <option value="Terms of Service">Terms of Service</option>
                <option value="Refund Policy">Refund Policy</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className="form-textarea"
                value={formData.description}
                onChange={handleChange}
                required
                rows={8}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {term ? "Update Policy" : "Add Policy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirmationModal = ({ term, onClose, onConfirm }) => {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Policy</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>"{term.title}"</strong>?
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={() => {
              onConfirm(term._id)
              onClose()
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

const TermsPolicies = () => {
  const [terms, setTerms] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentTerm, setCurrentTerm] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [termToDelete, setTermToDelete] = useState(null)
  const [expandedTerm, setExpandedTerm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch terms from the API
  const fetchTerms = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = categoryFilter ? `?category=${categoryFilter}` : ""
      const apiUrl = `${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/terms${query}`
      const response = await fetch(apiUrl)
      if (!response.ok) throw new Error("Failed to fetch terms")
      const data = await response.json()
      
      // Handle different API response formats
      let termsArray = [];
      if (data.success && Array.isArray(data.data)) {
        // New format: {success: true, count: X, data: [...]}
        termsArray = data.data;
      } else if (Array.isArray(data)) {
        // Old format: direct array
        termsArray = data;
      } else if (data.message && data.message.includes('routes working')) {
        // Placeholder response - treat as empty
        termsArray = [];
      }
      
      setTerms(termsArray)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTerms()
  }, [categoryFilter])

  const filteredTerms = terms.filter((term) => {
    const matchesSearch =
      term.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const handleAddTerm = () => {
    setCurrentTerm(null)
    setShowModal(true)
  }

  const handleEditTerm = (term) => {
    setCurrentTerm(term)
    setShowModal(true)
  }

  const handleDeleteTerm = (term) => {
    setTermToDelete(term)
    setShowDeleteModal(true)
  }

  const handleSaveTerm = async (formData) => {
    setLoading(true)
    setError(null)
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"
      const url = currentTerm
        ? `${baseUrl}/terms/${currentTerm._id}`
        : `${baseUrl}/terms`
      const method = currentTerm ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error(currentTerm ? "Failed to update term" : "Failed to create term")
      await fetchTerms()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTermConfirm = async (termId) => {
    setLoading(true)
    setError(null)
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"
      const response = await fetch(`${baseUrl}/terms/${termId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete term")
      await fetchTerms()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (termId) => {
    setExpandedTerm(expandedTerm === termId ? null : termId)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case "Terms of Service":
        return { bg: "#e0f2fe", text: "#0284c7" }
      case "Privacy Policy":
        return { bg: "#dcfce7", text: "#16a34a" }
      case "Refund Policy":
        return { bg: "#fef3c7", text: "#d97706" }
      case "Delivery Policy":
        return { bg: "#f3e8ff", text: "#7e22ce" }
      case "Order Policy":
        return { bg: "#fee2e2", text: "#dc2626" }
      default:
        return { bg: "#f1f5f9", text: "#64748b" }
    }
  }

  return (
    <div className="terms-policies-page">
      <div className="page-header">
        <h1>Terms & Policies</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddTerm} disabled={loading}>
            <Plus size={16} />
            <span>Add Policy</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search policies..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={loading}
          >
            <option value="">All Categories</option>
            <option value="Order Policy">Order Policy</option>
            <option value="Delivery Policy">Delivery Policy</option>
            <option value="Privacy Policy">Privacy Policy</option>
            <option value="Terms of Service">Terms of Service</option>
            <option value="Refund Policy">Refund Policy</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="alert-message" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <div className="terms-list">
          {filteredTerms.map((term) => {
            const categoryColor = getCategoryColor(term.category)
            return (
              <div key={term._id} className="terms-item">
                <div className="terms-header" onClick={() => toggleExpand(term._id)}>
                  <div className="terms-title-section">
                    <div className="terms-icon" style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}>
                      <FileText size={20} />
                    </div>
                    <div className="terms-info">
                      <h3 className="terms-title">{term.title}</h3>
                      <div className="terms-meta">
                        <span
                          className="terms-category"
                          style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                        >
                          {term.category}
                        </span>
                        <span className="terms-date">Last updated: {formatDate(term.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="terms-actions">
                    <button
                      className="action-btn edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditTerm(term)
                      }}
                      disabled={loading}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTerm(term)
                      }}
                      disabled={loading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedTerm === term._id && (
                  <div className="terms-content">
                    <p>{term.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {filteredTerms.length === 0 && !loading && (
        <div className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>No policies found. Add a new policy to get started.</p>
        </div>
      )}

      {showModal && <TermModal term={currentTerm} onClose={() => setShowModal(false)} onSave={handleSaveTerm} />}

      {showDeleteModal && (
        <DeleteConfirmationModal
          term={termToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteTermConfirm}
        />
      )}
    </div>
  )
}

export default TermsPolicies