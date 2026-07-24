import { useState, useEffect } from "react"
import { Edit, Save, Phone, Mail } from "lucide-react"
import axios from "axios"

const HelpSupport = () => {
  const [helpSupport, setHelpSupport] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    mobile: "",
    email: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Fetch help and support data on component mount
  useEffect(() => {
    const fetchHelpSupport = async () => {
      setIsLoading(true)
      try {
        // Use your original backend URL
        const response = await axios.get("https://billing.jagalikoota.com/api/v1/hotel/help-support")
        setHelpSupport(response.data)
        setFormData({
          title: response.data.title,
          mobile: response.data.mobile,
          email: response.data.email,
        })
      } catch (err) {
        if (err.response?.status !== 404) {
          setError(err.response?.data?.message || "Failed to fetch help and support information")
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchHelpSupport()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let response
      if (helpSupport?._id) {
        // Update existing entry
        response = await axios.put(`https://billing.jagalikoota.com/api/v1/hotel/help-support/${helpSupport._id}`, formData)
      } else {
        // Create new entry
        response = await axios.post("https://billing.jagalikoota.com/api/v1/hotel/help-support", formData)
      }

      setHelpSupport(response.data.helpSupport)
      setFormData({
        title: response.data.helpSupport.title,
        mobile: response.data.helpSupport.mobile,
        email: response.data.helpSupport.email,
      })
      setIsEditing(false)
      setSuccessMessage("Help and support information saved successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save help and support information")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !helpSupport) {
    return <div className="empty-state">Loading...</div>
  }

  if (error && !helpSupport) {
    return <div className="empty-state">{error}</div>
  }

  return (
    <div className="help-support-page">
      <div className="page-header">
        <h1>Help & Support</h1>
        {!isEditing && (
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              <Edit size={16} />
              <span>Edit Information</span>
            </button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="card">
        {!isEditing ? (
          <div className="card-body" style={{ padding: "20px" }}>
            {helpSupport ? (
              <div className="contact-info-container">
                <div className="contact-header">
                  <h3>{helpSupport.title}</h3>
                </div>

                <div className="contact-details">
                  <div className="contact-item">
                    <div className="contact-icon">
                      <Phone size={20} />
                    </div>
                    <div className="contact-content">
                      <h4>Mobile Number</h4>
                      <p>{helpSupport.mobile}</p>
                    </div>
                  </div>

                  <div className="contact-item">
                    <div className="contact-icon">
                      <Mail size={20} />
                    </div>
                    <div className="contact-content">
                      <h4>Email Address</h4>
                      <p>{helpSupport.email}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">No help and support information available.</div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="card-body" style={{ padding: "20px" }}>
              {error && (
                <div className="alert-message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="title">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  className="form-input"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mobile">
                  Mobile Number
                </label>
                <input
                  type="text"
                  id="mobile"
                  name="mobile"
                  className="form-input"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFormData(
                      helpSupport
                        ? {
                            title: helpSupport.title,
                            mobile: helpSupport.mobile,
                            email: helpSupport.email,
                          }
                        : {
                            title: "",
                            mobile: "",
                            email: "",
                          },
                    )
                    setIsEditing(false)
                    setError(null)
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default HelpSupport
