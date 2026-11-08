# StorySteps — fifth manuscript import and homepage refresh

This import replaces 11 current A/B slots with new narratives, retaining 31 active books / 775 chapters. Each replacement has a fresh `ss-r5-` ID so earlier reading progress is not applied to an unrelated narrative. The supplied 1B fourth version (Shell Bay) supersedes the simultaneously supplied third version (Forest Post Office); the latter is not published as a duplicate 1B slot. 1A is unchanged.

Validated before catalog mutation: 25 sequential chapters per book; paired English/Traditional Chinese paragraphs; at least 500 English words per chapter; 20 new target IDs per chapter (21 in chapter 25); 501 distinct IDs per book; exact agreement with the supplied A/B chapter plans; all listed surface forms present in the English prose; two valid three-choice questions per chapter. This is structural/content matching, not a completed literary or proficiency review.

All 11 replacement stories have new portrait covers generated with the built-in image tool; prompt scenes are in `asset-source/batch5-cover-prompts.json`, and encoded assets/hashes in `asset-source/batch5-cover-manifest.json`. WebP copies live under `public/covers/` and `docs/covers/`.

Homepage: four story cards precede the small two-column check-in/weekly-goal row. The topic/sample picker follows the featured story and sponsor placement. First-chapter opens from the existing opt-in 30-day research endpoint determine popularity; editorial selections fill slots without claims of measured popularity. Loading/failure/empty results retain clearly labeled selections.

The header provides a one-click light/dark toggle using the existing local comfort preference, shared with reader controls. Sponsor copy addresses the intended school-age readership without claiming unverified audience size.

Build: `npm run build` passed. New manuscript IDs were added to the existing study Worker's allowlist; the database schema and retention policy are unchanged. Browser/live asset checks are recorded after deployment.
