# Sketch — SoundFont

GitHub Pagesで公開する、端末保存版のモバイルMIDIエディターです。

MIDI入力・編集、ループ再生、SoundFont読み込み、楽器・エンベロープ・ディレイ、WAV/MIDI書き出しを利用できます。ログイン・オンライン保存・SoundFontの公開共有はありません。訪問者の登録も不要です。

UIは既存のラック・ピアノロール・下部コントロールの配置を維持し、白とグレーのマットな背景、黒い再生ボタン、角丸の形、統一した線のアイコンで構成しています。楽器名はSF2ヘッダーの最初の終端文字までを読み、保存済みの不正な末尾も復元時に取り除きます。

## 保存場所

プロジェクトと読み込んだSF2は、その端末・ブラウザ・サイトURLのIndexedDBに自動保存します。アプリを閉じても残りますが、別端末には引き継がれません。Webサイトデータの削除、プライベートブラウズ終了、ブラウザによる容量整理で失われる場合があります。SF2は端末の空き容量とブラウザの保存上限にも依存します。

以前のchatgpt.siteのデータはそのままです。異なるURLへのデータの自動移転は行いません。このフォルダーに利用者の曲やアカウント情報は含めていません。各端末からインポートしたSF2をサイトへアップロードする機能もありません。

## 無料公開

1. GitHubの無料アカウントを作成します: https://github.com/signup
2. 空の公開リポジトリ `sketch` を作成し、このフォルダーの内容をmainブランチにpushします。GitHub FreeではPagesに使うリポジトリは公開が必要です。
3. リポジトリの Settings → Pages → Source を **GitHub Actions** にします。
4. Actions → Publish Sketch → Run workflow。以後はmainへのpushで自動更新されます。
5. 成功時に表示される `https://ユーザー名.github.io/sketch/` が公開URLです。独自ドメインの購入は不要です。

公開対象は `site/` のみです。テストデータは配信されません。標準のGeneralUser GSと追加12個のSF2はGitのpushで転送してください。1GB超の個人のSF2をGitHubへアップロードする必要はなく、アプリから各端末に読み込みます。

GitHub Pagesにはサイト容量・帯域の制限があります。公式仕様: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## ローカル確認

Node.js 22以降で、追加パッケージのインストールなしに実行できます。

```
npm start
npm run check
npm test
```

プレビューは `http://127.0.0.1:4183/sketch/` です。公開URLのサブディレクトリと同じ条件で動作確認できます。iPhoneで使うには公開後のHTTPS URLをSafariで開きます。

初回にアプリ本体と音源一覧だけをオフラインキャッシュします。SoundFont本体は選択・再生に必要になったものだけをダウンロードしてIndexedDBに保存します。同時に同じ音源を使っても取得は一回だけです。次回起動時は保存済みのBlobを利用し、再ダウンロードも全ファイルの再検証も行いません。端末のサイトデータを消した場合には再取得が必要です。

標準音源は13個、計1,975音色です。GeneralUser GSに加え、Pokemon HGSS / DPPt / Black and White 2 / Emerald、Mother 3 / 1+2、New Super Mario Bros DS、Lil'Sness、GenesiSF、KEYGEN、SNES、gmを同梱しています。追加分の容量は約154MiBです。`site/bundled-fonts.js` と `site/additional-fonts.js` が一覧・音色・ファイルの識別情報を持ちます。

GeneralUser GSはMicrosoft GS Wavetableそのものではありません。GeneralUser GSのライセンスは `site/GeneralUser-LICENSE.txt`、音源エンジンの表示は `site/THIRD_PARTY_NOTICES.txt` を参照してください。
