import React, { useState, useEffect } from 'react';
import './MealOfTheDay.css';

const MealOfTheDay = () => {
  const [meals, setMeals] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'add', 'edit', 'view'
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [formData, setFormData] = useState({
    productId: '',
    description: '',
    image: null,
    isActive: true
  });

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/branch');
        const data = await response.json();
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranch(data[0]);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Fetch products function
  const fetchProducts = async () => {
    try {
      const apiUrl = `https://billing.jagalikoota.com/api/v1/hotel/menu?t=${Date.now()}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Fetch meals of the day
  const fetchMealsOfTheDay = async () => {
    if (!selectedBranch || !selectedBranch._id) return;
    
    try {
      console.log('🔄 Fetching meals for branch:', selectedBranch._id);
      const apiUrl = `https://billing.jagalikoota.com/api/v1/hotel/meal-of-the-day/branch/${selectedBranch._id}`;
      console.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        console.log('✅ Setting meals:', data.data.length, 'items');
        setMeals(data.data);
      } else {
        console.error('❌ Invalid API response:', data);
        setMeals([]);
      }
    } catch (error) {
      console.error('❌ Error fetching meals:', error);
      setMeals([]);
    }
  };

  // Fetch meals when branch changes
  useEffect(() => {
    if (selectedBranch && selectedBranch._id) {
      fetchMealsOfTheDay();
    }
  }, [selectedBranch]);

  // Handle save meal
  const handleSaveMeal = async (e) => {
    e.preventDefault();
    
    if (!formData.productId || !selectedBranch) {
      alert('Please select a product and branch');
      return;
    }

    try {
      const submitData = {
        productId: formData.productId,
        branchId: selectedBranch._id,
        description: formData.description || '',
        isActive: formData.isActive
      };
      
      // If there's an image file, upload it
      if (formData.image && formData.image instanceof File) {
        const imageFormData = new FormData();
        imageFormData.append('image', formData.image);
        
        // Append other form data
        Object.keys(submitData).forEach(key => {
          imageFormData.append(key, submitData[key]);
        });
        
        await fetch('https://billing.jagalikoota.com/api/v1/hotel/meal-of-the-day', {
          method: 'POST',
          body: imageFormData
        });
      } else {
        await fetch('https://billing.jagalikoota.com/api/v1/hotel/meal-of-the-day', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(submitData)
        });
      }
      
      fetchMealsOfTheDay();
      setFormData({
        productId: '',
        description: '',
        image: null,
        isActive: true
      });
      
    } catch (error) {
      console.error('Error saving meal:', error);
    }
  };

  // Handle delete meal
  const handleDeleteMeal = async (mealId) => {
    if (window.confirm('Are you sure you want to delete this meal?')) {
      try {
        await fetch(`https://billing.jagalikoota.com/api/v1/hotel/meal-of-the-day/${mealId}`, {
          method: 'DELETE'
        });
        fetchMealsOfTheDay();
      } catch (error) {
        console.error('Error deleting meal:', error);
      }
    }
  };

  // Handle toggle meal status
  const handleToggleMealStatus = async (mealId, currentStatus) => {
    try {
      const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/meal-of-the-day/${mealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      if (response.ok) {
        fetchMealsOfTheDay();
      }
    } catch (error) {
      console.error('Error updating meal status:', error);
    }
  };

  // Handle image change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle branch selection
  const handleBranchChange = (e) => {
    const branchId = e.target.value;
    const branch = branches.find(b => b._id === branchId);
    setSelectedBranch(branch);
  };

  // Get product name by ID
  const getProductName = (productId) => {
    const product = products.find(p => p._id === productId);
    return product ? product.name : 'Unknown Product';
  };

  // Get product price by ID
  const getProductPrice = (productId) => {
    const product = products.find(p => p._id === productId);
    return product ? product.price : 0;
  };

  return (
    <div className="meal-of-the-day-container">
      <div className="header">
        <h2>🍽️ Meal of the Day Management</h2>
        <p>Create and manage daily special meals for each branch with beautiful presentation</p>
      </div>

      {/* Branch Selection */}
      <div className="branch-selection">
        <label htmlFor="branchSelect">🏢 Select Branch</label>
        <select 
          id="branchSelect" 
          value={selectedBranch ? selectedBranch._id : ''} 
          onChange={handleBranchChange}
          className="form-control"
        >
          <option value="">Choose a branch to manage meals...</option>
          {branches.map(branch => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add Meal Form */}
      {selectedBranch && (
        <div className="add-meal-form">
          <h3>✨ Add New Meal of the Day</h3>
          <form onSubmit={handleSaveMeal}>
            <div className="form-group">
              <label htmlFor="productId">🍽️ Select Product *</label>
              <select
                id="productId"
                name="productId"
                value={formData.productId}
                onChange={handleInputChange}
                className="form-control"
                required
              >
                <option value="">Choose a product from the menu...</option>
                {products.length === 0 ? (
                  <option value="" disabled>No products available</option>
                ) : (
                  products.map(product => (
                    <option key={product._id} value={product._id}>
                      {product.name} - ₹{product.price}
                    </option>
                  ))
                )}
              </select>
              {products.length === 0 && (
                <small className="text-muted">⚠️ No products found. Please add products to the menu first.</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">📝 Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-control"
                rows="3"
                placeholder="Describe this special meal... (optional)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="image">📸 Custom Image (Optional)</label>
              <input
                type="file"
                id="image"
                name="image"
                onChange={handleImageChange}
                className="form-control"
                accept="image/*"
              />
              <small className="text-muted">💡 If no custom image is provided, the product's default image will be used.</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                ✅ Active (Show this meal to customers)
              </label>
            </div>

            <button type="submit" className="btn btn-primary">
              🚀 Add Meal of the Day
            </button>
          </form>
        </div>
      )}

      {/* Meals List */}
      {selectedBranch && (
        <div className="meals-list">
          <h3>📋 Current Meals for {selectedBranch.name}</h3>
          {!meals || meals.length === 0 ? (
            <p>🍽️ No meals of the day set for this branch yet. Add your first special meal above!</p>
          ) : (
            <div className="meals-grid">
              {Array.isArray(meals) && meals.map(meal => (
                <div key={meal._id} className="meal-card">
                  <div className="meal-image">
                    {meal.image ? (
                      <img 
                        src={meal.image} 
                        alt={getProductName(meal.productId)}
                        className="img-fluid"
                      />
                    ) : (
                      <div className="no-image">📷 No Image Available</div>
                    )}
                    <div className={`status-badge ${meal.isActive ? 'active' : 'inactive'}`}>
                      {meal.isActive ? '✨ Active' : '⏸️ Inactive'}
                    </div>
                  </div>
                  <div className="meal-info">
                    <h4>{getProductName(meal.productId)}</h4>
                    <p className="price">₹{getProductPrice(meal.productId)}</p>
                    {meal.description && (
                      <p className="description">{meal.description}</p>
                    )}
                    <div className="meal-actions">
                      <button
                        className={`btn btn-sm ${meal.isActive ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => handleToggleMealStatus(meal._id, meal.isActive)}
                      >
                        {meal.isActive ? '⏸️ Deactivate' : '✨ Activate'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteMeal(meal._id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MealOfTheDay;