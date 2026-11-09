import type {Story} from './types';
export function rangeLabel(s:Story){return s.vocabularyRange==='A'?'A 本 · 前約 500 詞':s.vocabularyRange==='B'?'B 本 · 後約 500 詞':s.vocabularyRange==='custom'?'故事自選詞彙':'詞表對照整理中'}
export function levelLabel(level:string){return ({'1000以下':'起步閱讀','1000–2000':'日常探索','2000–3000':'情節進階','3000–4000':'深入故事','4000–5000':'思辨挑戰','5000–6000':'高階閱讀','6000–7000':'延伸挑戰'} as Record<string,string>)[level]||level}
