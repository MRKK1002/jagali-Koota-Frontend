import { useState, useEffect } from 'react'
import { MessageSquare, Eye, Trash2, Clock, CheckCircle, Mail, Phone, User, Calendar, Filter, Search, ExternalLink } from 'lucide-react'
import './WebsiteMessages.css'

const WebsiteMessages = () => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchMessages()
  }, [currentPage, filter])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10
      })
      
      if (filter !== 'all') {
        params.append('status', filter)
      }

      const response = await fetch(`https://billing.jagalikoota.com/api/website/contact-messages?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setMessages(data.messages)
        setTotalPages(Math.ceil(data.total / 10))
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateMessageStatus = async (messageId, status) => {
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/website/contact-messages/${messageId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })
      
      const data = await response.json()
      if (data.success) {
        fetchMessages()
        if (selectedMessage && selectedMessage._id === messageId) {
          setSelectedMessage({ ...selectedMessage, status })
        }
      }
    } catch (error) {
      console.error('Error updating message status:', error)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return
    
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/website/contact-messages/${messageId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (data.success) {
        fetchMessages()
        if (selectedMessage && selectedMessage._id === messageId) {
          setSelectedMessage(null)
          setShowModal(false)
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const viewMessage = (message) => {
    setSelectedMessage(message)
    setShowModal(true)
    if (message.status === 'unread') {
      updateMessageStatus(message._id, 'read')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'unread': return '#ef4444'
      case 'read': return '#f59e0b'
      case 'replied': return '#10b981'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'unread': return <Clock size={16} />
      case 'read': return <Eye size={16} />
      case 'replied': return <CheckCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  const filteredMessages = messages.filter(message =>
    message.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && messages.length === 0) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Loading contact messages...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Contact Messages</h1>
        <p>View and manage messages from website contact form</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="controls-section">
        <div className="search-filter-bar">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-dropdown">
            <Filter size={20} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Messages</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
            </select>
          </div>
        </div>
        
        <div className="messages-count">
          {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Messages Table */}
      <div className="table-container">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner"></div>
            <p>Loading contact messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="no-messages">
            <MessageSquare size={48} />
            <h3>No messages found</h3>
            <p>No contact form submissions match your current filter.</p>
          </div>
        ) : (
          <table className="messages-table">
            <thead>
              <tr>
                {/* <th>Status</th> */}
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Subject</th>
                <th>Message Preview</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message) => (
                <tr key={message._id} className={`message-row ${message.status}`}>
                  {/* <td>
                    <div className="status-badge" style={{ backgroundColor: getStatusColor(message.status) }}>
                      {getStatusIcon(message.status)}
                      <span>{message.status}</span>
                    </div>
                  </td> */}
                  <td>
                    <div className="name-cell">
                      <User size={16} />
                      <span>{message.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="email-cell">
                      <Mail size={14} />
                      <span>{message.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="phone-cell">
                      {message.phone ? (
                        <>
                          <Phone size={14} />
                          <span>{message.phone}</span>
                        </>
                      ) : (
                        <span className="no-phone">-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="subject-cell">
                      <strong>{message.subject.replace('-', ' ').toUpperCase()}</strong>
                    </div>
                  </td>
                  <td>
                    <div className="message-preview">
                      {message.message.substring(0, 80)}
                      {message.message.length > 80 && '...'}
                    </div>
                  </td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      <span>{new Date(message.createdAt).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="action-btn view-btn"
                        onClick={() => viewMessage(message)}
                        title="View Message"
                      >
                        <ExternalLink size={16} />
                        <span>View</span>
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => deleteMessage(message._id)}
                        title="Delete Message"
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Message Details Modal */}
      {showModal && selectedMessage && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Message Details</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="sender-info">
                <div className="info-row">
                  <strong>Name:</strong>
                  <span>{selectedMessage.name}</span>
                </div>
                <div className="info-row">
                  <strong>Email:</strong>
                  <span>{selectedMessage.email}</span>
                </div>
                {selectedMessage.phone && (
                  <div className="info-row">
                    <strong>Phone:</strong>
                    <span>{selectedMessage.phone}</span>
                  </div>
                )}
                <div className="info-row">
                  <strong>Subject:</strong>
                  <span>{selectedMessage.subject.replace('-', ' ').toUpperCase()}</span>
                </div>
                <div className="info-row">
                  <strong>Date:</strong>
                  <span>{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <strong>Status:</strong>
                  <span style={{ color: getStatusColor(selectedMessage.status) }}>
                    {selectedMessage.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="message-content">
                <h4>Message:</h4>
                <p>{selectedMessage.message}</p>
              </div>
            </div>
            
            <div className="modal-footer">
              <div className="status-actions">
                <button
                  className={`status-btn ${selectedMessage.status === 'read' ? 'active' : ''}`}
                  onClick={() => updateMessageStatus(selectedMessage._id, 'read')}
                >
                  <Eye size={16} />
                  Mark as Read
                </button>
                <button
                  className={`status-btn ${selectedMessage.status === 'replied' ? 'active' : ''}`}
                  onClick={() => updateMessageStatus(selectedMessage._id, 'replied')}
                >
                  <CheckCircle size={16} />
                  Mark as Replied
                </button>
              </div>
              
              <button
                className="delete-btn-modal"
                onClick={() => deleteMessage(selectedMessage._id)}
              >
                <Trash2 size={16} />
                Delete Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebsiteMessages