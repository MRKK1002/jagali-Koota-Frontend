import { useState, useEffect } from "react"
import { Utensils, Edit, Save, X } from "lucide-react"
import "./WebsiteManagement.css"

const WebsiteCatering = () => {
  const [cateringContent, setCateringContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    // TODO: Fetch catering content from API
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Loading catering content...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Catering Content</h1>
        <p>Manage catering service content for the website</p>
      </div>

      <div className="content-card">
        <div className="card-header">
          <h2>Catering Service Information</h2>
          <button className="btn btn-primary">
            <Edit size={16} />
            Edit Content
          </button>
        </div>

        <div className="placeholder-content">
          <Utensils size={64} className="placeholder-icon" />
          <h3>Catering Content Management</h3>
          <p>This feature is coming soon. You'll be able to manage catering service content here.</p>
          <div className="feature-list">
            <ul>
              <li>Edit catering service description</li>
              <li>Manage service features</li>
              <li>Update contact information</li>
              <li>Add/remove service types</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebsiteCatering