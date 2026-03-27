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

function saveAll() {
    localStorage.setItem(STORAGE_KEYS.disciplines, JSON.stringify(disciplines));
    localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(materials));
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(groups));
}

function loadData() {
    // Disciplinas
    const storedDisc = localStorage.getItem(STORAGE_KEYS.disciplines);
    if (storedDisc) {
        disciplines = JSON.parse(storedDisc);
    } else {
        disciplines = [
            { id: "disc1", name: "Matemática" },
            { id: "disc2", name: "Física" },
            { id: "disc3", name: "Química" },
            { id: "disc4", name: "Biologia" }
        ];
    }

    // Materiais
    const storedMat = localStorage.getItem(STORAGE_KEYS.materials);
    if (storedMat) {
        materials = JSON.parse(storedMat);
    } else {
        materials = [
            { id: "mat1", disciplineId: "disc1", title: "Slides - Funções", type: "slides", linkOrDesc: "https://exemplo.com/slides_funcoes.pdf", createdAt: Date.now() },
            { id: "mat2", disciplineId: "disc1", title: "Lista de Exercícios - Logaritmos", type: "lista", linkOrDesc: "exercicios_log.pdf - 10 questões", createdAt: Date.now() },
            { id: "mat3", disciplineId: "disc2", title: "Resumo - Cinemática", type: "resumo", linkOrDesc: "Conceitos principais: MRU, MRUV, gráficos", createdAt: Date.now() },
            { id: "mat4", disciplineId: "disc2", title: "Cronograma - Provas Física", type: "cronograma", linkOrDesc: "Semana 1: movimento uniforme, Semana 2: forças", createdAt: Date.now() },
            { id: "mat5", disciplineId: "disc3", title: "Atividade - Tabela Periódica", type: "atividade", linkOrDesc: "Completar com famílias e grupos", createdAt: Date.now() },
            { id: "mat6", disciplineId: "disc4", title: "Slides - Ecologia", type: "slides", linkOrDesc: "Slides sobre cadeias alimentares", createdAt: Date.now() },
            { id: "mat7", disciplineId: "disc3", title: "Lista de Exercícios - Estequiometria", type: "lista", linkOrDesc: "20 questões com gabarito", createdAt: Date.now() }
        ];
    }

    // Grupos
    const storedGroups = localStorage.getItem(STORAGE_KEYS.groups);
    if (storedGroups) {
        groups = JSON.parse(storedGroups);
    } else {
        groups = [
            { id: "grupo1", name: "Grupo A" },
            { id: "grupo2", name: "Grupo B" },
            { id: "grupo3", name: "Grupo C" }
        ];
    }

    // Mensagens
    const storedMsg = localStorage.getItem(STORAGE_KEYS.messages);
    if (storedMsg) {
        messages = JSON.parse(storedMsg);
    } else {
        messages = {};
        groups.forEach(g => {
            messages[g.id] = [
                { id: `msg_${g.id}_1`, userId: "admin", username: "Admin", text: `Bem‑vindo ao ${g.name}!`, timestamp: Date.now() }
            ];
        });
    }

    // Usuários
    const storedUsers = localStorage.getItem(STORAGE_KEYS.users);
    if (storedUsers) {
        users = JSON.parse(storedUsers);
    } else {
        users = [
            { id: "admin", username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: "admin", groupId: null }
        ];
    }

    if (!disciplines.length) disciplines = [{ id: "disc_default", name: "Geral" }];
    if (!currentDisciplineId && disciplines.length) currentDisciplineId = disciplines[0].id;
    if (!currentGroupId && groups.length) currentGroupId = groups[0].id;
}

function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify({ id: user.id, username: user.username, role: user.role, groupId: user.groupId }));
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

