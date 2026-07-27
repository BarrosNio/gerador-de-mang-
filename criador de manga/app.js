// app.js - Manga Creator controller

// STATE DEFINITIONS
let state = {
    title: "A Guerra das Sombras Negras",
    author: "Barros",
    pageCount: 50,
    paperType: "premium-cream",
    spineWidth: 0.1250,
    characters: [
        {
            id: "char-1",
            name: "Kenji",
            role: "Protagonista",
            desc: "Cabelo curto espetado, olhos sérios, cachecol longo. Determinado.",
            prompt: "Manga style closeup face sketch of young warrior, spikey hair, scarf, determined",
            avatarColor: "#3b82f6"
        },
        {
            id: "char-2",
            name: "Sombrão",
            role: "Antagonista",
            desc: "Capa escura com capuz, olhos vermelhos brilhantes, aura sombria.",
            prompt: "Manga style shadow villain, dark cloak, glowing eyes, dark fantasy sketch",
            avatarColor: "#ef4444"
        }
    ],
    cover: {
        bgColor: "#0f0f12",
        textColor: "#ffffff",
        synopsis: "Neste incrível mangá, as sombras se levantam para uma batalha colossal que mudará o destino de toda a humanidade. Conseguirão os heróis sobreviver à Guerra das Sombras Negras?",
        prompt: "Manga cover style, epic battle between shadows and neon lights, anime style, highly detailed black and white",
        artImage: null // Base64 data URL
    },
    pages: [
        {
            id: "page-1",
            layout: "3-panel",
            panels: [
                { id: "p1", desc: "Kenji olhando para o horizonte com determinação.", dialog: "O dia da batalha final chegou..." },
                { id: "p2", desc: "Sombrão surgindo por trás das nuvens escuras.", dialog: "Você não pode escapar da escuridão!" },
                { id: "p3", desc: "Os dois se preparando para colidir.", dialog: "VOU TE DERROTAR!" }
            ],
            bubbles: [
                { id: "b1", text: "O dia da batalha final chegou...", x: 45, y: 15 },
                { id: "b2", text: "Você não pode escapar da escuridão!", x: 40, y: 48 }
            ]
        }
    ],
    activePageId: "page-1",
    activeTab: "print-setup",
    api: {
        provider: "mock",
        key: "",
        model: "dall-e-3"
    }
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();
    initTabs();
    initPrintSetup();
    initCharacters();
    initCover();
    initInteriorPages();
    initAPIConfig();
    initIAChat();
    initProjectManager();
    initCloudSync();
    updateSpineWidth();
    renderAll();
});

// STORAGE HELPERS
function saveStateToStorage() {
    localStorage.setItem("kdp_manga_creator_state", JSON.stringify(state));
}

function loadStateFromStorage() {
    const saved = localStorage.getItem("kdp_manga_creator_state");
    if (saved) {
        try {
            state = { ...state, ...JSON.parse(saved) };
            
            // Força a limpeza das chaves de teste inválidas ou antigas do localStorage
            if (state.api && (
                !state.api.key || 
                state.api.key.startsWith("github_pat_") || 
                state.api.key === "sk_vOSHziutWv3j8Z5mKtqJonHKfYWDN0Zb"
            )) {
                state.api = {
                    provider: "mock",
                    key: "",
                    model: "dall-e-3"
                };
                saveStateToStorage();
            }
        } catch (e) {
            console.error("Erro ao carregar estado do localStorage", e);
        }
    }
}

// TAB NAVIGATION SYSTEM
function initTabs() {
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Toggle active buttons
    document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Toggle active panes
    document.querySelectorAll(".tab-pane").forEach(pane => {
        if (pane.id === `tab-${tabId}`) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });

    // Handle preview pane toggle
    updatePreviewSidebar();
}

function updatePreviewSidebar() {
    const placeholder = document.getElementById("preview-placeholder");
    const coverContainer = document.getElementById("preview-cover-container");
    const pageContainer = document.getElementById("preview-page-container");

    placeholder.style.display = "none";
    coverContainer.style.display = "none";
    pageContainer.style.display = "none";

    if (state.activeTab === "print-setup") {
        placeholder.style.display = "flex";
    } else if (state.activeTab === "paperback-cover") {
        coverContainer.style.display = "flex";
        renderCoverCanvas();
    } else if (state.activeTab === "interior-pages") {
        pageContainer.style.display = "flex";
        renderPageCanvas();
    } else if (state.activeTab === "character-library") {
        placeholder.style.display = "flex";
        placeholder.innerHTML = `
            <div class="info-state">
                <svg class="info-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <h3>Personagens: ${state.characters.length}</h3>
                <p style="margin-top: 8px;">Crie e configure o prompt de cada personagem. Quando enviar uma chave de API, a IA usará estes prompts para gerar ilustrações consistentes.</p>
            </div>
        `;
    }
}

// 1. PRINT SETUP SECTION
function initPrintSetup() {
    const titleInput = document.getElementById("series-title");
    const authorInput = document.getElementById("author-name");
    const pageCountInput = document.getElementById("page-count");
    const paperTypeSelect = document.getElementById("paper-type");

    titleInput.addEventListener("input", (e) => {
        state.title = e.target.value;
        saveStateToStorage();
    });

    authorInput.addEventListener("input", (e) => {
        state.author = e.target.value;
        saveStateToStorage();
    });

    pageCountInput.addEventListener("input", (e) => {
        state.pageCount = parseInt(e.target.value) || 24;
        updateSpineWidth();
        saveStateToStorage();
    });

    paperTypeSelect.addEventListener("change", (e) => {
        state.paperType = e.target.value;
        updateSpineWidth();
        saveStateToStorage();
    });
}

function updateSpineWidth() {
    let factor = 0.00225; // Standard White / Black & white factor
    if (state.paperType === "premium-cream") {
        factor = 0.0025; // Cream paper density factor
    } else if (state.paperType === "premium-white") {
        factor = 0.0023; // White premium paper
    }
    
    state.spineWidth = parseFloat((state.pageCount * factor).toFixed(4));
    document.getElementById("spine-width-display").innerText = state.spineWidth.toFixed(4) + '"';
}

