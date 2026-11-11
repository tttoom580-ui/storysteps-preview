# Stage and token manuscript review

Source baseline: original HEAD content manifest and its referenced gzip payloads, extracted before editing. Final assets preserve all 25 chapter IDs and chapter order, schema, original glossary records, names, principal events, and chapter-level plot outcomes.

## ss-r4-l3-b

Final: `ss-r4-l3-b.json`.

- 25 revised chapters, 13,690 English prose words; chapter range 509–578.
- 501 target entries retained; every exact case-insensitive whole-word target occurs in its chapter. Meanings are nonempty; each chapter retains at least 20 distinct entries.
- Removed rotating reflective tails while retaining the chapter-specific investigation, permissions, witness, sponsor, rehearsal, and relationship material and original vocabulary scenes.
- Added specific actions: recording script copies, checking completed print jobs, reconstructing the room's actual seating capacity, auditing permissions and copies, testing performance choices, documenting contract refusal, and applying the new editing process to Mara's own draft.
- Reviewed all 50 quiz answers against the revised scenes. Corrected the question that incorrectly implied the board had already instructed Celeste when the scene records her agreement to correct the editorial history.
- Reordered the safety invitation/meeting/walk sequence in chapter 17. Moved the pre-opening seating inquiry before audience admission in chapter 24; placed applause after the performance. Removed a leftover untranslated generic sentence in chapter 13.
- Ending preserves professional independence, chosen credits, protected withdrawn interviews, and the continuing Mara/Theo relationship.

## ss-r3-l2-a

Final: `ss-r3-l2-a.json`.

- 25 revised chapters, 14,179 English prose words; chapter range 526–607.
- 501 target entries retained; every exact case-insensitive whole-word target occurs in its chapter. Meanings are nonempty; each chapter retains at least 20 distinct entries.
- Replaced repeated narrative architecture with three newly authored scene paragraphs per chapter, each with paired Traditional Chinese, surrounding the retained original vocabulary scene.
- Continuous plot: six denied apprentices; old protection and Ren's practical test; clinic, fees, engine, and planting shortages; omitted membership; forged notice; participation rules; shared meal and merchant count; wet reserves and archive access; reachable invitations; debt; representation and allocation model; protected child witnesses; recovery of the crate; accessible ledger; damaged screen and preserved copies; founding contract; vote and first fair distribution.
- Replaced all 50 quizzes with chapter-specific questions, distinct three-option choices, valid answer indices, and Chinese explanations verified against the actual new prose. No stale paragraph or evidence references remain.
- Restored natural occurrence of targets outside the retained vocabulary scene where needed: trusted, blamed, lowered, arranged, delivered.
- Corrected the nephew/postcard wording and corresponding Chinese. Made the training water gun consistent with its vocabulary meaning and Chinese. Gao remains suspended in chapter 25; the new distribution is operated by trained clerks rather than repeating his earlier confrontation.
- Ending pays off the original six apprentices receiving lessons and transfers recordkeeping to other people, with no recycled unresolved-question ending.

## Validation

For both complete arrays: valid chapter identity/order, nonempty English/Chinese paragraph pairs, at least 500 English prose words per chapter using the release audit's word pattern, original glossary target occurrence and uniqueness, nonempty meanings, two valid three-option quizzes per chapter, and zero normalized English sentences of at least 12 words repeated across chapters within either book.

The root installer `--check-only` also passed both assets with zero errors and zero repeated long-sentence patterns. No public assets, shared scripts, manifests, git state, or publishing operations were modified by this work.
