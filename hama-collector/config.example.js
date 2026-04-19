// このファイルをコピーして「config.js」にリネームし、値を埋めてください。
// config.js はリポジトリにコミットされる前提です（PATを含みます）。
// 必ず fine-grained PAT を、このリポジトリのみ・Contents: Read and write のみで発行してください。

window.APP_CONFIG = {
  // GitHubのユーザー名または組織名
  owner: "magosuke-net",

  // リポジトリ名
  repo: "proposals",

  // コミット対象ブランチ（GitHub Pagesが公開しているブランチ）
  branch: "main",

  // hamas.jsonのリポジトリ相対パス
  dataPath: "hama-collector/data/hamas.json",

  // 写真を置くディレクトリ（リポジトリ相対パス）
  photosDir: "hama-collector/data/photos",

  // fine-grained PAT（このリポジトリのみ, Contents Read/Writeのみ）
  githubPat: "__CHANGE_ME__",

  // アプリに入るための合言葉（平文）
  passphrase: "__CHANGE_ME__",
};