// 2. CHARACTER LIBRARY SECTION
function initCharacters() {
    const addBtn = document.getElementById("btn-add-character");
    const charModal = document.getElementById("char-modal");
    const closeBtn = document.getElementById("btn-close-char-modal");
    const cancelBtn = document.getElementById("btn-cancel-char-modal");
    const saveBtn = document.getElementById("btn-save-character");

    addBtn.addEventListener("click", () => {
        openCharacterModal();
    });

    closeBtn.addEventListener("click", () => charModal.classList.remove("active"));
    cancelBtn.addEventListener("click", () => charModal.classList.remove("active"));
    saveBtn.addEventListener("click", saveCharacterForm);
}

function openCharacterModal(charId = null) {
    const modal = document.getElementById("char-modal");
    const title = document.getElementById("char-modal-title");
    
    const idInput = document.getElementById("char-id");
    const nameInput = document.getElementById("char-name");
    const roleSelect = document.getElementById("char-role");
    const descInput = document.getElementById("char-desc");
    const promptInput = document.getElementById("char-prompt");

    if (charId) {
        title.innerText = "Editar Personagem";
        const char = state.characters.find(c => c.id === charId);
        idInput.value = char.id;
        nameInput.value = char.name;
        roleSelect.value = char.role;
        descInput.value = char.desc;
        promptInput.value = char.prompt || "";
    } else {
        title.innerText = "Novo Personagem";
        idInput.value = "";
        nameInput.value = "";
        roleSelect.value = "Protagonista";
        descInput.value = "";
        promptInput.value = "";
    }

    modal.classList.add("active");
}

function saveCharacterForm() {
    const id = document.getElementById("char-id").value;
    const name = document.getElementById("char-name").value.trim();
    const role = document.getElementById("char-role").value;
    const desc = document.getElementById("char-desc").value.trim();
    const prompt = document.getElementById("char-prompt").value.trim();

    if (!name) {
        alert("Digite o nome do personagem.");
        return;
    }

    if (id) {
        // Edit existing
        const index = state.characters.findIndex(c => c.id === id);
        if (index !== -1) {
            state.characters[index] = { ...state.characters[index], name, role, desc, prompt };
        }
    } else {
        // Create new
        const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
        const avatarColor = colors[state.characters.length % colors.length];
        const newChar = {
            id: "char-" + Date.now(),
            name,
            role,
            desc,
            prompt,
            avatarColor
        };
        state.characters.push(newChar);
    }

    saveStateToStorage();
    document.getElementById("char-modal").classList.remove("active");
    renderCharactersList();
}

function renderCharactersList() {
    const container = document.getElementById("characters-list");
    container.innerHTML = "";

    state.characters.forEach(char => {
        const card = document.createElement("div");
        card.className = "character-card";
        const avatarStyle = char.avatarImage 
            ? `background-image: url('${char.avatarImage}'); background-size: cover; background-position: center; background-color: transparent; width: 64px; height: 64px; border-radius: 8px;` 
            : `background-color: ${char.avatarColor}; width: 64px; height: 64px; border-radius: 8px;`;

        card.innerHTML = `
            <div class="char-card-header">
                <div class="char-avatar" style="${avatarStyle}"></div>
                <div class="char-info">
                    <span class="char-name">${char.name}</span>
                    <span class="char-role">${char.role}</span>
                </div>
            </div>
            <p class="char-desc">${char.desc}</p>
            <div class="char-card-actions">
                <button class="char-card-btn btn-generate-char-art" data-id="${char.id}">Gerar Visual</button>
                <button class="char-card-btn btn-edit" data-id="${char.id}">Editar</button>
                <button class="char-card-btn btn-delete-char" style="color: var(--danger)" data-id="${char.id}">Excluir</button>
            </div>
        `;

        card.querySelector(".btn-generate-char-art").addEventListener("click", () => {
            alert(`Gerando visual para o personagem ${char.name}...`);
            const pmt = char.prompt || `Manga style closeup face sketch of character ${char.name}, ${char.desc}`;
            callImageGenerationAPI(pmt, (base64) => {
                char.avatarImage = base64;
                saveStateToStorage();
                renderCharactersList();
            });
        });

        card.querySelector(".btn-edit").addEventListener("click", () => {
            openCharacterModal(char.id);
        });

        card.querySelector(".btn-delete-char").addEventListener("click", () => {
            if (confirm(`Tem certeza que deseja excluir o personagem ${char.name}?`)) {
                state.characters = state.characters.filter(c => c.id !== char.id);
                saveStateToStorage();
                renderCharactersList();
                updatePreviewSidebar();
            }
        });

        container.appendChild(card);
    });
}

