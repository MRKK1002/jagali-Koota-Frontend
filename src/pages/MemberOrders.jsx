import { useState, useEffect } from "react";
import axios from "axios";
import {
  FaShoppingCart,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMoneyBillWave,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
} from "react-icons/fa";
import "./MemberOrders.css";

const API_URL = import.meta.env.VITE_API_URL || "https://billing.jagalikoota.com/api/v1/hotel";

const MemberOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/member-orders/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      alert("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    if (!window.confirm("Complete this order? Amount will be deducted from member's wallet.")) {
      return;
    }

    try {
      setProcessing(orderId);
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API_URL}/member-orders/${orderId}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        alert(response.data.message);
        fetchOrders(); // Refresh orders
      }
    } catch (error) {
      console.error("Error completing order:", error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || "Failed to complete order";
      alert(errorMsg);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <FaCheckCircle className="status-icon completed" />;
      case "cancelled":
        return <FaTimesCircle className="status-icon cancelled" />;
      case "pending":
        return <FaClock className="status-icon pending" />;
      default:
        return <FaSpinner className="status-icon preparing" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "status-completed";
      case "cancelled":
        return "status-cancelled";
      case "pending":
        return "status-pending";
      default:
        return "status-preparing";
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  if (loading) {
    return (
      <div className="member-orders-container">
        <div className="loading-spinner">
          <FaSpinner className="spinner-icon" />
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="member-orders-container">
      <div className="page-header">
        <div className="header-content">
          <FaShoppingCart className="header-icon" />
          <h1>Member Orders</h1>
        </div>
        <p className="subtitle">Manage food orders from members</p>
      </div>

      <div className="filters-container">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Orders
        </button>
        <button
          className={`filter-btn ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Pending
        </button>
        <button
          className={`filter-btn ${filter === "completed" ? "active" : ""}`}
          onClick={() => setFilter("completed")}
        >
          Completed
        </button>
        <button
          className={`filter-btn ${filter === "cancelled" ? "active" : ""}`}
          onClick={() => setFilter("cancelled")}
        >
          Cancelled
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">
          <FaShoppingCart className="no-orders-icon" />
          <p>No {filter !== "all" ? filter : ""} orders found</p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => (
            <div key={order._id} className="order-card">
              <div className="order-header">
                <div className="order-id">
                  Order #{order._id.slice(-8).toUpperCase()}
                </div>
                <div className={`order-status ${getStatusClass(order.status)}`}>
                  {getStatusIcon(order.status)}
                  <span>{order.status}</span>
                </div>
              </div>

              <div className="member-info">
                <div className="info-row">
                  <FaUser className="info-icon" />
                  <span>{order.memberName || "Unknown Member"}</span>
                </div>
                {order.memberPhone && (
                  <div className="info-row">
                    <FaPhone className="info-icon" />
                    <span>{order.memberPhone}</span>
                  </div>
                )}
                {order.memberEmail && (
                  <div className="info-row">
                    <FaEnvelope className="info-icon" />
                    <span>{order.memberEmail}</span>
                  </div>
                )}
              </div>

              <div className="order-items">
                <h4>Items Ordered:</h4>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={index}>
                      <span className="item-name">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="item-price">₹{item.subtotal.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {order.notes && (
                <div className="order-notes">
                  <strong>Notes:</strong> {order.notes}
                </div>
              )}

              <div className="order-footer">
                <div className="total-amount">
                  <FaMoneyBillWave className="amount-icon" />
                  <span className="amount-label">Total:</span>
                  <span className="amount-value">₹{order.totalAmount.toFixed(2)}</span>
                </div>

                <div className="order-time">
                  <FaClock className="time-icon" />
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {order.status === "pending" && (
                <button
                  className="complete-btn"
                  onClick={() => handleCompleteOrder(order._id)}
                  disabled={processing === order._id}
                >
                  {processing === order._id ? (
                    <>
                      <FaSpinner className="btn-spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />
                      Complete Order
                    </>
                  )}
                </button>
              )}

              {order.status === "completed" && order.completedAt && (
                <div className="completion-info">
                  <FaCheckCircle className="completed-icon" />
                  Completed on {new Date(order.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberOrders;
