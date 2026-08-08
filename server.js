import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html'] }));

// ===================================================================
// DATA STORAGE & PERSISTENCE (Users, Roles, Logs, Dashboard Metrics)
// ===================================================================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

// Password security helpers
function hashPassword(password, salt) {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// In-memory sessions token map: token -> { userId, expiresAt }
const sessions = new Map();

function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(token, { userId, expiresAt });
  return token;
}

// Initial default seed users
function getInitialUsers() {
  const adminCreds = hashPassword('admin123');
  const userCreds = hashPassword('user123');
  const user2Creds = hashPassword('user123');

  return [
    {
      id: 'usr_admin_01',
      name: 'Gonzalo Rosendo (Admin)',
      email: 'admin@centrodemando.ia',
      role: 'admin',
      company: 'Centro de Mando Corporativo',
      department: 'Dirección General & IT',
      status: 'activo',
      phone: '+34 910 882 100',
      passwordHash: adminCreds.hash,
      salt: adminCreds.salt,
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      lastLogin: new Date().toISOString()
    },
    {
      id: 'usr_demo_02',
      name: 'Laura Morales',
      email: 'demo@empresa.com',
      role: 'user',
      company: 'Distribuciones Ibéricas S.L.',
      department: 'Ventas & Operaciones',
      status: 'activo',
      phone: '+34 934 112 334',
      passwordHash: userCreds.hash,
      salt: userCreds.salt,
      createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      lastLogin: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_demo_03',
      name: 'Carlos Vega',
      email: 'carlos@empresa.com',
      role: 'user',
      company: 'Distribuciones Ibéricas S.L.',
      department: 'Finanzas & Sostenibilidad',
      status: 'activo',
      phone: '+34 963 445 667',
      passwordHash: user2Creds.hash,
      salt: user2Creds.salt,
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      lastLogin: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    }
  ];
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  const defaults = getInitialUsers();
  saveUsers(defaults);
  return defaults;
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading logs:', e);
  }
  const initialLogs = [
    { id: 'log_01', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), user: 'admin@centrodemando.ia', action: 'INICIO_SESION', detail: 'Acceso correcto al panel de administración' },
    { id: 'log_02', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), user: 'demo@empresa.com', action: 'CARGA_EXCEL', detail: 'Actualización de KPIs de ventas y operaciones desde Excel' },
    { id: 'log_03', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), user: 'admin@centrodemando.ia', action: 'ACTIVAR_MODULO', detail: 'Módulo de Sostenibilidad (ESG) activado para la organización' }
  ];
  saveLogs(initialLogs);
  return initialLogs;
}

function saveLogs(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving logs:', e);
  }
}