// 3. PAPERBACK COVER SECTION
function initCover() {
    const bgColor = document.getElementById("cover-bg-color");
    const textColor = document.getElementById("cover-text-color");
    const coverDesc = document.getElementById("cover-desc");
    const coverPrompt = document.getElementById("cover-prompt");
    const generateBtn = document.getElementById("btn-generate-cover-art");
    const downloadBtn = document.getElementById("btn-download-cover");

    bgColor.addEventListener("input", (e) => {
        state.cover.bgColor = e.target.value;
        saveStateToStorage();
        renderCoverCanvas();
    });

    textColor.addEventListener("input", (e) => {
        state.cover.textColor = e.target.value;
        saveStateToStorage();
        renderCoverCanvas();
    });

    coverDesc.addEventListener("input", (e) => {
        state.cover.synopsis = e.target.value;
        saveStateToStorage();
        renderCoverCanvas();
    });

    coverPrompt.addEventListener("input", (e) => {
        state.cover.prompt = e.target.value;
        saveStateToStorage();
    });

    generateBtn.addEventListener("click", () => {
        generateCoverArtIA();
    });

    downloadBtn.addEventListener("click", () => {
        const canvas = document.getElementById("cover-canvas");
        const link = document.createElement("a");
        link.download = `${state.title.toLowerCase().replace(/ /g, "_")}_cover.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

function generateCoverArtIA() {
    if (state.api.key) {
        alert("Conectando com a API Key para gerar a capa de alta qualidade...");
        // This is a hook point for the actual API call
        callImageGenerationAPI(state.cover.prompt, (base64) => {
            state.cover.artImage = base64;
            saveStateToStorage();
            renderCoverCanvas();
        });
    } else {
        alert("Gerando arte simulada estilo mangá para capa...");
        // Draw a simulated canvas scene and save as base64
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 400;
        tempCanvas.height = 600;
        const ctx = tempCanvas.getContext("2d");
        
        ctx.fillStyle = state.cover.bgColor;
        ctx.fillRect(0, 0, 400, 600);

        // draw dramatic background lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) {
            ctx.beginPath();
            ctx.moveTo(200, 300);
            const angle = (i / 40) * Math.PI * 2;
            ctx.lineTo(200 + Math.cos(angle) * 400, 300 + Math.sin(angle) * 400);
            ctx.stroke();
        }

        // Title and author on cover preview
        ctx.fillStyle = state.cover.textColor;
        ctx.textAlign = "center";
        ctx.font = "bold 32px Outfit";
        ctx.fillText(state.title, 200, 150);
        
        ctx.font = "20px Outfit";
        ctx.fillText(state.author, 200, 200);

        // Draw character faces representation
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(200, 400, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 14px Outfit";
        ctx.fillStyle = "white";
        ctx.fillText("MANGA COVER ART", 200, 405);

        state.cover.artImage = tempCanvas.toDataURL();
        saveStateToStorage();
        renderCoverCanvas();
    }
}

function renderCoverCanvas() {
    const canvas = document.getElementById("cover-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // KDP layout: Spine width is relative. Let's say spine width is scaled
    const spinePx = Math.max(30, state.spineWidth * 250); // Scale factor
    const coverSideW = (w - spinePx) / 2;

    // 1. Draw Back Cover (Left Side)
    ctx.fillStyle = state.cover.bgColor;
    ctx.fillRect(0, 0, coverSideW, h);

    // 2. Draw Front Cover (Right Side)
    ctx.fillRect(coverSideW + spinePx, 0, coverSideW, h);

    // 3. Draw Spine (Middle)
    ctx.fillStyle = adjustColorBrightness(state.cover.bgColor, -20);
    ctx.fillRect(coverSideW, 0, spinePx, h);

    // Draw borders / guidelines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(coverSideW, 0);
    ctx.lineTo(coverSideW, h);
    ctx.moveTo(coverSideW + spinePx, 0);
    ctx.lineTo(coverSideW + spinePx, h);
    ctx.stroke();

    // Render Front Cover Text / Art
    if (state.cover.artImage) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, coverSideW + spinePx, 0, coverSideW, h);
            drawCoverLabels();
        };
        img.src = state.cover.artImage;
    } else {
        // Default text-based cover front layout
        ctx.fillStyle = state.cover.textColor;
        ctx.textAlign = "center";
        ctx.font = "bold 18px Outfit";
        ctx.fillText(state.title, coverSideW + spinePx + (coverSideW / 2), 100);
        
        ctx.font = "12px Outfit";
        ctx.fillText(state.author, coverSideW + spinePx + (coverSideW / 2), 140);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(coverSideW + spinePx + 20, 180, coverSideW - 40, 180);
        ctx.fillStyle = state.cover.textColor;
        ctx.font = "11px Outfit";
        ctx.fillText("[Espaço da Arte Frontal]", coverSideW + spinePx + (coverSideW / 2), 270);
        drawCoverLabels();
    }

    function drawCoverLabels() {
        // Draw Back Cover Text
        ctx.fillStyle = state.cover.textColor;
        ctx.textAlign = "left";
        ctx.font = "11px Outfit";
        wrapText(ctx, state.cover.synopsis, 20, 100, coverSideW - 40, 16);

        // Draw Spine Text (Rotated 90 degrees)
        ctx.save();
        ctx.translate(coverSideW + (spinePx / 2), h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = state.cover.textColor;
        ctx.font = "bold 12px Outfit";
        ctx.fillText(state.title, 0, 4);
        ctx.restore();

        // Print technical guidelines labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "9px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("CONTRACAPA", coverSideW / 2, h - 20);
        ctx.fillText("LOMBADA", coverSideW + (spinePx / 2), h - 20);
        ctx.fillText("CAPA FRONTAL", coverSideW + spinePx + (coverSideW / 2), h - 20);
    }
}

// Helper to wrap text inside canvas
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';

    for(var n = 0; n < words.length; n++) {
        var testLine = line + words[n] + ' ';
        var metrics = context.measureText(testLine);
        var testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        }
        else {
            line = testLine;
        }
    }
    context.fillText(line, x, y);
}

// 4. INTERIOR PAGES WORKSPACE
function initInteriorPages() {
    const addPageBtn = document.getElementById("btn-add-page");
    const deletePageBtn = document.getElementById("btn-delete-page");
    const addBubbleBtn = document.getElementById("btn-add-speech-bubble");
    const generateArtBtn = document.getElementById("btn-generate-page-art");
    const exportPageImgBtn = document.getElementById("btn-export-page-image");

    addPageBtn.addEventListener("click", () => {
        const newPageId = `page-${Date.now()}`;
        const newPage = {
            id: newPageId,
            layout: "1-panel",
            panels: [{ id: "p1", desc: "Esboço inicial", dialog: "" }],
            bubbles: []
        };
        state.pages.push(newPage);
        state.activePageId = newPageId;
        saveStateToStorage();
        renderInteriorPagesGrid();
        renderPageEditor();
        renderPageCanvas();
    });

    deletePageBtn.addEventListener("click", () => {
        if (state.pages.length <= 1) {
            alert("Você precisa manter pelo menos uma página no seu livro.");
            return;
        }
        if (confirm("Deseja realmente excluir esta página?")) {
            state.pages = state.pages.filter(p => p.id !== state.activePageId);
            state.activePageId = state.pages[0].id;
            saveStateToStorage();
            renderInteriorPagesGrid();
            renderPageEditor();
            renderPageCanvas();
        }
    });

    addBubbleBtn.addEventListener("click", () => {
        const activePage = state.pages.find(p => p.id === state.activePageId);
        if (activePage) {
            activePage.bubbles.push({
                id: `b-${Date.now()}`,
                text: "DIÁLOGO...",
                x: 40,
                y: 40
            });
            saveStateToStorage();
            renderPageCanvas();
        }
    });

    generateArtBtn.addEventListener("click", () => {
        generatePageSketchesIA();
    });

    exportPageImgBtn.addEventListener("click", () => {
        const canvas = document.getElementById("page-canvas");
        const link = document.createElement("a");
        link.download = `manga_page_${state.activePageId}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });

    // Layout selectors listeners
    document.querySelectorAll(".layout-selector-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const layout = btn.getAttribute("data-layout");
            setPageLayout(layout);
        });
    });
}

function setPageLayout(layout) {
    const activePage = state.pages.find(p => p.id === state.activePageId);
    if (!activePage) return;

    activePage.layout = layout;

    // Reset panels array depending on panels count
    let count = 1;
    if (layout === "2-panel-h") count = 2;
    else if (layout === "3-panel") count = 3;
    else if (layout === "4-panel-grid") count = 4;
    else if (layout === "manga-style-a") count = 5;
    else if (layout === "manga-style-b") count = 4;

    activePage.panels = [];
    for (let i = 0; i < count; i++) {
        activePage.panels.push({
            id: `p${i+1}`,
            desc: `Cena do painel ${i+1}`,
            dialog: ""
        });
    }

    saveStateToStorage();
    renderPageEditor();
    renderPageCanvas();
}

function renderInteriorPagesGrid() {
    const container = document.getElementById("pages-thumbnails");
    container.innerHTML = "";

    state.pages.forEach((page, index) => {
        const thumb = document.createElement("div");
        thumb.className = `page-thumb ${page.id === state.activePageId ? 'active' : ''}`;
        thumb.innerHTML = `
            <span>Página ${index + 1}</span>
            <div class="page-thumb-num">${index + 1}</div>
        `;
        thumb.addEventListener("click", () => {
            state.activePageId = page.id;
            saveStateToStorage();
            
            // Toggle active visual
            document.querySelectorAll(".page-thumb").forEach(t => t.classList.remove("active"));
            thumb.classList.add("active");

            renderPageEditor();
            renderPageCanvas();
        });
        container.appendChild(thumb);
    });
}

function renderPageEditor() {
    const editor = document.getElementById("page-editor");
    const activePage = state.pages.find(p => p.id === state.activePageId);
    
    if (!activePage) {
        editor.style.display = "none";
        return;
    }
    
    editor.style.display = "block";

    const index = state.pages.findIndex(p => p.id === state.activePageId);
    document.getElementById("current-page-title").innerText = `Editando Página ${index + 1}`;

    // Update active layout button
    document.querySelectorAll(".layout-selector-btn").forEach(btn => {
        if (btn.getAttribute("data-layout") === activePage.layout) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Populate panels settings inputs
    const panelsContainer = document.getElementById("panels-settings-container");
    panelsContainer.innerHTML = "";

    activePage.panels.forEach((panel, i) => {
        const card = document.createElement("div");
        card.className = "panel-input-card";
        card.innerHTML = `
            <h4>Quadro ${i + 1}</h4>
            <div class="form-group">
                <label>Descrição Visual do Quadro</label>
                <input type="text" class="panel-desc-input" data-index="${i}" value="${panel.desc || ''}" placeholder="Ex: Kenji empunhando a espada...">
            </div>
            <div class="form-group">
                <label>Diálogo / Texto principal</label>
                <input type="text" class="panel-dialog-input" data-index="${i}" value="${panel.dialog || ''}" placeholder="Ex: Prepare-se!">
            </div>
        `;

        // Listeners for panel updates
        card.querySelector(".panel-desc-input").addEventListener("input", (e) => {
            activePage.panels[i].desc = e.target.value;
            saveStateToStorage();
            renderPageCanvas();
        });

        card.querySelector(".panel-dialog-input").addEventListener("input", (e) => {
            activePage.panels[i].dialog = e.target.value;
            saveStateToStorage();
            renderPageCanvas();
        });

        panelsContainer.appendChild(card);
    });
}

function generatePageSketchesIA() {
    if (state.api.key) {
        alert("Gerando artes estilizadas para os quadros via IA...");
        // Here we would iterate through panels, generate and draw them
    } else {
        alert("Simulando esboços rápidos de mangá...");
        // Redraw will draw simulated sketches anyway, so just trigger a re-render
        renderPageCanvas();
    }
}

function renderPageCanvas() {
    const canvas = document.getElementById("page-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // Reset Canvas background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const activePage = state.pages.find(p => p.id === state.activePageId);
    if (!activePage) return;

    // Draw manga page borders (bleed margin)
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Draw panels depending on layout
    const layout = activePage.layout;
    let panelAreas = [];

    if (layout === "1-panel") {
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: w - 40, h: h - 40 });
    } else if (layout === "2-panel-h") {
        const pH = (h - 50) / 2;
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: w - 40, h: pH });
        panelAreas.push({ isPolygon: false, x: 20, y: 30 + pH, w: w - 40, h: pH });
    } else if (layout === "3-panel") {
        const pH = (h - 60) / 3;
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: w - 40, h: pH });
        panelAreas.push({ isPolygon: false, x: 20, y: 30 + pH, w: w - 40, h: pH });
        panelAreas.push({ isPolygon: false, x: 20, y: 40 + (pH * 2), w: w - 40, h: pH });
    } else if (layout === "4-panel-grid") {
        const pW = (w - 50) / 2;
        const pH = (h - 50) / 2;
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: pW, h: pH });
        panelAreas.push({ isPolygon: false, x: 30 + pW, y: 20, w: pW, h: pH });
        panelAreas.push({ isPolygon: false, x: 20, y: 30 + pH, w: pW, h: pH });
        panelAreas.push({ isPolygon: false, x: 30 + pW, y: 30 + pH, w: pW, h: pH });
    } else if (layout === "manga-style-a") {
        const rowH = (h - 60) / 3;
        const pW1 = (w - 50) * 0.6;
        const pW2 = (w - 50) * 0.4;
        
        // Row 1
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: pW1, h: rowH });
        panelAreas.push({ isPolygon: false, x: 30 + pW1, y: 20, w: pW2, h: rowH });
        // Row 2
        panelAreas.push({ isPolygon: false, x: 20, y: 30 + rowH, w: w - 40, h: rowH });
        // Row 3 (dynamic slant divider)
        const slantTopX = w * 0.52;
        const slantBottomX = w * 0.38;
        const yTop = 40 + rowH * 2;
        const yBottom = h - 20;
        
        panelAreas.push({
            isPolygon: true,
            points: [
                { x: 20, y: yTop },
                { x: slantTopX - 5, y: yTop },
                { x: slantBottomX - 5, y: yBottom },
                { x: 20, y: yBottom }
            ],
            x: 20, y: yTop, w: (slantTopX + slantBottomX) / 2 - 20, h: rowH
        });
        panelAreas.push({
            isPolygon: true,
            points: [
                { x: slantTopX + 5, y: yTop },
                { x: w - 20, y: yTop },
                { x: w - 20, y: yBottom },
                { x: slantBottomX + 5, y: yBottom }
            ],
            x: (slantTopX + slantBottomX) / 2 + 10, y: yTop, w: w - 20 - ((slantTopX + slantBottomX) / 2), h: rowH
        });
    } else if (layout === "manga-style-b") {
        const colW = (w - 50) / 2;
        const ySplitLeft = h * 0.55;
        const ySplitRight = h * 0.45;
        
        // Left Column
        panelAreas.push({ isPolygon: false, x: 20, y: 20, w: colW, h: ySplitLeft - 25 });
        panelAreas.push({ isPolygon: false, x: 20, y: ySplitLeft - 15, w: colW, h: h - 20 - (ySplitLeft - 15) });
        // Right Column
        panelAreas.push({ isPolygon: false, x: 30 + colW, y: 20, w: colW, h: ySplitRight - 25 });
        panelAreas.push({ isPolygon: false, x: 30 + colW, y: ySplitRight - 15, w: colW, h: h - 20 - (ySplitRight - 15) });
    }

    // Render Panel Sketches inside each area
    panelAreas.forEach((area, i) => {
        ctx.beginPath();
        if (area.isPolygon) {
            ctx.moveTo(area.points[0].x, area.points[0].y);
            for (let j = 1; j < area.points.length; j++) {
                ctx.lineTo(area.points[j].x, area.points[j].y);
            }
            ctx.closePath();
        } else {
            ctx.rect(area.x, area.y, area.w, area.h);
        }
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.stroke();

        drawPanelSketch(ctx, area, activePage.panels[i] || { desc: "Esboço" }, i + 1);
    });

    // Render Interactive overlay speech bubbles
    renderSpeechBubblesOverlay(activePage);
}