function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <h2><i class="fas fa-graduation-cap"></i> StudyHub</h2>
            <p>Entre com suas credenciais</p>
            <input type="text" id="loginUsername" placeholder="Usuário">
            <input type="password" id="loginPassword" placeholder="Senha">
            <button id="loginBtn" class="btn-primary">Entrar</button>
            <div id="loginError" class="error-msg"></div>
            <p style="margin-top:12px; font-size:0.8rem;">Solicite suas credenciais ao administrador</p>
        </div>
    `;
    document.getElementById('loginBtn').addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        if (login(username, password)) {
            // sucesso
        } else {
            document.getElementById('loginError').innerText = 'Usuário ou senha inválidos';
        }
    });
}

function renderDashboard() {
    // Filtrar grupos: admin vê todos; não‑admin vê apenas seu grupo (se tiver)
    let userGroups = groups;
    if (currentUser.role !== 'admin' && currentUser.groupId) {
        userGroups = groups.filter(g => g.id === currentUser.groupId);
    }
    // Se não tiver grupo, mostrar mensagem (mas admin deve atribuir)
    if (userGroups.length === 0) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="app-container">
                <div class="top-bar">
                    <div class="logo">
                        <h1><i class="fas fa-graduation-cap"></i> StudyHub</h1>
                        <p>Olá, ${currentUser.username}</p>
                    </div>
                    <div class="admin-area">
                        <button id="logoutBtn" class="btn-outline">Sair</button>
                    </div>
                </div>
                <div style="text-align:center; padding:40px;">
                    <i class="fas fa-users-slash" style="font-size:48px;"></i>
                    <h3>Você ainda não foi atribuído a nenhum grupo.</h3>
                    <p>Entre em contato com o administrador para que ele defina seu grupo.</p>
                </div>
            </div>
        `;
        document.getElementById('logoutBtn').addEventListener('click', logout);
        return;
    }

    // Se o grupo atual não estiver nos grupos permitidos, escolher o primeiro
    if (!userGroups.find(g => g.id === currentGroupId)) {
        currentGroupId = userGroups[0].id;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="app-container">
            <div class="top-bar">
                <div class="logo">
                    <h1><i class="fas fa-graduation-cap"></i> StudyHub</h1>
                    <p>Olá, ${currentUser.username} (${currentUser.role === 'admin' ? 'Admin' : 'Membro'})</p>
                </div>
                <div class="admin-area">
                    ${currentUser.role === 'admin' ? '<button id="adminPanelBtn" class="btn-outline"><i class="fas fa-cog"></i> Admin</button>' : ''}
                    <button id="logoutBtn" class="btn-outline"><i class="fas fa-sign-out-alt"></i> Sair</button>
                </div>
            </div>
            <div class="dashboard">
                <div class="materials-section">
                    <h3><i class="fas fa-book-open"></i> Materiais por disciplina</h3>
                    <div class="disciplines-tabs" id="disciplinesTabs"></div>
                    <div id="adminMaterialForm" style="display:${currentUser.role === 'admin' ? 'block' : 'none'}"></div>
                    <div id="materialsContainer" class="materials-grid"></div>
                </div>
                <div class="chat-section">
                    <h3><i class="fas fa-comments"></i> Chat Interno</h3>
                    <div class="chat-groups" id="chatGroupsContainer"></div>
                    <div id="chatMessagesArea" class="chat-messages"></div>
                    <div class="chat-input-area">
                        <div class="chat-input-row">
                            <input type="text" id="chatMessageInput" placeholder="Digite sua mensagem...">
                            <button id="sendChatBtn" class="btn-primary"><i class="fas fa-paper-plane"></i> Enviar</button>
                        </div>
                    </div>
                </div>
            </div>
            <footer>Administradores podem postar materiais e gerenciar usuários/grupos. Chat com nome do usuário logado.</footer>
        </div>
    `;

    renderDisciplines();
    renderMaterials();
    renderChatGroups(userGroups);
    renderChatMessages();

    if (currentUser.role === 'admin') {
        const formDiv = document.getElementById('adminMaterialForm');
        formDiv.innerHTML = `
            <div class="admin-form">
                <strong><i class="fas fa-plus-circle"></i> Adicionar novo material</strong>
                <div class="form-row">
                    <select id="adminDiscSelect"></select>
                    <select id="adminTypeSelect">
                        <option value="slides">📽️ Slides</option>
                        <option value="resumo">📄 Resumo</option>
                        <option value="cronograma">📅 Cronograma</option>
                        <option value="lista">📝 Lista de Exercícios</option>
                        <option value="atividade">✍️ Atividade</option>
                    </select>
                </div>
                <div class="form-row">
                    <input type="text" id="adminTitle" placeholder="Título do conteúdo">
                </div>
                <div class="form-row">
                    <textarea id="adminLinkDesc" rows="2" placeholder="Link ou descrição (opcional)"></textarea>
                </div>
                <div class="form-row">
                    <label class="btn-file" style="display: inline-flex; align-items: center; gap: 6px; background:#eef2fa; padding:8px 16px; border-radius:40px; cursor:pointer;">
                        <i class="fas fa-upload"></i> Anexar arquivo (PDF, imagem, etc.)
                        <input type="file" id="adminFileInput" style="display:none;">
                    </label>
                    <span id="fileSelectedName" class="file-info">Nenhum arquivo selecionado</span>
                </div>
                <div class="form-row">
                    <button id="submitMaterialBtn" class="btn-primary"><i class="fas fa-save"></i> Publicar Material</button>
                </div>
            </div>
            <div style="margin: 12px 0 8px; display: flex; gap: 12px;">
                <button id="addDisciplineBtn" class="btn-outline"><i class="fas fa-plus"></i> Nova Disciplina</button>
                <button id="deleteCurrentDiscBtn" class="btn-danger"><i class="fas fa-trash-alt"></i> Excluir Disciplina Atual</button>
            </div>
        `;
        const discSelect = document.getElementById('adminDiscSelect');
        if (discSelect) {
            discSelect.innerHTML = disciplines.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            discSelect.value = currentDisciplineId;
        }
        const fileInput = document.getElementById('adminFileInput');
        const fileLabel = document.getElementById('fileSelectedName');
        if (fileInput) {
            fileInput.addEventListener('change', () => {
                fileLabel.innerText = fileInput.files.length ? fileInput.files[0].name : "Nenhum arquivo selecionado";
            });
        }
        document.getElementById('submitMaterialBtn')?.addEventListener('click', addNewMaterial);
        document.getElementById('addDisciplineBtn')?.addEventListener('click', addNewDiscipline);
        document.getElementById('deleteCurrentDiscBtn')?.addEventListener('click', deleteCurrentDiscipline);
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
    if (currentUser.role === 'admin') {
        document.getElementById('adminPanelBtn').addEventListener('click', openAdminPanel);
    }
    document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatMessageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

// ==================== MATERIAIS ====================
function renderDisciplines() {
    const container = document.getElementById('disciplinesTabs');
    if (!container) return;
    container.innerHTML = '';
    disciplines.forEach(disc => {
        const btn = document.createElement('button');
        btn.className = `discipline-btn ${currentDisciplineId === disc.id ? 'active' : ''}`;
        btn.innerText = disc.name;
        btn.addEventListener('click', () => {
            currentDisciplineId = disc.id;
            renderMaterials();
            document.querySelectorAll('.discipline-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const discSelect = document.getElementById('adminDiscSelect');
            if (discSelect) discSelect.value = currentDisciplineId;
        });
        container.appendChild(btn);
    });
    if (currentUser.role === 'admin') {
        const addDiscBtn = document.createElement('button');
        addDiscBtn.innerHTML = '<i class="fas fa-plus"></i> Disciplina';
        addDiscBtn.className = 'admin-tools';
        addDiscBtn.style.marginLeft = 'auto';
        addDiscBtn.addEventListener('click', addNewDiscipline);
        container.appendChild(addDiscBtn);
    }
}

function renderMaterials() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    const filtered = materials.filter(m => m.disciplineId === currentDisciplineId);
    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;">📭 Nenhum material ainda. ${currentUser.role === 'admin' ? 'Use o formulário admin para adicionar.' : 'Aguarde conteúdos dos admins.'}</div>`;
        return;
    }
    container.innerHTML = '';
    filtered.sort((a,b)=>b.createdAt - a.createdAt);
    filtered.forEach(mat => {
        const typeMap = { slides:'📽️ Slides', resumo:'📄 Resumo', cronograma:'📅 Cronograma', lista:'📝 Lista', atividade:'✍️ Atividade' };
        const typeLabel = typeMap[mat.type] || mat.type;
        const card = document.createElement('div');
        card.className = 'material-card';

        let contentHtml = '';
        if (mat.linkOrDesc) {
            if (mat.linkOrDesc.startsWith('http://') || mat.linkOrDesc.startsWith('https://')) {
                contentHtml += `<div class="material-desc"><a href="${mat.linkOrDesc}" target="_blank">🔗 ${escapeHtml(mat.linkOrDesc)}</a></div>`;
            } else {
                contentHtml += `<div class="material-desc">${escapeHtml(mat.linkOrDesc)}</div>`;
            }
        }
        if (mat.fileData) {
            const ext = mat.fileName.split('.').pop().toLowerCase();
            let icon = '📄';
            if (ext === 'pdf') icon = '📑';
            else if (['jpg','jpeg','png','gif','webp'].includes(ext)) icon = '🖼️';
            else if (ext === 'doc' || ext === 'docx') icon = '📝';
            else if (ext === 'xls' || ext === 'xlsx') icon = '📊';
            contentHtml += `
                <div class="material-desc">
                    <a href="${mat.fileData}" download="${mat.fileName}" class="file-download">
                        <i class="fas fa-download"></i> ${icon} ${escapeHtml(mat.fileName)}
                    </a>
                    ${mat.fileType?.startsWith('image/') ? `<br><img src="${mat.fileData}" style="max-width:100%; max-height:150px; margin-top:8px; border-radius:12px;" alt="pré-visualização">` : ''}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="material-header">
                <span class="material-title">${escapeHtml(mat.title)}</span>
                <span class="badge-type">${typeLabel}</span>
            </div>
            ${contentHtml}
            ${currentUser.role === 'admin' ? `<div class="material-actions">
                <button class="btn-outline edit-mat-btn" data-id="${mat.id}"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-danger delete-mat-btn" data-id="${mat.id}"><i class="fas fa-trash"></i> Excluir</button>
            </div>` : ''}
        `;
        container.appendChild(card);
        if (currentUser.role === 'admin') {
            card.querySelector('.edit-mat-btn')?.addEventListener('click', (e) => { e.stopPropagation(); editMaterial(mat.id); });
            card.querySelector('.delete-mat-btn')?.addEventListener('click', (e) => { e.stopPropagation(); deleteMaterial(mat.id); });
        }
    });
}

function addNewMaterial() {
    const discId = document.getElementById('adminDiscSelect')?.value;
    const type = document.getElementById('adminTypeSelect')?.value;
    const title = document.getElementById('adminTitle')?.value.trim();
    const linkDesc = document.getElementById('adminLinkDesc')?.value.trim();
    const fileInput = document.getElementById('adminFileInput');

    if (!title) { alert("Digite um título"); return; }
    if (!discId) return;

    const newId = "mat_" + Date.now() + "_" + Math.random();
    const newMaterial = {
        id: newId,
        disciplineId: discId,
        title: title,
        type: type,
        linkOrDesc: linkDesc || "",
        createdAt: Date.now()
    };

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert("Arquivo muito grande (máx. 5MB).");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            newMaterial.fileData = e.target.result;
            newMaterial.fileName = file.name;
            newMaterial.fileType = file.type;
            materials.push(newMaterial);
            saveAll();
            renderMaterials();
            fileInput.value = "";
            document.getElementById('fileSelectedName').innerText = "Nenhum arquivo selecionado";
        };
        reader.readAsDataURL(file);
    } else {
        materials.push(newMaterial);
        saveAll();
        renderMaterials();
    }
}

function addNewDiscipline() {
    let name = prompt("Nome da nova disciplina:");
    if (!name || name.trim() === "") return;
    const newId = "disc_" + Date.now();
    disciplines.push({ id: newId, name: name.trim() });
    saveAll();
    currentDisciplineId = newId;
    renderDisciplines();
    renderMaterials();
    refreshAdminDiscSelect();
}

