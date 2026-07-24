import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Phone } from 'lucide-react';

const PurchaseUserModal = ({ user, onClose, onSave, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phoneNumber: user?.phoneNumber || "",
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
      await onSave(formData, user?.phoneNumber);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save purchase user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit Purchase User" : "Add New Purchase User"}</h3>
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
              <label className="form-label" htmlFor="phoneNumber">
                Phone Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="phoneNumber"
                name="phoneNumber"
                className="form-input"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                pattern="\d{10}"
                title="Please enter a valid 10-digit phone number"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : (isEditMode ? "Update Purchase User" : "Add Purchase User")}
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
      await onConfirm(user.phoneNumber);
      onClose();
    } catch (error) {
      console.error("Error deleting purchase user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Purchase User</h3>
          <button className="modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{user.name}</strong>?
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

const PurchaseUsers = () => {
  const [purchaseUsers, setPurchaseUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel") + "/purchase-user-auth";

  const fetchPurchaseUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/all`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle new API response format {success, count, data}
      let usersData = []
      if (data && data.success && Array.isArray(data.data)) {
        // New format: {success, count, data}
        usersData = data.data
      } else if (data && data.success && Array.isArray(data.users)) {
        // Current format: {success: true, users: [...]}
        usersData = data.users
      } else if (Array.isArray(data)) {
        // Direct array format
        usersData = data
      } else if (data && data.message && data.message.includes('routes working')) {
        // Placeholder response - server not restarted
        console.log("⚠️ Server returning placeholder response:", data.message);
        usersData = []
      } else {
        console.error("Expected array but got:", data);
        setPurchaseUsers([]);
        setErrorMessage("Invalid data format received from server");
        return;
      }
      
      setPurchaseUsers(usersData);
    } catch (error) {
      console.error("Fetch error:", error);
      setErrorMessage(`Failed to fetch purchase users: ${error.message}`);
      setPurchaseUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseUsers();
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

  const handleSaveUser = async (formData, originalPhoneNumber) => {
    try {
      const url = originalPhoneNumber
        ? `${API_BASE_URL}/${originalPhoneNumber}`
        : `${API_BASE_URL}/register`;
      const method = originalPhoneNumber ? "PUT" : "POST";

      // For updates, send newPhoneNumber if phone number changed
      const requestData = originalPhoneNumber ? {
        name: formData.name,
        ...(formData.phoneNumber !== originalPhoneNumber && { newPhoneNumber: formData.phoneNumber })
      } : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to save purchase user");
      }

      setSuccessMessage(`Purchase user ${originalPhoneNumber ? 'updated' : 'added'} successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchPurchaseUsers();
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const handleDeleteUser = async (phoneNumber) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${phoneNumber}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete purchase user");
      }

      setSuccessMessage("Purchase user deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchPurchaseUsers();
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

  const filteredPurchaseUsers = purchaseUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phoneNumber.includes(searchQuery)
  );

  return (
    <div className="purchase-users-page">
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
        <h1>Purchase Users</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add Purchase User</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search purchase users..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-card">
        {isLoading ? (
          <div className="empty-state">Loading purchase users...</div>
        ) : filteredPurchaseUsers.length === 0 ? (
          <div className="empty-state">
            <p>No purchase users found. {searchQuery ? "Try a different search." : "Add a new purchase user to get started."}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseUsers.map((user) => (
                <tr key={user._id}>
                  <td>{user._id.slice(-6)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div className="user-avatar-placeholder">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Phone size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {user.phoneNumber}
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
        <PurchaseUserModal
          user={currentUser}
          onClose={() => setShowModal(false)}
          onSave={handleSaveUser}
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

export default PurchaseUsers;