import { render } from 'preact';
import { App } from './app.tsx';
import './styles/index.css';

render(<App />, document.getElementById('app')!);

// Register the service worker (skipped on file:// and during Vite HMR host).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore — offline install is best-effort */
    });
  });
}