function refreshAdminDiscSelect() {
    const discSelect = document.getElementById('adminDiscSelect');
    if (discSelect && currentUser.role === 'admin') {
        discSelect.innerHTML = disciplines.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        discSelect.value = currentDisciplineId;
    }
}

function deleteCurrentDiscipline() {
    if (disciplines.length <= 1) { alert("É necessário manter pelo menos uma disciplina."); return; }
    const confirmDel = confirm(`Tem certeza que deseja excluir a disciplina "${disciplines.find(d=>d.id===currentDisciplineId)?.name}" e TODOS os materiais associados?`);
    if (!confirmDel) return;
    materials = materials.filter(m => m.disciplineId !== currentDisciplineId);
    disciplines = disciplines.filter(d => d.id !== currentDisciplineId);
    if (disciplines.length) currentDisciplineId = disciplines[0].id;
    saveAll();
    renderDisciplines();
    renderMaterials();
    refreshAdminDiscSelect();
}

function editMaterial(matId) {
    const material = materials.find(m => m.id === matId);
    if (!material) return;
    const newTitle = prompt("Editar título:", material.title);
    if (newTitle === null) return;
    const newDesc = prompt("Editar link/descrição:", material.linkOrDesc);
    if (newDesc === null) return;
    const newType = prompt("Novo tipo (slides, resumo, cronograma, lista, atividade):", material.type);
    if (newType && ['slides','resumo','cronograma','lista','atividade'].includes(newType.toLowerCase())) {
        material.type = newType.toLowerCase();
    }
    material.title = newTitle.trim() || material.title;
    material.linkOrDesc = newDesc.trim() || material.linkOrDesc;

    if (confirm("Deseja alterar o arquivo anexado? (Cancelar mantém o atual)")) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = (e) => {
            const file = fileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    material.fileData = ev.target.result;
                    material.fileName = file.name;
                    material.fileType = file.type;
                    saveAll();
                    renderMaterials();
                };
                reader.readAsDataURL(file);
            } else {
                saveAll();
                renderMaterials();
            }
        };
        fileInput.click();
    } else {
        saveAll();
        renderMaterials();
    }
}

