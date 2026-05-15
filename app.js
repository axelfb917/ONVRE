// ==========================================
// 🚨 CONFIGURACIÓN DE FIREBASE 🚨
// PEGA TU CONFIGURACIÓN DE FIREBASE AQUÍ ABAJO:
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCDbmW7GoV4xZ4sFIw24Okm8zmKQPiCQKM",
    authDomain: "encuesta-a2c82.firebaseapp.com",
    databaseURL: "https://encuesta-a2c82-default-rtdb.firebaseio.com", // <- MUY IMPORTANTE PARA REALTIME DATABASE
    projectId: "encuesta-a2c82",
    storageBucket: "encuesta-a2c82.firebasestorage.app",
    messagingSenderId: "431101986210",
    appId: "1:431101986210:web:61cbe82e30f68017295efb"
};

// Inicializar Firebase (Solo si el usuario puso sus datos, sino seguimos con localStorage como fallback de prueba)
let db;
let useFirebase = firebaseConfig.apiKey !== "PEGAR_AQUI";

if (useFirebase) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// Configuración inicial por defecto (si la BD está vacía)
const defaultQuestions = [
    "Ser infiel",
    "No usar protector solar porque 'eso es de mujeres'",
    "Creer que lavar los platos es 'ayudar en casa'",
    "Responder 'ok' a un mensaje donde te abren el corazón",
    "Tener un colchón en el piso sin base de cama",
    "Usar el mismo jabón para el cuerpo, cara y cabello",
    "Escribir 'xD' de forma no irónica en 2024",
    "Pensar que mostrar emociones te hace débil"
];

let questions = [];
let globalStats = [];

function saveData() {
    if (useFirebase) {
        db.ref('muro_onvre').set({
            questions: questions,
            stats: globalStats
        });
    } else {
        localStorage.setItem('onvre_questions', JSON.stringify(questions));
        localStorage.setItem('onvre_stats', JSON.stringify(globalStats));
    }
}

let sessionVotes = {}; // { index: 'aplica'/'no-aplica' }

// Estado de la aplicación
let state = {
    answersList: {}, // Guarda { index: 'aplica'/'no-aplica' }
    pieChartInstance: null
};

// Elementos del DOM
const screens = {
    start: document.getElementById('screen-start'),
    questions: document.getElementById('screen-questions'),
    results: document.getElementById('screen-results'),
    admin: document.getElementById('screen-admin')
};

// Admin Elements
const titleMain = document.getElementById('title-main');
const adminList = document.getElementById('admin-list');
const btnAdminClose = document.getElementById('btn-admin-close');
const btnAdminReset = document.getElementById('btn-admin-reset');

const btnStart = document.getElementById('btn-start');

const questionsListContainer = document.getElementById('questions-list');
const btnContinue = document.getElementById('btn-continue');
const customTraitInput = document.getElementById('custom-trait-input');
const btnAddTrait = document.getElementById('btn-add-trait');

const statAplica = document.getElementById('stat-aplica');
const statLevel = document.getElementById('stat-level');
const btnRestart = document.getElementById('btn-restart');
const pieChartCanvas = document.getElementById('results-pie-chart');

function init() {
    if (useFirebase) {
        // Escuchar cambios en tiempo real
        db.ref('muro_onvre').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                questions = data.questions || [];
                globalStats = data.stats || [];
            } else {
                // Si la BD está completamente vacía, inicializarla
                questions = [...defaultQuestions];
                globalStats = questions.map(() => ({ aplica: 0, noAplica: 0 }));
                saveData();
            }
            // Re-renderizar UI
            renderAllQuestions();
            if (!screens.start.classList.contains('active')) {
                // Si estamos en resultados o admin, recalcular
                if (screens.results.classList.contains('active')) showResults();
                if (screens.admin.classList.contains('active')) renderAdminList();
            }
        }, (error) => {
            alert("⚠️ Error de Firebase: " + error.message + "\n\nPor favor, asegúrate de haber ido a la pestaña 'Realtime Database' en Firebase y cambiar las Reglas a '.read': 'true' y '.write': 'true'.");
            console.error("Firebase Error:", error);
        });
    } else {
        // Fallback local
        let savedQuestions = localStorage.getItem('onvre_questions');
        let savedStats = localStorage.getItem('onvre_stats');
        questions = savedQuestions ? JSON.parse(savedQuestions) : [...defaultQuestions];
        globalStats = savedStats ? JSON.parse(savedStats) : questions.map(() => ({ aplica: 0, noAplica: 0 }));
        renderAllQuestions();
    }

    attachEventListeners();
}

