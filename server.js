const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OUTBOX_DIR = path.join(DATA_DIR, 'email-outbox');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const DEFAULT_STATE = {
  projectProfile: {
    clientName: 'Contoso Manufacturing',
    siteName: 'Plant 1',
    projectManager: 'ERP Program Manager',
    targetGoLive: '2026-05-08',
    overallStatus: 'Watch',
    budgetHealth: '92% plan consumed',
    executiveSummary: 'Program is progressing through testing and change readiness with focus on cutover stability.'
  },
  emailAutomation: {
    recipients: 'steering.committee@example.com',
    cc: 'pmo@example.com',
    reportType: 'executive',
    cadence: 'Weekly',
    subject: 'ERP Implementation Weekly Status Update',
    message: 'Please find the latest ERP implementation status update below.',
    lastSentAt: null,
    lastDeliveryMode: 'not-sent'
  },
  signedOff: {},
  checklist: {},
  extraRisks: [],
  extraChangeRequests: [],
  extraActionItems: []
};

const DEFAULT_USERS = [
  { username: 'admin', password: 'ERPTracker!2026', role: 'admin', permissions: ['view_dashboard', 'edit_project', 'send_reports', 'manage_users'] },
  { username: 'pm', password: 'ProjectLead!2026', role: 'project-manager', permissions: ['view_dashboard', 'edit_project', 'send_reports'] },
  { username: 'exec', password: 'Executive!2026', role: 'executive', permissions: ['view_dashboard', 'send_reports'] },
  { username: 'viewer', password: 'Viewer!2026', role: 'viewer', permissions: ['view_dashboard'] }
];

const sessions = new Map();
let sqlModuleCache;
let sqlPoolPromise;
let mailModuleCache;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizeState(raw = {}) {
  return {
    projectProfile: {
      ...DEFAULT_STATE.projectProfile,
      ...(raw.projectProfile || {})
    },
    emailAutomation: {
      ...DEFAULT_STATE.emailAutomation,
      ...(raw.emailAutomation || {})
    },
    signedOff: raw.signedOff || {},
    checklist: raw.checklist || {},
    extraRisks: Array.isArray(raw.extraRisks) ? raw.extraRisks : [],
    extraChangeRequests: Array.isArray(raw.extraChangeRequests) ? raw.extraChangeRequests : [],
    extraActionItems: Array.isArray(raw.extraActionItems) ? raw.extraActionItems : []
  };
}

function ensureStateFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function ensureUsersFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
  }
}

function ensureOutboxDir() {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

function readUsers() {
  if (process.env.ERP_TRACKER_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.ERP_TRACKER_USERS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      console.error('ERP_TRACKER_USERS_JSON is not valid JSON. Falling back to file users.');
    }
  }

  ensureUsersFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

function readStateFromFile() {
  ensureStateFile();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch {
    return DEFAULT_STATE;
  }
}

function writeStateToFile(nextState) {
  ensureStateFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(normalizeState(nextState), null, 2));
}

async function getSqlModule() {
  if (sqlModuleCache !== undefined) {
    return sqlModuleCache;
  }

  try {
    sqlModuleCache = require('mssql');
  } catch {
    sqlModuleCache = null;
  }

  return sqlModuleCache;
}

function hasSqlConfig() {
  return Boolean(
    process.env.DB_SERVER &&
    process.env.DB_DATABASE &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD
  );
}

async function ensureSqlSchema(pool, sql) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.erp_tracker_state', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.erp_tracker_state (
        id INT NOT NULL PRIMARY KEY,
        payload NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  const result = await pool.request().query(`SELECT COUNT(1) AS total FROM dbo.erp_tracker_state WHERE id = 1;`);
  if (!result.recordset[0].total) {
    await pool.request()
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(DEFAULT_STATE))
      .query(`INSERT INTO dbo.erp_tracker_state (id, payload) VALUES (1, @payload);`);
  }
}

async function getSqlPool() {
  const sql = await getSqlModule();
  if (!sql || !hasSqlConfig()) {
    return { sql: null, pool: null };
  }

  if (!sqlPoolPromise) {
    sqlPoolPromise = sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_DATABASE,
      options: {
        encrypt: (process.env.DB_ENCRYPT || 'true').toLowerCase() !== 'false',
        trustServerCertificate: (process.env.DB_TRUST_CERT || 'false').toLowerCase() === 'true'
      },
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
      }
    }).then(async (pool) => {
      await ensureSqlSchema(pool, sql);
      return pool;
    }).catch((error) => {
      console.error('SQL Server connection failed, falling back to file storage:', error.message);
      sqlPoolPromise = null;
      return null;
    });
  }

  return {
    sql,
    pool: await sqlPoolPromise
  };
}

async function getStorageMode() {
  const { pool } = await getSqlPool();
  return pool ? 'sqlserver' : 'json-file';
}

async function getStorageDiagnostics() {
  const sql = await getSqlModule();
  const { pool } = await getSqlPool();
  return {
    storageMode: pool ? 'sqlserver' : 'json-file',
    sqlConfigured: hasSqlConfig(),
    sqlDriverInstalled: Boolean(sql),
    fallbackReason: pool ? null : hasSqlConfig() ? 'connection-failed-or-unavailable' : 'not-configured'
  };
}

async function readState() {
  const { pool } = await getSqlPool();
  if (!pool) {
    return readStateFromFile();
  }

  const result = await pool.request().query(`SELECT TOP 1 payload FROM dbo.erp_tracker_state WHERE id = 1;`);
  const payload = result.recordset[0]?.payload || '{}';
  return normalizeState(JSON.parse(payload));
}

async function writeState(nextState) {
  const normalized = normalizeState(nextState);
  const { pool, sql } = await getSqlPool();

  if (!pool || !sql) {
    writeStateToFile(normalized);
    return { mode: 'json-file' };
  }

  await pool.request()
    .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(normalized))
    .query(`
      MERGE dbo.erp_tracker_state AS target
      USING (SELECT 1 AS id) AS source
      ON target.id = source.id
      WHEN MATCHED THEN
        UPDATE SET payload = @payload, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (id, payload) VALUES (1, @payload);
    `);

  return { mode: 'sqlserver' };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function serveStatic(requestPath, response) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const resolvedPath = path.normalize(path.join(ROOT, safePath));

  if (!resolvedPath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    response.end(content);
  });
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const [key, ...rest] = part.split('=');
      cookies[key] = decodeURIComponent(rest.join('='));
      return cookies;
    }, {});
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    request.on('error', reject);
  });
}

function safeEquals(value, expected) {
  const left = Buffer.from(String(value || ''));
  const right = Buffer.from(String(expected || ''));
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function hasPermission(session, permission) {
  return Array.isArray(session?.permissions) && session.permissions.includes(permission);
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    username: user.username,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSession(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies.erp_session;
  if (!token || !sessions.has(token)) {
    return null;
  }

  const session = sessions.get(token);
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return {
    token,
    username: session.username,
    role: session.role,
    permissions: session.permissions
  };
}

function requireAuth(request, response, requiredPermission = 'view_dashboard') {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { ok: false, error: 'Authentication required' });
    return null;
  }

  if (requiredPermission && !hasPermission(session, requiredPermission)) {
    sendJson(response, 403, { ok: false, error: 'You do not have permission to perform this action.' });
    return null;
  }

  return session;
}

async function getMailModule() {
  if (mailModuleCache !== undefined) {
    return mailModuleCache;
  }

  try {
    mailModuleCache = require('nodemailer');
  } catch {
    mailModuleCache = null;
  }

  return mailModuleCache;
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function buildServerReport(currentState, type = 'executive') {
  const profile = currentState.projectProfile || DEFAULT_STATE.projectProfile;
  const today = new Date().toLocaleDateString();
  const signoffCount = Object.values(currentState.signedOff || {}).filter(Boolean).length;
  const checklistCount = Object.values(currentState.checklist || {}).filter(Boolean).length;
  const riskCount = (currentState.extraRisks || []).length;
  const changeCount = (currentState.extraChangeRequests || []).length;
  const actionCount = (currentState.extraActionItems || []).length;

  return `ERP Implementation Status Report (${type === 'executive' ? 'Executive' : 'Steering Committee'})\nDate: ${today}\nClient: ${profile.clientName}\nSite: ${profile.siteName}\nProject Manager: ${profile.projectManager}\nTarget Go-Live: ${profile.targetGoLive}\nOverall Status: ${profile.overallStatus}\nBudget Health: ${profile.budgetHealth}\nExecutive Summary: ${profile.executiveSummary}\n\nMetrics:\n- Signoffs complete: ${signoffCount}\n- Checklist items closed: ${checklistCount}\n- Custom risks logged: ${riskCount}\n- Change requests logged: ${changeCount}\n- Custom action items logged: ${actionCount}`;
}

async function sendStatusEmail({ recipients, cc, subject, reportType, message, currentState, requestedBy }) {
  const reportText = buildServerReport(currentState, reportType);
  const payload = {
    to: recipients,
    cc,
    subject,
    requestedBy,
    reportType,
    message,
    reportText,
    sentAt: new Date().toISOString()
  };

  const nodemailer = await getMailModule();
  if (nodemailer && hasSmtpConfig()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || ''
      } : undefined
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      cc: cc || undefined,
      subject,
      text: `${message || ''}\n\n${reportText}`.trim()
    });

    return { deliveryMode: 'smtp' };
  }

  ensureOutboxDir();
  const filename = `status-report-${Date.now()}.json`;
  fs.writeFileSync(path.join(OUTBOX_DIR, filename), JSON.stringify(payload, null, 2));
  return { deliveryMode: 'file-outbox', filename };
}

async function getAutomationDiagnostics() {
  const mailer = await getMailModule();
  return {
    smtpConfigured: hasSmtpConfig(),
    mailDriverInstalled: Boolean(mailer),
    emailDeliveryMode: hasSmtpConfig() && mailer ? 'smtp' : 'file-outbox'
  };
}

function getRenderDiagnostics() {
  const renderBlueprintPresent = fs.existsSync(path.join(ROOT, 'render.yaml'));
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL || '';
  const runningOnRender = Boolean(process.env.RENDER || renderExternalUrl);
  return {
    renderBlueprintPresent,
    runningOnRender,
    renderExternalUrl: renderExternalUrl || null,
    renderReady: renderBlueprintPresent && (runningOnRender || Boolean(renderExternalUrl))
  };
}

async function testSqlConnection() {
  const diagnostics = await getStorageDiagnostics();
  if (!diagnostics.sqlConfigured) {
    return {
      ok: false,
      target: 'sql',
      message: 'SQL Server credentials are not configured.',
      ...diagnostics
    };
  }

  const { pool } = await getSqlPool();
  return {
    ok: Boolean(pool),
    target: 'sql',
    message: pool ? 'SQL Server connection verified.' : 'Unable to connect to SQL Server with the current settings.',
    ...diagnostics
  };
}

async function testSmtpConnection() {
  const diagnostics = await getAutomationDiagnostics();
  if (!diagnostics.smtpConfigured) {
    return {
      ok: false,
      target: 'smtp',
      message: 'SMTP credentials are not configured.',
      ...diagnostics
    };
  }

  const nodemailer = await getMailModule();
  if (!nodemailer) {
    return {
      ok: false,
      target: 'smtp',
      message: 'Nodemailer is not installed.',
      ...diagnostics
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || ''
      } : undefined
    });

    await transporter.verify();
    return {
      ok: true,
      target: 'smtp',
      message: 'SMTP connection verified.',
      ...diagnostics
    };
  } catch (error) {
    return {
      ok: false,
      target: 'smtp',
      message: `SMTP verification failed: ${error.message}`,
      ...diagnostics
    };
  }
}

