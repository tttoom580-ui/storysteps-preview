import type {Story} from "./types";
export function rangeLabel(story:Story){return story.vocabularyRange==="A"?"A 範圍":story.vocabularyRange==="B"?"B 範圍":story.vocabularyRange==="custom"?"獨立配詞（非 A／B）":"A／B 範圍待核對"}
