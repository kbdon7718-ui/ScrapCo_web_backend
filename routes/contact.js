const express = require('express');
const { createServiceClient } = require('../supabase/client');

const router = express.Router();

// POST /api/contact
// Body: { name, phone, message, source? }
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const message = String(req.body?.message || '').trim();
  const source = String(req.body?.source || 'website').trim();

  if (!name) return res.status(400).json({ success: false, error: 'name is required' });
  if (!phone) return res.status(400).json({ success: false, error: 'phone is required' });
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });

  // Always respond success to keep website UX reliable.
  // If Supabase is configured and a compatible table exists, we store the lead.
  let stored = false;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('contact_messages').insert([
      {
        name,
        phone,
        message,
        source,
      },
    ]);

    if (!error) stored = true;
    else console.warn('Contact lead not stored:', error.message);
  } catch (e) {
    console.warn('Contact lead storage skipped:', e?.message || e);
  }

  return res.status(201).json({ success: true, stored });
});

module.exports = router;
