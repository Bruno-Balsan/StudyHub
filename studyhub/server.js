const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// caminhos dos arquivos
const usuarios = "./database/usuarios.json";
const materias = "./database/materias.json";
const atividades = "./database/atividades.json";
const chat = "./database/chat.json";

// -------- CRIAR USUÁRIO --------
app.post("/criar-usuario", (req, res) => {
    const { nome, senha } = req.body;

    const dados = JSON.parse(fs.readFileSync(usuarios));
    dados.push({ nome, senha });

    fs.writeFileSync(usuarios, JSON.stringify(dados, null, 2));
    res.send("Usuário criado!");
});

// -------- LOGIN --------
app.post("/login", (req, res) => {
    const { nome, senha } = req.body;

    const dados = JSON.parse(fs.readFileSync(usuarios));

    const usuario = dados.find(u => u.nome === nome && u.senha === senha);

    if (usuario) {
        res.send("ok");
    } else {
        res.send("erro");
    }
});

// -------- CRIAR MATÉRIA --------
app.post("/criar-materia", (req, res) => {
    const { nome } = req.body;

    const dados = JSON.parse(fs.readFileSync(materias));
    dados.push({ nome });

    fs.writeFileSync(materias, JSON.stringify(dados, null, 2));
    res.send("Matéria criada!");
});

// -------- LISTAR MATÉRIAS --------
app.get("/materias", (req, res) => {
    const dados = JSON.parse(fs.readFileSync(materias));
    res.json(dados);
});

// -------- ENVIAR MENSAGEM --------
app.post("/enviar-mensagem", (req, res) => {
    const { nome, mensagem } = req.body;

    const dados = JSON.parse(fs.readFileSync(chat));
    dados.push({ nome, mensagem });

    fs.writeFileSync(chat, JSON.stringify(dados, null, 2));
    res.send("Mensagem enviada!");
});

// -------- PEGAR MENSAGENS --------
app.get("/chat", (req, res) => {
    const dados = JSON.parse(fs.readFileSync(chat));
    res.json(dados);
});

app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});