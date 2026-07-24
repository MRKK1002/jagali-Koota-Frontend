

import { createContext, useState, useContext } from "react"

// Create context
const DataContext = createContext()

// Sample data
const initialBranches = [
  { id: 1, name: "Central Branch", address: "123 Main St, City Center", phone: "123-456-7890", isActive: true },
  { id: 2, name: "North Branch", address: "456 North Ave, Northside", phone: "234-567-8901", isActive: true },
  { id: 3, name: "South Branch", address: "789 South Blvd, Southside", phone: "345-678-9012", isActive: true },
  { id: 4, name: "East Branch", address: "101 East Rd, Eastville", phone: "456-789-0123", isActive: true },
  { id: 5, name: "West Branch", address: "202 West St, Westtown", phone: "567-890-1234", isActive: true },
]

const initialCategories = [
  { id: 1, name: "Appetizers", branchId: 1, description: "Starters and small plates", isActive: true },
  { id: 2, name: "Main Course", branchId: 1, description: "Primary dishes", isActive: true },
  { id: 3, name: "Desserts", branchId: 1, description: "Sweet treats", isActive: true },
  { id: 4, name: "Beverages", branchId: 1, description: "Drinks and refreshments", isActive: true },
  { id: 5, name: "Breakfast", branchId: 2, description: "Morning meals", isActive: true },
  { id: 6, name: "Lunch", branchId: 2, description: "Midday meals", isActive: true },
  { id: 7, name: "Dinner", branchId: 2, description: "Evening meals", isActive: true },
  { id: 8, name: "Snacks", branchId: 3, description: "Light bites", isActive: true },
  { id: 9, name: "Soups", branchId: 3, description: "Warm and comforting", isActive: true },
  { id: 10, name: "Salads", branchId: 3, description: "Fresh and healthy", isActive: true },
  { id: 11, name: "Specials", branchId: 4, description: "Chef's recommendations", isActive: true },
  { id: 12, name: "Combos", branchId: 4, description: "Value meals", isActive: true },
  { id: 13, name: "Vegetarian", branchId: 5, description: "Plant-based options", isActive: true },
  { id: 14, name: "Non-Vegetarian", branchId: 5, description: "Meat-based dishes", isActive: true },
]

const initialProducts = [
  {
    id: 1,
    name: "Spring Rolls",
    categoryId: 1,
    branchId: 1,
    price: 120,
    description: "Crispy vegetable spring rolls served with sweet chili sauce",
    image:
      "https://images.unsplash.com/photo-1606505662538-0a89eb33e0d9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8c3ByaW5nJTIwcm9sbHN8ZW58MHx8MHx8fDA%3D",
    isAvailable: true,
  },
  {
    id: 2,
    name: "Paneer Tikka",
    categoryId: 1,
    branchId: 1,
    price: 180,
    description: "Marinated cottage cheese grilled to perfection",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGFuZWVyJTIwdGlra2F8ZW58MHx8MHx8fDA%3D",
    isAvailable: true,
  },
  {
    id: 3,
    name: "Butter Paneer",
    categoryId: 2,
    branchId: 1,
    price: 250,
    description: "Tender PAneer in a rich buttery tomato sauce",
    image:
      "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnV0dGVyJTIwY2hpY2tlbnxlbnwwfHwwfHx8MA%3D%3D",
    isAvailable: true,
  },
  {
    id: 4,
    name: "Vegetable Biryani",
    categoryId: 2,
    branchId: 1,
    price: 220,
    description: "Fragrant rice cooked with mixed vegetables and spices",
    image:
      "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YmlyeWFuaXxlbnwwfHwwfHx8MA%3D%3D",
    isAvailable: true,
  },
  {
    id: 5,
    name: "Gulab Jamun",
    categoryId: 3,
    branchId: 1,
    price: 100,
    description: "Sweet milk solids balls soaked in sugar syrup",
    image:
      "https://images.unsplash.com/photo-1605197161470-5d2a9af0ac7e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3VsYWIlMjBqYW11bnxlbnwwfHwwfHx8MA%3D%3D",
    isAvailable: true,
  },
  {
    id: 6,
    name: "Mango Lassi",
    categoryId: 4,
    branchId: 1,
    price: 80,
    description: "Refreshing yogurt drink with mango pulp",
    image:
      "https://images.unsplash.com/photo-1626078436898-7c7f4f6dccf4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWFuZ28lMjBsYXNzaXxlbnwwfHwwfHx8MA%3D%3D",
    isAvailable: true,
  },
  {
    id: 7,
    name: "Masala Dosa",
    categoryId: 5,
    branchId: 2,
    price: 150,
    description: "Crispy rice crepe filled with spiced potatoes",
    image:
      "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZG9zYXxlbnwwfHwwfHx8MA%3D%3D",
    isAvailable: true,
  },
  {
    id: 8,
    name: "Sandwich",
    categoryId: 6,
    branchId: 2,
    price: 160,
    description: "Grilled Potato with lettuce and mayo in toasted bread",
    image:
      "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2hpY2tlbiUyMHNhbmR3aWNofGVufDB8fDB8fHww",
    isAvailable: true,
  },
  {
    id: 9,
    name: "Tandoori Paneer",
    categoryId: 7,
    branchId: 2,
    price: 280,
    description: "Paneer marinated in yogurt and spices, cooked in a tandoor",
    image:
      "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGFuZG9vcmklMjBjaGlja2VufGVufDB8fDB8fHww",
    isAvailable: true,
  },
  {
    id: 10,
    name: "Samosa",
    categoryId: 8,
    branchId: 3,
    price: 40,
    description: "Crispy pastry filled with spiced potatoes and peas",
    image:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2Ftb3NhfGVufDB8fDB8fHww",
    isAvailable: true,
  },
]

