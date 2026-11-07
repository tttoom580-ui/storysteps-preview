export type Word={word:string;original?:string;meaning:string;source?:string;entryId?:string;referenceLevel?:number;pos?:string};
export type Question={question:string;options:string[];answer:number;explanation:string};
export type Chapter={id:string;title:string;zh:string;paragraphs:{en:string;zh:string}[];words:Word[];questions:Question[];vocabularyPlan?:{referenceLevel:number;targetCount:number;newTargetCount:number;bookUniqueTargetCount:number;source:string;selection:string}};
export type ChapterMeta={id:string;title:string;zh:string;available:boolean;wordCount:number;number:number};
export type Story={vocabularyRange?:"A"|"B"|"custom"|"pending";id:string;importNote?:string;learningReviewRequired?:boolean;title:string;zh:string;level:string;genre:string;desc:string;hook:string;cover?:string;color:string;tags?:string[];series?:string;seriesId?:string;volume?:number;chapters:ChapterMeta[];vocabularySummary?:{referenceLevel:number;uniqueTargets:number;perChapter:number}};