function deleteMaterial(matId) {
    if (confirm("Remover este material?")) {
        materials = materials.filter(m => m.id !== matId);
        saveAll();
        renderMaterials();
    }
}

// ==================== CHAT ====================
function renderChatGroups(groupsToShow) {
    const container = document.getElementById('chatGroupsContainer');
    if (!container) return;
    container.innerHTML = '';
    groupsToShow.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `group-tab ${currentGroupId === group.id ? 'active-group' : ''}`;
        btn.innerText = group.name;
        btn.addEventListener('click', () => {
            currentGroupId = group.id;
            renderChatMessages();
            renderChatGroups(groupsToShow);
        });
        container.appendChild(btn);
    });
    if (currentUser.role === 'admin') {
        const addGroupBtn = document.createElement('button');
        addGroupBtn.innerHTML = '<i class="fas fa-plus"></i> Novo grupo';
        addGroupBtn.className = 'btn-outline';
        addGroupBtn.addEventListener('click', () => {
            const name = prompt('Nome do novo grupo:');
            if (name && name.trim()) {
                const newId = 'group_' + Date.now();
                groups.push({ id: newId, name: name.trim() });
                messages[newId] = [];
                saveAll();
                renderDashboard();
            }
        });
        container.appendChild(addGroupBtn);
    }
}

