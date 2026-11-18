/** Build a reversible study view from existing bilingual paragraphs and target words. */
function shortMeanings(text) {
  return text.split(/[；;、／/，,。\n]/)
    .map(value => value.replace(/^[a-z. ]+\s+/i, '').replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g, '').trim())
    .flatMap(value => [value, value.replace(/^感到/, '').replace(/[的地]$/, '')])
    .filter(value => /^[\u3400-\u9fff]{2,10}$/.test(value));
}

const wordKey = word => word.trim().toLowerCase().replace(/[’‘]/g, "'");

function wordPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’‘]");
  return new RegExp('(?<![A-Za-z])' + escaped + '(?![A-Za-z])', 'i');
}

export function mixParagraph(paragraph, words, references = {}, shown = new Set()) {
  const candidates = [];
  const occupiedMeanings = new Map();
  for (const entry of words) {
    const english = entry.word?.trim();
    if (!english || !entry.meaning || !/[A-Za-z]/.test(english)) continue;
    if (shown.has(wordKey(english))) continue;
    const exact = wordPattern(wordKey(english)).exec(paragraph.en);
    const actual = exact?.[0] || (paragraph.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || [])
      .find(form => references[form.toLowerCase()]?.original === english.toLowerCase());
    if (!actual) continue;
    const englishForm = actual;
    const reference = references[english.toLowerCase()];
    // General dictionary senses only help when the chapter's own gloss supports them.
    const extra = shortMeanings(reference?.meaning || '').filter(meaning => entry.meaning.includes(meaning));
    const meanings = [...new Set([...shortMeanings(entry.meaning), ...extra])];
    for (const meaning of meanings) {
      if (!/^[\u3400-\u9fff]{2,10}$/.test(meaning)) continue;
      const owners = occupiedMeanings.get(meaning) || new Set();
      owners.add(englishForm);
      occupiedMeanings.set(meaning, owners);
      candidates.push({english:englishForm, meaning, entry});
    }
  }
  const usable = candidates.filter(item => occupiedMeanings.get(item.meaning).size === 1)
    .sort((a, b) => b.meaning.length - a.meaning.length);
  const parts = [];
  const used = new Set();
  let position = 0;
  let text = '';
  while (position < paragraph.zh.length) {
    const match = used.size < 5 && usable.find(item => !used.has(item.english) && paragraph.zh.startsWith(item.meaning, position));
    if (!match) {
      text += paragraph.zh[position++];
      continue;
    }
    if (text) parts.push({text});
    text = '';
    parts.push({text: match.english, meaning: match.meaning, entry: match.entry});
    used.add(match.english);
    position += match.meaning.length;
  }
  if (text) parts.push({text});
  return parts;
}

/** Place each distinct target in the translation where possible, or beside its source paragraph. */
export function mixChapter(paragraphs, words) {
  const targets = [...new Map(words.filter(entry => entry.word?.trim() && entry.meaning?.trim())
    .map(entry => [wordKey(entry.word), entry])).entries()];
  const located = paragraphs.map(() => []);
  for (const [key, entry] of targets) {
    const pattern = wordPattern(key);
    paragraphs.forEach((paragraph, index) => {
      const match = pattern.exec(paragraph.en);
      if (match) located[index].push({key, entry, text: match[0]});
    });
  }

  const shown = new Set();
  const result = paragraphs.map((paragraph, index) => {
    const parts = mixParagraph(paragraph, located[index].map(target => target.entry), {}, shown);
    for (const part of parts) {
      if (part.entry) shown.add(wordKey(part.entry.word));
    }
    return {parts, nearby: []};
  });
  located.forEach((matches, index) => {
    for (const {key, entry, text} of matches) {
      if (shown.has(key)) continue;
      result[index].nearby.push({text, entry, meaning: entry.meaning});
      shown.add(key);
    }
  });
  return {paragraphs: result, count: shown.size};
}
