// Homepage reviews (Adam, 2026-11-05): submitted by visitors from
// the reviews section, held as 'pending', and shown on the
// homepage only after the site owner approves them in /admin.
import { randomUUID } from "crypto";
import { ensureSchema, query } from "./db";

export interface PublicReview {
  stars: number;
  text: string;
  name: string;
  context: string;
}

export interface AdminReview extends PublicReview {
  id: string;
  status: string;
  created_at: string;
}

interface ReviewRow {
  id: string;
  name: string;
  context: string | null;
  stars: number;
  body: string;
  status: string;
  created_at: string;
}

export async function listApprovedReviews(limit = 24): Promise<PublicReview[]> {
  await ensureSchema();
  const rows = await query<ReviewRow>(
    `SELECT id, name, context, stars, body, status, created_at::text AS created_at
       FROM iris_reviews WHERE status = 'approved'
      ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    stars: r.stars,
    text: r.body,
    name: r.name,
    context: r.context ?? "",
  }));
}

export async function createReview(input: {
  name: string;
  context: string | null;
  stars: number;
  body: string;
  userId: string | null;
}): Promise<string> {
  await ensureSchema();
  const id = randomUUID();
  await query(
    `INSERT INTO iris_reviews (id, name, context, stars, body, status, user_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
    [id, input.name, input.context, input.stars, input.body, input.userId],
  );
  return id;
}

export async function listReviewsForAdmin(): Promise<AdminReview[]> {
  await ensureSchema();
  const rows = await query<ReviewRow>(
    `SELECT id, name, context, stars, body, status, created_at::text AS created_at
       FROM iris_reviews
      ORDER BY (status = 'pending') DESC, created_at DESC
      LIMIT 100`,
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    stars: r.stars,
    text: r.body,
    name: r.name,
    context: r.context ?? "",
  }));
}

export async function setReviewStatus(id: string, status: string): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE iris_reviews SET status = $2 WHERE id = $1 RETURNING id`,
    [id, status],
  );
  return rows.length > 0;
}
