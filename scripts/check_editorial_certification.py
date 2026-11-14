"""Enforce the five-gate editorial release policy; automatic checks never certify prose.

A certification is valid only for the exact reviewed book payload and 25 chapter hashes.
Each chapter requires independent, documented editorial review of plot/continuity,
natural English/timeline, bilingual meaning, target words and quiz answers.
The final book-level approval is separate from the four substantive chapter gates.
"""
from pathlib import Path
import gzip
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CATALOG = json.loads((PUBLIC / "catalog.js").read_text(encoding="utf-8").split("=", 1)[1].rstrip(";\n"))
MANIFEST = json.loads((PUBLIC / "content-manifest.json").read_text(encoding="utf-8"))
LEDGER = json.loads((ROOT / "verification/editorial-approvals.json").read_text(encoding="utf-8"))
CERTS = LEDGER.get("certifiedBooks", {})
GATES = ("plotAndCrossChapterDistinct", "englishNaturalnessAndTimeline", "bilingualMeaning", "targetWordsAndQuizAnswers")
errors = []
approved = []

def word_count(txt):
    return len(re.findall(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*", txt))

if LEDGER.get("schemaVersion") != 1 or not isinstance(CERTS, dict):
    errors.append("Invalid editorial approvals ledger schema")
if set(MANIFEST["books"]) != {book["id"] for book in CATALOG}:
    errors.append("Manifest and catalog contain different book IDs")
if set(CERTS) - {book["id"] for book in CATALOG}:
    errors.append("Certificates exist for unknown book IDs")

for book in CATALOG:
    book_id = book["id"]
    cert = CERTS.get(book_id)
    if not cert:
        if book.get("learningReviewRequired") is not True:
            errors.append(f"{book_id}: unapproved book must explicitly have learningReviewRequired=true")
        continue
    try:
        entry = MANIFEST["books"][book_id]
        raw_path = (PUBLIC / entry["url"]).resolve()
        if not raw_path.is_relative_to(PUBLIC.resolve()):
            raise ValueError("Book resource escapes public directory")
        raw_bytes = raw_path.read_bytes()
        raw_sha = hashlib.sha256(raw_bytes).hexdigest()
        if cert.get("bookSourceSha256") != raw_sha:
            raise ValueError("Book payload SHA256 changed since editorial review")
        chapters = json.loads(gzip.decompress(raw_bytes))
        if len(chapters) != 25 or len(cert.get("chapters", {})) != 25:
            raise ValueError("Exactly 25 source chapters and 25 approval receipts required")
        if set(cert["chapters"]) != {chapter["id"] for chapter in chapters}:
            raise ValueError("Approval receipt chapter IDs differ from the actual payload")
        for chapter in chapters:
            cid = chapter["id"]
            receipt = cert["chapters"][cid]
            chapter_sha = hashlib.sha256(json.dumps(chapter, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
            if receipt.get("sourceChapterSha256") != chapter_sha:
                raise ValueError(f"{cid}: source chapter changed after review")
            if not all(receipt.get(gate) is True for gate in GATES):
                raise ValueError(f"{cid}: one or more editorial gates are not approved")
            if not receipt.get("reviewer") or not receipt.get("reviewedAt") or not receipt.get("evidencePath"):
                raise ValueError(f"{cid}: missing review attribution, date or evidence")
            evidence = (ROOT / receipt["evidencePath"]).resolve()
            if not evidence.is_relative_to((ROOT / "verification").resolve()) or not evidence.is_file():
                raise ValueError(f"{cid}: missing repository-local verification record")
            if receipt.get("bilingualParagraphsReviewed") != len(chapter["paragraphs"]):
                raise ValueError(f"{cid}: not all English/Chinese paragraphs recorded as checked")
            if receipt.get("quizAnswersReviewed") != len(chapter["questions"]):
                raise ValueError(f"{cid}: not all quiz answers recorded as checked")
            if word_count(" ".join(p["en"] for p in chapter["paragraphs"])) < 500:
                raise ValueError(f"{cid}: chapter under 500 English words")
            if len(chapter["words"]) < 20:
                raise ValueError(f"{cid}: chapter under 20 target words")
            if len(chapter["questions"]) < 2:
                raise ValueError(f"{cid}: chapter has fewer than two quizzes")
        if cert.get("finalApproval") is not True or not cert.get("approvedBy") or not cert.get("approvedAt"):
            raise ValueError("Book-level final approval missing")
        if book.get("learningReviewRequired") is not False:
            raise ValueError("Certified book must be explicitly marked learningReviewRequired=false")
        approved.append(book_id)
    except (KeyError, ValueError, OSError, TypeError, json.JSONDecodeError) as exc:
        errors.append(f"{book_id}: {exc}")

print(f"EDITORIAL_CERTIFICATION books={len(CATALOG)} certified={len(approved)} pending={len(CATALOG)-len(approved)}")
if errors:
    print("\n".join("EDITORIAL_ERROR " + error for error in errors), file=sys.stderr)
    sys.exit(1)
