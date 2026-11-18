import type {Story} from './types';

// Themes may overlap so readers can discover a book through more than one interest.
export const genreGroups=[
 {name:'懸疑推理',pattern:/懸疑|推理/},
 {name:'戀愛關係',pattern:/戀愛|言情|霸總|雙男主/},
 {name:'奇幻仙俠',pattern:/奇幻|仙俠|修仙|修行|高武/},
 {name:'青春成長',pattern:/校園|青春|成長|創業|職場|經營|女性/},
 {name:'療癒童話',pattern:/溫暖|童話|動物|共融/},
 {name:'科幻冒險',pattern:/科幻|冒險|生存|無限流|副本|遊戲|災變|救援/},
 {name:'歷史年代',pattern:/歷史|年代/}
];
export function matchesGenre(story:Story,selection:string){
 if(selection==='全部題材')return true;
 const group=genreGroups.find(group=>group.name===selection);
 return group?group.pattern.test(story.genre):story.genre===selection||!!story.tags?.includes(selection);
}