// Draw cool manga sketches dynamically inside canvas area
function drawPanelSketch(ctx, area, panelData, panelNum) {
    ctx.save();
    // Clip drawing inside the panel to prevent bleeding
    ctx.beginPath();
    if (area.isPolygon) {
        ctx.moveTo(area.points[0].x, area.points[0].y);
        for (let j = 1; j < area.points.length; j++) {
            ctx.lineTo(area.points[j].x, area.points[j].y);
        }
        ctx.closePath();
    } else {
        ctx.rect(area.x, area.y, area.w, area.h);
    }
    ctx.clip();

    // Draw speed lines or dramatic action lines
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        const angle = (i / 30) * Math.PI * 2;
        ctx.moveTo(area.x + area.w / 2, area.y + area.h / 2);
        ctx.lineTo(area.x + area.w / 2 + Math.cos(angle) * area.w, area.y + area.h / 2 + Math.sin(angle) * area.h);
        ctx.stroke();
    }

    // Panel index indicator (small box in corner)
    ctx.fillStyle = "#000";
    ctx.fillRect(area.x, area.y, 22, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px monospace";
    ctx.fillText(panelNum, area.x + 8, area.y + 13);

    // Sketch rendering based on panel description keywords
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;

    const desc = (panelData.desc || "").toLowerCase();
    
    // Draw characters face or action sketch
    if (desc.includes("kenji")) {
        // Draw Kenji sketch (hero)
        drawHeroSketch(ctx, area.x + area.w / 2, area.y + area.h / 2 + 10, Math.min(area.w, area.h) * 0.3);
    } else if (desc.includes("sombra") || desc.includes("vilao") || desc.includes("sombrão")) {
        // Draw Villain sketch
        drawVillainSketch(ctx, area.x + area.w / 2, area.y + area.h / 2 + 10, Math.min(area.w, area.h) * 0.3);
    } else {
        // Default scene placeholder drawing
        ctx.fillStyle = "#f4f4f5";
        ctx.fillRect(area.x + 10, area.y + 10, area.w - 20, area.h - 20);
        ctx.fillStyle = "#71717a";
        ctx.textAlign = "center";
        ctx.font = "italic 11px Outfit";
        wrapText(ctx, panelData.desc || "[Escreva uma descrição do quadro no painel esquerdo]", area.x + area.w / 2, area.y + area.h / 2, area.w - 20, 16);
    }

    ctx.restore();
}

function drawHeroSketch(ctx, cx, cy, r) {
    // Face outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();

    // Spikey hair lines
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.4);
    ctx.lineTo(cx - r * 1.2, cy - r * 0.8);
    ctx.lineTo(cx - r * 0.7, cy - r * 0.8);
    ctx.lineTo(cx - r * 0.5, cy - r * 1.3);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.9);
    ctx.lineTo(cx, cy - r * 1.4);
    ctx.lineTo(cx + r * 0.2, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.5, cy - r * 1.3);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.8);
    ctx.lineTo(cx + r * 1.2, cy - r * 0.8);
    ctx.lineTo(cx + r, cy - r * 0.4);
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.3, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows (angry/determined)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.3);
    ctx.lineTo(cx - r * 0.1, cy - r * 0.15);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.1, cy - r * 0.15);
    ctx.stroke();

    // Scarf
    ctx.lineWidth = 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - r * 0.8, cy + r * 0.8, r * 1.6, r * 0.4);
}

function drawVillainSketch(ctx, cx, cy, r) {
    // Face shadow circle
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Red glowing eyes
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.1, r * 0.15, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.3, cy - r * 0.1, r * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Evil smile
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.3, r * 0.4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
}

function renderSpeechBubblesOverlay(page) {
    const overlay = document.getElementById("speech-bubbles-overlay");
    overlay.innerHTML = "";

    page.bubbles.forEach((bubble) => {
        const div = document.createElement("div");
        div.className = "speech-bubble-item";
        div.innerText = bubble.text;
        div.style.left = `${bubble.x}%`;
        div.style.top = `${bubble.y}%`;

        // Make Bubble draggable
        let isDragging = false;
        let startX, startY;

        div.addEventListener("mousedown", (e) => {
            isDragging = true;
            startX = e.clientX - div.offsetLeft;
            startY = e.clientY - div.offsetTop;
            document.querySelectorAll(".speech-bubble-item").forEach(b => b.classList.remove("selected"));
            div.classList.add("selected");
            e.stopPropagation();
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const overlayRect = overlay.getBoundingClientRect();
            
            let xPx = e.clientX - startX - overlayRect.left;
            let yPx = e.clientY - startY - overlayRect.top;

            // Convert to percentage
            let xPct = (xPx / overlayRect.width) * 100;
            let yPct = (yPx / overlayRect.height) * 100;

            // Bounds
            xPct = Math.max(0, Math.min(90, xPct));
            yPct = Math.max(0, Math.min(90, yPct));

            bubble.x = parseFloat(xPct.toFixed(2));
            bubble.y = parseFloat(yPct.toFixed(2));

            div.style.left = `${bubble.x}%`;
            div.style.top = `${bubble.y}%`;
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                saveStateToStorage();
            }
        });

        // Double click to edit dialog content or delete
        div.addEventListener("dblclick", () => {
            const newText = prompt("Edite o diálogo do balão (Deixe em branco para deletar):", bubble.text);
            if (newText === null) return;
            
            if (newText.trim() === "") {
                page.bubbles = page.bubbles.filter(b => b.id !== bubble.id);
            } else {
                bubble.text = newText;
            }
            saveStateToStorage();
            renderPageCanvas();
        });

        overlay.appendChild(div);
    });
}

