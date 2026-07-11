import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  state = { hasError: false, error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: any) { 
    console.error("React Error:", error, errorInfo); 
    fetch('http://localhost:9999/log', { method: 'POST', body: error.stack + '\n' + JSON.stringify(errorInfo) }).catch(() => {});
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#ff5555', padding: '20px', background: '#111', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>React Application Crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', background: '#000', padding: '10px', borderRadius: '4px' }}>
            {this.state.error?.stack || this.state.error?.message || "Unknown Error"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
