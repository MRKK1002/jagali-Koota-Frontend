import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiCreditCard, FiPlusCircle, FiEdit2, FiTrash2, FiUserPlus, FiList, FiCalendar, FiClock, FiMail, FiPhone, FiMinusCircle, FiSearch, FiAlertTriangle, FiFileText, FiX, FiUser } from 'react-icons/fi';
import { MdAccountBalanceWallet } from 'react-icons/md';
import { ShieldBan } from 'lucide-react';
import MembershipCard from '../components/MembershipCard';
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
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAction, setWalletAction] = useState({ memberId: null, amount: 0, type: 'credit' });
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardMember, setSelectedCardMember] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txMember, setTxMember] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('members');

  // Blacklist state
  const [blEntries, setBlEntries] = useState([]);
  const [blLoading, setBlLoading] = useState(false);
  const [blSearch, setBlSearch] = useState('');
  const [blShowModal, setBlShowModal] = useState(false);
  const [blEditMode, setBlEditMode] = useState(false);
  const [blCurrent, setBlCurrent] = useState({ name: '', phone: '', reason: '', notes: '' });
  const [blSaving, setBlSaving] = useState(false);
  const [blCheckQuery, setBlCheckQuery] = useState('');

  useEffect(() => {
    fetchMembers();
    fetchBlacklist();
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

  // ─── Blacklist Functions ────────────────────────────────────────────────────
  const fetchBlacklist = async () => {
    try {
      setBlLoading(true);
      const response = await axios.get(`${API_URL}/blacklist/all`);
      setBlEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching blacklist:', error);
    } finally {
      setBlLoading(false);
    }
  };

  const handleBlAdd = async () => {
    if (!blCurrent.name || !blCurrent.phone || !blCurrent.reason) {
      alert('Name, phone, and reason are required');
      return;
    }
    try {
      setBlSaving(true);
      if (blEditMode && blCurrent._id) {
        await axios.put(`${API_URL}/blacklist/update/${blCurrent._id}`, blCurrent);
        alert('Entry updated');
      } else {
        await axios.post(`${API_URL}/blacklist/add`, blCurrent);
        alert('Person added to blacklist');
      }
      setBlShowModal(false);
      setBlCurrent({ name: '', phone: '', reason: '', notes: '' });
      setBlEditMode(false);
      fetchBlacklist();
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving entry');
    } finally {
      setBlSaving(false);
    }
  };

  const handleBlRemove = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from blacklist?`)) return;
    try {
      await axios.put(`${API_URL}/blacklist/remove/${id}`);
      fetchBlacklist();
    } catch (error) {
      alert('Error removing entry');
    }
  };

  const handleBlDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/blacklist/${id}`);
      fetchBlacklist();
    } catch (error) {
      alert('Error deleting entry');
    }
  };

  const filteredBlEntries = blEntries.filter(entry =>
    entry.name?.toLowerCase().includes(blSearch.toLowerCase()) ||
    entry.phone?.includes(blSearch) ||
    entry.reason?.toLowerCase().includes(blSearch.toLowerCase())
  );
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
      
      // Upload Photo if provided
      if (photoFile) {
        const formData = new FormData();
        formData.append('document', photoFile);
        formData.append('memberId', memberId);
        formData.append('documentType', 'profilePhoto');
        
        console.log('Uploading member photo...');
        try {
          await axios.post(`${API_URL}/member/upload-document`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('Photo uploaded successfully');
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError.response?.data);
          alert(`Member created but photo upload failed: ${uploadError.response?.data?.message || uploadError.message}`);
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
  const openTxModal = async (member) => {
    setTxMember(member);
    setTransactions([]);
    setShowTxModal(true);
    setTxLoading(true);
    try {
      const res = await axios.get(`${API_URL}/wallet/all-transactions`, {
        params: { memberId: member._id, limit: 50 },
      });
      setTransactions(res.data?.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };
  const openWalletModal = (member, type) => {
    setWalletAction({ memberId: member._id, amount: 0, type, member, reason: '' });
    setShowWalletModal(true);
  };
  const handleWalletTopUp = async () => {
    if (topUpLoading) return;
    try {
      const { memberId, amount, type, reason } = walletAction;
      
      if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      if (type === 'debit' && !reason?.trim()) {
        alert('Please enter a reason for deduction');
        return;
      }

      setTopUpLoading(true);
      await axios.post(`${API_URL}/wallet/admin-transaction`, {
        memberId,
        amount: parseFloat(amount),
        type,
        description: type === 'credit' ? 'Admin top-up' : reason.trim(),
      });

      alert(`Wallet ${type === 'credit' ? 'topped up' : 'deducted'} successfully!`);
      setShowWalletModal(false);
      setWalletAction({ memberId: null, amount: 0, type: 'credit' });
      fetchMembers();
    } catch (error) {
      console.error('Error updating wallet:', error);
      alert(error.response?.data?.message || 'Error updating wallet');
    } finally {
      setTopUpLoading(false);
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
    setPhotoFile(null);
    setPhotoPreview(null);
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
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'members' && (
            <button className="btn-add-member" onClick={() => setShowModal(true)}>
              <FiUserPlus style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Add New Member
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="members-tabs">
        <button className={`members-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          <FiUserPlus size={16} /> Members ({members.length})
        </button>
        <button className={`members-tab members-tab--danger ${activeTab === 'blacklist' ? 'active' : ''}`} onClick={() => setActiveTab('blacklist')}>
          <ShieldBan size={16} /> Blacklist ({blEntries.length})
        </button>
      </div>

      {/* ═══ MEMBERS TAB ═══ */}
      {activeTab === 'members' && (
        <>
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
              {/* Top stripe with avatar + badge */}
              <div className="member-card-top">
                <div className="member-avatar">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div className="member-card-top-right">
                  <span className={`status ${member.isActive ? 'active' : 'inactive'}`}>
                    {member.isActive ? '✓ Active' : '✗ Inactive'}
                  </span>
                  <span className="membership-badge">Member</span>
                </div>
              </div>

              {/* Name + contact */}
              <div className="member-info">
                <h3>{member.name}</h3>
                <p className="member-id"><FiCreditCard style={{ verticalAlign: 'middle', marginRight: 5 }} />{member.memberNumber}</p>
                <p className="member-email"><FiMail style={{ verticalAlign: 'middle', marginRight: 5 }} />{member.email}</p>
                <p className="member-phone"><FiPhone style={{ verticalAlign: 'middle', marginRight: 5 }} />{member.phone}</p>
              </div>

              {/* Stats chips */}
              <div className="member-stats">
                <div className="stat-chip stat-chip--wallet">
                  <span className="stat-label"><MdAccountBalanceWallet style={{ verticalAlign: 'middle', marginRight: 4 }} />Wallet</span>
                  <span className="stat-value">₹{member.walletBalance?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-label"><FiCalendar style={{ verticalAlign: 'middle', marginRight: 4 }} />Joined</span>
                  <span className="stat-value">{new Date(member.joiningDate || member.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-label"><FiClock style={{ verticalAlign: 'middle', marginRight: 4 }} />Valid Till</span>
                  <span className="stat-value">{new Date(member.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Primary actions */}
              <div className="member-actions member-actions--primary">
                <button className="btn-view-card" onClick={() => { setSelectedCardMember(member); setShowCardModal(true); }}>
                  <FiCreditCard style={{ marginRight: '5px', verticalAlign: 'middle' }} /> View Card
                </button>
                <button className="btn-wallet" onClick={() => openWalletModal(member, 'credit')}>
                  <MdAccountBalanceWallet style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Top Up
                </button>
                <button className="btn-deduct" onClick={() => openWalletModal(member, 'debit')}>
                  <FiMinusCircle style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Deduct
                </button>
                <button className="btn-transactions" onClick={() => openTxModal(member)}>
                  <FiList style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Transactions
                </button>
              </div>

              {/* Secondary actions */}
              <div className="member-actions member-actions--secondary">
                <button className="btn-edit" onClick={() => handleEdit(member)}>
                  <FiEdit2 style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Edit Member
                </button>
                <button className="btn-delete" onClick={() => handleDelete(member._id)}>
                  <FiTrash2 style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Delete
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
        </>
      )}

      {/* ═══ BLACKLIST TAB ═══ */}
      {activeTab === 'blacklist' && (
        <>
          {/* Search Members to Block */}
          <div className="bl-check-section">
            <h3 style={{ fontSize: '15px', color: '#92400e', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
              <FiSearch style={{ marginRight: '8px', color: '#f59e0b' }} /> Search Member to Block
            </h3>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Type member name, phone, or member ID to search..."
                value={blCheckQuery}
                onChange={(e) => { setBlCheckQuery(e.target.value); }}
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #fde68a', borderRadius: '10px', fontSize: '15px', background: 'white' }}
              />
            </div>
            {/* Show matching members */}
            {blCheckQuery.trim().length > 0 && (() => {
              const query = blCheckQuery.toLowerCase();
              const matchingMembers = members.filter(m =>
                m.name?.toLowerCase().includes(query) ||
                m.phone?.includes(query) ||
                m.memberNumber?.toLowerCase().includes(query)
              );
              // Filter out already blacklisted
              const blacklistedPhones = blEntries.map(e => e.phone);
              return matchingMembers.length > 0 ? (
                <div style={{ marginTop: '12px', maxHeight: '300px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb', background: 'white' }}>
                  {matchingMembers.map(m => {
                    const isAlreadyBlocked = blacklistedPhones.includes(m.phone);
                    return (
                      <div key={m._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isAlreadyBlocked ? '#fef2f2' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isAlreadyBlocked ? '#dc2626' : '#6B2219', fontWeight: 700, fontSize: '15px' }}>
                            {m.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{m.name}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{m.phone} • {m.memberNumber}</p>
                          </div>
                        </div>
                        {isAlreadyBlocked ? (
                          <span style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', padding: '4px 12px', borderRadius: '6px', fontWeight: 600, border: '1px solid #fecaca' }}>🚫 Already Blocked</span>
                        ) : (
                          <button
                            onClick={() => { setBlCurrent({ name: m.name, phone: m.phone, reason: '', notes: '', memberId: m._id, memberNumber: m.memberNumber }); setBlEditMode(false); setBlShowModal(true); }}
                            style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ShieldBan size={14} /> Block
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af' }}>No members found matching "{blCheckQuery}"</p>
              );
            })()}
          </div>

          {/* Blocked Members List */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', color: '#1a1a1a', margin: 0, fontWeight: 700 }}>🚫 Blocked Members ({blEntries.length})</h3>
            {blEntries.length > 0 && (
              <div className="members-filters" style={{ margin: 0, padding: '8px 14px', flex: '0 1 300px' }}>
                <div className="search-box" style={{ position: 'relative', marginBottom: 0 }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '14px' }} />
                  <input
                    type="text"
                    placeholder="Filter blocked list..."
                    value={blSearch}
                    onChange={(e) => setBlSearch(e.target.value)}
                    style={{ paddingLeft: '36px', padding: '8px 12px 8px 36px', fontSize: '13px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Blacklist Grid */}
          {blLoading ? (
            <div className="loading">Loading blacklist...</div>
          ) : filteredBlEntries.length === 0 ? (
            <div className="no-members" style={{ padding: '60px 20px' }}>
              <ShieldBan size={48} color="#d1d5db" />
              <p style={{ marginTop: '16px' }}>{blSearch ? 'No matches found' : 'No members have been blocked yet'}</p>
            </div>
          ) : (
            <div className="members-grid">
              {filteredBlEntries.map((entry) => (
                <div key={entry._id} className="member-card" style={{ borderTop: '4px solid #dc2626' }}>
                  <div className="member-card-top">
                    <div className="member-avatar" style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', color: '#dc2626', fontSize: '18px' }}>
                      {entry.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="member-card-top-right">
                      <span className="status inactive" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        🚫 Blocked
                      </span>
                    </div>
                  </div>

                  <div className="member-info">
                    <h3>{entry.name}</h3>
                    <p className="member-phone"><FiPhone style={{ verticalAlign: 'middle', marginRight: 5 }} />{entry.phone}</p>
                  </div>

                  {/* Reason */}
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', margin: '0 16px 10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <FiAlertTriangle size={14} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#991b1b', lineHeight: 1.4, fontWeight: 500 }}>{entry.reason}</span>
                  </div>

                  {/* Notes */}
                  {entry.notes && (
                    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 12px', margin: '0 16px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#6b7280', fontSize: '12px', lineHeight: 1.4 }}>
                      <FiFileText size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span>{entry.notes}</span>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#9ca3af' }}>
                    <span><FiCalendar size={11} style={{ marginRight: '4px' }} />{new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>By: {entry.blacklistedBy}</span>
                  </div>

                  {/* Actions */}
                  <div className="member-actions member-actions--secondary">
                    <button className="btn-edit" style={{ color: '#22c55e', borderColor: '#bbf7d0' }} onClick={() => handleBlRemove(entry._id, entry.name)}>
                      <FiX style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Unblock
                    </button>
                    <button className="btn-delete" onClick={() => handleBlDelete(entry._id, entry.name)}>
                      <FiTrash2 style={{ marginRight: '5px', verticalAlign: 'middle' }} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Blacklist Add/Edit Modal */}
      {blShowModal && (
        <div className="modal-overlay" onClick={() => setBlShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{blEditMode ? 'Edit Blacklist Entry' : 'Block Member'}</h2>
              <button className="modal-close" onClick={() => setBlShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Member info banner (when blocking from search) */}
              {!blEditMode && blCurrent.memberNumber && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '16px' }}>
                    {blCurrent.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>{blCurrent.name}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{blCurrent.phone} • {blCurrent.memberNumber}</p>
                  </div>
                </div>
              )}

              {/* Show editable name/phone only in edit mode */}
              {blEditMode && (
                <>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={blCurrent.name} onChange={(e) => setBlCurrent({ ...blCurrent, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" value={blCurrent.phone} onChange={(e) => setBlCurrent({ ...blCurrent, phone: e.target.value })} />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Reason for Blocking *</label>
                <textarea placeholder="Why is this member being blocked?" value={blCurrent.reason} onChange={(e) => setBlCurrent({ ...blCurrent, reason: e.target.value })} rows={3} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label>Additional Notes (Optional)</label>
                <textarea placeholder="Any additional information..." value={blCurrent.notes} onChange={(e) => setBlCurrent({ ...blCurrent, notes: e.target.value })} rows={2} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setBlShowModal(false)}>Cancel</button>
                <button type="button" className="btn-submit" style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }} onClick={handleBlAdd} disabled={blSaving}>
                  {blSaving ? 'Blocking...' : blEditMode ? 'Update' : 'Block Member'}
                </button>
              </div>
            </div>
          </div>
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
                <h3>Member Photo</h3>
                <div className="form-group">
                  <label>Upload Photo *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setPhotoFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setPhotoPreview(reader.result);
                        reader.readAsDataURL(file);
                      } else {
                        setPhotoPreview(null);
                      }
                    }}
                  />
                  {photoPreview && (
                    <div style={{ marginTop: '10px' }}>
                      <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '2px solid #c5a55a' }} />
                    </div>
                  )}
                  {editMode && currentMember.profileImage && !photoPreview && (
                    <div style={{ marginTop: '10px' }}>
                      <img src={currentMember.profileImage.startsWith('http') ? currentMember.profileImage : `${API_URL.replace('/api/v1/hotel', '')}${currentMember.profileImage}`} alt="Current" style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '2px solid #c5a55a' }} />
                      <small style={{ display: 'block', marginTop: '4px' }}>Current photo</small>
                    </div>
                  )}
                </div>
              </div>

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

      {/* Wallet Top-Up / Deduct Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-header wallet-modal-header wallet-modal-header--${walletAction.type}`}>
              <h2>
                {walletAction.type === 'credit'
                  ? <><MdAccountBalanceWallet style={{ verticalAlign: 'middle', marginRight: 8 }} />Wallet Top-Up</>
                  : <><FiMinusCircle style={{ verticalAlign: 'middle', marginRight: 8 }} />Deduct from Wallet</>}
              </h2>
              <button className="modal-close" onClick={() => setShowWalletModal(false)}>✕</button>
            </div>

            <div className="wallet-form">
              {/* Current balance display */}
              <div className="wallet-balance-display">
                <span className="wallet-balance-label">Current Balance</span>
                <span className="wallet-balance-amount">₹{(walletAction.member?.walletBalance || 0).toFixed(2)}</span>
              </div>

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
                  className={`wallet-input wallet-input--${walletAction.type}`}
                />
              </div>

              {/* Reason — debit only */}
              {walletAction.type === 'debit' && (
                <div className="form-group">
                  <label>Reason for Deduction <span style={{ color: '#b91c1c' }}>*</span></label>
                  <input
                    type="text"
                    value={walletAction.reason || ''}
                    onChange={(e) => setWalletAction({ ...walletAction, reason: e.target.value })}
                    placeholder="e.g. Order payment, correction, penalty…"
                    className="wallet-input wallet-input--debit"
                    maxLength={120}
                  />
                </div>
              )}

              {/* After-transaction balance preview */}
              {parseFloat(walletAction.amount) > 0 && (() => {
                const current = walletAction.member?.walletBalance || 0;
                const amt = parseFloat(walletAction.amount) || 0;
                const after = walletAction.type === 'credit' ? current + amt : current - amt;
                const insufficient = walletAction.type === 'debit' && after < 0;
                return (
                  <div className={`wallet-preview wallet-preview--${insufficient ? 'error' : walletAction.type}`}>
                    <span className="wallet-preview-label">
                      {walletAction.type === 'credit' ? '▲ After top-up' : insufficient ? '⚠ Insufficient balance' : '▼ After deduction'}
                    </span>
                    <span className="wallet-preview-value">
                      {insufficient ? '—' : `₹${after.toFixed(2)}`}
                    </span>
                  </div>
                );
              })()}

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowWalletModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={walletAction.type === 'credit' ? 'btn-submit' : 'btn-submit btn-submit--deduct'}
                  onClick={handleWalletTopUp}
                  disabled={topUpLoading}
                  style={{ opacity: topUpLoading ? 0.7 : 1, cursor: topUpLoading ? 'not-allowed' : 'pointer' }}
                >
                  {topUpLoading
                    ? (walletAction.type === 'credit' ? 'Adding...' : 'Deducting...')
                    : (walletAction.type === 'credit' ? 'Add Money' : 'Deduct Money')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Transactions Modal */}
      {showTxModal && txMember && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal-content tx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>📋 Transactions — {txMember.name}</h2>
                <p className="tx-modal-sub">
                  {txMember.memberNumber} &nbsp;|&nbsp; Balance: <strong>₹{txMember.walletBalance?.toFixed(2) || '0.00'}</strong>
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowTxModal(false)}>✕</button>
            </div>

            <div className="tx-body">
              {txLoading ? (
                <div className="tx-loading">Loading transactions…</div>
              ) : transactions.length === 0 ? (
                <div className="tx-empty">No transactions found for this member.</div>
              ) : (
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance Before</th>
                      <th>Balance After</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx._id}>
                        <td className="tx-date">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          <br />
                          <span className="tx-time">
                            {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`tx-badge tx-badge--${tx.type}`}>
                            {tx.type === 'credit' ? '▲ Credit' : '▼ Debit'}
                          </span>
                        </td>
                        <td className={`tx-amount tx-amount--${tx.type}`}>
                          {tx.type === 'credit' ? '+' : '-'}₹{tx.amount?.toFixed(2)}
                        </td>
                        <td className="tx-balance">₹{tx.balanceBefore?.toFixed(2)}</td>
                        <td className="tx-balance">₹{tx.balanceAfter?.toFixed(2)}</td>
                        <td className="tx-desc">{tx.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Membership Card Modal */}
      {showCardModal && selectedCardMember && (
        <MembershipCard
          member={selectedCardMember}
          onClose={() => { setShowCardModal(false); setSelectedCardMember(null); }}
        />
      )}
    </div>
  );
};
export default Members;
