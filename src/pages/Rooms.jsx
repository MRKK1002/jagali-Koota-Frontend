import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, AlertCircle, Check, Upload, X, Bed, Download } from "lucide-react"
import axios from "axios"
import * as XLSX from "xlsx"

const API_BASE = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

const getImageUrl = (imagePath) => {
  if (!imagePath) return null
  // If it's already a full URL (S3 or http), return as is
  if (imagePath.startsWith("http")) return imagePath
  
  // Always use production server for images since that's where they're stored
  const baseUrl = 'https://billing.jagalikoota.com'
  
  // Clean up the path - remove leading slash if present
  let cleanPath = imagePath.replace(/\\/g, '/') // Convert backslashes to forward slashes
  if (cleanPath.startsWith('/'))  {
    cleanPath = cleanPath.substring(1)
  }
  
  const fullUrl = `${baseUrl}/${cleanPath}`
  console.log('Image URL:', imagePath, '->', fullUrl)
  return fullUrl
}

const AMENITIES_LIST = [
  { key: 'tv', label: 'TV' },
  { key: 'ac', label: 'AC' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'minibar', label: 'Mini Bar' },
  { key: 'roomService', label: 'Room Service' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'bathtub', label: 'Bathtub' },
  { key: 'shower', label: 'Shower' },
  { key: 'hairDryer', label: 'Hair Dryer' },
  { key: 'safe', label: 'Safe' },
  { key: 'telephone', label: 'Telephone' },
  { key: 'coffeeMaker', label: 'Coffee Maker' },
  { key: 'iron', label: 'Iron' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'parking', label: 'Parking' },
]

const ROOM_TYPES = ['Single', 'Double', 'Suite', 'Deluxe', 'Family', 'Presidential']
const FLOORS = ['First Floor', 'Second Floor']

