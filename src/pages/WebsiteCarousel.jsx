import { useState, useEffect } from "react"
import { Image, Plus, Edit, Trash2, Eye, EyeOff, X, Upload } from "lucide-react"
import API_BASE_URL from "../config/api"
import "./WebsiteManagement.css"

const WebsiteCarousel = () => {
  const [carouselImages, setCarouselImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [editingImage, setEditingImage] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order: 0,
    isActive: true
  })

  useEffect(() => {
    fetchCarouselImages()
  }, [])

  const fetchCarouselImages = async () => {
    try {
      setLoading(true)
      console.log('Fetching carousel images from:', `${API_BASE_URL}/api/website/carousel`)
      
      const response = await fetch(`${API_BASE_URL}/api/website/carousel`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Carousel images response:', data)
      
      if (data.success) {
        setCarouselImages(data.images || [])
      } else {
        console.error('Failed to fetch carousel images:', data.message)
        alert('Failed to fetch carousel images: ' + data.message)
      }
    } catch (error) {
      console.error('Error fetching carousel images:', error)
      alert('Error connecting to server. Please make sure the backend is running on ' + API_BASE_URL)
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingImage(null)
    setFormData({
      title: '',
      description: '',
      order: carouselImages.length,
      isActive: true
    })
    setSelectedImage(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const handleEdit = (image) => {
    setEditingImage(image)
    setFormData({
      title: image.title || '',
      description: image.description || '',
      order: image.order || 0,
      isActive: image.isActive
    })
    setSelectedImage(null)
    setImagePreview(`${API_BASE_URL}${image.imageUrl}`)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingImage(null)
    setFormData({
      title: '',
      description: '',
      order: 0,
      isActive: true
    })
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert('File too large! Please select an image smaller than 10MB.');
        e.target.value = ''; // Clear the input
        return;
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type! Please select a JPEG, PNG, GIF, or WebP image.');
        e.target.value = ''; // Clear the input
        return;
      }
      
      setSelectedImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
      
      console.log('Image selected:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: file.type
      });
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!editingImage && !selectedImage) {
      alert('Please select an image')
      return
    }

    if (!formData.title.trim()) {
      alert('Please enter a title')
      return
    }

    try {
      setSubmitting(true)
      
      const formDataToSend = new FormData()
      if (selectedImage) {
        formDataToSend.append('image', selectedImage)
      }
      formDataToSend.append('title', formData.title.trim())
      formDataToSend.append('description', formData.description.trim())
      formDataToSend.append('order', formData.order)
      formDataToSend.append('isActive', formData.isActive)

      const url = editingImage 
        ? `${API_BASE_URL}/api/website/carousel/${editingImage._id}`
        : `${API_BASE_URL}/api/website/carousel`
      
      const method = editingImage ? 'PUT' : 'POST'

      console.log(`${editingImage ? 'Updating' : 'Adding'} carousel image:`, url)
      console.log('Form data being sent:', {
        title: formData.title,
        description: formData.description,
        order: formData.order,
        isActive: formData.isActive,
        hasImage: !!selectedImage,
        imageSize: selectedImage ? selectedImage.size : 'N/A'
      })

      const response = await fetch(url, {
        method: method,
        body: formDataToSend
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Server error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Response data:', data)
      
      if (data.success) {
        alert(`Carousel image ${editingImage ? 'updated' : 'added'} successfully!`)
        handleCloseModal()
        fetchCarouselImages() // Refresh the list
      } else {
        alert('Error: ' + (data.message || 'Unknown error occurred'))
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      
      // More detailed error messages
      let errorMessage = `Failed to ${editingImage ? 'update' : 'add'} carousel image.`
      
      if (error.message.includes('500')) {
        errorMessage += ' Server error - please check if the backend is running and the uploads directory exists.'
      } else if (error.message.includes('404')) {
        errorMessage += ' Image not found - it may have been deleted.'
      } else if (error.message.includes('400')) {
        errorMessage += ' Invalid data - please check all required fields.'
      } else {
        errorMessage += ` Error: ${error.message}`
      }
      
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this carousel image?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/website/carousel/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        alert('Carousel image deleted successfully!')
        fetchCarouselImages() // Refresh the list
      } else {
        alert('Error: ' + data.message)
      }
    } catch (error) {
      console.error('Error deleting carousel image:', error)
      alert('Failed to delete carousel image. Please try again.')
    }
  }

  const toggleActive = async (id, currentStatus) => {
    try {
      const formData = new FormData()
      formData.append('isActive', !currentStatus)

      const response = await fetch(`${API_BASE_URL}/api/website/carousel/${id}`, {
        method: 'PUT',
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        fetchCarouselImages() // Refresh the list
      } else {
        alert('Error: ' + data.message)
      }
    } catch (error) {
      console.error('Error updating carousel image:', error)
      alert('Failed to update carousel image. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Loading carousel images...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Carousel Images</h1>
        <p>Manage banner images for the website carousel</p>
      </div>

      <div className="content-card">
        <div className="card-header">
          <h2>Website Banner Images ({carouselImages.length})</h2>
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={16} />
            Add New Image
          </button>
        </div>

        {carouselImages.length === 0 ? (
          <div className="placeholder-content">
            <Image size={64} className="placeholder-icon" />
            <h3>No Carousel Images</h3>
            <p>Start by adding your first carousel image to showcase on the website banner.</p>
            <button className="btn btn-primary" onClick={handleAddNew}>
              <Plus size={16} />
              Add First Image
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Description</th>
                  {/* <th>Button</th>
                  <th>Order</th>
                  <th>Status</th> */}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {carouselImages
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((image) => (
                  <tr key={image._id}>
                    <td>
                      <div className="table-image">
                        <img 
                          src={`${API_BASE_URL}${image.imageUrl}`} 
                          alt={image.title}
                          onError={(e) => {
                            e.target.src = '/placeholder-image.jpg'
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="table-title">
                        <strong>{image.title}</strong>
                        <small>Created: {new Date(image.createdAt).toLocaleDateString()}</small>
                      </div>
                    </td>
                    <td>
                      <div className="table-description">
                        {image.description ? (
                          <span>{image.description.length > 50 ? 
                            image.description.substring(0, 50) + '...' : 
                            image.description}
                          </span>
                        ) : (
                          <span className="no-description">No description</span>
                        )}
                      </div>
                    </td>
                    {/* <td>
                      <div className="table-button">
                        {image.buttonText ? (
                          <div>
                            <strong>{image.buttonText}</strong>
                            {image.buttonLink && (
                              <small>{image.buttonLink}</small>
                            )}
                          </div>
                        ) : (
                          <span className="no-button">No button</span>
                        )}
                      </div>
                    </td> */}
                    {/* <td>
                      <span className="order-badge">{image.order || 0}</span>
                    </td> */}
                    {/* <td>
                      <button
                        className={`status-badge ${image.isActive ? 'active' : 'inactive'}`}
                        onClick={() => toggleActive(image._id, image.isActive)}
                        title={`Click to ${image.isActive ? 'deactivate' : 'activate'}`}
                      >
                        {image.isActive ? (
                          <>
                            <Eye size={12} />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} />
                            Inactive
                          </>
                        )}
                      </button>
                    </td> */}
                    <td>
                      <div className="table-actions">
                        <button 
                          className="btn-action btn-edit"
                          onClick={() => handleEdit(image)}
                          title="Edit image"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(image._id)}
                          title="Delete image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Image Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingImage ? 'Edit Carousel Image' : 'Add New Carousel Image'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="image">
                    Image Upload {!editingImage && '*'}
                  </label>
                  <div className="image-upload-area">
                    {imagePreview ? (
                      <div className="image-preview">
                        <img src={imagePreview} alt="Preview" />
                        <button 
                          type="button" 
                          className="remove-preview"
                          onClick={() => {
                            setSelectedImage(null)
                            setImagePreview(editingImage ? `${API_BASE_URL}${editingImage.imageUrl}` : null)
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={32} />
                        <p>Click to upload or drag and drop</p>
                        <small>PNG, JPG, GIF, WebP up to 10MB</small>
                      </>
                    )}
                    <input 
                      type="file" 
                      id="image" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      required={!editingImage}
                    />
                  </div>
                  {editingImage && (
                    <small className="form-note">Leave empty to keep current image</small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter image title"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter image description"
                    rows="3"
                  />
                </div>

                {/* <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="buttonText">Button Text (Optional)</label>
                    <input
                      type="text"
                      id="buttonText"
                      name="buttonText"
                      value={formData.buttonText}
                      onChange={handleInputChange}
                      placeholder="e.g., Learn More"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="buttonLink">Button Link (Optional)</label>
                    <input
                      type="url"
                      id="buttonLink"
                      name="buttonLink"
                      value={formData.buttonLink}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                    />
                  </div>
                </div> */}

                {/* <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="order">Display Order</label>
                    <input
                      type="number"
                      id="order"
                      name="order"
                      value={formData.order}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                      />
                      <span>Active (show on website)</span>
                    </label>
                  </div>
                </div> */}
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 
                    (editingImage ? 'Updating...' : 'Adding...') : 
                    (editingImage ? 'Update Image' : 'Add Image')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebsiteCarousel