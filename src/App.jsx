import React, { useState, useEffect, useCallback, useRef } from 'react';
import PuzzleQuestion from './components/PuzzleQuestion';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
import { Play, Plus, Minus, X, Divide, Heart, Star, RotateCcw, Home, Trophy, Sparkles, Clock, Award, Shield, Volume2, VolumeX, User, Brain, BookOpen, Users, Medal, XCircle, Calculator, BookText, Type, CheckSquare, Crown, HelpCircle, Search, ChevronRight, ListOrdered, AlertTriangle, Save, Swords } from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypNEzvRSkBnLJxWwzOa8KMirabo2lCT-8mCvMGkNBR08C6pQMJsvm7Ui_BTV0VdFoK/exec";

// --- CONFIGURACIÓN DEL SERVIDOR EN TIEMPO REAL (FIREBASE) ---
// 👇 PROFESOR: REEMPLACE LOS VALORES DE AQUÍ CON LOS DE SU PROPIO FIREBASE 👇
const firebaseConfig = {
  apiKey: "AIzaSyCvRa0Wol4mk84TcnIkPnnmAs_-1Uytosg",
  authDomain: "eduquest-d437f.firebaseapp.com",
  projectId: "eduquest-d437f",
  storageBucket: "eduquest-d437f.firebasestorage.app",
  messagingSenderId: "504574198544",
  appId: "1:504574198544:web:46e85b8a28315f34b6db95"
};


const APP_ID = 'eduquest-064';

// Inicialización defensiva de variables de servidor para evitar errores
let app = null;
let auth = null;
let db = null;

// Detectar modo dev a nivel de módulo para evitar inicializar Firebase en pruebas locales
const isDevGlobal = typeof window !== 'undefined' && new URLSearchParams(window.location?.search || '').get('dev') === '1';
const isFirebaseConfigured = !isDevGlobal && firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PEGAR_AQUI") && firebaseConfig.apiKey !== "";

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch(e) { 
    console.warn("Servidor Multijugador no inicializado:", e); 
  }
}

// --- SISTEMA DE SONIDO ---
const playTone = (frequency, type, duration, vol = 0.1, isMuted = false) => {
  if (isMuted) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) { console.log("Audio no soportado"); }
};

const playCorrectSound = (isMuted) => {
  playTone(600, 'sine', 0.1, 0.1, isMuted);
  setTimeout(() => playTone(880, 'sine', 0.2, 0.1, isMuted), 100);
};

const playWrongSound = (isMuted) => {
  playTone(300, 'sawtooth', 0.3, 0.2, isMuted);
  setTimeout(() => playTone(250, 'sawtooth', 0.4, 0.2, isMuted), 150);
};

const playLevelUpSound = (isMuted) => {
  [440, 554, 659, 880].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'square', 0.15, 0.05, isMuted), i * 150);
  });
};

const playSalvationSound = (isMuted) => {
  playTone(200, 'sawtooth', 0.5, 0.2, isMuted);
  setTimeout(() => playTone(200, 'sawtooth', 0.5, 0.2, isMuted), 600);
};

const playFanfareSound = (isMuted) => {
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'square', 0.2, 0.1, isMuted), i * 200);
  });
};

