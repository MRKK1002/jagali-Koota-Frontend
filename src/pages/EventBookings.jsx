import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FaClipboardList, 
  FaMoneyBillWave, 
  FaCheckCircle, 
  FaClock, 
  FaUsers, 
  FaCheck, 
  FaTimes 
} from 'react-icons/fa';
import './EventBookings.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';

const EventBookings = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (eventId) {
      fetchEventBookings();
    } else {
      fetchAllBookings();
    }
  }, [eventId, filter]);

  const fetchEventBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/events/${eventId}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setBookings(response.data.bookings);
        setEventInfo(response.data.event);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      alert('Error loading bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await axios.get(`${API_URL}/events/bookings/all${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setBookings(response.data.bookings);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      alert('Error loading bookings');
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, status, paymentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/events/bookings/${bookingId}/status`,
        { status, paymentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('Booking updated successfully');
      if (eventId) {
        fetchEventBookings();
      } else {
        fetchAllBookings();
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error updating booking');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      confirmed: { class: 'badge-confirmed', label: 'Confirmed' },
      cancelled: { class: 'badge-cancelled', label: 'Cancelled' },
      attended: { class: 'badge-attended', label: 'Attended' },
      'no-show': { class: 'badge-no-show', label: 'No Show' },
    };
    return badges[status] || { class: '', label: status };
  };

  const getPaymentBadge = (status) => {
    const badges = {
      paid: { class: 'payment-paid', label: 'Paid' },
      pending: { class: 'payment-pending', label: 'Pending' },
      refunded: { class: 'payment-refunded', label: 'Refunded' },
    };
    return badges[status] || { class: '', label: status };
  };

  const calculateTotals = () => {
    const total = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const paid = bookings.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
    const pending = bookings.filter(b => b.paymentStatus === 'pending').reduce((sum, b) => sum + b.totalAmount, 0);
    return { total, paid, pending };
  };

  const totals = calculateTotals();

  if (loading) {
    return <div className="loading">Loading bookings...</div>;
  }

  return (
    <div className="event-bookings-container">
      <div className="bookings-header">
        <div>
          <h1><FaClipboardList /> Event Bookings</h1>
          {eventInfo && (
            <div className="event-info">
              <h2>{eventInfo.title}</h2>
              <p>
                {new Date(eventInfo.eventDate).toLocaleDateString()} | 
                ₹{eventInfo.pricePerPerson}/person | 
                {eventInfo.totalBooked} booked
                {eventInfo.maxBookings && ` / ${eventInfo.maxBookings} max`}
              </p>
            </div>
          )}
        </div>
        <button className="btn-back" onClick={() => navigate('/admin/events')}>
          ← Back to Events
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><FaMoneyBillWave /></div>
          <div className="stat-content">
            <h3>₹{totals.total.toFixed(2)}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaCheckCircle /></div>
          <div className="stat-content">
            <h3>₹{totals.paid.toFixed(2)}</h3>
            <p>Paid</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaClock /></div>
          <div className="stat-content">
            <h3>₹{totals.pending.toFixed(2)}</h3>
            <p>Pending</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaUsers /></div>
          <div className="stat-content">
            <h3>{bookings.length}</h3>
            <p>Total Bookings</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      {!eventId && (
        <div className="filters">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}>
            All
          </button>
          <button 
            className={filter === 'confirmed' ? 'active' : ''} 
            onClick={() => setFilter('confirmed')}>
            Confirmed
          </button>
          <button 
            className={filter === 'attended' ? 'active' : ''} 
            onClick={() => setFilter('attended')}>
            Attended
          </button>
          <button 
            className={filter === 'cancelled' ? 'active' : ''} 
            onClick={() => setFilter('cancelled')}>
            Cancelled
          </button>
        </div>
      )}

      {/* Bookings Table */}
      {bookings.length === 0 ? (
        <div className="no-bookings">
          <p>No bookings found</p>
        </div>
      ) : (
        <div className="bookings-table-container">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Member</th>
                {!eventId && <th>Event</th>}
                <th>Contact</th>
                <th>People</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Booked On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking._id}>
                  <td>
                    <div className="member-cell">
                      <strong>{booking.memberName}</strong>
                      <small>{booking.memberEmail}</small>
                    </div>
                  </td>
                  {!eventId && (
                    <td>
                      <div className="event-cell">
                        <strong>{booking.eventId?.title}</strong>
                        <small>
                          {booking.eventId?.eventDate && 
                            new Date(booking.eventId.eventDate).toLocaleDateString()}
                        </small>
                      </div>
                    </td>
                  )}
                  <td>{booking.memberPhone || 'N/A'}</td>
                  <td>{booking.numberOfPeople}</td>
                  <td><strong>₹{booking.totalAmount}</strong></td>
                  <td>
                    <span className={`badge ${getStatusBadge(booking.status).class}`}>
                      {getStatusBadge(booking.status).label}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getPaymentBadge(booking.paymentStatus).class}`}>
                      {getPaymentBadge(booking.paymentStatus).label}
                    </span>
                  </td>
                  <td>{new Date(booking.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      {booking.status === 'confirmed' && (
                        <>
                          <button
                            className="btn-action btn-success"
                            onClick={() => updateBookingStatus(booking._id, 'attended', 'paid')}
                            title="Mark as Attended">
                            <FaCheck />
                          </button>
                          <button
                            className="btn-action btn-danger"
                            onClick={() => updateBookingStatus(booking._id, 'no-show', booking.paymentStatus)}
                            title="Mark as No-show">
                            <FaTimes />
                          </button>
                        </>
                      )}
                      {booking.paymentStatus === 'pending' && (
                        <button
                          className="btn-action btn-payment"
                          onClick={() => updateBookingStatus(booking._id, booking.status, 'paid')}
                          title="Mark as Paid">
                          <FaMoneyBillWave />
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
    </div>
  );
};

export default EventBookings;
