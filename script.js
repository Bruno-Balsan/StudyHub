// ==================== CONFIGURAÇÃO ====================
const API_BASE_URL = 'https://studyhub-n4xn.onrender.com'; // ALTERE PARA SUA URL
let currentUser = null;
let currentGroupId = null;
let currentDisciplineId = null;
let messagesPollInterval = null; // para simular realtime (ou usar SSE)

// ==================== AUXILIARES ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function removeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.remove());
}

function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ==================== AUTENTICAÇÃO ====================
async function login(email, password) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        renderDashboard();
        return true;
    } catch (err) {
        alert('Erro: ' + err.message);
        return false;
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    if (messagesPollInterval) clearInterval(messagesPollInterval);
    renderLogin();
}

// ==================== RENDERIZAÇÃO ====================
function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <h2><i class="fas fa-graduation-cap"></i> StudyHub</h2>
            <p>Entre com suas credenciais</p>
            <input type="email" id="loginEmail" placeholder="E-mail">
            <input type="password" id="loginPassword" placeholder="Senha">
            <button id="loginBtn" class="btn-primary">Entrar</button>
            <div id="loginError" class="error-msg"></div>
            <p style="margin-top:12px; font-size:0.8rem;">Solicite suas credenciais ao administrador</p>
        </div>
    `;
    document.getElementById('loginBtn').addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        login(email, password);
    });
}

async function renderDashboard() {
    // Carregar disciplinas
    const disciplines = await fetchAPI('/api/disciplines');
    if (!disciplines || disciplines.length === 0) {
        if (currentUser.role === 'admin') {
            // criar disciplinas padrão
            for (const name of ['Matemática', 'Física', 'Química', 'Biologia']) {
                await fetchAPI('/api/disciplines', { method: 'POST', body: JSON.stringify({ name }) });
            }
            return renderDashboard();
        }
    }
    if (!currentDisciplineId && disciplines?.length) currentDisciplineId = disciplines[0].id;

    // Carregar grupos
    const groups = await fetchAPI('/api/groups');
    if (!groups || groups.length === 0) {
        if (currentUser.role === 'admin') {
            await fetchAPI('/api/groups', { method: 'POST', body: JSON.stringify({ name: 'Geral' }) });
            return renderDashboard();
        } else {
            // mostrar mensagem de sem grupo
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="app-container">
                    <div class="top-bar">
                        <div class="logo"><h1>StudyHub</h1><p>Olá, ${currentUser.name}</p></div>
                        <div class="admin-area"><button id="logoutBtn">Sair</button></div>
                    </div>
                    <div style="text-align:center; padding:40px;">
                        <i class="fas fa-users-slash" style="font-size:48px;"></i>
                        <h3>Você ainda não foi atribuído a nenhum grupo.</h3>
                        <p>Entre em contato com o administrador.</p>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn').addEventListener('click', logout);
            return;
        }
    }

    if (!currentGroupId && groups?.length) currentGroupId = groups[0].id;

    // Montar HTML
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="app-container">
            <div class="top-bar">
                <div class="logo">
                    <h1><i class="fas fa-graduation-cap"></i> StudyHub</h1>
                    <p>Olá, ${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Membro'})</p>
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
            <footer>Administradores podem postar materiais e gerenciar usuários/grupos. Chat em tempo real (polling).</footer>
        </div>
    `;

    renderDisciplines(disciplines);
    renderMaterials();
    renderChatGroups(groups);
    startChatPolling(); // atualiza mensagens a cada 2 segundos

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
        if (discSelect && disciplines) {
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

// ==================== FUNÇÕES DE API ====================
async function fetchAPI(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers
    };
    const res = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro na requisição');
    }
    return res.json();
}

