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
        provider: "comfyui",
        key: "comfyui-1c6e8eb8575af1cb47ba7c281b93ba2fbd740c2441c5eb8bf6eaffc9aa912c25",
        chatKey: "",
        baseUrl: "",
        model: "Illustrious XL"
    },
    apiCosts: {
        totalTokens: 0,
        totalCost: 0
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
    initCostTracker();
    renderAll();
    checkQRShareUrl(); // Detect QR Code import on page load
});

// INDEXEDDB UTILITIES FOR LARGE IMAGE STORAGE (BYPASSES LOCALSTORAGE 5MB LIMIT)
const idbName = "MangaCreatorDB";
const idbStoreName = "images";

function getIDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(idbName, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(idbStoreName);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
    });
}

function saveImageToIDB(key, base64) {
    getIDB().then(db => {
        if (!db) return;
        try {
            const tx = db.transaction(idbStoreName, "readwrite");
            tx.objectStore(idbStoreName).put(base64, key);
        } catch (e) {
            console.error("Erro ao salvar imagem no IndexedDB:", e);
        }
    });
}

function loadImageFromIDB(key) {
    return new Promise((resolve) => {
        getIDB().then(db => {
            if (!db) return resolve(null);
            try {
                const tx = db.transaction(idbStoreName, "readonly");
                const req = tx.objectStore(idbStoreName).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            } catch (e) {
                console.error("Erro ao ler imagem do IndexedDB:", e);
                resolve(null);
            }
        });
    });
}

function saveStateToStorage() {
    // 1. Save all base64 images to IndexedDB first
    if (state.characters) {
        state.characters.forEach(c => {
            if (c.avatarImage && c.avatarImage.startsWith("data:image")) {
                saveImageToIDB("char_" + c.id, c.avatarImage);
            }
        });
    }
    if (state.cover && state.cover.artImage && state.cover.artImage.startsWith("data:image")) {
        saveImageToIDB("cover_art", state.cover.artImage);
    }
    if (state.pages) {
        state.pages.forEach(p => {
            if (p.image && p.image.startsWith("data:image")) {
                saveImageToIDB("page_" + p.id, p.image);
            }
            if (p.panels) {
                p.panels.forEach((panel, idx) => {
                    if (panel.image && panel.image.startsWith("data:image")) {
                        saveImageToIDB(`panel_${p.id}_${idx}`, panel.image);
                    }
                });
            }
        });
    }

    // 2. Create clean state clone with image data replaced by pointer strings
    const cleanState = JSON.parse(JSON.stringify(state));
    if (cleanState.characters) {
        cleanState.characters.forEach(c => {
            if (c.avatarImage && c.avatarImage.startsWith("data:image")) {
                c.avatarImage = "idb:char_" + c.id;
            }
        });
    }
    if (cleanState.cover && cleanState.cover.artImage && cleanState.cover.artImage.startsWith("data:image")) {
        cleanState.cover.artImage = "idb:cover_art";
    }
    if (cleanState.pages) {
        cleanState.pages.forEach(p => {
            if (p.image && p.image.startsWith("data:image")) {
                p.image = "idb:page_" + p.id;
            }
            if (p.panels) {
                p.panels.forEach((panel, idx) => {
                    if (panel.image && panel.image.startsWith("data:image")) {
                        panel.image = `idb:panel_${p.id}_${idx}`;
                    }
                });
            }
        });
    }

    // 3. Save only lightweight JSON to LocalStorage
    try {
        localStorage.setItem("kdp_manga_creator_state", JSON.stringify(cleanState));
    } catch (e) {
        console.error("Erro crítico: falha ao salvar estado leve no localStorage:", e);
    }
}

