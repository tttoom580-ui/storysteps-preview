"""Add source-grounded literal event-recall exercises to legacy chapters lacking quizzes.

These are editorial drafts, not semantic certification. Evidence and source paragraph
indices are retained in verification output for subsequent review. Existing quizzes
and prose are never replaced. Cloze choices concern story events/objects, not isolated
word definitions; wrong choices come from different narrative contexts in the book.
"""
from pathlib import Path
import json,gzip,re,hashlib,random
R=Path(__file__).resolve().parents[1]
PAT=re.compile(r'\b(?:carried|held|opened|found|brought|took|showed|wrote|read|noticed|saw|heard|gave|kept|placed|put|checked|watched|reached|followed|pointed to|looked at|returned to|walked to|stood beside|waited for|asked for|looked for|picked up|needed|wanted|remembered|discovered|recognized|offered|lifted|pulled|pushed|touched|closed|locked|unlocked|examined|contained|became|organized|built|entered|used|received|sent|made|saved|turned into|signed|prepared|explained|arranged|described|recovered|carrying|holding|using|revealed|included|stored|removed|repaired|identified|presented|documented|announced|published)\s+((?:a|an|the|his|her|their|our|my|its|two|three|four|five|six|seven|eight|nine|ten)\s+[^.!?;:“”"\n]{3,90})',re.I)
CUT=r',|\b(?:and|but|because|when|while|before|after|until|although|as|so|which|who|that|in|on|at|with|from|near|to|for|under|over|beside|inside|behind)\b'
# Individually authored questions for chapters without two usable event clauses.
MANUAL={
'import-seventh-light-13':[(0,'What does Mira’s classroom experiment show?',['The substance has traveled through drinking-water channels.','The crystals can make seawater safe to drink.','The samples contain only ordinary classroom dust.'],0),(1,'Why does Lia explain Mira’s charts repeatedly?',['To replace the samples with rumors.','To help residents understand evidence they can explain themselves.','To hide the findings from frightened families.'],1)],
'import-seventh-light-14':[(0,'Where has Mr. Valen hidden the tape recorder?',['Inside a crooked picture frame.','Beneath the island clinic’s operating table.','In a fish crate at the harbor.'],0),(2,'What does Valen remind Lia before she leaves?',['Witnesses should never appear in stories.','Evidence matters more than anyone’s safety.','Witnesses deserve protection as well as a chance to be heard.'],2)],
'import-seventh-light-18':[(0,'What does the collapsed road expose inside the cliff?',['A steel cabinet containing contracts, logs, and official letters.','A new passenger tunnel already cleared for use.','A hidden garden that proves the water is safe.'],0),(2,'How do several company guards respond by noon?',['They seize Lia’s camera and end the rescue.','They hand over radio codes and help evacuate people.','They order fishermen to stay away from all shelters.'],1)],
'import-seventh-light-21':[(0,'What danger do Mira and Hana identify after testing the rumor?',['A confirmed virus spreading from the company’s drums.','An earthquake spreading across the mainland.','Contaminated water and exposure to cold.'],2),(2,'What links the false warnings to Helix Tide?',['Their printing style matches the company’s forms.','Every warning carries Mira’s signature.','They were broadcast from Lia’s personal camera.'],0)],
'import-seventh-light-23':[(0,'How do the arriving volunteers distribute relief supplies?',['According to each family’s political loyalty.','According to household size.','Only to people who can immediately pay.'],1),(1,'Why does Dr. Wen create quiet rooms?',['To hide donated food from local residents.','To keep all island witnesses away from the court.','To support children and adults exhausted by the disaster.'],2)],
'import-seventh-light-24':[(0,'Why does Lia arrange for evidence copies beyond the island?',['To make the evidence harder to suppress.','To keep every editor from learning about the hearing.','To replace the original evidence with company statements.'],0),(2,'Why is Helix Tide’s wealthy backer present offshore?',['He has come to organize a private sightseeing party.','The court has forced him to attend.','Tomas has hired him to rebuild the lighthouse.'],1)],
'import-borrowed-thunder-16':[(0,'How does Zhixia distinguish freely given memories from stolen ones?',['Only stolen memories remain completely dark.','All memories pulse with the same rhythm.','Freely given memories pulse gently; stolen ones strike the glass unevenly.'],2),(4,'Why does Soren oppose breaking the machines immediately?',['A sudden shutdown could kill patients who depend on life support.','He wants the council to sell the patients’ memories first.','The machines contain no living patients.'],0)]}
def candidates(c):
 result=[]
 for pi,p in enumerate(c['paragraphs']):
  for mt in PAT.finditer(p['en']):
   obj=re.split(CUT,mt.group(1))[0].strip()
   if not 2<=len(obj.split())<=8:continue
   # Use the enclosing sentence, including speech if present, rather than making
   # an unsupported new proposition from a detached subject or verb.
   a=mt.start(1);b=a+len(obj)
   lo=max(p['en'].rfind('. ',0,mt.start()),p['en'].rfind('? ',0,mt.start()),p['en'].rfind('! ',0,mt.start()))
   lo=lo+2 if lo>=0 else 0
   stop=re.search(r'[.!?](?:[”\"])?(?:\s|$)',p['en'][b:]);hi=b+stop.end() if stop else len(p['en'])
   sentence=p['en'][lo:hi].strip()
   if len(sentence)>330 or len(sentence)<25:continue
   result.append(dict(paragraph=pi,object=obj,sentence=sentence,cloze=p['en'][lo:a]+'____'+p['en'][b:hi]))
 return result

