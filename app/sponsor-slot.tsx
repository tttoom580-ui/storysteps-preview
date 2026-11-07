type Props={placement:string;compact?:boolean};
export default function SponsorSlot({placement,compact=false}:Props){
 return <aside className={'sponsor-slot'+(compact?' sponsor-compact':'')} aria-label={'廣告招租：'+placement} data-sponsor-placement={placement}>
  <span className="sponsor-label">廣告合作 · {placement}</span>
  <div className="sponsor-copy"><strong>招租中</strong><p>讓好品牌，陪讀者多讀一頁。</p></div>
  <span className="sponsor-status">品牌合作版位</span>
 </aside>
}
