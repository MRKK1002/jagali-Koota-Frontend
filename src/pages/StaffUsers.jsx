import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Phone } from 'lucide-react';

const StaffUserModal = ({ staff, onClose, onSave, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: staff?.name || "",
    mobile: staff?.mobile || "",
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSave(formData, staff?._id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save staff user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit Staff User" : "Add New Staff User"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert-message" style={{ backgroundColor: "#fee2e2", borderColor: "#dc2626", color: "#dc2626" }}>
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
              {isLoading ? "Saving..." : (isEditMode ? "Update Staff User" : "Add Staff User")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ staff, onClose, onConfirm }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(staff._id);
      onClose();
    } catch (error) {
      console.error("Error deleting staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Staff User</h3>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{staff.name}</strong>?
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
  );
};

const StaffUsers = () => {
  const [staffUsers, setStaffUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/staff-auth";

  const fetchStaffUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
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
        setStaffUsers([]);
        setErrorMessage("Invalid data format received from server");
        return;
      }
      
      setStaffUsers(usersData);
    } catch (error) {
      console.error("Fetch error:", error);
      setErrorMessage(`Failed to fetch staff users: ${error.message}`);
      setStaffUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  const handleAddClick = () => {
    setCurrentStaff(null);
    setShowModal(true);
  };

  const handleEditClick = (staff) => {
    setCurrentStaff(staff);
    setShowModal(true);
  };

  const handleDeleteClick = (staff) => {
    setStaffToDelete(staff);
    setShowDeleteModal(true);
  };

  const handleSaveStaff = async (formData, staffId) => {
    try {
      const url = staffId
        ? `${API_BASE_URL}/${staffId}`
        : `${API_BASE_URL}/register`;
      const method = staffId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to save staff user");
      }

      setSuccessMessage(`Staff user ${staffId ? 'updated' : 'added'} successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchStaffUsers();
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${staffId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete staff user");
      }

      setSuccessMessage("Staff user deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchStaffUsers();
    } catch (error) {
      setErrorMessage(error.message);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const filteredStaffUsers = staffUsers.filter((staff) =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.mobile.includes(searchQuery)
  );

  return (
    <div className="staff-users-page">
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
        <h1>Staff Users</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add Staff User</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search staff users..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-card">
        {isLoading ? (
          <div className="empty-state">Loading staff users...</div>
        ) : filteredStaffUsers.length === 0 ? (
          <div className="empty-state">
            <p>No staff users found. {searchQuery ? "Try a different search." : "Add a new staff user to get started."}</p>
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
              {filteredStaffUsers.map((staff) => (
                <tr key={staff._id}>
                  <td>{staff._id.slice(-6)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="user-avatar-placeholder">
                        {staff.name.charAt(0).toUpperCase()}
                      </div>
                      {staff.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Phone size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {staff.mobile}
                    </span>
                  </td>
                  <td>{formatDate(staff.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => handleEditClick(staff)} disabled={isLoading}>
                        <Edit size={14} />
                      </button>
                      <button className="action-btn delete" onClick={() => handleDeleteClick(staff)} disabled={isLoading}>
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
        <StaffUserModal
          staff={currentStaff}
          onClose={() => setShowModal(false)}
          onSave={handleSaveStaff}
          isEditMode={!!currentStaff}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          staff={staffToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteStaff}
        />
      )}
    </div>
  );
};

export default StaffUsers;
