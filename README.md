# Sketch — SoundFont

GitHub Pagesで公開する、端末保存版のモバイルMIDIエディターです。

MIDI入力・編集、ループ再生、SoundFont読み込み、楽器・エンベロープ・ディレイ、WAV/MIDI書き出しを利用できます。ログイン・オンライン保存・SoundFontの公開共有はありません。訪問者の登録も不要です。

Song／アレンジメント、サンプラー、サンプル専用ブラウザーはWeb版には含めません。将来のAPK版向けの仕様・試作コードは、公開リポジトリの外に保管しています。

ノート削除は消しゴムモードで行います。長押しの範囲選択は画面端でスクロールし、右への複製は選択範囲が占める小節幅を保ちます。スライドノートとチャンネル別CENTは再生とWAVに反映します。MIDI書き出しは通常ノートとチューニングを出力しますが、スライドの連続的な音程変化はまだ出力しません。

ピアノロール上部の目盛りをタップすると、その位置から再生します。目盛りをドラッグすると従来どおりスクロールします。上部の「Go to start」で先頭へ戻れます。途中再生では、その位置に重なるノートを鳴らし直し、スライド中の音程と残り時間を復元します。音源のサンプル位置・エンベロープ・過去のディレイは再開時にリセットします。

WAVは最終ノートと音源・ディレイの余韻まで書き出し、末尾の空小節を省きます。無限に続くフィードバックは最終ノートから2分でフェードアウトします。

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

鉛筆モードでは空白をタップすると追加、ノート本体をタップすると削除します。ドラッグ、長押し選択、右端の長さ変更では削除しません。削除はUndoで戻せます。消しゴムでは従来通りなぞって削除できます。

Export → Stemsは、発音するチャンネルをラック順に1本のステレオWAVへ並べます。各チャンネルの先頭の休符、音量、パン、ピッチ、エンベロープ、ディレイを保持し、同じ小節幅の区間の間に1小節の無音を入れます。余韻がループ長を超える場合は区間を小節単位で延長し、最後は最終ステムの余韻まで書き出します。Mute/Soloを反映し、空のチャンネルは省きます。通常のAudio書き出しはミックスのままです。

試聴は音色設定だけを音源へ先に送信し、MIDI全体の更新を待ちません。プロジェクトを開くと使用する音源を準備します。再生バーはWeb Audioの出力時刻（非対応環境では報告された遅延値）に合わせます。実機の出力遅延・録画性能は端末とブラウザにも依存します。

標準音源は16個、計2,475音色です。GeneralUser GSに加え、Pokemon HGSS / DPPt / Black and White 2 / Emerald、Mother 3 / 1+2、New Super Mario Bros DS、Lil'Sness、GenesiSF、KEYGEN、SNES、gm、GS Wavetable Synth、Mario Party DS、PW AAを同梱しています。GeneralUser GS以外の音源容量は約171MiBです。`site/bundled-fonts.js` と `site/additional-fonts.js` が一覧・音色・ファイルの識別情報を持ちます。

GeneralUser GSはMicrosoft GS Wavetableそのものではありません。GeneralUser GSのライセンスは `site/GeneralUser-LICENSE.txt`、音源エンジンの表示は `site/THIRD_PARTY_NOTICES.txt` を参照してください。

ステムの先頭には全体の4小節ミックスを付けます（短いパターンは繰り返し、長いパターンは先頭4小節）。その後、1小節の無音を挟んで各パートを並べます。共有は音声ファイルのみを渡します。音源処理の応答が途切れた場合、再生時に音源を作り直します。

Melody lab（試作）: ピアノロール上部の波線ボタンから開きます。Key・Scale・Barsを選択し、線を描いてからTap rhythmを押します。4拍のカウント後、タップした位置の線に対応する音が鳴り、そのタイミングを記録します。タップに合うグリッドを自動選択してクオンタイズします。Regenerateは音程だけを変更し、↑/↓ Keyはキー内の音域移動、± Octはオクターブ移動です。Metronomeは入力・試聴中に使えます。Add notesで既存チャンネルにノートを追加します（Undo可）。入力中の下書きは保存されず、追加したノートは通常のプロジェクトに保存されます。

Melody lab now draws directly in the piano roll. Set the bottom-right Snap before recording. Tap rhythm records at half speed; hold the pad for longer notes. Playback uses the project BPM. Add notes commits the draft.