function testRenderReadiness() {
  const render = getRenderDiagnostics();
  return {
    ok: render.renderBlueprintPresent,
    target: 'render',
    message: render.renderReady
      ? 'Render deployment settings look ready.'
      : 'Render blueprint exists, but production environment variables still need to be supplied in Render.',
    ...render
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const diagnostics = await getStorageDiagnostics();
      const automation = await getAutomationDiagnostics();
      const render = getRenderDiagnostics();
      sendJson(response, 200, {
        ok: true,
        mode: 'backend',
        ...diagnostics,
        ...automation,
        ...render,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/config/status') {
      const diagnostics = await getStorageDiagnostics();
      const automation = await getAutomationDiagnostics();
      const render = getRenderDiagnostics();
      sendJson(response, 200, {
        ok: true,
        authenticationRequired: true,
        availableUsers: readUsers().map(({ password, ...user }) => user),
        ...diagnostics,
        ...automation,
        ...render
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/integrations/test') {
      const session = requireAuth(request, response, 'view_dashboard');
      if (!session) {
        return;
      }

      const target = String(url.searchParams.get('target') || '').toLowerCase();
      let result;

      if (target === 'sql') {
        result = await testSqlConnection();
      } else if (target === 'smtp') {
        result = await testSmtpConnection();
      } else if (target === 'render') {
        result = testRenderReadiness();
      } else {
        sendJson(response, 400, { ok: false, error: 'Unknown target. Use sql, smtp, or render.' });
        return;
      }

      sendJson(response, result.ok ? 200 : 503, {
        ...result,
        requestedBy: session.username,
        checkedAt: new Date().toISOString()
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/automation/status') {
      const session = requireAuth(request, response, 'view_dashboard');
      if (!session) {
        return;
      }

      const automation = await getAutomationDiagnostics();
      sendJson(response, 200, {
        ok: true,
        role: session.role,
        permissions: session.permissions,
        ...automation
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/session') {
      const session = getSession(request);
      if (!session) {
        const diagnostics = await getStorageDiagnostics();
        sendJson(response, 401, {
          ok: false,
          authenticated: false,
          ...diagnostics
        });
        return;
      }

      const diagnostics = await getStorageDiagnostics();
      sendJson(response, 200, {
        ok: true,
        authenticated: true,
        username: session.username,
        role: session.role,
        permissions: session.permissions,
        ...diagnostics
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const { username, password } = await readJsonBody(request);
      const user = readUsers().find((entry) => safeEquals(username, entry.username) && safeEquals(password, entry.password));

      if (!user) {
        sendJson(response, 401, { ok: false, error: 'Invalid username or password.' });
        return;
      }

      const token = createSession(user);
      const diagnostics = await getStorageDiagnostics();
      sendJson(response, 200, {
        ok: true,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        ...diagnostics
      }, {
        'Set-Cookie': `erp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const existingSession = getSession(request);
      if (existingSession) {
        sessions.delete(existingSession.token);
      }

      sendJson(response, 200, { ok: true }, {
        'Set-Cookie': 'erp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      if (!requireAuth(request, response, 'view_dashboard')) {
        return;
      }

      sendJson(response, 200, await readState());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/state') {
      const session = requireAuth(request, response, 'edit_project');
      if (!session) {
        return;
      }

      const payload = await readJsonBody(request);
      const result = await writeState(payload);
      sendJson(response, 200, {
        ok: true,
        savedAt: new Date().toISOString(),
        savedBy: session.username,
        storageMode: result.mode
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/reports/email') {
      const session = requireAuth(request, response, 'send_reports');
      if (!session) {
        return;
      }

      const currentState = await readState();
      const payload = await readJsonBody(request);
      const recipients = String(payload.recipients || '').trim();
      const subject = String(payload.subject || '').trim();

      if (!recipients || !subject) {
        sendJson(response, 400, { ok: false, error: 'Recipients and subject are required.' });
        return;
      }

      const result = await sendStatusEmail({
        recipients,
        cc: String(payload.cc || '').trim(),
        subject,
        reportType: payload.reportType === 'steering' ? 'steering' : 'executive',
        message: String(payload.message || '').trim(),
        currentState,
        requestedBy: session.username
      });

      const nextState = {
        ...currentState,
        emailAutomation: {
          ...currentState.emailAutomation,
          recipients,
          cc: String(payload.cc || '').trim(),
          reportType: payload.reportType === 'steering' ? 'steering' : 'executive',
          cadence: String(payload.cadence || currentState.emailAutomation?.cadence || 'Weekly'),
          subject,
          message: String(payload.message || '').trim(),
          lastSentAt: new Date().toISOString(),
          lastDeliveryMode: result.deliveryMode
        }
      };
      await writeState(nextState);

      sendJson(response, 200, {
        ok: true,
        requestedBy: session.username,
        role: session.role,
        deliveryMode: result.deliveryMode,
        filename: result.filename || null,
        sentAt: nextState.emailAutomation.lastSentAt
      });
      return;
    }

    if (request.method === 'GET') {
      serveStatic(url.pathname, response);
      return;
    }

    response.writeHead(405);
    response.end('Method Not Allowed');
  } catch (error) {
    console.error('Server error:', error.message);
    sendJson(response, 500, {
      ok: false,
      error: 'Server error',
      detail: error.message
    });
  }
});

server.listen(PORT, () => {
  ensureStateFile();
  ensureUsersFile();
  ensureOutboxDir();
  console.log(`ERP tracker running at http://localhost:${PORT}`);
});
