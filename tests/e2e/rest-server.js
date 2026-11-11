// Mini « PostgREST » : POST /rest/v1/rpc/<fonction> → appelle la fonction SQL en tant que rôle anon,
// comme le fait Supabase. Sert uniquement aux tests de bout en bout (jamais en production).
// Usage : node tests/e2e/rest-server.js [dossier du socket Postgres]   → http://localhost:8790
const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({ host: process.argv[2] || '/var/tmp/caisse-pg', port: 5499, user: 'postgres', database: 'caisse' });
// Comme Supabase : toute fonction peut être demandée, mais les droits du rôle anon décident (GRANT/REVOKE).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(req.url);
    if (!m || !m[1].startsWith('caisse_') || !req.headers.apikey) {
      res.writeHead(404, cors);
      return res.end('{"message":"not found"}');
    }
    let body = '';
    for await (const c of req) body += c;
    const args = JSON.parse(body || '{}');
    const names = Object.keys(args);
    const sql = `select public.${m[1]}(${names.map((n, i) => `${n} := $${i + 1}`).join(', ')}) as r`;
    const values = names.map((n) => (typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
    let client;
    try {
      client = await pool.connect();
      await client.query('begin');
      await client.query('set local role anon');
      const r = await client.query(sql, values);
      await client.query('commit');
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r.rows[0].r));
    } catch (e) {
      if (client) await client.query('rollback').catch(() => {});
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: e.message }));
    } finally {
      if (client) client.release();
    }
  })
  .listen(8790, () => console.log('serveur de lobby de test sur http://localhost:8790'));
