const storageKey = 'erp-tracker-state-v2';
const themeStorageKey = 'erp-tracker-theme';

const defaultState = {
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

let state = structuredClone(defaultState);
let persistenceMode = 'browser';
let authState = {
  isAuthenticated: window.location.protocol === 'file:',
  username: window.location.protocol === 'file:' ? 'Local Browser' : '',
  role: window.location.protocol === 'file:' ? 'local-admin' : '',
  permissions: window.location.protocol === 'file:' ? ['view_dashboard', 'edit_project', 'send_reports', 'manage_users'] : []
};
let integrationStatus = {
  authenticationRequired: window.location.protocol !== 'file:',
  storageMode: 'browser',
  sqlConfigured: false,
  sqlDriverInstalled: false,
  smtpConfigured: false,
  mailDriverInstalled: false,
  emailDeliveryMode: 'file-outbox',
  renderBlueprintPresent: false,
  runningOnRender: false,
  renderExternalUrl: null,
  renderReady: false,
  message: ''
};

const phaseData = [
  {
    name: '1. Discovery & Requirements Gathering',
    owner: 'PMO + Process Owners',
    progress: 92,
    note: 'Business process maps, gap log, and KPI baseline validated.'
  },
  {
    name: '2. Configuration & Data Migration',
    owner: 'Functional Leads + Data Team',
    progress: 74,
    note: 'Item master, BOM, routing, and customer conversions in mock load cycle 2.'
  },
  {
    name: '3. Testing (Unit → UAT → Go-Live)',
    owner: 'QA Lead + SMEs',
    progress: 61,
    note: 'Critical scenarios covering planning, shipping, and month-end close in execution.'
  },
  {
    name: '4. Training & Change Management',
    owner: 'Change Lead + Supervisors',
    progress: 58,
    note: 'Role-based work instructions and super-user workshops underway.'
  },
  {
    name: '5. Hypercare / Support',
    owner: 'Support Lead',
    progress: 20,
    note: 'Command center staffing and issue triage model defined.'
  }
];

const kpis = [
  { name: 'OTIF', value: '96.2%', trend: '+1.8%', tone: 'success', target: '95%', progress: 96, icon: '🚚' },
  { name: 'Inventory Accuracy', value: '98.4%', trend: '+0.9%', tone: 'success', target: '98%', progress: 98, icon: '📦' },
  { name: 'Schedule Adherence', value: '93.1%', trend: '-0.6%', tone: 'warning', target: '95%', progress: 93, icon: '🗓️' },
  { name: 'Data Load Accuracy', value: '99.3%', trend: '+0.5%', tone: 'success', target: '99%', progress: 99, icon: '🧮' },
  { name: 'Training Completion', value: '84%', trend: '+7%', tone: 'neutral', target: '100%', progress: 84, icon: '🎓' },
  { name: 'Open Critical Risks', value: '3', trend: 'stable', tone: 'danger', target: '<=2', progress: 62, icon: '⚠️' }
];

const analyticsTrends = {
  otif: [91.4, 92.1, 93.7, 94.2, 95.3, 96.2],
  training: [46, 55, 63, 72, 78, 84],
  cutover: [18, 26, 39, 51, 64, 71]
};

const baseMilestones = [
  { id: 'scope-signoff', title: 'Requirements baseline signoff', phase: 'Discovery', owner: 'Client Sponsor', date: '2026-04-12', status: 'On Track' },
  { id: 'solution-design', title: 'Future-state solution design approved', phase: 'Configuration', owner: 'Solution Architect', date: '2026-04-19', status: 'On Track' },
  { id: 'mock-load-2', title: 'Mock data migration cycle 2 complete', phase: 'Data Migration', owner: 'Data Lead', date: '2026-04-24', status: 'Watch' },
  { id: 'uat-entry', title: 'UAT entry criteria achieved', phase: 'Testing', owner: 'QA Lead', date: '2026-04-29', status: 'Watch' },
  { id: 'training-ready', title: 'Supervisor training signoff', phase: 'Training', owner: 'Change Lead', date: '2026-05-04', status: 'On Track' },
  { id: 'cutover-go', title: 'Go/No-Go decision', phase: 'Go-Live', owner: 'Steering Committee', date: '2026-05-08', status: 'Pending' }
];

const baseRisks = [
  { title: 'BOM revision mismatch causing incorrect material backflush', severity: 'Critical', owner: 'Engineering Lead', mitigation: 'Reconcile released BOM revisions against SyteLine load set before mock load 3.' },
  { title: 'Cycle count accuracy below target for go-live warehouse', severity: 'High', owner: 'Warehouse Manager', mitigation: 'Execute wall-to-wall count and ABC tolerance review.' },
  { title: 'Shop floor barcode scanners not validated in all work centers', severity: 'High', owner: 'IT Infrastructure', mitigation: 'Complete device certification script during unit testing.' },
  { title: 'Legacy routing standards inconsistent by plant', severity: 'Medium', owner: 'Operations Excellence', mitigation: 'Approve standard work center and labor reporting rules.' },
  { title: 'Month-end cost rollup timing may slip cutover window', severity: 'Medium', owner: 'Finance Controller', mitigation: 'Dry-run costing close with parallel ledger review.' }
];

const baseChangeRequests = [
  {
    title: 'Add customer-specific EDI ship notice fields',
    impact: 'Scope increase to outbound logistics mapping; 2 extra dev days and regression test of shipping docs.',
    requestor: 'Customer Service Manager',
    status: 'Pending CAB'
  },
  {
    title: 'Extend UAT script set for subcontract operations',
    impact: 'Requires one more UAT workshop and validation of outside processing transactions.',
    requestor: 'Production Planner',
    status: 'Assessment'
  }
];

const baseActionItems = [
  {
    title: 'Finalize item master governance signoff',
    phase: 'Discovery',
    owner: 'Data Lead',
    dueDate: '2026-04-11',
    status: 'On Track',
    notes: 'Close remaining UOM and product code decisions with plant SMEs.'
  },
  {
    title: 'Complete mock load cycle 3 reconciliation',
    phase: 'Configuration/Data Migration',
    owner: 'ERP Program Manager',
    dueDate: '2026-04-23',
    status: 'Watch',
    notes: 'Validate BOM, routings, and inventory balances before UAT entry.'
  },
  {
    title: 'Run end-to-end shipping and invoicing UAT scenario',
    phase: 'Testing',
    owner: 'QA Lead',
    dueDate: '2026-04-28',
    status: 'On Track',
    notes: 'Include pick, pack, ASN, invoice, and financial posting checks.'
  },
  {
    title: 'Train supervisors on exception handling',
    phase: 'Training & Change',
    owner: 'Change Lead',
    dueDate: '2026-05-02',
    status: 'Pending',
    notes: 'Focus on labor reporting, rework, and nonconformance transactions.'
  }
];

const raciRows = [
  ['Executive Sponsor', 'A', 'I', 'I', 'I', 'I', 'A'],
  ['Steering Committee Chair', 'A', 'C', 'I', 'I', 'I', 'A'],
  ['ERP Program Manager', 'R', 'A', 'A', 'A', 'A', 'R'],
  ['Client Project Manager', 'R', 'R', 'R', 'R', 'R', 'R'],
  ['Solution Architect', 'C', 'A', 'C', 'C', 'I', 'C'],
  ['Manufacturing Lead', 'R', 'R', 'C', 'R', 'C', 'R'],
  ['Supply Chain Lead', 'R', 'R', 'C', 'R', 'C', 'R'],
  ['Finance Lead', 'R', 'C', 'C', 'R', 'I', 'C'],
  ['Quality Manager', 'C', 'C', 'I', 'R', 'C', 'R'],
  ['Warehouse Manager', 'C', 'R', 'R', 'R', 'C', 'R'],
  ['Production Planner', 'C', 'R', 'C', 'R', 'I', 'R'],
  ['Data Migration Lead', 'I', 'C', 'A', 'C', 'I', 'C'],
  ['BI / Reporting Lead', 'C', 'R', 'C', 'R', 'I', 'C'],
  ['QA Test Lead', 'I', 'C', 'C', 'A', 'I', 'C'],
  ['Training Lead', 'I', 'I', 'I', 'C', 'A', 'C'],
  ['Change Manager', 'C', 'I', 'I', 'C', 'A', 'C'],
  ['IT Infrastructure Lead', 'I', 'R', 'I', 'C', 'I', 'R'],
  ['Integration Developer', 'I', 'R', 'C', 'R', 'I', 'C'],
  ['Plant Super User', 'C', 'C', 'I', 'R', 'R', 'R'],
  ['Customer Service Lead', 'C', 'R', 'I', 'R', 'C', 'R'],
  ['Support Manager', 'I', 'I', 'I', 'C', 'C', 'A'],
  ['Database Administrator', 'I', 'C', 'R', 'C', 'I', 'R']
];

const sqlLibrary = [
  {
    title: 'Item master validation',
    description: 'Check required item setup before mock loads or cutover.',
    sql: `SELECT item, description, product_code, u_m, status
FROM item_mst
WHERE (description IS NULL OR product_code IS NULL OR u_m IS NULL)
ORDER BY item;`
  },
  {
    title: 'Inventory accuracy by warehouse',
    description: 'Compare on-hand quantities against count tolerances.',
    sql: `SELECT whse, item, qty_on_hand, qty_allocated,
       CASE WHEN qty_on_hand = 0 THEN 'REVIEW' ELSE 'OK' END AS flag
FROM itemloc_mst
WHERE whse IN ('MAIN', 'FG', 'RM')
ORDER BY whse, item;`
  },
  {
    title: 'BOM and routing completeness',
    description: 'Ensure manufactured items have both BOM and routing setup.',
    sql: `SELECT i.item,
       CASE WHEN b.parent_item IS NULL THEN 'Missing BOM' END AS bom_issue,
       CASE WHEN r.item IS NULL THEN 'Missing Routing' END AS routing_issue
FROM item_mst i
LEFT JOIN bom_mst b ON b.parent_item = i.item
LEFT JOIN jobroute_mst r ON r.item = i.item
WHERE i.product_code = 'MFG'
  AND (b.parent_item IS NULL OR r.item IS NULL);`
  },
  {
    title: 'Customer order date sanity check',
    description: 'Validate requested ship dates for OTIF commitments.',
    sql: `SELECT co_num, cust_num, order_date, due_date, stat
FROM co_mst
WHERE due_date < order_date
ORDER BY order_date DESC;`
  }
];

const agendas = [
  {
    title: 'Configuration Workshop Agenda',
    bullets: [
      'Review current-state pain points and SyteLine target process.',
      'Validate parameter decisions: site, warehouses, planning rules, costing method.',
      'Capture action log, owners, and signoff items.'
    ]
  },
  {
    title: 'UAT Workshop Agenda',
    bullets: [
      'Confirm entry criteria and master data readiness.',
      'Walk through end-to-end scripts: forecast → plan → make → ship → invoice.',
      'Log defects, severity, retest owner, and exit criteria.'
    ]
  }
];

const checklistItems = [
  'Final SyteLine backup completed and restore test verified',
  'Open critical defects triaged and signed off',
  'Warehouse scanners, printers, and labels validated',
  'MRP regeneration run and reviewed by planning lead',
  'Customer EDI / integrations monitoring enabled',
  'Support command center roster published',
  'Rollback decision tree approved by steering committee'
];

function normalizeState(raw = {}) {
  return {
    projectProfile: {
      ...defaultState.projectProfile,
      ...(raw.projectProfile || {})
    },
    emailAutomation: {
      ...defaultState.emailAutomation,
      ...(raw.emailAutomation || {})
    },
    signedOff: raw.signedOff || {},
    checklist: raw.checklist || {},
    extraRisks: Array.isArray(raw.extraRisks) ? raw.extraRisks : [],
    extraChangeRequests: Array.isArray(raw.extraChangeRequests) ? raw.extraChangeRequests : [],
    extraActionItems: Array.isArray(raw.extraActionItems) ? raw.extraActionItems : []
  };
}

async function checkSession() {
  if (window.location.protocol === 'file:') {
    authState = { isAuthenticated: true, username: 'Local Browser' };
    persistenceMode = 'browser';
    applyAuthState();
    return true;
  }

  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      authState = {
        isAuthenticated: true,
        username: data.username || 'ERP User',
        role: data.role || 'viewer',
        permissions: Array.isArray(data.permissions) ? data.permissions : []
      };
      persistenceMode = data.storageMode === 'sqlserver' ? 'sqlserver' : 'backend';
      integrationStatus.storageMode = persistenceMode;
      applyAuthState();
      return true;
    }
  } catch {
    persistenceMode = 'browser';
  }

  authState = { isAuthenticated: false, username: '', role: '', permissions: [] };
  applyAuthState();
  return false;
}

