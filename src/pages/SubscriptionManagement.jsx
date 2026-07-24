import React, { useState, useEffect } from 'react';
import './SubscriptionManagement.css';

const SubscriptionManagement = () => {
  const [subscriptionOrders, setSubscriptionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    planType: '',
    search: ''
  });
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'pause', 'resume', 'cancel', 'view', 'delivery'
  const [deliveryForm, setDeliveryForm] = useState({
    scheduledDate: '',
    status: 'scheduled',
    deliveryPerson: { name: '', phone: '', id: '' },
    deliveryNotes: '',
    rating: null,
    feedback: ''
  });

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

  // Fetch subscription orders
  useEffect(() => {
    if (selectedBranch) {
      fetchSubscriptionOrders();
    }
  }, [selectedBranch, filters]);

  const fetchSubscriptionOrders = async () => {
    setLoading(true);
    try {
      let url = `https://billing.jagalikoota.com/api/v1/hotel/subscription-order?branchId=${selectedBranch}`;
      
      if (filters.status) url += `&status=${filters.status}`;
      if (filters.planType) url += `&planType=${filters.planType}`;

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
        
        setSubscriptionOrders(filteredSubscriptions);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error fetching subscription orders:', error);
      setError('Failed to fetch subscription orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (subscriptionId, action, data = {}) => {
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/subscription-order/${subscriptionId}/${action}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (result.success) {
        fetchSubscriptionOrders(); // Refresh the list
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
      case 'completed': return '#9E9E9E';
      default: return '#666';
    }
  };

  const getPlanTypeColor = (type) => {
    switch (type) {
      case 'daily': return '#2196F3';
      case 'weekly': return '#9C27B0';
      case 'monthly': return '#FF5722';
      case 'yearly': return '#4CAF50';
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
    setDeliveryForm({
      scheduledDate: '',
      status: 'scheduled',
      deliveryPerson: { name: '', phone: '', id: '' },
      deliveryNotes: '',
      rating: null,
      feedback: ''
    });
  };

  const handleDeliveryUpdate = async () => {
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/subscription-order/${selectedSubscription._id}/delivery`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deliveryForm)
      });

      const data = await response.json();

      if (data.success) {
        alert('Delivery status updated successfully!');
        fetchSubscriptionOrders(); // Refresh the list
        closeModal();
      } else {
        alert('Error updating delivery status: ' + data.message);
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('Error updating delivery status');
    }
  };

  if (loading) {
    return (
      <div className="subscription-management-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading subscription orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-management-container">
      <div className="subscription-management-header">
        <h1>Subscription Order Management</h1>

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
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={filters.planType}
            onChange={(e) => setFilters({...filters, planType: e.target.value})}
            className="filter-select"
          >
            <option value="">All Plans</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Subscription Orders Table */}
      <div className="subscription-orders-table-container">
        <table className="subscription-orders-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Plan</th>
              <th>Price</th>
              <th>Status</th>
              <th>Next Delivery</th>
              <th>Cycles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptionOrders.map(subscription => (
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
                    className="plan-type"
                    style={{ backgroundColor: getPlanTypeColor(subscription.planType) }}
                  >
                    {subscription.planType}
                  </span>
                </td>
                <td>₹{subscription.price}</td>
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
                  {subscription.completedCycles}/{subscription.totalCycles || '∞'}
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn-view"
                      onClick={() => openModal(subscription, 'view')}
                    >
                      View
                    </button>
                    
                    {/* Admin can only view subscriptions - users manage their own subscriptions */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {subscriptionOrders.length === 0 && (
          <div className="no-subscriptions">
            <p>No subscription orders found for the selected criteria.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedSubscription && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Subscription Order Details</h2>
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
                    <strong>Plan Type:</strong> {selectedSubscription.planType}
                  </div>
                  <div className="detail-row">
                    <strong>Price:</strong> ₹{selectedSubscription.price}
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong> {selectedSubscription.status}
                  </div>
                  <div className="detail-row">
                    <strong>Start Date:</strong> {formatDate(selectedSubscription.startDate)}
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
                  <div className="detail-row">
                    <strong>Payment Method:</strong> {selectedSubscription.paymentMethod}
                  </div>
                  
                  {/* Delivery Tracking Section */}
                  {selectedSubscription.deliveryTracking && selectedSubscription.deliveryTracking.length > 0 && (
                    <div className="delivery-tracking-section">
                      <h4>Recent Deliveries</h4>
                      {selectedSubscription.deliveryTracking.slice(0, 3).map((delivery, index) => (
                        <div key={index} className="delivery-item">
                          <div className="delivery-status">
                            <span className={`status-badge ${delivery.status}`}>
                              {delivery.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="delivery-date">
                              {formatDate(delivery.scheduledDate)}
                            </span>
                          </div>
                          {delivery.deliveryPerson && (
                            <div className="delivery-person">
                              By: {delivery.deliveryPerson.name}
                            </div>
                          )}
                          {delivery.deliveryNotes && (
                            <div className="delivery-notes">
                              {delivery.deliveryNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="modal-actions">
                    <button 
                      className="btn-update-delivery"
                      onClick={() => {
                        setModalType('delivery');
                        setDeliveryForm({
                          scheduledDate: new Date().toISOString().split('T')[0],
                          status: 'scheduled',
                          deliveryPerson: { name: '', phone: '', id: '' },
                          deliveryNotes: '',
                          rating: null,
                          feedback: ''
                        });
                      }}
                    >
                      Update Delivery Status
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'delivery' && (
                <div className="delivery-form">
                  <h3>Update Delivery Status</h3>
                  
                  <div className="form-group">
                    <label htmlFor="scheduledDate">Scheduled Date:</label>
                    <input
                      type="date"
                      id="scheduledDate"
                      value={deliveryForm.scheduledDate}
                      onChange={(e) => setDeliveryForm({...deliveryForm, scheduledDate: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="status">Delivery Status:</label>
                    <select
                      id="status"
                      value={deliveryForm.status}
                      onChange={(e) => setDeliveryForm({...deliveryForm, status: e.target.value})}
                      required
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed">Failed</option>
                      <option value="rescheduled">Rescheduled</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="deliveryPersonName">Delivery Person Name:</label>
                    <input
                      type="text"
                      id="deliveryPersonName"
                      value={deliveryForm.deliveryPerson.name}
                      onChange={(e) => setDeliveryForm({
                        ...deliveryForm, 
                        deliveryPerson: {...deliveryForm.deliveryPerson, name: e.target.value}
                      })}
                      placeholder="Enter delivery person name"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="deliveryPersonPhone">Delivery Person Phone:</label>
                    <input
                      type="tel"
                      id="deliveryPersonPhone"
                      value={deliveryForm.deliveryPerson.phone}
                      onChange={(e) => setDeliveryForm({
                        ...deliveryForm, 
                        deliveryPerson: {...deliveryForm.deliveryPerson, phone: e.target.value}
                      })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="deliveryNotes">Delivery Notes:</label>
                    <textarea
                      id="deliveryNotes"
                      value={deliveryForm.deliveryNotes}
                      onChange={(e) => setDeliveryForm({...deliveryForm, deliveryNotes: e.target.value})}
                      placeholder="Enter delivery notes"
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="rating">Customer Rating (1-5):</label>
                    <select
                      id="rating"
                      value={deliveryForm.rating || ''}
                      onChange={(e) => setDeliveryForm({...deliveryForm, rating: e.target.value ? parseInt(e.target.value) : null})}
                    >
                      <option value="">No rating</option>
                      <option value="1">1 Star</option>
                      <option value="2">2 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="5">5 Stars</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="feedback">Customer Feedback:</label>
                    <textarea
                      id="feedback"
                      value={deliveryForm.feedback}
                      onChange={(e) => setDeliveryForm({...deliveryForm, feedback: e.target.value})}
                      placeholder="Enter customer feedback"
                      rows="3"
                    />
                  </div>
                  
                  <div className="modal-actions">
                    <button 
                      className="btn-confirm"
                      onClick={handleDeliveryUpdate}
                    >
                      Update Delivery
                    </button>
                    <button 
                      className="btn-cancel" 
                      onClick={() => setModalType('view')}
                    >
                      Cancel
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

export default SubscriptionManagement;