// 5. API CONFIGURATION MODAL
function initAPIConfig() {
    const btnOpen = document.getElementById("btn-api-key");
    const modal = document.getElementById("api-modal");
    const btnClose = document.getElementById("btn-close-modal");
    const btnCancel = document.getElementById("btn-cancel-modal");
    const btnSave = document.getElementById("btn-save-modal");

    const providerSelect = document.getElementById("api-provider");
    const keyInput = document.getElementById("api-key-input");
    const modelInput = document.getElementById("api-model");
    const statusMsg = document.getElementById("api-status-msg");

    btnOpen.addEventListener("click", () => {
        // Load API state into inputs
        providerSelect.value = state.api.provider || "mock";
        keyInput.value = state.api.key || "";
        modelInput.value = state.api.model || "imagen-3.0-generate-002";
        updateAPIStatusLabel();
        modal.classList.add("active");
    });

    btnClose.addEventListener("click", () => modal.classList.remove("active"));
    btnCancel.addEventListener("click", () => modal.classList.remove("active"));

    btnSave.addEventListener("click", () => {
        state.api.provider = providerSelect.value;
        state.api.key = keyInput.value.trim();
        state.api.model = modelInput.value.trim();
        
        saveStateToStorage();
        modal.classList.remove("active");
        
        // Update label or indicator
        if (state.api.key) {
            alert("Chave de API salva com sucesso! O aplicativo está pronto para fazer chamadas de IA.");
        } else {
            alert("Configurações atualizadas para o modo Simulado.");
        }
    });

    providerSelect.addEventListener("change", () => {
        updateAPIStatusLabel();
    });

    function updateAPIStatusLabel() {
        const prov = providerSelect.value;
        if (prov === "mock") {
            statusMsg.innerText = "Usando Gerador Interno Simulado (Sem chave de API necessária).";
        } else if (prov === "gemini") {
            statusMsg.innerText = "Requer uma chave de API do Google AI Studio para chamar o Imagen.";
        } else if (prov === "openai") {
            statusMsg.innerText = "Requer uma chave de API da OpenAI para chamar o DALL-E 3.";
        } else if (prov === "omniroute") {
            statusMsg.innerText = "Conectado ao OmniRoute AI Gateway (https://omniroute.online). Requer chave de acesso.";
        }
    }
}

