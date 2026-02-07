import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../packages');

const app = express();
const PORT = 3005;

// ── Multer storage: write uploaded files to packages/:name/:version/ ──

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const { name, version } = req.params;
    const dir = path.join(PACKAGES_DIR, name, version);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// ── Publish endpoint ──

app.post(
  '/publish/:name/:version',
  upload.fields([
    { name: 'client', maxCount: 1 },
    { name: 'server', maxCount: 1 },
  ]),
  (req, res) => {
    const { name, version } = req.params;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    if (!files?.client?.[0] || !files?.server?.[0]) {
      res.status(400).json({ error: 'Both "client" and "server" files are required' });
      return;
    }

    console.log(`[registry] Published ${name}@${version}`);
    res.json({
      name,
      version,
      client: `/packages/${name}/${version}/${files.client[0].originalname}`,
      server: `/packages/${name}/${version}/${files.server[0].originalname}`,
    });
  },
);

// ── Serve package files with CORS ──

app.use(
  '/packages',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(PACKAGES_DIR),
);

// ── Manifest: auto-generated from published packages ──

app.get('/manifest', async (_req, res) => {
  const manifest: Record<string, { version: string; entry: string; server: string }> = {};

  try {
    const names = await fs.readdir(PACKAGES_DIR);

    for (const name of names) {
      const namePath = path.join(PACKAGES_DIR, name);
      const stat = await fs.stat(namePath);
      if (!stat.isDirectory()) continue;

      const versions = await fs.readdir(namePath);
      // Pick highest version (simple lexicographic sort; fine for semver with same digit counts)
      const latest = versions.sort().reverse()[0];
      if (!latest) continue;

      // Map package name to manifest key (e.g. "todo-list" -> "todoList")
      const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

      manifest[key] = {
        version: latest,
        entry: `http://localhost:${PORT}/packages/${name}/${latest}/client.js`,
        server: `http://localhost:${PORT}/packages/${name}/${latest}/server.cjs`,
      };
    }
  } catch {
    // packages dir may not exist yet
  }

  res.json(manifest);
});

app.listen(PORT, () => {
  console.log(`[registry] MFE registry running at http://localhost:${PORT}`);
});
