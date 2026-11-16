import type {Story} from './types';
export const levels=["1000以下","1000–2000","2000–3000","3000–4000","4000–5000","5000–6000","6000–7000"];
// Public metadata only, never include chapter prose here.
export const allStories:Story[]=(window as any).__STORYSTEPS_CATALOG;
export const stories=allStories.filter(s=>s.readable!==false);
export const upcomingStories=allStories.filter(s=>s.readable===false);

export function editorialLabel(story:Story){
 if(story.learningReviewRequired===false)return 'AI 全文已校訂';
 return story.basicEditorialReviewed?'基礎校訂完成':'校訂中';
}
