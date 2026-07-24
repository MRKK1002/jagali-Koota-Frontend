import { useState, useEffect } from "react";
import { Search, Edit, Trash2, UserPlus, Mail, Phone, Image as ImageIcon } from "lucide-react";
import { fetchDualBackend } from "../utils/apiHelpers";

const UserModal = ({ user, onClose, onSave, isEditMode }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    mobile: user?.mobile || "",
    email: user?.email || "",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(
    user?.image ? `${user.image.startsWith('http') ? '' : 'https://billing.jagalikoota.com/'}${user.image}` : null
  );
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const formDataToSend = new FormData();
    formDataToSend.append("name", formData.name);
    formDataToSend.append("mobile", formData.mobile);
    if (isEditMode && formData.email) formDataToSend.append("email", formData.email);
    if (formData.image) formDataToSend.append("image", formData.image);

    try {
      await onSave(formDataToSend, user?._id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save user");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEditMode ? "Edit User" : "Add New User"}</h3>
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
              />
            </div>
            {isEditMode && (
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Profile Image</label>
              <div className="image-upload-container">
                <label htmlFor="image-upload" className="image-upload-label">
                  {imagePreview ? (
                    <div className="image-preview-wrapper">
                      <img src={imagePreview} alt="User preview" className="image-preview" />
                      <div className="image-overlay">
                        <span>Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="image-upload-placeholder">
                      <ImageIcon size={24} />
                      <span>Upload Profile Image</span>
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
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? "Update User" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ user, onClose, onConfirm }) => {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete User</h3>
          <button className="modal-close" onClick={onClose}>
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
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={() => {
              onConfirm(user._id);
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDualBackend('/user-auth/all');
      // Ensure data is an array before sorting
      const usersArray = Array.isArray(data) ? data : [];
      // Sort users by creation date (newest first)
      const sortedUsers = usersArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUsers(sortedUsers);
    } catch (error) {
      setErrorMessage(error.message);
      setUsers([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      const endpoint = userId ? `/user-auth/${userId}` : `/user-auth/`;
      const method = userId ? "PUT" : "POST";

      await fetchDualBackend(endpoint, {
        method,
        body: formData,
      });

      setSuccessMessage(`User ${userId ? 'updated' : 'added'} successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchUsers();
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await fetchDualBackend(`/user-auth/${userId}`, {
        method: "DELETE",
      });

      setSuccessMessage("User deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const filteredUsers = Array.isArray(users) ? users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.mobile.includes(searchQuery) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  return (
    <div className="users-page">
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
        <h1>Users</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleAddClick} disabled={isLoading}>
            <UserPlus size={16} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-card">
        {isLoading ? (
          <div className="empty-state">Loading users...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>{user._id.slice(-6)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {user.image ? (
                        <img
                          src={`${user.image.startsWith('http') ? '' : 'https://billing.jagalikoota.com/'}${user.image}`}
                          alt={user.name}
                          className="user-avatar"
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {user.name}
                    </div>
                  </td>
                  <td>
                    {user.email ? (
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <Mail size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                        {user.email}
                      </span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Not provided</span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Phone size={14} style={{ marginRight: "6px", color: "#6b7280" }} />
                      {user.mobile}
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

      {filteredUsers.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No users found. {searchQuery ? "Try a different search." : "Add a new user to get started."}</p>
        </div>
      )}

      {showModal && (
        <UserModal
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

export default Users;