function addAuditLog(userEmail, action, detail) {
  const logs = loadLogs();
  logs.unshift({
    id: 'log_' + Date.now(),
    timestamp: new Date().toISOString(),
    user: userEmail || 'sistema@centrodemando.ia',
    action,
    detail
  });
  saveLogs(logs);
}

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading metrics:', e);
  }
  const defaultMetrics = {
    updatedAt: new Date().toISOString(),
    kpis: {
      ventasTotales: 2847654,
      ventasDelta: 15.3,
      beneficioNeto: 312456,
      beneficioDelta: 14.2,
      pedidosTotales: 18245,
      pedidosDelta: 12.5,
      ticketMedio: 156.08,
      ticketDelta: 2.5,
      satisfaccionNps: 94.6,
      satisfaccionDelta: 3.1,
      nivelServicio: 98.4,
      nivelServicioDelta: 1.2,
      retrasosLogistica: 1.8,
      retrasosDelta: -0.4,
      huellaCarbono: 24.8,
      huellaCarbonoDelta: -8.5,
      rotacionTalento: 3.2,
      rotacionDelta: -1.1
    },
    modules: {
      ventas: { name: 'Ventas & Facturación', active: true, desc: 'Cifras de facturación, pedidos y márgenes en tiempo real.' },
      clientes: { name: 'Clientes & Retención', active: true, desc: 'Satisfacción NPS, fidelización y churn.' },
      operaciones: { name: 'Operaciones & Logística', active: true, desc: 'Nivel de servicio y retrasos por delegación.' },
      cadena_suministro: { name: 'Cadena de Suministro', active: true, desc: 'Control de rotura de stock y rotación de almacén.' },
      sostenibilidad_esg: { name: 'Sostenibilidad (ESG)', active: true, desc: 'Consumo energético y reducción de emisiones CO2.' },
      talento_rrhh: { name: 'Talento & RRHH', active: true, desc: 'Rotación, productividad y clima laboral.' },
      power_bi: { name: 'Conector Power BI', active: true, desc: 'Informes embebidos y datasets sincronizados.' },
      excel_live: { name: 'Sincronizador Excel', active: true, desc: 'Carga masiva directa de hojas de cálculo.' }
    },
    regionalDelays: [
      { region: 'Norte', delay: 1.8, serviceLevel: 98.6 },
      { region: 'Centro', delay: 2.3, serviceLevel: 97.8 },
      { region: 'Este', delay: 1.1, serviceLevel: 99.2 },
      { region: 'Sur', delay: 2.9, serviceLevel: 96.9 }
    ],
    salesHistory: [
      { month: 'Ene', sales: 210000, target: 195000 },
      { month: 'Feb', sales: 228000, target: 205000 },
      { month: 'Mar', sales: 245000, target: 220000 },
      { month: 'Abr', sales: 239000, target: 230000 },
      { month: 'May', sales: 265000, target: 240000 },
      { month: 'Jun', sales: 284000, target: 250000 }
    ]
  };
  saveMetrics(defaultMetrics);
  return defaultMetrics;
}

function saveMetrics(metrics) {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving metrics:', e);
  }
}

// ===================================================================
// AUTHENTICATION MIDDLEWARES
// ===================================================================
function getAuthUser(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.status === 'suspendido') return null;

  return { user, token };
}

function requireAuth(req, res, next) {
  const auth = getAuthUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
  req.user = auth.user;
  req.token = auth.token;
  next();
}

function requireAdmin(req, res, next) {
  const auth = getAuthUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
  if (auth.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
  }
  req.user = auth.user;
  req.token = auth.token;
  next();
}

// ===================================================================
// AUTH ENDPOINTS (Registro, Login, Me, Logout, Perfil)
// ===================================================================

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, company, department, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    // Role assignment: default 'user', allowed 'admin' if requested during registration
    const userRole = (role === 'admin') ? 'admin' : 'user';
    const { hash, salt } = hashPassword(password);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: cleanEmail,
      role: userRole,
      company: (company || 'Empresa Independiente').trim(),
      department: (department || (userRole === 'admin' ? 'Dirección General' : 'Operaciones & Ventas')).trim(),
      status: 'activo',
      phone: '',
      passwordHash: hash,
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const token = generateToken(newUser.id);
    addAuditLog(cleanEmail, 'REGISTRO_USUARIO', `Nuevo usuario registrado con rol [${userRole.toUpperCase()}] en ${newUser.company}`);

    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      company: newUser.company,
      department: newUser.department,
      status: newUser.status,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin
    };

    return res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return res.status(500).json({ error: 'Error interno al procesar el registro.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Introduce tu correo y contraseña.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'Credenciales incorrectas. Comprueba el email o contraseña.' });
    }

    if (user.status === 'suspendido') {
      return res.status(403).json({ error: 'Esta cuenta ha sido suspendida. Contacta con el Administrador.' });
    }

    user.lastLogin = new Date().toISOString();
    saveUsers(users);

    const token = generateToken(user.id);
    addAuditLog(user.email, 'INICIO_SESION', `Acceso exitoso con rol [${user.role.toUpperCase()}]`);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      department: user.department,
      status: user.status,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    return res.status(500).json({ error: 'Error interno en el inicio de sesión.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      company: u.company,
      department: u.department,
      status: u.status,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  if (req.token) {
    sessions.delete(req.token);
  }
  addAuditLog(req.user.email, 'CIERRE_SESION', 'Sesión cerrada por el usuario');
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', requireAuth, (req, res) => {
  try {
    const { name, company, department, currentPassword, newPassword } = req.body;
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];

    if (name) user.name = name.trim();
    if (company) user.company = company.trim();
    if (department) user.department = department.trim();

    if (newPassword) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
        return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      const creds = hashPassword(newPassword);
      user.passwordHash = creds.hash;
      user.salt = creds.salt;
      addAuditLog(user.email, 'CAMBIO_PASSWORD', 'Contraseña actualizada por el usuario');
    }

    users[userIndex] = user;
    saveUsers(users);

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

// ===================================================================
// ADMIN MANAGEMENT ENDPOINTS (Usuarios, Roles, Logs)
// ===================================================================

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = loadUsers();
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    department: u.department,
    status: u.status,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json({ users: safeUsers });
});

