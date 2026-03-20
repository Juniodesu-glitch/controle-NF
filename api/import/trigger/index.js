/**
 * POST /api/import/trigger/
 * Dispara o importer Python para processar XMLs da pasta OneDrive
 */

const { trigger, status, logs, list } = require('../trigger');

module.exports = async (req, res) => {
  // Route requests based on method and query params
  const action = req.query.action || 'trigger';
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      await trigger(req, res);
    } else if (req.method === 'GET') {
      if (action === 'status') {
        await status(req, res);
      } else if (action === 'logs') {
        await logs(req, res);
      } else if (action === 'list') {
        await list(req, res);
      } else {
        res.status(400).json({ ok: false, error: 'Invalid action' });
      }
    } else {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[import/trigger] Unhandled error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
