import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Minus, 
  Edit3, 
  AlertTriangle,
  Package,
  Store,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';
import './Inventory.css';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newStock, setNewStock] = useState(0);
  const [bulkUpdateMode, setBulkUpdateMode] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    outOfStock: 0,
    lowStock: 0,
    available: 0
  });

  // API Base URL
  const API_BASE_URL = 'https://billing.jagalikoota.com/api/v1/hotel';

  useEffect(() => {
    fetchBranches();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchInventory();
    }
  }, [selectedBranch, selectedCategory, statusFilter]);

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/branch`);
      const data = await response.json();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/category`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/inventory/${selectedBranch}`;
      const params = new URLSearchParams();
      
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (statusFilter) params.append('status', statusFilter);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setInventory(data.data);
        
        // Calculate stats
        const totalProducts = data.data.length;
        const outOfStock = data.data.filter(item => item.stock <= 0).length;
        const lowStock = data.data.filter(item => item.stock > 0 && item.stock <= item.lowStockAlert).length;
        const available = data.data.filter(item => item.stock > item.lowStockAlert).length;
        
        setStats({
          totalProducts,
          outOfStock,
          lowStock,
          available
        });
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  };

  const handleUpdateStock = async (productId, stockChange) => {
    try {
      const product = inventory.find(p => p._id === productId);
      const newStock = product.stock + stockChange;
      
      if (newStock < 0) {
        alert('Stock cannot be negative');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/inventory/update/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: newStock,
          changeType: stockChange > 0 ? 'manual' : 'manual',
          notes: stockChange > 0 ? 'Stock increased manually' : 'Stock decreased manually'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchInventory();
        alert('Stock updated successfully');
      } else {
        alert('Error updating stock');
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Error updating stock');
    }
  };

  const handleBulkUpdate = async () => {
    try {
      const updates = Object.entries(bulkUpdates).map(([productId, stock]) => ({
        productId,
        stock: parseInt(stock),
        changeType: 'bulk_update',
        notes: 'Bulk stock update'
      }));

      const response = await fetch(`${API_BASE_URL}/inventory/bulk-update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: updates }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchInventory();
        setBulkUpdateMode(false);
        setBulkUpdates({});
        alert(`Updated ${data.data.updated.length} products successfully`);
      } else {
        alert('Error updating stock');
      }
    } catch (error) {
      console.error('Error bulk updating stock:', error);
      alert('Error updating stock');
    }
  };

  const exportInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/export/${selectedBranch}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${selectedBranch}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting inventory:', error);
      alert('Error exporting inventory');
    }
  };

  const getStatusColor = (stock, lowStockAlert) => {
    if (stock <= 0) return 'status-out-of-stock';
    if (stock <= lowStockAlert) return 'status-low-stock';
    return 'status-available';
  };

  const getStatusText = (stock, lowStockAlert) => {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= lowStockAlert) return 'Low Stock';
    return 'Available';
  };

  const filteredInventory = inventory.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="inventory-container">
      {/* Header Section */}
      <div className="inventory-header">
        <div className="inventory-header-content">
          <div className="inventory-title-section">
            <h1 className="inventory-title">
              <div className="inventory-title-icon">
                <Package size={32} />
              </div>
              Inventory Management
            </h1>
            <p className="inventory-subtitle">Manage product stock across all branches with real-time updates</p>
          </div>
          
          <div className="inventory-actions">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="action-button"
            >
              <RefreshCw className={`refresh-icon ${refreshing ? 'spinning' : ''}`} size={20} />
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="action-button"
            >
              <Filter className="filter-icon" size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedBranch && (
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-card-content">
              <div className="stat-info">
                <h3>Total Products</h3>
                <p>{stats.totalProducts}</p>
              </div>
              <div className="stat-icon">
                <Package size={24} />
              </div>
            </div>
          </div>
          
          <div className="stat-card stat-card-green">
            <div className="stat-card-content">
              <div className="stat-info">
                <h3>Available</h3>
                <p>{stats.available}</p>
              </div>
              <div className="stat-icon">
                <CheckCircle size={24} />
              </div>
            </div>
          </div>
          
          <div className="stat-card stat-card-yellow">
            <div className="stat-card-content">
              <div className="stat-info">
                <h3>Low Stock</h3>
                <p>{stats.lowStock}</p>
              </div>
              <div className="stat-icon">
                <AlertTriangle size={24} />
              </div>
            </div>
          </div>
          
          <div className="stat-card stat-card-red">
            <div className="stat-card-content">
              <div className="stat-info">
                <h3>Out of Stock</h3>
                <p>{stats.outOfStock}</p>
              </div>
              <div className="stat-icon">
                <XCircle size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Filters */}
      <div className="filters-card">
        <div className="filters-header">
          <h3 className="filters-title">
            <Filter size={20} />
            Filters & Search
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="filters-toggle"
          >
            {showFilters ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {showFilters && (
          <div className="filters-content">
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">Branch</label>
                <div className="filter-input-container">
                  <Store className="input-icon" size={18} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="filter-select"
                    style={{ paddingLeft: '40px' }}
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch._id} value={branch._id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category._id} value={category._id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Status</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="low_stock">Low Stock</option>
                </select>
              </div>
            </div>

            <div className="search-row">
              <div className="search-container">
                <div className="filter-input-container">
                  <Search className="input-icon" size={20} />
                  <input
                    type="text"
                    placeholder="Search products by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="filter-input search-input"
                  />
                </div>
              </div>
              
              <button
                onClick={exportInventory}
                disabled={!selectedBranch}
                className="export-button"
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>

            <div className="filters-footer">
              <button
                onClick={() => setBulkUpdateMode(!bulkUpdateMode)}
                className={`bulk-update-button ${bulkUpdateMode ? 'active' : 'inactive'}`}
              >
                <Zap size={18} />
                {bulkUpdateMode ? 'Exit Bulk Update' : 'Bulk Update Mode'}
              </button>
              
              <div className="results-count">
                Showing {filteredInventory.length} products
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Inventory Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-title">
            <BarChart3 size={20} />
            Inventory Overview
          </div>
          {bulkUpdateMode && (
            <button
              onClick={handleBulkUpdate}
              className="bulk-save-button"
            >
              <CheckCircle size={18} />
              Save Bulk Updates
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner">
              <div className="loading-spinner-inner"></div>
            </div>
            <p className="loading-text">Loading inventory...</p>
            <p className="loading-subtext">Please wait while we fetch the latest data</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">
              <Package size={32} />
            </div>
            {!selectedBranch ? (
              <>
                <p className="empty-text">Welcome to Inventory Management</p>
                <p className="empty-subtext">Please select a branch from the filters above to view inventory</p>
              </>
            ) : (
              <>
                <p className="empty-text">No products found</p>
                <p className="empty-subtext">Try adjusting your filters or select a different branch</p>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead className="table-header-row">
                <tr>
                  <th className="table-header-cell">Product Details</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Stock Level</th>
                  <th className="table-header-cell">Alert Threshold</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Price</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredInventory.map((product, index) => (
                  <tr key={product._id} className="table-row">
                    <td className="table-cell">
                      <div className="product-cell">
                        <img
                          className="product-image"
                          src={product.image || '/placeholder-image.jpg'}
                          alt={product.name}
                        />
                        <div className="product-info">
                          <div className="product-name">{product.name}</div>
                          <div className="product-description">
                            {product.description || 'No description available'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="category-badge">
                        {product.categoryId?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {bulkUpdateMode ? (
                        <div className="stock-cell">
                          <input
                            type="number"
                            min="0"
                            value={bulkUpdates[product._id] || product.stock}
                            onChange={(e) => setBulkUpdates(prev => ({
                              ...prev,
                              [product._id]: e.target.value
                            }))}
                            className="stock-input"
                          />
                          <span className="stock-units">units</span>
                        </div>
                      ) : (
                        <div className="stock-cell">
                          <span className="stock-number">{product.stock}</span>
                          <span className="stock-units">units</span>
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="alert-threshold">
                        <AlertTriangle size={16} />
                        <span className="threshold-value">{product.lowStockAlert}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`status-badge ${getStatusColor(product.stock, product.lowStockAlert)}`}>
                        {getStatusText(product.stock, product.lowStockAlert) === 'Available' && <CheckCircle size={12} />}
                        {getStatusText(product.stock, product.lowStockAlert) === 'Low Stock' && <AlertTriangle size={12} />}
                        {getStatusText(product.stock, product.lowStockAlert) === 'Out of Stock' && <XCircle size={12} />}
                        {getStatusText(product.stock, product.lowStockAlert)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="price-text">₹{product.price}</span>
                    </td>
                    <td className="table-cell">
                      {!bulkUpdateMode && (
                        <div className="actions-cell">
                          <button
                            onClick={() => handleUpdateStock(product._id, 1)}
                            className="action-icon-button increase-button"
                            title="Increase Stock"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateStock(product._id, -1)}
                            className="action-icon-button decrease-button"
                            title="Decrease Stock"
                          >
                            <Minus size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setNewStock(product.stock);
                              setShowUpdateModal(true);
                            }}
                            className="action-icon-button edit-button"
                            title="Edit Stock"
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enhanced Update Stock Modal */}
      {showUpdateModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                <div className="modal-title-icon">
                  <Edit3 size={20} />
                </div>
                Update Stock
              </h3>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="modal-close-button"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="modal-form">
              <div className="product-preview">
                <img
                  className="product-preview-image"
                  src={selectedProduct.image || '/placeholder-image.jpg'}
                  alt={selectedProduct.name}
                />
                <div className="product-preview-info">
                  <h4>{selectedProduct.name}</h4>
                  <p>{selectedProduct.categoryId?.name || 'N/A'}</p>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <div className="current-stock-display">
                  <Package className="current-stock-icon" size={18} />
                  <span className="current-stock-value">{selectedProduct.stock}</span>
                  <span className="current-stock-units">units</span>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">New Stock Level</label>
                <input
                  type="number"
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                  className="form-input"
                  placeholder="Enter new stock level"
                />
              </div>
              
              {newStock !== selectedProduct.stock && (
                <div className="stock-change-indicator">
                  <div className="stock-change-text">
                    <TrendingUp className="stock-change-icon" size={16} />
                    {newStock > selectedProduct.stock ? 'Increasing' : 'Decreasing'} by {Math.abs(newStock - selectedProduct.stock)} units
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="modal-button cancel"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/inventory/update/${selectedProduct._id}`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        stock: newStock,
                        changeType: 'manual',
                        notes: 'Stock updated manually'
                      }),
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                      fetchInventory();
                      setShowUpdateModal(false);
                      alert('Stock updated successfully');
                    } else {
                      alert('Error updating stock');
                    }
                  } catch (error) {
                    console.error('Error updating stock:', error);
                    alert('Error updating stock');
                  }
                }}
                className="modal-button submit"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;