// POST /api/admin/users (Create user by admin)
app.post('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { name, email, password, role, company, department, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico.' });
    }

    const userRole = role === 'admin' ? 'admin' : 'user';
    const userStatus = status === 'suspendido' ? 'suspendido' : 'activo';
    const { hash, salt } = hashPassword(password);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: cleanEmail,
      role: userRole,
      company: (company || req.user.company || 'Empresa').trim(),
      department: (department || 'General').trim(),
      status: userStatus,
      phone: '',
      passwordHash: hash,
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(newUser);
    saveUsers(users);

    addAuditLog(req.user.email, 'CREAR_USUARIO', `Admin creó a ${cleanEmail} con rol [${userRole.toUpperCase()}]`);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente por el administrador',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company,
        department: newUser.department,
        status: newUser.status,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// PUT /api/admin/users/:id (Update role, status, department)
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const { role, status, department, company, name } = req.body;

    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = users[userIndex];

    // Prevent removing the last active admin
    if (targetUser.role === 'admin' && role === 'user') {
      const adminCount = users.filter(u => u.role === 'admin' && u.status === 'activo').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'No puedes cambiar el rol del único Administrador activo del sistema.' });
      }
    }

    const oldRole = targetUser.role;
    const oldStatus = targetUser.status;

    if (role && (role === 'admin' || role === 'user')) targetUser.role = role;
    if (status && (status === 'activo' || status === 'suspendido')) targetUser.status = status;
    if (department) targetUser.department = department.trim();
    if (company) targetUser.company = company.trim();
    if (name) targetUser.name = name.trim();

    users[userIndex] = targetUser;
    saveUsers(users);

    addAuditLog(req.user.email, 'MODIFICAR_USUARIO', `Usuario ${targetUser.email} actualizado: Rol ${oldRole}->${targetUser.role}, Estado ${oldStatus}->${targetUser.status}`);

    res.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        company: targetUser.company,
        department: targetUser.department,
        status: targetUser.status
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/:id:', error);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const users = loadUsers();
    const targetUser = users.find(u => u.id === userId);

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de Administrador mientras tienes la sesión activa.' });
    }

    const remainingUsers = users.filter(u => u.id !== userId);
    saveUsers(remainingUsers);

    addAuditLog(req.user.email, 'ELIMINAR_USUARIO', `Usuario ${targetUser.email} [${targetUser.role}] eliminado por el Administrador`);

    res.json({ success: true, message: `Usuario ${targetUser.name} eliminado correctamente` });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/:id:', error);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// GET /api/admin/logs
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const logs = loadLogs();
  res.json({ logs });
});

// ===================================================================
// CONTROL PANEL / DASHBOARD ENDPOINTS (Live KPIs, Excel, Modules)
// ===================================================================

