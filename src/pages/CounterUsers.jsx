import { useState, useEffect } from "react"
import { Search, Edit, Trash2, UserPlus, Phone } from "lucide-react"

const CounterUserModal = ({ counter, onClose, onSave, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: counter?.name || "",
    mobile: counter?.mobile || "",
  })
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await onSave(formData, counter?._id)
      onClose()
    } catch (err) {
      setError(err.message || "Failed to save counter user")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit Counter User" : "Add New Counter User"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                className="alert-message"
                style={{ backgroundColor: "#fee2e2", borderColor: "#dc2626", color: "#dc2626" }}
              >
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mobile">
                Mobile <span className="required">*</span>
              </label>
              <input
                type="text"
                id="mobile"
                name="mobile"
                className="form-input"
                value={formData.mobile}
                onChange={handleChange}
                required
                pattern="\d{10}"
                title="Please enter a valid 10-digit mobile number"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : isEditMode ? "Update Counter User" : "Add Counter User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirmationModal = ({ counter, onClose, onConfirm }) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm(counter._id)
      onClose()
    } catch (error) {
      console.error("Error deleting counter:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Counter User</h3>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{counter.name}</strong>?
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

const CounterUsers = () => {
  const [counterUsers, setCounterUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentCounter, setCurrentCounter] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [counterToDelete, setCounterToDelete] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const API_BASE_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/counter-auth"

  const fetchCounterUsers = async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch(`${API_BASE_URL}/`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Handle new API response format {success, count, data}
      let usersData = []
      if (data && data.success && Array.isArray(data.data)) {
        // New format: {success, count, data}
        usersData = data.data
      } else if (Array.isArray(data)) {
        // Direct array format
        usersData = data
      } else if (data && data.message && data.message.includes('routes working')) {
        // Placeholder response - server not restarted
        console.log("⚠️ Server returning placeholder response:", data.message);
        usersData = []
      } else {
        console.error("Expected array but got:", data)
        setCounterUsers([])
        setErrorMessage("Invalid data format received from server")
        return;
      }
      
      setCounterUsers(usersData)
    } catch (error) {
      console.error("Fetch error:", error)
      setErrorMessage(`Failed to fetch counter users: ${error.message}`)
      setCounterUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCounterUsers()
  }, [])

  const handleAddClick = () => {
    setCurrentCounter(null)
    setShowModal(true)
  }

  const handleEditClick = (counter) => {
    setCurrentCounter(counter)
    setShowModal(true)
  }

  const handleDeleteClick = (counter) => {
    setCounterToDelete(counter)
    setShowDeleteModal(true)
  }

  const handleSaveCounter = async (formData, counterId) => {
    try {
      const url = counterId ? `${API_BASE_URL}/${counterId}` : `${API_BASE_URL}/register`
      const method = counterId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to save counter user")
      }

      setSuccessMessage(`Counter user ${counterId ? "updated" : "added"} successfully`)
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchCounterUsers()
    } catch (error) {
      throw new Error(error.message)
    }
  }

  const handleDeleteCounter = async (counterId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${counterId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete counter user")
      }

      setSuccessMessage("Counter user deleted successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchCounterUsers()
    } catch (error) {
      setErrorMessage(error.message)
      setTimeout(() => setErrorMessage(""), 3000)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const options = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const filteredCounterUsers = counterUsers.filter(
    (counter) => counter.name.toLowerCase().includes(searchQuery.toLowerCase()) || counter.mobile.includes(searchQuery),
  )

  return (
    <div className="counter-users-page">
      {successMessage && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="success-message" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} style={{ color: "#dc2626" }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="page-header">
        <h1>Counter Users</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add Counter User</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search counter users..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-card">
        {isLoading ? (
          <div className="empty-state">Loading counter users...</div>
        ) : filteredCounterUsers.length === 0 ? (
          <div className="empty-state">
            <p>
              No counter users found.{" "}
              {searchQuery ? "Try a different search." : "Add a new counter user to get started."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCounterUsers.map((counter) => (
                <tr key={counter._id}>
                  <td>{counter._id.slice(-6)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="user-avatar-placeholder">{counter.name.charAt(0).toUpperCase()}</div>
                      {counter.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Phone size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {counter.mobile}
                    </span>
                  </td>
                  <td>{formatDate(counter.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => handleEditClick(counter)} disabled={isLoading}>
                        <Edit size={14} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteClick(counter)}
                        disabled={isLoading}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CounterUserModal
          counter={currentCounter}
          onClose={() => setShowModal(false)}
          onSave={handleSaveCounter}
          isEditMode={!!currentCounter}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          counter={counterToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteCounter}
        />
      )}
    </div>
  )
}

export default CounterUsers
