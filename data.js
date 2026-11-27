// 対戦表づくりの問題を作る（ブラウザと node の両方で使う）。
// 遊ぶ人は架空の町の大会の運営係。人数・台の数などの条件から、試合の数・回戦の数・方式・シードの置き場所を答える。
// 試合の数は計算で出す（勝ち抜き n−1・総当たり n(n−1)/2・ダブルエリミネーション 2n−2 か 2n−1・スイス方式 回戦×⌊n/2⌋）。
// 方式の決まりの言葉は FIDE Handbook（C.04.1 スイス方式の基本の決まり・C.05 Annex 1 ベルガー表）だけ（2026-11-26 に読んだ。
// 要点は共有フォルダ games/taisen-hyo-research.md）。大会・町・選手はすべて架空。お金・賭け・政治は入れない。
// 1問は、条件を読んで数か方式か枠を選ぶ（計算の問題は、正解したら2段目「なぜその数になる？」）か、決まりの問いに答える。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS・言い回し・まちがいの選び肢は、足すだけでも過去の日の問題が変わる。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    swiss: ["FIDE Handbook C.04.1 Basic rules for Swiss Systems", "https://handbook.fide.com/chapter/C0401202507"],
    berger: ["FIDE Handbook C.05 Annex 1 Details of Berger Table", "https://handbook.fide.com/chapter/C05Annex1"],
  };

  // 試合の数・回戦の数（ここだけで数える。qa/run.mjs は別のやり方で数え直す）
  const lg = (n) => { let r = 0; while ((1 << r) < n) r++; return r; }; // 2^r が n 以上になる最小の r
  const KO = (n) => n - 1, RR = (n) => (n * (n - 1)) / 2, DE = (n, re) => 2 * n - 2 + (re ? 1 : 0), SWR = (n) => lg(n) + 1, SW = (n, r) => r * Math.floor(n / 2);
  const swMax = (n) => (n % 2 === 0 ? n - 1 : n); // 同じ2人が2回当たらない（FIDE C.04.1）なら、偶数は人数−1回戦・奇数は人数回戦まで
  const rrRounds = (n) => (n % 2 === 0 ? n - 1 : n);
  const meetRound = (N, a, b) => { let r = 0; while (Math.ceil(a / 2 ** r) !== Math.ceil(b / 2 ** r)) r++; return r; };

  // 2段目「なぜその数になる？」の5つ。name・sub に数字を書かない（1段目の答えから2段目が分からないように。前の新作の CodeRabbit の指摘）
  const GROUPS = {
    lose1: { name: "試合ごとに負けた人が去る", sub: "優勝した人のほかは、みんな一度ずつ負ける" },
    lose2: { name: "二度負けて去る", sub: "優勝した人のほかは、みんな二度ずつ負ける" },
    pair: { name: "ふたりの組を全部数える", sub: "どのふたりも一度ずつ当たる" },
    half: { name: "回戦ごとに半分になる", sub: "勝った人だけが次の回戦へ進む" },
    per: { name: "回戦ごとの試合数×回戦の数", sub: "毎回、組める人はいっせいに対戦する" },
  };
  const GRP_WHY = {
    lose1: "勝ち抜き戦では、1試合ごとに負けた1人が去ります。優勝した1人のほかは全員1回ずつ負けるので、試合は人数−1です。",
    lose2: "ダブルエリミネーションでは、2回負けると去ります。優勝した人のほかは全員2回負けるので、2×(人数−1)試合。優勝した人が1敗したら＋1です。",
    pair: "総当たりでは、どの2人も1回ずつ当たります。人数×(人数−1)÷2が、2人の組の数です。",
    half: "勝ち抜き戦では、1回戦ごとに残る人が半分になります。2を何回かけると人数をこえるかが、回戦の数です。",
    per: "スイス方式では、毎回戦、組める人がいっせいに対戦します。1回戦の試合数（人数÷2の整数）×回戦の数です。",
  };
  const FMT = { ko: "勝ち抜き", de: "ダブルエリミネーション", sw: "スイス方式", rr: "総当たり" };
  const FMT_GRP = { ko: "lose1", de: "lose2", sw: "per", rr: "pair" };

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  const pick = (R, a) => a[ri(R, 0, a.length - 1)];
  // 架空の町の大会（u は対戦する場所の数え方）
  const EV = [["卓球大会", "台"], ["将棋大会", "盤"], ["囲碁大会", "盤"], ["バドミントン大会", "コート"], ["ボードゲーム大会", "卓"], ["けん玉大会", "台"]];
  const MEDIA = { ko: "勝ち抜きの山", rr: "総当たりの表", de: "2回負けたら終わり", sw: "スイス方式", fit: "運営の計画", seed: "シードの置き場所", kimari: "大会の決まり" };
  const POW = (n) => (n & (n - 1)) === 0;
  const range = (a, b, f) => { const o = []; for (let i = a; i <= b; i++) if (!f || f(i)) o.push(i); return o; };

  // 数の選び肢：答えと、よくある数えちがい（ほかの方式の式・±1）から選ぶ。やさしいは3つ、ほかは4つ
  function numOpts(R, lv, ans, cands, unit) {
    const ws = [...new Set(cands.filter((x) => Number.isInteger(x) && x > 0 && x !== ans))];
    const ds = pickN(R, ws, lv === 0 ? 2 : 3);
    return { opts: shuffle(R, [ans, ...ds]).map((x) => `${x}${unit}`), ans: `${ans}${unit}`, ds };
  }
  const near = (n) => [n - 1, n, n + 1, n - 2, n * 2, Math.floor(n / 2), n * (n - 1), RR(n), 2 * n - 2, 2 * n - 1, lg(n), lg(n) + 1];

  // 計算の問題を作る関数。どれも { q, opts, ans, why, look, key, v } を返す
  const MK = {
    koG: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = KO(n), si = ri(R, 0, 2);
      const q = [`${e}に${n}人。勝ち抜き戦（1回負けたら終わり・3位決定戦なし）なら、全部で何試合？`, `${n}人の${e}を勝ち抜き戦で（3位決定戦なし）。優勝が決まるまで全部で何試合？`, `勝ち抜き戦の${e}。${n}人だと、試合は全部でいくつ？（3位決定戦なし）`][si];
      const o = numOpts(R, lv, a, near(n), "試合");
      return { q, ...o, why: `1試合で1人ずつ負けて去ります。${n}人から優勝の1人を残すので、${n}−1＝${a}試合です。`, look: "1試合ごとに、負けた1人が大会から去ります。", key: `優勝の1人のほかは全員1回負けるので、人数−1です。`, v: `${n}:${si}:${o.ds.join(".")}` };
    },
    rrG: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = RR(n), si = ri(R, 0, 2);
      const q = [`${e}に${n}人。総当たり戦（全員と1回ずつ）なら、全部で何試合？`, `${n}人の${e}を総当たり戦で。全部で何試合？`, `総当たり戦の${e}。${n}人だと、試合は全部でいくつ？`][si];
      const o = numOpts(R, lv, a, near(n), "試合");
      return { q, ...o, why: `どの2人も1回ずつ当たります。${n}×${n - 1}÷2＝${a}試合です。`, look: "1人はほかの全員と1回ずつ当たります。", key: "人数×(人数−1)を2でわります（同じ試合を2回数えないため）。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    rrEach: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = n - 1, si = ri(R, 0, 1);
      const q = [`${e}に${n}人。総当たり戦で、1人は何試合する？`, `${n}人の総当たり戦の${e}。あなたは何試合する？`][si];
      const o = numOpts(R, lv, a, near(n), "試合");
      return { q, ...o, why: `自分のほかの${n - 1}人と1回ずつ当たるので、${a}試合です。`, look: "自分とは対戦しません。", key: "1人あたりの試合は、人数−1です。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    koR: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = lg(n), si = ri(R, 0, 1);
      const q = [`${e}に${n}人。勝ち抜き戦の山は、決勝まで何回戦ある？`, `${n}人の勝ち抜き戦の${e}。決勝は何回戦目？`][si];
      const o = numOpts(R, lv, a, [a - 1, a + 1, a + 2, a - 2, Math.floor(n / 2), n - 1, 2 * a], "回戦");
      const w = 2 ** a;
      return { q, ...o, why: POW(n) ? `1回戦ごとに半分になります。${n}人→…→1人で、2を${a}回かけると${n}。${a}回戦です。` : `${n}人は${w}枠の山に入ります。2を${a}回かけると${w}なので、${a}回戦です。`, look: "1回戦ごとに、残る人が半分になります。", key: "2を何回かけると人数以上になるかが、回戦の数です。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    rrR: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = rrRounds(n), si = ri(R, 0, 1);
      const q = [`${e}に${n}人。総当たり戦を、毎回全員が1試合ずつ（奇数なら1人休み）で回すと何回戦？`, `${n}人の総当たり戦の${e}。1回戦に1人1試合までなら、何回戦で終わる？`][si];
      const o = numOpts(R, lv, a, [n - 1, n, n + 1, n - 2, Math.floor(n / 2), RR(n)].filter((x) => x !== a), "回戦");
      return { q, ...o, why: n % 2 === 0 ? `1人${n - 1}試合を1回戦に1試合ずつするので、${a}回戦です（ベルガー表）。` : `奇数なので番号を1つ足して休みにし、${n + 1}人の表で${a}回戦です（ベルガー表）。`, look: "人数が奇数なら、毎回1人が休みです。", key: "偶数なら人数−1回戦、奇数なら人数と同じ回戦です。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    deG: (ns, re) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), a = DE(n, re), si = ri(R, 0, 1);
      const c = re ? "決勝で優勝した人が1回負け、もう1試合した" : "優勝した人は1回も負けなかった";
      const q = [`${e}に${n}人。2回負けたら終わり。${c}。全部で何試合？`, `${n}人のダブルエリミネーション。${c}。試合は全部で？`][si];
      const o = numOpts(R, lv, a, [2 * n - 2, 2 * n - 1, 2 * n, n - 1, RR(n), 2 * n - 3, n], "試合");
      return { q, ...o, why: `優勝した人のほかの${n - 1}人は2回ずつ負けます。${2 * (n - 1)}敗${re ? "に、優勝した人の1敗を足して" : "なので"}、${a}試合です。`, look: "1試合で、負けが1つ増えます。", key: "負けの数の合計＝試合の数。去る人は2敗ずつです。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    swG: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), r = ri(R, 3, Math.min(7, swMax(n))), a = SW(n, r), si = ri(R, 0, 1);
      const q = [`${e}に${n}人。スイス方式で${r}回戦。全部で何試合？（奇数なら毎回1人は不戦勝）`, `${n}人のスイス方式の${e}を${r}回戦。試合は全部でいくつ？`][si];
      const per = Math.floor(n / 2);
      const o = numOpts(R, lv, a, [r * n, per, a + r, a - r, RR(n), n - 1, (per + 1) * r, r * (n - 1)].filter((x) => x !== a), "試合");
      return { q, ...o, why: n % 2 ? `奇数なので毎回1人は相手なし。1回戦は${per}試合、×${r}回戦で${a}試合です。` : `1回戦は${n}÷2＝${per}試合。×${r}回戦で${a}試合です。`, look: "1回戦で何試合あるかを先に数えます。", key: "2人で1試合。不戦勝の人は試合をしません。", v: `${n}:${r}:${si}:${o.ds.join(".")}` };
    },
    byes: (ns) => (R, lv) => {
      const n = pick(R, ns), [e] = pick(R, EV), w = 2 ** lg(n), a = w - n, si = ri(R, 0, 1);
      const q = [`${e}に${n}人。勝ち抜きの山を${w}枠で作る。1回戦が無い人（シード）は何人？`, `${n}人の勝ち抜き戦を${w}枠の山で。1回戦をしない人は何人？`][si];
      const o = numOpts(R, lv, a, [n - w / 2, a + 1, a - 1, w / 2, a * 2, n - a], "人");
      return { q, ...o, why: `${w}枠のうち、人が入らない枠が${a}つ。その相手の${a}人は1回戦が無く、2回戦からです。`, look: "空いた枠のとなりの人は、1回戦をしません。", key: "枠の数−人数が、シードの人数です。", v: `${n}:${si}:${o.ds.join(".")}` };
    },
    // 方式えらび：時間内でいちばん多く試合ができる方式（ダブルエリミネーションは決勝のやり直しも数える。スイス方式は ⌈log2 n⌉+1 回戦）
    fit: () => (R, lv) => {
      const n = ri(R, 8, 16), [e, u] = pick(R, EV), cnt = fitCounts(n), order = ["ko", "de", "sw", "rr"];
      const ai = ri(R, 0, 3), lo = cnt[order[ai]], hi = ai === 3 ? lo + Math.floor(lo / 2) : cnt[order[ai + 1]] - 1;
      const pairs = []; for (let k = 2; k <= 8; k++) for (let t = 2; t <= 20; t++) if (k * t >= lo && k * t <= hi) pairs.push([k, t]);
      const [k, t] = pairs.length ? pick(R, pairs) : [1, lo];
      const opts = shuffle(R, order).map((f) => fitName(f, n)), ans = fitName(order[ai], n);
      const list = order.map((f) => `${FMT[f]}${cnt[f]}`).join("・");
      return { q: `${e}に${n}人。${u}は${k}${u === "コート" ? "面" : "つ"}、1${u === "コート" ? "面" : "つ"}で1日${t}試合。試合の数だけで考えて、1日に入るいちばん多い方式は？`, opts, ans, grp: FMT_GRP[order[ai]],
        why: `1日に${k * t}試合まで。試合の数は${list}。${k * t}試合に入るうち、いちばん多いのは${FMT[order[ai]]}です。`, look: `1日に${k}×${t}試合。回戦の順は考えません。`, key: "4つの方式の試合の数を数えて、入るものの中でいちばん多いものを選びます。", v: `${n}:${k}:${t}:${ai}` };
    },
    seed2: () => (R) => {
      const N = pick(R, [8, 16, 32]), p1 = pick(R, [1, N]), h = N / 2, other = p1 === 1 ? range(h + 1, N) : range(1, h), same = (p1 === 1 ? range(2, h) : range(h + 1, N - 1));
      const a = pick(R, other), ds = pickN(R, same, 3);
      return { svg: bracketSvg(N, { [p1]: "1番" }), q: `${N}枠の勝ち抜きの山（左から枠1〜${N}）。1番シードは枠${p1}。2番シードを、決勝まで当たらない枠に置くなら？`, opts: shuffle(R, [a, ...ds]).map((x) => `枠${x}`), ans: `枠${a}`,
        why: `決勝まで当たらないのは、山の反対の半分（枠${p1 === 1 ? `${h + 1}〜${N}` : `1〜${h}`}）です。枠${a}はそこに入ります。`, look: "山を上と下の半分に分けてみよう。", key: "1番と2番は、山の別の半分に置きます。", v: `${N}:${p1}:${a}:${ds.join(".")}` };
    },
    seed3: () => (R) => {
      const N = pick(R, [16, 32]), q4 = N / 4, ok = range(q4 + 1, 3 * q4), ng = range(2, q4).concat(range(3 * q4 + 1, N - 1));
      const a = pick(R, ok), ds = pickN(R, ng, 3);
      return { svg: bracketSvg(N, { 1: "1番", [N]: "2番" }), q: `${N}枠の山。1番シードは枠1、2番シードは枠${N}。3番シードを、2人と準決勝まで当たらない枠に置くなら？`, opts: shuffle(R, [a, ...ds]).map((x) => `枠${x}`), ans: `枠${a}`,
        why: `山を4つに分けると、1番は枠1〜${q4}、2番は枠${3 * q4 + 1}〜${N}。3番は残りの枠${q4 + 1}〜${3 * q4}に置きます。枠${a}はそこです。`, look: "山を4つに分けてみよう。", key: "準決勝まで当たらない＝山の4分の1が別。", v: `${N}:${a}:${ds.join(".")}` };
    },
    meet: () => (R) => {
      const N = pick(R, [16, 32]), A = ri(R, 1, N); let B = ri(R, 1, N - 1); if (B >= A) B++;
      const [x, y] = A < B ? [A, B] : [B, A], a = meetRound(N, x, y), all = range(1, lg(N)), ds = pickN(R, all.filter((r) => r !== a), 3);
      return { svg: bracketSvg(N, { [x]: "A", [y]: "B" }), q: `${N}枠の勝ち抜きの山。枠${x}と枠${y}の人が勝ち続けると、何回戦で当たる？`, opts: shuffle(R, [a, ...ds]).map((r) => `${r}回戦`), ans: `${a}回戦`,
        why: `${a}回戦は、となりあう${2 ** a}枠の組の中で勝ち上がった人どうしの試合です。枠${x}と枠${y}は、はじめて同じ${2 ** a}枠の組に入ります。`, look: "2枠・4枠・8枠…と組を広げてみよう。", key: "2人が同じ組に入る、いちばん小さい組の大きさを探します。", v: `${N}:${x}:${y}:${ds.join(".")}` };
    },
    // ベルガー表の1回戦（FIDE の表：8人は 1-8・2-7・3-6・4-5）
    bg1: () => (R) => {
      const N = 8, x = ri(R, 1, N), a = N + 1 - x, ws = range(1, N).filter((y) => y !== x && y !== a), ds = pickN(R, ws, 3);
      return { q: `${N}人の総当たり。ベルガー表の1回戦で、${x}番の人の相手は？`, opts: shuffle(R, [a, ...ds]).map((y) => `${y}番`), ans: `${a}番`,
        why: `ベルガー表の1回戦は、1-8・2-7・3-6・4-5。${x}番の相手は${a}番です。`, look: "1番といちばん大きい番号が当たります。", key: "1回戦は、番号の小さい側と大きい側から組みます。", v: `${N}:${x}:${ds.join(".")}` };
    },
  };
  // 山の絵（16枠まで）。marks は { 枠: "1番" }。色だけで分けず、枠の上に字で書く
  function bracketSvg(N, marks, hl) {
    if (N > 16) return "";
    const cw = 22, L = lg(N), lh = 16, top = 22, W = N * cw + 8, H = top + L * lh + 34, cx = (i) => 4 + (i - 0.5) * cw, base = top + L * lh;
    let g = "";
    for (let r = 1; r <= L; r++) {
      const sz = 2 ** r, y = base - r * lh, yc = base - (r - 1) * lh;
      for (let b = 0; b < N / sz; b++) {
        const l = (cx(b * sz + 1) + cx(b * sz + sz / 2)) / 2, rr = (cx(b * sz + sz / 2 + 1) + cx(b * sz + sz)) / 2;
        g += `<path d="M${l} ${yc}V${y}H${rr}V${yc}" fill="none" stroke="#1d2a3f" stroke-width="1.5"/>`;
      }
    }
    for (let i = 1; i <= N; i++) {
      const m = marks[i], h = hl && hl.includes(i);
      g += `<text x="${cx(i)}" y="${base + 14}" font-size="11" text-anchor="middle" fill="#1d2a3f"${h ? ' font-weight="700" text-decoration="underline"' : ""}>${i}</text>`;
      if (m) g += `<rect x="${cx(i) - 10}" y="${base + 18}" width="20" height="14" rx="3" fill="#1d2a3f"/><text x="${cx(i)}" y="${base + 29}" font-size="10" text-anchor="middle" fill="#fffdf7">${m}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${N}枠の勝ち抜きの山。下の数が枠の番号"><rect width="${W}" height="${H}" fill="#fffdf7"/><text x="4" y="14" font-size="11" fill="#4c5568">${N}枠の山（下の数＝枠）</text>${g}</svg>`;
  }
  function fitCounts(n) { return { ko: KO(n), de: DE(n, true), sw: SW(n, SWR(n)), rr: RR(n) }; }
  const fitName = (f, n) => (f === "sw" ? `スイス方式${SWR(n)}回戦` : FMT[f]);

  // 決まりの問題（FIDE Handbook）。ans：答え、ws：まちがいの選び肢の候補（やさしいは2つ、ほかは3つ使う）
  function fact(sit, ans, ws) {
    return (R, lv) => {
      const si = ri(R, 0, sit.length - 1), ds = pickN(R, ws, lv === 0 ? 2 : 3);
      return { q: sit[si], opts: shuffle(R, [ans, ...ds]), ans, v: `${si}:${ds.map((d) => ws.indexOf(d)).join(".")}` };
    };
  }
  // 種類。type：calc（計算）・fit（方式えらび）・seed（山の枠）・fact（決まり）
  const C = (id, lv, col, grp, name, make, src) => ({ id, lv, col, grp, name, make, src: src || [], type: "calc" });
  const F = (id, lv, src, name, look, key, why, sit, ans, ws) => ({ id, lv, col: "kimari", grp: null, name, look, key, why, ans, src: [src], make: fact(sit, ans, ws), type: "fact" });
  const NOTPOW = (a, b) => range(a, b, (n) => !POW(n));

  const KINDS = [
    // ---- やさしい ----
    C("ko0", 0, "ko", "lose1", "勝ち抜き戦の試合の数", MK.koG(range(4, 16))),
    C("rr0", 0, "rr", "pair", "総当たり戦の試合の数", MK.rrG(range(3, 8))),
    C("each0", 0, "rr", null, "総当たりで1人がする試合", MK.rrEach(range(3, 12))),
    C("kor0", 0, "ko", "half", "勝ち抜き戦の回戦の数", MK.koR([4, 8, 16, 32, 64, 128])),
    F("once", 0, "swiss", "スイス方式は同じ相手と1回まで", "同じ組み合わせは、くり返しません。", "スイス方式では、2人は2回以上当たりません。",
      "FIDE のスイス方式の基本の決まりでは、2人の参加者は2回以上対戦しません。",
      ["スイス方式で、同じ相手とは何回まで当たる？", "FIDE のスイス方式の決まりで、同じ2人が当たるのは何回まで？", "スイス方式の大会。1人の相手と当たるのは何回まで？"], "1回まで", ["2回まで", "3回まで", "何回でも", "毎回戦かならず", "決勝だけもう1回"]),
    F("samept", 0, "swiss", "スイス方式は同じ点の人どうし", "勝ち負けの点を見て組みます。", "スイス方式では、ふつう同じ点の人どうしを組みます。",
      "FIDE のスイス方式の基本の決まりでは、ふつう同じ点の参加者どうしを組みます。",
      ["スイス方式では、ふつうどんな人どうしを組む？", "FIDE のスイス方式で、次の回戦の相手を組むときの目安は？", "スイス方式の2回戦。だれとだれを組むのがふつう？"], "同じ点の人どうし", ["番号がとなりの人どうし", "点の差がいちばん大きい人どうし", "前の回戦と同じ相手", "年の近い人どうし", "名前の順でとなりの人"]),
    // ---- ふつう ----
    C("ko1", 1, "ko", "lose1", "大きな勝ち抜き戦の試合の数", MK.koG(range(17, 64))),
    C("rr1", 1, "rr", "pair", "大きな総当たり戦の試合の数", MK.rrG(range(9, 20))),
    C("kor1", 1, "ko", "half", "半端な人数の勝ち抜きの回戦", MK.koR(NOTPOW(5, 100))),
    C("rrr1", 1, "rr", null, "総当たりの回戦の数", MK.rrR(range(4, 16)), ["berger"]),
    C("sw1", 1, "sw", "per", "スイス方式の試合の数", MK.swG(range(6, 40)), ["swiss"]),
    C("de1", 1, "de", "lose2", "2回負けたら終わりの試合の数", MK.deG(range(4, 32), false)),
    C("bye1", 1, "seed", null, "シード（1回戦なし）の人数", MK.byes(NOTPOW(5, 60))),
    F("bye", 1, "swiss", "人数が奇数なら1人は不戦勝", "相手がいない人の点を考えます。", "組めなかった1人は、相手なしで勝ちと同じ点をもらいます（大会で別に決めなければ）。",
      "FIDE のスイス方式の決まりでは、奇数で組めなかった1人は相手なし・色なしで、大会で別に決めなければ勝ちと同じ点をもらいます。",
      ["スイス方式で人数が奇数。組めなかった1人は？", "FIDE のスイス方式で、相手のいない1人の点は？", "スイス方式の回戦で1人あまった。その人は？"], "相手なしで、勝ちと同じ点", ["相手なしで、負けと同じ点", "その場で大会を降りる", "前の回戦の相手ともう一度", "次の回戦で2試合する", "運営係と対戦する"]),
    F("decl", 1, "swiss", "回戦の数は大会の前に決める", "途中で決めるものではありません。", "スイス方式では、何回戦するかを前もって知らせます。",
      "FIDE のスイス方式の基本の決まりでは、行う回戦の数を前もって知らせておきます。",
      ["スイス方式で、何回戦するかはいつ決める？", "FIDE のスイス方式で、回戦の数を知らせるのは？", "スイス方式の大会。回戦の数はどうする？"], "大会の前に決めて知らせる", ["優勝が決まったときに決める", "全員が1回負けたら終わる", "毎回戦のあとにくじで決める", "人数が半分になったら終わる", "決勝の前の日に決める"]),
    F("odd", 1, "berger", "奇数の総当たりは大きい番号を休みに", "表の番号の使い方です。", "ベルガー表では、人数が奇数のとき、いちばん大きい番号を休みとして数えます。",
      "FIDE のベルガー表では、人数が奇数のとき、いちばん大きい番号を休み（相手なし）として数えます。たとえば3人は4人の表を使います。",
      ["総当たりの表（ベルガー表）で、人数が奇数のときは？", "ベルガー表で7人の総当たりを組むには？", "FIDE のベルガー表。奇数の人数ではどうする？"], "いちばん大きい番号を休みにする", ["1番の人を毎回休みにする", "1人を大会から外す", "毎回くじで2人休む", "1人だけ2回ずつ試合する", "いちばん小さい番号を2回使う"]),
    // ---- むずかしい ----
    C("de2", 2, "de", "lose2", "決勝のやり直しがある試合の数", MK.deG(range(5, 40), true)),
    { ...C("fit2", 2, "fit", null, "時間内に終わる方式えらび", MK.fit(), ["swiss"]), type: "fit" },
    { ...C("seed2", 2, "seed", null, "1番と2番を決勝まで分ける", MK.seed2()), type: "seed" },
    { ...C("seed3", 2, "seed", null, "3番シードの置き場所", MK.seed3()), type: "seed" },
    { ...C("meet2", 2, "seed", null, "何回戦で当たるか", MK.meet()), type: "seed" },
    { ...C("bg2", 2, "kimari", null, "ベルガー表の1回戦", MK.bg1(), ["berger"]), type: "seed" },
  ];
  // 計算の問題の名前・ヒント（まなび帳に出す）。問題ごとの説明は make が返す
  const BOOK = {
    ko0: ["1試合で1人ずつ去ります。", "勝ち抜き戦の試合は、人数−1です。"], ko1: ["1試合で1人ずつ去ります。", "勝ち抜き戦の試合は、人数−1です。"],
    rr0: ["どの2人も1回ずつ当たります。", "総当たりの試合は、人数×(人数−1)÷2です。"], rr1: ["どの2人も1回ずつ当たります。", "総当たりの試合は、人数×(人数−1)÷2です。"],
    each0: ["自分とは対戦しません。", "総当たりで1人がする試合は、人数−1です。"],
    kor0: ["1回戦ごとに半分になります。", "2を何回かけると人数以上になるかが回戦の数です。"], kor1: ["1回戦ごとに半分になります。", "2を何回かけると人数以上になるかが回戦の数です。"],
    rrr1: ["奇数なら毎回1人休みです。", "偶数は人数−1回戦、奇数は人数と同じ回戦です。"],
    sw1: ["1回戦の試合数を先に数えます。", "人数÷2の整数×回戦の数です。"],
    de1: ["去る人は2回ずつ負けます。", "優勝した人が無敗なら、2×(人数−1)試合です。"], de2: ["優勝した人の1敗も数えます。", "決勝のやり直しがあれば、2×(人数−1)＋1試合です。"],
    bye1: ["空いた枠のとなりの人です。", "シードの人数は、枠の数−人数です。"],
    fit2: ["1日にできる試合の数を先に出します。", "入る方式の中で、試合がいちばん多いものを選びます。"],
    seed2: ["山を半分に分けます。", "1番と2番は山の別の半分に置きます。"], seed3: ["山を4つに分けます。", "3番は、1番とも2番ともちがう4分の1に置きます。"],
    meet2: ["2枠・4枠・8枠と広げます。", "2人が同じ組に入る、いちばん小さい組を探します。"], bg2: ["1番と大きい番号が当たります。", "ベルガー表の1回戦は、両はしから組みます。"],
  };
  for (const k of KINDS) if (k.type !== "fact") { const b = BOOK[k.id]; k.look = b[0]; k.key = b[1]; k.why = b[1]; k.ans = ""; }
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);

  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // 1問を作る。tag は「種類|種」（例 "ko0|2026-11-27:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv), grp = p.grp !== undefined ? p.grp : k.grp;
    delete p.ds;
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, type: k.type, media: MEDIA[k.col], src: k.src.map((s) => SRC[s]), ...p, grp, gwhy: grp ? GRP_WHY[grp] : "" };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const TSH = { KINDS, BY, GROUPS, GRP_WHY, LV, SRC, MEDIA, FMT, kindsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN, fitCounts, fitName };
  if (typeof module !== "undefined" && module.exports) module.exports = TSH; else root.TSH = TSH;
})(typeof self !== "undefined" ? self : this);
