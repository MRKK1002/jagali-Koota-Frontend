import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, MapPin, AlertCircle, Check, Upload, X, ImageIcon } from "lucide-react"
import axios from "axios"
import { fetchDualBackend } from "../utils/apiHelpers"

// Create axios instance
const api = axios.create({
  baseURL: "https://billing.jagalikoota.com/api/v1/hotel",
})

// Helper function to get image URL - Updated to handle full file system paths
const getImageUrl = (imagePath) => {
  if (!imagePath) return null

  // If it's already a full URL, return as is
  if (imagePath.startsWith("http")) {
    return imagePath
  }

  // Get backend URL from environment - primary is now CRM backend (port 5000)
  const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://hotelviratbackend-1spr.onrender.com/api/v1/hotel';
  const baseUrl = backendUrl.replace('/api/v1/hotel', ''); // Get base URL without path

  // Clean up the path to remove any leading/trailing slashes and normalize separators
  let cleanPath = imagePath.toString().trim().replace(/\\/g, "/") // Convert backslashes to forward slashes

  // If it starts with uploads/, use it directly
  if (cleanPath.startsWith("uploads/")) {
    const fullUrl = `${baseUrl}/${cleanPath}`;
    console.log(`Image URL: ${imagePath} -> ${fullUrl}`);
    return fullUrl;
  }

  // If it starts with /, use it directly
  if (cleanPath.startsWith("/")) {
    const fullUrl = `${baseUrl}${cleanPath}`;
    console.log(`Image URL: ${imagePath} -> ${fullUrl}`);
    return fullUrl;
  }

  // Extract the filename from the path
  const parts = cleanPath.split("/")
  const filename = parts[parts.length - 1]

  // If it's just a filename, assume it's in uploads/branch/
  const fullUrl = `${baseUrl}/uploads/branch/${filename}`;
  console.log(`Image URL: ${imagePath} -> ${fullUrl}`);
  return fullUrl;
}