// 6. ACTION BUILD KDP BUNDLE & EXPORTS
document.getElementById("btn-build-bundle").addEventListener("click", () => {
    // Collect bundle data and generate package manifest
    const manifest = {
        meta: {
            title: state.title,
            author: state.author,
            pagesTotal: state.pageCount,
            paperType: state.paperType,
            spineWidthInches: state.spineWidth,
            createdAt: new Date().toISOString()
        },
        characters: state.characters,
        cover: state.cover,
        pages: state.pages
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `KDP_Bundle_${state.title.replace(/ /g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert("Pronto! Pacote de Manuscrito e Metadados do KDP exportado com sucesso como JSON.");
});

// OFFICIAL OPENAI API IMAGE GENERATION CONNECTOR
function callImageGenerationAPI(prompt, callback) {
    console.log(`Chamando API oficial da OpenAI para gerar imagem. Prompt: "${prompt}"`);
    
    if (state.api.key) {
        const apiKey = state.api.key;
        
        fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: state.api.model || "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro na API OpenAI: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.data && data.data[0]) {
                let base64 = data.data[0].b64_json;
                if (!base64.startsWith("data:image")) {
                    base64 = "data:image/png;base64," + base64;
                }
                callback(base64);
            } else {
                throw new Error("Formato de resposta OpenAI inválido.");
            }
        })
        .catch(err => {
            console.error("Erro na OpenAI API:", err);
            alert(`Falha OpenAI: ${err.message}. Usando visual de rascunho de contingência.`);
            generateMockImage(prompt, callback);
        });
    } else {
        generateMockImage(prompt, callback);
    }
}

function generateMockImage(prompt, callback) {
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 400;
    testCanvas.height = 600;
    const ctx = testCanvas.getContext("2d");
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 600);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, 400, 600);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace";
    ctx.fillText("IA GENERATED ART", 200, 100);

    ctx.lineWidth = 2;
    for (let i = 0; i < 180; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 200);
        ctx.lineTo(200, 300);
        ctx.stroke();
    }

    ctx.font = "italic 12px monospace";
    wrapText(ctx, `Prompt: "${prompt}"`, 200, 480, 360, 18);

    callback(testCanvas.toDataURL());
}

// COLOR ADJUSTER HELPER
function adjustColorBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt((R * (100 + percent)) / 100);
    G = parseInt((G * (100 + percent)) / 100);
    B = parseInt((B * (100 + percent)) / 100);

    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;

    R = R > 0 ? R : 0;
    G = G > 0 ? G : 0;
    B = B > 0 ? B : 0;

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}

// MAIN RENDER TRIGGER
function renderAll() {
    renderCharactersList();
    renderInteriorPagesGrid();
    renderPageEditor();
    updatePreviewSidebar();
}

// 7. IA COLLABORATIVE CHAT & IMAGE REFERENCES
let coverAttachmentBase64 = null;
let pageAttachmentBase64 = null;

function initIAChat() {
    // COVER CHAT
    const coverFileInput = document.getElementById("cover-chat-file");
    const coverPreview = document.getElementById("cover-attachment-preview");
    const coverSendBtn = document.getElementById("btn-cover-chat-send");
    const coverInput = document.getElementById("cover-chat-input");
    const coverHistory = document.getElementById("cover-chat-history");

    coverFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                coverAttachmentBase64 = event.target.result;
                coverPreview.style.display = "flex";
                coverPreview.innerHTML = `
                    <div class="preview-thumb" style="background-image: url('${coverAttachmentBase64}')"></div>
                    <div class="preview-info">
                        <span style="font-weight: 600;">Referência anexada</span>
                        <span>${file.name.substring(0, 15)}...</span>
                    </div>
                    <button class="preview-remove" id="btn-remove-cover-attachment">Remover</button>
                `;
                document.getElementById("btn-remove-cover-attachment").addEventListener("click", () => {
                    coverAttachmentBase64 = null;
                    coverPreview.style.display = "none";
                    coverFileInput.value = "";
                });
            };
            reader.readAsDataURL(file);
        }
    });

    coverSendBtn.addEventListener("click", () => {
        const msgText = coverInput.value.trim();
        if (!msgText && !coverAttachmentBase64) return;

        // User Message Bubble
        const userMsg = document.createElement("div");
        userMsg.className = "chat-message user";
        if (coverAttachmentBase64) {
            userMsg.innerHTML = `
                <div class="preview-thumb" style="background-image: url('${coverAttachmentBase64}'); width: 80px; height: 120px; border-radius: 4px; margin-bottom: 5px; background-size: cover; background-position: center;"></div>
                <div>${msgText || "Imagem de referência enviada."}</div>
            `;
        } else {
            userMsg.innerText = msgText;
        }
        coverHistory.appendChild(userMsg);
        coverHistory.scrollTop = coverHistory.scrollHeight;

        const originalMsgText = msgText;
        coverInput.value = "";
        const originalAttachment = coverAttachmentBase64;
        coverAttachmentBase64 = null;
        coverPreview.style.display = "none";
        coverFileInput.value = "";

        // Simulated AI Response
        setTimeout(() => {
            const aiMsg = document.createElement("div");
            aiMsg.className = "chat-message ai";
            aiMsg.innerText = "Recebido! Analisei sua instrução de design e a imagem de referência fornecida. Estou gerando uma versão da capa com esse estilo...";
            coverHistory.appendChild(aiMsg);
            coverHistory.scrollTop = coverHistory.scrollHeight;

            if (originalMsgText) {
                const promptInput = document.getElementById("cover-prompt");
                promptInput.value = `Manga cover, ${originalMsgText}, highly detailed anime lineart, black and white screentone`;
                state.cover.prompt = promptInput.value;
                saveStateToStorage();
            }

            // Redraw with style
            if (originalAttachment) {
                state.cover.artImage = originalAttachment;
                saveStateToStorage();
                renderCoverCanvas();
            } else {
                generateCoverArtIA();
            }
        }, 1200);
    });

    // PAGE / PANELS CHAT
    const pageFileInput = document.getElementById("page-chat-file");
    const pagePreview = document.getElementById("page-attachment-preview");
    const pageSendBtn = document.getElementById("btn-page-chat-send");
    const pageInput = document.getElementById("page-chat-input");
    const pageHistory = document.getElementById("page-chat-history");

    pageFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                pageAttachmentBase64 = event.target.result;
                pagePreview.style.display = "flex";
                pagePreview.innerHTML = `
                    <div class="preview-thumb" style="background-image: url('${pageAttachmentBase64}')"></div>
                    <div class="preview-info">
                        <span style="font-weight: 600;">Referência anexada</span>
                        <span>${file.name.substring(0, 15)}...</span>
                    </div>
                    <button class="preview-remove" id="btn-remove-page-attachment">Remover</button>
                `;
                document.getElementById("btn-remove-page-attachment").addEventListener("click", () => {
                    pageAttachmentBase64 = null;
                    pagePreview.style.display = "none";
                    pageFileInput.value = "";
                });
            };
            reader.readAsDataURL(file);
        }
    });

    pageSendBtn.addEventListener("click", () => {
        const msgText = pageInput.value.trim();
        if (!msgText && !pageAttachmentBase64) return;

        // User Message Bubble
        const userMsg = document.createElement("div");
        userMsg.className = "chat-message user";
        if (pageAttachmentBase64) {
            userMsg.innerHTML = `
                <div class="preview-thumb" style="background-image: url('${pageAttachmentBase64}'); width: 80px; height: 120px; border-radius: 4px; margin-bottom: 5px; background-size: cover; background-position: center;"></div>
                <div>${msgText || "Imagem de referência de pose/cena enviada."}</div>
            `;
        } else {
            userMsg.innerText = msgText;
        }
        pageHistory.appendChild(userMsg);
        pageHistory.scrollTop = pageHistory.scrollHeight;

        const originalMsgText = msgText;
        const originalAttachment = pageAttachmentBase64;
        pageInput.value = "";
        pageAttachmentBase64 = null;
        pagePreview.style.display = "none";
        pageFileInput.value = "";

        // Simulated AI Response
        setTimeout(() => {
            const aiMsg = document.createElement("div");
            aiMsg.className = "chat-message ai";
            aiMsg.innerText = "Entendido! Poses e visual assimilados da referência. Estou aplicando a estilização de esboços clássicos de mangá nos quadros ativos da página...";
            pageHistory.appendChild(aiMsg);
            pageHistory.scrollTop = pageHistory.scrollHeight;

            const activePage = state.pages.find(p => p.id === state.activePageId);
            if (activePage && originalMsgText) {
                // Apply guidelines to panel descriptions
                activePage.panels.forEach((panel, i) => {
                    panel.desc = `Quadro ${i+1}: ${originalMsgText} (Ref: Pose adaptada)`;
                });
                saveStateToStorage();
                renderPageEditor();
                renderPageCanvas();
            }
        }, 1200);
    });
}

// 8. MULTI-PROJECT MANAGER (NAMED PROJECTS)
function initProjectManager() {
    const saveBtn = document.getElementById("btn-save-project-local");
    const nameInput = document.getElementById("project-save-name");
    const selectDropdown = document.getElementById("select-saved-projects");

    // Populate dropdown on load
    updateSavedProjectsDropdown();

    // Save Button listener
    saveBtn.addEventListener("click", () => {
        const projName = nameInput.value.trim();
        if (!projName) {
            alert("Por favor, insira um nome para identificar o seu projeto.");
            return;
        }

        // Save current state with prefix
        const projectKey = `kdp_manga_project_${projName}`;
        localStorage.setItem(projectKey, JSON.stringify(state));
        
        alert(`Projeto "${projName}" salvo com sucesso no navegador!`);
        updateSavedProjectsDropdown();
    });

    // Dropdown selection change listener
    selectDropdown.addEventListener("change", (e) => {
        const selectedKey = e.target.value;
        if (!selectedKey) return;

        const savedData = localStorage.getItem(selectedKey);
        if (savedData) {
            try {
                const loadedState = JSON.parse(savedData);
                // Override state
                state = { ...state, ...loadedState };
                
                // Update save name input to match loaded project name
                const projName = selectedKey.replace("kdp_manga_project_", "");
                nameInput.value = projName;
                document.getElementById("series-title").value = state.title || "";
                document.getElementById("author-name").value = state.author || "";
                document.getElementById("page-count").value = state.pageCount || 50;
                document.getElementById("paper-type").value = state.paperType || "premium-cream";

                // Save to active state and reload views
                saveStateToStorage();
                updateSpineWidth();
                renderAll();
                
                alert(`Projeto "${projName}" carregado com sucesso!`);
            } catch (err) {
                console.error("Erro ao carregar projeto:", err);
                alert("Falha ao carregar os dados do projeto selecionado.");
            }
        }
    });

    function updateSavedProjectsDropdown() {
        // Clear all except first option
        selectDropdown.innerHTML = '<option value="">-- Carregar Projeto --</option>';

        // Scan localStorage for keys with prefix
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith("kdp_manga_project_")) {
                const projectName = key.replace("kdp_manga_project_", "");
                const opt = document.createElement("option");
                opt.value = key;
                opt.innerText = projectName;
                
                // Keep selected if currently active save name matches
                if (projectName === nameInput.value) {
                    opt.selected = true;
                }
                
                selectDropdown.appendChild(opt);
            }
        }
    }
}

// 9. CLOUD SYNC MANAGER (CROSS-DEVICE SYNC)
function initCloudSync() {
    const syncCodeInput = document.getElementById("project-sync-code");
    const syncToBtn = document.getElementById("btn-sync-to-cloud");
    const selectDropdown = document.getElementById("select-cloud-projects");
    const refreshBtn = document.getElementById("btn-refresh-cloud-list");
    
    // KVDB Public bucket endpoint for KDP Manga Creator
    const BUCKET_URL = "https://kvdb.io/K9QxZpQy1hS244B2796k4a";

    // Generate or load sync code
    let syncCode = localStorage.getItem("kdp_manga_sync_code");
    if (!syncCode) {
        // Generate random 6-character code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "KDP-";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        syncCode = code;
        localStorage.setItem("kdp_manga_sync_code", syncCode);
    }
    syncCodeInput.value = syncCode;

    // Load initial list from cloud
    updateCloudProjectsDropdown();

    // Listen to manual code edits
    syncCodeInput.addEventListener("change", (e) => {
        syncCode = e.target.value.trim().toUpperCase();
        localStorage.setItem("kdp_manga_sync_code", syncCode);
        updateCloudProjectsDropdown();
    });

    // Refresh button
    refreshBtn.addEventListener("click", () => {
        updateCloudProjectsDropdown();
    });

    // Upload to Cloud
    syncToBtn.addEventListener("click", () => {
        const projName = document.getElementById("project-save-name").value.trim() || "Meu_Projeto_Manga";
        const formattedProjName = projName.replace(/ /g, "_");
        const code = syncCodeInput.value.trim().toUpperCase();
        
        if (!code) {
            alert("Insira ou gere um código de sincronização.");
            return;
        }

        syncToBtn.disabled = true;
        syncToBtn.innerText = "Enviando...";

        fetch(`${BUCKET_URL}/${code}_${formattedProjName}`, {
            method: "POST", // POST / PUT saves value in kvdb.io
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(state)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Erro na resposta do servidor.");
            }
            alert(`Projeto "${projName}" enviado para a nuvem sob o código "${code}"!`);
            updateCloudProjectsDropdown();
        })
        .catch(err => {
            console.error("Erro no Cloud Sync Upload:", err);
            alert("Falha ao salvar na nuvem. Verifique sua conexão.");
        })
        .finally(() => {
            syncToBtn.disabled = false;
            syncToBtn.innerText = "Salvar na Nuvem";
        });
    });

    // Download/Load Selected from Cloud
    selectDropdown.addEventListener("change", (e) => {
        const selectedKey = e.target.value;
        if (!selectedKey) return;

        const code = syncCodeInput.value.trim().toUpperCase();
        const displayProjName = selectedKey.substring(code.length + 1).replace(/_/g, " ");

        if (confirm(`Deseja carregar o projeto "${displayProjName}" da nuvem? Isso substituirá suas modificações atuais não salvas.`)) {
            fetch(`${BUCKET_URL}/${selectedKey}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Erro ao baixar dados do projeto.");
                }
                return response.json();
            })
            .then(loadedState => {
                state = { ...state, ...loadedState };
                
                // Sync inputs
                document.getElementById("project-save-name").value = displayProjName;
                document.getElementById("series-title").value = state.title || "";
                document.getElementById("author-name").value = state.author || "";
                document.getElementById("page-count").value = state.pageCount || 50;
                document.getElementById("paper-type").value = state.paperType || "premium-cream";

                saveStateToStorage();
                updateSpineWidth();
                renderAll();
                
                alert(`Projeto "${displayProjName}" carregado com sucesso da nuvem!`);
            })
            .catch(err => {
                console.error("Erro no Cloud Sync Download:", err);
                alert(`Erro na sincronização: ${err.message}`);
            });
        }
    });

    function updateCloudProjectsDropdown() {
        const code = syncCodeInput.value.trim().toUpperCase();
        if (!code) return;

        selectDropdown.innerHTML = '<option value="">-- Carregando... --</option>';

        fetch(`${BUCKET_URL}/?prefix=${code}_`)
        .then(response => {
            if (!response.ok) throw new Error();
            return response.json();
        })
        .then(keys => {
            selectDropdown.innerHTML = '<option value="">-- Projetos na Nuvem --</option>';
            if (!keys || keys.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.innerText = "Nenhum projeto encontrado";
                selectDropdown.appendChild(opt);
                return;
            }
            keys.forEach(key => {
                const projectName = key.substring(code.length + 1).replace(/_/g, " ");
                const opt = document.createElement("option");
                opt.value = key;
                opt.innerText = projectName;
                
                const currentName = document.getElementById("project-save-name").value.trim();
                if (projectName === currentName) {
                    opt.selected = true;
                }
                
                selectDropdown.appendChild(opt);
            });
        })
        .catch(() => {
            selectDropdown.innerHTML = '<option value="">-- Erro ao carregar --</option>';
        });
    }
}
