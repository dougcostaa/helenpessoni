// Guarda e entrega os dados do dashboard (Vercel Blob).
// GET  /api/dados  -> devolve os dados salvos (qualquer pessoa com o link)
// POST /api/dados  -> salva (precisa da senha em LANCAMENTO_SENHA)
const crypto = require('crypto');
const ARQUIVO = 'dados-funil.json';

function senhaOk(enviada) {
  const certa = process.env.LANCAMENTO_SENHA || '';
  if (!certa || typeof enviada !== 'string') return false;
  const a = Buffer.from(enviada), b = Buffer.from(certa);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { put, list } = await import('@vercel/blob');

    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: ARQUIVO, limit: 1 });
      if (!blobs.length) return res.status(404).json({ vazio: true });
      const r = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'POST') {
      if (!process.env.LANCAMENTO_SENHA) {
        return res.status(500).json({ erro: 'senha não configurada no Vercel' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!senhaOk(body.senha)) return res.status(401).json({ erro: 'senha incorreta' });
      const data = body.data;
      if (!data || typeof data.months !== 'object') return res.status(400).json({ erro: 'dados inválidos' });
      const texto = JSON.stringify(data);
      if (texto.length > 500000) return res.status(413).json({ erro: 'arquivo grande demais' });
      await put(ARQUIVO, texto, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erro: 'método não permitido' });
  } catch (e) {
    return res.status(500).json({ erro: 'falha no servidor: ' + (e && e.message ? e.message : e) });
  }
};
