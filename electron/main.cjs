// Formation des classes : processus principal Electron (fenêtre, menus, enregistrement).
'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const NB_SAUVEGARDES = 40;
const INTERVALLE_SAUVEGARDE = 30 * 60 * 1000;
const estMac = process.platform === 'darwin';
const WEB = path.join(__dirname, '..', 'web');
// Autotest (intégration continue) : dossier de sortie des captures et du rapport.
const AUTOTEST = process.env.FORMATION_CLASSES_SELFTEST || '';

app.setName('Formation des classes');
if (process.env.FORMATION_CLASSES_USERDATA) app.setPath('userData', process.env.FORMATION_CLASSES_USERDATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let fenetre = null;
let pretAFermer = false;

// ------------------------------------------------------------------ enregistrement du projet
const Depot = {
  dossier: null,
  fichier: null,
  sauvegardes: null,
  derniere: 0,
  rev: 0,

  init() {
    this.dossier = app.getPath('userData');
    this.fichier = path.join(this.dossier, 'projet.json');
    this.sauvegardes = path.join(this.dossier, 'sauvegardes');
    fs.mkdirSync(this.sauvegardes, { recursive: true });
    this.migrer();
    if (fs.existsSync(this.fichier)) {
      this.lire();
      this.sauvegarder();
    }
  },

  lire() {
    if (!fs.existsSync(this.fichier)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(this.fichier, 'utf8'));
      this.rev = Number(data.rev) || 0;
      return data.projet || null;
    } catch {
      fs.copyFileSync(this.fichier, path.join(this.dossier, `projet-illisible-${horodatage()}.json`));
      return null;
    }
  },

  // Reprend un projet de l'ancienne version (navigateur) s'il existe.
  migrer() {
    if (fs.existsSync(this.fichier)) return;
    const anciens = [
      path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'formation-classes', 'donnees', 'projet.json'),
    ];
    for (const f of anciens) {
      try {
        if (fs.existsSync(f)) { fs.copyFileSync(f, this.fichier); return; }
      } catch { /* ignoré */ }
    }
  },

  sauvegarder() {
    if (!fs.existsSync(this.fichier)) return;
    try {
      fs.copyFileSync(this.fichier, path.join(this.sauvegardes, `projet-${horodatage()}.json`));
      this.derniere = Date.now();
      const l = fs.readdirSync(this.sauvegardes).filter(f => /^projet-.*\.json$/.test(f)).sort();
      for (const f of l.slice(0, Math.max(0, l.length - NB_SAUVEGARDES))) fs.unlinkSync(path.join(this.sauvegardes, f));
    } catch { /* une sauvegarde ratée ne doit pas bloquer l'enregistrement */ }
  },

  ecrire(texteProjet) {
    if (Date.now() - this.derniere > INTERVALLE_SAUVEGARDE) this.sauvegarder();
    this.rev += 1;
    const tmp = this.fichier + '.tmp';
    const contenu = `{"rev":${this.rev},"enregistre":${JSON.stringify(new Date().toISOString())},"projet":${texteProjet}}`;
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, contenu, null, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.fichier);
    return this.rev;
  },
};

function horodatage() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

// ------------------------------------------------------------------ position de la fenêtre
const fichierFenetre = () => path.join(app.getPath('userData'), 'fenetre.json');

function lireEtatFenetre() {
  try {
    const e = JSON.parse(fs.readFileSync(fichierFenetre(), 'utf8'));
    const visible = screen.getAllDisplays().some(d => {
      const b = d.workArea;
      return e.x < b.x + b.width - 100 && e.x + e.width > b.x + 100 && e.y >= b.y - 20 && e.y < b.y + b.height - 100;
    });
    return visible ? e : { width: e.width, height: e.height, maximise: e.maximise };
  } catch {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { width: Math.min(1500, width), height: Math.min(950, height), maximise: width < 1500 };
  }
}

function enregistrerEtatFenetre() {
  if (!fenetre || fenetre.isDestroyed()) return;
  try {
    const b = fenetre.getNormalBounds();
    fs.writeFileSync(fichierFenetre(), JSON.stringify({ ...b, maximise: fenetre.isMaximized() }));
  } catch { /* ignoré */ }
}