async function loadState() {
  if (window.location.protocol !== 'file:') {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (response.status === 401) {
        authState = { isAuthenticated: false, username: '', role: '', permissions: [] };
        applyAuthState();
        return structuredClone(defaultState);
      }

      if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
        persistenceMode = persistenceMode === 'sqlserver' ? 'sqlserver' : 'backend';
        integrationStatus.storageMode = persistenceMode;
        return normalizeState(await response.json());
      }
    } catch {
      persistenceMode = 'browser';
    }
  }

  const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
  persistenceMode = 'browser';
  return normalizeState(parsed);
}

async function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));

  if (window.location.protocol !== 'file:' && authState.isAuthenticated) {
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      if (response.status === 401) {
        authState = { isAuthenticated: false, username: '', role: '', permissions: [] };
        applyAuthState();
        return;
      }

      const payload = (response.headers.get('content-type') || '').includes('application/json')
        ? await response.json()
        : {};
      persistenceMode = payload.storageMode === 'sqlserver' ? 'sqlserver' : response.ok ? 'backend' : 'browser';
      integrationStatus.storageMode = persistenceMode;
    } catch {
      persistenceMode = 'browser';
      integrationStatus.storageMode = persistenceMode;
    }
  }

  renderStorageMode();
}

function pillClass(value) {
  if (['On Track', 'Approved', 'Complete'].includes(value)) return 'success';
  if (['Watch', 'Pending', 'Assessment', 'Pending CAB'].includes(value)) return 'warning';
  if (['Critical', 'Rejected'].includes(value)) return 'danger';
  return 'neutral';
}