const BranchModal = ({ branch, onClose, onSave }) => {
  // Parse address if it's a string (from simple branch format)
  const parseAddress = (addr) => {
    if (typeof addr === 'string') {
      // Try to intelligently parse the address string
      // Expected format: "Street, City, State, Country" or variations
      const parts = addr.split(',').map(p => p.trim());
      
      if (parts.length >= 4) {
        // If we have 4+ parts, assume last 3 are city, state, country
        return {
          street: parts.slice(0, -3).join(', '),
          city: parts[parts.length - 3],
          state: parts[parts.length - 2],
          country: parts[parts.length - 1]
        };
      } else if (parts.length === 3) {
        // If we have 3 parts, assume they are city, state, country (no street)
        return {
          street: parts[0],
          city: parts[1] || "",
          state: parts[2] || "",
          country: ""
        };
      } else if (parts.length === 2) {
        // If we have 2 parts, assume street and city
        return {
          street: parts[0],
          city: parts[1] || "",
          state: "",
          country: ""
        };
      } else {
        // Single part or empty, put it all in street
        return { street: addr, city: "", state: "", country: "" };
      }
    }
    return addr || { street: "", city: "", state: "", country: "" };
  };

  const [formData, setFormData] = useState({
    name: branch?.name || "",
    gstNumber: branch?.gstNumber || "",
    address: parseAddress(branch?.address),
    contact: {
      phone: branch?.contact?.phone || "",
      email: branch?.contact?.email || "",
    },
    openingHours: {
      mondayToFriday: branch?.openingHours?.mondayToFriday || "11:00 AM - 11:00 PM",
      saturday: branch?.openingHours?.saturday || "11:00 AM - 12:00 AM",
      sunday: branch?.openingHours?.sunday || "12:00 PM - 10:00 PM",
    },
    image: null,
  })
  const [imagePreview, setImagePreview] = useState(branch?.image ? getImageUrl(branch.image) : null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (branch?.image) {
      setImagePreview(getImageUrl(branch.image))
    }
  }, [branch])

  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Handle nested fields
    if (name.startsWith("address.")) {
      const field = name.split(".")[1];
      setFormData({
        ...formData,
        address: {
          ...formData.address,
          [field]: value,
        },
      });
    } else if (name.startsWith("contact.")) {
      const field = name.split(".")[1];
      setFormData({
        ...formData,
        contact: {
          ...formData.contact,
          [field]: value,
        },
      });
    } else if (name.startsWith("openingHours.")) {
      const field = name.split(".")[1];
      setFormData({
        ...formData,
        openingHours: {
          ...formData.openingHours,
          [field]: value,
        },
      });
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB")
        return
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file")
        return
      }

      setError("")
      setFormData({ ...formData, image: file })

      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setFormData({ ...formData, image: null })
    setImagePreview(null)
    // Reset file input
    const fileInput = document.getElementById("image-upload")
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      // Create FormData for file upload with all fields
      const submitData = new FormData()
      submitData.append("name", formData.name)
      submitData.append("gstNumber", formData.gstNumber)
      
      // Combine address fields into a single string for simple branch format
      const addressString = [
        formData.address.street,
        formData.address.city,
        formData.address.state,
        formData.address.country
      ].filter(Boolean).join(", ");
      
      submitData.append("address", addressString)
      submitData.append("contact", JSON.stringify(formData.contact))
      submitData.append("openingHours", JSON.stringify(formData.openingHours))

      // Handle image logic for updates
      if (branch) {
        // For updates: only append image if a new file is selected
        if (formData.image && formData.image instanceof File) {
          submitData.append("image", formData.image)
        }
      } else {
        // For new branches: append image if selected
        if (formData.image && formData.image instanceof File) {
          submitData.append("image", formData.image)
        }
      }

      await onSave(submitData)
      onClose()
    } catch (error) {
      setError(error.message || "Failed to save branch. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{branch ? "Edit Branch" : "Add New Branch"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                className="error-message"
                style={{ marginBottom: "15px", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Image Upload Section */}
            <div className="form-group">
              <label className="form-label">Branch Image</label>
              <div className="image-upload-container">
                {imagePreview ? (
                  <div className="image-preview-wrapper">
                    <img
                      src={imagePreview || "/placeholder.svg"}
                      alt="Branch preview"
                      className="image-preview"
                      onError={(e) => {
                        console.error("Image failed to load:", imagePreview)
                        e.target.style.display = "none"
                        e.target.nextSibling.style.display = "flex"
                      }}
                    />
                    <div
                      className="category-image-placeholder"
                      style={{
                        display: "none",
                        width: "100%",
                        height: "150px",
                        fontSize: "14px",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "8px",
                      }}
                    >
                      <ImageIcon size={24} />
                      <span>Image not found</span>
                    </div>
                    <div className="image-overlay">
                      <button
                        type="button"
                        onClick={removeImage}
                        style={{
                          background: "rgba(220, 38, 38, 0.8)",
                          border: "none",
                          borderRadius: "50%",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "white",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="image-upload" className="image-upload-label">
                    <div className="image-upload-placeholder">
                      <Upload size={24} />
                      <span>Click to upload branch image</span>
                      <small style={{ color: "#6b7280", marginTop: "4px" }}>PNG, JPG up to 5MB</small>
                    </div>
                  </label>
                )}
                <input
                  type="file"
                  id="image-upload"
                  className="image-upload-input"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Basic Information */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "600" }}>Basic Information</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Branch Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter branch name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gstNumber">
                  GST Number
                </label>
                <input
                  type="text"
                  id="gstNumber"
                  name="gstNumber"
                  className="form-input"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="Enter GST number"
                />
              </div>
            </div>

            {/* Address */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "600" }}>Address</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="address.street">
                  Street Address <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  id="address.street"
                  name="address.street"
                  className="form-textarea"
                  value={formData.address.street}
                  onChange={handleChange}
                  placeholder="Enter street address"
                  required
                  rows="2"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="address.city">
                    City
                  </label>
                  <input
                    type="text"
                    id="address.city"
                    name="address.city"
                    className="form-input"
                    value={formData.address.city}
                    onChange={handleChange}
                    placeholder="Enter city"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="address.state">
                    State
                  </label>
                  <input
                    type="text"
                    id="address.state"
                    name="address.state"
                    className="form-input"
                    value={formData.address.state}
                    onChange={handleChange}
                    placeholder="Enter state"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="address.country">
                    Country
                  </label>
                  <input
                    type="text"
                    id="address.country"
                    name="address.country"
                    className="form-input"
                    value={formData.address.country}
                    onChange={handleChange}
                    placeholder="Enter country"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "600" }}>Contact Information</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact.phone">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="contact.phone"
                    name="contact.phone"
                    className="form-input"
                    value={formData.contact.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact.email">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="contact.email"
                    name="contact.email"
                    className="form-input"
                    value={formData.contact.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                  />
                </div>
              </div>
            </div>

            {/* Opening Hours */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "600" }}>Opening Hours</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="openingHours.mondayToFriday">
                    Monday - Friday
                  </label>
                  <input
                    type="text"
                    id="openingHours.mondayToFriday"
                    name="openingHours.mondayToFriday"
                    className="form-input"
                    value={formData.openingHours.mondayToFriday}
                    onChange={handleChange}
                    placeholder="11:00 AM - 11:00 PM"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="openingHours.saturday">
                    Saturday
                  </label>
                  <input
                    type="text"
                    id="openingHours.saturday"
                    name="openingHours.saturday"
                    className="form-input"
                    value={formData.openingHours.saturday}
                    onChange={handleChange}
                    placeholder="11:00 AM - 12:00 AM"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="openingHours.sunday">
                    Sunday
                  </label>
                  <input
                    type="text"
                    id="openingHours.sunday"
                    name="openingHours.sunday"
                    className="form-input"
                    value={formData.openingHours.sunday}
                    onChange={handleChange}
                    placeholder="12:00 PM - 10:00 PM"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : branch ? "Update Branch" : "Add Branch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirmationModal = ({ branch, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setIsDeleting(true)
    setError("")

    try {
      await onConfirm(branch._id)
      onClose()
    } catch (error) {
      setError(error.message || "Failed to delete branch. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Branch</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div
              className="error-message"
              style={{ marginBottom: "15px", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <p>
            Are you sure you want to delete <strong>{branch.name}</strong>? This will also delete all associated
            categories and products.
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

const Branches = () => {
  const [branches, setBranches] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentBranch, setCurrentBranch] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Fetch branches on component mount
  useEffect(() => {
    fetchBranches()
  }, [])

  // Fetch all branches from API
  const fetchBranches = async () => {
    setLoading(true)
    setError("")

    try {
      // Use simple branch endpoint
      const data = await fetchDualBackend("/branch", {}, true)
      console.log("Fetched branches from BOTH backends:", data)
      
      // Ensure data is an array
      const branchesArray = Array.isArray(data) ? data : (data?.branches || [])
      setBranches(branchesArray)
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches. Please refresh the page and try again.")
      setBranches([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const filteredBranches = Array.isArray(branches) ? branches.filter(
    (branch) =>
      (branch.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.address || '').toLowerCase().includes(searchQuery.toLowerCase()),
  ) : []

  const handleAddClick = () => {
    setCurrentBranch(null)
    setShowModal(true)
  }

  const handleEditClick = (branch) => {
    setCurrentBranch(branch)
    setShowModal(true)
  }

  const handleDeleteClick = (branch) => {
    setBranchToDelete(branch)
    setShowDeleteModal(true)
  }

  // Handle save branch (create or update)
  const handleSaveBranch = async (formData) => {
    try {
      let response

      if (currentBranch) {
        // Update existing branch on both backends
        response = await fetchDualBackend(`/branch/${currentBranch._id}`, {
          method: "PUT",
          body: formData,
        })
        setBranches(prevBranches => Array.isArray(prevBranches) ? prevBranches.map((branch) => (branch._id === currentBranch._id ? response : branch)) : [response])
        setSuccessMessage(`Branch "${response.name}" updated successfully`)
      } else {
        // Create new branch on both backends
        response = await fetchDualBackend("/branch", {
          method: "POST",
          body: formData,
        })
        setBranches(prevBranches => Array.isArray(prevBranches) ? [...prevBranches, response] : [response])
        setSuccessMessage(`Branch "${response.name}" created successfully`)
      }

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)

      return true
    } catch (error) {
      console.error("Error saving branch:", error)

      let errorMessage = "Failed to save branch"
      if (error.message) {
        errorMessage = error.message
      }

      throw new Error(errorMessage)
    }
  }

  // Handle delete branch
  const handleDeleteBranch = async (branchId) => {
    try {
      // Delete from branch endpoint on both backends
      const branchDeletePromise = fetchDualBackend(`/branch/${branchId}`, {
        method: "DELETE",
      }).catch(err => {
        console.warn("Branch endpoint delete failed:", err);
        return null;
      });

      // Also try restaurant endpoint (for items that might be stored as restaurants)
      const restaurantDeletePromise = fetchDualBackend(`/hotel/${branchId}`, {
        method: "DELETE",
      }).catch(err => {
        console.warn("Restaurant endpoint delete failed:", err);
        return null;
      });

      // Wait for both to complete
      await Promise.allSettled([branchDeletePromise, restaurantDeletePromise]);

      setBranches(prevBranches => Array.isArray(prevBranches) ? prevBranches.filter((branch) => branch._id !== branchId) : [])
      setSuccessMessage("Branch deleted successfully from all backends")

      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)

      return true
    } catch (error) {
      console.error("Error deleting branch:", error)
      throw new Error(error.message || "Failed to delete branch")
    }
  }

  return (
    <div className="branches-page">
      {/* Success message */}
      {successMessage && (
        <div className="success-message">
          <Check size={16} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}>
            <span>×</span>
          </button>
        </div>
      )}

      <div className="page-header">
        <h1>Branches</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick}>
            <Plus size={16} />
            <span>Add Branch</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search branches by name or address..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="error-container"
          style={{
            margin: "20px 0",
            padding: "10px 15px",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="loading-container" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>Loading branches...</p>
        </div>
      ) : (
        <div className="grid-container">
          {filteredBranches.length > 0 ? (
            filteredBranches.filter(branch => branch && branch._id).map((branch, index) => {
              return (
                <div key={branch._id || `branch-${index}`} className="grid-item">
                  {/* Branch Image */}
                  <div className="grid-item-image-container">
                    {(() => {
                      const imageUrl = getImageUrl(branch.image)
                      console.log(`=== BRANCH DETAILS ===`);
                      console.log(`Branch ID: ${branch._id}`);
                      console.log(`Branch Name: ${branch.name}`);
                      console.log(`Branch Address: ${branch.address}`);
                      console.log(`Branch Image Raw Path: ${branch.image}`);
                      console.log(`Branch Image Full URL: ${imageUrl}`);
                      console.log(`Branch Created: ${branch.createdAt}`);
                      console.log(`========================`);

                      if (!imageUrl) {
                        return (
                          <div
                            className="category-image-placeholder"
                            style={{
                              display: "flex",
                              width: "100%",
                              height: "200px",
                              fontSize: "16px",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#f3f4f6",
                              color: "#9ca3af",
                            }}
                          >
                            <MapPin size={24} />
                            <span style={{ marginTop: "8px", fontSize: "14px" }}>No Image</span>
                          </div>
                        )
                      }

                      return (
                        <>
                          <img
                            src={imageUrl || "/placeholder.svg"}
                            alt={branch.name}
                            className="grid-item-image"
                            onLoad={() => console.log(`Image loaded successfully: ${imageUrl}`)}
                            onError={(e) => {
                              // Try secondary backend if primary fails
                              const secondaryBackend = import.meta.env.VITE_BACKEND_SECONDARY || 'https://hotelviratbackend-1spr.onrender.com/api/v1/hotel'
                              const secondaryBase = secondaryBackend.replace('/api/v1/hotel', '')
                              const cleanPath = branch.image.toString().trim().replace(/\\/g, '/').replace(/^\//, '')
                              const secondaryUrl = `${secondaryBase}/${cleanPath}`
                              
                              if (e.target.src !== secondaryUrl) {
                                console.log(`Trying secondary backend: ${secondaryUrl}`)
                                e.target.src = secondaryUrl
                              } else {
                                console.error(`Image failed to load from both backends: ${imageUrl}`)
                                e.target.style.display = "none"
                              }
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex"
                              }
                            }}
                          />
                          <div
                            className="category-image-placeholder"
                            style={{
                              display: "none",
                              width: "100%",
                              height: "200px",
                              fontSize: "16px",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#f3f4f6",
                              color: "#9ca3af",
                            }}
                          >
                            <ImageIcon size={24} />
                            <span style={{ marginTop: "8px", fontSize: "14px" }}>Image failed to load</span>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  <div className="grid-item-content">
                    <h3 className="grid-item-title">{branch.name}</h3>
                    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "8px" }}>
                      <MapPin
                        size={16}
                        style={{ marginRight: "8px", color: "#6b7280", marginTop: "2px", flexShrink: 0 }}
                      />
                      <p className="grid-item-subtitle" style={{ lineHeight: "1.4" }}>
                        {branch.address}
                      </p>
                    </div>
                    <div className="grid-item-footer">
                      <div className="grid-item-actions">
                        <button className="action-btn edit" onClick={() => handleEditClick(branch)}>
                          <Edit size={14} />
                        </button>
                        <button className="action-btn delete" onClick={() => handleDeleteClick(branch)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty-state" style={{ textAlign: "center", padding: "40px 0", gridColumn: "1 / -1" }}>
              <p>
                No branches found. {searchQuery ? "Try a different search term." : "Add a new branch to get started."}
              </p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <BranchModal branch={currentBranch} onClose={() => setShowModal(false)} onSave={handleSaveBranch} />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          branch={branchToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteBranch}
        />
      )}
    </div>
  )
}

export default Branches