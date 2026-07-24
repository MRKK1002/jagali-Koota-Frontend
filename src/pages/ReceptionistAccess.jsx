import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Key, Eye, EyeOff } from 'lucide-react';

const ReceptionistAccessModal = ({ user, onClose, onSave, branches, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    username: user?.username || "",
    password: "",
    branchId: user?.branchId || "",
    branchName: user?.branchName || "",
    isActive: user?.isActive !== false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === "branchId") {
      const selectedBranch = branches.find(b => b._id === value);
      setFormData({
        ...formData,
        branchId: value,
        branchName: selectedBranch?.name || "",
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
      if (!isEditMode && !formData.password) {
        throw new Error("Password is required");
      }
      await onSave(formData, user?._id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save receptionist");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit Receptionist" : "Add Receptionist"}</h3>
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
              <label className="form-label" htmlFor="branchId">Branch</label>
              <select
                id="branchId"
                name="branchId"
                className="form-select"
                value={formData.branchId}
                onChange={handleChange}
                disabled={isLoading}
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Receptionist Name <span className="required">*</span>
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
                placeholder="Enter receptionist name"
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
                    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#6b7280"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isEditMode && (
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} disabled={isLoading} />
                  Active
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : (isEditMode ? "Update" : "Add Receptionist")}
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
          <h3 className="modal-title">Delete Receptionist</h3>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>×</button>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to delete <strong>{user.name}</strong>?</p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>Cancel</button>
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

const ReceptionistAccess = () => {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = `${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/receptionist-access`;
  const BRANCH_API_URL = `${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/branch`;

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API_URL);
      if (!response.ok) throw new Error("Failed to fetch branches");
      const data = await response.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Handle different API response formats
      let usersArray = [];
      if (data.success && Array.isArray(data.data)) {
        // New format: {success: true, count: X, data: [...]}
        usersArray = data.data;
      } else if (Array.isArray(data)) {
        // Old format: direct array
        usersArray = data;
      } else if (data.message && data.message.includes('routes working')) {
        // Placeholder response - treat as empty
        usersArray = [];
      }
      
      setUsers(usersArray);
    } catch (error) {
      console.error("Fetch error:", error);
      setErrorMessage(`Failed to fetch receptionists: ${error.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
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

      setSuccessMessage(`Receptionist ${userId ? 'updated' : 'added'} successfully`);
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

      setSuccessMessage("Receptionist deleted successfully");
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
    user.branchName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="receptionist-access-page">
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
        <h1>Receptionist Access</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add Receptionist</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, username or branch..."
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
            <p>No receptionists found. {searchQuery ? "Try a different search." : "Add a new receptionist to get started."}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Branch</th>
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
                      <div className="user-avatar-placeholder">{user.name?.charAt(0).toUpperCase()}</div>
                      {user.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Key size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {user.username}
                    </span>
                  </td>
                  <td>{user.branchName || 'All Branches'}</td>
                  <td>
                    <span style={{
                      padding: "4px 8px", borderRadius: "4px", fontSize: "12px",
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
        <ReceptionistAccessModal
          user={currentUser}
          onClose={() => setShowModal(false)}
          onSave={handleSaveUser}
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

export default ReceptionistAccess;
