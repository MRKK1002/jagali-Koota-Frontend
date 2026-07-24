// Utility function to handle different API response formats
// This handles the transition from old formats to new {success, count, data} format
// and gracefully handles placeholder responses from unconnected routes

export const handleApiResponse = (response, options = {}) => {
  const {
    dataKey = null, // e.g., 'orders', 'invoices', 'users', etc.
    fallbackValue = [],
    logPlaceholders = true
  } = options;

  // Handle placeholder responses (routes not connected to controllers)
  if (response.data && response.data.message && response.data.message.includes('routes working')) {
    if (logPlaceholders) {
      console.log(`⚠️ Server returning placeholder response: ${response.data.message}`);
      console.log('💡 This route needs to be connected to its controller');
    }
    return fallbackValue;
  }

  // Handle new standardized format: {success, count, data}
  if (response.data && response.data.success && Array.isArray(response.data.data)) {
    return response.data.data;
  }

  // Handle current specific format: {success, [dataKey]: [...]}
  if (dataKey && response.data && response.data.success && Array.isArray(response.data[dataKey])) {
    return response.data[dataKey];
  }

  // Handle current specific format without success flag: {[dataKey]: [...]}
  if (dataKey && response.data && Array.isArray(response.data[dataKey])) {
    return response.data[dataKey];
  }

  // Handle direct array format
  if (Array.isArray(response.data)) {
    return response.data;
  }

  // Handle error responses
  if (response.data && response.data.error) {
    throw new Error(`API Error: ${response.data.error}`);
  }

  // Handle success: false responses
  if (response.data && response.data.success === false) {
    console.log('⚠️ API returned success: false, treating as empty result');
    return fallbackValue;
  }

  // Unexpected format
  console.error('❌ Unexpected API response format:', response.data);
  return fallbackValue;
};

// Utility for handling fetch API responses (for components using fetch instead of axios)
export const handleFetchResponse = async (response, options = {}) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  const {
    dataKey = null,
    fallbackValue = [],
    logPlaceholders = true
  } = options;

  // Handle placeholder responses
  if (data && data.message && data.message.includes('routes working')) {
    if (logPlaceholders) {
      console.log(`⚠️ Server returning placeholder response: ${data.message}`);
      console.log('💡 This route needs to be connected to its controller');
    }
    return fallbackValue;
  }

  // Handle new standardized format: {success, count, data}
  if (data && data.success && Array.isArray(data.data)) {
    return data.data;
  }

  // Handle current specific format: {success, [dataKey]: [...]}
  if (dataKey && data && data.success && Array.isArray(data[dataKey])) {
    return data[dataKey];
  }

  // Handle current specific format without success flag: {[dataKey]: [...]}
  if (dataKey && data && Array.isArray(data[dataKey])) {
    return data[dataKey];
  }

  // Handle direct array format
  if (Array.isArray(data)) {
    return data;
  }

  // Handle error responses
  if (data && data.error) {
    throw new Error(`API Error: ${data.error}`);
  }

  // Handle success: false responses
  if (data && data.success === false) {
    console.log('⚠️ API returned success: false, treating as empty result');
    return fallbackValue;
  }

  // Unexpected format
  console.error('❌ Unexpected API response format:', data);
  return fallbackValue;
};

// List of known placeholder responses for reference
export const KNOWN_PLACEHOLDER_RESPONSES = [
  'Reservation routes working',
  'Stafflogin routes working', 
  'Productsubmission routes working',
  'Terms routes working',
  'Supplier routes working',
  'Subscriptionorder routes working',
  'Storelocation routes working',
  'Stockinward routes working',
  'Stafforder routes working',
  'Staffinvoice routes working',
  'Restaurantprofile routes working',
  'Recipe routes working',
  'Receptionistaccess routes working',
  'Rawmaterial routes working',
  'Purchaseuser routes working',
  'Purchase routes working',
  'Peopleselection routes working',
  'Subscription routes working',
  'Inventory routes working',
  'Helpsupport routes working',
  'Goodreceipnotes routes working',
  'Expense routes working',
  'Customer routes working',
  'Customerdetails routes working',
  'Coupon routes working',
  'Counterinvoice routes working',
  'Categoryaccess routes working',
  'Admin routes working',
  'Address routes working',
  'Aboutus routes working'
];