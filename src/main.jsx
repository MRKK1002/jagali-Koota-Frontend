import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import { DataProvider } from "./context/DataContext"
import "./App.css"

// Suppress non-boolean jsx attribute warning from React DevTools and styled-jsx
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].includes('Received `true` for a non-boolean attribute `jsx`') ||
    args[0].includes('jsx') && args[0].includes('non-boolean attribute')
  )) {
    return;
  }
  originalError.apply(console, args);
};

console.warn = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].includes('Received `true` for a non-boolean attribute `jsx`') ||
    args[0].includes('jsx') && args[0].includes('non-boolean attribute')
  )) {
    return;
  }
  originalWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>,
)