// --- SISTEMA DE RANGOS ---
const getRankInfo = (score) => {
  const idx = Math.floor(score / 100);
  if (idx <= 2) return { tier: 'Bronce', level: ['I', 'II', 'III'][idx], color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-500' };
  if (idx <= 5) return { tier: 'Plata', level: ['I', 'II', 'III'][idx - 3], color: 'text-gray-400', border: 'border-gray-400', bg: 'bg-gray-400' };
  if (idx <= 9) return { tier: 'Oro', level: ['I', 'II', 'III', 'IV'][idx - 6], color: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-400' };
  if (idx <= 14) return { tier: 'Platino', level: ['I', 'II', 'III', 'IV', 'V'][idx - 10], color: 'text-teal-400', border: 'border-teal-400', bg: 'bg-teal-400' };
  if (idx <= 19) return { tier: 'Diamante', level: ['I', 'II', 'III', 'IV', 'V'][idx - 15], color: 'text-blue-400', border: 'border-blue-400', bg: 'bg-blue-400' };
  if (idx <= 68) return { tier: 'Heroico', level: (idx - 19).toString(), color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-500' };
  return { tier: 'Gran Maestro', level: '', color: 'text-fuchsia-500', border: 'border-fuchsia-500', bg: 'bg-fuchsia-500' };
};

// --- DATOS GLOBALES ---
const AVATARES = ['😎', '🤓', '🤠', '😇', '🥳', '🤩', '🥸', '🦊', '🐱', '🐼', '🐯', '🐸', '🐵', '🦄', '🐲', '👽', '👻', '🤖'];

const vocabData = [
  { word: 'Feliz', syn: 'Alegre', ant: 'Triste', wrong: ['Molesto', 'Rápido', 'Cansado'] },
  { word: 'Rápido', syn: 'Veloz', ant: 'Lento', wrong: ['Fuerte', 'Pequeño', 'Alto'] },
  { word: 'Grande', syn: 'Enorme', ant: 'Pequeño', wrong: ['Largo', 'Pesado', 'Oscuro'] }
];

const syntaxData = [
  { sentence: 'El perro fiel ladra en la noche.', sujeto: 'El perro fiel', predicado: 'ladra en la noche.' },
  { sentence: 'La profesora explica la clase.', sujeto: 'La profesora', predicado: 'explica la clase.' },
  { sentence: 'Los niños alegres juegan mucho.', sujeto: 'Los niños alegres', predicado: 'juegan mucho.' }
];

const pupiletrasWords = ['GATO', 'PERRO', 'LAPIZ', 'ROSA', 'LIBRO', 'MESA', 'NUBE', 'SOL', 'LUNA', 'MAR'];

const spellingDataList = [
  { c: 'Zanahoria', w: 'Sanahoria' }, { c: 'Decisión', w: 'Desición' }, { c: 'Bicicleta', w: 'Bisicleta' },
  { c: 'Excelente', w: 'Exelente' }, { c: 'Hacer', w: 'Haser' }, { c: 'Edificio', w: 'Edeficio' },
  { c: 'Excepción', w: 'Exepción' }, { c: 'Había', w: 'Abía' }, { c: 'Vaca', w: 'Baca' }
];

const grammarData = [
  { correct: 'Juan viajó a Perú.', wrong: ['juan viajó a perú.', 'Juan viajó a perú.', 'juan Viajó a Perú.'] },
  { correct: 'Mi perro Max ladra.', wrong: ['mi perro max ladra.', 'Mi perro max ladra.', 'Mi Perro Max ladra.'] },
  { correct: 'El río Amazonas es largo.', wrong: ['El río amazonas es largo.', 'el río Amazonas es largo.', 'el Río amazonas es Largo.'] },
  { correct: 'María vive en Lima.', wrong: ['maría vive en lima.', 'María vive en lima.', 'maría Vive en Lima.'] },
  { correct: 'Ayer fuimos a España.', wrong: ['ayer fuimos a españa.', 'Ayer fuimos a españa.', 'Ayer Fuimos a españa.'] },
  { correct: 'Me gusta leer cuentos.', wrong: ['me gusta leer cuentos.', 'Me gusta Leer Cuentos.', 'Me gusta leer Cuentos.'] },
  { correct: 'En Navidad comemos panetón.', wrong: ['en navidad comemos panetón.', 'En navidad comemos panetón.', 'en Navidad comemos panetón.'] },
  { correct: 'Mi gata Luna es juguetona.', wrong: ['Mi gata luna es juguetona.', 'mi gata Luna es juguetona.', 'Mi Gata Luna Es Juguetona.'] }
];

const tfData = [
  { q: 'Los nombres propios van con mayúscula.', a: 'Verdadero' },
  { q: 'El punto se usa para terminar una oración.', a: 'Verdadero' },
  { q: 'Los sustantivos comunes se escriben con mayúscula.', a: 'Falso' },
  { q: 'Las oraciones empiezan con letra minúscula.', a: 'Falso' },
  { q: 'Los nombres de países son sustantivos propios.', a: 'Verdadero' },
  { q: 'La palabra "árbol" es un verbo.', a: 'Falso' },
  { q: 'Un verbo indica una acción o movimiento.', a: 'Verdadero' },
  { q: 'El abecedario español tiene 27 letras.', a: 'Verdadero' },
  { q: 'El sol gira alrededor de la tierra.', a: 'Falso' },
  { q: 'Los meses del año siempre se escriben con mayúscula inicial.', a: 'Falso' },
  { q: 'Una docena equivale a 12 unidades.', a: 'Verdadero' },
  { q: 'El triángulo tiene cuatro lados.', a: 'Falso' },
  { q: 'Los antónimos son palabras con significado contrario.', a: 'Verdadero' },
  { q: 'Los sinónimos se escriben igual pero significan diferente.', a: 'Falso' }
];

const orderSentences = [
  "El perro corre muy rápido", "La niña lee un gran libro", 
  "Mi mamá cocina comida rica", "Los gatos duermen en la cama"
];

const complexReadings = [
  {
    text: "José y su familia viven en el centro poblado el Palmo ubicado en el distrito de Barranca, Lima. Él está cursando el 1ro de secundaria y tiene doce años de edad. Él es muy inteligente y trabaja duro.\nEl papá de José es un agricultor exitoso. Él produce maíz en su chacra. La mamá de José también trabaja duro. Además de hacer las labores de la casa, ella vende comida en el mercado durante su tiempo libre para ayudar con el presupuesto familiar.\nDespués de la escuela, José siempre lleva a pastear al ganado. Él también ayuda a su mamá yendo a buscar agua para la casa. Jesús es compañero de aula de José y en las tardes estudia con él.",
    questions: [
      { q: "¿Cuántos años tiene José?", ans: "12", options: ["12", "7", "20", "17"] },
      { q: "¿Qué hace siempre José después de salir de la escuela?", ans: "Pastea el ganado", options: ["Ayuda en la chacra", "Vende en el mercado", "Pastea el ganado", "Juega con Jesús"] },
      { q: "¿A qué se dedica el papá de José?", ans: "Agricultor", options: ["Agricultor", "Profesor", "Vendedor", "Ganadero"] }
    ]
  },
  {
    text: "Las abejas son insectos muy trabajadores y organizados. Viven en colonias formadas por miles de individuos, donde cada uno tiene una función. La abeja reina es la única que pone huevos. Las abejas obreras son las que salen a buscar el néctar de las flores para producir miel, construyen los panales y cuidan a las larvas.\nSin las abejas, muchas plantas no podrían reproducirse, ya que ellas se encargan de la polinización al llevar el polen de flor en flor mientras buscan su alimento.",
    questions: [
      { q: "¿Quién es la única encargada de poner huevos en la colonia?", ans: "La abeja reina", options: ["La abeja reina", "La abeja obrera", "El zángano", "Cualquier abeja"] },
      { q: "¿Qué pasaría con muchas plantas si no existieran las abejas?", ans: "No podrían reproducirse", options: ["No podrían reproducirse", "Crecerían más rápido", "Darían más flores", "Se secarían por el sol"] }
    ]
  }
];

// Generador de preguntas para las batallas (por defecto 30, puede solicitar más)
const generateBattleQuestions = (count = 30) => {
  const qs = [];
  const ops = ['+', '-', '*', '/', 'vocab', 'grammar', 'tf', 'logic', 'puzzle'];
  for(let i=0; i<count; i++) {
        const op = ops[Math.floor(Math.random() * ops.length)];
        let q = { id: i, type: 'math', text: '', options: [], answer: '' };
        if (op === '+') {
            const n1 = Math.floor(Math.random() * 50) + 10;
            const n2 = Math.floor(Math.random() * 50) + 10;
            q.text = `${n1} + ${n2}`; q.answer = String(n1+n2);
            q.options = [String(n1+n2), String(n1+n2+10), String(n1+n2-5), String(n1+n2+2)].sort(()=>Math.random()-0.5);
        } else if (op === '-') {
            const n1 = Math.floor(Math.random() * 50) + 50;
            const n2 = Math.floor(Math.random() * 40) + 1;
            q.text = `${n1} - ${n2}`; q.answer = String(n1-n2);
            q.options = [String(n1-n2), String(n1-n2+5), String(n1-n2-5), String(n1-n2+10)].sort(()=>Math.random()-0.5);
        } else if (op === '*') {
            const n1 = Math.floor(Math.random() * 8) + 2;
            const n2 = Math.floor(Math.random() * 8) + 2;
            q.text = `${n1} × ${n2}`; q.answer = String(n1*n2);
            q.options = [String(n1*n2), String(n1*n2+2), String(n1*n2-2), String(n1*n2+5)].sort(()=>Math.random()-0.5);
        } else if (op === '/') {
            const n2 = Math.floor(Math.random() * 8) + 2;
            const ans = Math.floor(Math.random() * 8) + 2;
            const n1 = n2 * ans;
            q.text = `${n1} ÷ ${n2}`; q.answer = String(ans);
            q.options = [String(ans), String(ans+1), String(ans-1), String(ans+2)].sort(()=>Math.random()-0.5);
        } else if (op === 'vocab') {
            const v = vocabData[Math.floor(Math.random() * vocabData.length)];
            q.type = 'vocab'; q.text = `Sinónimo de "${v.word}"`; q.answer = v.syn;
            q.options = [v.syn, ...v.wrong.slice(0,3)].sort(()=>Math.random()-0.5);
        } else if (op === 'grammar') {
            const g = grammarData[Math.floor(Math.random() * grammarData.length)];
            q.type = 'grammar'; q.text = '¿Cuál usa bien las mayúsculas?'; q.answer = g.correct;
            q.options = [g.correct, ...g.wrong.slice(0,3)].sort(()=>Math.random()-0.5);
        } else if (op === 'tf') {
            const t = tfData[Math.floor(Math.random() * tfData.length)];
            q.type = 'tf'; q.text = t.q; q.answer = t.a;
            q.options = ['Verdadero', 'Falso'].sort(()=>Math.random()-0.5);
        } else if (op === 'logic') {
            const isAddition = Math.random() > 0.5;
            const step = Math.floor(Math.random() * 5) + 2;
            let start, ans;
            if (isAddition) {
                start = Math.floor(Math.random() * 15) + 1;
                ans = start + step * 4;
                q.text = `${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, ?`;
            } else {
                start = Math.floor(Math.random() * 30) + 40;
                ans = start - step * 4;
                q.text = `${start}, ${start - step}, ${start - step * 2}, ${start - step * 3}, ?`;
            }
            q.type = 'logic'; q.answer = String(ans);
            q.options = [String(ans), String(ans + step), String(ans - 1), String(ans + 2)].sort(()=>Math.random()-0.5);
        }
        else if (op === 'puzzle') {
            const sentences = [
              'La independencia del Perú es importante',
              'Túpac Amaru fue un líder histórico',
              'El imperio Inca tenía una organización compleja',
              'La educación es la base del progreso'
            ];
            const s = sentences[Math.floor(Math.random()*sentences.length)];
            const frags = s.split(' ').slice(0,6);
            const answer = frags.join('||');
            q.type = 'puzzle'; q.text = 'Ordena la frase'; q.fragments = frags; q.answer = answer;
            q.options = [];
        }
        qs.push(q);
    }
    return qs;
}


export default function App() {
  // MODO DESARROLLO LOCAL: si la URL contiene ?dev=1 activamos simulación
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
  const devAutoRegister = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev_register');

  const [gameState, setGameState] = useState('start'); 
  const [isMuted, setIsMuted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDiploma, setShowDiploma] = useState(false);
  const [showRankGuide, setShowRankGuide] = useState(false);
  
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('😎');
  const [globalScore, setGlobalScore] = useState(0); 
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoadingScores, setIsLoadingScores] = useState(true);
  
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const lastQuestionType = useRef(null);

  const [wsStartCell, setWsStartCell] = useState(null);
  const [wsFound, setWsFound] = useState(false);
  const [orderAvailable, setOrderAvailable] = useState([]);
  const [orderSelected, setOrderSelected] = useState([]);

  const [playersList, setPlayersList] = useState([]);

  // ESTADOS DEL SERVIDOR MULTIJUGADOR
  const [fbUser, setFbUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pendingChallenge, setPendingChallenge] = useState(null);
  const [activeBattle, setActiveBattle] = useState(null);
  const [activeBattleId, setActiveBattleId] = useState(null);
  const [isBattleAnimating, setIsBattleAnimating] = useState(false);

  // NUEVOS ESTADOS PARA EL SISTEMA DE APUESTAS
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [betAmount, setBetAmount] = useState(0);

  // 1. INICIALIZAR SESIÓN ANÓNIMA MULTIJUGADOR (REQUERIDO POR FIREBASE)
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch(e) { console.error("Error Auth Multijugador", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // 2. MANTENERSE EN LÍNEA EN EL LOBBY
  useEffect(() => {
    if (!fbUser || !db || gameState !== 'dashboard' || !playerName) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'online_users', fbUser.uid);
    const setOnline = async () => {
        await setDoc(ref, { uid: fbUser.uid, name: playerName, avatar: playerAvatar, score: globalScore, lastPing: Date.now(), status: activeBattleId ? 'in_battle' : 'idle' });
    };
    setOnline();
    const iv = setInterval(() => { updateDoc(ref, { lastPing: Date.now() }).catch(()=>{}); }, 10000);
    return () => { clearInterval(iv); deleteDoc(ref).catch(()=>{}); };
  }, [fbUser, db, gameState, playerName, playerAvatar, activeBattleId, globalScore]);

  // 3. RECUPERAR A LOS COMPAÑEROS CONECTADOS
  useEffect(() => {
    if (!fbUser || !db || gameState !== 'dashboard') return;
    const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'online_users');
    const unsub = onSnapshot(ref, (snap) => {
        const now = Date.now();
        const users = [];
        snap.forEach(d => {
            const u = d.data();
            if (now - u.lastPing < 30000 && u.uid !== fbUser.uid) users.push(u);
        });
        setOnlineUsers(users);
    }, (e) => console.error(e));
    return () => unsub();
  }, [fbUser, db, gameState]);

  // Listener independiente para modo dev: sincroniza batallas simuladas via localStorage
  useEffect(() => {
    if (!devMode) return;
    const checkAll = () => {
      try {
        for (let i=0;i<localStorage.length;i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('dev_battle_')) continue;
          const data = JSON.parse(localStorage.getItem(key));
          if (!data) continue;
          if (data.status === 'pending' && (data.player2?.name === playerName || data.player2?.uid === fbUser?.uid)) {
            setPendingChallenge(data);
          }
          if ((data.status === 'active' || data.status === 'finished') && (data.player1?.uid === fbUser?.uid || data.player2?.uid === fbUser?.uid || data.player1?.name === playerName || data.player2?.name === playerName)) {
            setActiveBattle(data);
            if (data.status === 'active' && gameState !== 'battle' && gameState !== 'battle_over') {
              setActiveBattleId(data.id); setGameState('battle');
            }
            if (data.status === 'finished' && gameState !== 'battle_over') {
              setActiveBattleId(data.id); setGameState('battle_over');
            }
          }
        }
      } catch(e) { console.error(e); }
    };

    const handler = (e) => {
      if (!e.key || !e.key.startsWith('dev_battle_')) return;
      try {
        const data = JSON.parse(e.newValue || localStorage.getItem(e.key) || '{}');
        if (!data) return;
        if (data.status === 'pending' && (data.player2?.name === playerName || data.player2?.uid === fbUser?.uid)) {
          setPendingChallenge(data);
        }
        if ((data.status === 'active' || data.status === 'finished') && (data.player1?.uid === fbUser?.uid || data.player2?.uid === fbUser?.uid || data.player1?.name === playerName || data.player2?.name === playerName)) {
          console.log('DEV active battle apply', { battleId: data.id, status: data.status, playerName, gameState });
          setActiveBattle(data);
          if (data.status === 'active' && gameState !== 'battle' && gameState !== 'battle_over') {
            setActiveBattleId(data.id); setGameState('battle');
          }
        }
      } catch(err) { console.error(err); }
    };

    window.addEventListener('storage', handler);
    // También comprobar al montar
    checkAll();
    return () => window.removeEventListener('storage', handler);
  }, [devMode, fbUser, playerName, gameState]);

  // Dev mode: auto-registrar un jugador falso en el lobby (útil para pruebas locales)
  useEffect(() => {
    if (!devMode || gameState !== 'dashboard') return;
    if (devAutoRegister) {
      try {
        const name = devAutoRegister;
        const fake = { uid: 'dev_' + name, name, avatar: '🤖', score: 0 };
        setOnlineUsers(prev => {
          const found = prev.find(p => p.name === name);
          if (found) return prev;
          return [fake, ...prev];
        });
      } catch(e) { console.error(e); }
    }
  }, [devMode, devAutoRegister, gameState]);

  // 4. ESCUCHAR LOS RETOS DE BATALLA (CORRECCIÓN DE BUGS Y APUESTAS)
  useEffect(() => {
    if (!fbUser || !db) return;
    const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'battles');
    const unsub = onSnapshot(ref, (snap) => {
        let pChallenge = null;
        let aBattle = null;
        const now = Date.now();

        snap.forEach(d => {
            const b = d.data();
            if (!b) return;
            
            // FILTRO CRUCIAL: Ignorar cualquier batalla vieja que tenga más de 5 minutos (300000ms)
            if (!b.timestamp || now - b.timestamp > 300000) {
               return; 
            }

            // CORRECCIÓN CLAVE: Nos aseguramos de que fbUser exista firmemente antes de comparar IDs
            if (fbUser && b.status === 'pending' && b.player2?.uid === fbUser.uid) {
                pChallenge = b;
            }
            
            if (fbUser && (b.status === 'active' || b.status === 'finished') && b.questions && b.questions.length > 0) {
                if (b.player1?.uid === fbUser.uid || b.player2?.uid === fbUser.uid) {
                    if (!aBattle || b.timestamp > aBattle.timestamp) {
                       aBattle = b;
                    }
                }
            }
        });
        
        setPendingChallenge(pChallenge);
        setActiveBattle(aBattle);

        // Si tenemos una batalla activa y fresca, ¡entra a la arena!
        if (aBattle && aBattle.status === 'active' && gameState !== 'battle' && gameState !== 'battle_over') {
          setActiveBattleId(aBattle.id);
          setGameState('battle');
        }

        // Si ambos jugadores terminaron pero aún está 'active', intentar finalizar de forma atómica
        if (!devMode && aBattle && aBattle.status === 'active' && aBattle.player1?.done && aBattle.player2?.done) {
          try { finalizeBattle(aBattle.id); } catch(e){ console.error('Error auto-finalize', e); }
        }

        // Si la batalla desaparece (por ejemplo alguien la cancela desde otro dispositivo),
        // evita quedarse en pantalla en blanco obligando a volver al lobby.
        if (!aBattle && (gameState === 'battle' || gameState === 'battle_over')) {
          setActiveBattleId(null);
          setActiveBattle(null);
          setGameState('dashboard');
        }
    }, (e) => console.error(e));
    // Si estamos en devMode también escuchamos storage para batallas simuladas
    const storageHandler = (e) => {
      if (!devMode) return;
      try {
        console.log('DEV storage event', { key: e.key, newValue: e.newValue, playerName });
        if (!e.key || !e.key.startsWith('dev_battle_')) return;
        if (e.newValue === null) {
          const removedId = e.key.replace('dev_battle_', '');
          if (pendingChallenge?.id === removedId) setPendingChallenge(null);
          if (activeBattle?.id === removedId) {
            setActiveBattle(null);
            setActiveBattleId(null);
            if (gameState !== 'dashboard') setGameState('dashboard');
          }
          return;
        }
        const data = JSON.parse(e.newValue || localStorage.getItem(e.key) || '{}');
        if (!data) return;
        // Si soy el desafiado y el reto está pendiente, muéstralo
        if (data.status === 'pending' && (data.player2?.name === playerName || data.player2?.uid === fbUser?.uid)) {
          setPendingChallenge(data);
        }
        // Si la batalla es active/finished y me involucra, actualízala
        if ((data.status === 'active' || data.status === 'finished') && (data.player1?.uid === fbUser?.uid || data.player2?.uid === fbUser?.uid || data.player1?.name === playerName || data.player2?.name === playerName)) {
          setActiveBattle(data);
          if (data.status === 'active' && gameState !== 'battle' && gameState !== 'battle_over') {
            setActiveBattleId(data.id); setGameState('battle');
          }
          if (data.status === 'finished' && gameState !== 'battle_over') {
            setActiveBattleId(data.id); setGameState('battle_over');
          }
        }
        if (data.status === 'pending' || data.status === 'canceled') {
          if (pendingChallenge?.id === data.id) {
            setPendingChallenge(null);
          }
          if (activeBattle?.id === data.id && gameState !== 'battle') {
            setActiveBattle(null);
            setActiveBattleId(null);
          }
        }
      } catch(err) { console.error(err); }
    };
    window.addEventListener('storage', storageHandler);
    return () => { unsub(); window.removeEventListener('storage', storageHandler); };
  }, [fbUser, db, gameState]);

  // 5. CALCULAR GANADOR AL TERMINAR LA BATALLA CON PUNTOS DE APUESTA
  useEffect(() => {
    if (activeBattle && activeBattle.status === 'finished' && gameState === 'battle') {
        setGameState('battle_over');
        const isP1 = activeBattle.player1?.uid === fbUser?.uid;
        const me = (isP1 ? activeBattle.player1 : activeBattle.player2) || { score: 0, currentQ: 0 };
        const opp = (isP1 ? activeBattle.player2 : activeBattle.player1) || { score: 0, currentQ: 0 };
        const bet = activeBattle.betAmount || 0; // Puntos en juego

        if (me.score > opp.score || (me.score === opp.score && me.currentQ >= opp.currentQ)) {
            playFanfareSound(isMuted);
            // Si gana, se le SUMA la apuesta a sus puntos globales
            const newGlobal = globalScore + bet;
            setGlobalScore(newGlobal);
            saveScoreToFirebase(playerName, newGlobal, playerAvatar);
        } else {
            playWrongSound(isMuted);
            // Si pierde, se le RESTA la apuesta a sus puntos globales
            const newGlobal = Math.max(0, globalScore - bet);
            setGlobalScore(newGlobal);
            saveScoreToFirebase(playerName, newGlobal, playerAvatar);
        }
    }
  }, [activeBattle, gameState, fbUser, globalScore, isMuted, playerAvatar, playerName]);

  // FUNCIONES DE CONTROL MULTIJUGADOR Y APUESTAS
  const openBetModal = (opponent) => {
    playTone(400, 'sine', 0.1, 0.1, isMuted);
    setChallengeTarget(opponent);
    // Calcular máximo apostable (el menor de los puntajes de los dos)
    const maxBet = Math.min(globalScore, opponent.score);
    // Si tienen 0 puntos, no pueden apostar nada. 
    setBetAmount(Math.min(50, maxBet)); 
  };

  // Finaliza batalla en devMode: aplicar apuesta y actualizar playersList/localStorage
  const finalizeBattleDev = (data) => {
    try {
      if (!data || data.status !== 'finished') return;
      const p1 = data.player1 || {};
      const p2 = data.player2 || {};
      const p1Score = p1.score || 0;
      const p2Score = p2.score || 0;
      let winner = null;
      if (p1Score > p2Score) winner = 'player1';
      else if (p2Score > p1Score) winner = 'player2';
      else winner = (p1.currentQ || 0) >= (p2.currentQ || 0) ? 'player1' : 'player2';

      const bet = data.betAmount || 0;
      if (bet !== 0) {
        const winnerName = winner === 'player1' ? p1.name : p2.name;
        const key = `eduquest_score_${winnerName.toLowerCase()}`;
        const existing = Number(localStorage.getItem(key) || 0);
        localStorage.setItem(key, existing + bet);
        // update local playersList state
        setPlayersList(prev => {
          const updated = prev.filter(p => p.name.toLowerCase() !== winnerName.toLowerCase());
          updated.push({ name: winnerName, score: existing + bet, avatar: winner === 'player1' ? p1.avatar : p2.avatar });
          return updated.sort((a,b)=>b.score-a.score);
        });
      }

      // ensure activeBattle updated and show over screen
      setActiveBattle(data);
      setActiveBattleId(data.id);
      setGameState('battle_over');
    } catch(e) { console.error('Error finalizando dev battle', e); }
  };

  const confirmChallenge = async () => {
    if (devMode) {
      // Simular batalla usando localStorage para pruebas E2E sin Firebase
      if (!challengeTarget) return;
      // no permitir crear si ya estoy en batalla
      if (activeBattleId || gameState === 'battle') {
        console.warn('Ya estás en batalla, no puedes enviar otro reto');
        return;
      }
      const opponent = challengeTarget;
      setChallengeTarget(null);
      playTone(500, 'sine', 0.1, 0.1, isMuted);
      const myUid = 'dev_' + playerName;
      const opponentUid = 'dev_' + (opponent.name || opponent);
      const battleId = 'dev_' + playerName + '_' + Date.now();
      const battle = {
        id: battleId,
        status: 'pending',
        timestamp: Date.now(),
        betAmount: betAmount,
        player1: { uid: myUid, name: playerName, avatar: playerAvatar, score: 0, currentQ: 0, done: false },
        player2: { uid: opponentUid, name: opponent.name || opponent, avatar: opponent.avatar || '🤖', score: 0, currentQ: 0, done: false },
        questions: []
      };
      localStorage.setItem('dev_battle_' + battleId, JSON.stringify(battle));
      // también disparar evento storage manual para navegadores que no escuchen en mismo contexto
      window.dispatchEvent(new StorageEvent('storage', { key: 'dev_battle_' + battleId, newValue: JSON.stringify(battle) }));
      setActiveBattle(battle);
      setActiveBattleId(battleId);
      return;
    }

    if (!db || !fbUser || !challengeTarget) return;
    // evitar crear si ya estoy en batalla
    if (activeBattleId || gameState === 'battle') {
      console.warn('Ya estás en batalla, no puedes enviar otro reto');
      return;
    }
    playTone(500, 'sine', 0.1, 0.1, isMuted);
    
    const opponent = challengeTarget;
    setChallengeTarget(null); // Cerrar modal

    const battleId = fbUser.uid + "_" + Date.now();
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', battleId);
    await setDoc(ref, {
      id: battleId,
      status: 'pending',
      timestamp: Date.now(), 
      betAmount: betAmount, // Guardar la apuesta en Firebase
      player1: { uid: fbUser.uid, name: playerName, avatar: playerAvatar, score: 0, currentQ: 0, done: false },
      player2: { uid: opponent.uid, name: opponent.name, avatar: opponent.avatar, score: 0, currentQ: 0, done: false },
      questions: []
    });
    setActiveBattle({ id: battleId, status: 'pending', timestamp: Date.now(), betAmount, player2: opponent, player1: { uid: fbUser.uid, score: 0, currentQ: 0 } });
  };

  const acceptChallenge = async (battle) => {
    if (devMode) {
      try {
        // si ya estoy en batalla, no aceptar
        if (activeBattleId || gameState === 'battle') return;
        const key = 'dev_battle_' + battle.id;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.status !== 'pending') return;
        // Permitir aceptar si el nombre coincide (modo dev no depende de auth)
        if (!((data.player2?.name && data.player2.name === playerName) || (data.player2?.uid && data.player2.uid === ('dev_' + playerName)))) return;
        playTone(600, 'square', 0.2, 0.1, isMuted);
        setPendingChallenge(null);
        const qs = generateBattleQuestions(30);
        data.status = 'active'; data.questions = qs; data.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(data));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
        setActiveBattle(data);
        setActiveBattleId(data.id);
        setGameState('battle');
      } catch(e) { console.error(e); }
      return;
    }

    if (!db || !fbUser) return;
    // si ya estoy en batalla, no aceptar
    if (activeBattleId || gameState === 'battle') return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', battle.id);
    try {
      // Leer el estado actual y validar que aún está pendiente y que el receptor es quien acepta
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== 'pending') return; // alguien ya aceptó/canceló
      if (data.player2?.uid !== fbUser.uid) return; // solo el desafiado puede aceptar

      playTone(600, 'square', 0.2, 0.1, isMuted);
      setPendingChallenge(null);

      // Generar 30 preguntas para que la batalla termine correctamente
      const qs = generateBattleQuestions(30);
      await updateDoc(ref, { status: 'active', questions: qs, timestamp: Date.now() });
    } catch (e) { console.error('Error aceptando reto', e); }
  };

  // Finaliza la batalla de forma atómica en Firebase: marca finished y aplica apuestas/puntos
  const finalizeBattle = async (battleId) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', battleId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;
        if (data.status === 'finished') return;

        // calcular ganador
        const p1 = data.player1 || {};
        const p2 = data.player2 || {};
        const p1Score = p1.score || 0;
        const p2Score = p2.score || 0;
        let winner = null;
        if (p1Score > p2Score) winner = 'player1';
        else if (p2Score > p1Score) winner = 'player2';
        else winner = (p1.currentQ || 0) >= (p2.currentQ || 0) ? 'player1' : 'player2';

        const bet = data.betAmount || 0;

        console.log('finalizeBattle: applying transaction', { battleId: battleId, winner, bet });

        // marcar finished
        tx.update(ref, { status: 'finished', timestamp: Date.now() });

        // ajustar puntajes en players collection de forma segura (leer y sumar)
        if (bet !== 0) {
          const p1Ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'players', (p1.name || 'player1').toLowerCase());
          const p2Ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'players', (p2.name || 'player2').toLowerCase());
          if (winner === 'player1') {
            const p1Doc = await tx.get(p1Ref);
            const current = p1Doc.exists() ? (p1Doc.data().score || 0) : 0;
            tx.set(p1Ref, { name: p1.name, score: current + bet }, { merge: true });
          } else {
            const p2Doc = await tx.get(p2Ref);
            const current = p2Doc.exists() ? (p2Doc.data().score || 0) : 0;
            tx.set(p2Ref, { name: p2.name, score: current + bet }, { merge: true });
          }
        }
        console.log('finalizeBattle: transaction queued');
      });
      console.log('finalizeBattle: transaction committed for', battleId);
    } catch (e) { console.error('Error finalizando batalla', e); }
  };

  const declineChallenge = async (battle) => {
    if (!battle) return;
    if (devMode) {
      const key = 'dev_battle_' + battle.id;
      localStorage.removeItem(key);
      window.dispatchEvent(new StorageEvent('storage', { key, oldValue: JSON.stringify(battle), newValue: null }));
      setPendingChallenge(null);
      return;
    }

    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', battle.id);
    try {
      await deleteDoc(ref);
      setPendingChallenge(null);
    } catch (e) { console.error('Error rechazando reto', e); }
  };

  const handleBattleAnswer = async (ans) => {
    if (isBattleAnimating || !activeBattle) return;
    setIsBattleAnimating(true);

    const myUid = fbUser?.uid || ('dev_' + playerName);
    const isP1 = devMode
      ? activeBattle.player1?.name === playerName
      : activeBattle.player1?.uid === myUid;
    const playerKey = isP1 ? 'player1' : 'player2';
    const me = (isP1 ? activeBattle.player1 : activeBattle.player2) || { score: 0, currentQ: 0 };
    const questions = activeBattle.questions || [];
    const q = questions[me.currentQ || 0];
    let ref = null;
    if (!devMode) {
      if (!db) {
        setIsBattleAnimating(false);
        return;
      }
      ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', activeBattle.id);
    }

    if (!q) {
      setIsBattleAnimating(false);
      return;
    }

    try {
      const nextQ = (me.currentQ || 0) + 1;
      // soportar objetos { answer, timeTakenMs } desde preguntas puzzle
      let normalizedAns = '';
      let timeBonus = 0;
      if (ans && typeof ans === 'object' && 'answer' in ans) {
        normalizedAns = String(ans.answer).trim();
        const t = Number(ans.timeTakenMs || 0);
        // bonus simple: hasta 5s da bonus decreciente (2 puntos por segundo rápido)
        timeBonus = Math.max(0, Math.ceil((5000 - t) / 1000)) * 2;
      } else {
        normalizedAns = String(ans).trim();
      }
      const normalizedCorrect = String(q.answer).trim();
      if (devMode) {
        // Actualizar batalla simulada en localStorage
        const key = 'dev_battle_' + activeBattle.id;
        const raw = localStorage.getItem(key);
        const data = raw ? JSON.parse(raw) : activeBattle;
        if (normalizedAns === normalizedCorrect) {
          playCorrectSound(isMuted);
          data[playerKey].score = (data[playerKey].score || 0) + 10 + timeBonus;
          data[playerKey].currentQ = nextQ;
        } else {
          playWrongSound(isMuted);
          data[playerKey].currentQ = nextQ;
        }
        if (nextQ >= (data.questions?.length || 30)) {
          data[playerKey].done = true;
        }
        // Si ambos terminaron, finalizar
        if (data.player1?.done && data.player2?.done) {
          data.status = 'finished';
        }
        data.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(data));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
        setActiveBattle(data);
        setActiveBattleId(data.id);
        if (data.status === 'finished') {
          // aplicar premio/ajuste localmente y mostrar pantalla final
          finalizeBattleDev(data);
        }
      } else {
        if (normalizedAns === normalizedCorrect) {
          playCorrectSound(isMuted);
          await updateDoc(ref, { [`${playerKey}.score`]: (me.score || 0) + 10 + timeBonus, [`${playerKey}.currentQ`]: nextQ });
        } else {
          playWrongSound(isMuted);
          await updateDoc(ref, { [`${playerKey}.currentQ`]: nextQ });
        }

        // Si llega al final, marcamos done para este jugador
        if (nextQ >= 30) {
          await updateDoc(ref, { [`${playerKey}.done`]: true });
          // Leer el documento para comprobar si el otro jugador ya terminó
          const snap = await getDoc(ref);
          const data = snap.exists() ? snap.data() : null;
          const p1Done = data?.player1?.done;
          const p2Done = data?.player2?.done;
          if (p1Done && p2Done) {
            // finalizar de forma atómica
            await finalizeBattle(activeBattle.id);
          }
        }
      }
    } catch(e) { console.error(e); }

    setTimeout(() => setIsBattleAnimating(false), 500);
  };

  // --- LÓGICA DE FIREBASE (EXCEL REEMPLAZADO) ---
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
       setPlayersList([
         { name: "Alexis", score: 450, avatar: "🦊" },
         { name: "Ariana", score: 320, avatar: "🐼" },
         { name: "Phiero", score: 280, avatar: "🤖" },
         { name: "Jairo", score: 150, avatar: "🦁" }
       ]);
       setIsLoadingScores(false);
       return;
    }

    const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'players');
    const unsub = onSnapshot(ref, (snap) => {
        const users = [];
        snap.forEach(d => {
            const data = d.data();
            if (data && data.name) users.push(data);
        });
        users.sort((a, b) => b.score - a.score);
        setPlayersList(users);
        setIsLoadingScores(false);
    }, (e) => console.error(e));
    return () => unsub();
  }, [fbUser, db]);

  useEffect(() => {
    const savedName = localStorage.getItem('eduquest_name');
    const savedAvatar = localStorage.getItem('eduquest_avatar');
    if (savedName) setPlayerName(savedName);
    if (savedAvatar) setPlayerAvatar(savedAvatar);
  }, []);

  const saveScoreToFirebase = async (name, currentScore, avatar) => {
    setIsSaving(true);
    if (isFirebaseConfigured && db && fbUser) {
      try {
        const playerRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'players', name.toLowerCase());
        await setDoc(playerRef, {
            name: name,
            score: currentScore,
            avatar: avatar,
            lastUpdated: Date.now()
        }, { merge: true });
      } catch (error) { console.error("Error:", error); }
    } else {
      localStorage.setItem(`eduquest_score_${name.toLowerCase()}`, currentScore);
      localStorage.setItem(`eduquest_avatar_${name.toLowerCase()}`, avatar);
      setPlayersList(prev => {
        const updated = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
        updated.push({ name, score: currentScore, avatar });
        return updated.sort((a, b) => b.score - a.score);
      });
    }
    setTimeout(() => setIsSaving(false), 1000);
  };

  // TIMER UN SOLO JUGADOR
  useEffect(() => {
    if ((gameState === 'playing' || gameState === 'salvation') && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if ((gameState === 'playing' || gameState === 'salvation') && timeLeft === 0) {
      setGameState('gameover');
      saveScoreToFirebase(playerName, globalScore, playerAvatar);
    }
  }, [timeLeft, gameState, globalScore, playerName, playerAvatar]);

  const generateQuestion = useCallback(() => {
    let correctAnswer, options = [], displayText;
    let questionType;
    setWsStartCell(null);
    setWsFound(false);
    setOrderAvailable([]);
    setOrderSelected([]);

    const allTypes = ['+', '-', '*', '/', 'logic', 'vocab', 'grammar', 'tf', 'syntax', 'wordsearch', 'spelling', 'order', 'complex_reading'];
    let availableTypes = allTypes.filter(t => t !== lastQuestionType.current);
    let selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    lastQuestionType.current = selectedType;
    const currentLevel = Math.max(1, Math.floor(globalScore / 100) + 1);

    if (selectedType === 'complex_reading') {
        const reading = complexReadings[Math.floor(Math.random() * complexReadings.length)];
        const q = reading.questions[Math.floor(Math.random() * reading.questions.length)];
        setQuestion({ type: 'complex_reading', text: reading.text, qText: q.q, answer: q.ans, options: [...q.options].sort(()=>Math.random()-0.5) });
        return;
    }
    else if (selectedType === 'wordsearch') {
      const target = pupiletrasWords[Math.floor(Math.random() * pupiletrasWords.length)];
      const grid = Array(6).fill(null).map(() => Array(6).fill(''));
      const isHorizontal = Math.random() > 0.5;
      let r, c;
      if (isHorizontal) {
         r = Math.floor(Math.random() * 6); c = Math.floor(Math.random() * (6 - target.length + 1));
         for(let i=0; i<target.length; i++) grid[r][c+i] = target[i];
      } else {
         r = Math.floor(Math.random() * (6 - target.length + 1)); c = Math.floor(Math.random() * 6);
         for(let i=0; i<target.length; i++) grid[r+i][c] = target[i];
      }
      const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
      for(let i=0; i<6; i++) for(let j=0; j<6; j++) if(!grid[i][j]) grid[i][j] = alphabet[Math.floor(Math.random() * alphabet.length)];
      setQuestion({ type: 'wordsearch', text: `Encuentra: ${target}`, op: selectedType, answer: target, grid, startCoord: [r, c], endCoord: isHorizontal ? [r, c + target.length - 1] : [r + target.length - 1, c], options: [] });
      return;
    }
    else if (selectedType === 'order') {
      const sentence = orderSentences[Math.floor(Math.random() * orderSentences.length)];
      const words = sentence.split(" ");
      let shuffled = [...words].sort(() => Math.random() - 0.5);
      while(shuffled.join(" ") === sentence) shuffled = [...words].sort(() => Math.random() - 0.5);
      setOrderAvailable(shuffled);
      setQuestion({ type: 'order', text: 'Ordena la oración tocando las palabras:', op: selectedType, answer: sentence, options: [] });
      return;
    }
    else if (selectedType === 'spelling') {
      questionType = 'spelling';
      const item = spellingDataList[Math.floor(Math.random() * spellingDataList.length)];
      const otherCorrects = spellingDataList.filter(d => d.c !== item.c).map(d => d.c).sort(() => 0.5 - Math.random()).slice(0, 3);
      displayText = '¿Qué palabra está MAL escrita?';
      correctAnswer = item.w; options = [item.w, ...otherCorrects];
    }
    else if (selectedType === 'vocab') {
      questionType = 'vocab';
      const isSyn = Math.random() > 0.5; const data = vocabData[Math.floor(Math.random() * vocabData.length)];
      displayText = isSyn ? `Sinónimo de "${data.word}"` : `Antónimo de "${data.word}"`;
      correctAnswer = isSyn ? data.syn : data.ant; options = [correctAnswer, ...data.wrong.slice(0,3)];
    }
    else if (selectedType === 'grammar') {
      questionType = 'grammar';
      const item = grammarData[Math.floor(Math.random() * grammarData.length)];
      displayText = '¿Cuál usa bien las mayúsculas?'; 
      correctAnswer = item.correct; 
      options = [item.correct, ...item.wrong].slice(0, 4);
    }
    else if (selectedType === 'tf') {
      questionType = 'tf';
      const item = tfData[Math.floor(Math.random() * tfData.length)];
      displayText = item.q; 
      correctAnswer = item.a; 
      options = ['Verdadero', 'Falso'];
    }
    else if (selectedType === 'syntax') {
      questionType = 'syntax';
      const data = syntaxData[Math.floor(Math.random() * syntaxData.length)];
      const askSubject = Math.random() > 0.5;
      displayText = `"${data.sentence}" || ¿Cuál es el ${askSubject ? 'SUJETO' : 'PREDICADO'}?`;
      correctAnswer = askSubject ? data.sujeto : data.predicado;
      options = [correctAnswer, askSubject ? data.predicado : data.sujeto];
    }
    else if (selectedType === 'logic') {
      questionType = 'logic';
      const isAddition = Math.random() > 0.5;
      const step = Math.floor(Math.random() * 5) + 2; // salto entre 2 y 6
      let start;
      if (isAddition) {
          start = Math.floor(Math.random() * 15) + 1;
          correctAnswer = start + step * 4;
          displayText = `${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, ?`;
      } else {
          start = Math.floor(Math.random() * 30) + 40;
          correctAnswer = start - step * 4;
          displayText = `${start}, ${start - step}, ${start - step * 2}, ${start - step * 3}, ?`;
      }
    }
    else {
      questionType = 'math';
      let num1, num2; 
      if (selectedType === '+') { 
        const useThree = Math.random() > 0.5 && currentLevel >= 2;
        if (useThree) {
           num1 = Math.floor(Math.random() * 50 * currentLevel) + 10; num2 = Math.floor(Math.random() * 50 * currentLevel) + 10; const num3 = Math.floor(Math.random() * 50 * currentLevel) + 10;
           correctAnswer = num1 + num2 + num3; displayText = `${num1} + ${num2} + ${num3}`;
        } else {
           num1 = Math.floor(Math.random() * 100 * currentLevel) + 20; num2 = Math.floor(Math.random() * 100 * currentLevel) + 20;
           correctAnswer = num1 + num2; displayText = `${num1} + ${num2}`;
        }
      }
      else if (selectedType === '-') { 
         num1 = Math.floor(Math.random() * 100 * currentLevel) + 50; num2 = Math.floor(Math.random() * num1); 
         correctAnswer = num1 - num2; displayText = `${num1} - ${num2}`;
      }
      else if (selectedType === '*') { num1 = Math.floor(Math.random() * 5) + 2; num2 = Math.floor(Math.random() * 5) + 2; correctAnswer = num1 * num2; displayText = `${num1} × ${num2}`;}
      else if (selectedType === '/') { num2 = Math.floor(Math.random() * 5) + 1; correctAnswer = Math.floor(Math.random() * 5) + 1; num1 = num2 * correctAnswer; displayText = `${num1} ÷ ${num2}`;}
    }

    if (questionType === 'math' || ['spelling','vocab','grammar','tf','syntax','logic'].includes(questionType)) {
      if(questionType === 'math' || questionType === 'logic') {
        const optionsSet = new Set([correctAnswer]);
        while (optionsSet.size < 4) {
          let wrongAnswer = correctAnswer + (Math.floor(Math.random() * 15) + 1) * (Math.random() > 0.5 ? 1 : -1);
          if(wrongAnswer === correctAnswer) wrongAnswer++;
          optionsSet.add(wrongAnswer);
        }
        options = Array.from(optionsSet).sort(() => Math.random() - 0.5);
      } else {
        options = options.sort(() => Math.random() - 0.5);
      }
      setQuestion({ type: questionType, text: displayText || '', op: selectedType, answer: correctAnswer, options });
    }
  }, [globalScore]);

  const handleNameSubmit = () => {
    if (playerName.trim() === '') return;
    playTone(400, 'sine', 0.05, 0.1, isMuted);
    setGameState('avatar_select');
  };

  const handleAvatarSelect = (emoji) => {
    setPlayerAvatar(emoji);
    localStorage.setItem('eduquest_name', playerName.trim());
    localStorage.setItem('eduquest_avatar', emoji);
    
    const existingPlayer = playersList.find(p => p.name?.toLowerCase() === playerName.trim().toLowerCase());
    if (existingPlayer) {
       setGlobalScore(existingPlayer.score);
       saveScoreToFirebase(playerName.trim(), existingPlayer.score, emoji);
    } else {
       setGlobalScore(0);
       saveScoreToFirebase(playerName.trim(), 0, emoji);
    }
    
    playTone(450, 'sine', 0.05, 0.1, isMuted);
    setGameState('dashboard');
  };

  const startGame = () => {
    playTone(400, 'sine', 0.05, 0.1, isMuted);
    setLives(3);
    setTimeLeft(60);
    setCorrectAnswersCount(0);
    generateQuestion();
    setGameState('playing');
  };

  const handleAnswer = (selectedAnswer) => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Normalizar a string y recortar espacios para evitar falsos negativos
    const normalizedSel = String(selectedAnswer).trim();
    const normalizedCorrect = String(question?.answer).trim();

    if (normalizedSel === normalizedCorrect) {
      setFeedback('correct'); playCorrectSound(isMuted);
      const newScore = globalScore + 10; setGlobalScore(newScore); setTimeLeft(prev => prev + 10);
      const count = correctAnswersCount + 1; setCorrectAnswersCount(count);
      
      if (count % 3 === 0) saveScoreToFirebase(playerName, newScore, playerAvatar);
      if (Math.floor(newScore / 100) > Math.floor(globalScore / 100)) playLevelUpSound(isMuted);
      
      setTimeout(() => { 
        setFeedback(null); setIsAnimating(false); 
        if (gameState === 'salvation') { setGameState('playing'); setLives(1); }
        generateQuestion(); 
      }, 1000);
    } else {
      setFeedback('wrong'); playWrongSound(isMuted);
      const pointsLost = Math.ceil(globalScore / 2);
      const penalizedScore = Math.max(0, globalScore - pointsLost);
      setGlobalScore(penalizedScore);
      
      saveScoreToFirebase(playerName, penalizedScore, playerAvatar);

      setTimeout(() => {
        setFeedback(null); setIsAnimating(false);
        if (gameState === 'salvation') {
           setLives(0); setGameState('gameover'); saveScoreToFirebase(playerName, penalizedScore, playerAvatar);
        } else if (lives > 1) { 
           setLives(prev => prev - 1); generateQuestion(); 
        } else { 
           setGameState('salvation'); playSalvationSound(isMuted); generateQuestion(); 
        }
      }, 1200); 
    }
  };

  const handleWordsearchClick = (r, c) => {
    if (isAnimating) return;
    if (wsStartCell && wsStartCell.r === r && wsStartCell.c === c) { setWsStartCell(null); playTone(400, 'sine', 0.05, 0.1, isMuted); return; }
    if (!wsStartCell) { playTone(500, 'sine', 0.05, 0.1, isMuted); setWsStartCell({ r, c }); } 
    else {
      const endCell = { r, c }; const [sr, sc] = question.startCoord; const [er, ec] = question.endCoord;
      const isCorrect = (wsStartCell.r === sr && wsStartCell.c === sc && endCell.r === er && endCell.c === ec) || (wsStartCell.r === er && wsStartCell.c === ec && endCell.r === sr && endCell.c === sc);
      if (isCorrect) { setWsFound(true); handleAnswer(question.answer); } 
      else { setWsStartCell(null); handleAnswer('WRONG'); }
    }
  };

  const handleAddWord = (word, idx) => {
    playTone(500, 'sine', 0.05, 0.1, isMuted);
    const newAv = [...orderAvailable]; newAv.splice(idx, 1);
    setOrderAvailable(newAv); setOrderSelected([...orderSelected, word]);
  };
  const handleRemoveWord = (word, idx) => {
    playTone(400, 'sine', 0.05, 0.1, isMuted);
    const newSel = [...orderSelected]; newSel.splice(idx, 1);
    setOrderSelected(newSel); setOrderAvailable([...orderAvailable, word]);
  };

  const renderMuteButton = () => (
    <button onClick={() => setIsMuted(!isMuted)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-all z-50">
      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );

  const renderPodium = () => {
    const top3 = playersList.slice(0, 3);
    if (top3.length === 0) return null;
    const rank1 = top3[0] ? getRankInfo(top3[0].score) : null;
    const rank2 = top3[1] ? getRankInfo(top3[1].score) : null;
    const rank3 = top3[2] ? getRankInfo(top3[2].score) : null;

    return (
      <div className="flex items-end justify-center gap-1 mb-6 mt-4 min-h-[220px] border-b border-white/20 pb-4">
         {top3[1] && (
           <div className="flex flex-col items-center justify-end w-24 z-10 opacity-90 hover:opacity-100 transition-all">
             <div className="text-4xl mb-1 drop-shadow-md">{top3[1].avatar || '😎'}</div>
             <div className="text-xs font-bold text-white truncate w-full text-center px-1 mb-0.5">{top3[1].name}</div>
             <div className={`text-[9px] font-black uppercase ${rank2?.color || 'text-white'} tracking-wider leading-none`}>{rank2?.tier || 'Bronce'} {rank2?.level || ''}</div>
             <div className="text-[10px] text-white/60 font-bold mb-1">{top3[1].score} pts</div>
             <div className="w-full bg-gradient-to-b from-gray-300 to-gray-500 h-16 rounded-t-lg flex justify-center pt-1 text-gray-800 font-black text-xl shadow-[inset_0_4px_10px_rgba(255,255,255,0.5)] border-t border-gray-100">2</div>
           </div>
         )}
         {top3[0] && (
           <div className="flex flex-col items-center justify-end w-28 z-20">
             <div className="relative inline-flex items-center justify-center text-6xl mb-2 animate-dance drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">
               <span>{top3[0].avatar || '😎'}</span><span className="absolute -bottom-2 -right-3 text-3xl drop-shadow-sm z-10">👅</span>
             </div>
             <div className="text-sm font-black text-yellow-400 truncate w-full text-center mb-0.5 drop-shadow-md">{top3[0].name}</div>
             <div className={`text-[10px] font-black uppercase ${rank1?.color || 'text-white'} tracking-wider leading-none`}>{rank1?.tier || 'Bronce'} {rank1?.level || ''}</div>
             <div className="text-xs text-white/80 font-bold mb-1">{top3[0].score} pts</div>
             <div className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 h-28 rounded-t-lg flex flex-col items-center pt-2 text-yellow-900 font-black text-3xl shadow-[inset_0_4px_15px_rgba(255,255,255,0.6)] border-t border-yellow-200">
               <Crown className="w-5 h-5 text-white/50 mb-1" />1
             </div>
           </div>
         )}
         {top3[2] && (
           <div className="flex flex-col items-center justify-end w-24 z-10 opacity-90 hover:opacity-100 transition-all">
             <div className="text-4xl mb-1 drop-shadow-md">{top3[2].avatar || '😎'}</div>
             <div className="text-xs font-bold text-white truncate w-full text-center px-1 mb-0.5">{top3[2].name}</div>
             <div className={`text-[9px] font-black uppercase ${rank3?.color || 'text-white'} tracking-wider leading-none`}>{rank3?.tier || 'Bronce'} {rank3?.level || ''}</div>
             <div className="text-[10px] text-white/60 font-bold mb-1">{top3[2].score} pts</div>
             <div className="w-full bg-gradient-to-b from-orange-400 to-orange-600 h-12 rounded-t-lg flex justify-center pt-1 text-orange-900 font-black text-xl shadow-[inset_0_4px_10px_rgba(255,255,255,0.4)] border-t border-orange-200">3</div>
           </div>
         )}
      </div>
    );
  };

  const renderSidebar = () => (
    <div className={`fixed lg:relative inset-y-0 left-0 w-72 lg:w-80 bg-slate-800 border-r border-white/10 flex flex-col z-40 transform transition-transform duration-300 ease-in-out shadow-2xl ${showLeaderboard ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-4 bg-slate-800/90 border-b border-white/10 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Ranking Global
          </h2>
          {isLoadingScores && <p className="text-[10px] text-yellow-400/70 animate-pulse">Sincronizando nube...</p>}
        </div>
        <button onClick={() => setShowLeaderboard(false)} className="lg:hidden text-white/50 hover:text-white"><XCircle className="w-6 h-6" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoadingScores && playersList.length === 0 ? (
          <div className="text-center p-6 text-white/40"><Users className="w-12 h-12 mb-2 mx-auto opacity-20 animate-pulse" /><p>Conectando...</p></div>
        ) : playersList.length === 0 ? (
          <div className="text-center p-6 text-white/40"><Trophy className="w-12 h-12 mb-2 mx-auto opacity-20" /><p>¡Sé el primero!</p></div>
        ) : (
          <>
            {renderPodium()}
            <div className="space-y-2">
              {playersList.slice(3).map((player, index) => {
                const rank = getRankInfo(player.score);
                return (
                  <div key={index + 3} className={`p-2 rounded-xl flex items-center justify-between border ${player.name && player.name.toLowerCase() === playerName.toLowerCase() ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 text-center font-bold text-xs text-white/40">#{index + 4}</div>
                      <div className="text-2xl">{player.avatar || '😎'}</div>
                      <div className="flex flex-col">
                        <p className="font-bold text-sm text-white/90 truncate max-w-[90px]">{player.name}</p>
                        <div className={`text-[9px] font-black uppercase ${rank?.color || 'text-white'} mt-0.5 tracking-wider`}>{rank?.tier} {rank?.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-black text-base leading-none">{player.score}</p>
                      <p className="text-[9px] text-white/40">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStartScreen = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-5 w-full mt-2">
      <div className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-widest border-b border-white/20 pb-2 mb-1 w-full">IE 064 JUAN PABLO II</div>
      <div className="relative"><div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur opacity-70 animate-pulse"></div><div className="relative bg-white p-4 rounded-full shadow-xl"><Trophy className="w-14 h-14 text-yellow-500" /></div></div>
      <div>
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-2">EduQuest</h1>
        <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-3 max-w-xs mx-auto backdrop-blur-sm shadow-inner">
          <p className="text-yellow-400 font-bold text-xs sm:text-sm">Docente: Anderson Calderon</p>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-4 pt-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
          <input type="text" placeholder="Tu nombre aquí..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white/90 focus:bg-white border-2 border-transparent focus:border-yellow-400 rounded-xl outline-none text-gray-800 font-bold" maxLength={15} />
        </div>
        <button onClick={handleNameSubmit} disabled={playerName.trim() === ''} className={`group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 rounded-xl w-full text-xl ${playerName.trim() === '' ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 hover:scale-105'}`}>
          Siguiente <ChevronRight className="w-6 h-6 ml-2" />
        </button>
      </div>
    </div>
  );

  const renderAvatarScreen = () => (
    <div className="flex flex-col items-center justify-center w-full pb-4">
      <h2 className="text-2xl font-bold text-white mb-2">Elige tu Avatar</h2>
      <p className="text-white/70 text-sm mb-6">Este personaje te representará en el Ranking</p>
      
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4 max-w-sm mb-6">
        {AVATARES.map((emoji, i) => (
          <button 
            key={i} 
            onClick={() => handleAvatarSelect(emoji)}
            className="text-4xl sm:text-5xl hover:scale-125 transition-transform duration-200 drop-shadow-md hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button onClick={() => setGameState('start')} className="mt-4 text-white/80 hover:text-white flex items-center gap-2"><Home className="w-5 h-5" /> Volver</button>
    </div>
  );

  const renderDashboardScreen = () => {
    const userRank = getRankInfo(globalScore);
    const nextRankPoints = (Math.floor(globalScore / 100) + 1) * 100;
    const progressPerc = globalScore % 100;

    return (
      <div className="flex flex-col items-center justify-start w-full pb-4 pt-2">
        <div className="mb-4 text-center flex flex-col items-center">
          <div className="text-6xl mb-1">{playerAvatar}</div>
          <p className="text-white/80 font-medium">¡Hola, <span className="text-yellow-400 font-bold">{playerName}</span>!</p>
          
          <div className={`mt-2 px-4 py-1 rounded-full border ${userRank.bg} bg-opacity-20 ${userRank.border} flex items-center gap-2`}>
            <Star className={`w-4 h-4 ${userRank.color} fill-current`} />
            <span className={`font-black uppercase tracking-wider text-sm ${userRank.color}`}>{userRank.tier} {userRank.level}</span>
          </div>

          <div className="w-full max-w-xs bg-black/40 rounded-full h-5 mt-3 relative border border-white/10 overflow-hidden shadow-inner">
             <div className={`h-full ${userRank.bg} transition-all duration-500`} style={{ width: `${progressPerc}%` }}></div>
             <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md">
                {globalScore} / {nextRankPoints} pts
             </div>
          </div>
          <button onClick={() => setShowRankGuide(true)} className="text-white/50 hover:text-white text-xs mt-2 underline">Ver Guía de Rangos</button>
        </div>

        <div className="w-full max-w-sm mb-4">
          <button onClick={startGame} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 sm:p-5 rounded-3xl shadow-lg hover:scale-105 transition-transform flex flex-col items-center justify-center border border-emerald-400">
            <Play className="w-8 h-8 mb-1 fill-current" />
            <span className="font-black text-xl sm:text-2xl tracking-wide uppercase drop-shadow-md">Empezar Partida</span>
            <span className="text-emerald-100 text-xs font-medium mt-1">Modo Supervivencia Solo</span>
          </button>
        </div>

        {/* LOBBY MULTIJUGADOR */}
        <div className="w-full max-w-sm bg-slate-800/80 p-4 rounded-3xl border border-white/10 shadow-inner">
           <h3 className="text-white font-black text-sm mb-3 flex items-center gap-2 justify-center border-b border-white/10 pb-2">
             <div className={`w-3 h-3 rounded-full ${isFirebaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-red-500'} shadow-[0_0_8px_currentColor]`}></div> 
             Jugadores en Línea (Batallas 1v1)
           </h3>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {/* Si Firebase no está configurado pero estamos en devMode, mostramos la lista local simulada */}
              {(!isFirebaseConfigured && devMode) ? (
                onlineUsers.length === 0 ? (
                 <div className="text-center text-white/50 text-xs py-4">Nadie más conectado en este momento. 👀</div>
                ) : onlineUsers.map(u => (
                 <div key={u.uid} className="flex items-center justify-between bg-white/10 p-2 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2">
                     <div className="relative">
                       <span className="text-2xl drop-shadow-md">{u.avatar}</span>
                       {u.status === 'in_battle' && <span className="absolute -bottom-1 -right-1 text-[10px] bg-red-500 rounded-full w-4 h-4 flex items-center justify-center shadow-md animate-pulse">⚔️</span>}
                     </div>
                     <div className="flex flex-col">
                       <span className="text-white font-bold text-xs truncate max-w-[80px]">{u.name}</span>
                       <span className="text-[9px] text-yellow-400 font-black">{u.score} PTS</span>
                     </div>
                   </div>
                   <div>
                     <button onClick={() => openBetModal(u)} className="bg-emerald-600 px-3 py-1 rounded-2xl text-xs font-bold">RETAR</button>
                   </div>
                 </div>
                ))
              ) : !isFirebaseConfigured ? (
                <div className="text-center text-white/50 text-xs py-4">
                 Modo Batalla desactivado.<br/>
                 <span className="text-[10px] text-yellow-400">Configura tu Firebase para jugar en línea.</span>
                </div>
              ) : !fbUser ? (
                <div className="text-center text-xs text-yellow-400 p-2">Conectando al servidor...</div>
              ) : onlineUsers.length === 0 ? (
                <div className="text-center text-white/50 text-xs py-4">Nadie más conectado en este momento. 👀</div>
              ) : onlineUsers.map(u => (
                 <div key={u.uid} className="flex items-center justify-between bg-white/10 p-2 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2">
                       <div className="relative">
                          <span className="text-2xl drop-shadow-md">{u.avatar}</span>
                          {u.status === 'in_battle' && <span className="absolute -bottom-1 -right-1 text-[10px] bg-red-500 rounded-full w-4 h-4 flex items-center justify-center shadow-md animate-pulse">⚔️</span>}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-white font-bold text-xs truncate max-w-[80px]">{u.name}</span>
                          <span className="text-[9px] text-yellow-400 font-black">{u.score} PTS</span>
                       </div>
                    </div>
                    {/* MODIFICACIÓN: ABRIR EL MODAL DE APUESTA EN LUGAR DE RETAR DIRECTO */}
                    <button onClick={() => openBetModal(u)} disabled={u.status === 'in_battle'} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all shadow-md ${u.status === 'in_battle' ? 'bg-slate-600 text-white/30 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:scale-105 text-white'}`}>
                       {u.status === 'in_battle' ? 'OCUPADO' : 'RETAR ⚔️'}
                    </button>
                 </div>
              ))}
           </div>
        </div>

        <button onClick={() => setGameState('avatar_select')} className="text-white/60 hover:text-white text-xs mt-6 underline">Cambiar Avatar / Jugador</button>
      </div>
    );
  };

  const renderGameScreen = () => {
    if (!question) return null;
    const isVerticalLayout = ['grammar', 'syntax', 'spelling', 'complex_reading', 'reading'].includes(question.type);
    const isSalvation = gameState === 'salvation';

    return (
      <div className={`flex flex-col w-full h-full relative ${isSalvation ? 'border-4 border-red-500 rounded-[2.5rem] bg-red-900/20' : ''}`}>
        <div className="flex justify-between items-center mb-4 bg-white/20 p-3 sm:p-4 rounded-2xl backdrop-blur-sm shadow-md mt-6">
          <button onClick={() => { playTone(300, 'sine', 0.1, 0.1, isMuted); saveScoreToFirebase(playerName, globalScore, playerAvatar); setGameState('dashboard'); }} className="p-2 bg-white/20 hover:bg-red-500 rounded-xl text-white transition-all flex items-center gap-2">
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs font-bold hidden sm:inline">Guardar y Salir</span>
          </button>
          <div className={`flex items-center gap-1 px-3 py-1 sm:px-4 sm:py-2 rounded-xl font-black text-sm sm:text-base ${timeLeft <= 10 || isSalvation ? 'bg-red-500 text-white animate-pulse' : 'bg-white/30 text-white'}`}><Clock className="w-4 h-4" /> <span className="w-6 text-center">{timeLeft}</span>s</div>
          <div className="flex gap-1">{[...Array(3)].map((_, i) => <Heart key={i} className={`w-5 h-5 sm:w-6 sm:h-6 transition-all ${i < lives ? 'text-red-500 fill-current' : 'text-gray-400/50 fill-gray-400/50'}`} />)}</div>
        </div>

        {isSalvation && (
           <div className="flex items-center justify-center gap-2 bg-red-600 text-white font-black text-xl py-2 px-4 rounded-xl animate-bounce shadow-[0_0_15px_rgba(239,68,68,0.8)] mb-2">
             <AlertTriangle className="w-6 h-6" /> ¡RETO DE SALVACIÓN! <AlertTriangle className="w-6 h-6" />
           </div>
        )}

        {!isSalvation && (
          <div className="flex justify-between items-center px-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl drop-shadow-md">{playerAvatar}</span>
              <span className="text-white/90 text-sm font-bold truncate max-w-[120px]">{playerName}</span>
            </div>
            <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
              <Star className="w-4 h-4 text-yellow-400 fill-current" /> <span className="font-black text-yellow-400 text-sm">{globalScore} pts</span>
            </div>
          </div>
        )}

        <div className={`flex-1 flex flex-col items-center justify-center mb-6 transition-transform ${feedback === 'correct' ? 'scale-110' : feedback === 'wrong' ? 'animate-shake' : ''}`}>
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full text-center relative overflow-hidden min-h-[240px] flex flex-col justify-center">
            {isSaving && <div className="absolute top-2 right-4 text-green-500 text-xs font-bold animate-pulse flex items-center gap-1"><Save className="w-3 h-3"/> Guardando...</div>}
            {feedback && <div className={`absolute inset-0 z-20 flex items-center justify-center ${feedback === 'correct' ? 'bg-green-500/95' : 'bg-red-500/95'}`}><span className="text-4xl sm:text-5xl font-black text-white drop-shadow-md">{feedback === 'correct' ? '¡Excelente! +10' : '¡MITAD DE PTS!'}</span></div>}
            
            {question.type === 'complex_reading' ? (
              <div className="flex flex-col items-center w-full h-full max-h-[300px]">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-slate-700 text-sm sm:text-base text-left font-medium overflow-y-auto custom-scrollbar flex-1 w-full mb-3 shadow-inner whitespace-pre-wrap">{question.text}</div>
                <div className="font-black text-slate-800 text-lg w-full bg-white p-2">{question.qText}</div>
              </div>
            ) : question.type === 'wordsearch' ? (
              <div className="flex flex-col items-center mt-2">
                 <div className="bg-fuchsia-50 p-2 rounded-xl border border-fuchsia-200 font-bold text-slate-700 w-full mb-2">{question.text}</div>
                 <div className="grid grid-cols-6 gap-1 bg-slate-100 p-2 rounded-xl shadow-inner">
                    {question.grid.map((row, i) => row.map((letter, j) => {
                       const isSel = wsStartCell?.r === i && wsStartCell?.c === j;
                       const isFnd = wsFound && (i===question.startCoord[0] && i===question.endCoord[0] && j>=Math.min(question.startCoord[1],question.endCoord[1]) && j<=Math.max(question.startCoord[1],question.endCoord[1]) || j===question.startCoord[1] && j===question.endCoord[1] && i>=Math.min(question.startCoord[0],question.endCoord[0]) && i<=Math.max(question.startCoord[0],question.endCoord[0]));
                       return <button key={`${i}-${j}`} onClick={() => handleWordsearchClick(i, j)} className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-xl font-black rounded-lg transition-all shadow-sm ${isFnd ? 'bg-green-500 text-white scale-105' : isSel ? 'bg-yellow-400 text-white scale-110 shadow-md ring-2 ring-yellow-500' : 'bg-white text-slate-600 hover:bg-slate-200 active:scale-95 border-b-2 border-slate-200'}`}>{letter}</button>
                    }))}
                 </div>
              </div>
            ) : question.type === 'order' ? (
              <div className="flex flex-col items-center w-full">
                <div className="font-bold text-slate-700 text-lg mb-4">{question.text}</div>
                <div className="flex flex-wrap gap-2 justify-center mb-6 min-h-[70px] p-4 bg-cyan-50 rounded-xl w-full border-2 border-dashed border-cyan-300">
                    {orderSelected.map((w, i) => (<button key={i} onClick={() => handleRemoveWord(w, i)} className="px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow-md hover:scale-105 transition-transform">{w}</button>))}
                    {orderSelected.length === 0 && <span className="text-slate-400 text-sm my-auto">Toca las palabras de abajo</span>}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {orderAvailable.map((w, i) => (<button key={i} onClick={() => handleAddWord(w, i)} className="px-4 py-2 bg-white text-slate-700 font-bold rounded-lg shadow-md border-b-4 border-slate-200 hover:bg-slate-50 hover:scale-105 transition-transform">{w}</button>))}
                </div>
                {orderAvailable.length === 0 && (<button onClick={() => handleAnswer(orderSelected.join(" "))} className="mt-6 px-8 py-3 bg-green-500 text-white font-black rounded-xl shadow-lg hover:scale-105 transition-transform animate-bounce">Comprobar</button>)}
              </div>
            ) : question.type === 'reading' || question.type === 'syntax' ? (
              <div className="flex flex-col gap-3 mt-4 text-center">
                <div className={`p-4 rounded-xl border font-semibold text-lg italic ${question.type==='reading'?'bg-amber-50 border-amber-200 text-amber-900':'bg-violet-50 border-violet-200 text-violet-900'}`}>{question.text.split(' || ')[0]}</div>
                <div className="font-black text-slate-800 text-lg">{question.text.split(' || ')[1]}</div>
              </div>
            ) : ['grammar','vocab','tf','word','logic', 'spelling'].includes(question.type) || (question.type === 'math' && question.text) ? (
              <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-4 leading-tight px-2 tracking-wide drop-shadow-sm">{question.text}</div>
            ) : (
              <div className="text-5xl sm:text-6xl font-black text-gray-800 tracking-tighter flex items-center justify-center gap-2 sm:gap-3 mt-2 flex-wrap">
                 {question.text}
              </div>
            )}
          </div>
        </div>

        {question.type !== 'wordsearch' && question.type !== 'order' && (
          <div className={`grid gap-3 sm:gap-4 ${question.options.length <= 2 ? 'grid-cols-2' : (isVerticalLayout ? 'grid-cols-1' : 'grid-cols-2')}`}>
            {question.options.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(opt)} disabled={isAnimating} className={`p-4 rounded-2xl ${isVerticalLayout ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'} font-bold shadow-md transform transition-all ${isAnimating ? 'bg-gray-100 text-gray-400 scale-95' : 'bg-white text-gray-800 hover:bg-blue-50 hover:scale-[1.01] active:scale-95 border-b-4 border-gray-200'}`}>
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBattleScreen = () => {
    if (!activeBattle) return null;
    const isP1 = activeBattle.player1?.uid === fbUser?.uid;
    const me = (isP1 ? activeBattle.player1 : activeBattle.player2) || { uid: '', name: 'Jugador', avatar: '😎', score: 0, currentQ: 0 };
    const opp = (isP1 ? activeBattle.player2 : activeBattle.player1) || { uid: '', name: 'Rival', avatar: '😎', score: 0, currentQ: 0 };
    
    const questions = activeBattle.questions || [];
    const q = questions[me.currentQ || 0];

    return (
       <div data-test="battle-screen" className="flex flex-col w-full h-full relative border-4 border-orange-500 rounded-[2.5rem] bg-orange-900/20 pt-4">
         {/* Score Header */}
         <div className="flex justify-between items-center bg-slate-900/80 p-3 mx-4 rounded-2xl shadow-xl border border-white/10 z-10 font-bold">
             <div className="flex items-center gap-2">
                 <span className="text-3xl">{me.avatar}</span>
                 <div className="flex flex-col text-left">
                     <span className="text-[10px] text-white/50 uppercase">{me.name}</span>
                     <span className="text-xl font-black text-green-400 leading-none">{me.score}</span>
                 </div>
             </div>
             <div className="text-3xl animate-pulse">⚔️</div>
             <div className="flex items-center gap-2 text-right">
                 <div className="flex flex-col">
                     <span className="text-[10px] text-white/50 uppercase">{opp.name}</span>
                     <span className="text-xl font-black text-red-400 leading-none">{opp.score}</span>
                 </div>
                 <span className="text-3xl">{opp.avatar}</span>
             </div>
         </div>

         <div data-test="battle-round" className="text-center text-white/80 text-xs font-bold uppercase tracking-widest mt-3 drop-shadow-md">
            Ronda {Math.min(3, Math.floor((me.currentQ || 0) / 10) + 1)} / 3 <br/> Pregunta {Math.min(30, (me.currentQ || 0) + 1)}/30
         </div>

         {/* Question Area */}
         <div className="flex-1 flex flex-col items-center justify-center p-4">
             {q ? (
              q.type === 'puzzle' ? (
                <div className="bg-white rounded-3xl p-6 shadow-2xl w-full text-center relative min-h-[220px] flex flex-col justify-center transition-transform hover:scale-[1.02]" data-test="battle-question">
                 {isBattleAnimating && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 rounded-3xl"></div>}
                 <PuzzleQuestion question={q} onSubmit={(ans)=>handleBattleAnswer(ans)} />
                </div>
              ) : (
               <div className="bg-white rounded-3xl p-6 shadow-2xl w-full text-center relative min-h-[220px] flex flex-col justify-center transition-transform hover:scale-[1.02]" data-test="battle-question">
                 {isBattleAnimating && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 rounded-3xl"></div>}
                 <div className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">{q.text}</div>
               </div>
              )
             ) : (
                 <div className="bg-white/10 rounded-3xl p-6 w-full text-center min-h-[220px] flex flex-col justify-center backdrop-blur-md">
                    <div className="text-white text-2xl font-black animate-pulse flex flex-col items-center gap-4">
                       <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                       ¡Esperando al oponente!
                    </div>
                 </div>
             )}
         </div>

         {/* Options */}
         {q && (
             <div className="grid grid-cols-2 gap-3 p-4" data-test="battle-options">
                {q.options.map((opt, i) => (
                   <button key={i} data-test="battle-option" onClick={() => handleBattleAnswer(opt)} disabled={isBattleAnimating} className={`p-4 rounded-2xl text-lg sm:text-xl font-bold transition-all border-b-4 ${isBattleAnimating ? 'bg-gray-200 text-gray-400 border-gray-300' : 'bg-white text-gray-800 hover:bg-orange-50 active:scale-95 border-gray-200 hover:border-orange-200 shadow-lg'}`}>
                      {opt}
                   </button>
                ))}
             </div>
         )}
       </div>
    );
  }

  const renderBattleOverScreen = () => {
    const isP1 = activeBattle.player1?.uid === fbUser?.uid;
    const me = (isP1 ? activeBattle.player1 : activeBattle.player2) || { uid: '', name: 'Jugador', avatar: '😎', score: 0, currentQ: 0 };
    const opp = (isP1 ? activeBattle.player2 : activeBattle.player1) || { uid: '', name: 'Rival', avatar: '😎', score: 0, currentQ: 0 };
    
    const didIWin = me.score > opp.score || (me.score === opp.score && me.currentQ >= opp.currentQ);
    const bet = activeBattle.betAmount || 0;

    return (
        <div className="flex flex-col items-center justify-center text-center w-full mt-4">
            <div className="text-8xl mb-6 animate-bounce">{didIWin ? '🏆' : '💀'}</div>
            <h2 className={`text-4xl font-black mb-2 ${didIWin ? 'text-green-400' : 'text-red-400'}`}>
                {didIWin ? '¡VICTORIA ÉPICA!' : 'DERROTA'}
            </h2>
            <p className="text-white/80 mb-8 font-medium">
              {didIWin ? `Has destrozado a tu rival y te llevas los ` : `Tu rival fue mejor y has perdido `}
              <span className={didIWin ? "text-yellow-400 font-black" : "text-red-400 font-black"}>{bet} PTS</span>
            </p>

            <div className="flex gap-6 items-center bg-slate-800/80 p-6 rounded-3xl border border-white/10 w-full max-w-sm justify-center mb-8 shadow-xl">
                <div className="flex flex-col items-center">
                    <span className="text-5xl mb-2 relative">{me.avatar}{didIWin && <span className="absolute -bottom-2 -right-2 text-2xl">👅</span>}</span>
                    <span className="text-white font-bold">{me.score} pts correctos</span>
                </div>
                <span className="text-2xl text-white/30 font-black italic">VS</span>
                <div className="flex flex-col items-center opacity-50">
                    <span className="text-5xl mb-2">{opp.avatar}</span>
                    <span className="text-white font-bold">{opp.score} pts correctos</span>
                </div>
            </div>

            <button onClick={() => { 
                deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', activeBattle.id)).catch(()=>{}); 
                setActiveBattleId(null); 
                setActiveBattle(null); 
                setGameState('dashboard'); 
            }} className="bg-blue-500 hover:bg-blue-600 text-white w-full max-w-sm py-4 rounded-xl font-black text-xl shadow-lg hover:scale-105 transition-all">
                Volver al Menú
            </button>
        </div>
    );
  };

  const renderGameOverScreen = () => {
    const finalRank = getRankInfo(globalScore);
    return (
      <div className="flex flex-col items-center justify-center text-center w-full mt-4">
        <div className="bg-white p-4 rounded-full shadow-xl mb-4 mt-4 text-5xl">
          {lives === 0 ? playerAvatar : <Clock className="w-12 h-12 text-blue-500" />}
        </div>
        <h2 className="text-3xl font-black text-white mb-4">{lives === 0 ? '¡Fin de la Partida!' : '¡Tiempo Agotado!'}</h2>
        
        <div className={`bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border-2 ${finalRank.border} w-full max-w-sm relative overflow-hidden shadow-2xl`}>
          <p className="text-white/80 text-sm mb-1">Tu Rango Global</p>
          <div className={`inline-block px-4 py-1 rounded-full ${finalRank.bg} text-white font-black uppercase tracking-widest text-lg mb-4 shadow-md`}>
            {finalRank.tier} {finalRank.level}
          </div>
          <p className="text-white/80 text-sm mb-0">Puntaje Acumulado</p>
          <p className={`text-6xl font-black ${finalRank.color} drop-shadow-md`}>{globalScore}</p>
        </div>

        <div className="flex w-full gap-3 mt-6 max-w-sm">
          <button onClick={() => setGameState('dashboard')} className="flex-1 bg-white/20 hover:bg-white/30 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"><Home className="w-5 h-5" /> Menú</button>
          <button onClick={startGame} className="flex-[2] bg-green-500 hover:bg-green-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-all"><RotateCcw className="w-6 h-6" /> Jugar de Nuevo</button>
        </div>
      </div>
    );
  };

  const renderRankGuideModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
       <div className="bg-slate-800 rounded-3xl max-w-md w-full p-6 relative border border-white/20 shadow-2xl animate-in zoom-in duration-300">
         <button onClick={() => setShowRankGuide(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
         <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3"><Trophy className="text-yellow-400" /> Guía de Ligas</h2>
         
         <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
            <div className="flex justify-between items-center p-3 bg-orange-500/20 border border-orange-500/30 rounded-xl"><span className="font-black text-orange-500">Bronce I - III</span><span className="text-white/70 text-sm font-bold">0 - 299 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-gray-400/20 border border-gray-400/30 rounded-xl"><span className="font-black text-gray-300">Plata I - III</span><span className="text-white/70 text-sm font-bold">300 - 599 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-yellow-400/20 border border-yellow-400/30 rounded-xl"><span className="font-black text-yellow-400">Oro I - IV</span><span className="text-white/70 text-sm font-bold">600 - 999 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-teal-400/20 border border-teal-400/30 rounded-xl"><span className="font-black text-teal-400">Platino I - V</span><span className="text-white/70 text-sm font-bold">1000 - 1499 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-blue-400/20 border border-blue-400/30 rounded-xl"><span className="font-black text-blue-400">Diamante I - V</span><span className="text-white/70 text-sm font-bold">1500 - 1999 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-red-500/20 border border-red-500/30 rounded-xl"><span className="font-black text-red-500">Heroico 1 - 49</span><span className="text-white/70 text-sm font-bold">2000 - 6899 pts</span></div>
            <div className="flex justify-between items-center p-3 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-xl"><span className="font-black text-fuchsia-500 text-lg">Gran Maestro</span><span className="text-white font-black">6900+ pts</span></div>
         </div>
       </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-900 font-sans flex overflow-hidden" translate="no">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px) rotate(-2deg); } 75% { transform: translateX(10px) rotate(2deg); } } 
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes dance { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-5px) rotate(-10deg) scale(1.1); } 75% { transform: translateY(-5px) rotate(10deg) scale(1.1); } }
        .animate-dance { animation: dance 0.6s infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
      `}} />

      {/* MODAL DE APUESTA DE PUNTOS */}
      {challengeTarget && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <div className="bg-slate-800 border-4 border-orange-500 p-8 rounded-[3rem] w-full max-w-sm text-center shadow-[0_0_50px_rgba(249,115,22,0.4)] animate-in zoom-in duration-300">
                <h2 className="text-2xl font-black text-white mb-2">Apostar Puntos</h2>
                <p className="text-white/70 text-sm mb-6">Elige cuántos puntos deseas apostar en tu batalla contra <span className="font-bold text-white">{challengeTarget.name}</span></p>
                
                <div className="bg-black/30 p-4 rounded-3xl mb-6 border border-white/5">
                   <div className="text-5xl font-black text-yellow-400 mb-2 drop-shadow-md">{betAmount}</div>
                   <div className="text-[10px] text-white/40 uppercase font-bold">PUNTOS EN JUEGO</div>
                </div>
                
                <input 
                   type="range" 
                   min="0" 
                   max={Math.min(globalScore, challengeTarget.score)} 
                   value={betAmount} 
                   onChange={(e) => setBetAmount(Number(e.target.value))}
                   className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-8 accent-orange-500"
                />
                
                 <div className="flex gap-3">
                   <button onClick={() => setChallengeTarget(null)} className="flex-1 bg-slate-700 text-white/70 py-3 rounded-2xl font-bold hover:bg-slate-600 transition-colors">Cancelar</button>
                   <button onClick={confirmChallenge} data-test="send-challenge" className="flex-[2] bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-2xl font-black hover:scale-105 transition-transform shadow-lg shadow-orange-500/50">Enviar Reto ⚔️</button>
                 </div>
             </div>
         </div>
      )}

      {/* MODALES DEL SISTEMA MULTIJUGADOR */}
      {activeBattle && activeBattle.status === 'pending' && gameState === 'dashboard' && activeBattle.player1?.uid === fbUser?.uid && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-slate-800 border-4 border-blue-500 p-8 rounded-[3rem] text-center max-w-sm w-full shadow-[0_0_50px_rgba(59,130,246,0.4)] animate-in zoom-in">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-white font-black text-2xl mb-2">Esperando a {activeBattle.player2?.name}...</h2>
                <p className="text-white/60 text-sm mb-4">Preparando la arena de batalla</p>
                <div className="bg-yellow-500/20 text-yellow-400 font-bold px-4 py-2 rounded-xl text-sm mb-6 border border-yellow-500/30 inline-block">Apuesta: {activeBattle.betAmount} pts</div><br/>
                <button onClick={() => { deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'battles', activeBattle.id)); setActiveBattle(null); }} className="bg-red-500/20 text-red-400 font-bold px-6 py-2 rounded-xl hover:bg-red-500/40 transition-colors">Cancelar Reto</button>
             </div>
         </div>
      )}

      {pendingChallenge && gameState === 'dashboard' && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-slate-800 border-4 border-orange-500 p-6 sm:p-8 rounded-[3rem] text-center max-w-sm w-full animate-in zoom-in duration-300 shadow-[0_0_50px_rgba(249,115,22,0.4)]">
                <div className="text-6xl mb-4 animate-bounce">⚔️</div>
                <h2 className="text-white font-black text-3xl mb-2">¡TE HAN RETADO!</h2>
                <div className="flex justify-center items-center gap-4 my-6 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                   <span className="text-5xl">{pendingChallenge.player1?.avatar}</span>
                   <div className="flex flex-col items-start">
                      <span className="text-orange-400 font-black text-xl">{pendingChallenge.player1?.name}</span>
                      <span className="text-white/60 text-xs font-bold uppercase">{pendingChallenge.player1?.score} PTS</span>
                   </div>
                </div>
                <p className="text-white/80 mb-6 font-medium text-sm">El ganador se llevará <span className="text-yellow-400 font-black">+{pendingChallenge.betAmount || 0} pts</span>.</p>
                <div className="flex gap-3">
                  <button onClick={() => declineChallenge(pendingChallenge)} data-test="decline-challenge" className="flex-1 bg-slate-700 hover:bg-slate-600 text-white/70 py-3 rounded-xl font-bold transition-colors">Huir 🏃</button>
                  <button onClick={() => acceptChallenge(pendingChallenge)} data-test="accept-challenge" className="flex-[2] bg-gradient-to-r from-orange-500 to-red-500 hover:scale-105 text-white py-3 rounded-xl font-black shadow-lg shadow-orange-500/50 transition-all">¡ACEPTAR!</button>
                </div>
             </div>
         </div>
      )}
      
      {showRankGuide && renderRankGuideModal()}
      {showDiploma && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-8 relative border-[12px] border-double border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.6)] text-center animate-in zoom-in duration-500">
            <button onClick={() => setShowDiploma(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"><XCircle className="w-8 h-8" /></button>
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4 drop-shadow-md" />
            <h1 className="text-4xl font-black text-slate-800 mb-6 font-serif">Diploma de Excelencia</h1>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500 mb-6 border-b-4 border-gray-200 inline-block px-12">{playerName}</div>
            <p className="text-lg text-gray-600 mb-10 max-w-lg mx-auto">Por superar los <span className="font-bold text-yellow-600">500 puntos</span> en EduQuest.</p>
            <p className="text-xs font-bold text-gray-500 uppercase mt-12 border-t pt-4">IE 064 JUAN PABLO II - Docente: Anderson Calderon</p>
          </div>
        </div>
      )}

      {renderSidebar()}
      
      {!showLeaderboard && (
        <button onClick={() => setShowLeaderboard(true)} className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-yellow-500 hover:bg-yellow-600 rounded-full text-white shadow-lg transition-all"><Medal className="w-6 h-6" /></button>
      )}

      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className={`absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[120px] transition-colors duration-1000 ${(gameState==='salvation' || gameState==='battle' || gameState==='battle_over') ? 'bg-red-600/20' : 'bg-emerald-600/20'}`}></div>
          <div className={`absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[120px] transition-colors duration-1000 ${(gameState==='salvation' || gameState==='battle' || gameState==='battle_over') ? 'bg-orange-600/20' : 'bg-blue-600/20'}`}></div>
        </div>
        
        {renderMuteButton()}
        
        <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2.5rem] overflow-hidden min-h-[680px] flex items-center justify-center p-6">
          {gameState === 'start' && renderStartScreen()}
          {gameState === 'avatar_select' && renderAvatarScreen()}
          {gameState === 'dashboard' && renderDashboardScreen()}
          {(gameState === 'playing' || gameState === 'salvation') && renderGameScreen()}
          {gameState === 'battle' && renderBattleScreen()}
          {gameState === 'battle_over' && renderBattleOverScreen()}
          {gameState === 'gameover' && renderGameOverScreen()}
        </div>
      </div>
    </div>
  );
}