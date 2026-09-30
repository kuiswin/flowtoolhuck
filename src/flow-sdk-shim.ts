/**
 * flow-sdk-shim.ts
 * Google Flow Tools のプレビュー環境で利用可能なグローバル Flow オブジェクト、
 * またはホスト環境から提供される Flow SDK へのブリッジ。
 */

function getGlobalFlow(): any {
  if (typeof window !== 'undefined') {
    if ((window as any).Flow) return (window as any).Flow;
    if ((window as any).__FLOW__?.Flow) return (window as any).__FLOW__.Flow;
    if ((window as any).flowSdk?.Flow) return (window as any).flowSdk.Flow;
  }
  if (typeof globalThis !== 'undefined') {
    if ((globalThis as any).Flow) return (globalThis as any).Flow;
  }
  return null;
}

// 呼び出し先を動的に委譲する Proxy オブジェクト
function createFlowProxy(path: string[] = []): any {
  return new Proxy(() => {}, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;
      return createFlowProxy([...path, prop]);
    },
    apply(_target, _thisArg, args) {
      const realFlow = getGlobalFlow();
      if (realFlow) {
        let current = realFlow;
        for (const segment of path) {
          if (current == null) break;
          current = current[segment];
        }
        if (typeof current === 'function') {
          return current.apply(realFlow, args);
        }
        if (current !== undefined) {
          return current;
        }
      }

      const methodPath = ['Flow', ...path].join('.');
      console.warn(`[FlowSDK Shim] "${methodPath}" was called, but window.Flow is not defined on the host page.`, {
        path: methodPath,
        args,
      });

      // 開発・デバッグ用フォールバック
      if (path[0] === 'download') {
        const file = args[0];
        console.log(`[FlowSDK Shim Mock] Downloading ${file?.filename || 'file'}...`);
        if (typeof document !== 'undefined' && file?.base64) {
          const a = document.createElement('a');
          a.href = `data:${file.mimeType || 'application/octet-stream'};base64,${file.base64}`;
          a.download = file.filename || 'download.bin';
          a.click();
        }
        return Promise.resolve();
      }

      throw new Error(
        `[FlowSDK Shim] ${methodPath} is not available. Please ensure window.Flow is exposed in the Flow Tools environment.`
      );
    }
  });
}

export const Flow: any = createFlowProxy();
export default Flow;