def noun_option(obj):
 # Do not offer predicate complements or trailing manner adverbs as noun choices.
 bad={'still','twice','again','stronger','visible','angry','carefully','silently','quickly','slowly','open','closed','safe','clear','clearer','quiet','quietly','alone','there','here','first','last','enough','together','away','nearby','ready','possible','impossible','public','private','gently','warm','cold','easier','harder','better','worse'}
 words=obj.split()
 return len(words)>=2 and words[-1].lower().strip('.,') not in bad and not words[-1].lower().endswith('ly')

def run():
 manifest=json.loads((R/'public/content-manifest.json').read_text());report=[];totals={'chapters':0,'questions':0,'books':0};new=[]
 for bid,meta in list(manifest['books'].items()):
  path=R/'public'/meta['url'];chs=json.loads(gzip.decompress(path.read_bytes()));missing=[c for c in chs if not c.get('questions')]
  if not missing:continue
  pool=[(c['id'],h['object']) for c in chs for h in candidates(c) if noun_option(h['object'])];changed=False
  for c in missing:
   rng=random.Random(c['id']);qs=[];evidence=[]
   if c['id'] in MANUAL:
    for pi,q,options,answer in MANUAL[c['id']]:
     p=c['paragraphs'][pi];qs.append(dict(question=q,options=options,answer=answer,explanation=f'依據本章第 {pi+1} 段：{p["zh"]}'));evidence.append(dict(paragraph=pi+1,type='authored_event_comprehension'))
   else:
    hits=candidates(c)
    usable=[h for h in hits if noun_option(h['object'])]
    if len(usable)>=2:hits=usable
    # Cover distinct scenes wherever possible instead of testing one small phrase twice.
    first=hits[0];last=next((h for h in reversed(hits) if h['paragraph']!=first['paragraph']),hits[-1]);assert first!=last,(bid,c['id'],'insufficient distinct facts')
    for hit in [first,last]:
     obj=hit['object'];choices=[]
     # Require alternatives absent from the source paragraph, preserving a unique
     # answer to the explicitly quoted event instead of implying they never occur.
     pool2=[x for cid,x in pool if cid!=c['id'] and x.casefold() not in c['paragraphs'][hit['paragraph']]['en'].casefold() and x.casefold()!=obj.casefold() and (x.split()[0].lower()==obj.split()[0].lower() or (x.split()[0].lower() in {'two','three','four','five','six','seven','eight','nine','ten'} and obj.split()[0].lower() in {'two','three','four','five','six','seven','eight','nine','ten'})) and abs(len(x.split())-len(obj.split()))<=3]
     rng.shuffle(pool2)
     for x in pool2:
      if x.casefold() not in {v.casefold() for v in choices} and obj.casefold() not in x.casefold() and x.casefold() not in obj.casefold():choices.append(x)
      if len(choices)==2:break
     
     if len(choices)<2:
      numeric={'two':['three','five'],'three':['two','six'],'four':['two','seven'],'five':['three','eight'],'six':['two','nine'],'seven':['three','ten'],'eight':['two','six'],'nine':['four','seven'],'ten':['five','eight']}
      if obj.split()[0].lower() in numeric:
       choices=[n+' '+obj.split(' ',1)[1] for n in numeric[obj.split()[0].lower()]]
     
     if len(choices)<2:
      for cid,x in pool:
       if cid==c['id']:continue
       alt=obj.split()[0]+' '+x.split(' ',1)[1]
       if alt.casefold() not in c['paragraphs'][hit['paragraph']]['en'].casefold() and alt.casefold() not in {v.casefold() for v in choices} and abs(len(alt.split())-len(obj.split()))<=2:
        choices.append(alt)
       if len(choices)==2:break
     assert len(choices)==2,(c['id'],obj,'no suitable distractors')
     options=[obj]+choices;rng.shuffle(options);pi=hit['paragraph'];p=c['paragraphs'][pi]
     qs.append(dict(question=f'依據〈{c["title"]}〉第 {pi+1} 段的事件，哪個選項能正確補完整句？\n{hit["cloze"].strip()}',options=options,answer=options.index(obj),explanation=f'原文證據：{hit["sentence"]}\n本段對照：{p["zh"]}'))
     evidence.append(dict(paragraph=pi+1,type='literal_event_recall',sourceSentence=hit['sentence'],answer=obj))
   assert len(qs)==2
   for q in qs:assert len(q['options'])==len(set(q['options']))==3 and 0<=q['answer']<3 and q['explanation']
   c['questions']=qs;changed=True;totals['chapters']+=1;totals['questions']+=2;report.append(dict(book=bid,chapter=c['id'],evidence=evidence))
  if changed:
   raw=gzip.compress(json.dumps(chs,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);filename=f'{bid}-{hashlib.sha256(raw).hexdigest()[:12]}.bin';new.append((R/'public/books'/filename,raw));manifest['books'][bid]={**meta,'url':'./books/'+filename};totals['books']+=1
 for path,raw in new:path.write_bytes(raw)
 (R/'public/content-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
 (R/'verification/legacy-quiz-additions.json').write_text(json.dumps(dict(summary=totals,reviewStatus='editorial_draft; not full semantic review',method='two source-grounded event recall questions per previously empty chapter; 14 individually authored questions and remaining contextual event cloze questions',chapters=report),ensure_ascii=False,indent=2)+'\n')
 print(totals)
if __name__=='__main__':run()