// ------------------------------------------------------------------ fenêtre
function creerFenetre() {
  const etat = lireEtatFenetre();
  fenetre = new BrowserWindow({
    x: etat.x, y: etat.y, width: etat.width, height: etat.height,
    minWidth: 900, minHeight: 560,
    title: 'Formation des classes',
    backgroundColor: '#eef0f4',
    show: false,
    autoHideMenuBar: true,
    icon: estMac ? undefined : path.join(WEB, 'icone.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (etat.maximise) fenetre.maximize();
  fenetre.once('ready-to-show', () => fenetre.show());
  fenetre.loadFile(path.join(WEB, 'index.html'));
  if (AUTOTEST) fenetre.webContents.once('did-finish-load', () => autotest(fenetre));

  // Aucune navigation hors de l'application.
  fenetre.webContents.on('will-navigate', e => e.preventDefault());
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Avant de fermer, l'interface termine l'enregistrement en cours.
  fenetre.on('close', e => {
    enregistrerEtatFenetre();
    if (pretAFermer) return;
    e.preventDefault();
    fenetre.webContents.send('fermeture');
    setTimeout(() => { pretAFermer = true; if (fenetre && !fenetre.isDestroyed()) fenetre.close(); }, 3000);
  });
  fenetre.on('closed', () => { fenetre = null; });
}

function envoyerMenu(commande) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('menu', commande);
}

function creerMenu() {
  const cmd = (label, commande, accelerator) => ({ label, accelerator, click: () => envoyerMenu(commande) });
  const modele = [
    ...(estMac ? [{
      label: 'Formation des classes',
      submenu: [
        { label: 'À propos de Formation des classes', role: 'about' },
        { type: 'separator' },
        { label: 'Masquer Formation des classes', role: 'hide' },
        { label: 'Masquer les autres', role: 'hideOthers' },
        { label: 'Tout afficher', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quitter Formation des classes', role: 'quit' },
      ],
    }] : []),
    {
      label: 'Fichier',
      submenu: [
        cmd('Importer des élèves (CSV)…', 'importer', 'CmdOrCtrl+I'),
        cmd('Exporter les classes (CSV)…', 'exporter-csv', 'CmdOrCtrl+E'),
        { type: 'separator' },
        cmd('Enregistrer une copie du projet…', 'copie-projet', 'CmdOrCtrl+Shift+S'),
        cmd('Ouvrir un projet…', 'ouvrir-projet', 'CmdOrCtrl+O'),
        cmd('Nouveau projet vide', 'nouveau-projet'),
        { type: 'separator' },
        { label: 'Afficher le dossier des sauvegardes', click: () => shell.openPath(Depot.sauvegardes) },
        ...(estMac ? [] : [{ type: 'separator' }, { label: 'Quitter', role: 'quit', accelerator: 'Ctrl+Q' }]),
      ],
    },
    {
      label: 'Édition',
      submenu: [
        cmd('Annuler', 'annuler', 'CmdOrCtrl+Z'),
        cmd('Rétablir', 'retablir', 'CmdOrCtrl+Shift+Z'),
        { type: 'separator' },
        { label: 'Couper', role: 'cut' },
        { label: 'Copier', role: 'copy' },
        { label: 'Coller', role: 'paste' },
        { label: 'Tout sélectionner', role: 'selectAll' },
        { type: 'separator' },
        cmd('Rechercher un élève', 'rechercher', 'CmdOrCtrl+F'),
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        cmd('Tous les niveaux', 'niveau-tous', 'CmdOrCtrl+0'),
        cmd('6e', 'niveau-6e', 'CmdOrCtrl+6'),
        cmd('5e', 'niveau-5e', 'CmdOrCtrl+5'),
        cmd('4e', 'niveau-4e', 'CmdOrCtrl+4'),
        cmd('3e', 'niveau-3e', 'CmdOrCtrl+3'),
        { type: 'separator' },
        { label: 'Agrandir le texte', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Réduire le texte', role: 'zoomOut' },
        { label: 'Taille normale', role: 'resetZoom', accelerator: 'CmdOrCtrl+Shift+0' },
        { type: 'separator' },
        { label: 'Plein écran', role: 'togglefullscreen' },
        ...(process.env.FORMATION_CLASSES_DEBUG ? [{ label: 'Outils de développement', role: 'toggleDevTools' }] : []),
      ],
    },
    ...(estMac ? [{ label: 'Fenêtre', submenu: [{ label: 'Réduire', role: 'minimize' }, { label: 'Zoom', role: 'zoom' }] }] : []),
    { label: 'Aide', submenu: [cmd('Aide de Formation des classes', 'aide', 'F1')] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

// ------------------------------------------------------------------ échanges avec l'interface
ipcMain.handle('charger', () => { const projet = Depot.lire(); return { rev: Depot.rev, projet }; });

ipcMain.handle('enregistrer', (_e, texteProjet) => {
  JSON.parse(texteProjet); // refuse un contenu invalide
  return { rev: Depot.ecrire(texteProjet) };
});

ipcMain.handle('enregistrer-fichier', async (_e, { nom, contenu, filtre }) => {
  if (process.env.FORMATION_CLASSES_TEST_DOSSIER) { // tests automatiques : pas de boîte de dialogue
    const f = path.join(process.env.FORMATION_CLASSES_TEST_DOSSIER, nom);
    fs.writeFileSync(f, contenu, 'utf8');
    return f;
  }
  const r = await dialog.showSaveDialog(fenetre, {
    defaultPath: path.join(app.getPath('documents'), nom),
    filters: filtre ? [filtre] : [],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, contenu, 'utf8');
  return r.filePath;
});

ipcMain.handle('montrer-fichier', (_e, chemin) => { shell.showItemInFolder(chemin); });

ipcMain.on('fermer', () => {
  pretAFermer = true;
  if (fenetre && !fenetre.isDestroyed()) fenetre.close();
});

ipcMain.on('quitter', () => {
  if (fenetre && !fenetre.isDestroyed()) fenetre.close(); else app.quit();
});

// ------------------------------------------------------------------ démarrage
app.on('second-instance', () => {
  if (!fenetre) return;
  if (fenetre.isMinimized()) fenetre.restore();
  fenetre.show();
  fenetre.focus();
});

app.whenReady().then(() => {
  app.setAboutPanelOptions?.({ applicationName: 'Formation des classes', applicationVersion: app.getVersion(), copyright: 'Application locale de composition des classes' });
  Depot.init();
  creerMenu();
  creerFenetre();
  app.on('activate', () => { if (!fenetre) { pretAFermer = false; creerFenetre(); } });
});

app.on('window-all-closed', () => app.quit());

// ------------------------------------------------------------------ autotest
// Rejoue un scénario complet dans la vraie fenêtre (import, classes, remplissage, glisser-déposer),
// enregistre des captures et un rapport, puis ferme l'application. Utilisé par GitHub Actions.
async function autotest(win) {
  const rapport = { version: app.getVersion(), plateforme: `${process.platform}-${process.arch}`, etapes: [], console: [] };
  const ecrire = () => fs.writeFileSync(path.join(AUTOTEST, 'rapport.json'), JSON.stringify(rapport, null, 2));
  try {
    fs.mkdirSync(AUTOTEST, { recursive: true });
    win.webContents.on('console-message', ev => { if (ev.level === 'error') rapport.console.push(String(ev.message)); });
    const js = code => win.webContents.executeJavaScript(code, true);
    // Les captures sont un bonus : sans carte graphique, certaines machines d'intégration les refusent.
    const capture = async nom => {
      try { fs.writeFileSync(path.join(AUTOTEST, `${nom}.png`), (await win.webContents.capturePage()).toPNG()); }
      catch (e) { (rapport.capturesImpossibles ??= []).push(`${nom} : ${e.message}`); }
    };
    await js(fs.readFileSync(path.join(__dirname, 'autotest.js'), 'utf8') + '\n;true');
    const csv = fs.readFileSync(path.join(__dirname, 'autotest-eleves.csv')).toString('base64');
    for (const [nom, code] of [
      ['import', `__autotest.importer(${JSON.stringify(csv)})`],
      ['remplissage', '__autotest.remplir()'],
      ['glisser', '__autotest.glisser()'],
    ]) {
      const r = await js(code);
      rapport.etapes.push({ nom, ...r });
      await capture(`${String(rapport.etapes.length).padStart(2, '0')}-${nom}`);
    }
    await new Promise(r => setTimeout(r, 1200));
    rapport.enregistre = fs.existsSync(Depot.fichier) ? JSON.parse(fs.readFileSync(Depot.fichier, 'utf8')).projet.eleves.length : 0;
    const fin = rapport.etapes.at(-1);
    rapport.ok = fin.places === fin.eleves && fin.eleves > 0 && fin.erreurs === 0 && rapport.enregistre === fin.eleves && !rapport.console.length;
  } catch (e) {
    rapport.ok = false;
    rapport.exception = String(e?.stack || e);
  }
  ecrire();
  pretAFermer = true;
  app.exit(rapport.ok ? 0 : 1);
}
