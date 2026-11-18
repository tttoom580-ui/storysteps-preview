const wordKey = word => word.trim().toLowerCase().replace(/[’‘]/g, "'");

const segmenters = typeof Intl.Segmenter === 'function'
  ? {en: new Intl.Segmenter('en', {granularity: 'sentence'}),
     zh: new Intl.Segmenter('zh-Hant', {granularity: 'sentence'})}
  : null;

function sentenceEnds(text, locale) {
  if (!segmenters) return [text.length];
  return Array.from(segmenters[locale].segment(text), ({segment, index}) => index + segment.length);
}

function wordPattern(word) {
  const escaped = word.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&').replace(/'/g, "['’‘]");
  return new RegExp('(?<![A-Za-z])' + escaped + '(?![A-Za-z])', 'gi');
}

function shortMeanings(text) {
  return [...new Set(text.split(/[；;、／/，,。\n]/)
    .map(value => value.replace(/^[a-z. ]+\s+/i, '')
      .replace(/（[^）]*）|\([^)]*\)|\[[^\]]*\]/g, '').trim())
    .flatMap(value => [value, value.replace(/^感到/, '').replace(/[的地]$/, '')])
    .filter(value => /^[\u3400-\u9fff]{2,10}$/.test(value)))];
}

function matchingSpans(text, terms, start = 0, end = text.length) {
  const matches = [];
  for (const term of terms) {
    for (let index = text.indexOf(term, start); index >= 0 && index + term.length <= end;
      index = text.indexOf(term, index + 1)) {
      matches.push({start: index, end: index + term.length, term});
    }
  }
  // A shorter form at the same location is the same candidate, not a second sense.
  return matches.filter(match => !matches.some(other => other !== match
    && other.start <= match.start && other.end >= match.end && other.term.length > match.term.length));
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function addPartActions(row, paragraph) {
  const parts = [];
  const notes = [...row.notes.entries()].map(([start, terms]) => ({start, end: start, terms}));
  const actions = [...row.replacements, ...notes].sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0;
  for (const action of actions) {
    if (action.start > cursor) parts.push({text: paragraph.zh.slice(cursor, action.start)});
    parts.push(action.terms ? {terms: action.terms} : action.study);
    cursor = action.end;
  }
  if (cursor < paragraph.zh.length) parts.push({text: paragraph.zh.slice(cursor)});
  return parts;
}

/** Keep the translation intact except where a source word has a unique matching Chinese span. */
export function mixChapter(paragraphs, words, reviewed = {}) {
  const rows = paragraphs.map(paragraph => {
    const enEnds = sentenceEnds(paragraph.en, 'en');
    const zhEnds = sentenceEnds(paragraph.zh, 'zh');
    return {enEnds, zhEnds, pairedSentences: enEnds.length === zhEnds.length,
      replacements: [], sentenceAnchors: new Map(), notes: new Map()};
  });
  const targets = [...new Map(words.filter(entry => entry.word?.trim() && entry.meaning?.trim())
    .map(entry => [wordKey(entry.word), entry])).entries()].map(([key, entry]) => ({
      key, entry, occurrences: [], candidates: [], reviewed: false,
    }));

  for (const target of targets) {
    const terms = shortMeanings(target.entry.meaning);
    const pattern = wordPattern(target.key);
    for (const [index, paragraph] of paragraphs.entries()) {
      const row = rows[index];
      const occurrences = Array.from(paragraph.en.matchAll(pattern));
      for (const match of occurrences) {
        const sentence = row.enEnds.findIndex(end => end > match.index);
        const paired = row.pairedSentences && sentence >= 0;
        const limit = paired ? row.zhEnds[sentence] : paragraph.zh.length;
        const occurrence = {index, sentence, text: match[0], offset: match.index, noteAt: limit,
          anchor: paired ? 'sentence' : 'paragraph'};
        target.occurrences.push(occurrence);
        const start = paired ? row.zhEnds[sentence - 1] ?? 0 : 0;
        const spans = matchingSpans(paragraph.zh, terms, start, limit);
        if (spans.length === 1) target.candidates.push({...spans[0], occurrence});
      }

      const alignment = reviewed[target.key];
      if (alignment?.paragraph !== index || !occurrences.length) continue;
      const needle = alignment.translation ?? alignment.after;
      if (!needle) continue;
      const spans = matchingSpans(paragraph.zh, [needle]).filter(span =>
        !alignment.prefix || paragraph.zh.slice(0, span.start).endsWith(alignment.prefix));
      if (spans.length !== 1) continue;
      const occurrence = target.occurrences.find(hit => hit.index === index);
      if (alignment.after) {
        target.candidates = [];
        target.note = {...occurrence, noteAt: spans[0].end, anchor: 'sentence'};
      } else {
        target.candidates = [{...spans[0], occurrence}];
        target.reviewed = true;
      }
      break;
    }
  }

  const proposed = targets.flatMap(target => {
    // Repeated occurrences of an English word can point to the same translated text.
    const unique = new Map(target.candidates.map(candidate => [
      [candidate.occurrence.index, candidate.start, candidate.end].join(':'), candidate,
    ]));
    const candidates = [...unique.values()];
    // If the same gloss matches several separate sentence pairs, use the first occurrence.
    const first = candidates[0];
    if (!first || (candidates.length > 1 && !candidates.every(candidate =>
      candidate.occurrence.anchor === 'sentence' && candidate.term === first.term))) return [];
    return [{...first, target}];
  });

  let substitutions = 0;
  let inlineNotes = 0;
  const unresolved = [];
  for (const target of targets) {
    const candidate = proposed.find(item => item.target === target);
    const conflict = candidate && proposed.some(other => other.target !== target
      && other.occurrence.index === candidate.occurrence.index && overlaps(other, candidate)
      && (!target.reviewed || other.target.reviewed));
    if (!candidate || conflict) {
      unresolved.push(target);
      continue;
    }
    const {occurrence, start, end, term} = candidate;
    const row = rows[occurrence.index];
    row.replacements.push({start, end,
      study: {text: occurrence.text, entry: target.entry, meaning: term, replacement: true}});
    const mapped = row.zhEnds.find(limit => limit >= end);
    const anchors = row.sentenceAnchors.get(occurrence.sentence) ?? new Set();
    anchors.add(mapped);
    row.sentenceAnchors.set(occurrence.sentence, anchors);
    substitutions++;
  }

  for (const target of unresolved) {
    const aligned = target.occurrences.find(hit => hit.anchor === 'sentence'
      || rows[hit.index].sentenceAnchors.get(hit.sentence)?.size === 1);
    const occurrence = target.note ?? aligned ?? target.occurrences[0];
    if (!occurrence) continue;
    const row = rows[occurrence.index];
    const anchors = row.sentenceAnchors.get(occurrence.sentence);
    const anchoredEnd = anchors?.size === 1 ? anchors.values().next().value : undefined;
    const noteAt = !target.note && anchoredEnd !== undefined ? anchoredEnd : occurrence.noteAt;
    const terms = row.notes.get(noteAt) ?? [];
    terms.push({text: occurrence.text, entry: target.entry, meaning: target.entry.meaning,
      offset: occurrence.offset, anchor: anchoredEnd !== undefined ? 'sentence' : occurrence.anchor});
    row.notes.set(noteAt, terms);
    inlineNotes++;
  }
  for (const row of rows) {
    for (const [position, terms] of row.notes) {
      const crossing = row.replacements.find(span => span.start < position && position < span.end);
      if (crossing) {
        row.notes.delete(position);
        row.notes.set(crossing.end, [...(row.notes.get(crossing.end) ?? []), ...terms]);
      }
    }
    for (const terms of row.notes.values()) terms.sort((left, right) => left.offset - right.offset);
  }

  return {paragraphs: rows.map((row, index) => ({parts: addPartActions(row, paragraphs[index])})),
    count: substitutions + inlineNotes, substitutions, inlineNotes};
}
