# AGENTS.md

対戦表づくり：架空の町の大会の運営係になって、人数・台の数などの条件から、試合の数・回戦の数・時間内に終わる方式・シードの置き場所を答える1日5問の学習ゲーム。計算の問題に正解したら2段目「なぜその数になる？」（5つ）を選ぶ。`index.html` と `data.js`（問題の作り方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

## push する前の確認

```bash
node qa/run.mjs   # 問題（全種類×3000問：答えを data.js と別のやり方で数え直す・選び肢・答えは1つ・2段目・出典）・今日の5問と上級（3年分）・とことん・通しで遊ぶ・続きから・2段目・復習・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 中身：試合の数は計算で出す（勝ち抜き n−1・総当たり n(n−1)/2・ダブルエリミネーション 2n−2 か決勝のやり直しで 2n−1・スイス方式 回戦×⌊n/2⌋・勝ち抜きの回戦 ⌈log2 n⌉・シード 2^⌈log2 n⌉−n）。`qa/run.mjs` は data.js と別のやり方（試合を1つずつ進めて数える）で全問を数え直す。決まりの言葉は FIDE Handbook（C.04.1 スイス方式・C.05 Annex 1 ベルガー表）だけ（`SRC`）。町・大会・選手はすべて架空。お金・賭け・政治・実在の大会や選手の名前を入れない。
- 言い方：遊び方と「このゲームについて」と README に、町・大会・選手が練習のための架空のものであることを置く（QA が見る）。
- 1問の流れ：条件を読んで選ぶ（やさしい3つ・ほか4つ）→ 計算の問題と方式えらびは2段目（`G.GROUPS` の5つ。sub に数を書かない）。山の問題（`seed2`・`seed3`・`meet2`）は16枠までなら山の絵（`P.svg`）を出す。
- 今日の5問（やさしい2・ふつう2・むずかしい1、種類は重ねない）・上級（むずかしい3、今日のむずかしいと別）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。乱数は `sort` の比較の中で引かない。`KINDS`・言い回し・乱数を引く順番は、変えると過去の日の問題が変わる。公開後は変えず、変えるときは QA の `PINS` を作り直して理由を PR に書く。
- ★はまちがい＋ヒントの数（0で★3・1で★2・2以上で★1）。上級はヒントなし。時間制限なし。
- 好きなだけ遊べる：チケット・ライフ・回数制限・🔒で開くモードを入れない（shared-workflows `routines/game-dev.md` F1〜F7。QA が見る）。
- 1問を深くする：`depth.js` と `qa/depth-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。自信あり・2段目・復習（1→3→7日後）。記録 `tsh-v1`・文字 `tsh-fs`・復習 `tsh-depth`。
- 共有は遊ぶ人が押したときに開くリンクだけ。感想は Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`）を開くだけ。応援は Ko-fi へのただのリンクだけ。
- 外へ通信しない（CSP の `connect-src 'self'` を広げない）。見やすさ（`<!-- a11y:begin -->`〜`end`・`qa/a11y.mjs`）と引き継ぎ（`transfer.js`・`qa/transfer-check.mjs`）は shared-workflows `template/` の写しで、ここでは直さない。
- 画面の土台は風力階級よみ（fuuryoku-yomi）から写した（ひな形の部品は `node scripts/sync-template.mjs` で入れた）。写し元の言葉が残っていないかを QA が見る。保存の読み直しは共通部品 GameStore（`<!-- store:begin -->`〜`end`）。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、`og.png` は `node tools/make-og.cjs`。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを読み、手でマージする直前に今の head へのレビューを読み直す。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- 画面のあるページは、目的ごとに `screens.js` で # の画面に分ける（`routines/ui-rules.md` U10〜U12）。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
