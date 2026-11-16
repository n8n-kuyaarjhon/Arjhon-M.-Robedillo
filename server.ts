import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = process.cwd();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, 'data', 'uploads'));
const MAX_FILE_BYTES = 8 * 1024 * 1024;

interface FileMeta {
  fileId: string;
  filename: string;
  mime: string;
  size: number;
  storedName: string;
}

const fileRegistry = new Map<string, FileMeta>();

function sanitizeExt(filename: string): string {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

async function restoreRegistry(): Promise<void> {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  const entries = await fsp.readdir(UPLOAD_DIR).catch(() => []);
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = await fsp.readFile(path.join(UPLOAD_DIR, name), 'utf8');
      const meta = JSON.parse(raw) as FileMeta;
      if (meta && meta.fileId && meta.storedName) {
        fileRegistry.set(meta.fileId, meta);
      }
    } catch {
      // Ignore unreadable metadata files
    }
  }
}

async function startServer(): Promise<void> {
  await restoreRegistry();

  const app = express();
  app.use(express.json({ limit: '14mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'cshs-document-request',
      time: new Date().toISOString(),
    });
  });

  app.post('/api/uploads', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        kind?: string;
        filename?: string;
        mime?: string;
        dataBase64?: string;
      };

      const kind = String(body.kind || 'document');
      const filename = String(body.filename || 'upload');
      const mime = String(body.mime || '').toLowerCase();
      const dataBase64 = String(body.dataBase64 || '');

      const isImage = mime.startsWith('image/');
      const isPdf = mime === 'application/pdf';
      if (!isImage && !isPdf) {
        res.status(415).json({ error: 'Upload a photo or a PDF only.' });
        return;
      }
      if (kind === 'photo' && !isImage) {
        res.status(415).json({ error: 'The photo of the person claiming must be an image.' });
        return;
      }
      if (!dataBase64) {
        res.status(400).json({ error: 'Missing file payload.' });
        return;
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
        res.status(413).json({ error: 'Each file must be 8 MB or smaller.' });
        return;
      }

      const fileId = crypto.randomBytes(12).toString('hex');
      const ext = sanitizeExt(filename) || (isPdf ? '.pdf' : '.png');
      const storedName = `${fileId}${ext}`;
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
      await fsp.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

      const meta: FileMeta = {
        fileId,
        filename: path.basename(filename).slice(0, 120),
        mime,
        size: buffer.length,
        storedName,
      };
      fileRegistry.set(fileId, meta);
      await fsp.writeFile(path.join(UPLOAD_DIR, `${fileId}.json`), JSON.stringify(meta));

      res.status(201).json({
        fileId,
        url: `/api/files/${fileId}`,
        mime: meta.mime,
        size: meta.size,
        filename: meta.filename,
      });
    } catch (err) {
      console.error('[upload-error]', err);
      res.status(500).json({ error: 'Could not save uploaded file.' });
    }
  });

  app.get('/api/files/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!/^[a-f0-9]{16,32}$/.test(id)) {
      res.status(400).json({ error: 'Invalid file ID.' });
      return;
    }

    let meta = fileRegistry.get(id);
    if (!meta) {
      try {
        const raw = await fsp.readFile(path.join(UPLOAD_DIR, `${id}.json`), 'utf8');
        meta = JSON.parse(raw) as FileMeta;
        fileRegistry.set(id, meta);
      } catch {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
    }

    const filePath = path.join(UPLOAD_DIR, meta.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(410).json({ error: 'The file is no longer on the server.' });
      return;
    }

    res.setHeader('Content-Type', meta.mime);
    res.setHeader('Content-Disposition', `inline; filename="${meta.filename.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(filePath).pipe(res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`CSHS Student Clearance System running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
