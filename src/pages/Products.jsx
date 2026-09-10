import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Filter, ImageIcon, AlertCircle, Check, X } from 'lucide-react';
import { fetchDualBackend } from "../utils/apiHelpers";
import { hasPermission } from "../utils/usePermissions";

// Helper function to get correct image URL - Check local first, then production
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  // Use environment variable for base URL (same as API calls)
  const localBaseUrl = import.meta.env.VITE_BACKEND_PRIMARY?.replace('/api/v1/hotel', '') || "https://billing.jagalikoota.com";
  
  // Clean up the path
  let cleanPath = imagePath.toString().trim().replace(/\\/g, "/");
  
  // Build the URL
  let imageUrl;
  if (cleanPath.startsWith("/")) {
    imageUrl = `${localBaseUrl}${cleanPath}`;
  } else if (cleanPath.startsWith("uploads/")) {
    imageUrl = `${localBaseUrl}/${cleanPath}`;
  } else {
    // Otherwise assume it's just a filename in uploads/menu/
    const filename = cleanPath.split("/").pop();
    imageUrl = `${localBaseUrl}/uploads/menu/${filename}`;
  }
  
  return imageUrl;
};

// Get production fallback URL (for old images that exist on production)
const getProdImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a localhost URL, convert to production
  if (imagePath.startsWith("http://localhost")) {
    const prodUrl = imagePath.replace("https://billing.jagalikoota.com", "https://billing.jagalikoota.com");
    return prodUrl;
  }
  
  // If already a production URL, return as-is
  if (imagePath.startsWith("https://billing.jagalikoota.com")) {
    return imagePath;
  }
  
  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  // Use production server as fallback
  const prodBaseUrl = "https://billing.jagalikoota.com";
  
  // Clean up the path
  let cleanPath = imagePath.toString().trim().replace(/\\/g, "/");
  
  // Build the URL
  let imageUrl;
  if (cleanPath.startsWith("/")) {
    imageUrl = `${prodBaseUrl}${cleanPath}`;
  } else if (cleanPath.startsWith("uploads/")) {
    imageUrl = `${prodBaseUrl}/${cleanPath}`;
  } else {
    // Otherwise assume it's just a filename in uploads/menu/
    const filename = cleanPath.split("/").pop();
    imageUrl = `${prodBaseUrl}/uploads/menu/${filename}`;
  }
  
  return imageUrl;
};

