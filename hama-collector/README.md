# ◯浜コレクター

旅行先や知り合いの名前に出てくる「◯浜」を、写真つきでみんなで集めていく
プライベート用Webアプリ。バックエンドはGitHubリポジトリそのもの。
外部サービス不要、デプロイはGitHub Pages。

## セットアップ（スマホだけで完結）

すべてGitHubのモバイルWeb（もしくはGitHubモバイルアプリ）で実施できます。

### 1. fine-grained PAT を発行する

1. GitHubで右上アイコン → **Settings**
2. サイドバー下部の **Developer settings**
3. **Personal access tokens → Fine-grained tokens → Generate new token**
4. 設定:
   - **Token name**: `hama-collector`（任意）
   - **Expiration**: 1年など任意
   - **Repository access**: *Only select repositories* → `magosuke-net/proposals` を選択
   - **Repository permissions** → **Contents**: `Read and write`
   - 他は触らない
5. **Generate token** → 表示されたトークンをコピー（1回しか表示されません）

### 2. 合言葉を決める

友達と共有する「合言葉」を決めます。例: `hamahama2026`
※ JSに平文で埋め込まれるため、ゆるめの「合言葉」だと割り切ってください。

### 3. config.js を作成

GitHubのWebUIで:

1. リポジトリを開く → `hama-collector/config.example.js` を開く
2. 右上の鉛筆アイコン（Edit）をタップ
3. URL末尾を `config.example.js` → `config.js` に変える前に、一度内容を全てコピー
4. リポジトリ直下に戻り、`hama-collector/` を開く → **Add file → Create new file**
5. ファイル名に `config.js` と入力
6. 先ほどコピーした内容を貼り付け、`githubPat` と `passphrase` を埋める
7. **Commit changes** → `main` へ直接コミット

### 4. GitHub Pages を有効化

1. リポジトリ **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / `/ (root)` → **Save**
4. 数十秒待つと公開URLが表示されます

公開URL（予定）:
`https://magosuke-net.github.io/proposals/hama-collector/`

### 5. 動作確認

- 上記URLにアクセス
- ニックネームと合言葉を入力して入る
- 「追加」タブから浜を1件登録 → 「一覧」に表示されればOK

## 使い方

- **ニックネーム**: 端末に保存されます。自分が追加した浜には削除ボタンが出ます。
- **写真**: 自動で長辺1280pxにリサイズしてアップロードします（~200KB前後）。
- **検索**: 一覧タブの検索ボックスで、名前・場所・メモ・追加者を横断検索。
- **リポジトリがpublicの場合**: `data/hamas.json` と `data/photos/` は誰でも閲覧可能です。
  プライバシーに関わる内容は書かないでください。書き込みは合言葉+PATで保護されています。

## 技術メモ

- データ: `hama-collector/data/hamas.json`（コミット履歴がそのまま更新ログ）
- 写真: `hama-collector/data/photos/<uuid>.jpg`
- 書き込み: GitHub Contents API（PUT）にfine-grained PATで認証
- 同時編集の衝突: `sha`で楽観ロック、409/422時は1回だけ自動リトライ
- 読み込み: GitHub Pagesの静的配信から `fetch()`（認証なし、キャッシュ無効化パラメータ付与）

## セキュリティの割り切り

- PATはJSに埋め込まれるため、URLを知っている人がdevtoolsを開けば取り出せます。
- 漏洩時は: GitHub Settings → Personal access tokens から該当PATを **Revoke** し、
  新しいPATを発行して `config.js` を更新するだけで復旧できます。
- より強固な運用が必要になったら、Supabase等のバックエンドに移行するのが自然な次ステップ。

## トラブルシューティング

- **「設定エラー: passphrase が未設定です」** → `config.js` がコミットされていない、または値がプレースホルダのまま。
- **登録時に 401 / 403** → PATの権限不足（Contents: Read/Writeを確認）または期限切れ。
- **登録直後に一覧へ反映されない** → GitHub Pagesのキャッシュが数十秒効くことがあります。「⟳」で再読み込み。
- **iOSで写真アップロードが重い** → 大きい画像はリサイズに時間がかかります。数秒待ってください。
