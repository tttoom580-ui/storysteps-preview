"""Build a conservative question-to-source review queue for editors.

Finding an answer string in source prose only creates a CANDIDATE.
It is not proof that the answer is correct. No manuscript edits or certification.
"""
from pathlib import Path
from collections import Counter
import gzip,json,re
R=Path(__file__).resolve().parents[1];P=R/'public'
catalog=json.loads((P/'catalog.js').read_text().split('=',1)[1].rstrip(';\n'))
manifest=json.loads((P/'content-manifest.json').read_text())
normalize=lambda x:' '.join(re.findall(r"[a-z0-9]+(?:['’][a-z0-9]+)*",x.casefold()))
rows=[];counts=Counter()
for b in catalog:
  cs=json.loads(gzip.decompress((P/manifest['books'][b['id']]['url']).read_bytes()))
  for c in cs:
    for qi,q in enumerate(c['questions'],1):
      if '原文證據：' in q['explanation']:
        counts['already_has_citation_marker']+=1
        continue
      a=q['options'][q['answer']]
      phrase=normalize(a)
      if len(phrase)<4:
        class_name='too_short_for_literal_match';paras=[]
      elif phrase in {'yes','no','true','false','all of the above','none of the above'}:
        class_name='generic_answer';paras=[]
      else:
        paras=[]
        for pi,p in enumerate(c['paragraphs'],1):
          if phrase in normalize(p['en']):paras.append(pi)
        class_name='literal_answer_in_one_paragraph' if len(paras)==1 else ('multiple_possible_paragraphs' if paras else 'requires_semantic_paraphrase_review')
      counts[class_name]+=1
      rows.append({'book':b['id'],'chapter':c['id'],'quiz':qi,'question':q['question'],'correctOption':a,'sourceParagraphCandidates':paras[:10],'triage':class_name,'approved':False})
report={'scope':'Uncited quiz source-evidence triage only; matching an answer option literally does not prove that question/answer is semantically correct.','summary':dict(counts,totalUncited=len(rows),semanticApprovalsFromThisScript=0),'questions':rows}
(R/'verification/quiz-source-review-20261114.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':'))+'\n')
print('QUIZ_EVIDENCE_TRIAGE',json.dumps(report['summary'],ensure_ascii=False))
