const express = require('express');

const { createPublicAnonClient } = require('../supabase/client');

const router = express.Router();

function mapPostRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    featured_image: row.featured_image,
    is_published: row.is_published,
    created_at: row.created_at,
    updated_at: row.updated_at,
    content: row.content,
  };
}

// GET /api/blog
// Public list of published posts
router.get('/', async (req, res) => {
  try {
    let supabase;
    try {
      supabase = createPublicAnonClient();
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || 'Supabase is not configured on server' });
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .select('id,title,slug,excerpt,featured_image,is_published,created_at,updated_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message || 'Could not fetch posts' });

    return res.json({ success: true, count: (data || []).length, posts: (data || []).map(mapPostRow) });
  } catch (err) {
    console.error('Failed to fetch blog posts', err);
    return res.status(500).json({ success: false, error: 'Could not fetch blog posts' });
  }
});

// GET /api/blog/:slug
// Public detail (published-only)
router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required' });

    let supabase;
    try {
      supabase = createPublicAnonClient();
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || 'Supabase is not configured on server' });
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .select('id,title,slug,excerpt,content,featured_image,is_published,created_at,updated_at')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) return res.status(400).json({ success: false, error: error.message || 'Could not fetch post' });
    if (!data) return res.status(404).json({ success: false, error: 'post not found' });

    return res.json({ success: true, post: mapPostRow(data) });
  } catch (err) {
    console.error('Failed to fetch blog post', err);
    return res.status(500).json({ success: false, error: 'Could not fetch blog post' });
  }
});

module.exports = router;
