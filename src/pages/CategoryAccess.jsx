import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Key, Eye, EyeOff } from 'lucide-react';

const CategoryAccessModal = ({ user, onClose, onSave, categories, branches, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    username: user?.username || "",
    password: "",
    cancelPassword: user?.cancelPassword || "",
    categoryId: user?.categoryId?._id || user?.categoryId || "",
    categoryName: user?.categoryName || "",
    branchId: user?.branchId?._id || user?.branchId || "",
    branchName: user?.branchName || "",
    isActive: user?.isActive !== false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showCancelPassword, setShowCancelPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter categories based on selected branch
  const filteredCategories = formData.branchId 
    ? categories.filter(cat => 
        (cat.branchId === formData.branchId) || 
        (cat.branch?._id === formData.branchId)
      )
    : [];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === "branchId") {
      const selectedBranch = branches.find(b => b._id === value);
      setFormData({
        ...formData,
        branchId: value,
        branchName: selectedBranch?.name || "",
        // Reset category when branch changes
        categoryId: "",
        categoryName: "",
      });
    } else if (name === "categoryId") {
      const selectedCategory = categories.find(c => c._id === value);
      setFormData({
        ...formData,
        categoryId: value,
        categoryName: selectedCategory?.name || "",
      });
    } else {
      setFormData({ 
        ...formData, 
        [name]: type === "checkbox" ? checked : value 
      });
    }
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate
      if (!formData.branchId) {
        throw new Error("Please select a branch");
      }
      if (!formData.categoryId) {
        throw new Error("Please select a category");
      }
      if (!isEditMode && !formData.password) {
        throw new Error("Password is required");
      }

      await onSave(formData, user?._id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save category access user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit Category Access" : "Add Category Access"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert-message" style={{ backgroundColor: "#fee2e2", borderColor: "#dc2626", color: "#dc2626", padding: "10px", borderRadius: "4px", marginBottom: "15px" }}>
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label" htmlFor="branchId">
                Branch <span className="required">*</span>
              </label>
              <select
                id="branchId"
                name="branchId"
                className="form-select"
                value={formData.branchId}
                onChange={handleChange}
                required
                disabled={isLoading}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">
                Category <span className="required">*</span>
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className="form-select"
                value={formData.categoryId}
                onChange={handleChange}
                required
                disabled={isLoading || !formData.branchId}
              >
                <option value="">
                  {!formData.branchId ? "Select Branch First" : "Select Category"}
                </option>
                {filteredCategories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {formData.branchId && filteredCategories.length === 0 && (
                <small style={{ color: "#dc2626", marginTop: "4px", display: "block" }}>
                  No categories available for this branch
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Staff Name <span className="required">*</span>
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
                placeholder="Enter staff name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username <span className="required">*</span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                className="form-input"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isLoading}
                placeholder="Enter username for login"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password {!isEditMode && <span className="required">*</span>}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleChange}
                  required={!isEditMode}
                  disabled={isLoading}
                  placeholder={isEditMode ? "Leave blank to keep current" : "Enter password"}
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cancelPassword">
                Cancel Order Password <span className="required">*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCancelPassword ? "text" : "password"}
                  id="cancelPassword"
                  name="cancelPassword"
                  className="form-input"
                  value={formData.cancelPassword}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="Enter password for order cancellation"
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCancelPassword(!showCancelPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280"
                  }}
                >
                  {showCancelPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <small style={{ color: "#6b7280", marginTop: "4px", display: "block" }}>
                This password will be required when canceling orders
              </small>
            </div>

            {isEditMode && (
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  Active
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : (isEditMode ? "Update" : "Add Access")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ user, onClose, onConfirm }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(user._id);
      onClose();
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Category Access</h3>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>×</button>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to delete access for <strong>{user.name}</strong>?</p>
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
  );
};

const CategoryAccess = () => {
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/category-access";
  const CATEGORY_API_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/category";
  const BRANCH_API_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/branch";

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API_URL);
      if (!response.ok) throw new Error("Failed to fetch branches");
      const data = await response.json();
      
      // Handle API format for branches
      let branchesData = []
      if (data && data.success && Array.isArray(data.data)) {
        branchesData = data.data
      } else if (Array.isArray(data)) {
        branchesData = data
      }
      
      setBranches(branchesData);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(CATEGORY_API_URL);
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      
      // Handle new API format for categories
      let categoriesData = []
      if (data && data.success && Array.isArray(data.data)) {
        categoriesData = data.data
      } else if (Array.isArray(data)) {
        categoriesData = data
      }
      
      setCategories(categoriesData);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
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
        console.error("Expected array but got:", data);
        usersData = []
      }
      
      setUsers(usersData);
    } catch (error) {
      console.error("Fetch error:", error);
      setErrorMessage(`Failed to fetch category access users: ${error.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchCategories();
    fetchUsers();
  }, []);

  const handleAddClick = () => {
    setCurrentUser(null);
    setShowModal(true);
  };

  const handleEditClick = (user) => {
    setCurrentUser(user);
    setShowModal(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleSaveUser = async (formData, userId) => {
    try {
      const url = userId ? `${API_BASE_URL}/${userId}` : API_BASE_URL;
      const method = userId ? "PUT" : "POST";

      // Don't send empty password on update
      const payload = { ...formData };
      if (userId && !payload.password) {
        delete payload.password;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save");

      setSuccessMessage(`Category access ${userId ? 'updated' : 'added'} successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchUsers();
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${userId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete");

      setSuccessMessage("Category access deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="category-access-page">
      {successMessage && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}>×</button>
        </div>
      )}
      {errorMessage && (
        <div className="success-message" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} style={{ color: "#dc2626" }}>×</button>
        </div>
      )}
      
      <div className="page-header">
        <h1>Category Access</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add Category Access</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, username or category..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-card">
        {isLoading ? (
          <div className="empty-state">Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>No category access users found. {searchQuery ? "Try a different search." : "Add a new user to get started."}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Branch</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="user-avatar-placeholder">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Key size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {user.username}
                    </span>
                  </td>
                  <td>{user.branchName || user.branchId?.name || 'N/A'}</td>
                  <td>{user.categoryName || user.categoryId?.name || 'N/A'}</td>
                  <td>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      backgroundColor: user.isActive ? "#dcfce7" : "#fee2e2",
                      color: user.isActive ? "#166534" : "#dc2626"
                    }}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => handleEditClick(user)} disabled={isLoading}>
                        <Edit size={14} />
                      </button>
                      <button className="action-btn delete" onClick={() => handleDeleteClick(user)} disabled={isLoading}>
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
        <CategoryAccessModal
          user={currentUser}
          onClose={() => setShowModal(false)}
          onSave={handleSaveUser}
          categories={categories}
          branches={branches}
          isEditMode={!!currentUser}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          user={userToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
};

export default CategoryAccess;

