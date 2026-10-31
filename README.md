# Sketch — SoundFont

GitHub Pagesで公開する、端末保存版のモバイルMIDIエディターです。

MIDI入力・編集、ループ再生、SoundFont読み込み、楽器・エンベロープ・ディレイ、WAV/MIDI書き出しを利用できます。ログイン・オンライン保存・SoundFontの公開共有はありません。訪問者の登録も不要です。

UIは既存のラック・ピアノロール・下部コントロールの配置を維持し、白とグレーのマットな背景、黒い再生ボタン、角丸の形、統一した線のアイコンで構成しています。楽器名はSF2ヘッダーの最初の終端文字までを読み、保存済みの不正な末尾も復元時に取り除きます。

## 保存場所

プロジェクトと読み込んだSF2は、その端末・ブラウザ・サイトURLのIndexedDBに自動保存します。アプリを閉じても残りますが、別端末には引き継がれません。Webサイトデータの削除、プライベートブラウズ終了、ブラウザによる容量整理で失われる場合があります。SF2は端末の空き容量とブラウザの保存上限にも依存します。

以前のchatgpt.siteのデータはそのままです。異なるURLへのデータの自動移転は行いません。このフォルダーに利用者の曲、アカウント情報、読み込んだ個人のSF2は含めていません。

## 無料公開

1. GitHubの無料アカウントを作成します: https://github.com/signup
2. 空の公開リポジトリ `sketch` を作成し、このフォルダーの内容をmainブランチにpushします。GitHub FreeではPagesに使うリポジトリは公開が必要です。
3. リポジトリの Settings → Pages → Source を **GitHub Actions** にします。
4. Actions → Publish Sketch → Run workflow。以後はmainへのpushで自動更新されます。
5. 成功時に表示される `https://ユーザー名.github.io/sketch/` が公開URLです。独自ドメインの購入は不要です。

公開対象は `site/` のみです。テストデータは配信されません。GeneralUser GSの約31MBのSF2はGitのpushで転送してください（GitHubのブラウザ単体アップロード上限を超えます）。1GB超の個人のSF2をGitHubへアップロードする必要はなく、アプリから各端末に読み込みます。

GitHub Pagesにはサイト容量・帯域の制限があります。公式仕様: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## ローカル確認

Node.js 22以降で、追加パッケージのインストールなしに実行できます。

```
npm start
npm run check
npm test
```

プレビューは `http://127.0.0.1:4183/sketch/` です。公開URLのサブディレクトリと同じ条件で動作確認できます。iPhoneで使うには公開後のHTTPS URLをSafariで開きます。

初回にアプリ本体をオフラインキャッシュし、標準のGeneralUser GSは最初に音を鳴らすときに読み込んで端末保存します。標準音源はMicrosoft GS Wavetableそのものではありません。ライセンスは `site/GeneralUser-LICENSE.txt`、音源エンジンの表示は `site/THIRD_PARTY_NOTICES.txt` を参照してください。
