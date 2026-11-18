/** Build a reversible study view from existing bilingual paragraphs and target words. */
export function mixParagraph(paragraph, words) {
  const candidates = [];
  const occupiedMeanings = new Map();
  for (const entry of words) {
    const english = entry.word?.trim();
    if (!english || !entry.meaning || !/[A-Za-z]/.test(english)) continue;
    const escaped = english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp('(?<![A-Za-z])' + escaped + '(?![A-Za-z])', 'i').test(paragraph.en)) continue;
    // Short grammatical words and explanatory text are too ambiguous for substitution.
    const meanings = entry.meaning.split(/[；;、／/]/).map(value => value.trim());
    for (const meaning of meanings) {
      if (!/^[\u3400-\u9fff]{2,10}$/.test(meaning)) continue;
      const owners = occupiedMeanings.get(meaning) || new Set();
      owners.add(english);
      occupiedMeanings.set(meaning, owners);
      candidates.push({english, meaning, entry});
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
