// All UI strings in German and English. The quiz *questions* come from the
// Open Trivia DB and are English-only; everything else here switches live.

export const TRANSLATIONS = {
  de: {
    appTitle: 'AeroooQuiz',
    tagline: 'Online-Multiplayer-Quiz',
    enter: 'Eintreten',
    soundHint: '🔊 mit Ton · klicken zum Starten',

    // Home
    yourName: 'Dein Name',
    namePlaceholder: 'Name eingeben…',
    createRoom: 'Raum erstellen',
    orJoin: 'oder einem Raum beitreten',
    roomCode: 'Raum-Code',
    codePlaceholder: 'z.B. ABCD',
    joinRoom: 'Beitreten',

    // Lobby
    lobby: 'Lobby',
    inviteHint: 'Teile diesen Code mit deinen Freunden:',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    players: 'Spieler',
    host: 'Host',
    you: 'Du',
    settings: 'Einstellungen',
    mode: 'Spielmodus',
    category: 'Kategorie',
    difficulty: 'Schwierigkeit',
    questionCount: 'Anzahl Fragen',
    timePerQuestion: 'Zeit pro Frage',
    seconds: 'Sek.',
    chooseTeam: 'Wähle dein Team',
    chooseIcon: 'Wähle deinen Avatar',
    playStyle: 'Spielart',
    ffa: 'Alle gegen alle',
    teamsToggle: 'Teams',
    startGame: 'Spiel starten',
    waitingForHost: 'Warte auf den Host…',
    onlyHostStarts: 'Nur der Host kann das Spiel starten.',
    leave: 'Verlassen',

    // Modes
    mode_classic: 'Klassisch',
    mode_speed: 'Schnellster gewinnt',
    mode_survival: 'Überleben / K.O.',
    mode_teams: 'Teams',
    mode_hilo: 'Höher oder tiefer',
    mode_text: 'Freitext',
    mode_estimate: 'Schätzfrage',
    mode_trueblitz: 'Wahr/Falsch-Blitz',
    mode_wager: 'Doppelt oder nichts',
    mode_classic_desc: 'Richtige Antwort = 100 Punkte. Wer am Ende am meisten hat, gewinnt.',
    mode_speed_desc: 'Je schneller die richtige Antwort, desto mehr Punkte.',
    mode_survival_desc: 'Eine falsche Antwort und du bist raus. Der Letzte gewinnt.',
    mode_teams_desc: 'Spielt in Teams, die Punkte werden zusammengezählt.',
    mode_hilo_desc: 'Zwei Dinge – wähle, was höher, größer oder mehr ist.',
    mode_text_desc: 'Tippe die Antwort selbst ein. Schneller = mehr Punkte.',
    mode_estimate_desc: 'Schätze eine Zahl – wer am nächsten dran ist, gewinnt die Runde.',
    mode_trueblitz_desc: 'Wahr oder Falsch im Schnelldurchlauf. Tempo zählt.',
    mode_wager_desc: 'Setze vor jeder Frage Punkte. Richtig bringt sie doppelt, falsch kostet.',

    // Answer input
    yourAnswerPh: 'Deine Antwort…',
    yourGuessPh: 'Deine Zahl…',
    submitAnswer: 'Antwort senden',
    setWager: 'Setze deinen Einsatz:',
    wagerAllIn: 'Alles',
    wagerPlaced: 'Einsatz: {0}',
    correctAnswerWas: 'Richtig war:',
    youAnswered: 'Deine Antwort: {0}',
    closestWin: 'Am nächsten dran!',
    noAnswer: '—',

    // Difficulty
    diff_any: 'Beliebig',
    diff_easy: 'Leicht',
    diff_medium: 'Mittel',
    diff_hard: 'Schwer',

    // Categories
    cat_any: 'Beliebig',
    cat_general: 'Allgemeinwissen',
    cat_science: 'Wissenschaft & Natur',
    cat_computers: 'Computer',
    cat_maths: 'Mathematik',
    cat_sports: 'Sport',
    cat_geography: 'Geografie',
    cat_history: 'Geschichte',
    cat_film: 'Film',
    cat_music: 'Musik',
    cat_videogames: 'Videospiele',
    cat_animals: 'Tiere',

    // Teams
    team_red: 'Rot',
    team_blue: 'Blau',
    team_green: 'Grün',
    team_yellow: 'Gelb',

    // Game
    loading: 'Fragen werden geladen…',
    questionOf: 'Frage {0} von {1}',
    score: 'Punkte',
    timeUp: 'Zeit abgelaufen!',
    correct: 'Richtig!',
    wrong: 'Leider falsch.',
    locked: 'Antwort gespeichert',
    waitingOthers: 'Warte auf die anderen…',
    eliminated: 'Du bist ausgeschieden',
    spectating: 'Du schaust nur noch zu.',
    answeredCount: '{0} von {1} haben geantwortet',
    englishQuestionsNote: 'Fragen sind auf Englisch (Open Trivia DB)',

    // Game over
    gameOver: 'Spiel vorbei!',
    leaderboard: 'Rangliste',
    winner: 'Gewinner',
    teamWins: 'Team {0} gewinnt!',
    playAgain: 'Nochmal spielen',
    backToLobby: 'Zurück zur Lobby',
    points: 'Pkt',

    // Errors
    err_nameRequired: 'Bitte gib einen Namen ein.',
    err_roomNotFound: 'Raum nicht gefunden.',
    err_roomFull: 'Der Raum ist voll.',
    err_gameInProgress: 'Das Spiel läuft bereits.',
    err_noQuestions: 'Keine Fragen für diese Auswahl gefunden. Versuch andere Einstellungen.',
    err_fetchFailed: 'Fragen konnten nicht geladen werden. Bitte erneut versuchen.',
    err_disconnected: 'Verbindung zum Server verloren.'
  },

  en: {
    appTitle: 'AeroooQuiz',
    tagline: 'Online Multiplayer Quiz',
    enter: 'Enter',
    soundHint: '🔊 with sound · click to start',

    yourName: 'Your name',
    namePlaceholder: 'Enter name…',
    createRoom: 'Create room',
    orJoin: 'or join a room',
    roomCode: 'Room code',
    codePlaceholder: 'e.g. ABCD',
    joinRoom: 'Join',

    lobby: 'Lobby',
    inviteHint: 'Share this code with your friends:',
    copy: 'Copy',
    copied: 'Copied!',
    players: 'Players',
    host: 'Host',
    you: 'You',
    settings: 'Settings',
    mode: 'Game mode',
    category: 'Category',
    difficulty: 'Difficulty',
    questionCount: 'Number of questions',
    timePerQuestion: 'Time per question',
    seconds: 'sec',
    chooseTeam: 'Choose your team',
    chooseIcon: 'Choose your avatar',
    playStyle: 'Play style',
    ffa: 'Free-for-all',
    teamsToggle: 'Teams',
    startGame: 'Start game',
    waitingForHost: 'Waiting for the host…',
    onlyHostStarts: 'Only the host can start the game.',
    leave: 'Leave',

    mode_classic: 'Classic',
    mode_speed: 'Fastest wins',
    mode_survival: 'Survival / K.O.',
    mode_teams: 'Teams',
    mode_hilo: 'Higher or lower',
    mode_text: 'Free text',
    mode_estimate: 'Closest guess',
    mode_trueblitz: 'True/False blitz',
    mode_wager: 'Double or nothing',
    mode_classic_desc: 'Correct answer = 100 points. Most points at the end wins.',
    mode_speed_desc: 'The faster your correct answer, the more points you get.',
    mode_survival_desc: 'One wrong answer and you are out. Last one standing wins.',
    mode_teams_desc: 'Play in teams, points are added up together.',
    mode_hilo_desc: 'Two things – pick which one is higher, bigger or more.',
    mode_text_desc: 'Type the answer yourself. Faster = more points.',
    mode_estimate_desc: 'Guess a number – whoever is closest wins the round.',
    mode_trueblitz_desc: 'True or false, rapid fire. Speed matters.',
    mode_wager_desc: 'Wager points before each question. Right doubles them, wrong costs you.',

    // Answer input
    yourAnswerPh: 'Your answer…',
    yourGuessPh: 'Your number…',
    submitAnswer: 'Submit answer',
    setWager: 'Place your wager:',
    wagerAllIn: 'All in',
    wagerPlaced: 'Wager: {0}',
    correctAnswerWas: 'Correct answer:',
    youAnswered: 'You answered: {0}',
    closestWin: 'Closest!',
    noAnswer: '—',

    diff_any: 'Any',
    diff_easy: 'Easy',
    diff_medium: 'Medium',
    diff_hard: 'Hard',

    cat_any: 'Any',
    cat_general: 'General Knowledge',
    cat_science: 'Science & Nature',
    cat_computers: 'Computers',
    cat_maths: 'Mathematics',
    cat_sports: 'Sports',
    cat_geography: 'Geography',
    cat_history: 'History',
    cat_film: 'Film',
    cat_music: 'Music',
    cat_videogames: 'Video Games',
    cat_animals: 'Animals',

    team_red: 'Red',
    team_blue: 'Blue',
    team_green: 'Green',
    team_yellow: 'Yellow',

    loading: 'Loading questions…',
    questionOf: 'Question {0} of {1}',
    score: 'Score',
    timeUp: "Time's up!",
    correct: 'Correct!',
    wrong: 'Wrong answer.',
    locked: 'Answer locked in',
    waitingOthers: 'Waiting for the others…',
    eliminated: 'You have been eliminated',
    spectating: 'You are now spectating.',
    answeredCount: '{0} of {1} answered',
    englishQuestionsNote: 'Questions are in English (Open Trivia DB)',

    gameOver: 'Game over!',
    leaderboard: 'Leaderboard',
    winner: 'Winner',
    teamWins: 'Team {0} wins!',
    playAgain: 'Play again',
    backToLobby: 'Back to lobby',
    points: 'pts',

    err_nameRequired: 'Please enter a name.',
    err_roomNotFound: 'Room not found.',
    err_roomFull: 'The room is full.',
    err_gameInProgress: 'The game is already in progress.',
    err_noQuestions: 'No questions found for this selection. Try other settings.',
    err_fetchFailed: 'Could not load questions. Please try again.',
    err_disconnected: 'Lost connection to the server.'
  }
};

let currentLang = localStorage.getItem('quizLang') || 'de';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('quizLang', lang);
}

/** Translate a key, with optional {0},{1}… placeholder substitution. */
export function t(key, ...args) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.de;
  let str = dict[key] ?? TRANSLATIONS.de[key] ?? key;
  args.forEach((a, i) => { str = str.replace(`{${i}}`, a); });
  return str;
}