function hasPermission(permission) {
  return window.location.protocol === 'file:' || authState.permissions.includes(permission);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(themeStorageKey, theme);
  const themeButton = document.getElementById('themeToggle');
  if (themeButton) {
    themeButton.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
}

function applyAuthState() {
  const overlay = document.getElementById('authOverlay');
  const userPill = document.getElementById('authUser');
  const logoutButton = document.getElementById('logoutButton');
  const authMessage = document.getElementById('authMessage');

  if (overlay) {
    overlay.classList.toggle('hidden', authState.isAuthenticated || window.location.protocol === 'file:');
  }

  if (userPill) {
    userPill.textContent = authState.isAuthenticated
      ? `User: ${authState.username} (${authState.role || 'user'})`
      : 'User: sign-in required';
    userPill.className = `pill ${authState.isAuthenticated ? 'success' : 'warning'}`;
  }

  if (logoutButton) {
    logoutButton.disabled = !authState.isAuthenticated || window.location.protocol === 'file:';
  }

  if (authState.isAuthenticated && authMessage) {
    authMessage.textContent = '';
    authMessage.className = 'auth-message';
  }

  applyAccessControls();
}

function renderEmailAutomation() {
  const automation = state.emailAutomation;
  const form = document.getElementById('emailAutomationForm');
  const status = document.getElementById('emailAutomationStatus');

  if (form) {
    form.elements.recipients.value = automation.recipients;
    form.elements.cc.value = automation.cc;
    form.elements.reportType.value = automation.reportType;
    form.elements.cadence.value = automation.cadence;
    form.elements.subject.value = automation.subject;
    form.elements.message.value = automation.message;
  }

  if (status) {
    status.textContent = automation.lastSentAt
      ? `Last sent: ${new Date(automation.lastSentAt).toLocaleString()} via ${automation.lastDeliveryMode}`
      : 'No email has been sent in this session.';
    status.className = 'helper-text';
  }
}

function applyAccessControls() {
  const canEdit = hasPermission('edit_project');
  const canSendReports = hasPermission('send_reports');
  const canReset = hasPermission('manage_users') || hasPermission('edit_project');

  const editSelectors = ['projectProfileForm', 'riskForm', 'changeRequestForm', 'actionItemForm'];
  editSelectors.forEach((formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    Array.from(form.elements).forEach((element) => {
      element.disabled = !canEdit;
    });
  });

  document.querySelectorAll('[data-signoff-id], [data-check-id]').forEach((element) => {
    element.disabled = !canEdit;
  });

  const resetButton = document.getElementById('resetTracker');
  if (resetButton) {
    resetButton.disabled = !canReset;
  }

  const emailForm = document.getElementById('emailAutomationForm');
  if (emailForm) {
    Array.from(emailForm.elements).forEach((element) => {
      if (element.id === 'sendStatusEmail' || element.type === 'button') {
        element.disabled = !canSendReports;
      } else if (element.type === 'submit') {
        element.disabled = !canEdit;
      } else {
        element.disabled = !(canEdit || canSendReports);
      }
    });
  }

  const status = document.getElementById('emailAutomationStatus');
  if (status && !canSendReports) {
    status.textContent = 'Your role can view reports but cannot send automated emails.';
    status.className = 'helper-text';
  }
}

function renderStorageMode() {
  const element = document.getElementById('storageMode');
  if (!element) return;

  const label = persistenceMode === 'sqlserver'
    ? 'Storage: SQL Server connected'
    : persistenceMode === 'backend'
      ? 'Storage: backend sync active'
      : 'Storage: browser-only mode';

  const tone = persistenceMode === 'browser' ? 'neutral' : 'success';
  element.textContent = label;
  element.className = `pill ${tone}`;
}

function daysUntil(dateString) {
  const target = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Number.isNaN(target.getTime()) ? 0 : Math.ceil((target - today) / 86400000);
}

function renderProjectProfile() {
  const profile = state.projectProfile;
  const form = document.getElementById('projectProfileForm');
  if (form) {
    form.elements.clientName.value = profile.clientName;
    form.elements.siteName.value = profile.siteName;
    form.elements.projectManager.value = profile.projectManager;
    form.elements.targetGoLive.value = profile.targetGoLive;
    form.elements.overallStatus.value = profile.overallStatus;
    form.elements.budgetHealth.value = profile.budgetHealth;
    form.elements.executiveSummary.value = profile.executiveSummary;
  }

  const health = document.getElementById('profileHealth');
  if (health) {
    const daysToGoLive = daysUntil(profile.targetGoLive);
    health.textContent = `${profile.overallStatus} • Go-live in ${daysToGoLive} days`;
    health.className = `pill ${pillClass(profile.overallStatus)}`;
  }
}

function renderSnapshot() {
  const signoffCount = Object.values(state.signedOff).filter(Boolean).length;
  const checklistCount = Object.values(state.checklist).filter(Boolean).length;
  const openCritical = [...baseRisks, ...state.extraRisks].filter((risk) => risk.severity === 'Critical').length;
  const profile = state.projectProfile;
  const daysToGoLive = daysUntil(profile.targetGoLive);

  const openActions = [...baseActionItems, ...state.extraActionItems].filter((item) => item.status !== 'Complete').length;

  document.getElementById('snapshotList').innerHTML = `
    <li><strong>${profile.clientName}</strong> rollout at <strong>${profile.siteName}</strong></li>
    <li><strong>${daysToGoLive}</strong> days until target go-live (${profile.targetGoLive})</li>
    <li><strong>${signoffCount}/${baseMilestones.length}</strong> client signoffs completed</li>
    <li><strong>${openCritical}</strong> critical manufacturing risks open</li>
    <li><strong>${checklistCount}/${checklistItems.length}</strong> go-live readiness steps closed</li>
    <li><strong>${openActions}</strong> workstream actions still open</li>
  `;
}

function renderPhases() {
  document.getElementById('phaseGrid').innerHTML = phaseData.map((phase) => `
    <div class="phase-card">
      <h3>${phase.name}</h3>
      <p>${phase.note}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${phase.progress}%"></div></div>
      <div class="phase-meta">
        <span>${phase.owner}</span>
        <strong>${phase.progress}%</strong>
      </div>
    </div>
  `).join('');
}

function renderKpis() {
  document.getElementById('kpiGrid').innerHTML = kpis.map((kpi) => `
    <div class="kpi-card kpi-${kpi.tone}">
      <div class="kpi-card-top">
        <span class="kpi-icon">${kpi.icon}</span>
        <span class="pill ${kpi.tone}">${kpi.trend}</span>
      </div>
      <h3>${kpi.name}</h3>
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-meta">
        <span>Target ${kpi.target}</span>
        <span>${kpi.progress}% health</span>
      </div>
      <div class="mini-meter"><div class="mini-meter-fill ${kpi.tone}" style="width:${Math.min(kpi.progress, 100)}%"></div></div>
    </div>
  `).join('');
}

function buildSparkline(values, tone = 'success') {
  const width = 160;
  const height = 52;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="sparkline sparkline-${tone}" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
    </svg>
  `;
}

function renderAnalyticsWidgets() {
  const container = document.getElementById('analyticsWidgets');
  if (!container) return;

  const signoffRate = Math.round((Object.values(state.signedOff).filter(Boolean).length / baseMilestones.length) * 100);
  const checklistRate = Math.round((Object.values(state.checklist).filter(Boolean).length / checklistItems.length) * 100);
  const phaseProgress = Math.round(phaseData.reduce((sum, phase) => sum + phase.progress, 0) / phaseData.length);
  const readinessScore = Math.round((signoffRate * 0.35) + (checklistRate * 0.35) + (phaseProgress * 0.3));

  const allRisks = [...baseRisks, ...state.extraRisks];
  const criticalRisks = allRisks.filter((risk) => risk.severity === 'Critical').length;
  const highRisks = allRisks.filter((risk) => risk.severity === 'High').length;
  const mediumRisks = allRisks.filter((risk) => risk.severity === 'Medium').length;
  const openActions = [...baseActionItems, ...state.extraActionItems].filter((item) => item.status !== 'Complete').length;
  const lateActions = [...baseActionItems, ...state.extraActionItems].filter((item) => item.status !== 'Complete' && daysUntil(item.dueDate) < 0).length;

  container.innerHTML = `
    <article class="analytics-card analytics-feature-card">
      <div>
        <span class="eyebrow">Go-live readiness</span>
        <h3>${readinessScore}% deployment confidence</h3>
        <p>Based on phase progress, client signoffs, and cutover checklist closure.</p>
        <div class="analytics-inline-stats">
          <span class="status-chip">Signoffs ${signoffRate}%</span>
          <span class="status-chip">Checklist ${checklistRate}%</span>
          <span class="status-chip">Phases ${phaseProgress}%</span>
        </div>
      </div>
      <div class="analytics-ring" style="--value:${readinessScore};"><strong>${readinessScore}%</strong></div>
    </article>
    <article class="analytics-card">
      <div class="section-heading compact">
        <h3>Executive trend line</h3>
        <span class="pill success">Improving</span>
      </div>
      <div class="analytics-trend-list">
        <div>
          <span>OTIF</span>
          ${buildSparkline(analyticsTrends.otif, 'success')}
        </div>
        <div>
          <span>Training</span>
          ${buildSparkline(analyticsTrends.training, 'neutral')}
        </div>
        <div>
          <span>Cutover tasks</span>
          ${buildSparkline(analyticsTrends.cutover, 'warning')}
        </div>
      </div>
    </article>
    <article class="analytics-card">
      <div class="section-heading compact">
        <h3>Risk heatmap</h3>
        <span class="pill ${criticalRisks > 2 ? 'danger' : 'warning'}">${allRisks.length} tracked</span>
      </div>
      <div class="analytics-stack">
        <div><span>Critical</span><strong>${criticalRisks}</strong></div>
        <div><span>High</span><strong>${highRisks}</strong></div>
        <div><span>Medium</span><strong>${mediumRisks}</strong></div>
      </div>
      <p class="helper-text">Focus on barcode validation, BOM controls, and count accuracy before cutover.</p>
    </article>
    <article class="analytics-card">
      <div class="section-heading compact">
        <h3>Workstream pressure</h3>
        <span class="pill ${lateActions > 0 ? 'danger' : 'success'}">${lateActions > 0 ? 'Needs action' : 'Stable'}</span>
      </div>
      <div class="analytics-metrics">
        <div>
          <strong>${openActions}</strong>
          <span>Open actions</span>
        </div>
        <div>
          <strong>${lateActions}</strong>
          <span>Overdue items</span>
        </div>
        <div>
          <strong>${state.extraChangeRequests.length + baseChangeRequests.length}</strong>
          <span>Change requests</span>
        </div>
      </div>
      <p class="helper-text">Escalate late workstream actions in the weekly PMO checkpoint.</p>
    </article>
  `;
}

async function loadIntegrationStatus() {
  if (window.location.protocol === 'file:') {
    integrationStatus = {
      ...integrationStatus,
      authenticationRequired: false,
      storageMode: 'browser',
      renderBlueprintPresent: true,
      message: 'Running locally in browser mode. Use the Node server for live SQL, SMTP, and Render checks.'
    };
    return;
  }

  try {
    const response = await fetch('/api/config/status', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Unable to load integration diagnostics.');
    }

    const payload = await response.json();
    integrationStatus = {
      ...integrationStatus,
      ...payload,
      message: payload.storageMode === 'sqlserver'
        ? 'SQL Server persistence is active and ready for live deployment.'
        : 'Backend is running in JSON fallback mode. Add SQL/SMTP credentials to go fully live.'
    };
  } catch (error) {
    integrationStatus = {
      ...integrationStatus,
      message: error.message || 'Unable to reach the diagnostics service.'
    };
  }
}

function renderIntegrationStatus() {
  const pill = document.getElementById('productionReadinessPill');
  const grid = document.getElementById('integrationStatusGrid');
  const message = document.getElementById('integrationStatusMessage');
  if (!pill || !grid || !message) return;

  const sqlReady = Boolean(integrationStatus.sqlConfigured && integrationStatus.sqlDriverInstalled);
  const smtpReady = Boolean(integrationStatus.smtpConfigured && integrationStatus.mailDriverInstalled);
  const renderReady = Boolean(integrationStatus.renderReady || integrationStatus.runningOnRender);
  const readyCount = [sqlReady, smtpReady, renderReady].filter(Boolean).length;
  const readinessPct = Math.round((readyCount / 3) * 100);
  const pillTone = readinessPct >= 100 ? 'success' : readinessPct >= 67 ? 'warning' : 'neutral';

  pill.textContent = `Production readiness ${readinessPct}%`;
  pill.className = `pill ${pillTone}`;

  grid.innerHTML = [
    {
      name: 'SQL Server',
      ready: sqlReady,
      detail: integrationStatus.storageMode === 'sqlserver'
        ? 'Live SQL persistence is active.'
        : integrationStatus.sqlConfigured
          ? 'Credentials detected; click verify to test connectivity.'
          : 'Set DB_SERVER, DB_DATABASE, DB_USER, and DB_PASSWORD.'
    },
    {
      name: 'SMTP Email',
      ready: smtpReady,
      detail: smtpReady
        ? 'Email automation can send through SMTP.'
        : integrationStatus.smtpConfigured
          ? 'SMTP settings detected; click verify to test the mailbox.'
          : 'Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.'
    },
    {
      name: 'Render Deploy',
      ready: renderReady,
      detail: integrationStatus.runningOnRender
        ? 'Application is running with Render environment metadata.'
        : integrationStatus.renderBlueprintPresent
          ? 'render.yaml is present. Add env vars in Render and deploy.'
          : 'Create a Render blueprint or deploy config first.'
    }
  ].map((item) => `
    <article class="integration-card ${item.ready ? 'ready' : 'pending'}">
      <div class="section-heading compact">
        <h3>${item.name}</h3>
        <span class="pill ${item.ready ? 'success' : 'warning'}">${item.ready ? 'Ready' : 'Pending'}</span>
      </div>
      <p>${item.detail}</p>
    </article>
  `).join('');

  message.textContent = integrationStatus.message || 'Review the cards above, then verify each production dependency.';
}

async function runIntegrationCheck(target) {
  const status = document.getElementById('integrationStatusMessage');
  if (!status) return;

  if (window.location.protocol !== 'file:' && !authState.isAuthenticated) {
    status.textContent = 'Sign in to run live SQL, SMTP, or Render verification checks.';
    status.className = 'helper-text auth-message error';
    return;
  }

  status.textContent = `Running ${target.toUpperCase()} verification...`;
  status.className = 'helper-text';

  try {
    const response = await fetch(`/api/integrations/test?target=${encodeURIComponent(target)}`, { cache: 'no-store' });
    const payload = (response.headers.get('content-type') || '').includes('application/json')
      ? await response.json()
      : {};

    integrationStatus = {
      ...integrationStatus,
      ...payload,
      message: payload.message || integrationStatus.message
    };
    renderIntegrationStatus();
    status.textContent = payload.message || `${target.toUpperCase()} verification completed.`;
    status.className = `helper-text auth-message ${response.ok ? 'success' : 'error'}`;
  } catch {
    status.textContent = `Unable to verify ${target.toUpperCase()} right now.`;
    status.className = 'helper-text auth-message error';
  }
}

function renderMilestones() {
  const rows = baseMilestones.map((milestone) => {
    const checked = Boolean(state.signedOff[milestone.id]);
    return `
      <tr>
        <td>${milestone.title}</td>
        <td>${milestone.phase}</td>
        <td>${milestone.owner}</td>
        <td>${milestone.date}</td>
        <td><span class="pill ${pillClass(milestone.status)}">${milestone.status}</span></td>
        <td><input type="checkbox" data-signoff-id="${milestone.id}" ${checked ? 'checked' : ''} /></td>
      </tr>
    `;
  }).join('');

  document.getElementById('milestoneTableBody').innerHTML = rows;
  const completed = Object.values(state.signedOff).filter(Boolean).length;
  document.getElementById('signoffSummary').textContent = `${completed}/${baseMilestones.length} signoffs complete`;

  document.querySelectorAll('[data-signoff-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      state.signedOff[event.target.dataset.signoffId] = event.target.checked;
      await saveState();
      refresh();
    });
  });
}

function renderRisks() {
  const filter = document.getElementById('riskFilter').value;
  const riskRows = [...baseRisks, ...state.extraRisks]
    .filter((risk) => filter === 'All' || risk.severity === filter)
    .map((risk) => `
      <tr>
        <td>${risk.title}</td>
        <td><span class="pill ${pillClass(risk.severity)}">${risk.severity}</span></td>
        <td>${risk.owner}</td>
        <td>${risk.mitigation}</td>
      </tr>
    `)
    .join('');

  document.getElementById('riskTableBody').innerHTML = riskRows;
}

function renderChangeRequests() {
  const requests = [...baseChangeRequests, ...state.extraChangeRequests];
  document.getElementById('changeRequestList').innerHTML = requests.map((request) => `
    <article class="request-card">
      <div class="section-heading">
        <h3>${request.title}</h3>
        <span class="pill ${pillClass(request.status)}">${request.status}</span>
      </div>
      <p>${request.impact}</p>
      <span class="status-chip">Requestor: ${request.requestor}</span>
    </article>
  `).join('');
}

function renderActionItems() {
  const items = [...baseActionItems, ...state.extraActionItems];
  const openCount = items.filter((item) => item.status !== 'Complete').length;

  document.getElementById('actionSummary').textContent = `${openCount}/${items.length} open actions`;
  document.getElementById('actionTrackerList').innerHTML = items.map((item) => `
    <article class="request-card">
      <div class="section-heading">
        <div>
          <h3>${item.title}</h3>
          <span class="status-chip">${item.phase}</span>
        </div>
        <span class="pill ${pillClass(item.status)}">${item.status}</span>
      </div>
      <p>${item.notes}</p>
      <div class="action-meta">
        <span class="status-chip">Owner: ${item.owner}</span>
        <span class="status-chip">Due: ${item.dueDate}</span>
      </div>
    </article>
  `).join('');
}

function renderRaci() {
  document.getElementById('raciTableBody').innerHTML = raciRows.map((row) => `
    <tr>
      <td>${row[0]}</td>
      <td>${row[1]}</td>
      <td>${row[2]}</td>
      <td>${row[3]}</td>
      <td>${row[4]}</td>
      <td>${row[5]}</td>
      <td>${row[6]}</td>
    </tr>
  `).join('');
}

function renderQueries() {
  document.getElementById('queryLibrary').innerHTML = sqlLibrary.map((query) => `
    <article class="query-card">
      <h3>${query.title}</h3>
      <p>${query.description}</p>
      <pre>${query.sql}</pre>
    </article>
  `).join('');
}

function renderAgendas() {
  document.getElementById('agendaTemplates').innerHTML = agendas.map((agenda) => `
    <article class="agenda-card">
      <h3>${agenda.title}</h3>
      <ul>${agenda.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}</ul>
    </article>
  `).join('');
}

function renderChecklist() {
  document.getElementById('goLiveChecklist').innerHTML = checklistItems.map((item, index) => `
    <div class="checklist-item">
      <input id="check-${index}" type="checkbox" data-check-id="${index}" ${state.checklist[index] ? 'checked' : ''} />
      <label for="check-${index}">${item}</label>
    </div>
  `).join('');

  const completed = Object.values(state.checklist).filter(Boolean).length;
  document.getElementById('checklistSummary').textContent = `${completed}/${checklistItems.length} items closed`;

  document.querySelectorAll('[data-check-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      state.checklist[event.target.dataset.checkId] = event.target.checked;
      await saveState();
      refresh();
    });
  });
}

function buildReport(type) {
  const today = new Date().toLocaleDateString();
  const signoffCount = Object.values(state.signedOff).filter(Boolean).length;
  const closedChecklist = Object.values(state.checklist).filter(Boolean).length;
  const openRisks = [...baseRisks, ...state.extraRisks].length;
  const openChanges = [...baseChangeRequests, ...state.extraChangeRequests]
    .filter((request) => !['Approved', 'Rejected'].includes(request.status)).length;
  const openActions = [...baseActionItems, ...state.extraActionItems]
    .filter((item) => item.status !== 'Complete').length;
  const profile = state.projectProfile;

  const focus = type === 'executive'
    ? 'Focus: timeline confidence, business readiness, and critical risk mitigation.'
    : 'Focus: decision log, CAB items, cutover dependencies, and scope control.';

  return `ERP Implementation Status Report (${type === 'executive' ? 'Executive' : 'Steering Committee'})\nDate: ${today}\nClient: ${profile.clientName}\nSite: ${profile.siteName}\nProject Manager: ${profile.projectManager}\nTarget Go-Live: ${profile.targetGoLive}\nOverall Status: ${profile.overallStatus}\nBudget Health: ${profile.budgetHealth}\nExecutive Summary: ${profile.executiveSummary}\n\nOverall Health:\n- Phase progress: Discovery 92%, Configuration/Data 74%, Testing 61%, Training 58%\n- Client signoffs completed: ${signoffCount}/${baseMilestones.length}\n- Open risks: ${openRisks} total\n- Open change requests: ${openChanges}\n- Open workstream actions: ${openActions}\n- Go-live readiness checklist: ${closedChecklist}/${checklistItems.length}\n\n${focus}\n\nKey Wins:\n- OTIF and inventory accuracy remain above manufacturing targets.\n- Data migration mock cycles are yielding >99% validation accuracy.\n- Super-user enablement is progressing across warehouse and production teams.\n\nAttention Items:\n- Finish UAT entry criteria and close remaining critical manufacturing risks.\n- Confirm barcode device validation in all work centers.\n- Approve cutover and rollback playbook before go/no-go.`;
}

function renderReportPreview() {
  document.getElementById('reportPreview').textContent = buildReport('executive');
}

function escapeCsvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportMilestonesCsv() {
  const rows = baseMilestones.map((milestone) => [
    milestone.title,
    milestone.phase,
    milestone.owner,
    milestone.date,
    milestone.status,
    state.signedOff[milestone.id] ? 'Signed Off' : 'Pending'
  ]);

  downloadCsv('erp-milestones.csv', ['Milestone', 'Phase', 'Owner', 'Target Date', 'Status', 'Client Signoff'], rows);
}

function exportRisksCsv() {
  const rows = [...baseRisks, ...state.extraRisks].map((risk) => [
    risk.title,
    risk.severity,
    risk.owner,
    risk.mitigation
  ]);

  downloadCsv('erp-risk-register.csv', ['Risk', 'Severity', 'Owner', 'Mitigation'], rows);
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function worksheetXml(name, rows) {
  return `
    <Worksheet ss:Name="${escapeXml(name).slice(0, 30)}">
      <Table>
        ${rows.map((row) => `
          <Row>
            ${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}
          </Row>
        `).join('')}
      </Table>
    </Worksheet>
  `;
}

function exportExcelWorkbook() {
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheetXml('Project Profile', [
    ['Field', 'Value'],
    ['Client', state.projectProfile.clientName],
    ['Site', state.projectProfile.siteName],
    ['Project Manager', state.projectProfile.projectManager],
    ['Target Go-Live', state.projectProfile.targetGoLive],
    ['Overall Status', state.projectProfile.overallStatus],
    ['Budget Health', state.projectProfile.budgetHealth],
    ['Executive Summary', state.projectProfile.executiveSummary]
  ])}
  ${worksheetXml('Milestones', [
    ['Milestone', 'Phase', 'Owner', 'Target Date', 'Status', 'Client Signoff'],
    ...baseMilestones.map((milestone) => [
      milestone.title,
      milestone.phase,
      milestone.owner,
      milestone.date,
      milestone.status,
      state.signedOff[milestone.id] ? 'Signed Off' : 'Pending'
    ])
  ])}
  ${worksheetXml('Risks', [
    ['Risk', 'Severity', 'Owner', 'Mitigation'],
    ...[...baseRisks, ...state.extraRisks].map((risk) => [risk.title, risk.severity, risk.owner, risk.mitigation])
  ])}
  ${worksheetXml('Change Requests', [
    ['Title', 'Impact', 'Requestor', 'Status'],
    ...[...baseChangeRequests, ...state.extraChangeRequests].map((request) => [request.title, request.impact, request.requestor, request.status])
  ])}
  ${worksheetXml('Action Items', [
    ['Title', 'Phase', 'Owner', 'Due Date', 'Status', 'Notes'],
    ...[...baseActionItems, ...state.extraActionItems].map((item) => [item.title, item.phase, item.owner, item.dueDate, item.status, item.notes])
  ])}
</Workbook>`;

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'erp-project-tracker.xls';
  link.click();
  URL.revokeObjectURL(url);
}

function exportBackupJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'erp-tracker-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function resetTracker() {
  const shouldReset = window.confirm('Reset all saved signoffs, checklist items, risks, changes, and custom action items?');
  if (!shouldReset) return;

  state = structuredClone(defaultState);
  await saveState();
  refresh();
}

