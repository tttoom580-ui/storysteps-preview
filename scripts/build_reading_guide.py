from pathlib import Path
import json,gzip,re,csv,statistics
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/"public/catalog.js").read_text().split("=",1)[1].rstrip(";\n"));manifest=json.loads((root/"public/content-manifest.json").read_text());previews=json.loads((root/"app/story-previews.json").read_text())
changes={"ss-r4-l1-a":{},"ss-r4-l2-b":{},"ss-r2-l3-a":{}}
# Transparent screening: exact forms, without pretending to be a CEFR/word-frequency test.
words={}
for row in csv.DictReader((root.parent/'upload/全部詞彙_級別書本章節對照.csv').open(encoding='utf-8-sig')):
 for w in re.findall(r'[a-z]+',row['原表詞條'].lower()):words[w]=min(int(row['原表級別']),words.get(w,99))
guide={'books':{},'chapters':{}};audit=[]
for b in catalog:
 chs=json.loads(gzip.decompress((root/'public'/manifest['books'][b['id']]['url']).read_bytes()));lv=['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000','6000–7000'].index(b['level'])+1
 guide['books'][b['id']]={'sample':' '.join(chs[0]['paragraphs'][0]['en'].split()[:65])+'…'}
 for c in chs:
  en=' '.join(p['en'] for p in c['paragraphs']);tokens=re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*",en);sent=re.split(r'[.!?]+(?:["”])?\s+',en);lens=[len(re.findall(r'[A-Za-z]+',x)) for x in sent if x.strip()]
  end=c['paragraphs'][-1]['zh'];scene=''.join(re.findall(r'.*?[。！？](?:[」”])?|.+$',end)[:2]);guide['chapters'][c['id']]={'meanSentence':round(statistics.mean(lens),1),'maxSentence':max(lens),'lastScene':scene}
  preview=''.join(re.findall(r'.*?[。！？](?:[」”])?|.+$',c['paragraphs'][0]['zh'])[:3]);previews['chapters'][c['id']]=preview
  if b['id'] in changes:
   above=sorted(set(w.lower() for w in tokens if words.get(w.lower(),0)>lv));unknown=sorted(set(w.lower() for w in tokens if w.lower() not in words));audit.append({'chapter':c['id'],'wordCount':len(tokens),'averageSentenceWords':round(statistics.mean(lens),1),'longestSentenceWords':max(lens),'aboveAssignedLevelExactForms':above,'unmatchedExactFormsIncludingNamesAndInflections':unknown,'abstractPlotReview':'需人工評估推理、制度與人物關係負擔','revised':b['id']=='ss-r2-l3-a' and c['id'].endswith('-1')})
(root/'app/reading-guide.json').write_text(json.dumps(guide,ensure_ascii=False,separators=(',',':')))
(root/'app/story-previews.json').write_text(json.dumps(previews,ensure_ascii=False,indent=2)+'\n')
(root/'editorial-audit.json').write_text(json.dumps({'scope':'Three current books / 75 chapters screened; 1A and 2B use supplied complete rewrites; 3A has an edited opening. Exact surface matching is not a standardized proficiency assessment.','chapters':audit},ensure_ascii=False,indent=2))
print('Screened',len(audit),'chapters; generated guides for',len(guide['chapters']))