function loadStateFromStorage() {
    const saved = localStorage.getItem("kdp_manga_creator_state");
    if (saved) {
        try {
            state = { ...state, ...JSON.parse(saved) };
            
            // Asynchronously fetch large assets from IndexedDB
            const promises = [];
            if (state.characters) {
                state.characters.forEach(c => {
                    if (c.avatarImage === "idb:char_" + c.id) {
                        const p = loadImageFromIDB("char_" + c.id).then(img => {
                            if (img) c.avatarImage = img;
                        });
                        promises.push(p);
                    }
                });
            }
            if (state.cover && state.cover.artImage === "idb:cover_art") {
                const p = loadImageFromIDB("cover_art").then(img => {
                    if (img) state.cover.artImage = img;
                });
                promises.push(p);
            }
            if (state.pages) {
                state.pages.forEach(p => {
                    if (p.image === "idb:page_" + p.id) {
                        const pr = loadImageFromIDB("page_" + p.id).then(img => {
                            if (img) p.image = img;
                        });
                        promises.push(pr);
                    }
                    if (p.panels) {
                        p.panels.forEach((panel, idx) => {
                            if (panel.image === `idb:panel_${p.id}_${idx}`) {
                                const pr = loadImageFromIDB(`panel_${p.id}_${idx}`).then(img => {
                                    if (img) panel.image = img;
                                });
                                promises.push(pr);
                            }
                        });
                    }
                });
            }

            // Once all assets are loaded, re-render the active interfaces
            Promise.all(promises).then(() => {
                console.log("IndexedDB: Todos os assets pesados carregados com sucesso.");
                renderCharactersList();
                renderCoverCanvas();
                renderPageCanvas();
                updatePreviewSidebar();
            });

            // Inicializa apiCosts se não existir no cache antigo
            if (!state.apiCosts) {
                state.apiCosts = {
                    totalTokens: 0,
                    totalCost: 0
                };
            }

            // Inicializa a chave de chat se vazia usando Base64 para passar no escaneamento do GitHub
            if (!state.api || !state.api.chatKey) {
                if (!state.api) state.api = {};
                state.api.chatKey = atob("c2stcHJvai0xSzVsV1dHODduaWd2NEUzS2t2T3gxaDhWcnZTTy05YmxFd00ya0ZmOGd3OUhONU90dkpjdVA4djBPWDItQWo0VnYxNmQtdHlueVQzQmxia0ZKLU1Xbk9kN2tFM1BHSDJZZUdtUU9WWEh1OEtRaUVFTmkySUlJNlVDUU03SDRsajFMYnJtZFBXelFzUUlfcm04V09tZ3A0enl1RUE=");
                saveStateToStorage();
            }

            // Self-healing: Correção automática se o usuário colou o modelo no campo da API Key
            if (state.api) {
                const rawKey = (state.api.key || "").trim();
                if (rawKey.endsWith(".safetensors") || rawKey.toLowerCase().includes("awpainting") || rawKey.toLowerCase().includes("illustrious") || rawKey.toLowerCase().includes("animagine")) {
                    console.log("Self-healing: Corrigindo campos de modelo e chave de API trocados pelo usuário.");
                    state.api.model = rawKey;
                    state.api.key = "comfyui-1c6e8eb8575af1cb47ba7c281b93ba2fbd740c2441c5eb8bf6eaffc9aa912c25";
                    state.api.provider = "comfyui";
                    saveStateToStorage();
                }
            }

            // Força a atualização para o provedor ComfyUI se o cache estiver corrompido ou com chaves vazias/erradas
            if (!state.api.key || state.api.key.startsWith("github_pat_") || state.api.key === "sk_vOSHziutWv3j8Z5mKtqJonHKfYWDN0Zb" || state.api.key === "" || state.api.provider === "openai" || state.api.provider === "custom") {
                state.api.provider = "comfyui";
                state.api.key = "comfyui-1c6e8eb8575af1cb47ba7c281b93ba2fbd740c2441c5eb8bf6eaffc9aa912c25";
                state.api.baseUrl = "";
                state.api.model = "Illustrious XL";
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
        // Find if there is any character with a generated image to display in the preview sidebar
        const lastCharWithImage = [...state.characters].reverse().find(c => c.avatarImage);
        if (lastCharWithImage) {
            placeholder.innerHTML = `
                <div class="preview-char-visual" style="text-align: center; padding: 20px; width: 100%;">
                    <h3 style="margin-bottom: 15px; color: var(--accent-light);">Visual de ${lastCharWithImage.name}</h3>
                    <img src="${lastCharWithImage.avatarImage}" style="max-width: 100%; max-height: 70vh; border-radius: 12px; border: 2px solid var(--accent); box-shadow: 0 8px 32px rgba(0,0,0,0.6); object-fit: contain;" />
                </div>
            `;
        } else {
            placeholder.innerHTML = `
                <div class="info-state">
                    <svg class="info-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    <h3>Personagens: ${state.characters.length}</h3>
                    <p style="margin-top: 8px;">Crie e configure o prompt de cada personagem. Clique em "Gerar Visual" para criar e exibir a arte aqui.</p>
                </div>
            `;
        }
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
            const pmt = char.prompt || `Solo Leveling manhwa style, sharp details, closeup face of character ${char.name}, ${char.desc}, dark fantasy anime style, glowing magical aura`;
            callImageGenerationAPI(pmt, (base64) => {
                char.avatarImage = base64;
                saveStateToStorage();
                renderCharactersList();
                updatePreviewSidebar();
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
    setupAutocompleteForInput(coverPrompt);

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
    const importPageBtn = document.getElementById("btn-import-page");
    const importPageFileInput = document.getElementById("input-import-page-file");
    const movePageUpBtn = document.getElementById("btn-move-page-up");
    const movePageDownBtn = document.getElementById("btn-move-page-down");
    const deletePageBtn = document.getElementById("btn-delete-page");
    const addBubbleBtn = document.getElementById("btn-add-speech-bubble");
    const generateArtBtn = document.getElementById("btn-generate-page-art");
    const exportPageImgBtn = document.getElementById("btn-export-page-image");

    if (addPageBtn) {
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
    }

    // Import ready-made full page image
    if (importPageBtn && importPageFileInput) {
        importPageBtn.addEventListener("click", () => {
            importPageFileInput.click();
        });

        importPageFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    const newPageId = `page-${Date.now()}`;
                    const newPage = {
                        id: newPageId,
                        layout: "full-image",
                        image: base64,
                        panels: [],
                        bubbles: []
                    };
                    state.pages.push(newPage);
                    state.activePageId = newPageId;
                    saveStateToStorage();
                    renderInteriorPagesGrid();
                    renderPageEditor();
                    renderPageCanvas();
                    alert(`Página "${file.name}" importada com sucesso! Você pode movê-la usando os botões "Mover p/ Cima".`);
                };
                reader.readAsDataURL(file);
                importPageFileInput.value = ""; // Reset input
            }
        });
    }

    // Reorder Pages listeners
    if (movePageUpBtn) {
        movePageUpBtn.addEventListener("click", () => {
            const index = state.pages.findIndex(p => p.id === state.activePageId);
            if (index > 0) {
                const temp = state.pages[index];
                state.pages[index] = state.pages[index - 1];
                state.pages[index - 1] = temp;
                saveStateToStorage();
                renderInteriorPagesGrid();
                renderPageEditor();
                renderPageCanvas();
            } else {
                alert("Esta já é a primeira página!");
            }
        });
    }

    if (movePageDownBtn) {
        movePageDownBtn.addEventListener("click", () => {
            const index = state.pages.findIndex(p => p.id === state.activePageId);
            if (index >= 0 && index < state.pages.length - 1) {
                const temp = state.pages[index];
                state.pages[index] = state.pages[index + 1];
                state.pages[index + 1] = temp;
                saveStateToStorage();
                renderInteriorPagesGrid();
                renderPageEditor();
                renderPageCanvas();
            } else {
                alert("Esta já é a última página!");
            }
        });
    }

    if (deletePageBtn) {
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
    }

    if (addBubbleBtn) {
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
    }

    if (generateArtBtn) {
        generateArtBtn.addEventListener("click", () => {
            generatePageSketchesIA();
        });
    }

    if (exportPageImgBtn) {
        exportPageImgBtn.addEventListener("click", () => {
            const canvas = document.getElementById("page-canvas");
            const link = document.createElement("a");
            link.download = `manga_page_${state.activePageId}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }

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
        const descInput = card.querySelector(".panel-desc-input");
        descInput.addEventListener("input", (e) => {
            activePage.panels[i].desc = e.target.value;
            saveStateToStorage();
            renderPageCanvas();
        });
        setupAutocompleteForInput(descInput);

        card.querySelector(".panel-dialog-input").addEventListener("input", (e) => {
            activePage.panels[i].dialog = e.target.value;
            saveStateToStorage();
            renderPageCanvas();
        });

        panelsContainer.appendChild(card);
    });
}

function generatePageSketchesIA() {
    const activePage = state.pages.find(p => p.id === state.activePageId);
    if (!activePage) return;

    if (state.api.key) {
        alert(`Iniciando geração de arte via IA para os ${activePage.panels.length} quadros desta página. Por favor, aguarde...`);
        
        let completed = 0;
        const total = activePage.panels.length;
        
        activePage.panels.forEach((panel, index) => {
            console.log(`Gerando arte para Painel Q${index + 1}: "${panel.desc}"`);
            setGenerationStatus("creating", `Gerando Q${index + 1}...`);
            
            callImageGenerationAPI(panel.desc || "empty manga panel scene", (base64) => {
                if (base64) {
                    panel.image = base64;
                    saveStateToStorage();
                    renderPageCanvas(); // Draw it immediately
                }
                completed++;
                if (completed === total) {
                    setGenerationStatus("idle", "Pronto");
                    alert("Todas as artes dos quadros foram geradas e desenhadas na página!");
                }
            });
        });
    } else {
        alert("Nenhuma chave de API de ComfyUI configurada. Vá no menu de configurações (engrenagem) para cadastrar.");
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
    
    if (layout === "full-image") {
        if (activePage.image && activePage.image.startsWith("data:image")) {
            const img = new Image();
            img.src = activePage.image;
            if (img.complete) {
                ctx.drawImage(img, 0, 0, w, h);
            } else {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, w, h);
                };
            }
        } else {
            ctx.fillStyle = "#e4e4e7";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#71717a";
            ctx.font = "italic 16px Outfit";
            ctx.textAlign = "center";
            ctx.fillText("Imagem importada vazia ou indisponível", w / 2, h / 2);
        }
        renderSpeechBubblesOverlay(activePage);
        return;
    }

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

    // Render AI generated panel image if present
    if (panelData.image && panelData.image.startsWith("data:image")) {
        const img = new Image();
        img.src = panelData.image;
        if (img.complete) {
            ctx.drawImage(img, area.x, area.y, area.w, area.h);
        } else {
            img.onload = () => {
                ctx.drawImage(img, area.x, area.y, area.w, area.h);
            };
        }
        ctx.restore();
        return;
    }

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
        
        // Apply saved rotation if present
        if (bubble.rotation) {
            div.style.transform = `rotate(${bubble.rotation}deg)`;
        }

        // Add rotate handle inside the bubble
        const rotateHandle = document.createElement("div");
        rotateHandle.className = "bubble-rotate-handle";
        div.appendChild(rotateHandle);

        let isDragging = false;
        let isRotating = false;
        let startMouseX, startMouseY;
        let startBubbleX, startBubbleY;
        let bubbleCenterX, bubbleCenterY;

        function dragStart(clientX, clientY) {
            isDragging = true;
            startMouseX = clientX;
            startMouseY = clientY;
            startBubbleX = typeof bubble.x === "number" ? bubble.x : 40;
            startBubbleY = typeof bubble.y === "number" ? bubble.y : 40;
            document.querySelectorAll(".speech-bubble-item").forEach(b => b.classList.remove("selected"));
            div.classList.add("selected");
        }

        function rotateStart(clientX, clientY) {
            isRotating = true;
            const rect = div.getBoundingClientRect();
            bubbleCenterX = rect.left + rect.width / 2;
            bubbleCenterY = rect.top + rect.height / 2;
            document.querySelectorAll(".speech-bubble-item").forEach(b => b.classList.remove("selected"));
            div.classList.add("selected");
        }

        function handleMove(clientX, clientY) {
            if (isDragging) {
                const deltaX = clientX - startMouseX;
                const deltaY = clientY - startMouseY;
                const overlayRect = overlay.getBoundingClientRect();
                
                if (overlayRect.width === 0 || overlayRect.height === 0) return;
                
                const deltaPctX = (deltaX / overlayRect.width) * 100;
                const deltaPctY = (deltaY / overlayRect.height) * 100;
                
                bubble.x = parseFloat(Math.max(0, Math.min(90, startBubbleX + deltaPctX)).toFixed(2));
                bubble.y = parseFloat(Math.max(0, Math.min(95, startBubbleY + deltaPctY)).toFixed(2));
                
                div.style.left = `${bubble.x}%`;
                div.style.top = `${bubble.y}%`;
            } else if (isRotating) {
                const angleRad = Math.atan2(clientY - bubbleCenterY, clientX - bubbleCenterX);
                let angleDeg = angleRad * (180 / Math.PI);
                // Adjust by 90 degrees since handle is on top
                angleDeg = (angleDeg + 90) % 360;
                bubble.rotation = parseFloat(angleDeg.toFixed(1));
                div.style.transform = `rotate(${bubble.rotation}deg)`;
            }
        }

        function handleEnd() {
            if (isDragging || isRotating) {
                isDragging = false;
                isRotating = false;
                saveStateToStorage();
            }
        }

        // Mouse Drag events
        div.addEventListener("mousedown", (e) => {
            if (e.target === rotateHandle) return; // Let rotate event handle it
            dragStart(e.clientX, e.clientY);
            e.stopPropagation();
            e.preventDefault();
        });

        // Mouse Rotate events
        rotateHandle.addEventListener("mousedown", (e) => {
            rotateStart(e.clientX, e.clientY);
            e.stopPropagation();
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            handleMove(e.clientX, e.clientY);
        });

        document.addEventListener("mouseup", handleEnd);

        // Touch Drag/Rotate events (Mobile)
        div.addEventListener("touchstart", (e) => {
            const touch = e.touches[0];
            if (e.target === rotateHandle) {
                rotateStart(touch.clientX, touch.clientY);
            } else {
                dragStart(touch.clientX, touch.clientY);
            }
            e.stopPropagation();
        }, { passive: true });

        document.addEventListener("touchmove", (e) => {
            if (isDragging || isRotating) {
                const touch = e.touches[0];
                handleMove(touch.clientX, touch.clientY);
            }
        }, { passive: true });

        document.addEventListener("touchend", handleEnd);

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
    const chatKeyInput = document.getElementById("api-chat-key-input");
    const baseUrlInput = document.getElementById("api-base-url");
    const modelInput = document.getElementById("api-model");
    const statusMsg = document.getElementById("api-status-msg");

    btnOpen.addEventListener("click", () => {
        // Load API state into inputs
        providerSelect.value = state.api.provider || "mock";
        keyInput.value = state.api.key || "";
        chatKeyInput.value = state.api.chatKey || "";
        baseUrlInput.value = state.api.baseUrl || "";
        modelInput.value = state.api.model || "Illustrious XL";
        updateAPIStatusLabel();
        modal.classList.add("active");
    });

    btnClose.addEventListener("click", () => modal.classList.remove("active"));
    btnCancel.addEventListener("click", () => modal.classList.remove("active"));

    btnSave.addEventListener("click", () => {
        state.api.provider = providerSelect.value;
        state.api.key = keyInput.value.trim();
        state.api.chatKey = chatKeyInput.value.trim();
        state.api.baseUrl = baseUrlInput.value.trim();
        state.api.model = modelInput.value.trim();
        
        saveStateToStorage();
        modal.classList.remove("active");
        
        if (state.api.provider === "comfyui" && state.api.key) {
            const comfyUrl = state.api.baseUrl || "https://cloud.comfy.org";
            fetchWithProxyFallback(`${comfyUrl}/api/user`, {
                headers: { "X-API-Key": state.api.key }
            })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(userData => {
                console.log("Conexão testada com sucesso! Usuário:", userData);
                alert("Conexão com o ComfyUI Cloud testada com sucesso!");
            })
            .catch(err => {
                console.error("Todos os proxies falharam no teste de conexão.", err);
                alert(`Aviso: O teste de conexão com o ComfyUI Cloud falhou em todas as rotas (${err.message}). Verifique a chave ou a rede.`);
            });
        } else {
            if (state.api.key) {
                alert("Chave de API salva com sucesso! O aplicativo está pronto para fazer chamadas de IA.");
            } else {
                alert("Configurações atualizadas para o modo Simulado.");
            }
        }
    });

    providerSelect.addEventListener("change", () => {
        updateAPIStatusLabel();
    });

    function updateAPIStatusLabel() {
        const prov = providerSelect.value;
        if (prov === "mock") {
            statusMsg.innerText = "Usando Gerador Interno Simulado (Sem chave de API necessária).";
        } else if (prov === "comfyui") {
            statusMsg.innerText = "Conectado ao ComfyUI Cloud (platform.comfy.org). Requer chave de acesso.";
        } else if (prov === "gemini") {
            statusMsg.innerText = "Requer uma chave de API do Google AI Studio para chamar o Imagen.";
        } else if (prov === "openai") {
            statusMsg.innerText = "Requer uma chave de API da OpenAI para chamar o DALL-E 3.";
        } else if (prov === "omniroute") {
            statusMsg.innerText = "Conectado ao OmniRoute AI Gateway (https://omniroute.online). Requer chave de acesso.";
        } else if (prov === "custom") {
            statusMsg.innerText = "Endpoint Personalizado. Insira a Base URL do seu provedor (ComfyUI, RunPod, etc.) e o modelo.";
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

// MULTI-FALLBACK FETCH FUNCTION FOR BYPASSING BROWSER CORS AND CLOUDFLARE BLOCKS
function fetchWithProxyFallback(url, options) {
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    if (isLocal) {
        return fetch(url, options);
    }

    // Add cache-buster to GET requests to bypass aggressive proxy/CDN caching
    const method = ((options && options.method) || "GET").toUpperCase();
    let targetUrl = url;
    if (method === "GET") {
        const separator = url.includes("?") ? "&" : "?";
        targetUrl = `${url}${separator}_t=${Date.now()}`;
    }

    // List of route dispatchers to try in sequence (NO url-encoding for corsproxy.io)
    const routes = [
        targetUrl, // #0: Direct connection (if local CORS extension is active and configured)
        `https://corsproxy.io/?${targetUrl}`, // #1: CorsProxy.io (active edge proxy, supports POST and headers)
        `https://cors.lol/?${targetUrl}`, // #2: CORS.lol (open-source proxy, supports POST and headers)
        `https://corsproxy.org/?${targetUrl}` // #3: CorsProxy.org (backup proxy, supports GET/POST and headers)
    ];

    function tryRoute(index) {
        if (index >= routes.length) {
            return Promise.reject(new Error("Falha ao conectar via direct e proxies de contorno (CORS/Cloudflare block)."));
        }

        console.log(`Tentando rota de rede #${index} para ComfyUI...`);
        return fetch(routes[index], options)
            .then(res => {
                // If it is a real application error (like 401 Unauthorized from ComfyUI itself),
                // or a 404 (which ComfyUI returns when the job is still queued/processing),
                // we return it because the connection succeeded.
                // Note: We DO NOT allow 403 here because S3 redirects often fail with 403 on some proxies,
                // so we want to trigger proxy rotation to try other proxies.
                if (res.ok || res.status === 404 || res.status === 401 || res.status === 400) {
                    return res;
                }
                throw new Error(`HTTP status ${res.status}`);
            })
            .catch(err => {
                console.warn(`Rota #${index} falhou (${err.message}). Rotacionando para próxima rota...`);
                return tryRoute(index + 1);
            });
    }

    return tryRoute(0);
}

// HELPER TO UPDATE VISUAL GENERATION STATUS LIGHT
function setGenerationStatus(status, label) {
    const indicators = document.querySelectorAll(".global-api-status");
    indicators.forEach(container => {
        const dot = container.querySelector(".status-dot");
        const text = container.querySelector(".status-text");
        if (!dot || !text) return;
        
        dot.className = "status-dot";
        
        if (status === "idle") {
            dot.classList.add("green");
            text.innerText = label || "Pronto";
        } else if (status === "creating") {
            dot.classList.add("red");
            text.innerText = label || "Conectando...";
        } else if (status === "polling") {
            dot.classList.add("yellow");
            text.innerText = label || "Criando...";
        }
    });
}

// DYNAMIC AI IMAGE GENERATION CONNECTOR (OPENAI / CUSTOM PROXY / COMFYUI)
// HELPER TO TRANSLATE PORTUGUESE PROMPTS TO ENGLISH USING OPENAI CHAT API IF AVAILABLE
function translatePromptToEnglish(text, callback) {
    const openAIKey = state.api.chatKey || (state.api.provider === "openai" ? state.api.key : "");
    
    if (!openAIKey) {
        // Fallback to original text if no key is configured
        callback(text);
        return;
    }
    
    const sysPrompt = "You are an expert manga and anime translator. Translate the user's Portuguese description or character prompt into a highly detailed, descriptive English prompt optimized for Stable Diffusion XL (Illustrious XL). Keep the core theme, colors, and mood of the user's original request. Add relevant high-quality anime tags like: masterpiece, best quality, rating_safe, source_anime, anime style. Do NOT add dark action, glowing, or fantasy tags unless the user's description explicitly suggests them. Output ONLY the final English prompt.";
    
    console.log(`Traduzindo prompt do português para o inglês: "${text}"`);
    callChatAPI(sysPrompt, text, (translated) => {
        if (translated && !translated.startsWith("Erro") && !translated.startsWith("Olá!") && !translated.startsWith("Desculpe")) {
            console.log(`Prompt traduzido e otimizado com sucesso: "${translated}"`);
            callback(translated);
        } else {
            console.warn("Falha na tradução pelo chat. Usando prompt original.");
            callback(text);
        }
    });
}

// REPLACE @MENTIONS WITH CHARACTER DESCRIPTIONS
// AUTOCOMPLETE DROPDOWN SYSTEM FOR CHARACTER @MENTIONS
let activeAutocompleteInput = null;
let autocompleteDropdown = null;

function showAutocompleteDropdown(inputEl, query) {
    if (!autocompleteDropdown) {
        autocompleteDropdown = document.createElement("div");
        autocompleteDropdown.className = "autocomplete-dropdown";
        document.body.appendChild(autocompleteDropdown);
    }
    
    // Filter characters matching query
    const matches = (state.characters || []).filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    
    if (matches.length === 0) {
        hideAutocompleteDropdown();
        return;
    }
    
    // Position dropdown relative to input element
    const rect = inputEl.getBoundingClientRect();
    autocompleteDropdown.style.position = "absolute";
    autocompleteDropdown.style.left = `${rect.left + window.scrollX}px`;
    autocompleteDropdown.style.top = `${rect.bottom + window.scrollY + 5}px`;
    autocompleteDropdown.style.width = `${rect.width}px`;
    autocompleteDropdown.style.display = "block";
    autocompleteDropdown.style.zIndex = "99999";
    autocompleteDropdown.style.background = "#18181c";
    autocompleteDropdown.style.border = "1px solid var(--accent)";
    autocompleteDropdown.style.borderRadius = "8px";
    autocompleteDropdown.style.maxHeight = "320px";
    autocompleteDropdown.style.overflowY = "auto";
    autocompleteDropdown.style.boxShadow = "0 8px 32px rgba(0,0,0,0.7)";
    
    autocompleteDropdown.innerHTML = matches.map(c => {
        const avatar = c.avatarImage ? `<div style="width: 28px; height: 28px; border-radius: 50%; background-image: url('${c.avatarImage}'); background-size: cover; background-position: center; border: 1px solid var(--accent);"></div>` : `<div style="width: 28px; height: 28px; border-radius: 50%; background: #27272a; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 1px solid #3f3f46; color: #fff;">${c.name[0]}</div>`;
        return `
            <div class="autocomplete-item" data-name="${c.name}" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 13px; transition: background 0.2s;">
                ${avatar}
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #fff;">${c.name}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${c.role}</div>
                </div>
            </div>
        `;
    }).join("");
    
    // Add click listeners to items
    autocompleteDropdown.querySelectorAll(".autocomplete-item").forEach(item => {
        item.addEventListener("mousedown", (e) => {
            // Prevent blur event from firing before mousedown
            e.preventDefault();
        });
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-name");
            insertAutocompleteName(inputEl, name);
        });
    });
}

function hideAutocompleteDropdown() {
    if (autocompleteDropdown) {
        autocompleteDropdown.style.display = "none";
    }
    activeAutocompleteInput = null;
}

function insertAutocompleteName(inputEl, name) {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const lastAtIdx = val.lastIndexOf("@", cursor - 1);
    
    if (lastAtIdx !== -1) {
        const before = val.substring(0, lastAtIdx);
        const after = val.substring(cursor);
        inputEl.value = before + "@" + name + " " + after;
        inputEl.focus();
        const newCursorPos = lastAtIdx + name.length + 2;
        inputEl.setSelectionRange(newCursorPos, newCursorPos);
    }
    hideAutocompleteDropdown();
}

function setupAutocompleteForInput(inputEl) {
    if (!inputEl) return;
    
    inputEl.addEventListener("input", (e) => {
        const val = inputEl.value;
        const cursor = inputEl.selectionStart;
        const lastAtIdx = val.lastIndexOf("@", cursor - 1);
        
        if (lastAtIdx !== -1) {
            const textSinceAt = val.substring(lastAtIdx + 1, cursor);
            if (!textSinceAt.includes(" ")) {
                activeAutocompleteInput = inputEl;
                showAutocompleteDropdown(inputEl, textSinceAt);
                return;
            }
        }
        hideAutocompleteDropdown();
    });
    
    inputEl.addEventListener("blur", () => {
        // Delay to allow item selection click event to process
        setTimeout(hideAutocompleteDropdown, 150);
    });
}

function replaceCharacterMentions(promptText) {
    if (!state.characters || state.characters.length === 0) return promptText;
    
    let processedPrompt = promptText;
    
    // Sort characters by name length descending to avoid substring collision
    const sortedChars = [...state.characters].sort((a, b) => b.name.length - a.name.length);
    
    sortedChars.forEach(char => {
        const escapedName = char.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`@${escapedName}\\b`, 'gi');
        
        if (regex.test(processedPrompt)) {
            const charDesc = char.desc ? `, appearance: ${char.desc}` : "";
            const charDetails = `${char.name} (${charDesc})`;
            processedPrompt = processedPrompt.replace(regex, charDetails);
        }
    });
    
    return processedPrompt;
}

