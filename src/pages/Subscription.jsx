import React, { useState, useEffect } from 'react';
import './Subscription.css';

const Subscription = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    subscriptionType: '',
    search: ''
  });
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'pause', 'resume', 'cancel', 'view'

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/branch');
        const data = await response.json();
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranch(data[0]._id);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Fetch subscriptions
  useEffect(() => {
    if (selectedBranch) {
      fetchSubscriptions();
    }
  }, [selectedBranch, filters]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      let url = `https://billing.jagalikoota.com/api/v1/hotel/subscription?branchId=${selectedBranch}`;
      
      if (filters.status) url += `&status=${filters.status}`;
      if (filters.subscriptionType) url += `&subscriptionType=${filters.subscriptionType}`;

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        let filteredSubscriptions = data.data;
        
        if (filters.search) {
          filteredSubscriptions = filteredSubscriptions.filter(sub => 
            sub.userId?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
            sub.productId?.name?.toLowerCase().includes(filters.search.toLowerCase())
          );
        }
        
        setSubscriptions(filteredSubscriptions);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setError('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (subscriptionId, action, data = {}) => {
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/subscription/${subscriptionId}/${action}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        fetchSubscriptions(); // Refresh the list
        setShowModal(false);
        setSelectedSubscription(null);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(`Error ${action}ing subscription:`, error);
      alert(`Failed to ${action} subscription`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'paused': return '#FF9800';
      case 'cancelled': return '#F44336';
      case 'expired': return '#9E9E9E';
      default: return '#666';
    }
  };

  const getSubscriptionTypeColor = (type) => {
    switch (type) {
      case 'weekly': return '#2196F3';
      case 'monthly': return '#9C27B0';
      case 'yearly': return '#FF5722';
      default: return '#666';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openModal = (subscription, type) => {
    setSelectedSubscription(subscription);
    setModalType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSubscription(null);
    setModalType('');
  };

  if (loading) {
    return (
      <div className="subscription-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-container">
      <div className="subscription-header">
        <h1>Subscription Management</h1>
    
      </div>

      {/* Branch Selection */}
      <div className="branch-selector">
        <label htmlFor="branch-select">Select Branch:</label>
        <select
          id="branch-select"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="branch-select"
        >
          {branches.map(branch => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by customer or product..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="search-input"
          />
        </div>
        
        <div className="filter-group">
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={filters.subscriptionType}
            onChange={(e) => setFilters({...filters, subscriptionType: e.target.value})}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="subscriptions-table-container">
        <table className="subscriptions-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Status</th>
              <th>Next Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(subscription => (
              <tr key={subscription._id}>
                <td>
                  <div className="customer-info">
                    <strong>{subscription.userId?.name}</strong>
                    <span>{subscription.userId?.mobile}</span>
                  </div>
                </td>
                <td>
                  <div className="product-info">
                    <img 
                      src={subscription.productId?.image || '/placeholder-product.jpg'} 
                      alt={subscription.productId?.name}
                      className="product-image"
                    />
                    <span>{subscription.productId?.name}</span>
                  </div>
                </td>
                <td>
                  <span 
                    className="subscription-type"
                    style={{ backgroundColor: getSubscriptionTypeColor(subscription.subscriptionType) }}
                  >
                    {subscription.subscriptionType}
                  </span>
                </td>
                <td>{subscription.quantity}</td>
                <td>₹{subscription.totalPrice}</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(subscription.status) }}
                  >
                    {subscription.status}
                  </span>
                </td>
                <td>{formatDate(subscription.nextDeliveryDate)}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn-view"
                      onClick={() => openModal(subscription, 'view')}
                    >
                      View
                    </button>
                    
                    {subscription.status === 'active' && (
                      <button 
                        className="btn-pause"
                        onClick={() => openModal(subscription, 'pause')}
                      >
                        Pause
                      </button>
                    )}
                    
                    {subscription.status === 'paused' && (
                      <button 
                        className="btn-resume"
                        onClick={() => handleAction(subscription._id, 'resume')}
                      >
                        Resume
                      </button>
                    )}
                    
                    {subscription.status !== 'cancelled' && (
                      <button 
                        className="btn-cancel"
                        onClick={() => openModal(subscription, 'cancel')}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {subscriptions.length === 0 && (
          <div className="no-subscriptions">
            <p>No subscriptions found for the selected criteria.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedSubscription && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalType === 'view' && 'Subscription Details'}
                {modalType === 'pause' && 'Pause Subscription'}
                {modalType === 'cancel' && 'Cancel Subscription'}
              </h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              {modalType === 'view' && (
                <div className="subscription-details">
                  <div className="detail-row">
                    <strong>Customer:</strong> {selectedSubscription.userId?.name}
                  </div>
                  <div className="detail-row">
                    <strong>Product:</strong> {selectedSubscription.productId?.name}
                  </div>
                  <div className="detail-row">
                    <strong>Type:</strong> {selectedSubscription.subscriptionType}
                  </div>
                  <div className="detail-row">
                    <strong>Quantity:</strong> {selectedSubscription.quantity}
                  </div>
                  <div className="detail-row">
                    <strong>Price:</strong> ₹{selectedSubscription.totalPrice}
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong> {selectedSubscription.status}
                  </div>
                  <div className="detail-row">
                    <strong>Start Date:</strong> {formatDate(selectedSubscription.startDate)}
                  </div>
                  <div className="detail-row">
                    <strong>End Date:</strong> {formatDate(selectedSubscription.endDate)}
                  </div>
                  <div className="detail-row">
                    <strong>Next Delivery:</strong> {formatDate(selectedSubscription.nextDeliveryDate)}
                  </div>
                  <div className="detail-row">
                    <strong>Delivery Address:</strong> {selectedSubscription.deliveryAddress}
                  </div>
                  <div className="detail-row">
                    <strong>Delivery Days:</strong> {selectedSubscription.deliveryDays?.join(', ')}
                  </div>
                  <div className="detail-row">
                    <strong>Delivery Time:</strong> {selectedSubscription.deliveryTime}
                  </div>
                </div>
              )}

              {modalType === 'pause' && (
                <div className="pause-form">
                  <div className="form-group">
                    <label htmlFor="pause-reason">Reason for pausing:</label>
                    <textarea
                      id="pause-reason"
                      placeholder="Enter reason for pausing subscription..."
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pause-end-date">Pause until (optional):</label>
                    <input
                      type="date"
                      id="pause-end-date"
                    />
                  </div>
                  <div className="modal-actions">
                    <button 
                      className="btn-confirm"
                      onClick={() => {
                        const reason = document.getElementById('pause-reason').value;
                        const endDate = document.getElementById('pause-end-date').value;
                        handleAction(selectedSubscription._id, 'pause', { pauseReason: reason, pauseEndDate: endDate });
                      }}
                    >
                      Pause Subscription
                    </button>
                    <button className="btn-cancel" onClick={closeModal}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'cancel' && (
                <div className="cancel-form">
                  <div className="form-group">
                    <label htmlFor="cancel-reason">Reason for cancellation:</label>
                    <textarea
                      id="cancel-reason"
                      placeholder="Enter reason for cancelling subscription..."
                      rows="3"
                    />
                  </div>
                  <div className="modal-actions">
                    <button 
                      className="btn-confirm"
                      onClick={() => {
                        const reason = document.getElementById('cancel-reason').value;
                        handleAction(selectedSubscription._id, 'cancel', { cancellationReason: reason });
                      }}
                    >
                      Cancel Subscription
                    </button>
                    <button className="btn-cancel" onClick={closeModal}>
                      Keep Subscription
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;






