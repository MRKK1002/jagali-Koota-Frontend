import { useState, useEffect } from "react"
import { Eye, Upload, Check, Search, CheckCircle, Download } from "lucide-react"

const QRUploads = () => {
  const [qrUploads, setQrUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUpload, setSelectedUpload] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [uploadingImage, setUploadingImage] = useState(null)
  const [downloadingImage, setDownloadingImage] = useState(null)

  useEffect(() => {
    fetchQRUploads()
  }, [currentPage, searchTerm])

  const fetchQRUploads = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        status: "qr_uploaded",
      })

      const response = await fetch(`${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission?${params}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // Handle different API response formats
        let uploadsData = [];
        if (Array.isArray(data.data)) {
          // New format: {success: true, count: X, data: [...]}
          uploadsData = data.data;
        } else if (Array.isArray(data.submissions)) {
          // Old format: {success: true, submissions: [...]}
          uploadsData = data.submissions;
        }
        
        setQrUploads(uploadsData)
        setTotalPages(data.totalPages || 1)
      } else {
        console.error("API returned error:", data.message)
        setQrUploads([]) // Ensure it's always an array
      }
    } catch (error) {
      console.error("Error fetching QR uploads:", error)
      setQrUploads([]) // Ensure it's always an array
      setTotalPages(1) // Set default pagination
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = async (imageUrl, filename, imageId) => {
    try {
      setDownloadingImage(imageId)

      // Fetch the image
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch image")
      }

      // Convert to blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename

      // Trigger download
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading image:", error)
      alert("Error downloading image. Please try again.")
    } finally {
      setDownloadingImage(null)
    }
  }

  const handleImageUpload = async (submissionId, imageFile) => {
    try {
      setUploadingImage(submissionId)

      const formData = new FormData()
      formData.append("paymentImage", imageFile)

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission/${submissionId}/upload-payment-image`,
        {
          method: "POST",
          body: formData,
        },
      )

      const data = await response.json()

      if (data.success) {
        fetchQRUploads()
        alert("Payment Successful! Payment image uploaded successfully!")
      } else {
        alert("Error uploading image: " + data.message)
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Error uploading image")
    } finally {
      setUploadingImage(null)
    }
  }

  const markAsCompleted = async (submissionId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"}/product-submission/${submissionId}/complete`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (data.success) {
        fetchQRUploads()
        alert("Order marked as completed!")
      } else {
        alert("Error completing order: " + data.message)
      }
    } catch (error) {
      console.error("Error completing order:", error)
      alert("Error completing order")
    }
  }

  const viewUpload = (upload) => {
    setSelectedUpload(upload)
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

  const getPaymentStatusBadge = (submission) => {
    if (submission.paymentStatus === "successful" && submission.paymentImageUri) {
      return (
        <span className="payment-success-badge">
          <CheckCircle size={16} />
          Payment Successful
        </span>
      )
    }
    return <span className="payment-pending-badge">Payment Pending</span>
  }

  return (
    <div>
      <div className="page-header">
        <h1>QR Code Uploads</h1>
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
      </div>

      <div className="data-card">
       <table className="data-table">
  <thead>
    <tr>
      <th>Submission ID</th>
      <th>User Phone</th>
      <th>User Name</th>
      <th>Total Amount</th>
      <th>QR Upload Date</th>
      <th>QR Image</th>
      <th>Payment Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {loading ? (
      <tr>
        <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
          Loading QR uploads...
        </td>
      </tr>
    ) : qrUploads.length === 0 ? (
      <tr>
        <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
          No QR uploads found
        </td>
      </tr>
    ) : (
      qrUploads.map((upload) => (
        <tr key={upload._id}>
          <td>{upload.submissionId}</td>
          <td>{upload.userPhone}</td>
          <td>{upload.userId?.name || "N/A"}</td>
          <td>₹{upload.totalAmount}</td>
          <td>{formatDate(upload.updatedAt)}</td>
          <td>
            {upload.qrCodeUri ? (
              <img
                src={`${upload.qrCodeUri}`}
                alt="QR Code"
                className="thumbnail-image"
                style={{ cursor: "pointer", maxWidth: "50px", maxHeight: "50px" }}
                onClick={() => window.open(`${upload.qrCodeUri}`, "_blank")}
              />
            ) : (
              <div className="image-placeholder">No QR</div>
            )}
          </td>
          <td>{getPaymentStatusBadge(upload)}</td>
          <td>
            <div className="action-buttons">
              <button className="action-btn view" onClick={() => viewUpload(upload)}>
                <Eye size={14} />
              </button>
              {!upload.paymentImageUri && (
                <label className="action-btn edit" style={{ cursor: "pointer" }}>
                  <Upload size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImageUpload(upload._id, e.target.files[0])
                      }
                    }}
                    disabled={uploadingImage === upload._id}
                  />
                </label>
              )}
              {upload.paymentImageUri && upload.status !== "completed" && (
                <button className="action-btn view" onClick={() => markAsCompleted(upload._id)}>
                  <Check size={14} />
                </button>
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

      {/* Upload Details Modal */}
      {showModal && selectedUpload && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>QR Upload Details</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="order-detail-row">
                  <span className="order-detail-label">Submission ID:</span>
                  <span className="order-detail-value">#{selectedUpload.submissionId}</span>
                </div>
                <div className="order-detail-row">
                  <span className="order-detail-label">User Phone:</span>
                  <span className="order-detail-value">{selectedUpload.userPhone}</span>
                </div>
                <div className="order-detail-row">
                  <span className="order-detail-label">Total Amount:</span>
                  <span className="order-detail-value">₹{selectedUpload.totalAmount}</span>
                </div>
                <div className="order-detail-row">
                  <span className="order-detail-label">QR Upload Date:</span>
                  <span className="order-detail-value">{formatDate(selectedUpload.updatedAt)}</span>
                </div>
                <div className="order-detail-row">
                  <span className="order-detail-label">Payment Status:</span>
                  <span className="order-detail-value">{getPaymentStatusBadge(selectedUpload)}</span>
                </div>
              </div>

              {selectedUpload.qrCodeUri && (
                <div style={{ marginTop: "20px" }}>
                  <div className="modal-image-header">
                    <h4>QR Code Image</h4>
                   {/*  <button
                      className="download-btn-large"
                      onClick={() =>
                        downloadImage(
                          `https://billing.jagalikoota.com/api/v1/${selectedUpload.qrCodeUri}`,
                          `QR_${selectedUpload.submissionId}.jpg`,
                          `modal_qr_${selectedUpload._id}`,
                        )
                      }
                      disabled={downloadingImage === `modal_qr_${selectedUpload._id}`}
                    >
                      {downloadingImage === `modal_qr_${selectedUpload._id}` ? (
                        <>
                          <div className="spinner"></div>
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Download QR
                        </>
                      )}
                    </button> */}
                  </div>
                  <img
                    src={`${selectedUpload.qrCodeUri}`}
                    alt="QR Code"
                    style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
                  />
                </div>
              )}

              {selectedUpload.paymentImageUri && (
                <div style={{ marginTop: "20px" }}>
                  <div className="modal-image-header">
                    <h4>Payment Image</h4>
                    <button
                      className="download-btn-large"
                      onClick={() =>
                        downloadImage(
                          `https://billing.jagalikoota.com/api/v1/${selectedUpload.paymentImageUri}`,
                          `Payment_${selectedUpload.submissionId}.jpg`,
                          `modal_payment_${selectedUpload._id}`,
                        )
                      }
                      disabled={downloadingImage === `modal_payment_${selectedUpload._id}`}
                    >
                      {downloadingImage === `modal_payment_${selectedUpload._id}` ? (
                        <>
                          <div className="spinner"></div>
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Download Payment
                        </>
                      )}
                    </button>
                  </div>
                  <img
                    src={`${selectedUpload.paymentImageUri}`}
                    alt="Payment"
                    style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
                  />
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#d4edda",
                      borderRadius: "5px",
                      color: "#155724",
                    }}
                  >
                    <CheckCircle size={16} style={{ marginRight: "8px" }} />
                    Payment Successful - Image uploaded on{" "}
                    {formatDate(selectedUpload.paymentUploadedAt || selectedUpload.updatedAt)}
                  </div>
                </div>
              )}

              <div className="order-items-section">
                <h4>Products</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUpload.products.map((product, index) => (
                      <tr key={index}>
                        <td>{product.name}</td>
                        <td>₹{product.price}</td>
                        <td>{product.quantity}</td>
                        <td>{product.unit}</td>
                        <td>₹{(product.price * product.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              {!selectedUpload.paymentImageUri && (
                <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                  <Upload size={16} />
                  Upload Payment Image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImageUpload(selectedUpload._id, e.target.files[0])
                        setShowModal(false)
                      }
                    }}
                  />
                </label>
              )}
              {selectedUpload.paymentImageUri && selectedUpload.status !== "completed" && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    markAsCompleted(selectedUpload._id)
                    setShowModal(false)
                  }}
                >
                  <Check size={16} />
                  Mark as Completed
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .payment-success-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background-color: #d4edda;
          color: #155724;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .payment-pending-badge {
          display: inline-flex;
          align-items: center;
          background-color: #fff3cd;
          color: #856404;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .thumbnail-image {
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        .image-placeholder {
          padding: 8px;
          background-color: #f8f9fa;
          border-radius: 4px;
          text-align: center;
          font-size: 12px;
          color: #6c757d;
        }

        .download-btn-large {
          background: #ff8c00;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          margin-bottom: 10px;
        }

        .download-btn-large:hover:not(:disabled) {
          background: #e67e00;
        }

        .download-btn-large:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .modal-image-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .modal-image-header h4 {
          margin: 0;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #ffffff;
          border-top: 2px solid transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default QRUploads
