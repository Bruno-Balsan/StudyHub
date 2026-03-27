const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeychangeinproduction';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Garantir que a pasta de uploads existe
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR)); // servir arquivos estáticos

// Banco de dados SQLite
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err);
  else console.log('Conectado ao SQLite');
});

// Criar tabelas
db.serialize(() => {
  // Tabela users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    password TEXT,
    role TEXT DEFAULT 'member',
    group_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela groups
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_by TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela disciplines
  db.run(`CREATE TABLE IF NOT EXISTS disciplines (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela materials
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    discipline_id TEXT,
    type TEXT,
    title TEXT,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela messages
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    author_id TEXT,
    author_name TEXT,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Criar disciplinas padrão se não existirem
  db.get("SELECT COUNT(*) as count FROM disciplines", (err, row) => {
    if (!err && row.count === 0) {
      const defaultDiscs = ['Matemática', 'Física', 'Química', 'Biologia'];
      defaultDiscs.forEach(name => {
        const id = 'disc_' + Date.now() + '_' + Math.random().toString(36);
        db.run("INSERT INTO disciplines (id, name) VALUES (?, ?)", [id, name]);
      });
    }
  });

  // Criar grupo padrão se não existir
  db.get("SELECT COUNT(*) as count FROM groups", (err, row) => {
    if (!err && row.count === 0) {
      const id = 'group_' + Date.now() + '_' + Math.random().toString(36);
      db.run("INSERT INTO groups (id, name, created_by, is_active) VALUES (?, ?, ?, ?)", [id, 'Geral', 'system', 1]);
    }
  });

  // Criar usuário admin padrão se não existir
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", async (err, row) => {
    if (!err && row.count === 0) {
      const id = 'admin_' + Date.now() + '_' + Math.random().toString(36);
      const hashedPassword = await bcrypt.hash('admin123', 10);
      db.run("INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?)",
        [id, 'admin@exemplo.com', 'Administrador', hashedPassword, 'admin']);
    }
  });
});

// ==================== UTILITÁRIOS ====================
function generateId() {
  return Date.now() + '_' + Math.random().toString(36).substring(2);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// ==================== ROTAS ====================
// Auth
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, group_id: user.group_id } });
  });
});

// Usuários (admin apenas)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  db.all("SELECT id, email, name, role, group_id FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.put('/api/users/:id/group', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { group_id } = req.body;
  db.run("UPDATE users SET group_id = ? WHERE id = ?", [group_id, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar grupo' });
    res.json({ success: true });
  });
});

// Grupos
app.get('/api/groups', authenticateToken, (req, res) => {
  let query = "SELECT * FROM groups WHERE is_active = 1";
  let params = [];
  if (req.user.role !== 'admin') {
    query += " AND id = ?";
    params.push(req.user.group_id);
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.post('/api/groups', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { name } = req.body;
  const id = generateId();
  db.run("INSERT INTO groups (id, name, created_by, is_active) VALUES (?, ?, ?, ?)",
    [id, name, req.user.id, 1], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao criar grupo' });
    res.json({ id, name });
  });
});

app.delete('/api/groups/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  db.run("UPDATE groups SET is_active = 0 WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir grupo' });
    res.json({ success: true });
  });
});

// Disciplinas
app.get('/api/disciplines', authenticateToken, (req, res) => {
  db.all("SELECT * FROM disciplines ORDER BY name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.post('/api/disciplines', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { name } = req.body;
  const id = generateId();
  db.run("INSERT INTO disciplines (id, name) VALUES (?, ?)", [id, name], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao criar disciplina' });
    res.json({ id, name });
  });
});

app.delete('/api/disciplines/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  db.run("DELETE FROM materials WHERE discipline_id = ?", [req.params.id], (err) => {});
  db.run("DELETE FROM disciplines WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir disciplina' });
    res.json({ success: true });
  });
});

// Materiais
app.get('/api/materials', authenticateToken, (req, res) => {
  const discipline_id = req.query.discipline_id;
  let sql = "SELECT * FROM materials";
  let params = [];
  if (discipline_id) {
    sql += " WHERE discipline_id = ?";
    params.push(discipline_id);
  }
  sql += " ORDER BY created_at DESC";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.post('/api/materials', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { discipline_id, type, title, description, file_url, file_name } = req.body;
  const id = generateId();
  db.run(`INSERT INTO materials (id, discipline_id, type, title, description, file_url, file_name, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, discipline_id, type, title, description, file_url, file_name, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar material' });
      res.json({ id });
    });
});

app.put('/api/materials/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { title, description, type, file_url, file_name } = req.body;
  db.run(`UPDATE materials SET title=?, description=?, type=?, file_url=?, file_name=? WHERE id=?`,
    [title, description, type, file_url, file_name, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar material' });
      res.json({ success: true });
    });
});

app.delete('/api/materials/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  db.get("SELECT file_url FROM materials WHERE id = ?", [req.params.id], (err, row) => {
    if (row && row.file_url) {
      const filename = row.file_url.split('/').pop();
      const filepath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
    db.run("DELETE FROM materials WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao excluir material' });
      res.json({ success: true });
    });
  });
});

// Upload de arquivo
app.post('/api/upload', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ fileUrl, fileName: req.file.originalname });
  });
});

// Mensagens
app.get('/api/messages', authenticateToken, (req, res) => {
  const group_id = req.query.group_id;
  let sql = "SELECT * FROM messages";
  let params = [];
  if (group_id) {
    sql += " WHERE group_id = ?";
    params.push(group_id);
  }
  sql += " ORDER BY created_at ASC";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.post('/api/messages', authenticateToken, (req, res) => {
  const { group_id, text } = req.body;
  const id = generateId();
  db.run(`INSERT INTO messages (id, group_id, author_id, author_name, text)
          VALUES (?, ?, ?, ?, ?)`,
    [id, group_id, req.user.id, req.user.name, text],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao enviar mensagem' });
      res.json({ id });
    });
});

app.delete('/api/messages/:id', authenticateToken, (req, res) => {
  // Verificar se o usuário é admin ou autor da mensagem
  db.get("SELECT author_id FROM messages WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!row) return res.status(404).json({ error: 'Mensagem não encontrada' });
    if (req.user.role !== 'admin' && row.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    db.run("DELETE FROM messages WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao deletar mensagem' });
      res.json({ success: true });
    });
  });
});

// Rota para criação de usuários (apenas admin, via service role – aqui faremos manual)
app.post('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
  const { email, name, password, group_id } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Dados incompletos' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Erro ao hash' });
    const id = generateId();
    db.run("INSERT INTO users (id, email, name, password, role, group_id) VALUES (?, ?, ?, ?, ?, ?)",
      [id, email, name, hash, 'member', group_id], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao criar usuário' });
        res.json({ id, email, name, role: 'member', group_id });
      });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});