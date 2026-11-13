"""Publish a small truthful, human-readable editorial dashboard from machine audit."""
from pathlib import Path
from html import escape as e
import json
ROOT=Path(__file__).resolve().parents[1]
src=ROOT/'verification/editorial-triage-20261114.json'
d=json.loads(src.read_text());s=d['summary']
rows=[]
for b in d['books']:
    issue='跨章重複長句：'+str(b['enCrossChapterSentenceReuse'])+' 組' if b['enCrossChapterSentenceReuse'] else '未檢出跨章相同長句'
    rows.append(f'''<tr><td><a href="./stories/{e(b['id'])}/">{e(b['name'])}</a></td>
    <td>{e(b['level'])}</td><td>{b['minWords']}</td><td>{b['minTargetWords']}</td>
    <td>{e(issue)}</td><td>逐段英中、情節、角色與答案審閱未完成</td></tr>''')
html=f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>82 本小說校訂進度｜StorySteps 拾頁</title><meta name="description" content="校訂進度：分辨自動完整性檢查與人工語意審閱">
<link rel="canonical" href="https://tttoom580-ui.github.io/storysteps-preview/editorial-progress.html">
<link rel="stylesheet" href="./public-reading.css"><style>
body{{overflow-wrap:anywhere}}table{{width:100%;border-collapse:collapse;font-size:.92rem}}
td,th{{padding:.65em;text-align:left;border-bottom:1px solid #827a9366;vertical-align:top}}
.table-wrap{{overflow-x:auto}}input{{padding:.85em;width:100%;max-width:520px;border-radius:9px;border:1px solid #aaa}}
.notice{{border-left:4px solid #9f82c5;padding:15px 18px;background:#7660bd16;border-radius:8px}}
</style></head><body><header><a href="./">← StorySteps 首頁</a><nav><a href="./library.html">書城</a><a href="./story-review.html">原有檢查紀錄</a><a href="./privacy.html">隱私政策</a></nav></header><main>
<h1>82 本小說校訂進度</h1>
<p class="notice"><strong>提醒：自動規格通過 ≠ 全文語意校訂完成。</strong>目前未有任何一本經完整逐段英中、角色、情節及測驗語意的獨立終稿核准。過去已局部修訂的作品，仍保留待複核狀態。</p>
<p>已掃描 <strong>{s['totalBooks']}</strong> 本、<strong>{s['totalChapters']}</strong> 章；不足 500 英文詞：{s['chaptersUnder500']} 章；不足 20 目標詞：{s['chaptersUnder20Targets']} 章；不足兩題：{s['chaptersUnder2Quizzes']} 章。</p>
<p>尚須補充原文證據並人工核對的測驗：<strong>{s['quizzesWithoutExplicitSourceEvidence']}</strong> 題。仍有跨章重用 12 詞以上英文長句的作品：<strong>{s['booksWithRepeatedEnglishLongSentence']}</strong> 本。</p>
<p>本檢查只指出可能問題：短中文譯文未必錯誤、字數夠也未必自然、沒有完全相同的長句不代表情節沒有雷同。以下「沒有檢出」絕非原創性認證。</p>
<label for="search">搜尋書名或等級</label><p><input id="search" type="search" placeholder="例如：校園、萬味、2000"></p>
<div class="table-wrap"><table id="books"><thead><tr><th>小說</th><th>級距</th><th>最短章英文詞</th><th>最少章目標詞</th><th>跨章長句</th><th>語意校訂</th></tr></thead><tbody>
{''.join(rows)}
</tbody></table></div>
<h2>校訂必須通過的五道關卡</h2><ol><li>逐章檢查劇情發展與跨章雷同</li><li>逐段修改英文自然度、人物與事件時間線</li><li>逐段核對英中翻譯含義</li><li>確認每章至少 500 詞、20 目標詞並核對測驗答案</li><li>只有完成以上關卡才將作品標為「全文已校訂」</li></ol>
<p>最近一次自動稽核：2026-11-14。<a href="./">返回閱讀網站</a></p>
</main><script>document.getElementById('search').addEventListener('input',function(){{const q=this.value.trim().toLowerCase();document.querySelectorAll('#books tbody tr').forEach(r=>{{r.hidden=!r.innerText.toLowerCase().includes(q)}})}})</script></body></html>'''
(ROOT/'public/editorial-progress.html').write_text(html)
print('EDITORIAL_PROGRESS_PAGE',len(rows),'books',len(html),'bytes')
