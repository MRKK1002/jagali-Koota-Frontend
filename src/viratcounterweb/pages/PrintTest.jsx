import { useState } from "react"
import thermalPrinter from "../services/thermalPrinter"

const PrintTest = () => {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const handleTestPrint = async () => {
    setTesting(true)
    setResult(null)
    
    try {
      const testData = {
        selectedBranch: {
          name: "Hotel Virat Test",
          address: "123 Test Street, Test City",
          phone: "123-456-7890"
        },
        invoiceNumber: "TEST-" + Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        customerName: "Test Customer",
        phoneNumber: "1234567890",
        cartItems: [
          { name: "Test Item 1", price: 10.00, quantity: 2 },
          { name: "Test Item 2", price: 15.50, quantity: 1 }
        ],
        total: 35.50,
        paymentMethod: "cash",
        amountReceived: 40.00,
        change: 4.50
      }
      
      const response = await thermalPrinter.printReceipt(testData, {
        method: 'auto',
        printerIP: '192.168.1.100',
        port: 9100
      });
      
      setResult({ type: 'success', message: 'Test print successful!', details: response });
    } catch (error) {
      setResult({ type: 'error', message: error.message, details: error });
    } finally {
      setTesting(false);
    }
  }

  const handleTestBill = async () => {
    setTesting(true)
    setResult(null)
    
    try {
      const testData = {
        selectedBranch: {
          name: "Hotel Virat Test",
          address: "123 Test Street, Test City",
          phone: "123-456-7890"
        },
        invoiceNumber: "BILL-" + Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        customerName: "Test Customer",
        phoneNumber: "1234567890",
        cartItems: [
          { name: "Test Item 1", price: 10.00, quantity: 2 },
          { name: "Test Item 2", price: 15.50, quantity: 1 }
        ],
        total: 35.50
      }
      
      const response = await thermalPrinter.printBill(testData, {
        method: 'auto',
        printerIP: '192.168.1.100',
        port: 9100
      });
      
      setResult({ type: 'success', message: 'Test bill print successful!', details: response });
    } catch (error) {
      setResult({ type: 'error', message: error.message, details: error });
    } finally {
      setTesting(false);
    }
  }

  const handleTestEndpoint = async () => {
    setTesting(true)
    setResult(null)
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel';
      
      const response = await fetch(`${backendUrl}/print-thermal/network`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test endpoint connection',
          printerIP: '192.168.1.100',
          port: 9100
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult({ type: 'success', message: 'Endpoint accessible!', details: data });
      } else {
        setResult({ type: 'info', message: 'Endpoint accessible (printer not found is expected)', details: data });
      }
    } catch (error) {
      setResult({ type: 'error', message: 'Endpoint not accessible: ' + error.message, details: error });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Thermal Printer Test</h1>
          <p className="counter-subtitle">Test thermal printing functionality</p>
        </div>

        {/* Test Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: '16px',
          marginBottom: '24px'
        }}>
          <button
            className="counter-button"
            onClick={handleTestEndpoint}
            disabled={testing}
          >
            {testing ? '🔄 Testing...' : '🔗 Test Endpoint'}
          </button>
          <button
            className="counter-button"
            onClick={handleTestBill}
            disabled={testing}
          >
            {testing ? '🔄 Testing...' : '📄 Test Bill'}
          </button>
          <button
            className="counter-button"
            onClick={handleTestPrint}
            disabled={testing}
          >
            {testing ? '🔄 Testing...' : '🧾 Test Receipt'}
          </button>
        </div>

        {/* Environment Info */}
        <div style={{ 
          background: '#f7fafc', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Environment Info</h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem' }}>
            <strong>Backend URL:</strong> {import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'}
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem' }}>
            <strong>Print Endpoint:</strong> {(import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel') + '/print-thermal/network'}
          </p>
          <p style={{ margin: '0', fontSize: '0.875rem' }}>
            <strong>Web Serial Support:</strong> {'serial' in navigator ? '✅ Supported' : '❌ Not Supported'}
          </p>
        </div>

        {/* Result Display */}
        {result && (
          <div style={{ 
            background: result.type === 'success' ? '#f0fff4' : result.type === 'info' ? '#e6fffa' : '#fed7d7', 
            padding: '16px', 
            borderRadius: '8px',
            border: `1px solid ${result.type === 'success' ? '#68d391' : result.type === 'info' ? '#81e6d9' : '#fc8181'}`,
            marginBottom: '24px'
          }}>
            <div style={{ 
              color: result.type === 'success' ? '#22543d' : result.type === 'info' ? '#234e52' : '#742a2a', 
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              {result.type === 'success' ? '✅' : result.type === 'info' ? 'ℹ️' : '❌'} {result.message}
            </div>
            {result.details && (
              <details style={{ fontSize: '0.875rem', color: '#4a5568' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>View Details</summary>
                <pre style={{ 
                  background: 'rgba(0,0,0,0.1)', 
                  padding: '8px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.75rem'
                }}>
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Instructions */}
        <div style={{ 
          background: '#e6fffa', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          border: '1px solid #81e6d9'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#234e52' }}>
            📋 Test Instructions
          </h3>
          <ol style={{ margin: '0', paddingLeft: '20px', color: '#2d3748', fontSize: '0.875rem' }}>
            <li><strong>Test Endpoint:</strong> Checks if backend API is accessible</li>
            <li><strong>Test Bill:</strong> Tests bill printing (before payment)</li>
            <li><strong>Test Receipt:</strong> Tests receipt printing (after payment)</li>
          </ol>
        </div>

        {/* Back Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="counter-button-secondary"
            onClick={() => window.history.back()}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintTest