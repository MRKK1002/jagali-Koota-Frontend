import { useState, useEffect } from "react";
import { fetchDualBackend } from "../utils/apiHelpers";
import { CheckCircle, Clock, XCircle, Eye, User, Phone, MapPin, CreditCard } from "lucide-react";

// Add CSS for hover effects
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .order-card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.12) !important;
    border-color: #10b981 !important;
  }
  
  .refresh-btn-hover:hover {
    background-color: #059669 !important;
    transform: scale(1.05);
  }
  
  .filter-tab-hover:hover {
    background-color: #f3f4f6;
    border-color: #9ca3af;
  }
  
  .filter-tab-active-hover:hover {
    background-color: #059669 !important;
  }
  
  .action-btn-hover:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }
  
  .close-btn-hover:hover {
    background-color: #f3f4f6 !important;
    color: #111827 !important;
  }
`;
document.head.appendChild(styleSheet);

const UserOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [singleDate, setSingleDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [filter, singleDate, rangeStart, rangeEnd, pagination.page]);

  const fetchOrders = async () => {
    try {
      console.log('🔄 Fetching user orders from mobile app...');
      console.log('📅 Date filter:', { singleDate, rangeStart, rangeEnd });
      console.log('🏷️ Status filter:', filter);
      
      // Build query params - use fromDate/toDate for backend compatibility
      const params = new URLSearchParams();
      
      // Handle date filtering
      if (singleDate) {
        // Single date filter - use fromDate only (backend will use end of day)
        params.append('fromDate', singleDate);
        console.log('📅 Using single date filter:', singleDate);
      } else if (rangeStart && rangeEnd) {
        // Date range filter
        params.append('fromDate', rangeStart);
        params.append('toDate', rangeEnd);
        console.log('📅 Using date range filter:', rangeStart, 'to', rangeEnd);
      } else if (rangeStart) {
        // Only start date selected - show from that date onwards
        params.append('fromDate', rangeStart);
        console.log('📅 Using start date only:', rangeStart);
      }
      
      if (filter !== 'all') {
        params.append('status', filter);
        console.log('🏷️ Using status filter:', filter);
      }
      
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      
      const queryString = params.toString();
      console.log('🔗 API URL:', `/order?${queryString}`);
      
      const response = await fetchDualBackend(`/order?${queryString}`, {}, true).catch(err => {
        console.log('User order endpoint failed:', err.message);
        return { orders: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      });
      
      console.log('📦 Raw response:', response);
      
      // Handle both array response and object response with pagination
      let userOrders = [];
      let paginationData = { total: 0, page: 1, limit: 20, totalPages: 0 };
      
      if (Array.isArray(response)) {
        // Backend returned array directly (old format)
        userOrders = response;
        paginationData = { total: response.length, page: 1, limit: 20, totalPages: 1 };
      } else if (response && response.orders) {
        // Backend returned object with pagination
        userOrders = response.orders;
        paginationData = response.pagination || paginationData;
      } else if (response && response.data && Array.isArray(response.data)) {
        // Backend returned object with data array
        userOrders = response.data;
        paginationData = response.pagination || paginationData;
      }
      
      console.log(`📱 User orders found: ${userOrders.length} (Total: ${paginationData.total})`);
      
      // Transform orders to ensure consistent data structure
      userOrders = userOrders.map(order => ({
        ...order,
        customerName: order.name || order.customerName || 'Guest User',
        customerMobile: order.phone || order.customerMobile || order.customerPhone || 'N/A',
        customerPhone: order.phone || order.customerPhone || order.customerMobile || 'N/A',
        branchName: order.branchId?.name || order.branchName || 'Hotel Virat',
        grandTotal: order.total || order.grandTotal || order.totalAmount || 0,
        totalAmount: order.total || order.totalAmount || order.grandTotal || 0,
        status: order.status || 'pending',
        items: order.items || [],
        deliveryOption: order.deliveryOption || 'delivery',
        deliveryAddress: order.deliveryAddress || '',
        paymentMethod: order.paymentMethod || 'cash',
        categoryName: order.categoryName || 'Restaurant',
      }));
      
      // Sort by creation date (newest first)
      const sortedOrders = userOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.orderTime || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.orderTime || b.updatedAt || 0);
        return dateB - dateA;
      });
      
      setOrders(sortedOrders);
      setPagination(prev => ({
        ...prev,
        total: paginationData.total,
        totalPages: paginationData.totalPages
      }));
      console.log(`✅ User orders loaded: ${sortedOrders.length} orders (Page ${paginationData.page}/${paginationData.totalPages})`);
      
    } catch (error) {
      console.error("❌ Error fetching user orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log(`🔄 Updating order ${orderId} status to ${newStatus}`);
      
      // If cancelling, prompt for reason
      let cancellationReason = null;
      if (newStatus === "cancelled") {
        cancellationReason = prompt("Please enter cancellation reason:");
        if (!cancellationReason || cancellationReason.trim() === "") {
          alert("Cancellation reason is required");
          return;
        }
      }
      
      const body = { status: newStatus };
      if (cancellationReason) {
        body.cancellationReason = cancellationReason.trim();
      }
      
      await fetchDualBackend(`/order/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
      });
      
      console.log(`✅ Order ${orderId} status updated successfully`);
      await fetchOrders();
      setSelectedOrder(null);
      
    } catch (error) {
      console.error("❌ Error updating order:", error);
      alert(`Failed to update order status: ${error.message}`);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "confirmed": return "#3b82f6";
      case "preparing": return "#8b5cf6";
      case "out for delivery": return "#06b6d4";
      case "delivered": return "#10b981";
      case "cancelled": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending": return <Clock size={20} />;
      case "confirmed": return <CheckCircle size={20} />;
      case "preparing": return <Clock size={20} />;
      case "out for delivery": return <Clock size={20} />;
      case "delivered": return <CheckCircle size={20} />;
      case "cancelled": return <XCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Orders</h1>
          <p style={styles.subtitle}>
            Orders placed by users from the Hotel Virat mobile app
          </p>
        </div>
        <button onClick={fetchOrders} style={styles.refreshBtn} className="refresh-btn-hover">
          Refresh
        </button>
      </div>

      {/* Date Filter */}
      <div style={styles.dateFilterContainer}>
        <div style={styles.dateFilterRow}>
          <label style={styles.dateFilterLabel}>Single Date:</label>
          <input
            type="date"
            value={singleDate}
            onChange={(e) => {
              setSingleDate(e.target.value);
              setRangeStart("");
              setRangeEnd("");
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            style={styles.dateFilterInput}
          />
          <span style={styles.dateFilterSeparator}>or</span>
          <label style={styles.dateFilterLabel}>Range:</label>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => {
              setRangeStart(e.target.value);
              setSingleDate("");
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            style={styles.dateFilterInput}
            placeholder="From"
          />
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => {
              setRangeEnd(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            style={styles.dateFilterInput}
            placeholder="To"
            min={rangeStart}
          />
          {(singleDate || rangeStart || rangeEnd) && (
            <button
              onClick={() => {
                setSingleDate("");
                setRangeStart("");
                setRangeEnd("");
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              style={styles.clearDateBtn}
            >
              Clear
            </button>
          )}
        </div>
        <div style={styles.orderCount}>
          Showing {orders.length} of {pagination.total} orders
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div style={styles.filterTabs}>
        {["all", "pending", "confirmed", "preparing", "out for delivery", "delivered", "cancelled"].map(status => {
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                ...styles.filterTab,
                ...(filter === status ? styles.filterTabActive : {})
              }}
              className={filter === status ? "filter-tab-active-hover" : "filter-tab-hover"}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div style={styles.loading}>Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div style={styles.empty}>
          <User size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>No user orders found</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeader}>Order #</th>
                <th style={styles.tableHeader}>Date & Time</th>
                <th style={styles.tableHeader}>Customer</th>
                <th style={styles.tableHeader}>Phone</th>
                <th style={styles.tableHeader}>Items</th>
                <th style={styles.tableHeader}>Delivery</th>
                <th style={styles.tableHeader}>Payment</th>
                <th style={styles.tableHeader}>Total</th>
                <th style={styles.tableHeader}>Status</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order._id} style={styles.tableRow} className="order-card-hover">
                  <td style={styles.tableCell}>
                    <div style={styles.orderNumber}>
                      {order.orderId || order.orderNumber || order._id?.slice(-6)}
                    </div>
                    <div style={styles.categoryBadge}>{order.categoryName}</div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.dateTime}>
                      {new Date(order.createdAt || order.orderTime || order.updatedAt).toLocaleDateString()}
                    </div>
                    <div style={styles.time}>
                      {new Date(order.createdAt || order.orderTime || order.updatedAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.customerInfo}>
                      <User size={14} style={{ color: '#6b7280' }} />
                      <span>{order.customerName}</span>
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.phoneInfo}>
                      <Phone size={14} style={{ color: '#6b7280' }} />
                      <span>{order.customerPhone}</span>
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.itemsCount}>{order.items?.length || 0} items</div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.deliveryType}>
                      {order.deliveryOption === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.paymentMethod}>
                      <CreditCard size={14} style={{ color: '#6b7280' }} />
                      <span>{order.paymentMethod.toUpperCase()}</span>
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.totalAmount}>₹{(order.grandTotal || 0).toFixed(2)}</div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={{ ...styles.statusBadgeTable, backgroundColor: getStatusColor(order.status) }}>
                      {getStatusIcon(order.status)}
                      <span>{order.status}</span>
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        style={styles.viewBtnTable}
                        className="action-btn-hover"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {order.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order._id, "confirmed")}
                            style={styles.confirmBtnTable}
                            className="action-btn-hover"
                            title="Confirm Order"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order._id, "cancelled")}
                            style={styles.cancelBtnTable}
                            className="action-btn-hover"
                            title="Cancel Order"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {order.status === "confirmed" && (
                        <button
                          onClick={() => updateOrderStatus(order._id, "preparing")}
                          style={styles.preparingBtnTable}
                          className="action-btn-hover"
                          title="Start Preparing"
                        >
                          🍳
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button
                          onClick={() => updateOrderStatus(order._id, "out for delivery")}
                          style={styles.deliveryBtnTable}
                          className="action-btn-hover"
                          title="Out for Delivery"
                        >
                          🚚
                        </button>
                      )}
                      {order.status === "out for delivery" && (
                        <button
                          onClick={() => updateOrderStatus(order._id, "delivered")}
                          style={styles.completeBtnTable}
                          className="action-btn-hover"
                          title="Mark Delivered"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={styles.paginationContainer}>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            style={{
              ...styles.paginationBtn,
              ...(pagination.page === 1 ? styles.paginationBtnDisabled : {})
            }}
          >
            Previous
          </button>
          <span style={styles.paginationInfo}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            style={{
              ...styles.paginationBtn,
              ...(pagination.page === pagination.totalPages ? styles.paginationBtnDisabled : {})
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div style={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} style={styles.closeBtn} className="close-btn-hover">×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailRow}>
                <span>Order ID:</span>
                <span>{selectedOrder.orderId || selectedOrder.orderNumber || selectedOrder._id}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Customer:</span>
                <span>{selectedOrder.customerName}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Phone:</span>
                <span>{selectedOrder.customerPhone}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Status:</span>
                <span style={{ color: getStatusColor(selectedOrder.status), fontWeight: 'bold' }}>
                  {selectedOrder.status}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span>Category:</span>
                <span>{selectedOrder.categoryName}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Branch:</span>
                <span>{selectedOrder.branchName}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Delivery Type:</span>
                <span>{selectedOrder.deliveryOption === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
              </div>
              {selectedOrder.deliveryAddress && (
                <div style={styles.detailRow}>
                  <span>Delivery Address:</span>
                  <span>{selectedOrder.deliveryAddress}</span>
                </div>
              )}
              <div style={styles.detailRow}>
                <span>Payment Method:</span>
                <span>{selectedOrder.paymentMethod.toUpperCase()}</span>
              </div>
              {selectedOrder.couponCode && (
                <div style={styles.detailRow}>
                  <span>Coupon Applied:</span>
                  <span>{selectedOrder.couponCode}</span>
                </div>
              )}
              {selectedOrder.specialInstructions && (
                <div style={styles.detailRow}>
                  <span>Special Instructions:</span>
                  <span>{selectedOrder.specialInstructions}</span>
                </div>
              )}
              
              <h3 style={styles.itemsTitle}>Items:</h3>
              {selectedOrder.items?.map((item, index) => (
                <div key={index} style={styles.itemRow}>
                  <div>
                    <div style={styles.itemName}>{item.name}</div>
                    <div style={styles.itemQty}>
                      {item.quantity || item.count || 1} × ₹{item.price}
                    </div>
                  </div>
                  <div style={styles.itemPrice}>
                    ₹{((item.price || 0) * (item.quantity || item.count || 1)).toFixed(2)}
                  </div>
                </div>
              ))}
              
              <div style={styles.totalRow}>
                <span>Subtotal:</span>
                <span>₹{(selectedOrder.subtotal || selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div style={styles.detailRow}>
                  <span>Discount:</span>
                  <span style={{ color: '#10b981' }}>-₹{selectedOrder.discount.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.tax > 0 && (
                <div style={styles.detailRow}>
                  <span>Tax (5%):</span>
                  <span>₹{selectedOrder.tax.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.serviceCharge > 0 && (
                <div style={styles.detailRow}>
                  <span>Service Charge (10%):</span>
                  <span>₹{selectedOrder.serviceCharge.toFixed(2)}</span>
                </div>
              )}
              <div style={styles.totalRow}>
                <span>Grand Total:</span>
                <span>₹{(selectedOrder.grandTotal || selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: 0,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#6b7280',
    fontSize: '15px',
  },
  refreshBtn: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
  },
  filterTabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  filterTab: {
    padding: '10px 18px',
    backgroundColor: '#ffffff',
    border: '2px solid #d1d5db',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
    color: '#4b5563',
  },
  filterTabActive: {
    backgroundColor: '#10b981',
    color: 'white',
    borderColor: '#10b981',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
  },
  dateFilterContainer: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  dateFilterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  dateFilterLabel: {
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px',
  },
  dateFilterInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#374151',
    backgroundColor: '#fff',
  },
  dateFilterSeparator: {
    color: '#6b7280',
    fontWeight: '600',
    padding: '0 8px',
  },
  clearDateBtn: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  },
  orderCount: {
    marginTop: '12px',
    fontSize: '14px',
    color: '#6b7280',
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    marginTop: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  paginationBtn: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  paginationBtnDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
  },
  paginationInfo: {
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280',
    fontSize: '16px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 40px',
    color: '#6b7280',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    fontSize: '16px',
  },
  ordersList: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeaderRow: {
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
  },
  tableHeader: {
    padding: '16px 12px',
    textAlign: 'left',
    fontWeight: '700',
    color: '#374151',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  tableCell: {
    padding: '16px 12px',
    verticalAlign: 'middle',
  },
  orderNumber: {
    fontWeight: '700',
    color: '#111827',
    fontSize: '14px',
    marginBottom: '4px',
  },
  categoryBadge: {
    display: 'inline-block',
    fontSize: '11px',
    color: '#10b981',
    backgroundColor: '#f0fdf4',
    padding: '2px 8px',
    borderRadius: '12px',
    fontWeight: '600',
  },
  dateTime: {
    color: '#374151',
    fontWeight: '500',
    marginBottom: '2px',
  },
  time: {
    color: '#9ca3af',
    fontSize: '12px',
  },
  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#374151',
  },
  phoneInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#374151',
  },
  itemsCount: {
    color: '#6b7280',
    fontWeight: '500',
  },
  deliveryType: {
    fontSize: '13px',
    color: '#374151',
  },
  paymentMethod: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#374151',
    fontSize: '13px',
  },
  totalAmount: {
    fontWeight: '700',
    color: '#10b981',
    fontSize: '16px',
  },
  statusBadgeTable: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actionButtons: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  viewBtnTable: {
    padding: '8px 10px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  confirmBtnTable: {
    padding: '8px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  cancelBtnTable: {
    padding: '8px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  preparingBtnTable: {
    padding: '8px 12px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  deliveryBtnTable: {
    padding: '8px 12px',
    backgroundColor: '#06b6d4',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  completeBtnTable: {
    padding: '8px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  orderCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    transition: 'all 0.3s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    cursor: 'pointer',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f3f4f6',
  },
  orderTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
    color: '#111827',
  },
  orderTime: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '4px 0',
  },
  categoryLabel: {
    fontSize: '13px',
    color: '#10b981',
    marginTop: '6px',
    fontWeight: '600',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '24px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  orderDetails: {
    marginBottom: '20px',
    fontSize: '14px',
    lineHeight: '1.8',
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    fontSize: '14px',
  },
  orderTotal: {
    fontSize: '20px',
    color: '#10b981',
    marginTop: '16px',
    fontWeight: 'bold',
    padding: '12px',
    backgroundColor: '#f0fdf4',
    borderRadius: '10px',
    textAlign: 'center',
  },
  orderActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '2px solid #f3f4f6',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
    justifyContent: 'center',
  },
  confirmBtn: {
    padding: '10px 18px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
  },
  preparingBtn: {
    padding: '10px 18px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
  },
  deliveryBtn: {
    padding: '10px 18px',
    backgroundColor: '#06b6d4',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
  },
  completeBtn: {
    padding: '10px 18px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
  },
  cancelBtn: {
    padding: '10px 18px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    flex: 1,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '2px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '36px',
    cursor: 'pointer',
    color: '#6b7280',
    lineHeight: 1,
    transition: 'all 0.2s',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '15px',
  },
  itemsTitle: {
    marginTop: '24px',
    marginBottom: '16px',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111827',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    marginBottom: '12px',
    border: '1px solid #e5e7eb',
  },
  itemName: {
    fontWeight: '600',
    marginBottom: '6px',
    fontSize: '15px',
    color: '#111827',
  },
  itemQty: {
    fontSize: '14px',
    color: '#6b7280',
  },
  itemPrice: {
    fontWeight: 'bold',
    color: '#10b981',
    fontSize: '16px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#f0fdf4',
    borderRadius: '12px',
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#10b981',
    border: '2px solid #10b981',
  },
};

export default UserOrders;
