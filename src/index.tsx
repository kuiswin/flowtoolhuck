import React from 'react';
import ReactDOM from 'react-dom/client';
import { Flow } from 'flow-sdk';
import App from '../App';
import './style.css';

// ブラウザの importmap から解決された Flow を window.Flow にも保持
if (typeof window !== 'undefined') {
  if (Flow) {
    (window as any).Flow = Flow;
  }
}

// Material Symbols フォントの動的注入（Flow Tools iframe内でのアイコン表示を保証）
function ensureMaterialIcons() {
  if (typeof document === 'undefined') return;
  const FONT_ID = 'flowtool-material-symbols';
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    document.head.appendChild(link);
  }
}

let reactRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLElement | null = null;

/**
 * FlowTool React アプリケーションをターゲットDOMにマウントする
 * @param targetElement マウント先DOM要素 (省略時は #root または document.body)
 */
export function mount(targetElement?: HTMLElement | null): { unmount: () => void } {
  ensureMaterialIcons();

  const container = targetElement || document.getElementById('root') || document.body;
  if (!container) {
    console.error('[FlowTool] Target container could not be found to mount the application.');
    return { unmount: () => {} };
  }

  // 既にマウント済みの場合は再利用またはクリーンアップ
  if (reactRoot && currentContainer === container) {
    console.log('[FlowTool] Already mounted on this container. Re-rendering...');
    reactRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    return { unmount };
  }

  if (reactRoot) {
    try {
      reactRoot.unmount();
    } catch (e) {
      console.warn('[FlowTool] Previous root unmount warning:', e);
    }
    reactRoot = null;
  }

  currentContainer = container;
  reactRoot = ReactDOM.createRoot(container);
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('🚀 [FlowTool] Mounted successfully into target container:', container);
  return { unmount };
}

/**
 * アプリケーションのアンマウント
 */
export function unmount() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
    currentContainer = null;
    console.log('[FlowTool] Unmounted successfully.');
  }
}

// グローバル参照としても登録
if (typeof window !== 'undefined') {
  (window as any).FlowTool = {
    mount,
    unmount,
    version: '1.0.0',
    App,
    Flow
  };
}

export { App, Flow };
export default { mount, unmount, App, Flow };
