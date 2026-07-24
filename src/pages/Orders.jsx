import { useState, useEffect } from "react";
import { fetchDualBackend } from "../utils/apiHelpers";
import { CheckCircle, Clock, XCircle, Eye } from "lucide-react";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, completed, cancelled
  const [orderTypeTab, setOrderTypeTab] = useState("all"); // all, restaurant, temple, self-service
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userCategory, setUserCategory] = useState(null);

  useEffect(() => {
    // Get user's category access from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const categoryAccess = localStorage.getItem("categoryAccess");
    
    console.log("🚀 Orders Component Loaded - Build Version: 2026-01-05-v2");
    console.log("User category access:", categoryAccess);
    setUserCategory(categoryAccess);
    
    fetchOrders();
    // Refresh orders every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      console.log('🔄 Fetching orders from mobile app only...');
      
      // Helper function to determine order type based on order characteristics
      const getOrderTypeForTransform = (order) => {
        // First, check if order has a direct categoryName field (most reliable)
        const categoryName = order.categoryName?.toLowerCase().trim() || '';
        
        if (categoryName) {
          if (categoryName.includes('temple') || categoryName.includes('meal')) {
            return 'temple';
          }
          if (categoryName.includes('self') || categoryName.includes('service')) {
            return 'self-service';
          }
          if (categoryName.includes('restaurant')) {
            return 'restaurant';
          }
        }
        
        // Second, check order ID patterns (for orders with date-based IDs)
        const orderId = (order.orderId || order.orderNumber || order._id || '').toLowerCase();
        if (orderId.includes('-tm-') || orderId.includes('temple')) {
          return 'temple';
        }
        if (orderId.includes('-ss-') || orderId.includes('counter')) {
          return 'self-service';
        }
        if (orderId.includes('-res-')) {
          return 'restaurant';
        }
        
        // Third, check items' categoryId to determine order type
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
          // Map known categoryIds to order types - these IDs should match your production database
          const categoryIdToType = {
            '692fe2788b36a58df247e06f': 'restaurant',    // Restaurant category ID
            '692fe2978b36a58df247e072': 'self-service',  // Self Service category ID  
            '692fe2ae8b36a58df247e075': 'temple'         // Temple Meals category ID
          };
          
          // Get the most common category type from items
          const categoryTypes = order.items
            .map(item => {
              // Handle both string categoryId and object categoryId
              const categoryId = typeof item.categoryId === 'string' 
                ? item.categoryId 
                : item.categoryId?._id || item.categoryId;
              return categoryIdToType[categoryId];
            })
            .filter(Boolean);
          
          if (categoryTypes.length > 0) {
            // Return the most common category type
            const typeCount = {};
            categoryTypes.forEach(type => {
              typeCount[type] = (typeCount[type] || 0) + 1;
            });
            const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
              typeCount[a] > typeCount[b] ? a : b
            );
            return mostCommonType;
          }
        }
        
        // Fourth, check table number patterns
        const tableNumber = order.tableNumber?.toString().toLowerCase() || '';
        if (tableNumber.includes('counter') || tableNumber.includes('self')) {
          return 'self-service';
        }
        
        // Default to restaurant orders
        console.log('⚠️ No clear category found, defaulting to restaurant for order:', {
          orderId: order.orderId || order.orderNumber || order._id,
          categoryName: order.categoryName,
          hasItems: !!order.items?.length,
          tableNumber: order.tableNumber
        });
        return 'restaurant';
      };
      
      // ONLY fetch mobile app orders from /order endpoint (skip staff orders)
      const regularOrderResponse = await fetchDualBackend("/order", {}, true).catch(err => {
        console.log('Mobile app order endpoint failed:', err.message);
        return [];
      });
      
      // Handle mobile app orders only (no staff orders)
      let mobileOrders = [];
      const regularData = regularOrderResponse;
      mobileOrders = Array.isArray(regularData) ? regularData : (regularData.orders || []);
      console.log(`📱 Mobile app orders found: ${mobileOrders.length}`);
      
      // Handle mobile app orders (transform them)
      // Transform mobile orders to include proper category information
      mobileOrders = mobileOrders.map(order => {
          // Determine category name from order characteristics since backend doesn't always save categoryName
          let determinedCategoryName = 'Restaurant'; // default
          
          // First try to get category from order ID pattern (most reliable)
          const orderId = (order.orderId || order.orderNumber || order._id || '').toLowerCase();
          if (orderId.includes('-tm-') || orderId.includes('temple')) {
            determinedCategoryName = 'Temple Meals';
          } else if (orderId.includes('-ss-') || orderId.includes('counter')) {
            determinedCategoryName = 'Self Service';
          } else if (orderId.includes('-res-')) {
            determinedCategoryName = 'Restaurant';
          }
          
          // If no clear pattern, try to determine from items' categoryId
          if (order.items && order.items.length > 0) {
            const itemCategoryIds = order.items.map(item => item.categoryId).filter(Boolean);
            if (itemCategoryIds.length > 0) {
              // Use the most common categoryId in the order
              const categoryIdCount = {};
              itemCategoryIds.forEach(catId => {
                categoryIdCount[catId] = (categoryIdCount[catId] || 0) + 1;
              });
              const mostCommonCategoryId = Object.keys(categoryIdCount).reduce((a, b) => 
                categoryIdCount[a] > categoryIdCount[b] ? a : b
              );
              
              // Map known categoryIds to category names
              const categoryIdToName = {
                '692fe2788b36a58df247e06f': 'Restaurant',
                '692fe2978b36a58df247e072': 'Self Service',  
                '692fe2ae8b36a58df247e075': 'Temple Meals'
              };
              
              if (categoryIdToName[mostCommonCategoryId]) {
                determinedCategoryName = categoryIdToName[mostCommonCategoryId];
              }
            }
          }
          
          return {
            ...order,
            customerName: order.name || order.customerName || 'Mobile User',
            customerMobile: order.phone || order.customerMobile || order.customerPhone,
            customerPhone: order.phone || order.customerPhone || order.customerMobile,
            tableNumber: order.tableNumber || 'Mobile Order',
            branchName: order.branchId?.name || order.branchName || 'Hotel Virat',
            grandTotal: order.total || order.grandTotal || order.totalAmount,
            totalAmount: order.total || order.totalAmount || order.grandTotal,
            status: order.status || 'pending',
            items: order.items || [],
            subtotal: order.subtotal || order.total || 0,
            tax: order.tax || 0,
            serviceCharge: order.serviceCharge || 0,
            deliveryOption: order.deliveryOption || 'delivery',
            deliveryAddress: order.deliveryAddress || '',
            paymentMethod: order.paymentMethod || 'cash',
            specialInstructions: order.specialInstructions || '',
            couponCode: order.couponCode || '',
            discount: order.discount || 0,
            // Set the determined category name
            categoryName: order.categoryName || determinedCategoryName,
            // Determine order type based on category
            orderType: getOrderTypeForTransform({...order, categoryName: order.categoryName || determinedCategoryName})
          };
          
          console.log('📱 Mobile Order Type Assignment:', {
            orderId: transformedOrder.orderId || transformedOrder.orderNumber || transformedOrder._id,
            assignedType: transformedOrder.orderType,
            determinedCategoryName: determinedCategoryName,
            originalCategoryName: order.categoryName,
            items: order.items?.map(item => ({
              name: item.name,
              categoryId: item.categoryId
            })) || []
          });
          
          return transformedOrder;
        });
      
      console.log('📱 Mobile Orders by Type:', {
        restaurant: mobileOrders.filter(o => o.orderType === 'restaurant').length,
        selfService: mobileOrders.filter(o => o.orderType === 'self-service').length,
        temple: mobileOrders.filter(o => o.orderType === 'temple').length
      });
      
      // Use only mobile orders (no staff orders)
      const allOrders = mobileOrders;
      console.log(`📋 Total mobile app orders: ${allOrders.length}`);
      
      // Debug: Show final order type distribution
      console.log('📊 Final Order Type Distribution:', {
        restaurant: allOrders.filter(o => o.orderType === 'restaurant').length,
        selfService: allOrders.filter(o => o.orderType === 'self-service').length,
        temple: allOrders.filter(o => o.orderType === 'temple').length,
        undefined: allOrders.filter(o => !o.orderType).length
      });
      
      // Filter orders by user's category access (if any)
      const categoryAccess = localStorage.getItem("categoryAccess");
      let filteredOrders = allOrders;
      
      if (categoryAccess && categoryAccess !== "All") {
        filteredOrders = allOrders.filter(order => {
          // Match order's categoryName with user's category access
          return order.categoryName === categoryAccess;
        });
        console.log(`🔍 Filtered ${allOrders.length} orders to ${filteredOrders.length} for category: ${categoryAccess}`);
      }
      
      // Sort by creation date (newest first) - this is crucial for recent orders to appear at top
      const sortedOrders = Array.isArray(filteredOrders) ? filteredOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.orderTime || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.orderTime || b.updatedAt || 0);
        const result = dateB - dateA; // Descending order (newest first)
        
        // Debug sorting for first few orders
        if (filteredOrders.indexOf(a) < 3 || filteredOrders.indexOf(b) < 3) {
          console.log('📅 Sorting Debug:', {
            orderA: a.orderId || a.orderNumber || a._id,
            dateA: dateA.toISOString(),
            orderB: b.orderId || b.orderNumber || b._id,
            dateB: dateB.toISOString(),
            result: result > 0 ? 'B is newer' : 'A is newer'
          });
        }
        
        return result;
      }) : [];
      
      console.log('📊 Final sorted orders (first 5):', sortedOrders.slice(0, 5).map(order => ({
        orderId: order.orderId || order.orderNumber || order._id,
        orderType: order.orderType,
        createdAt: order.createdAt,
        status: order.status
      })));
      
      setOrders(sortedOrders);
      console.log(`✅ Orders loaded successfully: ${sortedOrders.length} orders`);
      
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
      setOrders([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log(`🔄 Updating order ${orderId} status to ${newStatus}`);
      
      // Try to update in both endpoints since we don't know which type of order it is
      // Use the correct endpoint paths with /status suffix and proper headers
      const [staffOrderResult, regularOrderResult] = await Promise.allSettled([
        fetchDualBackend(`/staff-order/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus })
        }).catch(err => {
          console.log('Staff order update failed:', err.message);
          return null;
        }),
        fetchDualBackend(`/order/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus })
        }).catch(err => {
          console.log('Regular order update failed:', err.message);
          return null;
        })
      ]);
      
      // Check if at least one update succeeded
      const staffSuccess = staffOrderResult.status === 'fulfilled' && staffOrderResult.value;
      const regularSuccess = regularOrderResult.status === 'fulfilled' && regularOrderResult.value;
      
      if (staffSuccess || regularSuccess) {
        console.log(`✅ Order ${orderId} status updated successfully`);
        await fetchOrders(); // Refresh the orders list
        setSelectedOrder(null);
      } else {
        throw new Error('Failed to update order in both endpoints');
      }
      
    } catch (error) {
      console.error("❌ Error updating order:", error);
      alert("Failed to update order status. Please try again.");
    }
  };

  // Helper function to determine order type based on order characteristics
  const getOrderType = (order) => {
    // First, check if order has a direct categoryName field (most reliable)
    const categoryName = order.categoryName?.toLowerCase().trim() || '';
    
    if (categoryName) {
      if (categoryName.includes('temple') || categoryName.includes('meal')) {
        return 'temple';
      }
      if (categoryName.includes('self') || categoryName.includes('service')) {
        return 'self-service';
      }
      if (categoryName.includes('restaurant')) {
        return 'restaurant';
      }
    }
    
    // Second, check order ID patterns (for orders with date-based IDs)
    const orderId = (order.orderId || order.orderNumber || order._id || '').toLowerCase();
    if (orderId.includes('-tm-') || orderId.includes('temple')) {
      return 'temple';
    }
    if (orderId.includes('-ss-') || orderId.includes('counter')) {
      return 'self-service';
    }
    if (orderId.includes('-res-')) {
      return 'restaurant';
    }
    
    // Third, check items' categoryId to determine order type
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      // Map known categoryIds to order types
      const categoryIdToType = {
        '692fe2788b36a58df247e06f': 'restaurant',    // Restaurant category ID
        '692fe2978b36a58df247e072': 'self-service',  // Self Service category ID  
        '692fe2ae8b36a58df247e075': 'temple'         // Temple Meals category ID
      };
      
      // Get the most common category type from items
      const categoryTypes = order.items
        .map(item => {
          // Handle both string categoryId and object categoryId
          const categoryId = typeof item.categoryId === 'string' 
            ? item.categoryId 
            : item.categoryId?._id || item.categoryId;
          return categoryIdToType[categoryId];
        })
        .filter(Boolean);
      
      if (categoryTypes.length > 0) {
        // Return the most common category type
        const typeCount = {};
        categoryTypes.forEach(type => {
          typeCount[type] = (typeCount[type] || 0) + 1;
        });
        const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
          typeCount[a] > typeCount[b] ? a : b
        );
        return mostCommonType;
      }
    }
    
    // Fourth, fallback checks for legacy orders
    const branchName = order.branchName?.toLowerCase() || '';
    const customerName = order.customerName?.toLowerCase() || '';
    const tableNumber = order.tableNumber?.toString().toLowerCase() || '';
    
    // Temple meals - check for temple-related keywords
    if (branchName.includes('temple') || customerName.includes('temple')) {
      return 'temple';
    }
    
    // Self service - check for counter/self-service keywords
    if (tableNumber.includes('counter') || tableNumber.includes('self')) {
      return 'self-service';
    }
    
    // Default to restaurant orders
    return 'restaurant';
  };

  // Helper function to get order type icon
  const getOrderTypeIcon = (orderType) => {
    switch (orderType) {
      case 'temple': return '🛕';
      case 'self-service': return '🏪';
      case 'restaurant': return '🍽️';
      default: return '📋';
    }
  };

  // Helper function to get order type label
  const getOrderTypeLabel = (orderType) => {
    switch (orderType) {
      case 'temple': return 'Temple Meals';
      case 'self-service': return 'Self Service';
      case 'restaurant': return 'Restaurant Order';
      default: return 'Order';
    }
  };

  const filteredOrders = orders.filter(order => {
    // Debug: Log each order's type for the first few orders
    if (orders.indexOf(order) < 5) {
      console.log('🔍 Order Filter Debug:', {
        orderId: order.orderId || order.orderNumber || order._id,
        orderType: order.orderType,
        orderTypeTab: orderTypeTab,
        willShow: orderTypeTab === "all" || order.orderType === orderTypeTab
      });
    }
    
    // Filter by order type first
    if (orderTypeTab !== "all" && order.orderType !== orderTypeTab) {
      return false;
    }
    
    // Then filter by status
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
          <h1 style={styles.title}>Mobile App Orders</h1>
          <p style={{ margin: "5px 0 0", opacity: 0.7, fontSize: "14px" }}>
            Orders placed from the Hotel Virat mobile app
          </p>
          {userCategory && userCategory !== "All" && (
            <p style={styles.categoryBadge}>
              Showing: {userCategory} orders only
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={fetchOrders} style={styles.refreshBtn}>
            Refresh
          </button>
        </div>
      </div>

      {/* Order Type Tabs */}
      <div style={styles.orderTypeTabs}>
        {[
          { key: "all", label: "All Orders", icon: "📋" },
          { key: "restaurant", label: "Restaurant Orders", icon: "🍽️" },
          { key: "temple", label: "Temple Meals", icon: "🛕" },
          { key: "self-service", label: "Self Service", icon: "🏪" }
        ].map(tab => {
          const tabOrderCount = orders.filter(o => tab.key === "all" || o.orderType === tab.key).length;
          console.log(`📊 Tab ${tab.key} count: ${tabOrderCount}`);
          
          return (
            <button
              key={tab.key}
              onClick={() => {
                console.log(`🔄 Switching to tab: ${tab.key}`);
                setOrderTypeTab(tab.key);
              }}
              style={{
                ...styles.orderTypeTab,
                ...(orderTypeTab === tab.key ? styles.orderTypeTabActive : {})
              }}
            >
              <span style={{ marginRight: '8px' }}>{tab.icon}</span>
              {tab.label}
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                ({tabOrderCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Filter Tabs */}
      {/* Status Filter Tabs */}
      <div style={styles.filterTabs}>
        {["all", "pending", "confirmed", "preparing", "out for delivery", "delivered", "cancelled"].map(status => {
          const typeFilteredOrders = orders.filter(o => orderTypeTab === "all" || o.orderType === orderTypeTab);
          const statusCount = status === "all" ? typeFilteredOrders.length : typeFilteredOrders.filter(o => o.status === status).length;
          
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                ...styles.filterTab,
                ...(filter === status ? styles.filterTabActive : {})
              }}
            >
              {status === "out for delivery" ? "Out for Delivery" : status.charAt(0).toUpperCase() + status.slice(1)}
              <span style={{ marginLeft: '6px' }}>({statusCount})</span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {loading ? (
        <div style={styles.loading}>Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div style={styles.empty}>No orders found</div>
      ) : (
        <div style={styles.ordersList}>
          {filteredOrders.map(order => (
            <div key={order._id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div>
                  <h3 style={styles.orderTitle}>
                    {getOrderTypeIcon(order.orderType)} {order.tableNumber === 'Mobile Order' ? 'Mobile Order' : `Table ${order.tableNumber}`}
                  </h3>
                  <p style={styles.orderTime}>
                    {new Date(order.createdAt || order.orderTime || order.updatedAt).toLocaleString()}
                  </p>
                  <p style={styles.orderTypeLabel}>
                    {getOrderTypeLabel(order.orderType)}
                  </p>
                </div>
                <div style={{ ...styles.statusBadge, backgroundColor: getStatusColor(order.status) }}>
                  {getStatusIcon(order.status)}
                  <span>{order.status}</span>
                </div>
              </div>

              <div style={styles.orderDetails}>
                <p><strong>Customer:</strong> {order.customerName || 'N/A'}</p>
                <p><strong>Phone:</strong> {order.customerMobile || order.customerPhone || 'N/A'}</p>
                <p><strong>Branch:</strong> {order.branchName || 'Hotel Virat'}</p>
                {order.deliveryOption && (
                  <p><strong>Type:</strong> {order.deliveryOption === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</p>
                )}
                {order.deliveryAddress && (
                  <p><strong>Address:</strong> {order.deliveryAddress}</p>
                )}
                {order.paymentMethod && (
                  <p><strong>Payment:</strong> {order.paymentMethod.toUpperCase()}</p>
                )}
                {order.categoryName && <p><strong>Category:</strong> {order.categoryName}</p>}
                <p><strong>Items:</strong> {order.items?.length || 0}</p>
                {order.couponCode && (
                  <p><strong>Coupon:</strong> {order.couponCode} (-₹{order.discount || 0})</p>
                )}
                <p style={styles.orderTotal}>
                  <strong>Total:</strong> ₹{(order.grandTotal || order.totalAmount || order.total || 0).toFixed(2)}
                </p>
              </div>

              <div style={styles.orderActions}>
                <button
                  onClick={() => setSelectedOrder(order)}
                  style={styles.viewBtn}
                >
                  <Eye size={16} />
                  View Details
                </button>
                {order.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateOrderStatus(order._id, "delivered")}
                      style={styles.completeBtn}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order._id, "cancelled")}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div style={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailRow}>
                <span>Order Type:</span>
                <span>{selectedOrder.tableNumber === 'Mobile Order' ? '📱 Mobile App Order' : `🍽️ Table ${selectedOrder.tableNumber}`}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Customer:</span>
                <span>{selectedOrder.customerName || 'N/A'}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Phone:</span>
                <span>{selectedOrder.customerMobile || selectedOrder.customerPhone || 'N/A'}</span>
              </div>
              <div style={styles.detailRow}>
                <span>Status:</span>
                <span style={{ color: getStatusColor(selectedOrder.status), fontWeight: 'bold' }}>
                  {selectedOrder.status}
                </span>
              </div>
              {selectedOrder.deliveryOption && (
                <div style={styles.detailRow}>
                  <span>Delivery Type:</span>
                  <span>{selectedOrder.deliveryOption === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
                </div>
              )}
              {selectedOrder.deliveryAddress && (
                <div style={styles.detailRow}>
                  <span>Delivery Address:</span>
                  <span>{selectedOrder.deliveryAddress}</span>
                </div>
              )}
              {selectedOrder.paymentMethod && (
                <div style={styles.detailRow}>
                  <span>Payment Method:</span>
                  <span>{selectedOrder.paymentMethod.toUpperCase()}</span>
                </div>
              )}
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
              {selectedOrder.notes && (
                <div style={styles.detailRow}>
                  <span>Notes:</span>
                  <span>{selectedOrder.notes}</span>
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
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0,
  },
  categoryBadge: {
    display: 'inline-block',
    marginTop: '8px',
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
  },
  refreshBtn: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  orderTypeTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
    borderBottom: '2px solid #f3f4f6',
    paddingBottom: '16px',
  },
  orderTypeTab: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  orderTypeTabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6',
  },
  orderTypeLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  filterTabActive: {
    backgroundColor: '#10b981',
    color: 'white',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  ordersList: {
    display: 'grid',
    gap: '16px',
  },
  orderCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  orderTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
  },
  orderTime: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.8',
  },
  orderTotal: {
    fontSize: '18px',
    color: '#10b981',
    marginTop: '8px',
  },
  orderActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  completeBtn: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#6b7280',
    lineHeight: 1,
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  itemsTitle: {
    marginTop: '20px',
    marginBottom: '12px',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  itemName: {
    fontWeight: '600',
    marginBottom: '4px',
  },
  itemQty: {
    fontSize: '14px',
    color: '#6b7280',
  },
  itemPrice: {
    fontWeight: 'bold',
    color: '#10b981',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f0fdf4',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#10b981',
  },
};

export default Orders;
