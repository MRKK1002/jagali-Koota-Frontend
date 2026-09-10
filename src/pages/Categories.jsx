import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, Filter, ImageIcon, AlertCircle, Check } from "lucide-react"
import { fetchDualBackend } from "../utils/apiHelpers"
import { hasPermission } from "../utils/usePermissions"

// Helper function to get the correct image URL
const getImageUrl = (imagePath, bustCache = false) => {
  if (!imagePath) return null
  
  // If it's already a full URL, return as is (with optional cache busting)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return bustCache ? `${imagePath}?t=${Date.now()}` : imagePath
  }
  
  // Otherwise, prepend the primary backend URL
  const primaryBackend = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
  const baseUrl = primaryBackend.replace('/api/v1/hotel', '') // Get base URL without API path
  
  // Clean up the path
  let cleanPath = imagePath.replace(/\\/g, '/') // Replace backslashes with forward slashes
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`
  }
  
  const url = `${baseUrl}${cleanPath}`
  return bustCache ? `${url}?t=${Date.now()}` : url
}

const CategoryModal = ({ category, onClose, onSave, branches, selectedBranch }) => {
  // Support both formats: category.branchId and category.branch.id
  // Default to first branch if no branch is selected (when "All Branches" is active)
  const categoryBranchId = category?.branchId || category?.branch?.id || selectedBranch || (branches.length > 0 ? branches[0]._id : "")
  
  const [formData, setFormData] = useState({
    name: category?.name || "",
    branchId: categoryBranchId,
    image: category?.image || "",
    loginPassword: category?.loginPassword || "",
    cancelOrderPassword: category?.cancelOrderPassword || "",
    gstRate: category?.gstRate || 0,
  })
  const [imagePreview, setImagePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Set image preview when editing a category
  useEffect(() => {
    if (category?.image) {
      const imageUrl = getImageUrl(category.image)
       
      setImagePreview(imageUrl)
    } else {
      setImagePreview(null)
    }
  }, [category])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
        setFormData({
          ...formData,
          image: reader.result,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      setError(error.message || "Failed to save category. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{category ? "Edit Category" : "Add New Category"}</h3>
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
            <div className="form-group">
              <label className="form-label" htmlFor="branchId">
                Branch
              </label>
              <select
                id="branchId"
                name="branchId"
                className="form-select"
                value={formData.branchId}
                onChange={handleChange}
                required
                disabled={!!category}
              >
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category Image</label>
              <div className="image-upload-container">
                <label htmlFor="image-upload" className="image-upload-label">
                  {imagePreview ? (
                    <div className="image-preview-wrapper">
                      <img src={imagePreview} alt="Category preview" className="image-preview" />
                      <div className="image-overlay">
                        <span>Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="image-upload-placeholder">
                      <ImageIcon size={24} />
                      <span>Upload Category Image</span>
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

            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Category Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="loginPassword">
                Login Password (Optional)
              </label>
              <input
                type="password"
                id="loginPassword"
                name="loginPassword"
                className="form-input"
                value={formData.loginPassword}
                onChange={handleChange}
                placeholder="Enter login password for this category"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cancelOrderPassword">
                Cancel Order Password (Optional)
              </label>
              <input
                type="password"
                id="cancelOrderPassword"
                name="cancelOrderPassword"
                className="form-input"
                value={formData.cancelOrderPassword}
                onChange={handleChange}
                placeholder="Enter cancel order password for this category"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="gstRate">
                GST Rate (%) *
              </label>
              <input
                type="number"
                id="gstRate"
                name="gstRate"
                className="form-input"
                value={formData.gstRate}
                onChange={handleChange}
                placeholder="Enter GST percentage (e.g., 5, 12, 18)"
                min="0"
                max="100"
                step="0.01"
                required
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                This GST rate will be automatically applied to all items in this category
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : category ? "Update Category" : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirmationModal = ({ category, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setIsDeleting(true)
    setError("")

    try {
      await onConfirm(category._id)
      onClose()
    } catch (error) {
      setError(error.message || "Failed to delete category. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Category</h3>
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
            Are you sure you want to delete <strong>{category.name}</strong>? This will also delete all associated
            products.
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This RESERVED cannot be undone.</p>
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

const SubcategoryModal = ({ subcategory, onClose, onSave, categories, branches }) => {
  const [formData, setFormData] = useState({
    name: subcategory?.name || "",
    categoryId: subcategory?.categoryId?._id || subcategory?.categoryId || "",
    branchId: subcategory?.branchId?._id || subcategory?.branchId || "",
    description: subcategory?.description || "",
  })
  const [filteredCategories, setFilteredCategories] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (formData.branchId) {
      const filtered = categories.filter((cat) => {
        const catBranchId = cat.branchId || cat.branch?.id
        return catBranchId === formData.branchId
      })
      setFilteredCategories(filtered)
    } else {
      setFilteredCategories(categories)
    }
  }, [formData.branchId, categories])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      setError(error.message || "Failed to save subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{subcategory ? "Edit Subcategory" : "Add New Subcategory"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ marginBottom: "15px", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select name="branchId" className="form-select" value={formData.branchId} onChange={handleChange} required>
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select name="categoryId" className="form-select" value={formData.categoryId} onChange={handleChange} required disabled={!formData.branchId}>
                <option value="">Select Category</option>
                {filteredCategories.map((category) => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subcategory Name *</label>
              <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-textarea" value={formData.description} onChange={handleChange} rows="3" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : subcategory ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const Categories = () => {
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentCategory, setCurrentCategory] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState("")
  const [filteredCategories, setFilteredCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  
  // Subcategory states
  const [subcategories, setSubcategories] = useState([])
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [currentSubcategory, setCurrentSubcategory] = useState(null)
  const [showSubcategoryDeleteModal, setShowSubcategoryDeleteModal] = useState(false)
  const [subcategoryToDelete, setSubcategoryToDelete] = useState(null)
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState("")
  const [filteredSubcategories, setFilteredSubcategories] = useState([])
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState("")

  useEffect(() => {
    fetchBranches()
    fetchSubcategories()
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [selectedBranch])

  useEffect(() => {
    filterCategories()
  }, [categories, selectedBranch, searchQuery])
  
  useEffect(() => {
    filterSubcategories()
  }, [subcategories, selectedCategoryForSubcategory, subcategorySearchQuery])

  const fetchBranches = async () => {
    try {
      const data = await fetchDualBackend("/branch", {}, true)
      setBranches(data)
      // Don't auto-select a branch - default to "All Branches" (empty string)
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches. Please refresh the page and try again.")
    }
  }

  const fetchCategories = async () => {
    setLoading(true)
    setError("")

    try {
      // If a branch is selected, fetch only categories for that branch
      // Don't merge results when filtering by branch since both backends share the same DB
      const endpoint = selectedBranch ? `/category?branchId=${selectedBranch}` : "/category"
      const shouldMerge = !selectedBranch // Only merge when showing all categories
      console.log(`🔍 Fetching categories for branch: ${selectedBranch || 'All'}, endpoint: ${endpoint}, merge: ${shouldMerge}`)
      const data = await fetchDualBackend(endpoint, {}, shouldMerge)
      console.log(`📊 Received ${data.length} categories:`, data.map(c => ({ name: c.name, branchId: c.branchId || c.branch?.id })))
      setCategories(data)
    } catch (error) {
      console.error("Error fetching categories:", error)
      setError("Failed to load categories. Please refresh the page and try again.")
    } finally {
      setLoading(false)
    }
  }

  const filterCategories = () => {
    let filtered = categories
    if (selectedBranch) {
      // Support both formats: category.branchId and category.branch.id
      filtered = filtered.filter((category) => {
        const categoryBranchId = category.branchId || category.branch?.id
        return categoryBranchId === selectedBranch
      })
    }
    if (searchQuery) {
      filtered = filtered.filter((category) =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    setFilteredCategories(filtered)
  }

  const handleAddClick = () => {
    setCurrentCategory(null)
    setShowModal(true)
  }

  const handleEditClick = (category) => {
    setCurrentCategory(category)
    setShowModal(true)
  }

  const handleDeleteClick = (category) => {
    setCategoryToDelete(category)
    setShowDeleteModal(true)
  }

  const handleSaveCategory = async (formData) => {
    try {
      const formDataObj = new FormData()
      formDataObj.append("name", formData.name)
      formDataObj.append("branchId", formData.branchId)
      
      // Add GST rate
      formDataObj.append("gstRate", formData.gstRate || 0)
      
      // Add passwords if provided
      if (formData.loginPassword) {
        formDataObj.append("loginPassword", formData.loginPassword)
      }
      if (formData.cancelOrderPassword) {
        formDataObj.append("cancelOrderPassword", formData.cancelOrderPassword)
      }
      
      // Add branch details for crm_backend compatibility
      const branch = branches.find((b) => b._id === formData.branchId)
      if (branch) {
        formDataObj.append("branchName", branch.name)
        formDataObj.append("branchAddress", branch.address || "")
      }

      if (formData.image && formData.image.startsWith("data:image")) {
        const response = await fetch(formData.image)
        const blob = await response.blob()
        const file = new File([blob], "category-image.jpg", { type: blob.type })
        formDataObj.append("image", file)
      } else if (formData.image && !formData.image.startsWith("http")) {
        formDataObj.append("image", formData.image)
      }

      let responseData

      if (currentCategory) {
        const category = await fetchDualBackend(`/category/${currentCategory._id}`, {
          method: "PUT",
          body: formDataObj,
        })
        // Add a timestamp to force image refresh
        category._imageTimestamp = Date.now()
        
        // Update the categories state with the new category data
        setCategories(prevCategories => 
          prevCategories.map((cat) => 
            cat._id === currentCategory._id ? { ...category, _imageTimestamp: Date.now() } : cat
          )
        )
        
        // Force a fresh fetch to ensure we have the latest data
        setTimeout(() => {
          fetchCategories()
        }, 500)
        
        setSuccessMessage(`Category "${category.name}" updated successfully`)
      } else {
        const category = await fetchDualBackend("/category", {
          method: "POST",
          body: formDataObj,
        })
        setCategories([...categories, category])
        setSuccessMessage(`Category "${category.name}" created successfully`)
      }

      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)

      return true
    } catch (error) {
      console.error("Error saving category:", error)
      throw new Error(error.message || "Failed to save category")
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    try {
      await fetchDualBackend(`/category/${categoryId}`, {
        method: "DELETE",
      })
      setCategories(categories.filter((cat) => cat._id !== categoryId))
      setSuccessMessage("Category deleted successfully")
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    } catch (error) {
      console.error("Error deleting category:", error)
      throw new Error(error.message || "Failed to delete category")
    }
  }

  const getBranchName = (category) => {
    // Support both formats: category.branchId and category.branch
    if (category.branch?.name) {
      return category.branch.name
    }
    const branchId = category.branchId || category.branch?.id
    const branch = branches.find((b) => b._id === branchId)
    return branch ? branch.name : `Unknown Branch (${branchId?.substring(0, 6) || 'N/A'})`
  }

  // Subcategory functions
  const fetchSubcategories = async () => {
    try {
      const data = await fetchDualBackend("/subcategory", {}, true)
      setSubcategories(data)
    } catch (error) {
      console.error("Error fetching subcategories:", error)
    }
  }

  const filterSubcategories = () => {
    let filtered = subcategories
    if (selectedCategoryForSubcategory) {
      filtered = filtered.filter((subcat) => {
        const subcatCategoryId = subcat.categoryId?._id || subcat.categoryId
        return subcatCategoryId === selectedCategoryForSubcategory
      })
    }
    if (subcategorySearchQuery) {
      filtered = filtered.filter((subcat) =>
        subcat.name.toLowerCase().includes(subcategorySearchQuery.toLowerCase())
      )
    }
    setFilteredSubcategories(filtered)
  }

  const handleAddSubcategoryClick = () => {
    setCurrentSubcategory(null)
    setShowSubcategoryModal(true)
  }

  const handleEditSubcategoryClick = (subcategory) => {
    setCurrentSubcategory(subcategory)
    setShowSubcategoryModal(true)
  }

  const handleDeleteSubcategoryClick = (subcategory) => {
    setSubcategoryToDelete(subcategory)
    setShowSubcategoryDeleteModal(true)
  }

  const handleSaveSubcategory = async (formData) => {
    try {
      if (currentSubcategory) {
        await fetchDualBackend(`/subcategory/${currentSubcategory._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        setSuccessMessage("Subcategory updated successfully")
      } else {
        await fetchDualBackend("/subcategory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        setSuccessMessage("Subcategory created successfully")
      }
      fetchSubcategories()
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (error) {
      console.error("Error saving subcategory:", error)
      throw new Error(error.message || "Failed to save subcategory")
    }
  }

  const handleDeleteSubcategory = async (subcategoryId) => {
    try {
      await fetchDualBackend(`/subcategory/${subcategoryId}`, {
        method: "DELETE",
      })
      setSubcategories(subcategories.filter((subcat) => subcat._id !== subcategoryId))
      setSuccessMessage("Subcategory deleted successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (error) {
      console.error("Error deleting subcategory:", error)
      throw new Error(error.message || "Failed to delete subcategory")
    }
  }

  return (
    <div className="categories-page">
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
        <h1>Categories</h1>
        <div className="header-actions">
          {hasPermission("categories", "edit") && (
          <button className="btn btn-primary" onClick={handleAddClick}>
            <Plus size={16} />
            <span>Add Category</span>
          </button>
          )}
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search categories..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <div className="filter-btn">
            <Filter size={16} />
            <span>Branch:</span>
          </div>
          <select className="filter-select" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      {loading ? (
        <div className="loading-container" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>Loading categories...</p>
        </div>
      ) : (
        <div className="data-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Branch</th>
                <th>GST</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category._id}>
                  <td>
                    {category.image ? (
                      <img
                        src={getImageUrl(category.image, true)} // Always bust cache for admin panel
                        alt={category.name}
                        className="category-image"
                        onLoad={() => {
                          console.log(`✅ Category image loaded: ${category.name}`, getImageUrl(category.image));
                        }}
                        onError={(e) => {
                          // Try fallback to secondary backend
                          const secondaryBackend = import.meta.env.VITE_BACKEND_SECONDARY || 'https://hotelviratbackend-1spr.onrender.com/api/v1/hotel';
                          const fallbackBaseUrl = secondaryBackend.replace('/api/v1/hotel', '');
                          let cleanPath = category.image.replace(/\\/g, '/');
                          if (!cleanPath.startsWith('/')) {
                            cleanPath = `/${cleanPath}`;
                          }
                          const fallbackUrl = `${fallbackBaseUrl}${cleanPath}?t=${Date.now()}`;
                          
                          console.log(`⚠️ Primary image failed for ${category.name}, trying fallback:`, fallbackUrl);
                          
                          // Only try fallback once
                          if (!e.target.dataset.fallbackAttempted) {
                            e.target.dataset.fallbackAttempted = 'true';
                            e.target.src = fallbackUrl;
                          } else {
                            console.error(`❌ Both backends failed for ${category.name}`);
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }
                        }}
                      />
                    ) : null}
                    <div className="category-image-placeholder" style={{ display: category.image ? 'none' : 'flex' }}>
                      <ImageIcon size={16} />
                    </div>
                  </td>
                  <td>{category.name}</td>
                  <td>{getBranchName(category)}</td>
                  <td>{category.gstRate || 0}%</td>
                  <td>
                    <div className="action-buttons">
                      {hasPermission("categories", "edit") && (
                      <button className="action-btn edit" onClick={() => handleEditClick(category)}>
                        <Edit size={14} />
                      </button>
                      )}
                      {hasPermission("categories", "delete") && (
                      <button className="action-btn delete" onClick={() => handleDeleteClick(category)}>
                        <Trash2 size={14} />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredCategories.length === 0 && !loading && (
        <div className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>No categories found for this branch. Add a new category to get started.</p>
        </div>
      )}

      {showModal && (
        <CategoryModal
          category={currentCategory}
          onClose={() => setShowModal(false)}
          onSave={handleSaveCategory}
          branches={branches}
          selectedBranch={selectedBranch}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          category={categoryToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteCategory}
        />
      )}

      {/* Subcategory Management Section */}
      <div style={{ marginTop: "40px" }}>
        <div className="page-header">
          <h1>Subcategories</h1>
          <button className="btn btn-primary" onClick={handleAddSubcategoryClick}>
            <Plus size={16} />
            <span>Add Subcategory</span>
          </button>
        </div>

        <div className="filters-bar">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search subcategories..."
              className="search-input"
              value={subcategorySearchQuery}
              onChange={(e) => setSubcategorySearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            <div className="filter-btn">
              <Filter size={16} />
              <span>Category:</span>
            </div>
            <select className="filter-select" value={selectedCategoryForSubcategory} onChange={(e) => setSelectedCategoryForSubcategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="data-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Branch</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubcategories.length > 0 ? (
                filteredSubcategories.map((subcategory) => (
                  <tr key={subcategory._id}>
                    <td>{subcategory.name}</td>
                    <td>{subcategory.categoryId?.name || "N/A"}</td>
                    <td>{subcategory.branchId?.name || "N/A"}</td>
                    <td>{subcategory.description || "-"}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn edit" onClick={() => handleEditSubcategoryClick(subcategory)}>
                          <Edit size={14} />
                        </button>
                        <button className="action-btn delete" onClick={() => handleDeleteSubcategoryClick(subcategory)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                    No subcategories found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSubcategoryModal && (
        <SubcategoryModal
          subcategory={currentSubcategory}
          onClose={() => setShowSubcategoryModal(false)}
          onSave={handleSaveSubcategory}
          categories={categories}
          branches={branches}
        />
      )}

      {showSubcategoryDeleteModal && (
        <DeleteConfirmationModal
          category={subcategoryToDelete}
          onClose={() => setShowSubcategoryDeleteModal(false)}
          onConfirm={handleDeleteSubcategory}
        />
      )}
    </div>
  )
}

export default Categories