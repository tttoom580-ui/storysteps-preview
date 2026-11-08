type Props={placement:string;compact?:boolean};
export default function SponsorSlot({placement,compact=false}:Props){
 return <aside className={'sponsor-slot'+(compact?' sponsor-compact':'')} aria-label={'廣告招租：'+placement} data-sponsor-placement={placement}>
  <span className="sponsor-label">廣告合作 · {placement}</span>
  <div className="sponsor-copy"><strong>下一個被學生記住的品牌，就是你。</strong><p>讓品牌走進國高中生的閱讀日常。出版社、文具、學習品牌，合作版位開放中。</p></div>
  <span className="sponsor-status">搶先預約合作</span>
 </aside>
}
