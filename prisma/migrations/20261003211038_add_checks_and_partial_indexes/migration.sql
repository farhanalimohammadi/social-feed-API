-- Users: normalized identifiers
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_lowercase_chk" CHECK ("username" = lower("username")),
  ADD CONSTRAINT "users_email_lowercase_chk"    CHECK ("email" = lower("email"));

-- Posts: no blank content or caption
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_content_not_blank_chk" CHECK (btrim("content") <> ''),
  ADD CONSTRAINT "posts_caption_not_blank_chk" CHECK ("caption" IS NULL OR btrim("caption") <> '');

-- Comments: no blank text, no self-parent
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_text_not_blank_chk" CHECK (btrim("text") <> ''),
  ADD CONSTRAINT "comments_no_self_parent_chk" CHECK ("parent_comment_id" IS DISTINCT FROM "id");

-- Partial indexes for top-level comments and replies
CREATE INDEX "comments_top_level_idx"
  ON "comments" ("post_id", "created_at" DESC, "id" DESC)
  WHERE "parent_comment_id" IS NULL;

CREATE INDEX "comments_replies_idx"
  ON "comments" ("parent_comment_id", "created_at" DESC, "id" DESC)
  WHERE "parent_comment_id" IS NOT NULL;