const RoomModal = ({ room, branches, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    branchId: room?.branchId?._id || room?.branchId || '',
    floor: room?.floor || 'First Floor',
    roomType: room?.roomType || 'Single',
    price: room?.price || '',
    description: room?.description || '',
    roomNumber: room?.roomNumber || '',
    amenities: room?.amenities || {},
    capacity: room?.capacity || { adults: 2, children: 0 },
    isAvailable: room?.isAvailable !== false,
    hourlyPricing: room?.hourlyPricing || { enabled: false, threeHours: 0, sixHours: 0, nineHours: 0, twelveHours: 0 },
    housekeepingStatus: room?.housekeepingStatus || 'clean',
    cleaningNotes: room?.cleaningNotes || '',
  })
  const [images, setImages] = useState([])
  const [existingImages, setExistingImages] = useState(room?.images || [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name.startsWith('amenities.')) {
      const key = name.split('.')[1]
      setFormData(prev => ({
        ...prev, 
        amenities: { ...prev.amenities, [key]: checked }
      })) 
    } else if (name.startsWith('capacity.')) {
      const key = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        capacity: { ...prev.capacity, [key]: Number(value) }
      }))
    } else if (name.startsWith('hourlyPricing.')) {
      const key = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        hourlyPricing: { ...prev.hourlyPricing, [key]: key === 'enabled' ? checked : Number(value) }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    const totalImages = existingImages.length + images.length + files.length
    if (totalImages > 5) {
      setError("Maximum 5 images allowed")
      return
    }
    setError("")
    setImages(prev => [...prev, ...files])
  }

  const removeNewImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingImage = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const submitData = new FormData()
      submitData.append("branchId", formData.branchId)
      submitData.append("floor", formData.floor)
      submitData.append("roomType", formData.roomType)
      submitData.append("price", formData.price)
      submitData.append("description", formData.description)
      submitData.append("roomNumber", formData.roomNumber)
      submitData.append("amenities", JSON.stringify(formData.amenities))
      submitData.append("capacity", JSON.stringify(formData.capacity))
      submitData.append("hourlyPricing", JSON.stringify(formData.hourlyPricing))
      submitData.append("housekeepingStatus", formData.housekeepingStatus)
      submitData.append("cleaningNotes", formData.cleaningNotes)
      submitData.append("isAvailable", formData.isAvailable)
      submitData.append("existingImages", JSON.stringify(existingImages))

      // DEBUG: Log what we're sending
      console.log("📤 Submitting room data:")
      console.log("formData.hourlyPricing:", formData.hourlyPricing)
      console.log("JSON.stringify(formData.hourlyPricing):", JSON.stringify(formData.hourlyPricing))

      images.forEach(img => submitData.append("images", img))

      await onSave(submitData)
      onClose()
    } catch (err) {
      console.error("❌ Error saving room:", err)
      setError(err.message || "Failed to save room")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal room-modal" style={{ maxWidth: "900px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
          color: "white",
          padding: "20px 24px",
          borderRadius: "12px 12px 0 0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ 
              width: "40px", 
              height: "40px", 
              borderRadius: "10px", 
              background: "rgba(255,255,255,0.2)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center" 
            }}>
              <Bed size={22} />
            </div>
            <h3 className="modal-title" style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
              {room ? "Edit Room Details" : "Add New Room"}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose} style={{ 
            color: "white", 
            fontSize: "28px", 
            background: "rgba(255,255,255,0.2)", 
            width: "36px", 
            height: "36px", 
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s"
          }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {error && (
              <div className="error-message" style={{ 
                marginBottom: "20px", 
                padding: "12px 16px",
                backgroundColor: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                color: "#dc2626", 
                display: "flex", 
                alignItems: "center", 
                gap: "10px",
                fontSize: "14px"
              }}>
                <AlertCircle size={18} /><span>{error}</span>
              </div>
            )}

            {/* Images Section */}
            <div className="form-section" style={{ 
              background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)", 
              padding: "20px", 
              borderRadius: "12px", 
              marginBottom: "24px",
              border: "2px dashed #a0aec0"
            }}>
              <label className="form-label" style={{ 
                fontSize: "15px", 
                fontWeight: "600", 
                marginBottom: "16px", 
                display: "flex", 
                alignItems: "center", 
                gap: "8px",
                color: "#2d3748"
              }}>
                <Upload size={18} />
                Room Images (Max 5)
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {existingImages.map((img, idx) => (
                  <div key={`existing-${idx}`} style={{ 
                    position: "relative", 
                    width: "110px", 
                    height: "110px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    border: "3px solid white"
                  }}>
                    <img src={getImageUrl(img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => removeExistingImage(idx)} style={{ 
                      position: "absolute", 
                      top: "4px", 
                      right: "4px", 
                      background: "#ef4444", 
                      border: "none", 
                      borderRadius: "50%", 
                      width: "28px", 
                      height: "28px", 
                      color: "white", 
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      transition: "all 0.2s"
                    }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {images.map((img, idx) => (
                  <div key={`new-${idx}`} style={{ 
                    position: "relative", 
                    width: "110px", 
                    height: "110px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    border: "3px solid #10b981"
                  }}>
                    <img src={URL.createObjectURL(img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => removeNewImage(idx)} style={{ 
                      position: "absolute", 
                      top: "4px", 
                      right: "4px", 
                      background: "#ef4444", 
                      border: "none", 
                      borderRadius: "50%", 
                      width: "28px", 
                      height: "28px", 
                      color: "white", 
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      transition: "all 0.2s"
                    }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {(existingImages.length + images.length) < 5 && (
                  <label style={{ 
                    width: "110px", 
                    height: "110px", 
                    border: "3px dashed #cbd5e0", 
                    borderRadius: "10px", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    cursor: "pointer",
                    background: "white",
                    transition: "all 0.2s",
                    color: "#718096"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#667eea"
                    e.currentTarget.style.background = "#f7fafc"
                    e.currentTarget.style.color = "#667eea"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e0"
                    e.currentTarget.style.background = "white"
                    e.currentTarget.style.color = "#718096"
                  }}>
                    <Upload size={24} />
                    <span style={{ fontSize: "13px", marginTop: "6px", fontWeight: "500" }}>Add Image</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} style={{ display: "none" }} />
                  </label>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="form-section" style={{ marginBottom: "24px" }}>
              <h4 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                marginBottom: "16px", 
                color: "#2d3748",
                paddingBottom: "8px",
                borderBottom: "2px solid #e2e8f0"
              }}>Basic Information</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Branch <span style={{ color: "#e53e3e" }}>*</span>
                  </label>
                  <select name="branchId" className="form-input" value={formData.branchId} onChange={handleChange} required style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }}>
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Floor <span style={{ color: "#e53e3e" }}>*</span>
                  </label>
                  <select name="floor" className="form-input" value={formData.floor} onChange={handleChange} required style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }}>
                    {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Room Type
                  </label>
                  <select name="roomType" className="form-input" value={formData.roomType} onChange={handleChange} style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }}>
                    {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Basic Price (₹) <span style={{ color: "#e53e3e" }}>*</span>
                  </label>
                  <input type="number" name="price" className="form-input" value={formData.price} onChange={handleChange} required placeholder="Enter price" style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Room Number
                  </label>
                  <input type="text" name="roomNumber" className="form-input" value={formData.roomNumber} onChange={handleChange} placeholder="e.g., 101" style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, display: "flex", alignItems: "center", paddingTop: "28px" }}>
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", margin: 0 }}>
                    <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleChange} style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer"
                    }} />
                    <span style={{ fontSize: "14px", fontWeight: "500", color: "#4a5568" }}>Room Available</span>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "16px", marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                  Description
                </label>
                <textarea name="description" className="form-textarea" value={formData.description} onChange={handleChange} rows="3" placeholder="Enter room description..." style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  transition: "all 0.2s",
                  resize: "vertical"
                }} />
              </div>
            </div>

            {/* Capacity */}
            <div className="form-section" style={{ marginBottom: "24px" }}>
              <h4 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                marginBottom: "16px", 
                color: "#2d3748",
                paddingBottom: "8px",
                borderBottom: "2px solid #e2e8f0"
              }}>Room Capacity</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Adults Capacity
                  </label>
                  <input type="number" name="capacity.adults" className="form-input" value={formData.capacity.adults} onChange={handleChange} min="1" style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#4a5568" }}>
                    Children Capacity
                  </label>
                  <input type="number" name="capacity.children" className="form-input" value={formData.capacity.children} onChange={handleChange} min="0" style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    transition: "all 0.2s"
                  }} />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div className="form-section" style={{ marginBottom: "24px" }}>
              <h4 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                marginBottom: "16px", 
                color: "#2d3748",
                paddingBottom: "8px",
                borderBottom: "2px solid #e2e8f0"
              }}>Room Amenities</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {AMENITIES_LIST.map(a => (
                  <label key={a.key} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px", 
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    background: formData.amenities[a.key] ? "#f0fdf4" : "white",
                    borderColor: formData.amenities[a.key] ? "#86efac" : "#e2e8f0",
                    transition: "all 0.2s",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: formData.amenities[a.key] ? "#166534" : "#4a5568"
                  }}>
                    <input 
                      type="checkbox" 
                      name={`amenities.${a.key}`} 
                      checked={formData.amenities[a.key] || false} 
                      onChange={handleChange}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Hourly Pricing Section */}
            <div className="form-section" style={{ 
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", 
              border: "2px solid #fbbf24",
              borderRadius: "12px", 
              padding: "20px", 
              marginBottom: "24px"
            }}>
              <label className="form-label" style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                marginBottom: "16px",
                fontSize: "16px",
                fontWeight: "600",
                color: "#78350f",
                cursor: "pointer"
              }}>
                <input 
                  type="checkbox" 
                  name="hourlyPricing.enabled" 
                  checked={formData.hourlyPricing.enabled || false} 
                  onChange={handleChange}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                />
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  ⏱️ Enable Hourly Pricing
                </span>
              </label>
              
              {formData.hourlyPricing.enabled && (
                <>
                  <div style={{ 
                    background: "white", 
                    padding: "16px", 
                    borderRadius: "10px",
                    marginBottom: "12px",
                    border: "1px solid #fbbf24"
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ 
                          fontSize: "14px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#92400e"
                        }}>
                          <span style={{ 
                            background: "#fef3c7", 
                            padding: "4px 10px", 
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "700"
                          }}>3 Hours</span>
                          Price (₹)
                        </label>
                        <input 
                          type="number" 
                          name="hourlyPricing.threeHours" 
                          className="form-input" 
                          value={formData.hourlyPricing.threeHours || ''} 
                          onChange={handleChange} 
                          placeholder="Enter 3 hours price"
                          min="0"
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "2px solid #fbbf24",
                            fontSize: "14px",
                            fontWeight: "600"
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ 
                          fontSize: "14px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#92400e"
                        }}>
                          <span style={{ 
                            background: "#fef3c7", 
                            padding: "4px 10px", 
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "700"
                          }}>6 Hours</span>
                          Price (₹)
                        </label>
                        <input 
                          type="number" 
                          name="hourlyPricing.sixHours" 
                          className="form-input" 
                          value={formData.hourlyPricing.sixHours || ''} 
                          onChange={handleChange} 
                          placeholder="Enter 6 hours price"
                          min="0"
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "2px solid #fbbf24",
                            fontSize: "14px",
                            fontWeight: "600"
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ 
                          fontSize: "14px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#92400e"
                        }}>
                          <span style={{ 
                            background: "#fef3c7", 
                            padding: "4px 10px", 
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "700"
                          }}>9 Hours</span>
                          Price (₹)
                        </label>
                        <input 
                          type="number" 
                          name="hourlyPricing.nineHours" 
                          className="form-input" 
                          value={formData.hourlyPricing.nineHours || ''} 
                          onChange={handleChange} 
                          placeholder="Enter 9 hours price"
                          min="0"
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "2px solid #fbbf24",
                            fontSize: "14px",
                            fontWeight: "600"
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ 
                          fontSize: "14px", 
                          fontWeight: "600", 
                          marginBottom: "8px", 
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#92400e"
                        }}>
                          <span style={{ 
                            background: "#fef3c7", 
                            padding: "4px 10px", 
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "700"
                          }}>12 Hours</span>
                          Price (₹)
                        </label>
                        <input 
                          type="number" 
                          name="hourlyPricing.twelveHours" 
                          className="form-input" 
                          value={formData.hourlyPricing.twelveHours || ''} 
                          onChange={handleChange} 
                          placeholder="Enter 12 hours price"
                          min="0"
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "2px solid #fbbf24",
                            fontSize: "14px",
                            fontWeight: "600"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <p style={{ 
                    fontSize: "13px", 
                    color: "#92400e", 
                    background: "rgba(255,255,255,0.7)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    margin: 0,
                    fontWeight: "500"
                  }}>
                    💡 Standard full-day price: ₹{formData.price || 0}
                  </p>
                </>
              )}
            </div>

            {/* Housekeeping Section */}
            <div className="form-section" style={{ 
              background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", 
              border: "2px solid #38bdf8",
              borderRadius: "12px", 
              padding: "20px"
            }}>
              <h4 style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                marginBottom: "16px", 
                color: "#075985",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>🧹 Housekeeping Status</h4>
              <div style={{ 
                background: "white", 
                padding: "16px", 
                borderRadius: "10px",
                border: "1px solid #38bdf8"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#075985" }}>
                      Status
                    </label>
                    <select 
                      name="housekeepingStatus" 
                      className="form-input" 
                      value={formData.housekeepingStatus} 
                      onChange={handleChange}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "2px solid #38bdf8",
                        fontSize: "14px",
                        fontWeight: "500"
                      }}
                    >
                      <option value="clean">✓ Clean</option>
                      <option value="dirty">✗ Dirty</option>
                      <option value="in-progress">⟳ In Progress</option>
                      <option value="inspected">✓✓ Inspected</option>
                      <option value="out-of-order">⚠ Out of Order</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", display: "block", color: "#075985" }}>
                      Cleaning Notes
                    </label>
                    <input 
                      type="text" 
                      name="cleaningNotes" 
                      className="form-input" 
                      value={formData.cleaningNotes || ''} 
                      onChange={handleChange} 
                      placeholder="Any special notes..."
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "2px solid #38bdf8",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ 
            padding: "16px 24px",
            borderTop: "2px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
          }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting} style={{
              padding: "10px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              border: "2px solid #cbd5e0",
              background: "white",
              color: "#4a5568",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{
              padding: "10px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              background: isSubmitting ? "#cbd5e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: isSubmitting ? "none" : "0 4px 6px rgba(102, 126, 234, 0.3)"
            }}>
              {isSubmitting ? "Saving..." : room ? "Update Room" : "Add Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteModal = ({ room, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onConfirm(room._id)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Room</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to delete <strong>{room.floor} - Room #{room.roomNumber || "N/A"}</strong>?</p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button className="btn" style={{ backgroundColor: "#dc2626", color: "white" }} onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

const Rooms = () => {
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [roomToDelete, setRoomToDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [roomBookings, setRoomBookings] = useState({})
  const [allBookings, setAllBookings] = useState([])
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    fetchBranches()
    fetchRooms()
    fetchAllBookings()
  }, [])

  // Fetch active bookings for all rooms (optimized to avoid rate limiting)
  const fetchRoomBookings = async (roomsList) => {
    try {
      // Fetch all bookings at once instead of one by one
      const res = await axios.get(`${API_BASE}/room-booking`)
      const allBookings = Array.isArray(res.data) ? res.data : []
      
      // Create a map of roomId -> active booking
      const bookingsMap = {}
      allBookings.forEach(booking => {
        // Only include active bookings (not cancelled or checked-out)
        if (booking.status !== 'cancelled' && booking.status !== 'checked-out') {
          const roomId = booking.roomId?._id || booking.roomId
          if (roomId) {
            bookingsMap[roomId] = booking
          }
        }
      })
      
      setRoomBookings(bookingsMap)
    } catch (err) {
      console.error("Error fetching room bookings:", err)
      // Don't show error to user, just log it
    }
  }

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Format date for Excel
  const formatDateExcel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Fetch all bookings for export
  const fetchAllBookings = async () => {
    try {
      console.log('🔄 Fetching all bookings for export...')
      const res = await axios.get(`${API_BASE}/room-booking`)
      const bookingsData = res.data || []
      console.log('📊 Fetched bookings for export:', bookingsData.length)
      setAllBookings(bookingsData)
    } catch (err) {
      console.error("Error fetching all bookings:", err)
      setError("Failed to load booking data for export")
      setTimeout(() => setError(""), 3000)
      setAllBookings([]) // Ensure it's always an array
    }
  }

  // Helper function to truncate text for Excel compatibility
  const truncateText = (text, maxLength = 32000) => {
    if (!text) return ''
    const str = String(text)
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
  }

  // Export to Excel
  const exportToExcel = () => {
    if (exportLoading) return
    
    setExportLoading(true)
    
    try {
      // Create export data
      let exportData = []
      
      if (allBookings.length === 0) {
        exportData = [{
          'S.No': 'No bookings found',
          'Booking Date': '',
          'Room Number': '',
          'Room Type': '',
          'Floor': '',
          'Branch': '',
          'Guest Name': '',
          'Guest Phone': '',
          'Guest Email': '',
          'Guest GSTIN': '',
          'Check-in Date': '',
          'Check-in Time': '',
          'Check-out Date': '',
          'Check-out Time': '',
          'Nights': '',
          'Base Amount (₹)': '',
          'GST Type': '',
          'CGST (₹)': '',
          'SGST (₹)': '',
          'IGST (₹)': '',
          'Total GST (₹)': '',
          'Total Amount (₹)': '',
          'Amount Paid (₹)': '',
          'Balance Due (₹)': '',
          'Status': '',
          'Payment Status': '',
        }]
      } else {
        exportData = allBookings.map((booking, index) => {
          const totalGst = (booking.cgst || 0) + (booking.sgst || 0) + (booking.igst || 0)
          const totalAmount = booking.totalPrice || 0
          const amountPaid = booking.amountPaid || 0
          const balanceDue = totalAmount - amountPaid
          
          return {
            'S.No': index + 1,
            'Booking Date': truncateText(formatDateExcel(booking.createdAt)),
            'Room Number': truncateText(booking.roomId?.roomNumber || 'N/A'),
            'Room Type': truncateText(booking.roomId?.roomType || 'N/A'),
            'Floor': truncateText(booking.roomId?.floor || 'N/A'),
            'Branch': truncateText(booking.branchId?.name || 'N/A'),
            'Guest Name': truncateText(booking.userName || ''),
            'Guest Phone': truncateText(booking.userPhone || ''),
            'Guest Email': truncateText(booking.userEmail || ''),
            'Guest GSTIN': truncateText(booking.guestGstNumber || ''),
            'Check-in Date': truncateText(formatDateExcel(booking.checkInDate)),
            'Check-in Time': truncateText(booking.checkInTime || ''),
            'Check-out Date': truncateText(formatDateExcel(booking.checkOutDate)),
            'Check-out Time': truncateText(booking.checkOutTime || ''),
            'Nights': booking.nights || 1,
            'Base Amount (₹)': (booking.baseAmount || 0).toFixed(2),
            'GST Type': truncateText(booking.gstType === 'gst' ? 'CGST+SGST (5%)' : booking.gstType === 'igst' ? 'IGST (5%)' : 'No GST'),
            'CGST (₹)': (booking.cgst || 0).toFixed(2),
            'SGST (₹)': (booking.sgst || 0).toFixed(2),
            'IGST (₹)': (booking.igst || 0).toFixed(2),
            'Total GST (₹)': totalGst.toFixed(2),
            'Total Amount (₹)': totalAmount.toFixed(2),
            'Amount Paid (₹)': amountPaid.toFixed(2),
            'Balance Due (₹)': balanceDue.toFixed(2),
            'Status': truncateText(booking.status?.toUpperCase() || ''),
            'Payment Status': truncateText(booking.paymentStatus?.toUpperCase() || ''),
          }
        })
      }

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Room Bookings")

      // Auto-size columns for better formatting
      const colWidths = [
        { wch: 5 },  // S.No
        { wch: 12 }, // Booking Date
        { wch: 12 }, // Room Number
        { wch: 12 }, // Room Type
        { wch: 12 }, // Floor
        { wch: 15 }, // Branch
        { wch: 20 }, // Guest Name
        { wch: 15 }, // Guest Phone
        { wch: 25 }, // Guest Email
        { wch: 18 }, // Guest GSTIN
        { wch: 12 }, // Check-in Date
        { wch: 12 }, // Check-in Time
        { wch: 12 }, // Check-out Date
        { wch: 12 }, // Check-out Time
        { wch: 8 },  // Nights
        { wch: 15 }, // Base Amount
        { wch: 15 }, // GST Type
        { wch: 12 }, // CGST
        { wch: 12 }, // SGST
        { wch: 12 }, // IGST
        { wch: 12 }, // Total GST
        { wch: 15 }, // Total Amount
        { wch: 15 }, // Amount Paid
        { wch: 15 }, // Balance Due
        { wch: 12 }, // Status
        { wch: 15 }, // Payment Status
      ]
      worksheet['!cols'] = colWidths

      // Generate filename with date
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
      const filename = allBookings.length === 0 ? `Room_Bookings_Empty_${today}.xlsx` : `Room_Bookings_${today}.xlsx`
      
      // Write and download the file
      XLSX.writeFile(workbook, filename)
      
      const message = allBookings.length === 0 ? 
        "Empty Excel template exported successfully!" : 
        `Excel exported successfully! (${allBookings.length} bookings)`
      
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(""), 3000)
      
    } catch (err) {
      console.error("Error exporting to Excel:", err)
      setError(`Failed to export Excel: ${err.message}`)
      setTimeout(() => setError(""), 5000)
    } finally {
      setExportLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_BASE}/branch`)
      setBranches(res.data)
    } catch (err) {
      console.error("Error fetching branches:", err)
    }
  }

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/room`)
      const roomsData = Array.isArray(res.data) ? res.data : []
      setRooms(roomsData)
      // Only fetch bookings if we have rooms
      if (roomsData.length > 0) {
        fetchRoomBookings(roomsData)
      }
    } catch (err) {
      setError("Failed to load rooms")
      setRooms([]) // Ensure rooms is always an array
    } finally {
      setLoading(false)
    }
  }

  const filteredRooms = Array.isArray(rooms) ? rooms.filter(room => {
    const matchesSearch = room.floor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.roomType?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBranch = !filterBranch || room.branchId?._id === filterBranch || room.branchId === filterBranch
    return matchesSearch && matchesBranch
  }).sort((a, b) => {
    // Sort by room number (101, 102, 103, etc.)
    const numA = parseInt(a.roomNumber) || 0
    const numB = parseInt(b.roomNumber) || 0
    return numA - numB
  }) : []

  const handleSaveRoom = async (formData) => {
    try {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
      let res
      if (currentRoom) {
        console.log("🔄 Updating room:", currentRoom._id)
        res = await axios.put(`${API_BASE}/room/${currentRoom._id}`, formData, config)
        console.log("✅ Backend response:", res.data)
        console.log("✅ Response hourlyPricing:", res.data.hourlyPricing)
        setRooms(Array.isArray(rooms) ? rooms.map(r => r._id === currentRoom._id ? res.data : r) : [res.data])
        setSuccessMessage("Room updated successfully")
      } else {
        console.log("🔄 Creating new room")
        res = await axios.post(`${API_BASE}/room`, formData, config)
        console.log("✅ Backend response:", res.data)
        console.log("✅ Response hourlyPricing:", res.data.hourlyPricing)
        setRooms(Array.isArray(rooms) ? [...rooms, res.data] : [res.data])
        setSuccessMessage("Room created successfully")
      }
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("❌ Error from backend:", err.response?.data || err.message)
      throw new Error(err.response?.data?.message || "Failed to save room")
    }
  }

  const handleDeleteRoom = async (roomId) => {
    try {
      await axios.delete(`${API_BASE}/room/${roomId}`)
      setRooms(Array.isArray(rooms) ? rooms.filter(r => r._id !== roomId) : [])
      setSuccessMessage("Room deleted successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      throw new Error("Failed to delete room")
    }
  }

  const getActiveAmenities = (amenities) => {
    if (!amenities) return []
    return AMENITIES_LIST.filter(a => amenities[a.key]).map(a => a.label)
  }

  return (
    <div className="rooms-page">
      {successMessage && (
        <div className="success-message">
          <Check size={16} /><span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}><span>×</span></button>
        </div>
      )}

      <div className="page-header">
        <h1>Rooms</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            className="btn" 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              exportToExcel()
            }}
            disabled={exportLoading}
            style={{ 
              backgroundColor: "#059669", 
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: exportLoading ? "not-allowed" : "pointer",
              opacity: exportLoading ? 0.6 : 1
            }}
            title={allBookings.length === 0 ? "Click to export empty template" : `Export ${allBookings.length} bookings to Excel`}
          >
            <Download size={16} />
            <span>{exportLoading ? "Exporting..." : `Export Excel (${allBookings.length})`}</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setCurrentRoom(null); setShowModal(true) }}>
            <Plus size={16} /><span>Add Room</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search rooms..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: "200px" }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ margin: "20px 0", padding: "10px 15px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}><p>Loading rooms...</p></div>
      ) : (
        <div className="grid-container">
          {filteredRooms.length > 0 ? (
            filteredRooms.map(room => (
              <div key={room._id} className="grid-item">
                <div className="grid-item-image-container" style={{ position: "relative" }}>
                  {room.images?.length > 0 ? (
                    <>
                      <img 
                        src={getImageUrl(room.images[0])} 
                        alt={room.floor} 
                        className="grid-item-image" 
                        onError={(e) => { 
                          console.log('Image failed to load:', e.target.src)
                          e.target.style.display = "none"
                          e.target.nextSibling.style.display = "flex"
                        }} 
                      />
                      <div style={{ display: "none", width: "100%", height: "200px", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", color: "#9ca3af" }}>
                        <Bed size={24} /><span style={{ marginTop: "8px", fontSize: "14px" }}>Image Not Found</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", width: "100%", height: "200px", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", color: "#9ca3af" }}>
                      <Bed size={24} /><span style={{ marginTop: "8px", fontSize: "14px" }}>No Image</span>
                    </div>
                  )}
                </div>
                <div className="grid-item-content">
                  <h3 className="grid-item-title">{room.floor} - Room #{room.roomNumber || "N/A"}</h3>
                  <p style={{ fontSize: "14px", color: "#6b7280" }}>{room.branchId?.name || "No Branch"}</p>
                  <p style={{ fontSize: "14px", color: "#6b7280" }}>Type: {room.roomType}</p>
                  <p style={{ fontSize: "16px", fontWeight: "600", color: "#059669" }}>₹{room.price} <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: "normal" }}>(Standard/Day)</span></p>
                  
                  {/* Hourly Pricing Display */}
                  {room.hourlyPricing?.enabled && (
                    <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #86efac" }}>
                      <p style={{ fontSize: "11px", fontWeight: "600", color: "#166534", marginBottom: "4px" }}>⏱️ Hourly Rates Available:</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px", fontSize: "10px", color: "#166534" }}>
                        {room.hourlyPricing.threeHours > 0 && <span>3hrs: ₹{room.hourlyPricing.threeHours}</span>}
                        {room.hourlyPricing.sixHours > 0 && <span>6hrs: ₹{room.hourlyPricing.sixHours}</span>}
                        {room.hourlyPricing.nineHours > 0 && <span>9hrs: ₹{room.hourlyPricing.nineHours}</span>}
                        {room.hourlyPricing.twelveHours > 0 && <span>12hrs: ₹{room.hourlyPricing.twelveHours}</span>}
                      </div>
                    </div>
                  )}

                  {/* Housekeeping Status Display */}
                  <div style={{ marginTop: "8px", padding: "6px 10px", backgroundColor: 
                    room.housekeepingStatus === 'clean' ? '#f0fdf4' : 
                    room.housekeepingStatus === 'dirty' ? '#fef2f2' : 
                    room.housekeepingStatus === 'in-progress' ? '#fef3c7' : 
                    room.housekeepingStatus === 'inspected' ? '#eff6ff' : '#fef2f2',
                    borderRadius: "6px", border: "1px solid " + (
                    room.housekeepingStatus === 'clean' ? '#86efac' : 
                    room.housekeepingStatus === 'dirty' ? '#fca5a5' : 
                    room.housekeepingStatus === 'in-progress' ? '#fcd34d' : 
                    room.housekeepingStatus === 'inspected' ? '#93c5fd' : '#fca5a5')
                  }}>
                    <p style={{ fontSize: "11px", fontWeight: "600", color: 
                      room.housekeepingStatus === 'clean' ? '#166534' : 
                      room.housekeepingStatus === 'dirty' ? '#991b1b' : 
                      room.housekeepingStatus === 'in-progress' ? '#92400e' : 
                      room.housekeepingStatus === 'inspected' ? '#1e40af' : '#991b1b'
                    }}>
                      🧹 {room.housekeepingStatus === 'clean' ? 'Clean' : 
                         room.housekeepingStatus === 'dirty' ? 'Needs Cleaning' : 
                         room.housekeepingStatus === 'in-progress' ? 'Cleaning in Progress' : 
                         room.housekeepingStatus === 'inspected' ? 'Inspected' : 'Out of Order'}
                    </p>
                    {room.lastCleanedAt && (
                      <p style={{ fontSize: "9px", color: "#6b7280", marginTop: "2px" }}>
                        Last cleaned: {new Date(room.lastCleanedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  
                  {/* Booking Status */}
                  {roomBookings[room._id] ? (
                    <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fef3c7", borderRadius: "6px", borderLeft: "3px solid #f59e0b" }}>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: "#92400e", marginBottom: "4px" }}>
                        🔒 BOOKED
                      </p>
                      <p style={{ fontSize: "12px", color: "#78350f" }}>
                        <strong>Guest:</strong> {roomBookings[room._id].userName}
                      </p>
                      <p style={{ fontSize: "11px", color: "#78350f" }}>
                        <strong>Phone:</strong> {roomBookings[room._id].userPhone || 'N/A'}
                      </p>
                      <p style={{ fontSize: "11px", color: "#78350f" }}>
                        <strong>Check-in:</strong> {formatDate(roomBookings[room._id].checkInDate)} at {roomBookings[room._id].checkInTime}
                      </p>
                      <p style={{ fontSize: "11px", color: "#78350f" }}>
                        <strong>Check-out:</strong> {formatDate(roomBookings[room._id].checkOutDate)} at {roomBookings[room._id].checkOutTime}
                      </p>
                      <p style={{ fontSize: "11px", color: "#78350f" }}>
                        <strong>Base:</strong> ₹{roomBookings[room._id].baseAmount?.toFixed(2)} ({roomBookings[room._id].nights} nights)
                      </p>
                      {roomBookings[room._id].gstType && roomBookings[room._id].gstType !== 'none' && (
                        <>
                          <p style={{ fontSize: "11px", color: "#78350f" }}>
                            <strong>GST:</strong> {roomBookings[room._id].gstType === 'gst' ? `CGST ₹${roomBookings[room._id].cgst?.toFixed(2)} + SGST ₹${roomBookings[room._id].sgst?.toFixed(2)}` : `IGST ₹${roomBookings[room._id].igst?.toFixed(2)}`}
                          </p>
                          {roomBookings[room._id].guestGstNumber && (
                            <p style={{ fontSize: "11px", color: "#78350f" }}>
                              <strong>Guest GSTIN:</strong> {roomBookings[room._id].guestGstNumber}
                            </p>
                          )}
                        </>
                      )}
                      <p style={{ fontSize: "11px", color: "#78350f", fontWeight: "600" }}>
                        <strong>Total:</strong> ₹{roomBookings[room._id].totalPrice?.toFixed(2)}
                      </p>
                      <p style={{ fontSize: "10px", color: "#92400e", marginTop: "4px" }}>
                        Status: <span style={{ textTransform: "uppercase", fontWeight: "600" }}>{roomBookings[room._id].status}</span>
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: "12px", color: room.isAvailable ? "#059669" : "#dc2626", marginTop: "8px" }}>
                      {room.isAvailable ? "✓ Available" : "Not Available"}
                    </p>
                  )}
                  
                  <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {getActiveAmenities(room.amenities).slice(0, 4).map(a => (
                      <span key={a} style={{ fontSize: "10px", padding: "2px 6px", backgroundColor: "#e5e7eb", borderRadius: "4px" }}>{a}</span>
                    ))}
                    {getActiveAmenities(room.amenities).length > 4 && (
                      <span style={{ fontSize: "10px", padding: "2px 6px", backgroundColor: "#e5e7eb", borderRadius: "4px" }}>+{getActiveAmenities(room.amenities).length - 4}</span>
                    )}
                  </div>
                </div>
                <div className="grid-item-actions" style={{ 
                  display: "flex", 
                  gap: "8px", 
                  padding: "12px",
                  borderTop: "1px solid #e5e7eb"
                }}>
                  <button 
                    className="btn-icon" 
                    onClick={() => { setCurrentRoom(room); setShowModal(true) }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#2563eb"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#3b82f6"}
                  >
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                  <button 
                    className="btn-icon-danger" 
                    onClick={() => { setRoomToDelete(room); setShowDeleteModal(true) }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = "#dc2626"}
                    onMouseLeave={(e) => e.target.style.backgroundColor = "#ef4444"}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px" }}>
              <Bed size={48} style={{ color: "#9ca3af", marginBottom: "16px" }} />
              <p style={{ color: "#6b7280" }}>No rooms found</p>
            </div>
          )}
        </div>
      )}

      {showModal && <RoomModal room={currentRoom} branches={branches} onClose={() => setShowModal(false)} onSave={handleSaveRoom} />}
      {showDeleteModal && roomToDelete && <DeleteModal room={roomToDelete} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteRoom} />}
    </div>
  )
}

export default Rooms
