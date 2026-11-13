// Modèle de données, contraintes et analyse des classes.
// Aucun accès au DOM ici : ce module est testable sous Node.

export const NIVEAUX = ['6e', '5e', '4e', '3e'];

export const MODES = [
  { id: 'autorise', label: 'Autorisé', aide: 'Aucune contrainte.' },
  { id: 'interdit', label: 'Interdit', aide: 'Aucun élève ayant ce tag ou cette option dans cette classe.' },
  { id: 'exclusif', label: 'Exclusif', aide: 'Seule(s) classe(s) du niveau à accueillir ces élèves.' },
  { id: 'reserve', label: 'Réservé', aide: 'Exclusif, et la classe n’accueille que ces élèves.' },
];

export const TYPES_REGLES = {
  repartir: { label: 'Répartir équitablement', nbItems: 1, param: 'tol', defaut: 0 },
  equilibrer: { label: 'Équilibrer A et B', nbItems: 2, param: 'tol', defaut: 1 },
  compenser: { label: 'Compenser A par B', nbItems: 2 },
  max: { label: 'Maximum par classe', nbItems: 1, param: 'n', defaut: 2 },
  regrouper: { label: 'Regrouper dans une seule classe', nbItems: 1 },
};

export const TYPES_PROPRIETES = {
  texte: 'Texte',
  nombre: 'Nombre',
  booleen: 'Oui / Non',
  liste: 'Liste de choix',
};

export const COULEURS = ['#2e7d32', '#0277bd', '#c62828', '#ef6c00', '#6a1b9a', '#5d4037', '#455a64',
  '#d84315', '#00897b', '#ad1457', '#283593', '#9e9d24', '#00838f', '#4e342e'];