// ==================== MATERIAIS ====================
function renderDisciplines(disciplines) {
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

async function renderMaterials() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    try {
        const materials = await fetchAPI(`/api/materials?discipline_id=${currentDisciplineId}`);
        if (!materials || materials.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px;">📭 Nenhum material ainda. ${currentUser.role === 'admin' ? 'Use o formulário admin para adicionar.' : 'Aguarde conteúdos dos admins.'}</div>`;
            return;
        }
        container.innerHTML = '';
        for (const mat of materials) {
            const typeMap = { slides:'📽️ Slides', resumo:'📄 Resumo', cronograma:'📅 Cronograma', lista:'📝 Lista', atividade:'✍️ Atividade' };
            const typeLabel = typeMap[mat.type] || mat.type;
            const card = document.createElement('div');
            card.className = 'material-card';

            let contentHtml = '';
            if (mat.description) {
                if (mat.description.startsWith('http://') || mat.description.startsWith('https://')) {
                    contentHtml += `<div class="material-desc"><a href="${mat.description}" target="_blank">🔗 ${escapeHtml(mat.description)}</a></div>`;
                } else {
                    contentHtml += `<div class="material-desc">${escapeHtml(mat.description)}</div>`;
                }
            }
            if (mat.file_url) {
                const ext = mat.file_name.split('.').pop().toLowerCase();
                let icon = '📄';
                if (ext === 'pdf') icon = '📑';
                else if (['jpg','jpeg','png','gif','webp'].includes(ext)) icon = '🖼️';
                else if (ext === 'doc' || ext === 'docx') icon = '📝';
                else if (ext === 'xls' || ext === 'xlsx') icon = '📊';
                contentHtml += `
                    <div class="material-desc">
                        <a href="${mat.file_url}" download="${mat.file_name}" class="file-download">
                            <i class="fas fa-download"></i> ${icon} ${escapeHtml(mat.file_name)}
                        </a>
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
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="text-align:center;padding:40px;">Erro ao carregar materiais.</div>';
    }
}

async function addNewMaterial() {
    const discId = document.getElementById('adminDiscSelect')?.value;
    const type = document.getElementById('adminTypeSelect')?.value;
    const title = document.getElementById('adminTitle')?.value.trim();
    const description = document.getElementById('adminLinkDesc')?.value.trim();
    const fileInput = document.getElementById('adminFileInput');
    if (!title) { alert("Digite um título"); return; }
    if (!discId) return;

    let fileUrl = null, fileName = null;
    if (fileInput && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            alert('Erro ao enviar arquivo: ' + data.error);
            return;
        }
        fileUrl = data.fileUrl;
        fileName = data.fileName;
    }

    try {
        await fetchAPI('/api/materials', {
            method: 'POST',
            body: JSON.stringify({ discipline_id: discId, type, title, description, file_url: fileUrl, file_name: fileName })
        });
        alert('Material publicado!');
        renderMaterials();
        document.getElementById('adminTitle').value = '';
        document.getElementById('adminLinkDesc').value = '';
        if (fileInput) fileInput.value = '';
        document.getElementById('fileSelectedName').innerText = "Nenhum arquivo selecionado";
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function addNewDiscipline() {
    let name = prompt("Nome da nova disciplina:");
    if (!name || name.trim() === "") return;
    try {
        await fetchAPI('/api/disciplines', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
        renderDashboard();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function deleteCurrentDiscipline() {
    if (disciplines.length <= 1) { alert("É necessário manter pelo menos uma disciplina."); return; }
    const discipline = disciplines.find(d => d.id === currentDisciplineId);
    if (!discipline) return;
    if (!confirm(`Excluir a disciplina "${discipline.name}" e todos os materiais associados?`)) return;
    try {
        await fetchAPI(`/api/disciplines/${currentDisciplineId}`, { method: 'DELETE' });
        renderDashboard();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function editMaterial(matId) {
    // Obter material atual
    const materials = await fetchAPI(`/api/materials?discipline_id=${currentDisciplineId}`);
    const material = materials.find(m => m.id === matId);
    if (!material) return;
    const newTitle = prompt("Editar título:", material.title);
    if (newTitle === null) return;
    const newDesc = prompt("Editar descrição/link:", material.description);
    if (newDesc === null) return;
    const newType = prompt("Novo tipo (slides, resumo, cronograma, lista, atividade):", material.type);
    if (newType && ['slides','resumo','cronograma','lista','atividade'].includes(newType.toLowerCase())) {
        material.type = newType.toLowerCase();
    }
    const updates = {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        type: material.type
    };
    if (confirm("Deseja alterar o arquivo anexado? (Cancelar mantém o atual)")) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = async (e) => {
            const file = fileInput.files[0];
            let fileUrl = material.file_url;
            let fileName = material.file_name;
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    fileUrl = data.fileUrl;
                    fileName = data.fileName;
                } else {
                    alert('Erro ao enviar novo arquivo: ' + data.error);
                    return;
                }
            }
            updates.file_url = fileUrl;
            updates.file_name = fileName;
            try {
                await fetchAPI(`/api/materials/${matId}`, { method: 'PUT', body: JSON.stringify(updates) });
                renderMaterials();
            } catch (err) { alert(err.message); }
        };
        fileInput.click();
    } else {
        try {
            await fetchAPI(`/api/materials/${matId}`, { method: 'PUT', body: JSON.stringify(updates) });
            renderMaterials();
        } catch (err) { alert(err.message); }
    }
}

async function deleteMaterial(matId) {
    if (!confirm("Remover este material?")) return;
    try {
        await fetchAPI(`/api/materials/${matId}`, { method: 'DELETE' });
        renderMaterials();
    } catch (err) { alert(err.message); }
}

// ==================== CHAT ====================
function renderChatGroups(groups) {
    const container = document.getElementById('chatGroupsContainer');
    if (!container) return;
    container.innerHTML = '';
    groups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `group-tab ${currentGroupId === group.id ? 'active-group' : ''}`;
        btn.innerText = group.name;
        btn.addEventListener('click', () => {
            currentGroupId = group.id;
            renderChatMessages();
            renderChatGroups(groups);
        });
        container.appendChild(btn);
    });
    if (currentUser.role === 'admin') {
        const addGroupBtn = document.createElement('button');
        addGroupBtn.innerHTML = '<i class="fas fa-plus"></i> Novo grupo';
        addGroupBtn.className = 'btn-outline';
        addGroupBtn.addEventListener('click', async () => {
            const name = prompt('Nome do novo grupo:');
            if (name && name.trim()) {
                try {
                    await fetchAPI('/api/groups', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
                    renderDashboard();
                } catch (err) { alert(err.message); }
            }
        });
        container.appendChild(addGroupBtn);
    }
}

let lastMessageCount = 0;
async function startChatPolling() {
    if (messagesPollInterval) clearInterval(messagesPollInterval);
    messagesPollInterval = setInterval(async () => {
        if (!currentGroupId) return;
        try {
            const messages = await fetchAPI(`/api/messages?group_id=${currentGroupId}`);
            renderChatMessages(messages);
        } catch (err) { console.error(err); }
    }, 2000);
}

function renderChatMessages(messages) {
    const msgContainer = document.getElementById('chatMessagesArea');
    if (!msgContainer) return;
    if (!messages || messages.length === 0) {
        msgContainer.innerHTML = '<div class="empty-msg">💬 Nenhuma mensagem ainda. Seja o primeiro a escrever!</div>';
        return;
    }
    msgContainer.innerHTML = '';
    messages.forEach(msg => {
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        const canDelete = (currentUser.role === 'admin') || (msg.author_id === currentUser.id);
        msgDiv.innerHTML = `
            <div class="msg-author">${escapeHtml(msg.author_name)}</div>
            <div class="msg-text">${escapeHtml(msg.text)}</div>
            <div class="msg-time">${timeStr}</div>
            ${canDelete ? `<button class="delete-msg" data-id="${msg.id}"><i class="fas fa-trash-alt"></i></button>` : ''}
        `;
        if (canDelete) {
            msgDiv.querySelector('.delete-msg').addEventListener('click', () => deleteMessage(msg.id));
        }
        msgContainer.appendChild(msgDiv);
    });
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

async function sendChatMessage() {
    const msgInput = document.getElementById('chatMessageInput');
    const text = msgInput.value.trim();
    if (!text) return;
    try {
        await fetchAPI('/api/messages', {
            method: 'POST',
            body: JSON.stringify({ group_id: currentGroupId, text })
        });
        msgInput.value = '';
    } catch (err) { alert('Erro ao enviar: ' + err.message); }
}

async function deleteMessage(msgId) {
    if (!confirm('Apagar esta mensagem?')) return;
    try {
        await fetchAPI(`/api/messages/${msgId}`, { method: 'DELETE' });
    } catch (err) { alert(err.message); }
}

// ==================== ADMIN PANEL ====================
async function openAdminPanel() {
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

    // Carregar usuários e grupos
    const [users, groups] = await Promise.all([
        fetchAPI('/api/users'),
        fetchAPI('/api/groups')
    ]);

    const userListUl = document.getElementById('userListUl');
    userListUl.innerHTML = '';
    for (const user of users) {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${user.name}</strong> (${user.email}) - ${user.role}
            <br>
            <small>Grupo: 
                <select class="user-group-select" data-user-id="${user.id}">
                    <option value="">Nenhum</option>
                    ${groups.map(g => `<option value="${g.id}" ${user.group_id === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
            </small>
        `;
        if (user.role !== 'admin') {
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Excluir';
            deleteBtn.className = 'btn-danger';
            deleteBtn.style.marginLeft = '8px';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Excluir usuário ${user.email}?`)) {
                    // Implementar exclusão de usuário (não implementado no backend ainda)
                    alert('Funcionalidade em desenvolvimento');
                }
            });
            li.appendChild(deleteBtn);
        }
        userListUl.appendChild(li);

        const select = li.querySelector('.user-group-select');
        select.addEventListener('change', async (e) => {
            const newGroupId = e.target.value || null;
            try {
                await fetchAPI(`/api/users/${user.id}/group`, {
                    method: 'PUT',
                    body: JSON.stringify({ group_id: newGroupId })
                });
                alert('Grupo alterado!');
                openAdminPanel(); // recarrega
            } catch (err) { alert(err.message); }
        });
    }

    const groupListUl = document.getElementById('groupListUl');
    groupListUl.innerHTML = '';
    groups.forEach(group => {
        const li = document.createElement('li');
        li.textContent = group.name;
        if (groups.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Excluir';
            deleteBtn.className = 'btn-danger';
            deleteBtn.style.marginLeft = '8px';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`Excluir grupo "${group.name}"?`)) {
                    try {
                        await fetchAPI(`/api/groups/${group.id}`, { method: 'DELETE' });
                        renderDashboard();
                        openAdminPanel();
                    } catch (err) { alert(err.message); }
                }
            });
            li.appendChild(deleteBtn);
        }
        groupListUl.appendChild(li);
    });

    document.getElementById('createUserBtn').addEventListener('click', async () => {
        const email = prompt('E-mail do novo usuário:');
        if (!email) return;
        const name = prompt('Nome completo:');
        if (!name) return;
        const password = prompt('Senha:');
        if (!password) return;
        // Escolher grupo
        if (!groups.length) {
            alert('Crie um grupo primeiro.');
            return;
        }
        const groupId = prompt(`Escolha o grupo (ID):\n${groups.map(g => `${g.id}: ${g.name}`).join('\n')}`);
        if (!groupId) return;
        const selectedGroup = groups.find(g => g.id === groupId);
        if (!selectedGroup) {
            alert('Grupo inválido.');
            return;
        }
        try {
            await fetchAPI('/api/users', {
                method: 'POST',
                body: JSON.stringify({ email, name, password, group_id: groupId })
            });
            alert('Usuário criado com sucesso!');
            openAdminPanel(); // recarrega
        } catch (err) { alert(err.message); }
    });

    document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
        alert('Para resetar senha, edite diretamente no banco ou implemente uma rota específica.');
    });

    document.getElementById('createGroupBtn').addEventListener('click', async () => {
        const name = prompt('Nome do novo grupo:');
        if (name && name.trim()) {
            try {
                await fetchAPI('/api/groups', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
                renderDashboard();
                openAdminPanel();
            } catch (err) { alert(err.message); }
        }
    });

    document.getElementById('deleteGroupBtn').addEventListener('click', async () => {
        if (groups.length <= 1) {
            alert('Não é possível excluir o último grupo.');
            return;
        }
        if (!confirm(`Excluir o grupo atual?`)) return;
        try {
            await fetchAPI(`/api/groups/${currentGroupId}`, { method: 'DELETE' });
            renderDashboard();
            openAdminPanel();
        } catch (err) { alert(err.message); }
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => modal.remove());
}

// ==================== INICIALIZAÇÃO ====================
function init() {
    const token = localStorage.getItem('token');
    if (token) {
        // Tentar decodificar token ou fazer uma requisição para verificar validade
        // Por simplicidade, vamos carregar o dashboard e tratar erros
        renderDashboard().catch(() => {
            localStorage.removeItem('token');
            renderLogin();
        });
    } else {
        renderLogin();
    }
}
init();