// Provider component
export const DataProvider = ({ children }) => {
  const [branches, setBranches] = useState(initialBranches)
  const [categories, setCategories] = useState(initialCategories)
  const [products, setProducts] = useState(initialProducts)
  const [selectedBranch, setSelectedBranch] = useState(1)

  // Branch operations
  const addBranch = (branch) => {
    const newBranch = {
      ...branch,
      id: branches.length > 0 ? Math.max(...branches.map((b) => b.id)) + 1 : 1,
      isActive: true,
    }
    setBranches([...branches, newBranch])
    return newBranch
  }

  const updateBranch = (updatedBranch) => {
    setBranches(branches.map((branch) => (branch.id === updatedBranch.id ? updatedBranch : branch)))
  }

  const deleteBranch = (id) => {
    setBranches(branches.filter((branch) => branch.id !== id))
    // Also delete associated categories and products
    setCategories(categories.filter((category) => category.branchId !== id))
    setProducts(products.filter((product) => product.branchId !== id))
  }

  // Category operations
  const addCategory = (category) => {
    const newCategory = {
      ...category,
      id: categories.length > 0 ? Math.max(...categories.map((c) => c.id)) + 1 : 1,
      isActive: true,
    }
    setCategories([...categories, newCategory])
    return newCategory
  }

  const updateCategory = (updatedCategory) => {
    setCategories(categories.map((category) => (category.id === updatedCategory.id ? updatedCategory : category)))
  }

  const deleteCategory = (id) => {
    setCategories(categories.filter((category) => category.id !== id))
    // Also delete associated products
    setProducts(products.filter((product) => product.categoryId !== id))
  }

  // Product operations
  const addProduct = (product) => {
    const newProduct = {
      ...product,
      id: products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1,
      isAvailable: true,
    }
    setProducts([...products, newProduct])
    return newProduct
  }

  const updateProduct = (updatedProduct) => {
    setProducts(products.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)))
  }

  const deleteProduct = (id) => {
    setProducts(products.filter((product) => product.id !== id))
  }

  // Get categories by branch
  const getCategoriesByBranch = (branchId) => {
    return categories.filter((category) => category.branchId === branchId)
  }

  // Get products by category
  const getProductsByCategory = (categoryId) => {
    return products.filter((product) => product.categoryId === categoryId)
  }

  // Get products by branch
  const getProductsByBranch = (branchId) => {
    return products.filter((product) => product.branchId === branchId)
  }

  return (
    <DataContext.Provider
      value={{
        branches,
        categories,
        products,
        selectedBranch,
        setSelectedBranch,
        addBranch,
        updateBranch,
        deleteBranch,
        addCategory,
        updateCategory,
        deleteCategory,
        addProduct,
        updateProduct,
        deleteProduct,
        getCategoriesByBranch,
        getProductsByCategory,
        getProductsByBranch,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

// Custom hook to use the context
export const useData = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