export function uid(prefixe = '') {
  return prefixe + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function norm(s) {
  return (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function abreviation(nom) {
  const mots = nom.trim().split(/[\s'’-]+/).filter(Boolean);
  if (!mots.length) return '?';
  if (mots.length === 1) return mots[0].slice(0, mots[0].length <= 4 ? 4 : 3).toUpperCase();
  return mots.map(m => m[0]).join('').slice(0, 4).toUpperCase();
}

export function projetParDefaut() {
  const tags = [
    { id: 't_tete', nom: 'Tête de classe', abr: 'TC', couleur: '#2e7d32' },
    { id: 't_moteur', nom: 'Moteur', abr: 'MOT', couleur: '#0277bd' },
    { id: 't_perturbateur', nom: 'Perturbateur', abr: 'PER', couleur: '#c62828' },
    { id: 't_decrocheur', nom: 'Décrocheur', abr: 'DÉC', couleur: '#ef6c00' },
    { id: 't_ulis', nom: 'ULIS', abr: 'ULIS', couleur: '#6a1b9a' },
    { id: 't_segpa', nom: 'Segpa', abr: 'SEG', couleur: '#5d4037' },
  ];
  const options = [
    { id: 'o_allemand', nom: 'Allemand', abr: 'ALL', couleur: '#455a64' },
    { id: 'o_espagnol', nom: 'Espagnol', abr: 'ESP', couleur: '#d84315' },
    { id: 'o_italien', nom: 'Italien', abr: 'ITA', couleur: '#00897b' },
  ];
  return {
    format: 'formation-classes',
    version: 1,
    titre: 'Rentrée',
    tags,
    options,
    proprietes: [],
    eleves: [],
    classes: [],
    incompatibilites: [],
    regles: [
      { id: uid('r_'), type: 'repartir', a: 't_tete', tol: 0 },
      { id: uid('r_'), type: 'repartir', a: 't_moteur', tol: 0 },
      { id: uid('r_'), type: 'repartir', a: 't_perturbateur', tol: 0 },
      { id: uid('r_'), type: 'repartir', a: 't_decrocheur', tol: 0 },
      { id: uid('r_'), type: 'compenser', a: 't_perturbateur', b: 't_moteur' },
    ],
    reglages: { tolGenre: 2, tolEffectif: 2 },
  };
}

// Complète un projet chargé (fichier ancien ou incomplet) sans perdre de données.
export function normaliser(p) {
  const d = projetParDefaut();
  if (!p || typeof p !== 'object') return d;
  const r = { ...d, ...p };
  for (const k of ['tags', 'options', 'proprietes', 'eleves', 'classes', 'incompatibilites', 'regles']) {
    if (!Array.isArray(r[k])) r[k] = d[k];
  }
  r.reglages = { ...d.reglages, ...(p.reglages || {}) };
  r.eleves = r.eleves.map(e => ({
    id: e.id || uid('e_'), nom: e.nom || '', prenom: e.prenom || '', genre: e.genre || '',
    niveau: NIVEAUX.includes(e.niveau) ? e.niveau : '6e', origine: e.origine || '',
    tags: Array.isArray(e.tags) ? e.tags : [], options: Array.isArray(e.options) ? e.options : [],
    props: e.props && typeof e.props === 'object' ? e.props : {}, notes: e.notes || '',
    classe: e.classe || null, verrou: !!e.verrou,
  }));
  r.classes = r.classes.map(c => ({
    id: c.id || uid('c_'), nom: c.nom || 'Classe', niveau: NIVEAUX.includes(c.niveau) ? c.niveau : '6e',
    capacite: Number.isFinite(+c.capacite) ? +c.capacite : 25, modes: c.modes && typeof c.modes === 'object' ? c.modes : {},
  }));
  const idsClasses = new Set(r.classes.map(c => c.id));
  for (const e of r.eleves) if (e.classe && !idsClasses.has(e.classe)) e.classe = null;
  return r;
}

export function indexItems(p) {
  const m = new Map();
  for (const t of p.tags) m.set(t.id, { ...t, sorte: 'tag' });
  for (const o of p.options) m.set(o.id, { ...o, sorte: 'option' });
  return m;
}

export function itemsEleve(e) {
  return [...new Set([...(e.tags || []), ...(e.options || [])])];
}

export function nomComplet(e) {
  return `${(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim() || '(sans nom)';
}

export function nomClasseSuivant(p, niveau) {
  const noms = new Set(p.classes.map(c => c.nom));
  let i = 1;
  while (noms.has(`${niveau}${i}`)) i++;
  return `${niveau}${i}`;
}

// Classes exclusives / réservées par tag ou option, pour un niveau.
export function contexte(p, niveau) {
  const classes = p.classes.filter(c => c.niveau === niveau);
  const exclusifs = {};
  for (const c of classes) {
    for (const [it, m] of Object.entries(c.modes || {})) {
      if (m === 'exclusif' || m === 'reserve') (exclusifs[it] ??= new Set()).add(c.id);
    }
  }
  return { classes, exclusifs };
}

// Raisons pour lesquelles un élève ne devrait pas être dans une classe (contraintes de la classe).
export function problemesPlacement(p, e, c, ctx, idx = indexItems(p)) {
  const pb = [];
  if (c.niveau !== e.niveau) {
    pb.push(`élève de ${e.niveau} dans une classe de ${c.niveau}`);
    return pb;
  }
  const its = new Set(itemsEleve(e));
  for (const it of its) {
    const item = idx.get(it);
    if (!item) continue;
    const m = c.modes?.[it];
    if (m === 'interdit') pb.push(`${item.nom} interdit dans cette classe`);
    else if (ctx.exclusifs[it] && !ctx.exclusifs[it].has(c.id)) {
      const noms = ctx.classes.filter(k => ctx.exclusifs[it].has(k.id)).map(k => k.nom).join(', ');
      pb.push(`${item.nom} réservé à ${noms}`);
    }
  }
  for (const [it, m] of Object.entries(c.modes || {})) {
    if (m === 'reserve' && !its.has(it) && idx.get(it)) pb.push(`classe réservée aux élèves « ${idx.get(it).nom} »`);
  }
  return pb;
}

// Classes du niveau sur lesquelles une règle de répartition porte.
export function classesConcernees(ctx, itemId) {
  return ctx.classes.filter(c => {
    const m = c.modes?.[itemId];
    if (m === 'interdit') return false;
    if (ctx.exclusifs[itemId] && !ctx.exclusifs[itemId].has(c.id)) return false;
    const reservee = Object.values(c.modes || {}).includes('reserve');
    if (reservee && m !== 'reserve') return false;
    return true;
  });
}

function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

// Analyse complète : statistiques et alertes par classe, par niveau et par élève.
export function analyser(p) {
  const idx = indexItems(p);
  const R = { classes: {}, niveaux: {}, eleves: {}, nbErreurs: 0, nbAttentions: 0 };
  const parClasse = new Map(p.classes.map(c => [c.id, []]));
  const nonAffectes = Object.fromEntries(NIVEAUX.map(n => [n, []]));
  for (const e of p.eleves) {
    if (e.classe && parClasse.has(e.classe)) parClasse.get(e.classe).push(e);
    else nonAffectes[e.niveau]?.push(e);
  }
  const alerteEleve = (id, msg) => (R.eleves[id] ??= []).push(msg);
  const stats = liste => {
    const s = { n: liste.length, F: 0, G: 0, X: 0, items: {} };
    for (const e of liste) {
      if (e.genre === 'F') s.F++; else if (e.genre === 'G') s.G++; else s.X++;
      for (const it of itemsEleve(e)) s.items[it] = (s.items[it] || 0) + 1;
    }
    return s;
  };

  for (const niv of NIVEAUX) {
    const ctx = contexte(p, niv);
    const tous = p.eleves.filter(e => e.niveau === niv);
    const sN = stats(tous);
    const pool = nonAffectes[niv];
    const capacite = ctx.classes.reduce((a, c) => a + (+c.capacite || 0), 0);
    const alertesN = [];
    if (tous.length && !ctx.classes.length) alertesN.push({ niv: 'info', msg: 'Aucune classe créée pour ce niveau.' });
    if (ctx.classes.length && capacite < tous.length) alertesN.push({ niv: 'erreur', msg: `Capacité insuffisante : ${tous.length} élèves pour ${capacite} places.` });
    if (pool.length && ctx.classes.length) alertesN.push({ niv: 'info', msg: `${pluriel(pool.length, 'élève')} non affecté${pool.length > 1 ? 's' : ''}.` });
    R.niveaux[niv] = { ...sN, nonAffectes: pool.length, pool: stats(pool), capacite, nbClasses: ctx.classes.length, alertes: alertesN };

    const pF = sN.F + sN.G ? sN.F / (sN.F + sN.G) : 0.5;
    const capTot = capacite || 1;
    const places = tous.length - pool.length;

    for (const c of ctx.classes) {
      const membres = parClasse.get(c.id);
      const s = stats(membres);
      const al = [];
      const add = (niveau, msg) => al.push({ niv: niveau, msg });

      // Effectif
      if (s.n > c.capacite) add('erreur', `Sureffectif : ${s.n} pour ${c.capacite} places.`);
      if (!pool.length && ctx.classes.length > 1 && !Object.values(c.modes || {}).includes('reserve')) {
        const vise = places * (+c.capacite || 0) / capTot;
        if (Math.abs(s.n - vise) > p.reglages.tolEffectif) add('attention', `Effectif ${s.n} (≈ ${Math.round(vise)} visé).`);
      }
      // Genre
      const fg = s.F + s.G;
      if (fg) {
        const attendu = fg * pF;
        if (Math.abs(s.F - attendu) > p.reglages.tolGenre) {
          add('attention', `Filles/garçons : ${s.F} F / ${s.G} G (≈ ${Math.round(attendu)} F attendues).`);
        }
      }
      // Contraintes de la classe
      const resume = {};
      for (const e of membres) {
        for (const m of problemesPlacement(p, e, c, ctx, idx)) {
          alerteEleve(e.id, m);
          resume[m] = (resume[m] || 0) + 1;
        }
      }
      for (const [m, k] of Object.entries(resume)) add('erreur', `${m} (${pluriel(k, 'élève')}).`);

      R.classes[c.id] = { ...s, alertes: al, membres };
    }

    // Règles sur les tags et options
    for (const r of p.regles) {
      const A = idx.get(r.a);
      if (!A) continue;
      const B = r.b ? idx.get(r.b) : null;
      if (TYPES_REGLES[r.type]?.nbItems === 2 && !B) continue;
      if (r.type === 'repartir') {
        const E = classesConcernees(ctx, r.a);
        const nE = E.reduce((a, c) => a + R.classes[c.id].n, 0);
        const tE = E.reduce((a, c) => a + (R.classes[c.id].items[r.a] || 0), 0);
        if (!nE || !tE) continue;
        for (const c of E) {
          const sc = R.classes[c.id];
          const att = tE * sc.n / nE;
          const k = sc.items[r.a] || 0;
          const tol = +r.tol || 0;
          if (k < Math.floor(att) - tol || k > Math.ceil(att) + tol) {
            sc.alertes.push({ niv: 'attention', msg: `${A.nom} : ${k} (≈ ${att < 1 ? att.toFixed(1).replace('.', ',') : Math.round(att)} attendu${att >= 2 ? 's' : ''}).` });
          }
        }
      } else if (r.type === 'regrouper') {
        const avec = ctx.classes.filter(c => R.classes[c.id].items[r.a]);
        if (avec.length > 1) {
          for (const c of avec) {
            const autres = avec.filter(k => k !== c).map(k => k.nom).join(', ');
            R.classes[c.id].alertes.push({ niv: 'attention', msg: `${A.nom} à regrouper (aussi en ${autres}).` });
          }
        }
      } else {
        for (const c of ctx.classes) {
          const sc = R.classes[c.id];
          const ka = sc.items[r.a] || 0;
          const kb = B ? (sc.items[r.b] || 0) : 0;
          if (r.type === 'equilibrer' && Math.abs(ka - kb) > (+r.tol || 0)) {
            sc.alertes.push({ niv: 'attention', msg: `${A.nom} ${ka} / ${B.nom} ${kb} : à équilibrer.` });
          } else if (r.type === 'compenser' && ka > kb) {
            sc.alertes.push({ niv: 'attention', msg: `${A.nom} (${ka}) non compensé par ${B.nom} (${kb}).` });
          } else if (r.type === 'max' && ka > (+r.n || 0)) {
            sc.alertes.push({ niv: 'attention', msg: `${A.nom} : ${ka} (maximum ${+r.n || 0}).` });
          }
        }
      }
    }
  }

  // Incompatibilités
  const parId = new Map(p.eleves.map(e => [e.id, e]));
  for (const inc of p.incompatibilites) {
    const a = parId.get(inc.a), b = parId.get(inc.b);
    if (!a || !b || !a.classe || a.classe !== b.classe || !R.classes[a.classe]) continue;
    R.classes[a.classe].alertes.unshift({ niv: 'erreur', msg: `Incompatibles : ${nomComplet(a)} ↔ ${nomComplet(b)}.` });
    alerteEleve(a.id, `Incompatible avec ${nomComplet(b)}${inc.motif ? ` (${inc.motif})` : ''}`);
    alerteEleve(b.id, `Incompatible avec ${nomComplet(a)}${inc.motif ? ` (${inc.motif})` : ''}`);
  }

  for (const c of Object.values(R.classes)) {
    for (const a of c.alertes) {
      if (a.niv === 'erreur') R.nbErreurs++; else if (a.niv === 'attention') R.nbAttentions++;
    }
  }
  for (const n of Object.values(R.niveaux)) for (const a of n.alertes) if (a.niv === 'erreur') R.nbErreurs++;
  return R;
}

// Supprime un tag ou une option partout.
export function supprimerItem(p, id) {
  p.tags = p.tags.filter(t => t.id !== id);
  p.options = p.options.filter(o => o.id !== id);
  for (const e of p.eleves) {
    e.tags = e.tags.filter(t => t !== id);
    e.options = e.options.filter(o => o !== id);
  }
  for (const c of p.classes) delete c.modes[id];
  p.regles = p.regles.filter(r => r.a !== id && r.b !== id);
}

export function supprimerEleves(p, ids) {
  const s = new Set(ids);
  p.eleves = p.eleves.filter(e => !s.has(e.id));
  p.incompatibilites = p.incompatibilites.filter(i => !s.has(i.a) && !s.has(i.b));
}

export function supprimerClasse(p, id) {
  p.classes = p.classes.filter(c => c.id !== id);
  for (const e of p.eleves) if (e.classe === id) { e.classe = null; e.verrou = false; }
}

export function sontIncompatibles(p, a, b) {
  return p.incompatibilites.some(i => (i.a === a && i.b === b) || (i.a === b && i.b === a));
}

// Export CSV des classes (séparateur ; et BOM pour Excel).
export function exporterCSV(p) {
  const idx = indexItems(p);
  const ordreClasse = new Map(p.classes.map((c, i) => [c.id, i]));
  const nomClasse = new Map(p.classes.map(c => [c.id, c.nom]));
  const eleves = [...p.eleves].sort((a, b) =>
    NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(b.niveau)
    || (ordreClasse.get(a.classe) ?? 1e9) - (ordreClasse.get(b.classe) ?? 1e9)
    || a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
  const esc = v => {
    const s = (v ?? '').toString();
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const entetes = ['Niveau', 'Classe', 'Nom', 'Prénom', 'Genre', 'Classe d’origine', 'Tags', 'Options',
    ...p.proprietes.map(x => x.nom), 'Notes'];
  const lignes = [entetes.map(esc).join(';')];
  for (const e of eleves) {
    lignes.push([
      e.niveau, nomClasse.get(e.classe) || 'Non affecté', e.nom, e.prenom,
      e.genre === 'F' ? 'F' : e.genre === 'G' ? 'G' : '', e.origine,
      e.tags.map(t => idx.get(t)?.nom).filter(Boolean).join(', '),
      e.options.map(o => idx.get(o)?.nom).filter(Boolean).join(', '),
      ...p.proprietes.map(x => {
        const v = e.props[x.id];
        if (x.type === 'booleen') return v ? 'Oui' : v === false ? 'Non' : '';
        return v ?? '';
      }),
      e.notes,
    ].map(esc).join(';'));
  }
  return '﻿' + lignes.join('\r\n') + '\r\n';
}
