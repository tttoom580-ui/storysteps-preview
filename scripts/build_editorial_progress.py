"""Publish a small truthful, human-readable editorial dashboard from machine audit."""
from pathlib import Path
from html import escape as e
import json
from runpy import run_path
ROOT=Path(__file__).resolve().parents[1]
d=run_path(str(ROOT/'scripts/audit_editorial_depth.py'))['report'];s=d['summary']
approvals=json.loads((ROOT/'verification/editorial-approvals.json').read_text())['certifiedBooks']
catalog=json.loads((ROOT/'public/catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
basic={b['id'] for b in catalog if b.get('basicEditorialReviewed')}
cleanup=json.loads((ROOT/'verification/basic-editorial-20261116.json').read_text())['books']
rows=[]
for b in d['books']:
    issue='跨章重複長句：'+str(b['enCrossChapterSentenceReuse'])+' 組' if b['enCrossChapterSentenceReuse'] else '未檢出跨章相同長句'
    if b['privateChapters']:
        issue='公開試讀章節：'+issue
    approval='校訂完成' if b['id'] in basic or b['id'] in approvals else '校訂中'
    rows.append(f'''<tr><td><a href="./stories/{e(b['id'])}/">{e(b['name'])}</a></td>
    <td>{e(b['level'])}</td><td>{b['minWords']}</td><td>{b['minTargetWords']}</td>
    <td>{e(issue)}</td><td>{approval}</td></tr>''')
html=f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{s['totalBooks']} 本小說校訂進度｜StorySteps 拾頁</title><meta name="description" content="StorySteps 校訂進度：分辨機械完整性檢查、AI 全文校訂和獨立真人審閱">
<link rel="canonical" href="https://tttoom580-ui.github.io/storysteps-preview/editorial-progress.html">
<link rel="stylesheet" href="./public-reading.css"><style>
body{{overflow-wrap:anywhere}}table{{width:100%;border-collapse:collapse;font-size:.92rem}}
td,th{{padding:.65em;text-align:left;border-bottom:1px solid #827a9366;vertical-align:top}}
.table-wrap{{overflow-x:auto}}input{{padding:.85em;width:100%;max-width:520px;border-radius:9px;border:1px solid #aaa}}
.notice{{border-left:4px solid #9f82c5;padding:15px 18px;background:#7660bd16;border-radius:8px}}
</style></head><body><header><a href="./">← StorySteps 首頁</a><nav><a href="./library.html">書城</a><a href="./story-review.html">原有檢查紀錄</a><a href="./privacy.html">隱私政策</a></nav></header><main>
<h1>{s['totalBooks']} 本小說校訂進度</h1>
<p class="notice"><strong>校訂完成 {len(basic | approvals.keys())} 本。</strong>這輪檢查英中段落完整性、英文詞數、配詞與測驗格式，並刪除可確認雙語對應的重複敘述。</p>
<p>站內例行掃描共檢查 {s['totalChapters']:,} 章。在 {sum(bool(b['editedChapters']) for b in cleanup.values())} 本的 {sum(len(b['editedChapters']) for b in cleanup.values())} 章中刪除 {sum(b['removedRepeatedPairs'] for b in cleanup.values())} 組重複的英中句對。下表列出各書仍檢出的跨章長句。</p>
<p>其中 <strong>{len(approvals)} 本</strong>另有 AI 全文校訂紀錄，涵蓋逐段譯意、情節與測驗答案。<a href="./five-book-ai-certification.html">查看部分全文校訂紀錄</a></p>
<label for="search">搜尋書名或等級</label><p><input id="search" type="search" placeholder="例如：校園、萬味、2000"></p>
<div class="table-wrap"><table id="books"><thead><tr><th>小說</th><th>級距</th><th>最短章英文詞</th><th>最少章目標詞</th><th>跨章長句</th><th>校訂狀態</th></tr></thead><tbody>
{''.join(rows)}
</tbody></table></div>
<h2>校訂必須通過的五道關卡</h2><ol><li>逐章檢查劇情發展與跨章雷同</li><li>逐段修改英文自然度、人物與事件時間線</li><li>逐段核對英中翻譯含義</li><li>確認每章至少 500 詞、20 目標詞並核對測驗答案</li><li>只有完成以上關卡才將作品標為「全文已校訂」</li></ol>
<p>規格與重複長句資料按本次上架版本重新計算。<a href="./">返回閱讀網站</a></p>
</main><script>document.getElementById('search').addEventListener('input',function(){{const q=this.value.trim().toLowerCase();document.querySelectorAll('#books tbody tr').forEach(r=>{{r.hidden=!r.innerText.toLowerCase().includes(q)}})}})</script></body></html>'''
(ROOT/'public/editorial-progress.html').write_text(html)
print('EDITORIAL_PROGRESS_PAGE',len(rows),'books',len(html),'bytes')