function renderAllQuestions() {
    questionsListContainer.innerHTML = '';
    questions.forEach((q, index) => {
        appendQuestion(q, index);
    });
}

function appendQuestion(q, index) {
    const item = document.createElement('div');
    item.className = 'question-item';

    item.innerHTML = `
        <h3>"${q}"</h3>
        <div class="poll-options">
            <div class="poll-option">
                <input type="radio" id="q${index}-aplica" name="q${index}" value="aplica">
                <label for="q${index}-aplica">✅ Aplica</label>
            </div>
            <div class="poll-option">
                <input type="radio" id="q${index}-no-aplica" name="q${index}" value="no-aplica">
                <label for="q${index}-no-aplica">❌ No aplica</label>
            </div>
        </div>
        <div class="question-bar-chart" id="chart-${index}">
            <div class="chart-stats">
                <span class="aplica-pct" id="pct-aplica-${index}">0%</span>
                <span class="no-aplica-pct" id="pct-no-aplica-${index}">0%</span>
            </div>
            <div class="inline-chart-container">
                <div class="inline-chart-fill-aplica" id="fill-aplica-${index}" style="width: 0%"></div>
                <div class="inline-chart-fill-no-aplica" id="fill-no-aplica-${index}" style="width: 0%"></div>
            </div>
        </div>
    `;

    questionsListContainer.appendChild(item);
}

function attachEventListeners() {
    // Admin Mode Trigger
    titleMain.addEventListener('dblclick', () => {
        switchScreen('start', 'admin');
        renderAdminList();
    });

    btnAdminClose.addEventListener('click', () => {
        switchScreen('admin', 'start');
    });

    btnAdminReset.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres resetear todos los votos a 0? Esta acción no se puede deshacer.')) {
            globalStats.forEach(stat => {
                stat.aplica = 0;
                stat.noAplica = 0;
            });
            saveData();
            renderAdminList();
            renderAllQuestions();
            alert('Todos los votos han sido reseteados.');
        }
    });

    btnStart.addEventListener('click', () => {
        switchScreen('start', 'questions');
    });

    questionsListContainer.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            const questionIndex = parseInt(e.target.name.replace('q', ''));
            const newAnswer = e.target.value;

            // Actualizar datos globales y persistir
            const prevAnswer = sessionVotes[questionIndex];
            if (prevAnswer) {
                if (prevAnswer === 'aplica') globalStats[questionIndex].aplica--;
                if (prevAnswer === 'no-aplica') globalStats[questionIndex].noAplica--;
            }
            if (newAnswer === 'aplica') globalStats[questionIndex].aplica++;
            if (newAnswer === 'no-aplica') globalStats[questionIndex].noAplica++;

            sessionVotes[questionIndex] = newAnswer;
            saveData();

            state.answersList[questionIndex] = newAnswer;
            checkContinueBtn();
            showInlineChart(questionIndex);
        }
    });

    customTraitInput.addEventListener('input', (e) => {
        btnAddTrait.disabled = e.target.value.trim().length < 3;
    });

    btnAddTrait.addEventListener('click', () => {
        const trait = customTraitInput.value.trim();
        if (trait) {
            const newIndex = questions.length;
            questions.push(trait);
            globalStats.push({ aplica: 0, noAplica: 0 });
            appendQuestion(trait, newIndex);

            // Auto vote 'aplica'
            const radioAplica = document.getElementById(`q${newIndex}-aplica`);
            radioAplica.checked = true;

            globalStats[newIndex].aplica++;
            sessionVotes[newIndex] = 'aplica';
            state.answersList[newIndex] = 'aplica';
            saveData();

            showInlineChart(newIndex);
            checkContinueBtn();

            customTraitInput.value = '';
            btnAddTrait.disabled = true;

            // scroll to bottom
            setTimeout(() => {
                questionsListContainer.scrollTop = questionsListContainer.scrollHeight;
            }, 100);
        }
    });

    btnContinue.addEventListener('click', () => {
        switchScreen('questions', 'results');
        showResults();
    });

    btnRestart.addEventListener('click', () => {
        resetState();
        switchScreen('results', 'start');
    });
}

