import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Feedback.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    feedbackFor: '',
    rating: '',
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
  }, [currentPage, filters]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      });

      const response = await axios.get(
        `${API_URL}/feedback/all?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setFeedbacks(response.data.data);
        setTotalPages(response.data.pages);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      alert('Error loading feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await axios.get(
        `${API_URL}/feedback/stats/overview?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      feedbackFor: '',
      rating: '',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  const handleViewDetails = async (feedbackId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/feedback/${feedbackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setSelectedFeedback(response.data.data);
        setAdminNotes(response.data.data.adminNotes || '');
        setNewStatus(response.data.data.status);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching feedback details:', error);
      alert('Error loading feedback details');
    }
  };

  const handleUpdateFeedback = async () => {
    if (!selectedFeedback) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/feedback/${selectedFeedback._id}`,
        {
          status: newStatus,
          adminNotes: adminNotes,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        alert('Feedback updated successfully');
        setShowDetailModal(false);
        fetchFeedbacks();
        fetchStats();
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Error updating feedback');
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/feedback/${feedbackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        alert('Feedback deleted successfully');
        fetchFeedbacks();
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Error deleting feedback');
    }
  };

  const renderStars = (rating) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'badge-warning';
      case 'reviewed':
        return 'badge-info';
      case 'resolved':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <div className="feedback-container">
      <div className="feedback-header">
        <h1>Staff Feedback Management</h1>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Total Feedback</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <h3>{stats.averageRating}</h3>
              <p>Average Rating</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>{stats.byStatus.pending || 0}</h3>
              <p>Pending</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.byStatus.resolved || 0}</h3>
              <p>Resolved</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="filter-input">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            name="feedbackFor"
            value={filters.feedbackFor}
            onChange={handleFilterChange}
            className="filter-input">
            <option value="">All Types</option>
            <option value="server">Server</option>
            <option value="waiter">Waiter</option>
            <option value="cook">Cook</option>
            <option value="general">General</option>
          </select>

          <select
            name="rating"
            value={filters.rating}
            onChange={handleFilterChange}
            className="filter-input">
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="filter-input"
            placeholder="Start Date"
          />

          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="filter-input"
            placeholder="End Date"
          />

          <button onClick={clearFilters} className="btn-clear">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="loading">Loading feedbacks...</div>
      ) : feedbacks.length === 0 ? (
        <div className="no-data">No feedbacks found</div>
      ) : (
        <>
          <div className="feedback-list">
            {feedbacks.map((feedback) => (
              <div key={feedback._id} className="feedback-card">
                <div className="feedback-card-header">
                  <div className="feedback-meta">
                    <span className={`badge ${getStatusBadgeClass(feedback.status)}`}>
                      {feedback.status}
                    </span>
                    <span className="badge badge-primary">
                      {feedback.feedbackFor}
                    </span>
                    <span className="rating">{renderStars(feedback.rating)}</span>
                  </div>
                  <span className="feedback-date">
                    {new Date(feedback.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="feedback-body">
                  <div className="member-info">
                    <strong>Member:</strong> {feedback.memberName} ({feedback.memberEmail})
                  </div>
                  {feedback.staffName && (
                    <div className="staff-info">
                      <strong>Staff:</strong> {feedback.staffName}
                    </div>
                  )}
                  <div className="feedback-text">{feedback.feedback}</div>
                  {feedback.orderNumber && (
                    <div className="order-info">
                      <strong>Order:</strong> {feedback.orderNumber}
                    </div>
                  )}
                  {feedback.tableNumber && (
                    <div className="table-info">
                      <strong>Table:</strong> {feedback.tableNumber}
                    </div>
                  )}
                </div>

                <div className="feedback-actions">
                  <button
                    onClick={() => handleViewDetails(feedback._id)}
                    className="btn-view">
                    View Details
                  </button>
                  <button
                    onClick={() => handleDeleteFeedback(feedback._id)}
                    className="btn-delete">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn-page">
              Previous
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn-page">
              Next
            </button>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Feedback Details</h2>
              <button onClick={() => setShowDetailModal(false)} className="btn-close">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Member Information</h3>
                <p>
                  <strong>Name:</strong> {selectedFeedback.memberName}
                </p>
                <p>
                  <strong>Email:</strong> {selectedFeedback.memberEmail}
                </p>
              </div>

              <div className="detail-section">
                <h3>Feedback Details</h3>
                <p>
                  <strong>Type:</strong> {selectedFeedback.feedbackFor}
                </p>
                <p>
                  <strong>Rating:</strong> {renderStars(selectedFeedback.rating)}
                </p>
                {selectedFeedback.staffName && (
                  <p>
                    <strong>Staff Name:</strong> {selectedFeedback.staffName}
                  </p>
                )}
                {selectedFeedback.orderNumber && (
                  <p>
                    <strong>Order Number:</strong> {selectedFeedback.orderNumber}
                  </p>
                )}
                {selectedFeedback.tableNumber && (
                  <p>
                    <strong>Table Number:</strong> {selectedFeedback.tableNumber}
                  </p>
                )}
                <p>
                  <strong>Submitted:</strong>{' '}
                  {new Date(selectedFeedback.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="detail-section">
                <h3>Feedback Message</h3>
                <p className="feedback-message">{selectedFeedback.feedback}</p>
              </div>

              <div className="detail-section">
                <h3>Update Status</h3>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="form-input">
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="detail-section">
                <h3>Admin Notes</h3>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="form-textarea"
                  rows="4"
                  placeholder="Add notes about this feedback..."
                />
              </div>

              {selectedFeedback.reviewedBy && (
                <div className="detail-section">
                  <p>
                    <strong>Last Reviewed:</strong>{' '}
                    {new Date(selectedFeedback.reviewedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowDetailModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleUpdateFeedback} className="btn-save">
                Update Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
