import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Members.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';

const Members = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMember, setCurrentMember] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    dateOfBirth: '',
    joiningDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    initialWalletBalance: 0,
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
    },
    documents: {
      aadhar: null,
      passport: null,
    },
  });
  const [aadharFile, setAadharFile] = useState(null);
  const [passportFile, setPassportFile] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAction, setWalletAction] = useState({ memberId: null, amount: 0, type: 'credit' });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/member/all`);
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      alert('Error loading members');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setCurrentMember({
        ...currentMember,
        address: {
          ...currentMember.address,
          [addressField]: value,
        },
      });
    } else {
      setCurrentMember({ ...currentMember, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Aadhar is uploaded for new members
    if (!editMode && !aadharFile) {
      alert('Aadhar card is mandatory!');
      return;
    }
    
    try {
      let memberId;
      
      // Clean up the data before sending
      const memberData = {
        ...currentMember,
        // Remove empty strings and convert to undefined
        dateOfBirth: currentMember.dateOfBirth || undefined,
        // Clean up address - remove empty fields
        address: {
          street: currentMember.address?.street || undefined,
          city: currentMember.address?.city || undefined,
          state: currentMember.address?.state || undefined,
          zipCode: currentMember.address?.zipCode || undefined,
          country: currentMember.address?.country || 'India',
        },
      };
      
      // Remove _id and documents from payload for creation
      if (!editMode) {
        delete memberData._id;
        delete memberData.documents;
      }
      
      console.log('Sending member data:', memberData); // Debug log
      
      if (editMode) {
        await axios.put(`${API_URL}/member/${currentMember._id}`, memberData);
        memberId = currentMember._id;
        alert('Member updated successfully!');
      } else {
        const response = await axios.post(`${API_URL}/member/create`, memberData);
        memberId = response.data.member._id;
        alert('Member created successfully! QR code has been generated.');
      }
      
      // Upload Aadhar if provided
      if (aadharFile) {
        const formData = new FormData();
        formData.append('document', aadharFile); // Changed from 'file' to 'document'
        formData.append('memberId', memberId);
        formData.append('documentType', 'aadhar');
        
        console.log('Uploading Aadhar document...'); // Debug log
        try {
          await axios.post(`${API_URL}/member/upload-document`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('Aadhar uploaded successfully');
        } catch (uploadError) {
          console.error('Aadhar upload failed:', uploadError.response?.data);
          alert(`Member created but Aadhar upload failed: ${uploadError.response?.data?.message || uploadError.message}`);
        }
      }
      
      // Upload Passport if provided
      if (passportFile) {
        const formData = new FormData();
        formData.append('document', passportFile); // Changed from 'file' to 'document'
        formData.append('memberId', memberId);
        formData.append('documentType', 'passport');
        
        console.log('Uploading Passport document...'); // Debug log
        try {
          await axios.post(`${API_URL}/member/upload-document`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('Passport uploaded successfully');
        } catch (uploadError) {
          console.error('Passport upload failed:', uploadError.response?.data);
          alert(`Member created but Passport upload failed: ${uploadError.response?.data?.message || uploadError.message}`);
        }
      }
      
      setShowModal(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      console.error('Error saving member:', error);
      console.error('Error details:', error.response?.data); // More detailed error log
      alert(error.response?.data?.message || error.response?.data?.error || 'Error saving member. Check console for details.');
    }
  };

  const handleEdit = (member) => {
    setCurrentMember(member);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this member permanently? This action cannot be undone.')) {
      try {
        await axios.delete(`${API_URL}/member/${id}`);
        alert('Member deleted successfully');
        fetchMembers();
      } catch (error) {
        console.error('Error deleting member:', error);
        alert(error.response?.data?.message || 'Error deleting member');
      }
    }
  };

  const openWalletModal = (memberId, type) => {
    setWalletAction({ memberId, amount: 0, type });
    setShowWalletModal(true);
  };

  const handleWalletTopUp = async () => {
    try {
      const { memberId, amount, type } = walletAction;
      
      if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      await axios.post(`${API_URL}/wallet/admin-transaction`, {
        memberId,
        amount: parseFloat(amount),
        type,
        description: `Admin ${type === 'credit' ? 'top-up' : 'deduction'}`,
      });

      alert(`Wallet ${type === 'credit' ? 'topped up' : 'deducted'} successfully!`);
      setShowWalletModal(false);
      setWalletAction({ memberId: null, amount: 0, type: 'credit' });
      fetchMembers();
    } catch (error) {
      console.error('Error updating wallet:', error);
      alert(error.response?.data?.message || 'Error updating wallet');
    }
  };

  const resetForm = () => {
    setCurrentMember({
      name: '',
      email: '',
      password: '',
      phone: '',
      dateOfBirth: '',
      joiningDate: new Date().toISOString().split('T')[0],
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      initialWalletBalance: 0,
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'India',
      },
      documents: {
        aadhar: null,
        passport: null,
      },
    });
    setAadharFile(null);
    setPassportFile(null);
    setEditMode(false);
  };

  const filteredMembers = members.filter(member =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="members-container">
      <div className="members-header">
        <h1>👥 Membership Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          ➕ Add New Member
        </button>
      </div>

      {/* Filters */}
      <div className="members-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by name, email, or member ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Members Grid */}
      {loading ? (
        <div className="loading">Loading members...</div>
      ) : (
        <div className="members-grid">
          {filteredMembers.map((member) => (
            <div key={member._id} className="member-card">
              <div className="member-header">
                <div className="member-avatar">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div className="membership-badge" style={{ backgroundColor: '#ff7e47' }}>
                  Member
                </div>
              </div>
              
              <div className="member-info">
                <h3>{member.name}</h3>
                <p className="member-id">ID: {member.memberNumber}</p>
                <p className="member-email">📧 {member.email}</p>
                <p className="member-phone">📱 {member.phone}</p>
              </div>

              <div className="member-details">
                <div className="detail-row">
                  <span>Wallet:</span>
                  <strong>₹{member.walletBalance?.toFixed(2) || '0.00'}</strong>
                </div>
                <div className="detail-row">
                  <span>Joining:</span>
                  <strong>{new Date(member.joiningDate || member.createdAt).toLocaleDateString()}</strong>
                </div>
                <div className="detail-row">
                  <span>Valid Until:</span>
                  <strong>{new Date(member.validUntil).toLocaleDateString()}</strong>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className={`status ${member.isActive ? 'active' : 'inactive'}`}>
                    {member.isActive ? '✓ Active' : '✗ Inactive'}
                  </span>
                </div>
              </div>

              <div className="member-actions">
                <button className="btn-wallet" onClick={() => openWalletModal(member._id, 'credit')}>
                  💰 Top Up
                </button>
                <button className="btn-edit" onClick={() => handleEdit(member)}>
                  ✏️ Edit
                </button>
                <button className="btn-delete" onClick={() => handleDelete(member._id)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredMembers.length === 0 && !loading && (
        <div className="no-members">
          <p>No members found</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Member' : 'Add New Member'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="member-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={currentMember.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={currentMember.email}
                    onChange={handleInputChange}
                    required
                    disabled={editMode}
                  />
                </div>
              </div>

              {!editMode && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={currentMember.password}
                      onChange={handleInputChange}
                      required
                      minLength="6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={currentMember.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              {editMode && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={currentMember.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={currentMember.dateOfBirth?.split('T')[0] || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Joining Date *</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={currentMember.joiningDate?.split('T')[0] || new Date().toISOString().split('T')[0]}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Date *</label>
                  <input
                    type="date"
                    name="validUntil"
                    value={currentMember.validUntil?.split('T')[0] || ''}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {!editMode && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Initial Wallet Balance</label>
                    <input
                      type="number"
                      name="initialWalletBalance"
                      value={currentMember.initialWalletBalance || 0}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="₹0.00"
                    />
                  </div>
                </div>
              )}

              <div className="form-section">
                <h3>Documents</h3>
                <div className="form-group">
                  <label>Aadhar Card * (Mandatory)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setAadharFile(e.target.files[0])}
                    required={!editMode}
                  />
                  {editMode && currentMember.documents?.aadhar && (
                    <small>Current: <a href={currentMember.documents.aadhar} target="_blank" rel="noopener noreferrer">View Aadhar</a></small>
                  )}
                </div>
                <div className="form-group">
                  <label>Passport (Optional)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPassportFile(e.target.files[0])}
                  />
                  {editMode && currentMember.documents?.passport && (
                    <small>Current: <a href={currentMember.documents.passport} target="_blank" rel="noopener noreferrer">View Passport</a></small>
                  )}
                </div>
              </div>

              <div className="form-row">
                {!editMode && (
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={currentMember.dateOfBirth}
                      onChange={handleInputChange}
                    />
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street</label>
                  <input
                    type="text"
                    name="address.street"
                    value={currentMember.address?.street || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="address.city"
                      value={currentMember.address?.city || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="address.state"
                      value={currentMember.address?.state || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Zip Code</label>
                    <input
                      type="text"
                      name="address.zipCode"
                      value={currentMember.address?.zipCode || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      name="address.country"
                      value={currentMember.address?.country || 'India'}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editMode ? 'Update Member' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet Top-Up Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 Wallet Top-Up</h2>
              <button className="modal-close" onClick={() => setShowWalletModal(false)}>
                ✕
              </button>
            </div>

            <div className="wallet-form">
              <div className="form-group">
                <label>Amount (₹)</label>
                <input
                  type="number"
                  value={walletAction.amount}
                  onChange={(e) => setWalletAction({...walletAction, amount: e.target.value})}
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  autoFocus
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowWalletModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-submit" onClick={handleWalletTopUp}>
                  Add Money
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