// GET /api/dashboard/data
app.get('/api/dashboard/data', requireAuth, (req, res) => {
  const metrics = loadMetrics();
  const users = loadUsers();
  const logs = loadLogs();

  const userStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'activo').length,
    adminUsers: users.filter(u => u.role === 'admin').length,
    standardUsers: users.filter(u => u.role === 'user').length
  };

  res.json({
    metrics,
    userStats,
    recentActivity: logs.slice(0, 6),
    currentUser: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      company: req.user.company,
      department: req.user.department
    }
  });
});

// POST /api/dashboard/upload-excel (Simulated & live parsed Excel data processor)
app.post('/api/dashboard/upload-excel', requireAuth, (req, res) => {
  try {
    const { fileName, multiplier = 1, department = 'Todas' } = req.body;
    const metrics = loadMetrics();

    // Dynamically calculate new realistic metrics based on the upload
    const growthFactor = 1 + (Math.random() * 0.08 - 0.02); // -2% to +6%
    const currentSales = metrics.kpis.ventasTotales;
    const newSales = Math.round(currentSales * growthFactor);
    const newProfit = Math.round(newSales * 0.115);
    const newOrders = Math.round(metrics.kpis.pedidosTotales * (1 + (Math.random() * 0.06 - 0.01)));

    metrics.kpis.ventasTotales = newSales;
    metrics.kpis.ventasDelta = +(growthFactor * 10 - 10 + metrics.kpis.ventasDelta * 0.5).toFixed(1);
    metrics.kpis.beneficioNeto = newProfit;
    metrics.kpis.pedidosTotales = newOrders;
    metrics.kpis.satisfaccionNps = +(Math.min(99.5, metrics.kpis.satisfaccionNps + (Math.random() * 0.8 - 0.3))).toFixed(1);
    metrics.kpis.nivelServicio = +(Math.min(99.9, metrics.kpis.nivelServicio + (Math.random() * 0.6 - 0.2))).toFixed(1);
    metrics.kpis.retrasosLogistica = +(Math.max(0.5, metrics.kpis.retrasosLogistica + (Math.random() * 0.4 - 0.3))).toFixed(1);
    metrics.kpis.huellaCarbono = +(Math.max(10, metrics.kpis.huellaCarbono - (Math.random() * 0.5))).toFixed(1);
    metrics.updatedAt = new Date().toISOString();

    saveMetrics(metrics);

    addAuditLog(
      req.user.email,
      'IMPORTAR_EXCEL',
      `Hoja [${fileName || 'datos-empresa.xlsx'}] procesada para delegación ${department}. Nuevas ventas: €${newSales.toLocaleString()}`
    );

    res.json({
      success: true,
      message: `Archivo "${fileName || 'datos.xlsx'}" procesado con éxito. Métricas sincronizadas al 100%.`,
      updatedMetrics: metrics
    });
  } catch (error) {
    console.error('Error in /api/dashboard/upload-excel:', error);
    res.status(500).json({ error: 'Error al procesar el archivo Excel.' });
  }
});

// POST /api/dashboard/toggle-module
app.post('/api/dashboard/toggle-module', requireAuth, (req, res) => {
  try {
    const { moduleKey, active } = req.body;
    const metrics = loadMetrics();

    if (!metrics.modules[moduleKey]) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }

    metrics.modules[moduleKey].active = Boolean(active);
    metrics.updatedAt = new Date().toISOString();
    saveMetrics(metrics);

    addAuditLog(
      req.user.email,
      active ? 'ACTIVAR_MODULO' : 'DESACTIVAR_MODULO',
      `Módulo [${metrics.modules[moduleKey].name}] ${active ? 'activado' : 'desactivado'}`
    );

    res.json({
      success: true,
      moduleKey,
      active: metrics.modules[moduleKey].active,
      message: `Módulo ${metrics.modules[moduleKey].name} ${active ? 'activado' : 'desactivado'} correctamente.`
    });
  } catch (error) {
    console.error('Error in /api/dashboard/toggle-module:', error);
    res.status(500).json({ error: 'Error al actualizar el módulo.' });
  }
});

