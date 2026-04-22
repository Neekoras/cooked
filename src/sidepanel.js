import { createRoot } from 'react-dom/client';
import { Component } from 'react';
import Sidebar from './ui/Sidebar';
import styles from './styles/base.css';

// Inject styles into side panel document
if (!document.getElementById('cooked-styles')) {
  const style = document.createElement('style');
  style.id = 'cooked-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="ck-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ck-error">
            <p className="ck-error-title">Something went wrong</p>
            <p className="ck-error-body">
              <button className="ck-btn" style={{ marginTop: 12 }} onClick={() => this.setState({ crashed: false })}>
                Try again
              </button>
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="ck-root" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar embedded />
      </div>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')).render(<App />);
