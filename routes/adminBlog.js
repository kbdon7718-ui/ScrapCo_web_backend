const express = require('express');

const { createServiceClient } = require('../supabase/client');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || String(expected).trim() === '') {
    return res.status(500).json({ success: false, error: 'ADMIN_API_KEY is not configured on server' });
  }

  const incoming = req.headers['x-admin-key'];
  if (!incoming || String(incoming) !== String(expected)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return next();
}

function normalizeSlug(input) {
  const s = String(input || '').trim();
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

router.use(requireAdminKey);

// GET /api/admin/blog
// Admin list (includes unpublished)
router.get('/', async (req, res) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id,title,slug,excerpt,content,featured_image,is_published,created_at,updated_at')
      .order('updated_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message || 'Could not fetch posts' });
    return res.json({ success: true, count: (data || []).length, posts: data || [] });
  } catch (err) {
    console.error('Admin blog list failed', err);
    return res.status(500).json({ success: false, error: 'Could not fetch posts' });
  }
});

// POST /api/admin/blog
router.post('/', async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const slugRaw = req.body?.slug;
    const excerpt = req.body?.excerpt != null ? String(req.body.excerpt) : null;
    const content = req.body?.content != null ? String(req.body.content) : '';
    const featuredImage = req.body?.featured_image != null ? String(req.body.featured_image) : null;
    const isPublished = Boolean(req.body?.is_published);

    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    const slug = normalizeSlug(slugRaw || title);
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required' });

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('blog_posts')
      .insert([
        {
          title,
          slug,
          excerpt,
          content,
          featured_image: featuredImage,
          is_published: isPublished,
        },
      ])
      .select('id,title,slug,excerpt,content,featured_image,is_published,created_at,updated_at')
      .maybeSingle();

    if (error) {
      const msg = error.message || 'Could not create post';
      if (/duplicate key value|blog_posts_slug_key/i.test(msg)) {
        return res.status(409).json({ success: false, error: 'slug already exists' });
      }
      return res.status(400).json({ success: false, error: msg });
    }

    return res.status(201).json({ success: true, post: data });
  } catch (err) {
    console.error('Admin blog create failed', err);
    return res.status(500).json({ success: false, error: 'Could not create post' });
  }
});

// PUT /api/admin/blog/:id
router.put('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const patch = {};

    if (req.body?.title != null) patch.title = String(req.body.title).trim();
    if (req.body?.slug != null) patch.slug = normalizeSlug(req.body.slug);
    if (req.body?.excerpt !== undefined) patch.excerpt = req.body.excerpt != null ? String(req.body.excerpt) : null;
    if (req.body?.content !== undefined) patch.content = req.body.content != null ? String(req.body.content) : '';
    if (req.body?.featured_image !== undefined) patch.featured_image = req.body.featured_image != null ? String(req.body.featured_image) : null;
    if (req.body?.is_published !== undefined) patch.is_published = Boolean(req.body.is_published);

    if (patch.title != null && !patch.title) return res.status(400).json({ success: false, error: 'title cannot be empty' });
    if (patch.slug != null && !patch.slug) return res.status(400).json({ success: false, error: 'slug cannot be empty' });

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('blog_posts')
      .update(patch)
      .eq('id', id)
      .select('id,title,slug,excerpt,content,featured_image,is_published,created_at,updated_at')
      .maybeSingle();

    if (error) {
      const msg = error.message || 'Could not update post';
      if (/duplicate key value|blog_posts_slug_key/i.test(msg)) {
        return res.status(409).json({ success: false, error: 'slug already exists' });
      }
      return res.status(400).json({ success: false, error: msg });
    }
    if (!data) return res.status(404).json({ success: false, error: 'post not found' });

    return res.json({ success: true, post: data });
  } catch (err) {
    console.error('Admin blog update failed', err);
    return res.status(500).json({ success: false, error: 'Could not update post' });
  }
});

// DELETE /api/admin/blog/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const supabase = createServiceClient();

    const { data, error } = await supabase.from('blog_posts').delete().eq('id', id).select('id').maybeSingle();

    if (error) return res.status(400).json({ success: false, error: error.message || 'Could not delete post' });
    if (!data) return res.status(404).json({ success: false, error: 'post not found' });

    return res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Admin blog delete failed', err);
    return res.status(500).json({ success: false, error: 'Could not delete post' });
  }
});

module.exports = router;