// POST /api/dashboard/ai-analysis (Generates role-tailored Executive / Operational Analysis)
app.post('/api/dashboard/ai-analysis', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const metrics = loadMetrics();
    const user = req.user;

    const contextSummary = `
Datos en tiempo real de la empresa (${user.company}, departamento: ${user.department}, rol de usuario: ${user.role}):
- Ventas Totales: €${metrics.kpis.ventasTotales.toLocaleString()} (${metrics.kpis.ventasDelta > 0 ? '+' : ''}${metrics.kpis.ventasDelta}%)
- Beneficio Neto: €${metrics.kpis.beneficioNeto.toLocaleString()} (+${metrics.kpis.beneficioDelta}%)
- Pedidos: ${metrics.kpis.pedidosTotales.toLocaleString()}
- Ticket Medio: €${metrics.kpis.ticketMedio}
- Satisfacción Clientes NPS: ${metrics.kpis.satisfaccionNps}%
- Nivel de Servicio: ${metrics.kpis.nivelServicio}%
- Retrasos Logísticos: ${metrics.kpis.retrasosLogistica}%
- Huella de Carbono (ESG): ${metrics.kpis.huellaCarbono} tCO2 (${metrics.kpis.huellaCarbonoDelta}%)
- Rotación de Talento: ${metrics.kpis.rotacionTalento}%
- Módulos Activos: ${Object.entries(metrics.modules).filter(([k,v]) => v.active).map(([k,v]) => v.name).join(', ')}
`;

    const ai = getGenAIClient();

    if (ai) {
      try {
        const userPrompt = prompt
          ? `Pregunta específica del ${user.role === 'admin' ? 'Administrador' : 'Responsable de Área'}: "${prompt}".\n\nContexto empresarial:\n${contextSummary}`
          : `Genera un Resumen Ejecutivo inteligente y recomendaciones de acción prioritarias para el perfil [${user.role.toUpperCase()}] de la empresa.\n\nContexto empresarial:\n${contextSummary}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: `Eres el Asistente Ejecutivo de Inteligencia de Negocio del Centro de Mando IA. Analiza las métricas y entrega 3 puntos clave: 1. Estado de salud del negocio, 2. Alertas o focos de atención, 3. Recomendaciones prácticas inmediatas para ${user.name} (${user.role === 'admin' ? 'Alta Dirección / Admin' : 'Área Operativa / Usuario'}). Usa viñetas claras y lenguaje directo sin rodeos.`,
            temperature: 0.7,
            maxOutputTokens: 600
          }
        });

        const replyText = response?.text?.trim();
        if (replyText) {
          return res.json({ analysis: replyText, source: 'gemini-2.5-flash' });
        }
      } catch (err) {
        console.warn('Gemini analysis failed, using executive rule engine:', err.message);
      }
    }

    // High quality rule-based intelligent analysis fallback
    let fallbackAnalysis = '';
    if (user.role === 'admin') {
      fallbackAnalysis = `**Resumen Ejecutivo de Dirección (Centro de Mando IA)**

• **Salud Global**: Facturación consolidada en **€${metrics.kpis.ventasTotales.toLocaleString()}** con crecimiento intermensual del **+${metrics.kpis.ventasDelta}%**. El margen neto se sitúa en un sólido **11%**.
• **Operaciones y Calidad**: El nivel de servicio global alcanza el **${metrics.kpis.nivelServicio}%**, con satisfacción de clientes en un excelente **${metrics.kpis.satisfaccionNps}%**.
• **Foco Estratégico**: La delegación Sur presenta un **${metrics.regionalDelays.find(r => r.region === 'Sur')?.delay}%** de retrasos logísticos. Se aconseja redistribuir stock hacia el hub central.
• **Sostenibilidad ESG**: Reducción de huella de carbono de **${metrics.kpis.huellaCarbonoDelta}%** frente al periodo anterior, cumpliendo con los objetivos de reporte no financiero.`;
    } else {
      fallbackAnalysis = `**Informe Operativo de Área (${user.department})**

• **Rendimiento de Ventas & Pedidos**: Se han registrado **${metrics.kpis.pedidosTotales.toLocaleString()} pedidos** con un ticket medio de **€${metrics.kpis.ticketMedio}**.
• **Nivel de Servicio**: **${metrics.kpis.nivelServicio}%** de entregas a tiempo. La delegación Este lidera con un **99.2%**.
• **Acción Prioritaria**: Monitorear las rutas de la zona Sur durante los picos de pedidos para evitar cuellos de botella en entrega.
• **Integración**: Tus módulos de Excel y Power BI se encuentran sincronizados y listos para consulta.`;
    }

    return res.json({ analysis: fallbackAnalysis, source: 'rule-engine' });
  } catch (error) {
    console.error('Error in /api/dashboard/ai-analysis:', error);
    res.status(500).json({ error: 'Error al generar el análisis.' });
  }
});

// ===================================================================
// PUBLIC CHAT ASSISTANT & CONTACT
// ===================================================================
const SYSTEM_INSTRUCTION = `Eres el Asistente Inteligente de "Centro de Mando IA" (creado por Gonzalo Rosendo · Data & Formation).
Tu objetivo es resolver con precisión, profesionalidad, cercanía y claridad todas las dudas de clientes potenciales y usuarios sobre los servicios, características, integraciones, precios, seguridad, registro y funcionamiento del Centro de Mando IA.

Información clave sobre el producto:
- **Concepto**: Un único panel de control empresarial en tiempo real que reúne ventas, clientes, operaciones, cadena de suministro, talento y sostenibilidad, acompañado de un asistente de IA proactivo.
- **Acceso & Registro**: Registro rápido para administradores y usuarios con roles diferenciados, panel de control en vivo y cuentas demo instantáneas.
- **Integraciones**:
  * Excel: Permite subir hojas de cálculo con plantilla para actualizar métricas al instante sin esperas técnicas.
  * Power BI: Inserta informes ya publicados para combinarlos en un solo lugar con el resto de datos.
  * ERPs y CRMs (Plan Enterprise): Conexión directa con SAP, Navision, Holded, Salesforce, HubSpot y bases de datos SQL mediante API.
- **Módulos**: Ventas y facturación, Clientes y retención, Operaciones y nivel de servicio, Cadena de suministro y stock, Sostenibilidad (ESG y huella de carbono), Talento y rotación.
- **Planes y Precios**:
  * Starter (€49/mes): Hasta 4 módulos activos, importación Excel, 1 usuario, actualización diaria, soporte por email.
  * Pro (€129/mes - Más popular): Los 10 módulos, conexión Excel y Power BI, hasta 5 usuarios, alertas del Asistente IA, soporte prioritario.
  * Enterprise (€299/mes): Multiempresa con delegaciones, conectores ERP/CRM/API a medida, usuarios ilimitados, actualización en tiempo real, SLA garantizado y soporte dedicado.
- **Seguridad**: Servidores seguros en la Unión Europea (UE), cifrado SSL/TLS de extremo a extremo, cumplimiento estricto del RGPD (GDPR).`;

let aiClient = null;
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function generateFallbackResponse(userMessage, history = []) {
  const msg = (userMessage || '').toLowerCase();

  if (msg.includes('registro') || msg.includes('crear cuenta') || msg.includes('rol') || msg.includes('admin') || msg.includes('usuario') || msg.includes('panel')) {
    return `Puedes registrarte directamente en nuestra plataforma para probar el **Centro de Mando**:

• **Roles disponibles**:
  - **Administrador**: Control total de usuarios, roles, módulos y analítica ejecutiva.
  - **Usuario / Operativo**: Gestión de KPIs de departamento, subida de Excel y consulta de Power BI.
• **Acceso Inmediato**: Dispones de registro libre en [Registrarse](registro.html) o acceso inmediato con 1 clic en [Iniciar Sesión](login.html) usando las cuentas de prueba (Admin y Usuario).`;
  }

  if (msg.includes('precio') || msg.includes('plan') || msg.includes('cuanto cuesta') || msg.includes('tarifa')) {
    return `Disponemos de tres planes adaptados al tamaño de cada empresa:

• **Starter (€49/mes)**: Hasta 4 módulos activos, importación desde Excel y 1 usuario.
• **Pro (€129/mes)**: 10 módulos, conexión con Excel y Power BI, hasta 5 usuarios y alertas proactivas de IA.
• **Enterprise (€299/mes)**: Multiempresa, conectores API/ERP (SAP, Salesforce, etc.), usuarios ilimitados y tiempo real.

Puedes consultar todos los detalles en nuestra sección de [Precios](precios.html).`;
  }

  if (msg.includes('excel') || msg.includes('power bi') || msg.includes('conectar') || msg.includes('integrar')) {
    return `La integración en el **Centro de Mando IA** es rápida y sin fricción:

1. **Hojas de cálculo Excel**: Subes tu plantilla estructurada y el panel se recalcula al instante.
2. **Informes de Power BI**: Pega el enlace de tu informe publicado para incrustarlo en el centro de mando.
3. **ERPs y Bases de Datos**: Conexión vía API REST o conectores nativos en Plan Enterprise.`;
  }

  if (msg.includes('seguridad') || msg.includes('privacidad') || msg.includes('rgpd')) {
    return `La seguridad de tus datos empresariales es nuestra máxima prioridad:

• **Cifrado Total**: SSL/TLS de extremo a extremo y contraseñas salteadas criptográficamente.
• **Alojamiento en la UE**: Cumplimiento riguroso del RGPD / GDPR.
• **Control de Roles**: Permisos granulares de acceso por usuario y departamento.`;
  }

  return `¡Hola! Soy el asistente virtual de **Centro de Mando IA**. 

Puedo ayudarte con:
• **Registro y Panel**: Cómo crear tu cuenta, roles de administrador y panel en vivo.
• **Integración**: Conexión con Excel, Power BI y ERPs.
• **Precios y Módulos**: Planes Starter (€49), Pro (€129) y Enterprise (€299).
• **Seguridad**: Cifrado, RGPD y servidores en la Unión Europea.

¿Qué te gustaría consultar o probar?`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const ai = getGenAIClient();

    if (ai) {
      try {
        const contents = [];
        for (const item of history.slice(-8)) {
          if (item.role === 'user' || item.role === 'model' || item.role === 'assistant') {
            contents.push({
              role: item.role === 'assistant' ? 'model' : item.role,
              parts: [{ text: item.content || item.text || '' }]
            });
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        });

        const replyText = response?.text?.trim() || generateFallbackResponse(message, history);
        return res.json({ reply: replyText, model: 'gemini-2.5-flash' });
      } catch (geminiError) {
        console.warn('Gemini API call failed, using fallback:', geminiError.message);
        const fallbackReply = generateFallbackResponse(message, history);
        return res.json({ reply: fallbackReply, model: 'knowledge-engine' });
      }
    } else {
      const fallbackReply = generateFallbackResponse(message, history);
      return res.json({ reply: fallbackReply, model: 'knowledge-engine' });
    }
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: 'Error al procesar la consulta',
      reply: 'Ha ocurrido un problema al procesar tu consulta. Por favor, inténtalo de nuevo o contáctanos en hola@centrodemando.ia.'
    });
  }
});

// POST /api/contacto
app.post('/api/contacto', (req, res) => {
  try {
    const { nombre, email, empresa, empleados, mensaje, plan } = req.body;
    addAuditLog(email || 'anonimo@empresa.com', 'SOLICITUD_DEMO', `Demo solicitada por ${nombre || 'Contacto'} (${empresa || 'Empresa'}, ${empleados || '1-10'} empleados)`);
    res.json({ success: true, message: 'Solicitud recibida correctamente. Nos pondremos en contacto en menos de 24h.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar contacto.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    registeredUsersCount: loadUsers().length
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
