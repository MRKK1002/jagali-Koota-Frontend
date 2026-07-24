import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, ImageIcon, AlertCircle, Calendar } from "lucide-react"

const CouponModal = ({ coupon, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    code: coupon?.code || "",
    description: coupon?.description || "",
    discountType: coupon?.discountType || "percentage",
    discountValue: coupon?.discountValue || "",
    minOrderValue: coupon?.minOrderValue || "",
    startDate: coupon?.startDate
      ? new Date(coupon.startDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    endDate: coupon?.endDate ? new Date(coupon.endDate).toISOString().split("T")[0] : "",
    usageLimit: coupon?.usageLimit || "",
    image: null,
  })

  const [imagePreview, setImagePreview] = useState(coupon?.image )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [existingCoupons, setExistingCoupons] = useState([])
  const [checkingCode, setCheckingCode] = useState(false)

  // Fetch existing coupons to check for duplicates
  useEffect(() => {
    const fetchExistingCoupons = async () => {
      try {
        const response = await fetch("https://billing.jagalikoota.com/api/v1/hotel/coupon")
        if (response.ok) {
          const data = await response.json()
          setExistingCoupons(data.map(c => c.code.toLowerCase()))
        }
      } catch (error) {
        console.log("Could not fetch existing coupons:", error)
      }
    }
    fetchExistingCoupons()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: ["discountValue", "minOrderValue", "usageLimit"].includes(name)
        ? value === ""
          ? ""
          : Number.parseFloat(value)
        : value,
    })
  }

  // Check if coupon code already exists
  const isCodeExists = (code) => {
    return existingCoupons.includes(code.toLowerCase())
  }

  // Generate unique coupon code suggestions that don't exist
  const generateUniqueCouponCode = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentDate = new Date().getDate()
    const timestamp = Date.now().toString().slice(-4)
    
    const prefixes = ['WELCOME', 'SAVE', 'DISCOUNT', 'FIRST', 'NEWYEAR', 'HOTEL', 'VIRAT', 'SPECIAL', 'OFFER', 'DEAL']
    const suffixes = [
      currentYear.toString(),
      currentYear.toString().slice(-2),
      `${currentMonth}${currentYear.toString().slice(-2)}`,
      `${currentDate}${currentMonth}`,
      timestamp,
      Math.floor(Math.random() * 1000) + 100,
      Math.floor(Math.random() * 50) + 10
    ]
    
    // Try to generate a unique code
    for (let i = 0; i < 50; i++) { // Try up to 50 combinations
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
      const code = `${prefix}${suffix}`
      
      if (!isCodeExists(code)) {
        return code
      }
    }
    
    // If all else fails, use timestamp-based code
    return `UNIQUE${timestamp}${Math.floor(Math.random() * 100)}`
  }

  // Generate multiple unique suggestions
  const generateCouponSuggestions = () => {
    const suggestions = []
    for (let i = 0; i < 5; i++) {
      suggestions.push(generateUniqueCouponCode())
    }
    return suggestions
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        image: file,
      })

      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      setError(err.message || "Failed to save coupon")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{coupon ? "Edit Coupon" : "Add New Coupon"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  padding: "10px",
                  marginBottom: "15px",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} />
                <div>
                  <div>{error}</div>
                  {error.includes("already exists") && (
                    <div style={{ marginTop: "5px", fontSize: "12px", color: "#991b1b" }}>
                      💡 Try using a different code like: WELCOME2025, NEWYEAR25, DISCOUNT15, SAVE20, FIRST10
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="code">
                Coupon Code
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  id="code"
                  name="code"
                  className="form-input"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  style={{ 
                    flex: 1,
                    borderColor: formData.code && isCodeExists(formData.code) && !coupon ? "#ef4444" : "#d1d5db"
                  }}
                  placeholder="Enter unique coupon code (e.g., WELCOME2025)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const uniqueCode = generateUniqueCouponCode()
                    setFormData({ ...formData, code: uniqueCode })
                  }}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontWeight: "500"
                  }}
                >
                  🎲 Generate
                </button>
              </div>
              
              {/* Real-time validation */}
              {formData.code && !coupon && (
                <div style={{ marginTop: "6px", fontSize: "12px" }}>
                  {isCodeExists(formData.code) ? (
                    <div style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "4px" }}>
                      ❌ This code already exists! Try a different one.
                    </div>
                  ) : (
                    <div style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                      ✅ This code is available!
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
                💡 Click "Generate" for a guaranteed unique code
              </div>
              
              {/* Show existing coupon codes for reference */}
              {existingCoupons.length > 0 && (
                <details style={{ marginTop: "8px" }}>
                  <summary style={{ fontSize: "12px", color: "#6b7280", cursor: "pointer" }}>
                    📋 View existing coupon codes ({existingCoupons.length} total)
                  </summary>
                  <div style={{ 
                    marginTop: "4px", 
                    padding: "8px", 
                    backgroundColor: "#f9fafb", 
                    borderRadius: "4px",
                    fontSize: "11px",
                    maxHeight: "100px",
                    overflowY: "auto"
                  }}>
                    {existingCoupons.slice(0, 20).map((code, index) => (
                      <span key={index} style={{ 
                        display: "inline-block", 
                        margin: "2px", 
                        padding: "2px 6px", 
                        backgroundColor: "#e5e7eb", 
                        borderRadius: "3px",
                        textTransform: "uppercase"
                      }}>
                        {code}
                      </span>
                    ))}
                    {existingCoupons.length > 20 && (
                      <div style={{ marginTop: "4px", color: "#6b7280" }}>
                        ... and {existingCoupons.length - 20} more
                      </div>
                    )}
                  </div>
                </details>
              )}
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
              />
            </div>

            {/* Image Upload Field */}
            <div className="form-group">
              <label className="form-label">Coupon Image</label>
              <div className="image-upload-container">
                <label htmlFor="image-upload" className="image-upload-label">
                  {imagePreview ? (
                    <div className="image-preview-wrapper">
                      <img src={imagePreview || "/placeholder.svg"} alt="Coupon preview" className="image-preview" />
                      <div className="image-overlay">
                        <span>Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="image-upload-placeholder">
                      <ImageIcon size={24} />
                      <span>Upload Coupon Image</span>
                    </div>
                  )}
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="image-upload-input"
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="discountType">
                  Discount Type
                </label>
                <select
                  id="discountType"
                  name="discountType"
                  className="form-select"
                  value={formData.discountType}
                  onChange={handleChange}
                  required
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="discountValue">
                  {formData.discountType === "percentage" ? "Discount Percentage" : "Discount Amount (₹)"}
                </label>
                <input
                  type="number"
                  id="discountValue"
                  name="discountValue"
                  className="form-input"
                  value={formData.discountValue}
                  onChange={handleChange}
                  min="0"
                  step={formData.discountType === "percentage" ? "1" : "0.01"}
                  required
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="minOrderValue">
                  Minimum Order Value (₹)
                </label>
                <input
                  type="number"
                  id="minOrderValue"
                  name="minOrderValue"
                  className="form-input"
                  value={formData.minOrderValue}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="startDate">
                  Valid From
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  className="form-input"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="endDate">
                  Valid To
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  className="form-input"
                  value={formData.endDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="usageLimit">
                  Usage Limit
                </label>
                <input
                  type="number"
                  id="usageLimit"
                  name="usageLimit"
                  className="form-input"
                  value={formData.usageLimit}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  required
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : coupon ? "Update Coupon" : "Add Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirmationModal = ({ coupon, onClose, onConfirm, loading }) => {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Coupon</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete coupon <strong>{coupon.code}</strong>?
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={() => onConfirm(coupon._id)}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

const SuccessMessage = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="success-message">
      {message}
      <button onClick={onClose}>×</button>
    </div>
  )
}

const Coupons = () => {
  const [coupons, setCoupons] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentCoupon, setCurrentCoupon] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [couponToDelete, setCouponToDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch coupons from API
  const fetchCoupons = async () => {
    setIsLoading(true)
    try {
      const apiUrl = `${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/coupon`;
      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch coupons")
      }
      const data = await response.json()
      
      // Handle different API response formats
      let couponsArray = [];
      if (data.success && Array.isArray(data.data)) {
        // New format: {success: true, count: X, data: [...]}
        couponsArray = data.data;
      } else if (Array.isArray(data)) {
        // Old format: direct array
        couponsArray = data;
      } else if (data.message && data.message.includes('routes working')) {
        // Placeholder response - treat as empty
        couponsArray = [];
      }
      
      setCoupons(couponsArray)
    } catch (err) {
      setError(err.message || "Failed to fetch coupons")
      console.error("Error fetching Coupons:", err)
      setCoupons([]) // Ensure coupons is always an array
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const handleAddClick = () => {
    setCurrentCoupon(null)
    setShowModal(true)
  }

  const handleEditClick = (coupon) => {
    setCurrentCoupon(coupon)
    setShowModal(true)
  }

  const handleDeleteClick = (coupon) => {
    setCouponToDelete(coupon)
    setShowDeleteModal(true)
  }

  const handleSaveCoupon = async (formData) => {
    setLoading(true)

    try {
      // Create FormData object for file upload
      const form = new FormData()
      form.append("code", formData.code)
      form.append("description", formData.description)
      form.append("discountType", formData.discountType)
      form.append("discountValue", formData.discountValue)
      form.append("minOrderValue", formData.minOrderValue)
      form.append("startDate", formData.startDate)
      form.append("endDate", formData.endDate)
      form.append("usageLimit", formData.usageLimit)
      form.append("isActive", "true") // Explicitly set isActive to true

      if (formData.image) {
        form.append("image", formData.image)
      }

      let response

      if (currentCoupon) {
        // Update existing coupon
        response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/coupon/${currentCoupon._id}`, {
          method: "PUT",
          body: form,
        })
      } else {
        // Create new coupon
        response = await fetch("https://billing.jagalikoota.com/api/v1/hotel/coupon", {
          method: "POST",
          body: form,
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save coupon")
      }

      const result = await response.json()

      // Refresh coupons list
      await fetchCoupons()

      // Show success message
      setSuccessMessage(currentCoupon ? "Coupon updated successfully" : "Coupon created successfully")

      return result
    } catch (err) {
      console.error("Error saving coupon:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCoupon = async (couponId) => {
    setLoading(true)

    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/coupon/${couponId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete coupon")
      }

      // Refresh coupons list
      await fetchCoupons()

      // Show success message
      setSuccessMessage("Coupon deleted successfully")
    } catch (err) {
      console.error("Error deleting coupon:", err)
      setError(err.message || "Failed to delete coupon")
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
    }
  }

  const filteredCoupons = (Array.isArray(coupons) ? coupons : []).filter((coupon) =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="coupons-page">
      <div className="page-header">
        <h1>Coupons</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick}>
            <Plus size={16} />
            <span>Add Coupon</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search coupons..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p>Loading coupons...</p>
        </div>
      ) : (
        <div className="data-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Code</th>
                <th>Description</th>
                <th>Discount</th>
                <th>Min. Order</th>
                <th>Validity</th>
                <th>Usage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoupons.map((coupon) => (
                <tr key={coupon._id}>
                  <td>
                    {coupon.image ? (
                      <div className="coupon-image-cell">
                        <img
                          src={`${coupon.image}`}
                          alt={coupon.code}
                          className="coupon-image"
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = "https://via.placeholder.com/50"
                          }}
                        />
                      </div>
                    ) : (
                      <div className="coupon-image-placeholder">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: "600", color: "#f97316" }}>{coupon.code}</span>
                  </td>
                  <td>{coupon.description}</td>
                  <td>
                    {coupon.discountType === "percentage" ? (
                      <span>{coupon.discountValue}%</span>
                    ) : (
                      <span>₹{coupon.discountValue}</span>
                    )}
                  </td>
                  <td>₹{coupon.minOrderValue}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Calendar size={14} style={{ marginRight: "4px", color: "#6b7280" }} />
                      {formatDate(coupon.startDate)} - {formatDate(coupon.endDate)}
                    </span>
                  </td>
                  <td>
                    {coupon.usageCount} / {coupon.usageLimit || "∞"}
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        backgroundColor: "#e5e7eb",
                        borderRadius: "2px",
                        marginTop: "4px",
                      }}
                    >
                      <div
                        style={{
                          width: `${coupon.usageLimit ? (coupon.usageCount / coupon.usageLimit) * 100 : 0}%`,
                          height: "100%",
                          backgroundColor: "#f97316",
                          borderRadius: "2px",
                        }}
                      ></div>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => handleEditClick(coupon)}>
                        <Edit size={14} />
                      </button>
                      <button className="action-btn delete" onClick={() => handleDeleteClick(coupon)}>
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

      {!isLoading && filteredCoupons.length === 0 && (
        <div className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>No coupons found. Add a new coupon to get started.</p>
        </div>
      )}

      {showModal && (
        <CouponModal coupon={currentCoupon} onClose={() => setShowModal(false)} onSave={handleSaveCoupon} />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          coupon={couponToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteCoupon}
          loading={loading}
        />
      )}

      {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}
    </div>
  )
}

export default Coupons