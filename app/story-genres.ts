import type {Story} from './types';
import topics from '../config/topics.json';

export const genreGroups=topics.map(topic=>({...topic,pattern:new RegExp(topic.keywords.join('|'))}));
export function matchesGenre(story:Story,selection:string){
 if(selection==='全部題材')return true;
 const group=genreGroups.find(group=>group.name===selection);
 return group?(story.primaryGenre===selection||group.pattern.test([story.genre,...(story.tags||[]),...(story.plotTags||[])].join(' '))):story.tags?.includes(selection)===true||story.plotTags?.includes(selection)===true||story.genre===selection;
}
