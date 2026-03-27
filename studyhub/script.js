function removeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
}

// ---------- CONFIGURAÇÕES ----------
const STORAGE_KEYS = {
    materials: 'studyhub_materials',
    disciplines: 'studyhub_disciplines',
    messages: 'studyhub_messages',
    users: 'studyhub_users',
    groups: 'studyhub_groups'
};

let disciplines = [];
let materials = [];
let messages = {};
let users = [];
let groups = [];

let currentDisciplineId = null;
let currentGroupId = null;
let currentUser = null;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

// ================== SALVAR NO SERVIDOR ==================
async function saveAll() {
    try {
        await fetch("/salvar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                disciplines,
                materials,
                messages,
                users,
                groups
            })
        });
    } catch (error) {
        console.log("Erro ao salvar:", error);
    }
}

// ================== CARREGAR DO SERVIDOR ==================
async function loadData() {
    try {
        const resposta = await fetch("/dados");
        const data = await resposta.json();

        disciplines = data.disciplines || [];
        materials = data.materials || [];
        messages = data.messages || {};
        users = data.users || [];
        groups = data.groups || [];

    } catch (erro) {
        console.log("Erro ao carregar dados:", erro);
    }

    if (!disciplines.length) {
        disciplines = [{ id: "geral", name: "Geral" }];
    }

    if (!groups.length) {
        groups = [{ id: "grupo1", name: "Grupo A" }];
    }

    if (!users.length) {
        users = [{
            id: "admin",
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD,
            role: "admin",
            groupId: null
        }];
    }

    if (!currentDisciplineId && disciplines.length) currentDisciplineId = disciplines[0].id;
    if (!currentGroupId && groups.length) currentGroupId = groups[0].id;
}

// ================== LOGIN ==================
function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        renderDashboard();
        return true;
    }

    return false;
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    removeAllModals();
    renderLogin();
}



// ================== INICIAR ==================
function init() {
    const storedUser = sessionStorage.getItem('currentUser');

    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        renderDashboard();
    } else {
        renderLogin();
    }
}

async function start() {
    await loadData();
    init();
}

start();