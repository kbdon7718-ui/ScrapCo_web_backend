const express = require('express');
const { createPublicAnonClient } = require('../supabase/client');

const router = express.Router();

// Fallback types keep the UI usable but DO NOT include fake "live" rates.
// Real rates should come from Supabase tables: scrap_types + scrap_rates.
const FALLBACK_TYPES = [
  { id: 'plastic', name: 'Plastic', ratePerKg: null },
  { id: 'cardboard', name: 'Cardboard', ratePerKg: null },
  { id: 'metal', name: 'Metal', ratePerKg: null },
  { id: 'paper', name: 'Paper', ratePerKg: null },
];

// GET /api/scrap-types
// Returns list of scrap types with the current active rate (if any)
router.get('/', async (req, res) => {
  try {
    let supabase;
    try {
      supabase = createPublicAnonClient();
    } catch (e) {
      // If Supabase env vars are not configured, keep the UI usable.
      return res.json({ success: true, source: 'fallback', count: FALLBACK_TYPES.length, types: FALLBACK_TYPES });
    }

    const { data: types, error: typesErr } = await supabase
      .from('scrap_types')
      .select('id,name,description,created_at')
      .order('name', { ascending: true });

    if (typesErr) {
      console.warn('scrap_types query failed; returning defaults:', typesErr.message);
      return res.json({ success: true, source: 'fallback', count: FALLBACK_TYPES.length, types: FALLBACK_TYPES });
    }

    const { data: rates, error: ratesErr } = await supabase
      .from('scrap_rates')
      .select('scrap_type_id,rate_per_kg,effective_from,is_active')
      .eq('is_active', true);

    if (ratesErr) {
      console.warn('scrap_rates query failed; returning defaults:', ratesErr.message);
      // Types are still real, but rates couldn't be loaded.
      const outNoRates = (types || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        ratePerKg: null,
      }));

      return res.json({
        success: true,
        source: 'supabase',
        warning: 'rates_unavailable',
        count: outNoRates.length,
        types: outNoRates,
      });
    }

    const latestRateByType = new Map();
    for (const r of rates || []) {
      const prev = latestRateByType.get(r.scrap_type_id);
      if (!prev) {
        latestRateByType.set(r.scrap_type_id, r);
        continue;
      }
      // pick latest effective_from
      const prevDate = prev.effective_from ? new Date(prev.effective_from) : new Date(0);
      const nextDate = r.effective_from ? new Date(r.effective_from) : new Date(0);
      if (nextDate >= prevDate) latestRateByType.set(r.scrap_type_id, r);
    }

    const out = (types || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      ratePerKg: latestRateByType.get(t.id)?.rate_per_kg ?? null,
    }));

    if (!out.length) {
      return res.json({ success: true, source: 'fallback', count: FALLBACK_TYPES.length, types: FALLBACK_TYPES });
    }

    return res.json({ success: true, source: 'supabase', count: out.length, types: out });
  } catch (err) {
    console.error('Failed to fetch scrap types', err);
    return res.status(500).json({ success: false, error: 'Could not fetch scrap types' });
  }
});

module.exports = router;
