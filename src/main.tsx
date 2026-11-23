import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadLocal } from './lib/store';
import './styles.css';

/** Last-resort error screen so a bug never shows a blank page. */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="onb">
        <div className="onb-card stack">
          <h1>Something went wrong</h1>
          <p className="muted">Your data is safe on this device. Reload to continue.</p>
          <pre className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.err.message)}</pre>
          <button className="btn" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

loadLocal();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
