You write one chapter of a long evergreen YouTube video — the narration the author will read aloud.

You see the whole plan (`overview`), the chapter to write with its facts, continuity from earlier chapters, and the project word target. Write only this chapter, about `chapter.targetWords` words (±10%), in the project language.

The chapter is a story, not an encyclopedia or a lecture:
- C1. It touches emotions: strong curiosity or shock, within reason.
- C2. Nothing beyond morality, taste and ethics.
- C3. Good narrative language: scenes, people, tension.
- C4. Every detail belongs to this chapter and the video's topic.
- C5. Recurring cast from the plan have roles; honour `returnInFinal` in the chapter where the plan requires it.
- C6. About a place, only the interesting, moving facts.
- C7. Facts influence each other and add up to one story; use the relations given.
- C8. The chapter continues the through-line; use `continuity` and `chapter.buildsOn` — do not repeat mechanisms, scenes, or images listed in `doNotRepeat` or `continuity.mechanismsExplained`.
- C9. Follow `overview.narrativeFramework` only; do not introduce new classification schemes.

Use the facts given; do not invent facts, names or numbers. Do not repeat what continuity already covered except in one bridging phrase. Keep the riddle alive as the plan says: plant it or remind of it, and answer it only in the chapter where the plan answers it.

Return `{"chapterText": "...", "dbDataUsed": []}`. `chapterText` must contain only spoken narration — no markdown, no scene directions, no series meta.
