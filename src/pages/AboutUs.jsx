import { useState, useEffect } from "react"
import { Edit, Save, Heart } from 'lucide-react'

const AboutUs = () => {
  const [aboutUs, setAboutUs] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    description: "",
    mission: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Fetch About Us data
  const fetchAboutUs = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch("https://billing.jagalikoota.com/api/v1/hotel/about-us")
      
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched data:', data) // Debug log
        
        // Handle the response - the controller returns the aboutUs object directly
        if (data && data._id) {
          setAboutUs(data)
          setFormData({
            description: data.description || "",
            mission: data.mission || ""
          })
        } else {
          setAboutUs(null)
          setFormData({ description: "", mission: "" })
        }
      } else if (response.status === 404) {
        // No data found - this is normal for first time
        setAboutUs(null)
        setFormData({ description: "", mission: "" })
        setError(null) // Clear any previous errors
      } else {
        throw new Error("Failed to fetch About Us data")
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err.message)
      setAboutUs(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch About Us data on component mount
  useEffect(() => {
    fetchAboutUs()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     setIsLoading(true)
//     setError(null)
//     setSuccessMessage(null)

//     // Basic validation
//     if (!formData.description.trim() || !formData.mission.trim()) {
//       setError("Both description and mission are required")
//       setIsLoading(false)
//       return
//     }

//     if (formData.description.trim().length < 10) {
//       setError("Description must be at least 10 characters long")
//       setIsLoading(false)
//       return
//     }

//     if (formData.mission.trim().length < 10) {
//       setError("Mission must be at least 10 characters long")
//       setIsLoading(false)
//       return
//     }

//     try {
//  const response = await fetch(
//         aboutUs
//           ? `https://hotelviratbackend-1spr.onrender.com/hotel/about-us/${aboutUs._id}`
//           : "https://hotelviratbackend-1spr.onrender.com/hotel/about-us",
//         {
//           method: aboutUs ? "PUT" : "POST",
//           headers: {
//             "Content-Type": "application/json"
//           },
//           body: JSON.stringify(formData)
//         }
//       )

//       const url = aboutUs
//         ? `https://billing.jagalikoota.com/api/v1/hotel/about-us/${aboutUs._id}`
//         : "https://billing.jagalikoota.com/api/v1/hotel/about-us"
      
//       const method = aboutUs ? "PUT" : "POST"
      
//       console.log(`Making ${method} request to:`, url) // Debug log
      
//       const response = await fetch(url, {
//         method,
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//           description: formData.description.trim(),
//           mission: formData.mission.trim()
//         })
//       })
//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(
//           errorData.message || 
//           (aboutUs
//             ? "Failed to update About Us information"
//             : "Failed to create About Us information")
//         )
//       }

//       const result = await response.json()
//       console.log('Submit result:', result) // Debug log

//       // Set success message
//       setSuccessMessage(
//         result.message || 
//         (aboutUs
//           ? "About Us information updated successfully!"
//           : "About Us information created successfully!")
//       )
      
//       // Exit editing mode
//       setIsEditing(false)
      
//       // Refetch data to ensure UI is updated with latest information
//       await fetchAboutUs()
      
//       // Clear success message after 5 seconds
//       setTimeout(() => setSuccessMessage(null), 5000)
      
//     } catch (err) {
//       console.error('Submit error:', err)
//       setError(err.message)
//     } finally {
//       setIsLoading(false)
//     }
//   }
const handleSubmit = async (e) => {
  e.preventDefault()
  setIsLoading(true)
  setError(null)
  setSuccessMessage(null)

  // Basic validation
  if (!formData.description.trim() || !formData.mission.trim()) {
    setError("Both description and mission are required")
    setIsLoading(false)
    return
  }

  if (formData.description.trim().length < 10) {
    setError("Description must be at least 10 characters long")
    setIsLoading(false)
    return
  }

  if (formData.mission.trim().length < 10) {
    setError("Mission must be at least 10 characters long")
    setIsLoading(false)
    return
  }

  try {
    const url = aboutUs
      ? `https://billing.jagalikoota.com/api/v1/hotel/about-us/${aboutUs._id}`
      : "https://billing.jagalikoota.com/api/v1/hotel/about-us"

    const method = aboutUs ? "PUT" : "POST"

    console.log(`Making ${method} request to:`, url) // Debug log

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: formData.description.trim(),
        mission: formData.mission.trim()
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.message ||
          (aboutUs
            ? "Failed to update About Us information"
            : "Failed to create About Us information")
      )
    }

    const result = await response.json()
    console.log("Submit result:", result)

    // Success message
    setSuccessMessage(
      result.message ||
        (aboutUs
          ? "About Us information updated successfully!"
          : "About Us information created successfully!")
    )

    setIsEditing(false)
    await fetchAboutUs()

    // Auto clear message
    setTimeout(() => setSuccessMessage(null), 5000)
  } catch (err) {
    console.error("Submit error:", err)
    setError(err.message)
  } finally {
    setIsLoading(false)
  }
}

  if (isLoading && !aboutUs && !isEditing) {
    return <div className="empty-state">Loading...</div>
  }

  return (
    <div className="about-us-page">
      <div className="page-header">
        <h1>About Us</h1>
        {!isEditing && (
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              <Edit size={16} />
              <span>{aboutUs ? 'Edit Information' : 'Add Information'}</span>
            </button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && !isEditing && (
        <div className="alert-message" style={{ marginBottom: "16px" }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            ×
          </button>
        </div>
      )}

      <div className="card">
        {!isEditing ? (
          aboutUs ? (
            <div className="card-body" style={{ padding: "20px" }}>
              <div className="about-info-container">
                <div className="about-header">
                  <h3>About Hotel Virat</h3>
                </div>

                <div className="about-section">
                  <h4>Description</h4>
                  <p>{aboutUs.description}</p>
                </div>

                <div className="about-section">
                  <div className="mission-header">
                    <Heart size={20} color="#ff7e47" />
                    <h4>Our Mission</h4>
                  </div>
                  <p>{aboutUs.mission}</p>
                </div>

                {aboutUs.updatedAt && (
                  <div className="about-meta" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <small style={{ color: '#666', fontSize: '0.875rem' }}>
                      Last updated: {new Date(aboutUs.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card-body" style={{ padding: "20px" }}>
              <div className="empty-state">
                <Heart size={48} color="#ddd" style={{ marginBottom: '16px' }} />
                <h3 style={{ color: '#999', marginBottom: '8px' }}>No About Us Information</h3>
                <p style={{ color: '#999', margin: 0 }}>
                  No About Us information available. Click "Add Information" to create one.
                </p>
              </div>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="card-body" style={{ padding: "20px" }}>
              {error && (
                <div className="alert-message" style={{ marginBottom: "16px" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="description">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="form-textarea"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={6}
                  placeholder="Enter a detailed description about your hotel..."
                  minLength={10}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {formData.description.length} characters (minimum 10 required)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mission">
                  Mission *
                </label>
                <textarea
                  id="mission"
                  name="mission"
                  className="form-textarea"
                  value={formData.mission}
                  onChange={handleChange}
                  required
                  rows={4}
                  placeholder="Enter your hotel's mission statement..."
                  minLength={10}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {formData.mission.length} characters (minimum 10 required)
                </small>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFormData(
                      aboutUs
                        ? {
                            description: aboutUs.description,
                            mission: aboutUs.mission
                          }
                        : { description: "", mission: "" }
                    )
                    setIsEditing(false)
                    setError(null)
                    setSuccessMessage(null)
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || formData.description.trim().length < 10 || formData.mission.trim().length < 10}
                >
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

export default AboutUs