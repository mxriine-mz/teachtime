// Comparaison mot à mot entre le texte attendu et ce que Whisper a entendu (ou ce qui a été tapé).

const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
  "he's": 'he is', "she's": 'she is', "it's": 'it is', "that's": 'that is', "there's": 'there is',
  "what's": 'what is', "who's": 'who is', "where's": 'where is', "here's": 'here is', "let's": 'let us',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "he'll": 'he will', "she'll": 'she will', "it'll": 'it will',
  "i'd": 'i would', "you'd": 'you would', "we'd": 'we would', "they'd": 'they would', "he'd": 'he would', "she'd": 'she would',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not',
  "wasn't": 'was not', "weren't": 'were not', "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not',
  "can't": 'can not', "cannot": 'can not', "couldn't": 'could not', "won't": 'will not', "wouldn't": 'would not',
  "shouldn't": 'should not', "mustn't": 'must not', "needn't": 'need not',
};

const NUMBERS = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
  17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
};

const BRIT = { colour: 'color', favourite: 'favorite', centre: 'center', organise: 'organize', realise: 'realize', travelling: 'traveling', cancelled: 'canceled', programme: 'program', theatre: 'theater', neighbour: 'neighbor', behaviour: 'behavior' };

function normWord(w) {
  let x = w.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9'-]/g, '').replace(/^'+|'+$/g, '');
  if (!x) return [];
  if (CONTRACTIONS[x]) return CONTRACTIONS[x].split(' ');
  if (/^\d+$/.test(x) && NUMBERS[x]) return [NUMBERS[x]];
  if (BRIT[x]) return [BRIT[x]];
  return x.split('-').filter(Boolean);
}

export function normalize(text) {
  return String(text).split(/\s+/).flatMap(normWord);
}

// Retourne { tokens: [{ text, ok }], score (0..100), matched, total }.
export function compare(expected, actual) {
  const display = String(expected).split(/\s+/).filter(Boolean);
  const exp = [];
  const owner = [];
  display.forEach((tok, i) => {
    for (const n of normWord(tok)) { exp.push(n); owner.push(i); }
  });
  const act = normalize(actual);
  // Plus longue sous-séquence commune.
  const m = exp.length;
  const n = act.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = exp[i] === act[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (exp[i] === act[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const okTok = display.map(() => true);
  const hasNorm = display.map(() => false);
  hit.forEach((h, k) => { hasNorm[owner[k]] = true; if (!h) okTok[owner[k]] = false; });
  const tokens = display.map((t, k) => ({ text: t, ok: hasNorm[k] ? okTok[k] : true }));
  const matched = hit.filter(Boolean).length;
  const extra = Math.max(0, n - matched);
  // Les mots en trop pénalisent un peu (moitié d'un mot manquant).
  const score = m ? Math.max(0, Math.round(((matched - extra * 0.5) / m) * 100)) : 0;
  return { tokens, score, matched, total: m };
}