const ProductModal = ({ product, onClose, onSave, branches, categories, selectedBranch }) => {
  const isEditMode = !!product;
  const quantities = ["Small", "Medium", "Large"];
  
  const [formData, setFormData] = useState({
    menuItemNumber: product?.menuItemNumber || '',
    name: product?.name || "",
    branchId: typeof product?.branchId === 'object' ? product?.branchId?._id || selectedBranch : product?.branchId || selectedBranch,
    categoryId: typeof product?.categoryId === 'object' ? product?.categoryId?._id || "" : product?.categoryId || "",
    subcategoryId: typeof product?.subcategoryId === 'object' ? product?.subcategoryId?._id || "" : product?.subcategoryId || "",
    price: product?.price || "", // Single price field
    gstRate: product?.gstRate || 0, // Single GST rate field
    foodType: product?.foodType || "", // veg | non-veg | egg
    image: null,
    subscriptionEnabled: product?.subscriptionEnabled || false,
    subscriptionPlans: product?.subscriptionPlans || [],
    subscriptionAmount: product?.subscriptionAmount || 0,
    subscriptionDiscount: product?.subscriptionDiscount || 0,
    subscriptionDuration: product?.subscriptionDuration || '3days',
    subscription3DaysDiscount: product?.subscription3DaysDiscount || 5,
    subscription1WeekDiscount: product?.subscription1WeekDiscount || 10,
    subscription1MonthDiscount: product?.subscription1MonthDiscount || 15,
    subscription3DaysPrice: product?.subscription3DaysPrice || 100,
    subscription1WeekPrice: product?.subscription1WeekPrice || 250,
    subscription1MonthPrice: product?.subscription1MonthPrice || 500
  });
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch subcategories
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        const response = await fetchDualBackend('/subcategory');
        setSubcategories(response || []);
      } catch (error) {
        console.error('Error fetching subcategories:', error);
      }
    };
    fetchSubcategories();
  }, []);

  // Update formData when product changes (for edit mode)
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        branchId: typeof product.branchId === 'object' ? product.branchId?._id || selectedBranch : product.branchId || selectedBranch,
        categoryId: typeof product.categoryId === 'object' ? product.categoryId?._id || "" : product.categoryId || "",
        subcategoryId: typeof product.subcategoryId === 'object' ? product.subcategoryId?._id || "" : product.subcategoryId || "",
        price: product.price || "", // Single price
        gstRate: product.gstRate || 0, // Single GST rate
        foodType: product.foodType || "", // veg | non-veg | egg
        image: null,
        subscriptionEnabled: product.subscriptionEnabled || false,
        subscriptionPlans: product.subscriptionPlans || [],
        subscriptionAmount: product.subscriptionAmount || 0,
        subscriptionDiscount: product.subscriptionDiscount || 0,
        subscriptionDuration: product.subscriptionDuration || '3days',
        subscription3DaysDiscount: product.subscription3DaysDiscount || 5,
        subscription1WeekDiscount: product.subscription1WeekDiscount || 10,
        subscription1MonthDiscount: product.subscription1MonthDiscount || 15,
        subscription3DaysPrice: product.subscription3DaysPrice || 100,
        subscription1WeekPrice: product.subscription1WeekPrice || 250,
        subscription1MonthPrice: product.subscription1MonthPrice || 500
      });
    }
  }, [product, selectedBranch]);

  useEffect(() => {
    if (product?.image) {
      const imageUrl = getImageUrl(product.image);
      setImagePreview(imageUrl);
    } else {
      setImagePreview(null);
    }
  }, [product]);

  useEffect(() => {
    console.log('📋 Categories changed or branch changed:', {
      totalCategories: categories.length,
      selectedBranchId: formData.branchId,
      categories: categories.map(c => ({
        name: c.name,
        branchId: c.branchId,
        branchObjId: c.branch?.id,
        gstRate: c.gstRate, // Add GST rate to logs
        _id: c._id
      }))
    });

    if (categories.length > 0 && formData.branchId) {
      // Filter categories to show only those belonging to the selected branch
      // Support both formats: category.branchId and category.branch.id
      const filtered = categories.filter((category) => {
        const categoryBranchId = category.branchId || category.branch?.id;
        const matches = categoryBranchId === formData.branchId;
        console.log(`Category "${category.name}": branchId=${categoryBranchId}, gstRate=${category.gstRate}, matches=${matches}`);
        return matches;
      });
      console.log(`🔍 Filtered ${filtered.length} categories for branch ${formData.branchId}`, filtered.map(c => ({name: c.name, gstRate: c.gstRate})));
      setFilteredCategories(filtered);
      
      // If the currently selected category doesn't belong to this branch, clear it
      if (formData.categoryId) {
        const categoryBelongsToBranch = filtered.some(
          (category) => category._id === formData.categoryId
        );
        if (!categoryBelongsToBranch) {
          setFormData((prev) => ({ ...prev, categoryId: "" }));
        }
      }
    } else {
      // If no branch selected, show all categories
      console.log('⚠️ No branch selected, showing all categories');
      setFilteredCategories(categories);
    }
  }, [formData.branchId, categories]);

  // Filter subcategories based on selected category
  useEffect(() => {
    if (subcategories.length > 0 && formData.categoryId) {
      const filtered = subcategories.filter((subcategory) => {
        const subcatCategoryId = subcategory.categoryId?._id || subcategory.categoryId;
        return subcatCategoryId === formData.categoryId;
      });
      
      setFilteredSubcategories(filtered);
      
      // Clear subcategory if it doesn't belong to the new category (for both new and edit mode)
      if (formData.subcategoryId) {
        const subcategoryBelongsToCategory = filtered.some(
          (subcategory) => subcategory._id === formData.subcategoryId
        );
        if (!subcategoryBelongsToCategory) {
          setFormData((prev) => ({ ...prev, subcategoryId: "" }));
        }
      }
    } else {
      setFilteredSubcategories([]);
      // Clear subcategory when no category is selected
      setFormData((prev) => ({ ...prev, subcategoryId: "" }));
    }
  }, [formData.categoryId, subcategories]);

  // Auto-fill GST rate when category is selected
  useEffect(() => {
    if (formData.categoryId && filteredCategories.length > 0) {
      console.log('🔍 Attempting to auto-fill GST...');
      console.log('Selected category ID:', formData.categoryId);
      console.log('Filtered categories:', filteredCategories);
      
      const selectedCategory = filteredCategories.find(cat => cat._id === formData.categoryId);
      console.log('Found category:', selectedCategory);
      
      if (selectedCategory) {
        console.log('Category GST Rate:', selectedCategory.gstRate);
        
        if (selectedCategory.gstRate !== undefined) {
          console.log('✅ Setting GST to:', selectedCategory.gstRate);
          setFormData(prev => ({
            ...prev,
            gstRate: selectedCategory.gstRate
          }));
        } else {
          console.log('⚠️ Category has no gstRate field');
        }
      } else {
        console.log('❌ Category not found in filtered categories');
      }
    }
  }, [formData.categoryId, filteredCategories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => {
      const newQuantities = prev.quantities.includes(value)
        ? prev.quantities.filter((qty) => qty !== value)
        : [...prev.quantities, value];

      const newPrices = { ...prev.prices };
      if (!newQuantities.includes(value)) {
        delete newPrices[value];
      }

      return { ...prev, quantities: newQuantities, prices: newPrices };
    });
  };

  const handlePriceChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      price: parseFloat(value) || "",
    }));
  };

  const handleGSTChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      gstRate: parseFloat(value) || 0,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));
      setError(""); // Clear any previous errors
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Validation
    if (!formData.price || formData.price <= 0) {
      setError("Please enter a valid price");
      setIsSubmitting(false);
      return;
    }
    
    if (!formData.gstRate && formData.gstRate !== 0) {
      setError("Please ensure GST rate is set (select a category)");
      setIsSubmitting(false);
      return;
    }

    // Subcategory is optional — skip validation

    if (!formData.foodType) {
      setError("Please select a food type (Veg, Non-Veg or Egg)");
      setIsSubmitting(false);
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      setError(error.message || "Failed to save product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">
            <Plus size={20} style={{ marginRight: '8px' }} />
            {product ? "Edit Item" : "Add Item"}
          </h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div
                className="error-message"
                style={{ marginBottom: "15px", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            {/* Branch */}
            <div className="form-group">
              <label className="form-label" htmlFor="branchId">
                Branch *
              </label>
              <select
                id="branchId"
                name="branchId"
                className="form-select"
                value={formData.branchId}
                onChange={handleChange}
                required
                disabled={isEditMode}
                style={isEditMode ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {isEditMode && (
                <p style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                  Branch cannot be changed after creation
                </p>
              )}
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">
                Category *
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className="form-select"
                value={formData.categoryId}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {filteredCategories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div className="form-group">
              <label className="form-label" htmlFor="subcategoryId">
                Subcategory (Optional)
              </label>
              <select
                id="subcategoryId"
                name="subcategoryId"
                className="form-select"
                value={formData.subcategoryId}
                onChange={handleChange}
                disabled={!formData.categoryId}
                style={!formData.categoryId ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
              >
                <option value="">None (No Subcategory)</option>
                {filteredSubcategories.map((subcategory) => (
                  <option key={subcategory._id} value={subcategory._id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              {!formData.categoryId && (
                <p style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                  Please select a category first
                </p>
              )}
            </div>

            {/* Food Type */}
            <div className="form-group">
              <label className="form-label">Food Type *</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { value: 'veg', label: 'Veg', color: '#16a34a' },
                  { value: 'non-veg', label: 'Non-Veg', color: '#dc2626' },
                  { value: 'egg', label: 'Egg', color: '#d97706' },
                  { value: 'sea-food', label: 'Sea Food', color: '#0891b2' },
                  { value: 'chef-special', label: 'Chef Special', color: '#7c3aed' },
                  { value: 'spice-level', label: 'Spice Level', color: '#ea580c' },
                  { value: 'gluten-free', label: 'Gluten Free', color: '#65a30d' },
                ].map((opt) => {
                  const active = formData.foodType === opt.value
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setFormData((prev) => ({ ...prev, foodType: opt.value }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '14px',
                        border: `2px solid ${active ? opt.color : '#d1d5db'}`,
                        background: active ? opt.color : 'white',
                        color: active ? 'white' : '#374151',
                      }}
                    >
                      <span style={{
                        width: '12px', height: '12px', borderRadius: '2px',
                        border: `2px solid ${active ? 'white' : opt.color}`,
                        background: active ? 'white' : 'transparent',
                        display: 'inline-block',
                      }} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>


              {/* <div style={{ marginBottom: '15px' }}>
  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
    Menu Item Number (Optional - for quick access)
  </label>
  <input
    type="number"
    min="1"
    value={formData.menuItemNumber || ''}
    onChange={(e) => setFormData({ ...formData, menuItemNumber: parseInt(e.target.value) || null })}
    style={{
      width: '100%',
      padding: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px'
    }}
    placeholder="Enter a unique number (e.g., 1, 2, 3...)"
  />
</div> */}

            {/* Item Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Item Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter item name (e.g., Pizza, Sandwich, Pasta)"
              />
            </div>

            {/* Single Price Input */}
            <div className="form-group">
              <label className="form-label">Price *</label>
              <input
                type="number"
                value={formData.price}
                onChange={handlePriceChange}
                className="form-input"
                required
                min="0"
                step="0.01"
                placeholder="Enter item price"
              />
            </div>

            {/* GST Rate Input */}
            <div className="form-group">
              <label className="form-label">GST Rate (%) *</label>
              <input
                type="number"
                value={formData.gstRate}
                onChange={handleGSTChange}
                className="form-input"
                readOnly
                min="0"
                max="100"
                step="0.01"
                placeholder="Select a category to auto-fill GST"
                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
              />
              {formData.price && formData.gstRate > 0 && (
                <p style={{ fontSize: '13px', color: '#10b981', marginTop: '8px', fontWeight: '500' }}>
                  💰 GST Amount: ₹{((formData.price * formData.gstRate) / 100).toFixed(2)} | 
                  Total Price: ₹{(parseFloat(formData.price) + (formData.price * formData.gstRate) / 100).toFixed(2)}
                </p>
              )}
            </div>

            {/* Image Upload */}
            <div className="form-group">
              <label className="form-label">Menu Item Image</label>
              
              {/* Show existing image if available and no new image selected */}
              {product?.image && !formData.image && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Current Image:</p>
                  <img
                    src={getImageUrl(product.image)}
                    alt="Current menu item"
                    style={{ width: '100%', height: '192px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    onError={(e) => {
                      console.error("Failed to load existing image:", getImageUrl(product.image));
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <input
                type="file"
                name="image"
                onChange={handleImageChange}
                accept="image/*"
                className="form-input"
                style={{ padding: '8px' }}
              />
              {formData.image && (
                <div style={{ marginTop: '12px' }}>
                  {formData.image instanceof File ? (
                    <div>
                      <img
                        src={URL.createObjectURL(formData.image)}
                        alt="Preview"
                        style={{ width: '100%', height: '192px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                      <p style={{ marginTop: '8px', fontSize: '12px', color: '#10b981' }}>
                        ✓ New image selected: {formData.image.name}
                      </p>
                    </div>
                  ) : (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: '#10b981' }}>
                      ✓ Image selected
                    </p>
                  )}
                </div>
              )}
              <p style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                {product?.image && !formData.image 
                  ? "Upload a new image to replace the current one (optional)" 
                  : "Upload an image for this menu item (JPEG, PNG, GIF, WEBP, AVIF up to 1MB)"}
              </p>
            </div>
            {formData.subscriptionEnabled && (
              <div style={{ 
                marginTop: '16px', 
                padding: '16px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374151', 
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>📋</span> Subscription Configuration
                </h4>

                {/* Subscription Pricing - Simple Price Only */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px', display: 'block' }}>
                    Subscription Pricing
                  </label>
                  
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {/* 3 Days */}
                    <div style={{ 
                      padding: '12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      backgroundColor: '#f9fafb'
                    }}>
                      <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        3 Days Plan
                      </h5>
                      
                      {/* Subscription Price */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Subscription Fee (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.subscription3DaysPrice || ''}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription3DaysPrice: price
                            });
                          }}
                          placeholder="100"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>
                          Amount users pay to buy this subscription
                        </p>
                      </div>
                      
                      {/* Discount Percentage */}
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Discount Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={formData.subscription3DaysDiscount || ''}
                          onChange={(e) => {
                            const discount = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription3DaysDiscount: discount
                            });
                          }}
                          placeholder="5"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                          step="0.01"
                        />
                      </div>
                    </div>

                    {/* 1 Week */}
                    <div style={{ 
                      padding: '12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      backgroundColor: '#f9fafb'
                    }}>
                      <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        1 Week Plan
                      </h5>
                      
                      {/* Subscription Price */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Subscription Fee (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.subscription1WeekPrice || ''}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription1WeekPrice: price
                            });
                          }}
                          placeholder="250"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>
                          Amount users pay to buy this subscription
                        </p>
                      </div>
                      
                      {/* Discount Percentage */}
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Discount Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={formData.subscription1WeekDiscount || ''}
                          onChange={(e) => {
                            const discount = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription1WeekDiscount: discount
                            });
                          }}
                          placeholder="10"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                          step="0.01"
                        />
                      </div>
                    </div>

                    {/* 1 Month */}
                    <div style={{ 
                      padding: '12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      backgroundColor: '#f9fafb'
                    }}>
                      <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        1 Month Plan
                      </h5>
                      
                      {/* Subscription Price */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Subscription Fee (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.subscription1MonthPrice || ''}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription1MonthPrice: price
                            });
                          }}
                          placeholder="500"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        />
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>
                          Amount users pay to buy this subscription
                        </p>
                      </div>
                      
                      {/* Discount Percentage */}
                      <div>
                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Discount Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={formData.subscription1MonthDiscount || ''}
                          onChange={(e) => {
                            const discount = parseFloat(e.target.value) || 0;
                            setFormData({ 
                              ...formData, 
                              subscription1MonthDiscount: discount
                            });
                          }}
                          placeholder="15"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                    💡 Set discount percentages for each subscription plan
                  </p>
                </div>

                {/* Subscription Summary */}
                {(formData.subscription3DaysDiscount > 0 || formData.subscription1WeekDiscount > 0 || formData.subscription1MonthDiscount > 0) && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#e0f2fe',
                    borderRadius: '6px',
                    border: '1px solid #0891b2'
                  }}>
                    <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0, marginBottom: '8px' }}>
                      <strong>💡 Subscription Plans Preview:</strong>
                    </p>
                    {formData.subscription3DaysDiscount > 0 && (
                      <p style={{ fontSize: '12px', color: '#0c4a6e', margin: '4px 0' }}>
                        • 3 Days: Pay ₹{formData.subscription3DaysPrice || 100} → Get {formData.subscription3DaysDiscount}% discount 
                        {Object.keys(formData.prices).length > 0 && (
                          <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            {' '}(₹{Math.round(Object.values(formData.prices)[0] * (1 - formData.subscription3DaysDiscount / 100))})
                          </span>
                        )}
                      </p>
                    )}
                    {formData.subscription1WeekDiscount > 0 && (
                      <p style={{ fontSize: '12px', color: '#0c4a6e', margin: '4px 0' }}>
                        • 1 Week: Pay ₹{formData.subscription1WeekPrice || 250} → Get {formData.subscription1WeekDiscount}% discount
                        {Object.keys(formData.prices).length > 0 && (
                          <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            {' '}(₹{Math.round(Object.values(formData.prices)[0] * (1 - formData.subscription1WeekDiscount / 100))})
                          </span>
                        )}
                      </p>
                    )}
                    {formData.subscription1MonthDiscount > 0 && (
                      <p style={{ fontSize: '12px', color: '#0c4a6e', margin: '4px 0' }}>
                        • 1 Month: Pay ₹{formData.subscription1MonthPrice || 500} → Get {formData.subscription1MonthDiscount}% discount
                        {Object.keys(formData.prices).length > 0 && (
                          <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            {' '}(₹{Math.round(Object.values(formData.prices)[0] * (1 - formData.subscription1MonthDiscount / 100))})
                          </span>
                        )}
                      </p>
                    )}
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                      * Users pay subscription fee upfront, then get discounted prices during subscription period
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={onClose} 
              disabled={isSubmitting}
              style={{ padding: '12px 24px', borderRadius: '8px' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
              style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: '#6366f1' }}
            >
              {isSubmitting ? "Saving..." : product ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ product, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onConfirm(product._id);
    setIsDeleting(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete Product</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{product.name}</strong>?
          </p>
          <p style={{ color: "#dc2626", marginTop: "10px" }}>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "white", borderColor: "#dc2626" }}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(""); // For filtering display
  const [selectedCategory, setSelectedCategory] = useState(""); // For filtering by category
  const [selectedSubcategory, setSelectedSubcategory] = useState(""); // For filtering by subcategory
  const [showModal, setShowModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(100); // 100 items per page
  const [categoryCounts, setCategoryCounts] = useState({});
  const [subcategoryCounts, setSubcategoryCounts] = useState({});
  const [branchCounts, setBranchCounts] = useState({});
  
  // Quick lookup states
  const [quickLookupNumber, setQuickLookupNumber] = useState("");
  const [quickLookupLoading, setQuickLookupLoading] = useState(false);
  const [quickLookupResult, setQuickLookupResult] = useState(null);
  const [highlightedItemId, setHighlightedItemId] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchBranches();
        await fetchCategories();
        await fetchSubcategories();
        await fetchProducts(1); // Load first page
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load data. Please refresh the page and try again.");
      }
    };
    loadData();
  }, []);

  // Refetch products when filters change
  useEffect(() => {
    fetchProducts(1); // Reset to page 1 when filters change
  }, [selectedBranch, selectedCategory, selectedSubcategory, searchQuery]);

  useEffect(() => {
    // Filter subcategories based on selected category
    if (selectedCategory) {
      const filtered = subcategories.filter((subcat) => {
        const subcatCategoryId = subcat.categoryId?._id || subcat.categoryId;
        return subcatCategoryId === selectedCategory;
      });
      setFilteredSubcategories(filtered);
      // Clear subcategory selection if it doesn't belong to the new category
      if (selectedSubcategory) {
        const subcategoryBelongsToCategory = filtered.some(
          (subcat) => subcat._id === selectedSubcategory
        );
        if (!subcategoryBelongsToCategory) {
          setSelectedSubcategory("");
        }
      }
    } else {
      setFilteredSubcategories([]);
      setSelectedSubcategory("");
    }
  }, [selectedCategory, subcategories]);

  // Removed duplicate useEffect - filtering now handled by backend

  const fetchBranches = async () => {
    try {
      const response = await fetchDualBackend("/branch", {}, true);
      setBranches(response);
      if (response.length > 0 && !selectedBranch) {
        setSelectedBranch(response[0]._id);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      setError("Failed to load branches. Please refresh the page and try again.");
    }
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      // Fetch all categories (not filtered by branch)
      const response = await fetchDualBackend("/category", {}, true);
      setCategories(response);
      if (response.length === 0) {
        setError("No categories found. Please add a category first.");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("Failed to load categories. Please refresh the page and try again.");
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const response = await fetchDualBackend("/subcategory", {}, true);
      setSubcategories(response || []);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
    }
  };

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      // Build query parameters for backend filtering
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', itemsPerPage);
      
      // Add filters - only add if they have values
      if (selectedBranch) params.append('branchId', selectedBranch);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedSubcategory) params.append('subcategoryId', selectedSubcategory);
      if (searchQuery && searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('includeDisabled', 'true'); // Admin sees all items including disabled
      
      const url = `/menu?${params.toString()}`;
      console.log('📋 Fetching products with URL:', url);
      
      const response = await fetchDualBackend(url, {}, true);
      console.log("📋 Full products response:", response);
      console.log("📋 Response type:", typeof response);
      console.log("📋 Response keys:", response ? Object.keys(response) : 'null');
      console.log("📋 Has pagination?", response?.pagination);
      console.log("📋 Has data?", response?.data);
      console.log("📋 Is array?", Array.isArray(response));
      
      // Backend format: {success: true, data: [...], pagination: {...}}
      let productsData = [];
      let paginationInfo = null;
      
      // Extract data array
      if (response.success && Array.isArray(response.data)) {
        productsData = response.data;
        console.log("✅ Found products data (success + data):", productsData.length, "items");
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
        console.log("✅ Found products data (data array):", productsData.length, "items");
      } else if (response.menu) {
        // Fallback: {menu: [...], pagination: {...}}
        productsData = response.menu;
        console.log("✅ Found products data (menu):", productsData.length, "items");
      } else if (Array.isArray(response)) {
        // Fallback: direct array
        productsData = response;
        console.log("✅ Found products data (direct array):", productsData.length, "items");
      } else {
        console.error("❌ Could not extract products data from response");
      }
      
      // Extract pagination info
      if (response.pagination) {
        paginationInfo = response.pagination;
        console.log("✅ Pagination info found:", paginationInfo);
        
        // Update pagination state from backend
        setCurrentPage(paginationInfo.currentPage || page);
        setTotalPages(paginationInfo.totalPages || 1);
        setTotalItems(paginationInfo.totalItems || productsData.length);
        
        console.log('📊 Pagination state updated:', {
          currentPage: paginationInfo.currentPage,
          totalPages: paginationInfo.totalPages,
          totalItems: paginationInfo.totalItems,
          itemsPerPage: paginationInfo.itemsPerPage,
          hasNextPage: paginationInfo.hasNextPage,
          hasPrevPage: paginationInfo.hasPrevPage
        });
      } else {
        // No pagination from backend - calculate manually
        console.warn('⚠️ No pagination info from backend, calculating manually');
        console.warn('⚠️ Response structure:', JSON.stringify(response, null, 2).substring(0, 500));
        setCurrentPage(page);
        setTotalPages(Math.ceil(productsData.length / itemsPerPage));
        setTotalItems(productsData.length);
      }
      
      // Extract category and subcategory counts from backend
      if (response.categoryCounts) {
        setCategoryCounts(response.categoryCounts);
      }
      if (response.subcategoryCounts) {
        setSubcategoryCounts(response.subcategoryCounts);
      }
      if (response.branchCounts) {
        setBranchCounts(response.branchCounts);
      }
      
      setProducts(productsData);
      setFilteredProducts(productsData); // Backend handles all filtering
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to load products. Please refresh the page and try again.");
      setProducts([]);
      setFilteredProducts([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  // filterProducts function removed - backend now handles all filtering

  const handleAddClick = () => {
    setCurrentProduct(null);
    setShowModal(true);
  };

  const handleEditClick = (product) => {
    setCurrentProduct(product);
    setShowModal(true);
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleSaveProduct = async (formData) => {
    try {
      const formDataObj = new FormData();
      formDataObj.append("itemName", formData.name);
      
      // Extract IDs from populated objects if needed
      const branchId = typeof formData.branchId === 'object' ? formData.branchId._id : formData.branchId;
      const categoryId = typeof formData.categoryId === 'object' ? formData.categoryId._id : formData.categoryId;
      
      console.log("Extracted IDs:", { branchId, categoryId });
      console.log("Original formData:", { branchId: formData.branchId, categoryId: formData.categoryId });
      
      formDataObj.append("branchId", branchId);
      formDataObj.append("categoryId", categoryId);
      
      // Add subcategoryId if present
      if (formData.subcategoryId) {
        const subcategoryId = typeof formData.subcategoryId === 'object' ? formData.subcategoryId._id : formData.subcategoryId;
        formDataObj.append("subcategoryId", subcategoryId);
      }
      
      // Send single price and GST rate (new format)
      formDataObj.append("price", formData.price);
      formDataObj.append("gstRate", formData.gstRate);

      // Food type (veg | non-veg | egg)
      formDataObj.append("foodType", formData.foodType);
      
      // Keep backward compatibility with old format (for old backend/records)
      formDataObj.append("menuTypes", JSON.stringify(["Regular"]));
      formDataObj.append("quantities", JSON.stringify(["Regular"]));
      formDataObj.append("prices", JSON.stringify({ Regular: formData.price }));
      formDataObj.append("subscriptionEnabled", formData.subscriptionEnabled);
      
      // Only append menuItemNumber if it has a valid value
      if (formData.menuItemNumber && formData.menuItemNumber !== "" && formData.menuItemNumber !== "0") {
        formDataObj.append("menuItemNumber", formData.menuItemNumber);
      }
      
      formDataObj.append("subscriptionPlans", JSON.stringify(formData.subscriptionPlans));
      formDataObj.append("subscriptionAmount", formData.subscriptionAmount || 0);
      formDataObj.append("subscriptionDiscount", formData.subscriptionDiscount || 0);
      formDataObj.append("subscriptionDuration", formData.subscriptionDuration || '3days');
      // Send percentage discounts instead of fixed prices
      formDataObj.append("subscription3DaysDiscount", formData.subscription3DaysDiscount || 0);
      formDataObj.append("subscription1WeekDiscount", formData.subscription1WeekDiscount || 0);
      formDataObj.append("subscription1MonthDiscount", formData.subscription1MonthDiscount || 0);
      // Send subscription fees (what users pay to buy subscriptions)
      formDataObj.append("subscription3DaysPrice", formData.subscription3DaysPrice || 0);
      formDataObj.append("subscription1WeekPrice", formData.subscription1WeekPrice || 0);
      formDataObj.append("subscription1MonthPrice", formData.subscription1MonthPrice || 0);
      
      if (formData.image && formData.image instanceof File) {
        console.log("Appending image to FormData:", formData.image.name, formData.image.size, "bytes");
        formDataObj.append("image", formData.image);
      } else {
        console.log("No image to upload:", { hasImage: !!formData.image, isFile: formData.image instanceof File });
      }

      // Debug: Log all FormData entries
      console.log("FormData entries being sent:");
      for (let [key, value] of formDataObj.entries()) {
        console.log(`${key}:`, value);
      }

      let responseData;
      if (currentProduct) {
        console.log("Current product for update:", currentProduct);
        console.log("Current product ID:", currentProduct._id);
        console.log("Current product ID type:", typeof currentProduct._id);
        
        responseData = await fetchDualBackend(`/menu/${currentProduct._id}`, {
          method: "PUT",
          body: formDataObj,
        });
        console.log("Product updated, response:", responseData);
        console.log("Image path in response:", responseData.image);
        
        // Refetch products to get populated subcategory data
        await fetchProducts();
        setSuccessMessage(`Item "${responseData.itemName || responseData.name}" updated successfully`);
      } else {
        responseData = await fetchDualBackend("/menu", {
          method: "POST",
          body: formDataObj,
        });
        console.log("Product created, response:", responseData);
        console.log("Image path in response:", responseData.image);
        
        // Refresh the products list to ensure UI is in sync
        await fetchProducts();
        setSuccessMessage(`Item "${responseData.itemName || responseData.name}" created successfully`);
      }

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);

      return responseData;
    } catch (error) {
      console.error("Error saving product:", error);
      throw new Error(error.message || "Failed to save product");
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await fetchDualBackend(`/menu/${productId}`, {
        method: "DELETE",
      });
      
      // Show success message
      setSuccessMessage("Product deleted successfully");
    } catch (error) {
      console.error("Error deleting product:", error);
      
      // Show message that item was removed (even if backend failed)
      setSuccessMessage("Item removed from display");
    } finally {
      // Always update the UI - remove from BOTH products and filteredProducts
      const updatedProducts = products.filter((prod) => prod._id !== productId);
      setProducts(updatedProducts);
      setFilteredProducts(filteredProducts.filter((prod) => prod._id !== productId));
      
      // Close modal
      setShowDeleteModal(false);
      setProductToDelete(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  };

  // Toggle disable/enable for today
  const handleToggleDisable = async (product) => {
    const isDisabled = product.disabledUntil && new Date(product.disabledUntil) > new Date()
    const endpoint = isDisabled
      ? `/menu/${product._id}/enable`
      : `/menu/${product._id}/disable-today`
    try {
      await fetchDualBackend(endpoint, { method: "PUT" })
      // Update local state
      const updatedProducts = products.map((p) =>
        p._id === product._id
          ? { ...p, disabledUntil: isDisabled ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
          : p
      )
      setProducts(updatedProducts)
      setFilteredProducts(filteredProducts.map((p) =>
        p._id === product._id
          ? { ...p, disabledUntil: isDisabled ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
          : p
      ))
      setSuccessMessage(isDisabled ? `"${product.name || product.itemName}" enabled` : `"${product.name || product.itemName}" disabled for today`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      setError(err.message || "Failed to toggle item")
      setTimeout(() => setError(""), 3000)
    }
  }

  const getCategoryName = (categoryId, populatedCategory) => {
    if (populatedCategory && populatedCategory.name) {
      return populatedCategory.name;
    }
    const category = categories.find((cat) => cat._id === categoryId);
    return category ? category.name : "Unknown";
  };

  // Quick lookup functions
  const handleQuickLookup = async () => {
    if (!quickLookupNumber) return;
    await handleQuickLookupByNumber(parseInt(quickLookupNumber));
  };

  const handleQuickLookupByNumber = async (number) => {
    setQuickLookupLoading(true);
    setQuickLookupResult(null);
    setHighlightedItemId(null);
    
    try {
      const response = await fetchDualBackend(`/menu/number/${number}`, {}, true);
      
      if (response) {
        setQuickLookupResult({
          success: true,
          item: response,
          message: `Menu item #${number} found successfully`
        });
        
        // Highlight the item in the grid
        setHighlightedItemId(response._id);
        
        // Clear filters to show the item if it's currently filtered out
        setSearchQuery("");
        setSelectedCategory("");
        setSelectedSubcategory("");
        
        // Set branch filter to the item's branch to ensure it's visible
        if (response.branchId) {
          const itemBranchId = typeof response.branchId === 'object' ? response.branchId._id : response.branchId;
          setSelectedBranch(itemBranchId);
        }
        
        // Scroll to the item after a short delay to allow for re-rendering
        setTimeout(() => {
          const element = document.getElementById(`product-${response._id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // Clear highlight after 5 seconds
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 5000);
        
      } else {
        setQuickLookupResult({
          success: false,
          message: `No menu item found with number ${number}`
        });
      }
    } catch (error) {
      console.error('Error fetching menu item by number:', error);
      setQuickLookupResult({
        success: false,
        message: `Error: ${error.message || 'Failed to fetch menu item'}`
      });
    } finally {
      setQuickLookupLoading(false);
    }
  };

  return (
    <div className="products-page">
      {successMessage && (
        <div className="success-message">
          <Check size={16} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}>
            <span>×</span>
          </button>
        </div>
      )}

      <div className="page-header">
        <h1>Products</h1>
        <div className="header-actions">
          {hasPermission("menu", "edit") && (
          <button className="btn btn-primary" onClick={handleAddClick}>
            <Plus size={16} />
            <span>Add Product</span>
          </button>
          )}
        </div>
      </div>

      {/* Branch Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedBranch("")}
          style={{
            padding: '10px 20px',
            borderRadius: '25px',
            border: 'none',
            backgroundColor: selectedBranch === "" ? '#6366f1' : '#e5e7eb',
            color: selectedBranch === "" ? 'white' : '#374151',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          All Branches ({Object.values(branchCounts).reduce((sum, c) => sum + c, 0) || totalItems})
        </button>
        {branches.map((branch) => {
          const branchProductCount = branchCounts[branch._id] || 0;
          return (
            <button
              key={branch._id}
              onClick={() => setSelectedBranch(branch._id)}
              style={{
                padding: '10px 20px',
                borderRadius: '25px',
                border: 'none',
                backgroundColor: selectedBranch === branch._id ? '#6366f1' : '#e5e7eb',
                color: selectedBranch === branch._id ? 'white' : '#374151',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              {branch.name} ({branchProductCount})
            </button>
          );
        })}
      </div>

      {/* Category Filter Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
          Filter by Category:
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory("")}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: selectedCategory === "" ? '#10b981' : '#f3f4f6',
            color: selectedCategory === "" ? 'white' : '#374151',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          All Categories ({Object.values(categoryCounts).reduce((sum, c) => sum + c, 0) || totalItems})
        </button>
        {categories
          .filter(cat => {
            if (!selectedBranch) return true;
            const catBranchId = cat.branchId || cat.branch?.id;
            return catBranchId === selectedBranch;
          })
          .map((category) => {
            const categoryProductCount = categoryCounts[category._id] || 0;
            return (
              <button
                key={category._id}
                onClick={() => setSelectedCategory(category._id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: selectedCategory === category._id ? '#10b981' : '#f3f4f6',
                  color: selectedCategory === category._id ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
              >
                {category.name} ({categoryProductCount})
              </button>
            );
          })}
      </div>
      </div>

      {/* Subcategory Filter Buttons */}
      {selectedCategory && filteredSubcategories.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            Filter by Subcategory:
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedSubcategory("")}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: selectedSubcategory === "" ? '#8b5cf6' : '#f3f4f6',
                color: selectedSubcategory === "" ? 'white' : '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
              }}
            >
              All Subcategories
            </button>
            {filteredSubcategories.map((subcategory) => {
              const subcategoryProductCount = subcategoryCounts[subcategory._id] || 0;
              return (
                <button
                  key={subcategory._id}
                  onClick={() => setSelectedSubcategory(subcategory._id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: selectedSubcategory === subcategory._id ? '#8b5cf6' : '#f3f4f6',
                    color: selectedSubcategory === subcategory._id ? 'white' : '#374151',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                >
                  {subcategory.name} ({subcategoryProductCount})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Menu Item Number Lookup - COMMENTED OUT */}
      {/*
      <div style={{ 
        backgroundColor: "white", 
        borderRadius: "12px", 
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
        padding: "20px", 
        marginBottom: "20px",
        border: "1px solid #e5e7eb"
      }}>
        <h3 style={{ 
          fontSize: "16px", 
          fontWeight: "600", 
          marginBottom: "12px", 
          color: "#374151",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          🔍 Quick Menu Item Lookup
        </h3>
        <p style={{ 
          fontSize: "14px", 
          color: "#6b7280", 
          marginBottom: "16px" 
        }}>
          Enter a menu item number to quickly find and highlight that item. Perfect for POS operations.
        </p>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="number"
              min="1"
              placeholder="Enter item number (e.g., 1, 2, 3...)"
              value={quickLookupNumber}
              onChange={(e) => setQuickLookupNumber(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleQuickLookup()
                }
              }}
              style={{
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
                width: "200px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
            />
            <button
              onClick={handleQuickLookup}
              disabled={!quickLookupNumber || quickLookupLoading}
              style={{
                padding: "10px 16px",
                backgroundColor: quickLookupNumber && !quickLookupLoading ? "#3b82f6" : "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: quickLookupNumber && !quickLookupLoading ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background-color 0.2s"
              }}
              onMouseOver={(e) => {
                if (quickLookupNumber && !quickLookupLoading) {
                  e.target.style.backgroundColor = "#2563eb"
                }
              }}
              onMouseOut={(e) => {
                if (quickLookupNumber && !quickLookupLoading) {
                  e.target.style.backgroundColor = "#3b82f6"
                }
              }}
            >
              {quickLookupLoading ? (
                <>
                  <div style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid #ffffff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={14} />
                  Find Item
                </>
              )}
            </button>
          </div>
          
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <button
                key={num}
                onClick={() => {
                  setQuickLookupNumber(num.toString())
                  handleQuickLookupByNumber(num)
                }}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#e5e7eb"
                  e.target.style.borderColor = "#9ca3af"
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "#f3f4f6"
                  e.target.style.borderColor = "#d1d5db"
                }}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
        
        {quickLookupResult && (
          <div style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: quickLookupResult.success ? "#f0fdf4" : "#fef2f2",
            borderRadius: "8px",
            border: `1px solid ${quickLookupResult.success ? "#bbf7d0" : "#fecaca"}`
          }}>
            {quickLookupResult.success ? (
              <div>
                <div style={{ 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#166534",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  ✅ Found: {quickLookupResult.item.name}
                </div>
                <div style={{ fontSize: "13px", color: "#166534" }}>
                  Category: {quickLookupResult.item.categoryId?.name || 'N/A'} | 
                  Branch: {quickLookupResult.item.branchId?.name || 'N/A'}
                  {quickLookupResult.item.quantities && quickLookupResult.item.quantities.length > 0 && (
                    <span> | Sizes: {quickLookupResult.item.quantities.join(', ')}</span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ 
                fontSize: "14px", 
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                ❌ {quickLookupResult.message}
              </div>
            )}
            <button
              onClick={() => setQuickLookupResult(null)}
              style={{
                marginTop: "8px",
                padding: "4px 8px",
                backgroundColor: "transparent",
                color: quickLookupResult.success ? "#166534" : "#dc2626",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                textDecoration: "underline"
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
      */}

      {/* Search Bar */}
      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div
          className="error-container"
          style={{
            margin: "20px 0",
            padding: "10px 15px",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading || loadingCategories ? (
        <div className="loading-container" style={{ textAlign: "center", padding: "40px 0" }}>
          <p>Loading data...</p>
        </div>
      ) : (
        <div className="grid-container">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div 
                key={product._id} 
                id={`product-${product._id}`}
                className="grid-item"
                style={{
                  border: highlightedItemId === product._id ? "3px solid #10b981" : undefined,
                  boxShadow: highlightedItemId === product._id ? "0 0 20px rgba(16, 185, 129, 0.3)" : undefined,
                  transform: highlightedItemId === product._id ? "scale(1.02)" : undefined,
                  transition: "all 0.3s ease"
                }}
              >
                <div className="grid-item-image-container" style={{ position: 'relative' }}>
                  <img
                    src={getImageUrl(product.image) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23f3f4f6' width='300' height='200'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E"}
                    alt={product.name || product.itemName}
                    className="grid-item-image"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23f3f4f6' width='300' height='200'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='16' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  {/* Subscription Badge */}
                  {product.subscriptionEnabled && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <span>📅</span>
                      <span>SUBSCRIPTION</span>
                    </div>
                  )}
                </div>
                <div className="grid-item-content">
                  <h3 className="grid-item-title">
                    {product.menuItemNumber && (
                      <span style={{
                        display: "inline-block",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginRight: "8px"
                      }}>
                        #{product.menuItemNumber}
                      </span>
                    )}
                    {product.name || product.itemName || product.categoryId?.name || 'Unnamed Product'}
                  </h3>
                  {product.disabledUntil && new Date(product.disabledUntil) > new Date() && (
                    <span style={{ display: 'inline-block', background: '#fef2f2', color: '#dc2626', fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fca5a5', marginBottom: '4px' }}>
                      DISABLED TODAY
                    </span>
                  )}
                  <p className="grid-item-subtitle">
                    {getCategoryName(product.categoryId, product.categoryId)}
                  </p>
                  {/* Show single price and GST */}
                  {product.price && product.price > 0 ? (
                    <div style={{ marginTop: '8px', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', color: '#111827', fontWeight: '600' }}>
                          ₹{Number(product.price).toFixed(2)}
                        </span>
                        {product.gstRate > 0 && (
                          <span style={{ fontSize: '11px', color: '#059669', background: '#d1fae5', borderRadius: '4px', padding: '1px 6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            +{product.gstRate}% GST
                          </span>
                        )}
                      </div>
                      {product.gstRate > 0 && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          Total: <strong style={{ color: '#374151' }}>₹{(product.price + (product.price * product.gstRate) / 100).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  ) : product.quantities && product.quantities.filter(q => q !== 'Regular').length > 0 ? (
                    <div style={{ marginTop: '8px', marginBottom: '4px' }}>
                      {product.quantities.filter(q => q !== 'Regular').map((qty) => (
                        <div key={qty} style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '500' }}>{qty}:</span> ₹{product.prices?.[qty] ? Number(product.prices[qty]).toFixed(2) : '0.00'}
                        </div>
                      ))}
                    </div>
                  ) : (
                    product.description && (
                      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {product.description}
                      </p>
                    )
                  )}
                  <div className="grid-item-footer">
                    <div className="grid-item-actions" style={{ marginLeft: 'auto' }}>
                      {hasPermission("menu", "edit") && (
                        product.disabledUntil && new Date(product.disabledUntil) > new Date() ? (
                          <button
                            className="action-btn"
                            onClick={() => handleToggleDisable(product)}
                            title="Enable item"
                            style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }}
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            className="action-btn"
                            onClick={() => handleToggleDisable(product)}
                            title="Disable for today"
                            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}
                          >
                            <X size={14} />
                          </button>
                        )
                      )}
                      {hasPermission("menu", "edit") && (
                      <button className="action-btn edit" onClick={() => handleEditClick(product)}>
                        <Edit size={14} />
                      </button>
                      )}
                      {hasPermission("menu", "delete") && (
                      <button className="action-btn delete" onClick={() => handleDeleteClick(product)}>
                        <Trash2 size={14} />
                      </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ textAlign: "center", padding: "40px 0", gridColumn: "1 / -1" }}>
              <p>
                No products found. {searchQuery ? "Try different search terms." : "Add a new product to get started."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && filteredProducts.length > 0 && (
        <>
        

          {/* Show pagination if there are multiple pages OR if there are items */}
          {(totalPages > 1 || totalItems > 0) && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              margin: '24px 0',
              flexWrap: 'wrap'
            }}>
          {/* Previous Button */}
          <button
            onClick={() => fetchProducts(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
              color: currentPage === 1 ? '#9ca3af' : 'white',
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ← Prev
          </button>

          {/* Page Numbers */}
          {(() => {
            const pages = [];
            
            // Always show first page
            if (currentPage > 3) {
              pages.push(
                <button
                  key={1}
                  onClick={() => fetchProducts(1)}
                  style={{
                    background: 'white',
                    color: '#3b82f6',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    cursor: 'pointer',
                    minWidth: '40px'
                  }}
                >
                  1
                </button>
              );
              
              if (currentPage > 4) {
                pages.push(<span key="dots1" style={{ color: '#6b7280', padding: '0 4px' }}>...</span>);
              }
            }
            
            // Show pages around current page
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);
            
            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={i}
                  onClick={() => i !== currentPage && fetchProducts(i)}
                  style={{
                    background: i === currentPage ? '#3b82f6' : 'white',
                    color: i === currentPage ? 'white' : '#3b82f6',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: `1px solid ${i === currentPage ? '#3b82f6' : '#d1d5db'}`,
                    cursor: i === currentPage ? 'default' : 'pointer',
                    minWidth: '40px'
                  }}
                >
                  {i}
                </button>
              );
            }
            
            // Always show last page
            if (currentPage < totalPages - 2) {
              if (currentPage < totalPages - 3) {
                pages.push(<span key="dots2" style={{ color: '#6b7280', padding: '0 4px' }}>...</span>);
              }
              
              pages.push(
                <button
                  key={totalPages}
                  onClick={() => fetchProducts(totalPages)}
                  style={{
                    background: 'white',
                    color: '#3b82f6',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    cursor: 'pointer',
                    minWidth: '40px'
                  }}
                >
                  {totalPages}
                </button>
              );
            }
            
            return pages;
          })()}

          {/* Next Button */}
          <button
            onClick={() => fetchProducts(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
              color: currentPage === totalPages ? '#9ca3af' : 'white',
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Next →
          </button>
        </div>
          )}

          {/* Pagination Info */}
          <div style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '20px'
          }}>
            Showing {filteredProducts.length} of {totalItems} products
            {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
          </div>
        </>
      )}

      {showModal && (
        <ProductModal
          product={currentProduct}
          onClose={() => setShowModal(false)}
          onSave={handleSaveProduct}
          branches={branches}
          categories={categories}
          selectedBranch={selectedBranch}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          product={productToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
};
export default Products;
<style jsx>{`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`}</style>