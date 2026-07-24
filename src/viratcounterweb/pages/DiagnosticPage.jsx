import { useState, useEffect } from 'react'
import counterApi from '../services/counterApi'

export default function DiagnosticPage() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      setLoading(true)
      
      // Get branches to test connection
      const branches = await counterApi.getBranches()
      
      // Get backend URL from environment
      const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
      
      setInfo({
        backendUrl,
        connected: true,
        branches: branches,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      setInfo({
        backendUrl: import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h2>🔍 Checking Connection...</h2>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px' }}>
      <h2>🔍 Backend Connection Diagnostic</h2>
      
      <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>Connection Info:</h3>
        <p><strong>Backend URL:</strong> {info.backendUrl}</p>
        <p><strong>Status:</strong> {info.connected ? '✅ Connected' : '❌ Disconnected'}</p>
        <p><strong>Timestamp:</strong> {info.timestamp}</p>
      </div>

      {info.connected && info.branches && (
        <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
          <h3>Branches Found:</h3>
          <pre style={{ background: 'white', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(info.branches, null, 2)}
          </pre>
        </div>
      )}

      {!info.connected && (
        <div style={{ background: '#ffebee', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
          <h3>Error:</h3>
          <p>{info.error}</p>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={checkConnection}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>⚠️ Troubleshooting:</h3>
        <ol>
          <li>Check if backend server is running on port 9000</li>
          <li>Verify .env file has correct VITE_BACKEND_PRIMARY</li>
          <li>Clear browser cache (Ctrl+Shift+Delete)</li>
          <li>Check backend .env for correct MONGO_URI</li>
          <li>Restart backend server if database was changed</li>
        </ol>
      </div>
    </div>
  )
}
