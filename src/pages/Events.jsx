import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiCalendar, FiClock, FiMapPin, FiUsers, FiEdit2, FiTrash2, FiPlus, FiBookOpen } from 'react-icons/fi';
import { MdOutlineCurrencyRupee } from 'react-icons/md';
import './Events.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';
const BASE_URL = API_URL.replace(/\/api\/v1\/hotel$/, ''); // Extract base URL for images

const to12Hour = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

const Events = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentEvent, setCurrentEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    eventTime: '',
    location: '',
    isPinned: false,
    bookingEnabled: false,
    pricePerPerson: 0,
    maxBookings: '',
  });
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/events/all`);
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Error loading events');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentEvent({
      ...currentEvent,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleImageChange = (e) => {
    setSelectedImages([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', currentEvent.title);
      formData.append('description', currentEvent.description);
      formData.append('eventDate', currentEvent.eventDate);
      formData.append('eventTime', currentEvent.eventTime);
      formData.append('location', currentEvent.location);
      formData.append('isPinned', currentEvent.isPinned);
      formData.append('bookingEnabled', currentEvent.bookingEnabled);
      formData.append('pricePerPerson', currentEvent.pricePerPerson || 0);
      if (currentEvent.maxBookings) {
        formData.append('maxBookings', currentEvent.maxBookings);
      }

      selectedImages.forEach((image) => {
        formData.append('images', image);
      });

      if (editMode) {
        await axios.put(`${API_URL}/events/${currentEvent._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Event updated successfully!');
      } else {
        await axios.post(`${API_URL}/events/create`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Event created successfully!');
      }

      setShowModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert(error.response?.data?.message || 'Error saving event');
    }
  };

  const handleEdit = (event) => {
    setCurrentEvent({
      ...event,
      eventDate: event.eventDate?.split('T')[0] || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await axios.delete(`${API_URL}/events/${id}`);
        alert('Event deleted successfully');
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event');
      }
    }
  };

  const resetForm = () => {
    setCurrentEvent({
      title: '',
      description: '',
      eventDate: '',
      eventTime: '',
      location: '',
      isPinned: false,
      bookingEnabled: false,
      pricePerPerson: 0,
      maxBookings: '',
    });
    setSelectedImages([]);
    setEditMode(false);
  };

  return (
    <div className="events-container">
      <div className="events-header">
        <h1>🎉 Events Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Create Event
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading events...</div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <div key={event._id} className="event-card">
              {/* Image / placeholder */}
              <div className="event-image">
                {event.images && event.images.length > 0
                  ? <img src={`${BASE_URL}${event.images[0]}`} alt={event.title} />
                  : <div className="event-image-placeholder">🎉</div>
                }
                {event.isPinned && <div className="pinned-badge">📌 Pinned</div>}
                {event.bookingEnabled && (
                  <div className="booking-open-badge">🎫 Booking Open</div>
                )}
              </div>

              <div className="event-content">
                <h3 className="event-title">{event.title}</h3>
                <p className="event-description">{event.description}</p>

                {/* Meta chips row */}
                <div className="event-meta">
                  <span className="meta-chip">
                    <FiCalendar size={13} />
                    {new Date(event.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="meta-chip">
                    <FiClock size={13} />
                    {to12Hour(event.eventTime)}
                  </span>
                  {event.location && (
                    <span className="meta-chip">
                      <FiMapPin size={13} />
                      {event.location}
                    </span>
                  )}
                </div>

                {/* Booking stats */}
                {event.bookingEnabled && (
                  <div className="booking-stats">
                    <div className="booking-stat">
                      <MdOutlineCurrencyRupee size={15} />
                      <span>₹{event.pricePerPerson}<small>/person</small></span>
                    </div>
                    <div className="booking-stat">
                      <FiUsers size={14} />
                      <span>
                        <strong>{event.totalBooked || 0}</strong> booked
                        {event.maxBookings && <> / <strong>{event.maxBookings}</strong> max</>}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="event-actions">
                  {event.bookingEnabled && (
                    <button className="btn-bookings" onClick={() => navigate(`/admin/event-bookings/${event._id}`)}>
                      <FiBookOpen size={14} style={{ marginRight: 5 }} /> View Bookings
                    </button>
                  )}
                  <button className="btn-edit" onClick={() => handleEdit(event)}>
                    <FiEdit2 size={14} style={{ marginRight: 5 }} /> Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(event._id)}>
                    <FiTrash2 size={14} style={{ marginRight: 5 }} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && !loading && (
        <div className="no-events">
          <p>No events found. Create your first event!</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Event' : 'Create Event'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  type="text"
                  name="title"
                  value={currentEvent.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  name="description"
                  value={currentEvent.description}
                  onChange={handleInputChange}
                  required
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Event Date *</label>
                  <input
                    type="date"
                    name="eventDate"
                    value={currentEvent.eventDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Event Time *</label>
                  <input
                    type="time"
                    name="eventTime"
                    value={currentEvent.eventTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={currentEvent.location}
                  onChange={handleInputChange}
                  placeholder="Event location or branch name"
                />
              </div>

              <div className="form-group">
                <label>Event Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                />
                <small>You can select multiple images</small>
              </div>

              {/* Booking Section */}
              <div className="booking-section">
                <h3 className="section-title">🎫 Booking / Reservation Settings</h3>
                
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="bookingEnabled"
                      checked={currentEvent.bookingEnabled}
                      onChange={handleInputChange}
                    />
                    <span>Enable booking for this event</span>
                  </label>
                </div>

                {currentEvent.bookingEnabled && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Price Per Person (₹) *</label>
                        <input
                          type="number"
                          name="pricePerPerson"
                          value={currentEvent.pricePerPerson}
                          onChange={handleInputChange}
                          min="0"
                          required={currentEvent.bookingEnabled}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group">
                        <label>Max Bookings (Leave empty for unlimited)</label>
                        <input
                          type="number"
                          name="maxBookings"
                          value={currentEvent.maxBookings}
                          onChange={handleInputChange}
                          min="1"
                          placeholder="Unlimited"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="isPinned"
                    checked={currentEvent.isPinned}
                    onChange={handleInputChange}
                  />
                  <span>Pin this event (show at top)</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editMode ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
