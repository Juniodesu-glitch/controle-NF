/**
 * POST /api/import/trigger
 * Dispara o importer Python para processar XMLs da pasta OneDrive
 * 
 * Body (opcional):
 * {
 *   "force": true,  // force reimport de todos os arquivos
 *   "scope": "onedrive" | "all"
 * }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "taskId": "uuid",
 *   "message": "Importação iniciada",
 *   "source": "C:\\Users\\...",
 * }
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// UUID simples generator
function generateTaskId() {
  return crypto.randomBytes(16).toString('hex');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Store de tarefas em memória (em produção use Redis / DB)
const importTasks = new Map();

async function runImporter(taskId, options = {}) {
  const importerDir = path.join(__dirname, '../../integracao_supabase_importer');
  const importer = path.join(importerDir, 'importer.py');

  if (!fs.existsSync(importer)) {
    throw new Error(`importer.py não encontrado: ${importer}`);
  }

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    
    // Configurações do importer
    env.RUN_ONCE = '1';
    if (options.force) {
      env.FORCE_REIMPORT_ALL = '1';
    }

    const pythonProcess = spawn('python', [importer], {
      cwd: importerDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString('utf-8');
      stdout += chunk;
      console.log(`[${taskId}] STDOUT:`, chunk);
      
      // Atualiza task com log
      if (importTasks.has(taskId)) {
        const task = importTasks.get(taskId);
        task.logs.push({ timestamp: new Date(), type: 'info', message: chunk });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString('utf-8');
      stderr += chunk;
      console.log(`[${taskId}] STDERR:`, chunk);
      
      if (importTasks.has(taskId)) {
        const task = importTasks.get(taskId);
        task.logs.push({ timestamp: new Date(), type: 'error', message: chunk });
      }
    });

    pythonProcess.on('close', (code) => {
      const success = code === 0;
      console.log(`[${taskId}] Process finished with code ${code}`);
      
      // Atualiza task status
      if (importTasks.has(taskId)) {
        const task = importTasks.get(taskId);
        task.status = success ? 'completed' : 'failed';
        task.exitCode = code;
        task.finishedAt = new Date();
      }

      if (success) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Importer exited with code ${code}: ${stderr}`));
      }
    });

    pythonProcess.on('error', (err) => {
      console.error(`[${taskId}] Process error:`, err);
      if (importTasks.has(taskId)) {
        const task = importTasks.get(taskId);
        task.status = 'failed';
        task.error = err.message;
      }
      reject(err);
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Handler principal
exports.trigger = async (req, res) => {
  try {
    // Validar origem (opcional: verificar token)
    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const body = await readBody(req);
    const taskId = generateTaskId();
    const force = body.force === true;

    // Registra task
    importTasks.set(taskId, {
      id: taskId,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      force,
      logs: [],
      exitCode: null,
      error: null,
    });

    // Inicia importer em background
    runImporter(taskId, { force })
      .then((result) => {
        const task = importTasks.get(taskId);
        if (task) {
          task.result = result;
        }
        console.log(`✅ Import ${taskId} completed successfully`);
      })
      .catch((err) => {
        const task = importTasks.get(taskId);
        if (task) {
          task.error = err.message;
        }
        console.error(`❌ Import ${taskId} failed:`, err.message);
      });

    // Retorna imediatamente com taskId
    json(res, 202, {
      ok: true,
      taskId,
      message: 'Importação iniciada',
      source: process.env.NF_SOURCE_DIR || 'C:\\Users\\junio.gomes\\OneDrive - Capricórnio Têxtil S.A\\nf--app2.0',
    });
  } catch (err) {
    console.error('[trigger] Error:', err.message);
    json(res, 500, { ok: false, error: err.message });
  }
};

// Handler para verificar status
exports.status = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return json(res, 400, { ok: false, error: 'taskId required' });
    }

    const task = importTasks.get(taskId);
    if (!task) {
      return json(res, 404, { ok: false, error: 'Task not found' });
    }

    json(res, 200, {
      ok: true,
      task: {
        id: task.id,
        status: task.status,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        force: task.force,
        exitCode: task.exitCode,
        error: task.error,
        logCount: task.logs.length,
      },
    });
  } catch (err) {
    console.error('[status] Error:', err.message);
    json(res, 500, { ok: false, error: err.message });
  }
};

// Handler para logs
exports.logs = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const taskId = url.searchParams.get('taskId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);

    if (!taskId) {
      return json(res, 400, { ok: false, error: 'taskId required' });
    }

    const task = importTasks.get(taskId);
    if (!task) {
      return json(res, 404, { ok: false, error: 'Task not found' });
    }

    const logs = task.logs.slice(-limit);

    json(res, 200, {
      ok: true,
      taskId,
      logs,
      total: task.logs.length,
    });
  } catch (err) {
    console.error('[logs] Error:', err.message);
    json(res, 500, { ok: false, error: err.message });
  }
};

// Handler para list tasks
exports.list = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const tasks = Array.from(importTasks.values()).map((t) => ({
      id: t.id,
      status: t.status,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
      force: t.force,
    }));

    json(res, 200, {
      ok: true,
      tasks,
      total: tasks.length,
    });
  } catch (err) {
    console.error('[list] Error:', err.message);
    json(res, 500, { ok: false, error: err.message });
  }
};
