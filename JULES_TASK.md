# Jules Pro Autonomous Debugging & Enhancement Mission
**Project**: FlowTool (Studio Pro - MV & Cinematic Video Production System)  
**Target Environment**: Chrome DevTools Mount / High-Speed Web App Bundle

---

## 🎯 ミッション概要
本リポジトリは、Google Flow Tools 上にマウントして動作するシネマティック映像・音楽MV制作支援ツール（FlowTool Studio Pro）です。
本日のアップデートにより、**「GSAP & CSS アニメーションによるキネティック・タイポグラフィ」「多彩ネオンカラーパレット」「テロップ演出一括リロール機能（画像再生成なし）」「全12カット中サビ1回のみカメラ目線制限」** などの新機能が導入されました。

Jules は就寝中のユーザーに代わり、コードベース全体の**徹底的な静的解析・型安全性検証・パフォーマンスおよびメモリリークのデバッグ・動作安定化**を自律的に遂行してください。

---

## 📌 重点デバッグ＆検証項目

### 1. TypeScript 型安全性とビルド整合性 (Zero Type Errors)
- **現状**:
  - `types.ts`: `TelopStyle` に `'traditional-sumi'` を追加済み。
  - `components/Primitives.tsx`: `PillButton` に `title?: string;` を追加済み。
  - `components/MediaPreviewModal.tsx`: `highlightIndices` の型を `Map<number, { color: string; sizeScale: number; word?: string }>` に整合済み。
- **検証作業**:
  - ローカルSSDビルド環境（`~/.flowtool_build`）にて `npx tsc --noEmit` を実行し、型エラーが 0 件であることを継続的に維持すること。

### 2. GSAP アニメーションと DOM ライフサイクルのデバッグ
- **対象ファイル**: `components/MediaPreviewModal.tsx`
- **チェックポイント**:
  - GSAP または CSS アニメーション適用時に、モーダルクローズ時やカット切り替え時（`nextCut`, `prevCut`）にアニメーションタイマーやTweenがリーク（重複実行）していないか。
  - `useEffect` のクリーンアップ関数でアニメーションの Kill や DOM 参照の破棄が確実に行われているか。
  - テロップ一括リロール（`onBulkRerollTelop`）実行時に、未定義変数や不正な CSS クラス（`undefined` や `null`）が DOM の `className` や `style` に混入しないか。

### 3. ブラウザ動画レンダリングエンジン（Offscreen Canvas / Mediabunny）の完全同期
- **対象ファイル**: `services/browserVideoService.ts`
- **チェックポイント**:
  - `MediaPreviewModal.tsx` 上でプレビューされるトランジション（`animista-slide-bck`, `aos-fade-soft`, `gsap-kinetic-stagger`）およびネオンパレット（ゴールド、シアン、ピンク、ライム、オレンジ、パープル）が、ブラウザ動画化（Canvas焼き込み）時にも完全に同一の見た目でレンダリングされること。
  - Canvas 描画ループ内のメモリ割り当て（毎フレームの不要なオブジェクト生成）を最小化し、4K/フルHDの動画書き出し時にブラウザがクラッシュしないか検証すること。

### 4. MVモードのカメラ目線制限ロジックの厳格性
- **対象ファイル**: `services/directorService.ts`, `services/promptEngine.ts`
- **仕様**:
  - 12カット中、サビのクライマックス（`cutId === 8` または `(cutId % 12) === 8`）の**1回のみ**カメラ目線（`direct captivating eye contact`）を許可。
  - 残り11カットは徹底して「視線外し・横顔・伏し目・後ろ姿・ドキュメンタリー構図」をプロンプトおよびネガティブプロンプトで排除。
- **チェックポイント**:
  - カット番号が 12 を超えた連番（Cut 13〜24 等）でも `cutId % 12 === 8` で正確にサビ位置だけが判定されているか。
  - ドラマ連番モード（`isMvMode === false`）やマンガモード（`isMangaMode === true`）に意図しない副作用を与えていないか。

---

## 🛠️ コマンドと実行パイプライン

### ビルドと型チェック
```powershell
# SSDキャッシュ環境での型チェック
Set-Location "$env:USERPROFILE\.flowtool_build"
npx tsc --noEmit

# 高速ビルド
npm run build
```

### デプロイパイプライン
```powershell
# ルートディレクトリで実行（ビルド・Gitコミット・GitHubプッシュ・jsDelivr CDNパージが全自動実行されます）
npm run deploy
```

---

## 💡 Jules への注意事項
1. **画像再生成なしの原則**:
   - テロップ演出やレイアウトのリロール機能は、画像生成API（Gemini/Imagen）を消費せず、フロントエンドおよびメタデータのみを更新する設計です。この原則を絶対に壊さないでください。
2. **CDN 配信の完全性**:
   - `scripts/deploy.mjs` が生成する `MOUNT_COMMAND.js` は、GitHub の最新コミットハッシュで jsDelivr から配信されます。常にビルド成果物 `dist/bundle.js` が最新コミットに含まれるようにしてください。