// Eliminated checkStartBtn

function checkContinueBtn() {
    const answeredCount = Object.keys(state.answersList).length;
    btnContinue.disabled = answeredCount < questions.length;
}

function showInlineChart(index) {
    const chartContainer = document.getElementById(`chart-${index}`);
    chartContainer.classList.add('visible');

    const stats = globalStats[index];
    let aplica = stats.aplica;
    let noAplica = stats.noAplica;

    const total = aplica + noAplica;
    const pctAplica = total > 0 ? Math.round((aplica / total) * 100) : 0;
    const pctNoAplica = total > 0 ? Math.round((noAplica / total) * 100) : 0;

    document.getElementById(`pct-aplica-${index}`).textContent = `${pctAplica}% Aplica`;
    document.getElementById(`pct-no-aplica-${index}`).textContent = `${pctNoAplica}% No aplica`;

    // timeout to allow display:block to render before transitioning width
    setTimeout(() => {
        document.getElementById(`fill-aplica-${index}`).style.width = `${pctAplica}%`;
        document.getElementById(`fill-no-aplica-${index}`).style.width = `${pctNoAplica}%`;
    }, 50);
}

function showResults() {

    // Calcular totales usando globalStats
    let combinedStats = questions.map((q, index) => {
        let aplica = globalStats[index].aplica;
        return {
            trait: q,
            aplica: aplica
        };
    });

    // Ordenar de mayor a menor votos 'aplica'
    combinedStats.sort((a, b) => b.aplica - a.aplica);

    // Mostrar el Top 5 en la lista
    const topTraitsContainer = document.getElementById('top-traits-container');
    topTraitsContainer.innerHTML = '';

    const topCount = Math.min(5, combinedStats.length);
    for (let i = 0; i < topCount; i++) {
        const item = combinedStats[i];
        const div = document.createElement('div');
        div.style.background = 'rgba(255, 255, 255, 0.6)';
        div.style.padding = '0.8rem';
        div.style.borderRadius = '8px';
        div.style.marginBottom = '0.5rem';
        div.style.border = '1px solid var(--glass-border)';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);">#${i + 1} ${item.trait.length > 30 ? item.trait.substring(0, 30) + '...' : item.trait}</span>
                <span style="color: var(--primary-color); font-weight: 800;">${item.aplica} votos</span>
            </div>
        `;
        topTraitsContainer.appendChild(div);
    }

    // Preparar datos para la gráfica de dona (solo para el top 10 para no saturar)
    let labels = [];
    let data = [];

    const chartCount = Math.min(10, combinedStats.length);
    for (let i = 0; i < chartCount; i++) {
        labels.push(combinedStats[i].trait.length > 20 ? combinedStats[i].trait.substring(0, 20) + '...' : combinedStats[i].trait);
        data.push(combinedStats[i].aplica);
    }

    renderPieChart(labels, data);
}

function renderPieChart(labels, data) {
    if (state.pieChartInstance) {
        state.pieChartInstance.destroy();
    }

    if (data.length === 0) {
        labels = ["Nada de Onvre"];
        data = [1];
    }

    const ctx = document.getElementById('results-pie-chart').getContext('2d');

    state.pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#00f3ff', '#ff007f', '#8b5cf6', '#f97316',
                    '#10b981', '#ec4899', '#facc15', '#0ea5e9',
                    '#ef4444', '#8b5cf6'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#1e293b', font: { family: 'Outfit' } }
                }
            }
        }
    });
}

function switchScreen(fromId, toId) {
    screens[fromId].classList.remove('active');
    setTimeout(() => {
        screens[fromId].classList.add('hidden');
        screens[toId].classList.remove('hidden');
        setTimeout(() => {
            screens[toId].classList.add('active');
        }, 50);
    }, 300);
}

function resetState() {
    state.answersList = {};
    if (state.pieChartInstance) state.pieChartInstance.destroy();

    btnStart.disabled = false;
    btnContinue.disabled = true;
    btnAddTrait.disabled = true;

    renderAllQuestions();
}

// ---- Funciones de Administrador ----

function renderAdminList() {
    adminList.innerHTML = '';
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'admin-item';

        const stats = globalStats[index];
        const total = stats.aplica + stats.noAplica;

        item.innerHTML = `
            <div class="admin-item-text">#${index + 1}: ${q}</div>
            <div class="admin-item-controls">
                <span class="admin-item-stats">${stats.aplica} Aplica | ${stats.noAplica} No Aplica | ${total} Total</span>
                <div class="admin-btn-group">
                    <button class="btn-icon" title="Editar Votos" onclick="editVotes(${index})">📊</button>
                    <button class="btn-icon" title="Editar Texto" onclick="editTrait(${index})">✏️</button>
                    <button class="btn-icon delete" title="Borrar" onclick="deleteTrait(${index})">🗑️</button>
                </div>
            </div>
        `;
        adminList.appendChild(item);
    });
}

window.editTrait = function (index) {
    const newText = prompt("Edita la característica:", questions[index]);
    if (newText !== null && newText.trim() !== '') {
        questions[index] = newText.trim();
        saveData();
        renderAdminList();
        renderAllQuestions();
    }
};

window.editVotes = function (index) {
    const currentAplica = globalStats[index].aplica;
    const currentNoAplica = globalStats[index].noAplica;

    const newAplica = prompt(`Editar votos "Aplica"\nActuales: ${currentAplica}`, currentAplica);
    if (newAplica !== null && !isNaN(parseInt(newAplica))) {
        globalStats[index].aplica = parseInt(newAplica);

        const newNoAplica = prompt(`Editar votos "No Aplica"\nActuales: ${currentNoAplica}`, currentNoAplica);
        if (newNoAplica !== null && !isNaN(parseInt(newNoAplica))) {
            globalStats[index].noAplica = parseInt(newNoAplica);
            saveData();
            renderAdminList();
            renderAllQuestions(); // Para que las gráficas pequeñas se puedan recalcular
        }
    }
};

window.deleteTrait = function (index) {
    if (confirm(`¿Estás segur@ de borrar la característica: "${questions[index]}"?`)) {
        questions.splice(index, 1);
        globalStats.splice(index, 1);

        // Clean up current session state if applicable
        delete state.answersList[index];
        delete sessionVotes[index];

        // Shift remaining session votes to match new indices
        const newAnswersList = {};
        const newSessionVotes = {};
        for (const key in state.answersList) {
            let k = parseInt(key);
            if (k > index) newAnswersList[k - 1] = state.answersList[k];
            else newAnswersList[k] = state.answersList[k];
        }
        for (const key in sessionVotes) {
            let k = parseInt(key);
            if (k > index) newSessionVotes[k - 1] = sessionVotes[k];
            else newSessionVotes[k] = sessionVotes[k];
        }
        state.answersList = newAnswersList;
        sessionVotes = newSessionVotes;

        saveData();
        renderAdminList();
        renderAllQuestions();
        checkContinueBtn();
    }
};

document.addEventListener('DOMContentLoaded', init);
