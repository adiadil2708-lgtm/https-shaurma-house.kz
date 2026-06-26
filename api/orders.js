// api/orders.js
// Vercel Serverless function to accept orders from the website.
// Behavior:
// - Accepts POST JSON { items, total, createdAt, source }
// - Generates an order id and returns { id }
// - If SUPABASE_URL and SUPABASE_SERVICE_KEY are set, tries to save to Supabase table `orders` via REST API
// - Otherwise returns id without persistence (ephemeral)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const order = req.body || {};
    const id = Date.now().toString(36) + '-' + Math.floor(Math.random() * 9000);
    order.id = id;
    order.receivedAt = new Date().toISOString();

    // Try Supabase persistence if env vars are set
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key recommended for server-side writes

    if (SUPABASE_URL && SUPABASE_KEY) {
      // Expect a table `orders` with columns: id (text), payload (jsonb), total (numeric), receivedAt (timestamp)
      const payload = {
        id: order.id,
        payload: order,
        total: order.total || 0,
        receivedAt: order.receivedAt
      };

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error('Supabase write failed', resp.status, txt);
        // still return id but inform about partial failure
        return res.status(200).json({ id, persisted: false, warning: 'Supabase write failed' });
      }

      const saved = await resp.json();
      return res.status(200).json({ id, persisted: true, saved: saved });
    }

    // No persistence configured — return id only
    return res.status(200).json({ id, persisted: false });
  } catch (err) {
    console.error('order handler error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
