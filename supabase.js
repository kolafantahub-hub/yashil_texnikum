import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase sozlanmagan. .env.local fayliga loyiha URL va anon key qiymatlarini kiriting.",
    );
  }
  return supabase;
}

export async function fetchPosts() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("blog_posts")
    .select("id, title, summary, body, date, image, video, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function savePost(post) {
  const client = requireSupabase();
  const { error } = await client.from("blog_posts").upsert({
    id: post.id,
    title: post.title,
    summary: post.summary,
    body: post.body,
    date: post.date,
    image: post.image || null,
    video: post.video || null,
    created_at: post.created_at || new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function deletePost(postId) {
  const client = requireSupabase();
  const { error } = await client.from("blog_posts").delete().eq("id", postId);
  if (error) {
    throw error;
  }
}

export async function uploadPostMedia(file, postId, mediaType) {
  const client = requireSupabase();
  const safePostId = String(postId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "media";
  const path = `${safePostId}/${mediaType}-${safeFileName}`;
  const { error } = await client.storage.from("blog-media").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from("blog-media").getPublicUrl(path);
  return {
    type: "remote",
    path,
    url: data.publicUrl,
    name: file.name,
    mimeType: file.type,
  };
}

export async function deletePostMedia(...mediaItems) {
  const paths = mediaItems
    .filter((media) => media?.type === "remote" && media.path)
    .map((media) => media.path);

  if (!paths.length) {
    return;
  }

  const client = requireSupabase();
  const { error } = await client.storage.from("blog-media").remove(paths);
  if (error) {
    throw error;
  }
}
