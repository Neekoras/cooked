import { createRoot } from 'react-dom/client';
import { useState, Component } from 'react';
import Sidebar from './ui/Sidebar';
import styles from './styles/base.css';

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
        <div className="ck-root">
          <div className="ck-panel is-open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ck-error" style={{ textAlign: 'center' }}>
              <p className="ck-error-title">Something went wrong</p>
              <p className="ck-error-body">
                <button className="ck-btn" style={{ marginTop: 12 }} onClick={() => this.setState({ crashed: false })}>
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isOpen, setIsOpen] = useState(
    () => sessionStorage.getItem('ck-open') === '1'
  );

  function toggle() {
    setIsOpen(v => {
      const next = !v;
      sessionStorage.setItem('ck-open', next ? '1' : '0');
      return next;
    });
  }

  return (
    <ErrorBoundary>
      <div className="ck-root">
        <Sidebar isOpen={isOpen} onToggle={toggle} />
      </div>
    </ErrorBoundary>
  );
}

function mount() {
  if (document.getElementById('cooked-root')) return;

  console.log('[Cooked] mounting...');

  if (!document.getElementById('cooked-fonts')) {
    const link = document.createElement('link');
    link.id = 'cooked-fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700' +
      '&family=DM+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('cooked-styles')) {
    const style = document.createElement('style');
    style.id = 'cooked-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.id = 'cooked-root';
  Object.assign(root.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });
  document.body.appendChild(root);

  createRoot(root).render(<App />);
  console.log('[Cooked] mounted ✓');
}

mount();

// Re-mount on SPA navigation
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    if (/\/courses\/\d+\/grades/.test(location.href)) {
      mount();
    }
  }
}).observe(document.body, { childList: true, subtree: true });