function renderChatMessages() {
    const msgContainer = document.getElementById('chatMessagesArea');
    if (!msgContainer) return;
    const currentMessages = messages[currentGroupId] || [];
    if (currentMessages.length === 0) {
        msgContainer.innerHTML = '<div class="empty-msg">💬 Nenhuma mensagem ainda. Seja o primeiro a escrever!</div>';
        return;
    }
    msgContainer.innerHTML = '';
    currentMessages.forEach(msg => {
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        const canDelete = (currentUser.role === 'admin') || (msg.userId === currentUser.id);
        msgDiv.innerHTML = `
            <div class="msg-author">${escapeHtml(msg.username)}</div>
            <div class="msg-text">${escapeHtml(msg.text)}</div>
            <div class="msg-time">${timeStr}</div>
            ${canDelete ? `<button class="delete-msg" data-id="${msg.id}"><i class="fas fa-trash-alt"></i></button>` : ''}
        `;
        if (canDelete) {
            msgDiv.querySelector('.delete-msg').addEventListener('click', () => {
                if (confirm('Apagar esta mensagem?')) {
                    deleteMessage(msg.id);
                }
            });
        }
        msgContainer.appendChild(msgDiv);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function sendChatMessage() {
    const msgInput = document.getElementById('chatMessageInput');
    const text = msgInput.value.trim();
    if (text === "") return;
    const newMsg = {
        id: Date.now() + "_" + Math.random(),
        userId: currentUser.id,
        username: currentUser.username,
        text: text,
        timestamp: Date.now()
    };
    if (!messages[currentGroupId]) messages[currentGroupId] = [];
    messages[currentGroupId].push(newMsg);
    saveAll();
    msgInput.value = "";
    renderChatMessages();
}

function deleteMessage(msgId) {
    const groupMsgs = messages[currentGroupId];
    const index = groupMsgs.findIndex(m => m.id === msgId);
    if (index !== -1) {
        groupMsgs.splice(index, 1);
        saveAll();
        renderChatMessages();
    }
}

// ==================== ADMIN PANEL ====================
function openAdminPanel() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="width: 450px;">
            <h3>Painel Administrativo</h3>
            <div id="userList">
                <h4>Usuários</h4>
                <ul id="userListUl"></ul>
            </div>
            <button id="createUserBtn" class="btn-primary">Criar novo usuário</button>
            <button id="resetPasswordBtn" class="btn-outline">Resetar senha</button>
            <hr>
            <div id="groupManagement">
                <h4>Gerenciar grupos de chat</h4>
                <ul id="groupListUl"></ul>
                <button id="createGroupBtn" class="btn-primary">Criar novo grupo</button>
                <button id="deleteGroupBtn" class="btn-danger">Excluir grupo atual</button>
            </div>
            <button id="closeModalBtn" style="margin-top:12px;">Fechar</button>
        </div>
    `;
    document.body.appendChild(modal);

    const userListUl = document.getElementById('userListUl');
    function refreshUserList() {
        userListUl.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            const userGroup = groups.find(g => g.id === user.groupId);
            li.innerHTML = `
                <strong>${user.username}</strong> (${user.role})
                <br>
                <small>Grupo: 
                    <select class="user-group-select" data-user-id="${user.id}">
                        <option value="">Nenhum</option>
                        ${groups.map(g => `<option value="${g.id}" ${user.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                    </select>
                </small>
            `;
            if (user.username !== ADMIN_USERNAME) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Excluir';
                deleteBtn.className = 'btn-danger';
                deleteBtn.style.marginLeft = '8px';
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Excluir usuário ${user.username}?`)) {
                        users = users.filter(u => u.id !== user.id);
                        saveAll();
                        refreshUserList();
                    }
                });
                li.appendChild(deleteBtn);
            }
            userListUl.appendChild(li);

            const select = li.querySelector('.user-group-select');
            select.addEventListener('change', (e) => {
                const newGroupId = e.target.value || null;
                user.groupId = newGroupId;
                saveAll();
                // Se o usuário logado for o próprio, atualizar currentUser
                if (currentUser.id === user.id) {
                    currentUser.groupId = newGroupId;
                    sessionStorage.setItem('currentUser', JSON.stringify({ id: currentUser.id, username: currentUser.username, role: currentUser.role, groupId: currentUser.groupId }));
                }
                alert('Grupo alterado!');
            });
        });
    }
    refreshUserList();

    const groupListUl = document.getElementById('groupListUl');
    function refreshGroupList() {
        groupListUl.innerHTML = '';
        groups.forEach(group => {
            const li = document.createElement('li');
            li.textContent = group.name;
            if (groups.length > 1) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Excluir';
                deleteBtn.className = 'btn-danger';
                deleteBtn.style.marginLeft = '8px';
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Excluir grupo "${group.name}"? Todas as mensagens serão apagadas.`)) {
                        groups = groups.filter(g => g.id !== group.id);
                        delete messages[group.id];
                        // Remover referência nos usuários
                        users.forEach(u => {
                            if (u.groupId === group.id) u.groupId = null;
                        });
                        if (currentGroupId === group.id && groups.length) currentGroupId = groups[0].id;
                        saveAll();
                        refreshGroupList();
                        renderDashboard();
                    }
                });
                li.appendChild(deleteBtn);
            }
            groupListUl.appendChild(li);
        });
    }
    refreshGroupList();

    document.getElementById('createUserBtn').addEventListener('click', () => {
        const username = prompt('Nome de usuário:');
        if (!username) return;
        const password = prompt('Senha:');
        if (!password) return;
        if (users.find(u => u.username === username)) {
            alert('Usuário já existe');
            return;
        }
        const newId = 'user_' + Date.now();
        users.push({ id: newId, username, password, role: 'member', groupId: null });
        saveAll();
        refreshUserList();
        alert('Usuário criado com sucesso');
    });

    document.getElementById('resetPasswordBtn').addEventListener('click', () => {
        const username = prompt('Nome do usuário para resetar senha:');
        if (!username) return;
        const user = users.find(u => u.username === username);
        if (!user) {
            alert('Usuário não encontrado');
            return;
        }
        const newPassword = prompt('Nova senha:');
        if (!newPassword) return;
        user.password = newPassword;
        saveAll();
        alert('Senha alterada');
    });

    document.getElementById('createGroupBtn').addEventListener('click', () => {
        const name = prompt('Nome do novo grupo:');
        if (name && name.trim()) {
            const newId = 'group_' + Date.now();
            groups.push({ id: newId, name: name.trim() });
            messages[newId] = [];
            saveAll();
            refreshGroupList();
            renderDashboard();
        }
    });

    document.getElementById('deleteGroupBtn').addEventListener('click', () => {
        if (groups.length <= 1) {
            alert('Não é possível excluir o último grupo.');
            return;
        }
        const groupToDelete = groups.find(g => g.id === currentGroupId);
        if (!groupToDelete) return;
        if (confirm(`Excluir grupo "${groupToDelete.name}"?`)) {
            groups = groups.filter(g => g.id !== currentGroupId);
            delete messages[currentGroupId];
            users.forEach(u => {
                if (u.groupId === currentGroupId) u.groupId = null;
            });
            if (groups.length) currentGroupId = groups[0].id;
            saveAll();
            refreshGroupList();
            renderDashboard();
        }
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => modal.remove());
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function init() {
    loadData();
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        renderDashboard();
    } else {
        renderLogin();
    }
}
init();