function downloadPdfReport(type) {
  const reportText = buildReport(type);
  const profile = state.projectProfile;
  const printWindow = window.open('', '_blank', 'width=1000,height=760');

  if (!printWindow) {
    alert('Please allow pop-ups to export the PDF report.');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>ERP Status Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #162033; }
          .header { border-bottom: 3px solid #2359d1; padding-bottom: 12px; margin-bottom: 18px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
          .card { border: 1px solid #d9e1ef; border-radius: 10px; padding: 12px; background: #f8fbff; }
          h1, h2, h3 { margin: 0 0 8px; }
          pre { white-space: pre-wrap; font-size: 13px; line-height: 1.5; background: #f7f9fc; padding: 12px; border-radius: 8px; }
          .meta { color: #5f6b85; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ERP Implementation Status Report</h1>
          <div class="meta">${type === 'executive' ? 'Executive Report' : 'Steering Committee Report'} • Generated ${new Date().toLocaleString()}</div>
        </div>
        <div class="grid">
          <div class="card"><strong>Client:</strong> ${profile.clientName}<br /><strong>Site:</strong> ${profile.siteName}<br /><strong>Project Manager:</strong> ${profile.projectManager}</div>
          <div class="card"><strong>Status:</strong> ${profile.overallStatus}<br /><strong>Budget Health:</strong> ${profile.budgetHealth}<br /><strong>Go-Live:</strong> ${profile.targetGoLive}</div>
        </div>
        <div class="card" style="margin-bottom: 16px;">
          <h3>Executive Summary</h3>
          <div>${profile.executiveSummary}</div>
        </div>
        <pre>${reportText}</pre>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function attachForms() {
  document.getElementById('riskFilter').addEventListener('change', renderRisks);

  document.querySelectorAll('.demo-login-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const form = document.getElementById('loginForm');
      form.elements.username.value = button.dataset.demoUser || '';
      form.elements.password.value = button.dataset.demoPassword || '';
      const authMessage = document.getElementById('authMessage');
      authMessage.textContent = `Loaded demo credentials for ${button.dataset.demoUser}. Click Sign In.`;
      authMessage.className = 'auth-message success';
    });
  });

  document.getElementById('showPasswordToggle').addEventListener('change', (event) => {
    document.getElementById('loginPassword').type = event.target.checked ? 'text' : 'password';
  });

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const authMessage = document.getElementById('authMessage');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password')
        })
      });

      const payload = (response.headers.get('content-type') || '').includes('application/json')
        ? await response.json()
        : {};

      if (!response.ok) {
        authMessage.textContent = payload.error || 'Unable to sign in.';
        authMessage.className = 'auth-message error';
        return;
      }

      authState = {
        isAuthenticated: true,
        username: payload.username || formData.get('username'),
        role: payload.role || 'viewer',
        permissions: Array.isArray(payload.permissions) ? payload.permissions : []
      };
      persistenceMode = payload.storageMode === 'sqlserver' ? 'sqlserver' : 'backend';
      applyAuthState();
      state = await loadState();
      await loadIntegrationStatus();
      refresh();
      event.target.reset();
    } catch {
      authMessage.textContent = 'Unable to reach the authentication service.';
      authMessage.className = 'auth-message error';
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    if (window.location.protocol === 'file:') {
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network logout errors and still reset local auth state.
    }

    authState = { isAuthenticated: false, username: '', role: '', permissions: [] };
    applyAuthState();
    await loadIntegrationStatus();
    refresh();
  });

  document.getElementById('projectProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.projectProfile = {
      clientName: formData.get('clientName'),
      siteName: formData.get('siteName'),
      projectManager: formData.get('projectManager'),
      targetGoLive: formData.get('targetGoLive'),
      overallStatus: formData.get('overallStatus'),
      budgetHealth: formData.get('budgetHealth'),
      executiveSummary: formData.get('executiveSummary')
    };
    await saveState();
    refresh();
  });

  document.getElementById('riskForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.extraRisks.unshift({
      title: formData.get('title'),
      severity: formData.get('severity'),
      owner: formData.get('owner'),
      mitigation: formData.get('mitigation')
    });
    event.target.reset();
    await saveState();
    refresh();
  });

  document.getElementById('changeRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.extraChangeRequests.unshift({
      title: formData.get('title'),
      impact: formData.get('impact'),
      requestor: formData.get('requestor'),
      status: formData.get('status')
    });
    event.target.reset();
    await saveState();
    refresh();
  });

  document.getElementById('actionItemForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.extraActionItems.unshift({
      title: formData.get('title'),
      notes: formData.get('notes'),
      owner: formData.get('owner'),
      dueDate: formData.get('dueDate'),
      phase: formData.get('phase'),
      status: formData.get('status')
    });
    event.target.reset();
    await saveState();
    refresh();
  });

  document.getElementById('emailAutomationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.emailAutomation = {
      ...state.emailAutomation,
      recipients: formData.get('recipients'),
      cc: formData.get('cc'),
      reportType: formData.get('reportType'),
      cadence: formData.get('cadence'),
      subject: formData.get('subject'),
      message: formData.get('message')
    };
    await saveState();
    renderEmailAutomation();
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  document.getElementById('copyExecutiveReport').addEventListener('click', async () => {
    await navigator.clipboard.writeText(buildReport('executive'));
    document.getElementById('reportPreview').textContent = buildReport('executive');
  });
  document.getElementById('copySteeringReport').addEventListener('click', async () => {
    await navigator.clipboard.writeText(buildReport('steering'));
    document.getElementById('reportPreview').textContent = buildReport('steering');
  });

  document.getElementById('exportExcelWorkbook').addEventListener('click', exportExcelWorkbook);
  document.getElementById('exportMilestonesCsv').addEventListener('click', exportMilestonesCsv);
  document.getElementById('exportRisksCsv').addEventListener('click', exportRisksCsv);
  document.getElementById('downloadPdfReport').addEventListener('click', () => downloadPdfReport('executive'));
  document.getElementById('exportBackupJson').addEventListener('click', exportBackupJson);
  document.getElementById('resetTracker').addEventListener('click', resetTracker);
  document.getElementById('checkSqlConnection').addEventListener('click', () => runIntegrationCheck('sql'));
  document.getElementById('checkSmtpConnection').addEventListener('click', () => runIntegrationCheck('smtp'));
  document.getElementById('checkRenderReadiness').addEventListener('click', () => runIntegrationCheck('render'));
  document.getElementById('sendStatusEmail').addEventListener('click', async () => {
    const form = document.getElementById('emailAutomationForm');
    const formData = new FormData(form);
    const status = document.getElementById('emailAutomationStatus');

    try {
      const response = await fetch('/api/reports/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: formData.get('recipients'),
          cc: formData.get('cc'),
          reportType: formData.get('reportType'),
          cadence: formData.get('cadence'),
          subject: formData.get('subject'),
          message: formData.get('message')
        })
      });

      const payload = (response.headers.get('content-type') || '').includes('application/json')
        ? await response.json()
        : {};

      if (!response.ok) {
        status.textContent = payload.error || 'Unable to send the status email.';
        status.className = 'helper-text auth-message error';
        return;
      }

      state.emailAutomation = {
        ...state.emailAutomation,
        recipients: formData.get('recipients'),
        cc: formData.get('cc'),
        reportType: formData.get('reportType'),
        cadence: formData.get('cadence'),
        subject: formData.get('subject'),
        message: formData.get('message'),
        lastSentAt: payload.sentAt,
        lastDeliveryMode: payload.deliveryMode
      };
      renderEmailAutomation();
      status.textContent = `Status email sent via ${payload.deliveryMode} at ${new Date(payload.sentAt).toLocaleString()}.`;
      status.className = 'helper-text auth-message success';
    } catch {
      status.textContent = 'Unable to reach the email service.';
      status.className = 'helper-text auth-message error';
    }
  });
}

function refresh() {
  renderStorageMode();
  renderProjectProfile();
  renderSnapshot();
  renderPhases();
  renderKpis();
  renderAnalyticsWidgets();
  renderMilestones();
  renderRisks();
  renderChangeRequests();
  renderActionItems();
  renderRaci();
  renderQueries();
  renderAgendas();
  renderChecklist();
  renderEmailAutomation();
  renderIntegrationStatus();
  renderReportPreview();
  applyAccessControls();
}

async function initializeApp() {
  attachForms();
  applyTheme(localStorage.getItem(themeStorageKey) || 'light');
  await checkSession();
  state = await loadState();
  await loadIntegrationStatus();
  refresh();
}

initializeApp();
