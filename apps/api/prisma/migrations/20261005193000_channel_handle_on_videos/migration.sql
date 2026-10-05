-- Human-readable @handle on channel + denormalized on each video for DB search.
ALTER TABLE "channels" ADD COLUMN "youtube_handle" TEXT;

ALTER TABLE "videos" ADD COLUMN "channel_handle" TEXT;

-- Existing ТОПЛЕС library (from @Toplesofficial research).
UPDATE "channels"
SET "youtube_handle" = 'Toplesofficial'
WHERE "youtube_channel_id" = 'UC2Ru64PHqW4FxoP0xhQRvJg';

UPDATE "videos" AS v
SET "channel_handle" = '@' || c."youtube_handle"
FROM "channels" AS c
WHERE v."channel_id" = c."id"
  AND c."youtube_handle" IS NOT NULL;
