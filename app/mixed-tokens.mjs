/** Build a reversible study view from existing bilingual paragraphs and target words. */
function shortMeanings(text) {
  return text.split(/[；;、／/，,。\n]/)
    .map(value => value.replace(/^[a-z. ]+\s+/i, '').replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g, '').trim())
    .flatMap(value => [value, value.replace(/^感到/, '').replace(/[的地]$/, '')])
    .filter(value => /^[\u3400-\u9fff]{2,10}$/.test(value));
}

export function mixParagraph(paragraph, words, references = {}) {
  const candidates = [];
  const occupiedMeanings = new Map();
  for (const entry of words) {
    const english = entry.word?.trim();
    if (!english || !entry.meaning || !/[A-Za-z]/.test(english)) continue;
    const escaped = english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp('(?<![A-Za-z])' + escaped + '(?![A-Za-z])', 'i').exec(paragraph.en);
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
