import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiUpload, FiTrash2, FiEdit2, FiEye, FiEyeOff, FiImage, FiX } from 'react-icons/fi';
import './Gallery.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://billing.jagalikoota.com/api/v1/hotel';
const BASE_URL = API_URL.replace(/\/api\/v1\/hotel$/, '');

// Gallery images are stored as /uploads/gallery/xxx.jpg — prefix with the server origin
const resolveImageUrl = (image) => {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${BASE_URL}${image.startsWith('/') ? image : `/${image}`}`;
};

const Gallery = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload form
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
  });

  // Edit form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      // includeInactive=true so admin can see hidden images too
      const response = await axios.get(`${API_URL}/gallery/all`, {
        params: { includeInactive: true },
      });
      setImages(response.data.images || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
      alert('Error loading gallery images');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      alert('Please select at least one image');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('title', uploadForm.title || 'Gallery Image');
      formData.append('description', uploadForm.description);

      selectedFiles.forEach((file) => formData.append('images', file));

      const response = await axios.post(`${API_URL}/gallery/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert(response.data.message || 'Images uploaded successfully');
      closeUploadModal();
      fetchImages();
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(error.response?.data?.message || 'Error uploading images');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/gallery/${editItem._id}`, {
        title: editItem.title,
        description: editItem.description,
        isActive: editItem.isActive,
      });
      alert('Image updated successfully');
      setShowEditModal(false);
      setEditItem(null);
      fetchImages();
    } catch (error) {
      console.error('Error updating image:', error);
      alert(error.response?.data?.message || 'Error updating image');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await axios.put(`${API_URL}/gallery/${item._id}`, {
        isActive: !item.isActive,
      });
      fetchImages();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Error updating visibility');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;

    try {
      await axios.delete(`${API_URL}/gallery/${item._id}`);
      alert('Image deleted successfully');
      fetchImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image');
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadForm({ title: '', description: '' });
  };

  return (
    <div className="gallery-page">
      {/* Header */}
      <div className="gallery-header">
        <div>
          <h1 className="gallery-title">Gallery</h1>
          <p className="gallery-subtitle">
            Images uploaded here appear in the Member App gallery
          </p>
        </div>
        <button className="gallery-btn-primary" onClick={() => setShowUploadModal(true)}>
          <FiUpload /> Upload Images
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="gallery-empty">Loading gallery...</div>
      ) : images.length === 0 ? (
        <div className="gallery-empty">
          <FiImage size={48} />
          <p>No images yet</p>
          <span>Upload images to show them in the Member App</span>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((item) => (
            <div key={item._id} className={`gallery-card ${!item.isActive ? 'inactive' : ''}`}>
              <div className="gallery-card-image">
                <img src={resolveImageUrl(item.image)} alt={item.title} />
                {!item.isActive && <div className="gallery-hidden-badge">Hidden</div>}
              </div>
              <div className="gallery-card-body">
                <div className="gallery-card-title">{item.title}</div>
                {item.description ? (
                  <div className="gallery-card-desc">{item.description}</div>
                ) : null}
              </div>
              <div className="gallery-card-actions">
                <button
                  onClick={() => handleToggleActive(item)}
                  title={item.isActive ? 'Hide from app' : 'Show in app'}
                >
                  {item.isActive ? <FiEye /> : <FiEyeOff />}
                </button>
                <button
                  onClick={() => {
                    setEditItem({ ...item });
                    setShowEditModal(true);
                  }}
                  title="Edit details"
                >
                  <FiEdit2 />
                </button>
                <button
                  className="danger"
                  onClick={() => handleDelete(item)}
                  title="Delete image"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="gallery-modal-overlay" onClick={closeUploadModal}>
          <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-modal-header">
              <h2>Upload Images</h2>
              <button className="gallery-modal-close" onClick={closeUploadModal}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="gallery-form-group">
                <label>Images *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  required
                />
                {selectedFiles.length > 0 && (
                  <span className="gallery-file-hint">
                    {selectedFiles.length} file(s) selected
                  </span>
                )}
              </div>

              <div className="gallery-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g. Restaurant Interior"
                />
                {selectedFiles.length > 1 && (
                  <span className="gallery-file-hint">
                    Multiple files will be numbered automatically
                  </span>
                )}
              </div>

              <div className="gallery-form-group">
                <label>Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, description: e.target.value })
                  }
                  rows="2"
                  placeholder="Optional"
                />
              </div>

              <div className="gallery-modal-actions">
                <button type="button" className="gallery-btn-secondary" onClick={closeUploadModal}>
                  Cancel
                </button>
                <button type="submit" className="gallery-btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editItem && (
        <div className="gallery-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-modal-header">
              <h2>Edit Image</h2>
              <button className="gallery-modal-close" onClick={() => setShowEditModal(false)}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="gallery-edit-preview">
                <img src={resolveImageUrl(editItem.image)} alt={editItem.title} />
              </div>

              <div className="gallery-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editItem.title}
                  onChange={(e) => setEditItem({ ...editItem, title: e.target.value })}
                  required
                />
              </div>

              <div className="gallery-form-group">
                <label>Description</label>
                <textarea
                  value={editItem.description || ''}
                  onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                  rows="2"
                />
              </div>

              <div className="gallery-form-group gallery-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={editItem.isActive}
                    onChange={(e) => setEditItem({ ...editItem, isActive: e.target.checked })}
                  />
                  Visible in Member App
                </label>
              </div>

              <div className="gallery-modal-actions">
                <button
                  type="button"
                  className="gallery-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gallery-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