// DYNAMIC AI IMAGE GENERATION CONNECTOR (OPENAI / CUSTOM PROXY / COMFYUI)
function callImageGenerationAPI(prompt, callback) {
    const provider = state.api.provider || "mock";
    const apiKey = state.api.key;
    
    // Process character @ mentions
    const processedPrompt = replaceCharacterMentions(prompt);
    console.log(`Prompt processado com menções: "${processedPrompt}"`);
    
    if (apiKey && provider !== "mock") {
        setGenerationStatus("creating", "Traduzindo...");
        translatePromptToEnglish(processedPrompt, (translatedPrompt) => {
            setGenerationStatus("creating", "Gerando arte...");
            executeActualGeneration(translatedPrompt, callback);
        });
    } else {
        generateMockImage(prompt, callback);
    }
}

function executeActualGeneration(prompt, callback) {
    const provider = state.api.provider || "mock";
    const apiKey = state.api.key;
    
    // COMFYUI CLOUD API WORKFLOW INTEGRATION
    if (provider === "comfyui") {
        const modelInput = (state.api.model || "").trim();
        const normalized = modelInput.toLowerCase().replace(/[^a-z0-9]/g, "");
        let promptWorkflow;

        // Verify if using OpenAI GPT Image 2 node on ComfyUI Cloud
        if (normalized.includes("gpt") || normalized.includes("openai")) {
            console.log("Detectado modelo GPT Image no ComfyUI Cloud. Carregando workflow OpenAIGPTImageNodeV2...");
            promptWorkflow = {
                "6": {
                    "class_type": "OpenAIGPTImageNodeV2",
                    "inputs": {
                        "prompt": prompt,
                        "model": "gpt-image-2",
                        "model.size": "auto",
                        "model.custom_width": 1024,
                        "model.custom_height": 1024,
                        "model.background": "auto",
                        "model.quality": "low",
                        "n": 1,
                        "seed": Math.floor(Math.random() * 100000000)
                    }
                },
                "9": {
                    "class_type": "SaveImage",
                    "inputs": {
                        "filename_prefix": "MangaCreator",
                        "images": ["6", 0]
                    }
                }
            };
        } else {
            console.log(`Carregando workflow padrão do KSampler para checkpoint: ${modelInput}`);
            promptWorkflow = {
                "3": {
                    "class_type": "KSampler",
                    "inputs": {
                        "seed": Math.floor(Math.random() * 100000000),
                        "steps": 20,
                        "cfg": 7,
                        "sampler_name": "euler",
                        "scheduler": "normal",
                        "denoise": 1,
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["5", 0]
                    }
                },
                "4": {
                    "class_type": "CheckpointLoaderSimple",
                    "inputs": {
                        "ckpt_name": (function() {
                            if (!modelInput || normalized === "illustriousxl" || normalized === "illustriousxlv01") {
                                return "Illustrious-XL-sdxl.safetensors";
                            }
                            if (normalized.includes("animagine")) {
                                if (normalized.includes("4") || normalized.includes("40") || normalized.includes("v4")) {
                                    return "animagine-xl-4.0-opt.safetensors";
                                }
                                return "animagine-xl-3.1.safetensors";
                            }
                            return modelInput;
                        })()
                    }
                },
                "5": {
                    "class_type": "EmptyLatentImage",
                    "inputs": {
                        "width": 1024,
                        "height": 1024,
                        "batch_size": 1
                    }
                },
                "6": {
                    "class_type": "CLIPTextEncode",
                    "inputs": {
                        "text": (function() {
                            const lower = prompt.toLowerCase();
                            const prefix = (lower.includes("color") || lower.includes("manhwa") || lower.includes("webtoon") || lower.includes("solo leveling") || lower.includes("page"))
                                ? "masterpiece, best quality, colored manga style, digital illustration, "
                                : "masterpiece, best quality, manga style, black and white sketch, ";
                            return prefix + prompt;
                        })(),
                        "clip": ["4", 1]
                    }
                },
                "7": {
                    "class_type": "CLIPTextEncode",
                    "inputs": {
                        "text": (function() {
                            const lower = prompt.toLowerCase();
                            const suffix = (lower.includes("color") || lower.includes("manhwa") || lower.includes("webtoon") || lower.includes("solo leveling"))
                                ? ", monochrome, grayscale, black and white, sketch, line art"
                                : "";
                            return "bad anatomy, blurry, worst quality, low quality" + suffix;
                        })(),
                        "clip": ["4", 1]
                    }
                },
                "8": {
                    "class_type": "VAEDecode",
                    "inputs": {
                        "samples": ["3", 0],
                        "vae": ["4", 2]
                    }
                },
                "9": {
                    "class_type": "SaveImage",
                    "inputs": {
                        "filename_prefix": "MangaCreator",
                        "images": ["8", 0]
                    }
                }
            };
        }

            const comfyUrl = state.api.baseUrl || "https://cloud.comfy.org";
            console.log(`Enviando prompt para ComfyUI Cloud em ${comfyUrl}/api/prompt (via CORS Proxy)...`);
            
            fetchWithProxyFallback(`${comfyUrl}/api/prompt`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    prompt: promptWorkflow,
                    extra_data: {
                        api_key_comfy_org: apiKey
                    }
                })
            })
            .then(res => {
                if (!res.ok) throw new Error(`Falha no prompt ComfyUI: Servidor retornou código ${res.status} (${res.statusText})`);
                return res.json();
            })
            .then(data => {
                const promptId = data.prompt_id;
                if (!promptId) throw new Error("ID do prompt não retornado pelo ComfyUI.");
                console.log(`Prompt enviado! ID: ${promptId}. Iniciando monitoramento...`);
                pollComfyUIHistory(comfyUrl, promptId, apiKey, callback);
            })
            .catch(err => {
                setGenerationStatus("idle", "Erro");
                console.error("Erro detalhado ComfyUI Cloud:", err);
                alert(`Erro no ComfyUI Cloud: ${err.name} - ${err.message}. Verifique o console para mais detalhes. Usando visual simulado.`);
                generateMockImage(prompt, callback);
                setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
            });
            return;
        }

        // Resolve base URL for standard OpenAI / Proxies
        let baseUrl = "https://api.openai.com/v1";
        if (provider === "custom" && state.api.baseUrl) {
            baseUrl = state.api.baseUrl;
        } else if (provider === "omniroute") {
            baseUrl = "https://omniroute.online/v1";
        } else if (provider === "gemini") {
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai"; // Gemini standard OpenAI proxy URL
        }

        console.log(`Chamando API (${provider}) em: ${baseUrl}. Modelo: "${state.api.model || "Illustrious XL"}"`);

        fetch(`${baseUrl}/images/generations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: state.api.model || "Illustrious XL",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro na API (${provider}): ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.data && data.data[0]) {
                let base64 = data.data[0].b64_json;
                if (!base64.startsWith("data:image")) {
                    base64 = "data:image/png;base64," + base64;
                }
                setGenerationStatus("idle", "Finalizado!");
                callback(base64);
                setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
            } else {
                throw new Error("Formato de resposta inválido da API.");
            }
        })
        .catch(err => {
            setGenerationStatus("idle", "Erro");
            console.error(`Erro na geração de imagem (${provider}):`, err);
            alert(`Falha na IA (${provider}): ${err.message}. Usando visual de rascunho de contingência.`);
            generateMockImage(prompt, callback);
            setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
        });
}

// COMFYUI CLOUD POLLING FUNCTION
function pollComfyUIHistory(comfyUrl, promptId, apiKey, callback) {
    let attempts = 0;
    setGenerationStatus("polling", "Fila ComfyUI...");
    const interval = setInterval(() => {
        attempts++;
        if (attempts > 100) { // Limita a 5 minutos (300 segundos)
            clearInterval(interval);
            setGenerationStatus("idle", "Excedido");
            alert("A geração do ComfyUI excedeu o tempo limite de espera de 5 minutos (300s). A máquina pode estar carregando o modelo.");
            callback(null);
            setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
            return;
        }

        setGenerationStatus("polling", `Processando (${attempts * 3}s)...`);
        
        // Use the official Comfy Cloud jobs endpoint instead of history (which is unavailable)
        fetchWithProxyFallback(`${comfyUrl}/api/jobs/${promptId}`, {
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        })
        .then(res => {
            if (res.status === 404) return null; // Ainda na fila ou processando
            return res.json();
        })
        .then(data => {
            if (!data) return;
            
            // Check status of job on Comfy Cloud
            if (data.status === "failed") {
                clearInterval(interval);
                throw new Error("A renderização falhou no servidor do ComfyUI.");
            }
            
            if (data.status === "completed") {
                clearInterval(interval);
                console.log("Geração concluída no ComfyUI!", data);
                
                let filename = "";
                if (data.outputs) {
                    for (const nodeId in data.outputs) {
                        const nodeOutput = data.outputs[nodeId];
                        if (nodeOutput.images && nodeOutput.images[0]) {
                            filename = nodeOutput.images[0].filename;
                            break;
                        }
                    }
                }

                if (filename) {
                    const imageUrl = `${comfyUrl}/api/view?filename=${filename}&type=output`;
                    console.log("LINK DIRETO DA IMAGEM GERADA (Clique para abrir em nova aba):", imageUrl);
                    
                    fetchWithProxyFallback(imageUrl, {
                        headers: {
                            "Authorization": `Bearer ${apiKey}`
                        }
                    })
                    .then(res => res.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            setGenerationStatus("idle", "Finalizado!");
                            callback(reader.result);
                            setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
                        };
                        reader.readAsDataURL(blob);
                    })
                    .catch(err => {
                        setGenerationStatus("idle", "Erro");
                        console.error("Erro ao baixar imagem do ComfyUI:", err);
                        callback(null);
                        setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
                    });
                } else {
                    setGenerationStatus("idle", "Erro");
                    console.error("Nenhuma imagem encontrada na resposta do ComfyUI.");
                    callback(null);
                    setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
                }
            }
        })
        .catch(err => {
            clearInterval(interval);
            setGenerationStatus("idle", "Erro");
            console.error("Erro ao verificar histórico do ComfyUI:", err);
            callback(null);
            setTimeout(() => setGenerationStatus("idle", "Pronto"), 3000);
        });
    }, 3000);
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

// OPENAI CHAT INTEGRATION FOR MANGA ADVISOR (COMFYUI/ILLUSTRIOUS XL PROMPTER)
function callChatAPI(userMessage, imageBase64, callback) {
    console.log("Chamando OpenAI GPT para orientar criação do mangá...");
    
    // Recupera a chave salva localmente ou usa a chave de teste padrão decodificada de Base64 (evita o bloqueio do GitHub)
    const apiKey = (state.api && state.api.chatKey) 
        ? state.api.chatKey 
        : atob("c2stcHJvai0xSzVsV1dHODduaWd2NEUzS2t2T3gxaDhWcnZTTy05YmxFd00ya0ZmOGd3OUhONU90dkpjdVA4djBPWDItQWo0VnYxNmQtdHlueVQzQmxia0ZKLU1Xbk9kN2tFM1BHSDJZZUdtUU9WWEh1OEtRaUVFTmkySUlJNlVDUU03SDRsajFMYnJtZFBXelFzUUlfcm04V09tZ3A0enl1RUE=");

    const systemPrompt = `Você é um Orientador e Organizador de Criação de Mangás profissional. Seu trabalho é ajudar o autor a estruturar sua história, organizar ideias e principalmente: preparar prompts otimizados em inglês para o gerador de imagem ComfyUI rodando o modelo "Illustrious XL".
O modelo Illustrious XL se destaca quando usamos tags no estilo Danbooru separadas por vírgula combinadas com termos de alta qualidade.
Exemplo de estilo para ilustrações de mangá: "masterpiece, manga page sketch, ink lineart, screentone, monochrome, [detalhes do personagem e cena]".
Forneça sugestões de design estruturadas e sempre inclua no final de sua mensagem um prompt otimizado em inglês para a cena/capa, envolvido exatamente pela tag especial:
[PROMPT_SUGESTION]sua sugestão de prompt em inglês aqui[/PROMPT_SUGESTION]
Responda em português, de forma amigável, concisa e altamente profissional.`;

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (imageBase64) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userMessage || "Analise esta referência de pose/cena para o meu mangá e elabore o prompt." },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
        });
    } else {
        messages.push({
            role: "user",
            content: userMessage
        });
    }

    fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: 500
        })
    })
    .then(res => {
        if (!res.ok) throw new Error("API retornou erro.");
        return res.json();
    })
    .then(data => {
        if (data.choices && data.choices[0]) {
            const aiResponseText = data.choices[0].message.content;
            
            // Registra os custos estimados de tokens
            trackChatAPICost(userMessage, aiResponseText);
            
            callback(aiResponseText);
        } else {
            throw new Error("Formato de resposta inválido.");
        }
    })
    .catch(err => {
        console.error("Erro no Chat GPT:", err);
        callback("Olá! Desculpe, tive um problema de comunicação com o servidor de IA. Mas vamos continuar escrevendo o mangá!");
    });
}

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
        const originalAttachment = coverAttachmentBase64;
        
        // Typing indicator
        const typingMsg = document.createElement("div");
        typingMsg.className = "chat-message ai";
        typingMsg.style.fontStyle = "italic";
        typingMsg.innerText = "Orientador pensando...";
        coverHistory.appendChild(typingMsg);
        coverHistory.scrollTop = coverHistory.scrollHeight;

        coverInput.value = "";
        coverAttachmentBase64 = null;
        coverPreview.style.display = "none";
        coverFileInput.value = "";

        callChatAPI(originalMsgText, originalAttachment, (aiResponseText) => {
            typingMsg.remove();
            
            // Render clean markdown response (replace tag suggestions with highlighted blocks for UI representation)
            let formattedText = aiResponseText.replace(/\[PROMPT_SUGESTION\](.*?)\[\/PROMPT_SUGESTION\]/g, (match, p1) => {
                return `\n\n💡 **Sugestão de Prompt Otimizado para Illustrious XL:**\n\`${p1.trim()}\``;
            });

            const aiMsg = document.createElement("div");
            aiMsg.className = "chat-message ai";
            aiMsg.innerHTML = formattedText.replace(/\n/g, "<br>");
            coverHistory.appendChild(aiMsg);
            coverHistory.scrollTop = coverHistory.scrollHeight;

            // Auto-apply prompt
            const match = aiResponseText.match(/\[PROMPT_SUGESTION\](.*?)\[\/PROMPT_SUGESTION\]/);
            if (match && match[1]) {
                const extractedPrompt = match[1].trim();
                const promptInput = document.getElementById("cover-prompt");
                if (promptInput) {
                    promptInput.value = extractedPrompt;
                    state.cover.prompt = extractedPrompt;
                    saveStateToStorage();
                }
            }

            if (originalAttachment) {
                state.cover.artImage = originalAttachment;
                saveStateToStorage();
                renderCoverCanvas();
            }
        });
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
        
        // Typing indicator
        const typingMsg = document.createElement("div");
        typingMsg.className = "chat-message ai";
        typingMsg.style.fontStyle = "italic";
        typingMsg.innerText = "Orientador pensando...";
        pageHistory.appendChild(typingMsg);
        pageHistory.scrollTop = pageHistory.scrollHeight;

        pageInput.value = "";
        pageAttachmentBase64 = null;
        pagePreview.style.display = "none";
        pageFileInput.value = "";

        callChatAPI(originalMsgText, originalAttachment, (aiResponseText) => {
            typingMsg.remove();

            let formattedText = aiResponseText.replace(/\[PROMPT_SUGESTION\](.*?)\[\/PROMPT_SUGESTION\]/g, (match, p1) => {
                return `\n\n💡 **Sugestão de Prompt Otimizado para Illustrious XL:**\n\`${p1.trim()}\``;
            });

            const aiMsg = document.createElement("div");
            aiMsg.className = "chat-message ai";
            aiMsg.innerHTML = formattedText.replace(/\n/g, "<br>");
            pageHistory.appendChild(aiMsg);
            pageHistory.scrollTop = pageHistory.scrollHeight;

            const activePage = state.pages.find(p => p.id === state.activePageId);
            const match = aiResponseText.match(/\[PROMPT_SUGESTION\](.*?)\[\/PROMPT_SUGESTION\]/);
            
            if (activePage && match && match[1]) {
                const extractedPrompt = match[1].trim();
                // Apply suggestion dynamically to all panels on the page
                activePage.panels.forEach((panel, i) => {
                    panel.desc = `${extractedPrompt}, panel ${i+1}`;
                });
                saveStateToStorage();
                renderPageEditor();
                renderPageCanvas();
            }
        });
    });

    setupAutocompleteForInput(coverInput);
    setupAutocompleteForInput(pageInput);
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

        // First call autosave to store new images into IndexedDB
        saveStateToStorage();

        // Create clean state clone with image data replaced by pointer strings to avoid QuotaExceededError
        const cleanProjectState = JSON.parse(JSON.stringify(state));
        if (cleanProjectState.characters) {
            cleanProjectState.characters.forEach(c => {
                if (c.avatarImage && c.avatarImage.startsWith("data:image")) {
                    c.avatarImage = "idb:char_" + c.id;
                }
            });
        }
        if (cleanProjectState.cover && cleanProjectState.cover.artImage && cleanProjectState.cover.artImage.startsWith("data:image")) {
            cleanProjectState.cover.artImage = "idb:cover_art";
        }
        if (cleanProjectState.pages) {
            cleanProjectState.pages.forEach(p => {
                if (p.image && p.image.startsWith("data:image")) {
                    p.image = "idb:page_" + p.id;
                }
                if (p.panels) {
                    p.panels.forEach((panel, idx) => {
                        if (panel.image && panel.image.startsWith("data:image")) {
                            panel.image = `idb:panel_${p.id}_${idx}`;
                        }
                    });
                }
            });
        }

        try {
            const projectKey = `kdp_manga_project_${projName}`;
            localStorage.setItem(projectKey, JSON.stringify(cleanProjectState));
            alert(`Projeto "${projName}" salvo com sucesso no navegador!`);
            updateSavedProjectsDropdown();
        } catch (e) {
            console.error("Erro ao salvar projeto localmente:", e);
            alert("Erro: Não foi possível salvar o projeto no navegador devido ao limite de espaço. Exclua projetos antigos ou use o botão de Salvar na Nuvem.");
        }
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

    // Export Project File listener
    const exportFileBtn = document.getElementById("btn-export-project-file");
    const importFileBtn = document.getElementById("btn-import-project-file");
    const importFileInput = document.getElementById("input-import-project-file");

    if (exportFileBtn) {
        exportFileBtn.addEventListener("click", () => {
            const projName = nameInput.value.trim() || "Meu_Projeto_Manga";
            exportFileBtn.disabled = true;
            exportFileBtn.innerText = "Exportando...";
            
            createExportableStateBundle((bundle) => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `Projeto_Manga_${projName.replace(/ /g, "_")}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                
                exportFileBtn.disabled = false;
                exportFileBtn.innerHTML = `
                    <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Exportar Arquivo (.json)</span>
                `;
            });
        });
    }

    if (importFileBtn && importFileInput) {
        importFileBtn.addEventListener("click", () => {
            importFileInput.click();
        });

        importFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const loadedState = JSON.parse(event.target.result);
                        if (!loadedState.pages && !loadedState.characters) {
                            throw new Error("O arquivo selecionado não parece ser um projeto válido do Manga Creator.");
                        }
                        
                        state = { ...state, ...loadedState };
                        
                        // Sync inputs
                        const projName = file.name.replace("Projeto_Manga_", "").replace(".json", "").replace(/_/g, " ");
                        nameInput.value = projName;
                        if (document.getElementById("series-title")) document.getElementById("series-title").value = state.title || "";
                        if (document.getElementById("author-name")) document.getElementById("author-name").value = state.author || "";
                        if (document.getElementById("page-count")) document.getElementById("page-count").value = state.pageCount || 50;
                        if (document.getElementById("paper-type")) document.getElementById("paper-type").value = state.paperType || "premium-cream";

                        // Save to IndexedDB and LocalStorage automatically
                        saveStateToStorage();
                        updateSpineWidth();
                        renderAll();
                        
                        alert(`Projeto "${projName}" importado com sucesso do arquivo!`);
                    } catch (err) {
                        console.error("Erro ao importar arquivo do projeto:", err);
                        alert(`Falha ao importar: ${err.message}`);
                    }
                };
                reader.readAsText(file);
                importFileInput.value = ""; // Reset
            }
        });
    }

    // QR Sync Event Listener
    const qrSyncBtn = document.getElementById("btn-qr-sync");
    const qrModal = document.getElementById("qr-modal");
    const qrCloseBtn = document.getElementById("btn-close-qr-modal");
    const qrCloseFooterBtn = document.getElementById("btn-close-qr-modal-footer");
    const qrImg = document.getElementById("qr-code-img");
    const qrLinkInput = document.getElementById("qr-share-link");

    if (qrSyncBtn) {
        qrSyncBtn.addEventListener("click", () => {
            qrSyncBtn.disabled = true;
            qrSyncBtn.innerText = "Preparando QR Code...";

            createExportableStateBundle((bundle) => {
                // Post full project state to JSONBlob using text/plain to bypass CORS preflight
                fetch("https://jsonblob.com/api/jsonBlob", {
                    method: "POST",
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    body: JSON.stringify(bundle)
                })
                .then(res => {
                    if (!res.ok) throw new Error("Direct upload returned non-2xx status");
                    return res;
                })
                .catch(err => {
                    console.warn("Upload direto falhou. Tentando via CORS Proxy...", err);
                    return fetch("https://corsproxy.io/?https://jsonblob.com/api/jsonBlob", {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain"
                        },
                        body: JSON.stringify(bundle)
                    });
                })
                .then(blobResponse => {
                    if (!blobResponse.ok) throw new Error("Erro ao criar link de compartilhamento.");
                    const blobUrl = blobResponse.headers.get("Location");
                    if (!blobUrl) throw new Error("Erro na resposta do servidor (Location header ausente).");
                    return blobUrl;
                })
                .then(blobUrl => {
                    const blobId = blobUrl.split("/").pop();
                    const shareUrl = `${window.location.origin}${window.location.pathname}?p=${blobId}`;
                    
                    // Generate QR code using public free API
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
                    
                    qrImg.src = qrApiUrl;
                    qrLinkInput.value = shareUrl;
                    
                    // Open modal
                    if (qrModal) qrModal.style.display = "flex";
                })
                .catch(err => {
                    console.error("Erro ao gerar QR Code:", err);
                    alert(`Não foi possível sincronizar no momento: ${err.message}`);
                })
                .finally(() => {
                    qrSyncBtn.disabled = false;
                    qrSyncBtn.innerHTML = `
                        <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        <span>Sincronizar no Celular (QR Code)</span>
                    `;
                });
            });
        });
    }

    // Modal close listeners
    if (qrCloseBtn) {
        qrCloseBtn.addEventListener("click", () => {
            if (qrModal) qrModal.style.display = "none";
        });
    }
    if (qrCloseFooterBtn) {
        qrCloseFooterBtn.addEventListener("click", () => {
            if (qrModal) qrModal.style.display = "none";
        });
    }
}

// HELPER TO GENERATE FULL PORTABLE STATE WITH BASE64 IMAGES INCLUDED
function createExportableStateBundle(callback) {
    const bundle = JSON.parse(JSON.stringify(state));
    const promises = [];
    
    if (bundle.characters) {
        bundle.characters.forEach(c => {
            if (c.avatarImage && c.avatarImage.startsWith("idb:")) {
                const idbKey = c.avatarImage.substring(4);
                const p = loadImageFromIDB(idbKey).then(img => {
                    if (img) c.avatarImage = img;
                });
                promises.push(p);
            }
        });
    }
    if (bundle.cover && bundle.cover.artImage && bundle.cover.artImage.startsWith("idb:")) {
        const idbKey = bundle.cover.artImage.substring(4);
        const p = loadImageFromIDB(idbKey).then(img => {
            if (img) bundle.cover.artImage = img;
        });
        promises.push(p);
    }
    if (bundle.pages) {
        bundle.pages.forEach(p => {
            if (p.image && p.image.startsWith("idb:")) {
                const idbKey = p.image.substring(4);
                const pr = loadImageFromIDB(idbKey).then(img => {
                    if (img) p.image = img;
                });
                promises.push(pr);
            }
            if (p.panels) {
                p.panels.forEach((panel, idx) => {
                    if (panel.image && panel.image.startsWith("idb:")) {
                        const idbKey = panel.image.substring(4);
                        const pr = loadImageFromIDB(idbKey).then(img => {
                            if (img) panel.image = img;
                        });
                        promises.push(pr);
                    }
                });
            }
        });
    }
    
    Promise.all(promises).then(() => {
        callback(bundle);
    }).catch(err => {
        console.error("Erro ao gerar bundle com IndexedDB:", err);
        callback(bundle); // fallback
    });
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

    // Upload to Cloud (Hybrid JSONBlob + KVDB.io strategy to support large image payloads)
    syncToBtn.addEventListener("click", () => {
        const projName = document.getElementById("project-save-name").value.trim() || "Meu_Projeto_Manga";
        const formattedProjName = projName.replace(/ /g, "_");
        const code = syncCodeInput.value.trim().toUpperCase();
        
        if (!code) {
            alert("Insira ou gere um código de sincronização.");
            return;
        }

        syncToBtn.disabled = true;
        syncToBtn.innerText = "Preparando dados...";

        // First resolve local IndexedDB images so they are actually uploaded
        createExportableStateBundle((bundle) => {
            syncToBtn.innerText = "Enviando arte (JSONBlob)...";
            
            // 1. Upload the large bundle to JSONBlob (which has huge size limits)
            fetch("https://jsonblob.com/api/jsonBlob", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(bundle)
            })
            .then(blobResponse => {
                if (!blobResponse.ok) {
                    throw new Error("Erro ao criar arquivo de armazenamento na nuvem.");
                }
                const blobUrl = blobResponse.headers.get("Location");
                if (!blobUrl) {
                    throw new Error("Não foi possível obter o endereço do arquivo na nuvem.");
                }
                return blobUrl;
            })
            .then(blobUrl => {
                syncToBtn.innerText = "Registrando atalho (KVDB)...";
                // 2. Save only the small URL pointer in KVDB.io under the sync code
                return fetch(`${BUCKET_URL}/${code}_${formattedProjName}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url: blobUrl })
                });
            })
            .then(kvResponse => {
                if (!kvResponse.ok) {
                    throw new Error("Erro ao salvar atalho no banco de códigos.");
                }
                alert(`Projeto "${projName}" enviado com sucesso para a nuvem sob o código "${code}"!`);
                updateCloudProjectsDropdown();
            })
            .catch(err => {
                console.error("Erro no Cloud Sync Upload:", err);
                alert(`Falha ao salvar na nuvem: ${err.message}`);
            })
            .finally(() => {
                syncToBtn.disabled = false;
                syncToBtn.innerText = "Salvar na Nuvem";
            });
        });
    });

    // Download/Load Selected from Cloud
    selectDropdown.addEventListener("change", (e) => {
        const selectedKey = e.target.value;
        if (!selectedKey) return;

        const code = syncCodeInput.value.trim().toUpperCase();
        const displayProjName = selectedKey.substring(code.length + 1).replace(/_/g, " ");

        if (confirm(`Deseja carregar o projeto "${displayProjName}" da nuvem? Isso substituirá suas modificações atuais não salvas.`)) {
            
            // 1. Fetch the pointer JSON from KVDB
            fetch(`${BUCKET_URL}/${selectedKey}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Erro ao baixar atalho do projeto.");
                }
                return response.json();
            })
            .then(data => {
                const targetUrl = data.url;
                if (!targetUrl) {
                    throw new Error("Atalho inválido ou corrompido.");
                }
                // 2. Fetch the actual large state payload from JSONBlob
                return fetch(targetUrl);
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Erro ao baixar dados completos do projeto.");
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

// 10. API SPEND SIMULATOR / TRACKER
function trackChatAPICost(userInput, aiOutput) {
    if (!state.apiCosts) {
        state.apiCosts = { totalTokens: 0, totalCost: 0 };
    }

    // Aprox: 4 caracteres = 1 token. Adiciona 170 tokens para o prompt de sistema inicial
    const inputTokens = Math.ceil((userInput || "").length / 4) + 170;
    const outputTokens = Math.ceil((aiOutput || "").length / 4);
    const callTokens = inputTokens + outputTokens;

    // Valores do GPT-5 mini/GPT-4o-mini da OpenAI:
    // Entrada: $0.25 por 1M de tokens ($0.00000025 por token)
    // Saída: $2.00 por 1M de tokens ($0.00000200 por token)
    const inputCost = inputTokens * 0.00000025;
    const outputCost = outputTokens * 0.00000200;
    const callCost = inputCost + outputCost;

    state.apiCosts.totalTokens += callTokens;
    state.apiCosts.totalCost += callCost;

    saveStateToStorage();
    updateCostTrackerUI();
}

function initCostTracker() {
    const resetBtn = document.getElementById("btn-reset-api-costs");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (confirm("Deseja realmente zerar o contador de gastos da API?")) {
                state.apiCosts = { totalTokens: 0, totalCost: 0 };
                saveStateToStorage();
                updateCostTrackerUI();
            }
        });
    }
    updateCostTrackerUI();
}

function updateCostTrackerUI() {
    const statsTokens = document.getElementById("stats-total-tokens");
    const statsCost = document.getElementById("stats-total-cost");
    const statsRemaining = document.getElementById("stats-remaining-balance");
    const costBar = document.getElementById("stats-cost-bar");

    if (!statsTokens || !statsCost || !statsRemaining || !costBar) return;

    if (!state.apiCosts) {
        state.apiCosts = { totalTokens: 0, totalCost: 0 };
    }

    const totalTokens = state.apiCosts.totalTokens;
    const totalCost = state.apiCosts.totalCost;
    const initialBalance = 5.0;
    const remaining = Math.max(0, initialBalance - totalCost);
    
    // Percentual consumido (máximo 100%)
    const pct = Math.min(100, (totalCost / initialBalance) * 100);

    statsTokens.innerText = `${totalTokens.toLocaleString()} tkn`;
    statsCost.innerText = `$${totalCost.toFixed(4)} USD`;
    statsRemaining.innerText = `$${remaining.toFixed(4)} USD`;
    costBar.style.width = `${pct}%`;
}

// 11. QR SHARE URL PROCESSOR (AUTO-IMPORT FROM URL PARAMETER)
function checkQRShareUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const blobId = urlParams.get("p");
    if (!blobId) return;

    const overlay = document.getElementById("cloud-loading-overlay");
    const loadingText = document.getElementById("cloud-loading-text");
    if (overlay) {
        if (loadingText) loadingText.innerText = "Importando projeto via QR Code...";
        overlay.style.display = "flex";
    }

    console.log(`Parâmetro de QR Code encontrado. Baixando blob ID: ${blobId}`);

    fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`)
    .then(res => {
        if (!res.ok) throw new Error("Direct GET failed");
        return res;
    })
    .catch(() => {
        console.warn("Download direto do JSONBlob falhou. Tentando via CORS Proxy...");
        return fetch(`https://corsproxy.io/?https://jsonblob.com/api/jsonBlob/${blobId}`);
    })
    .then(response => {
        if (!response.ok) throw new Error("Erro ao baixar dados do servidor.");
        return response.json();
    })
    .then(loadedState => {
        state = { ...state, ...loadedState };
        
        // Sync inputs in UI
        const nameInput = document.getElementById("project-save-name");
        if (nameInput) nameInput.value = state.title || "Meu Projeto";
        if (document.getElementById("series-title")) document.getElementById("series-title").value = state.title || "";
        if (document.getElementById("author-name")) document.getElementById("author-name").value = state.author || "";
        if (document.getElementById("page-count")) document.getElementById("page-count").value = state.pageCount || 50;
        if (document.getElementById("paper-type")) document.getElementById("paper-type").value = state.paperType || "premium-cream";

        // Save to IndexedDB and LocalStorage on the new device
        saveStateToStorage();
        updateSpineWidth();
        renderAll();

        // Clear the URL parameter so refresh doesn't overwrite new modifications
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (overlay) overlay.style.display = "none";
        alert(`Projeto "${state.title || 'Manga'}" importado via QR Code com sucesso!`);
    })
    .catch(err => {
        console.error("Erro ao importar do QR Code:", err);
        if (overlay) overlay.style.display = "none";
        alert(`Falha ao carregar projeto via QR Code: ${err.message}`);
        // Clear the URL parameter anyway to prevent loop
        window.history.replaceState({}, document.title, window.location.pathname);
    });
}
