import { useState, useEffect } from "react"
import { Eye, Check, X, Search, ZoomIn, ZoomOut, RotateCw } from "lucide-react"

const ProductSubmissions = () => {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [currentImage, setCurrentImage] = useState(null)
  const [imageScale, setImageScale] = useState(1)
  const [imageRotation, setImageRotation] = useState(0)

  useEffect(() => {
    fetchSubmissions()
  }, [currentPage, statusFilter, searchTerm])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        status: statusFilter !== "all" ? statusFilter : "",
        search: searchTerm,
      })

      const response = await fetch(`${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission?${params}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Handle different response formats
      if (data.success && data.submissions) {
        // Current format: {success: true, submissions: [...]}
        setSubmissions(data.submissions)
        setTotalPages(data.totalPages)
      } else if (data.success && Array.isArray(data.data)) {
        // New format: {success: true, count: X, data: [...]}
        setSubmissions(data.data)
        setTotalPages(Math.ceil(data.count / 10)) // Assuming 10 items per page
      } else if (data.message) {
        // Placeholder response
        console.log("⚠️ Server returning placeholder response:", data.message)
        setSubmissions([])
        setTotalPages(1)
      } else {
       /*  console.error("API returned error:", data.message) */
        setSubmissions([])
        setTotalPages(1)
      }
    } catch (error) {
   /*    console.error("Error fetching submissions:", error) */
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (submissionId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission/${submissionId}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (data.success) {
        fetchSubmissions()
        alert("Submission approved successfully!")
      } else {
        alert("Error approving submission: " + data.message)
      }
    } catch (error) {
      console.error("Error approving submission:", error)
      alert("Error approving submission")
    }
  }

  const handleReject = async (submissionId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission/${submissionId}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rejectionReason: "Rejected by admin",
        }),
      })

      const data = await response.json()

      if (data.success) {
        fetchSubmissions()
        alert("Submission rejected successfully!")
      } else {
        alert("Error rejecting submission: " + data.message)
      }
    } catch (error) {
      console.error("Error rejecting submission:", error)
      alert("Error rejecting submission")
    }
  }

  const viewSubmission = (submission) => {
    console.log("Selected submission:", submission)
    setSelectedSubmission(submission)
    setShowModal(true)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatStatus = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
  }

  const getImageUrl = (imageUri) => {
    if (!imageUri) return null

    // If it's already a complete URL (starts with http/https), use it directly
    if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
      return imageUri
    }

    // Otherwise, prepend the API base URL
    return `https://billing.jagalikoota.com/api/v1/${imageUri}`
  }

  const openImageViewer = (imageUri, imageType) => {
    setCurrentImage({
      uri: getImageUrl(imageUri),
      type: imageType,
    })
    setImageScale(1)
    setImageRotation(0)
    setShowImageViewer(true)
  }

  const closeImageViewer = () => {
    setShowImageViewer(false)
    setCurrentImage(null)
    setImageScale(1)
    setImageRotation(0)
  }

  const zoomIn = () => {
    setImageScale((prev) => Math.min(prev + 0.25, 3))
  }

  const zoomOut = () => {
    setImageScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const rotateImage = () => {
    setImageRotation((prev) => (prev + 90) % 360)
  }

  const hasImages = (submission) => {
    return submission.qrCodeUri || submission.paymentImageUri || submission.billImageUri
  }

  return (
    <div>
      <div className="page-header">
        <h1>Product Submissions</h1>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search by user phone or submission ID..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="submitted">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="qr_uploaded">QR Uploaded</option>
            <option value="payment_uploaded">Payment Uploaded</option>
            <option value="bill_uploaded">Bill Uploaded</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Submission ID</th>
              <th>User Phone</th>
              <th>User Name</th>
              <th>Products</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
                  Loading submissions...
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
                  No submissions found
                </td>
              </tr>
            ) : (
              submissions.map((submission) => (
                <tr key={submission._id}>
                  <td>{submission.submissionId}</td>
                  <td>{submission.userPhone}</td>
                  <td>{submission.userId?.name || "N/A"}</td>
                  <td>{submission.products.length} items</td>
                  <td>₹{submission.totalAmount}</td>
                  <td>{formatStatus(submission.status)}</td>
                  <td>{formatDate(submission.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view" onClick={() => viewSubmission(submission)}>
                        <Eye size={14} />
                      </button>
                      {submission.status === "submitted" && (
                        <>
                          <button className="action-btn edit" onClick={() => handleApprove(submission._id)}>
                            <Check size={14} />
                          </button>
                          <button className="action-btn delete" onClick={() => handleReject(submission._id)}>
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <div className="pagination-pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`pagination-page ${currentPage === page ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Submission Details Modal */}
      {showModal && selectedSubmission && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submission Details - {selectedSubmission.submissionId}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="submission-info-grid">
                <div className="info-card">
                  <h4>Basic Information</h4>
                  <div className="order-details">
                    <div className="order-detail-row">
                      <span className="order-detail-label">Submission ID:</span>
                      <span className="order-detail-value">{selectedSubmission.submissionId}</span>
                    </div>
                    <div className="order-detail-row">
                      <span className="order-detail-label">User Phone:</span>
                      <span className="order-detail-value">{selectedSubmission.userPhone}</span>
                    </div>
                    <div className="order-detail-row">
                      <span className="order-detail-label">User Name:</span>
                      <span className="order-detail-value">{selectedSubmission.userId?.name || "N/A"}</span>
                    </div>
                    <div className="order-detail-row">
                      <span className="order-detail-label">Status:</span>
                      <span>{formatStatus(selectedSubmission.status)}</span>
                    </div>
                    <div className="order-detail-row">
                      <span className="order-detail-label">Total Amount:</span>
                      <span className="order-detail-value amount">₹{selectedSubmission.totalAmount}</span>
                    </div>
                    <div className="order-detail-row">
                      <span className="order-detail-label">Date:</span>
                      <span className="order-detail-value">{formatDate(selectedSubmission.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="info-card">
                  <h4>Products ({selectedSubmission.products.length} items)</h4>
                  <div className="products-list">
                    {selectedSubmission.products.map((product, index) => (
                      <div key={index} className="product-item">
                        <div className="product-name">{product.name}</div>
                        <div className="product-details">
                          <span>
                            ₹{product.price} × {product.quantity} {product.unit}
                          </span>
                          <span className="product-total">₹{(product.price * product.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {hasImages(selectedSubmission) && (
                <div className="images-section">
                  <h4>Uploaded Images</h4>
                  <div className="images-grid">
                    {selectedSubmission.qrCodeUri && (
                      <div className="image-item">
                        <div className="image-header">
                          <h5>QR Code</h5>
                        </div>
                        <div className="image-container">
                          <img
                            src={getImageUrl(selectedSubmission.qrCodeUri) || "/placeholder.svg"}
                            alt="QR Code"
                            className="modal-image"
                            onClick={() => openImageViewer(selectedSubmission.qrCodeUri, "QR Code")}
                          />
                          <div className="image-overlay">
                            <button
                              className="view-full-btn"
                              onClick={() => openImageViewer(selectedSubmission.qrCodeUri, "QR Code")}
                            >
                              View Full Size
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedSubmission.paymentImageUri && (
                      <div className="image-item">
                        <div className="image-header">
                          <h5>Payment Confirmation</h5>
                        </div>
                        <div className="image-container">
                          <img
                            src={getImageUrl(selectedSubmission.paymentImageUri) || "/placeholder.svg"}
                            alt="Payment"
                            className="modal-image"
                            onClick={() => openImageViewer(selectedSubmission.paymentImageUri, "Payment Confirmation")}
                          />
                          <div className="image-overlay">
                            <button
                              className="view-full-btn"
                              onClick={() =>
                                openImageViewer(selectedSubmission.paymentImageUri, "Payment Confirmation")
                              }
                            >
                              View Full Size
                            </button>
                          </div>
                        </div>
                        {selectedSubmission.paymentUploadedAt && (
                          <div className="image-date">Uploaded: {formatDate(selectedSubmission.paymentUploadedAt)}</div>
                        )}
                      </div>
                    )}

                    {selectedSubmission.billImageUri && (
                      <div className="image-item">
                        <div className="image-header">
                          <h5>Bill Image</h5>
                        </div>
                        <div className="image-container">
                          <img
                            src={getImageUrl(selectedSubmission.billImageUri) || "/placeholder.svg"}
                            alt="Bill"
                            className="modal-image"
                            onClick={() => openImageViewer(selectedSubmission.billImageUri, "Bill Image")}
                            onError={(e) => {
                              console.log("Bill image failed to load:", selectedSubmission.billImageUri)
                              e.target.style.display = "none"
                            }}
                          />
                          <div className="image-overlay">
                            <button
                              className="view-full-btn"
                              onClick={() => openImageViewer(selectedSubmission.billImageUri, "Bill Image")}
                            >
                              View Full Size
                            </button>
                          </div>
                        </div>
                        {selectedSubmission.billUploadedAt && (
                          <div className="image-date">Uploaded: {formatDate(selectedSubmission.billUploadedAt)}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedSubmission.status === "submitted" && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      handleApprove(selectedSubmission._id)
                      setShowModal(false)
                    }}
                  >
                    <Check size={16} />
                    Approve
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      handleReject(selectedSubmission._id)
                      setShowModal(false)
                    }}
                  >
                    <X size={16} />
                    Reject
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && currentImage && (
        <div className="image-viewer-overlay" onClick={closeImageViewer}>
          <div className="image-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-viewer-header">
              <h3>{currentImage.type}</h3>
              <div className="image-viewer-controls">
                <button className="control-btn" onClick={zoomOut} title="Zoom Out">
                  <ZoomOut size={20} />
                </button>
                <span className="zoom-level">{Math.round(imageScale * 100)}%</span>
                <button className="control-btn" onClick={zoomIn} title="Zoom In">
                  <ZoomIn size={20} />
                </button>
                <button className="control-btn" onClick={rotateImage} title="Rotate">
                  <RotateCw size={20} />
                </button>
                <button className="control-btn close-btn" onClick={closeImageViewer}>
                  ×
                </button>
              </div>
            </div>
            <div className="image-viewer-content">
              <img
                src={currentImage.uri || "/placeholder.svg"}
                alt={currentImage.type}
                className="viewer-image"
                style={{
                  transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  transition: "transform 0.3s ease",
                }}
                onError={(e) => {
                  console.error("Image failed to load:", currentImage.uri)
                  e.target.src = "/placeholder.svg?height=400&width=400"
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .large-modal {
          width: 90%;
          max-width: 1200px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .submission-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .info-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .info-card h4 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
          border-bottom: 2px solid #007bff;
          padding-bottom: 8px;
        }

        .products-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .product-item {
          padding: 10px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .product-item:last-child {
          border-bottom: none;
        }

        .product-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .product-details {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #666;
        }

        .product-total {
          font-weight: 600;
          color: #28a745;
        }

        .amount {
          font-weight: 700;
          color: #28a745;
          font-size: 18px;
        }

        .images-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e9ecef;
        }

        .images-section h4 {
          margin: 0 0 20px 0;
          color: #333;
          font-size: 18px;
          font-weight: 600;
        }

        .images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 25px;
        }

        .image-item {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .image-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .image-header {
          padding: 15px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .image-header h5 {
          margin: 0;
          color: #333;
          font-weight: 600;
          font-size: 16px;
        }

        .image-container {
          position: relative;
          height: 250px;
          overflow: hidden;
        }

        .modal-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: pointer;
          transition: transform 0.3s;
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .image-container:hover .image-overlay {
          opacity: 1;
        }

        .image-container:hover .modal-image {
          transform: scale(1.05);
        }

        .view-full-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .view-full-btn:hover {
          background: #0056b3;
        }

        .image-date {
          padding: 10px 15px;
          font-size: 12px;
          color: #666;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
        }

        /* Image Viewer Styles */
        .image-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-viewer-modal {
          width: 95%;
          height: 95%;
          background: white;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .image-viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .image-viewer-header h3 {
          margin: 0;
          color: #333;
          font-size: 18px;
          font-weight: 600;
        }

        .image-viewer-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .control-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .control-btn:hover {
          background: #0056b3;
        }

        .close-btn {
          background: #dc3545;
          font-size: 20px;
          font-weight: bold;
          padding: 8px 12px;
        }

        .close-btn:hover {
          background: #c82333;
        }

        .zoom-level {
          color: #666;
          font-size: 14px;
          font-weight: 600;
          min-width: 50px;
          text-align: center;
        }

        .image-viewer-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #f8f9fa;
        }

        .viewer-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          cursor: grab;
        }

        .viewer-image:active {
          cursor: grabbing;
        }

        @media (max-width: 768px) {
          .large-modal {
            width: 95%;
            margin: 20px auto;
          }

          .submission-info-grid {
            grid-template-columns: 1fr;
          }

          .images-grid {
            grid-template-columns: 1fr;
          }

          .image-viewer-controls {
            flex-wrap: wrap;
            gap: 5px;
          }

          .control-btn {
            padding: 6px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  )
}

export default ProductSubmissions
