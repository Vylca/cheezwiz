// Interface : tableau des classes, glisser-déposer, fiches élèves et fenêtres de réglages.
import * as M from './model.js';
import { decoder, parserCSV, detecterSeparateur, devinerColonnes, devinerNiveau, construireEleves, cleDoublon } from './csv.js';
import { remplirAuto } from './autofill.js';

const { NIVEAUX } = M;

// ---------------------------------------------------------------- utilitaires
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pl = (n, mot, motPl = mot + 's') => `${n} ${n > 1 ? motPl : mot}`;

const ICONES = {
  cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ouvert: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
  reglages: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  alerte: '<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  annuler: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  retablir: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  importer: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  balance: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z"/>',
  eleve: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  classe: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="M20 9v6M17 12h6"/>',
  fichier: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/>',
  aide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.5M12 16.8v.1"/>',
  corbeille: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  interdit: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  modifier: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  sortir: '<path d="M10 17l-5-5 5-5M5 12h13"/>',
  quitter: '<path d="M12 3v9"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
  telecharger: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  ouvrir: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  nouveau: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M12 11v6M9 14h6"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const ico = (nom, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nom] || ''}</svg>`;

// ---------------------------------------------------------------- état
let P = M.projetParDefaut();      // projet courant
let A = M.analyser(P);            // analyse courante
const V = {
  niveau: 'tous', recherche: '', surbrillance: null, selection: new Set(), compact: false, tri: 'nom',
  inspecte: null, choixIncompat: null, alertesOuvertes: new Set(),
};
try { Object.assign(V, JSON.parse(localStorage.getItem('fc-vue') || '{}'), { selection: new Set(), alertesOuvertes: new Set(), inspecte: null, choixIncompat: null, recherche: '', surbrillance: null }); } catch { /* ignoré */ }
const pileAnnuler = [], pileRetablir = [];
let drag = null;
const rafraichisseurs = new Set();
let focusApres = null;

const eleve = id => P.eleves.find(e => e.id === id);
const classe = id => P.classes.find(c => c.id === id);
const items = () => [...P.tags.map(t => ({ ...t, sorte: 'tag' })), ...P.options.map(o => ({ ...o, sorte: 'option' }))];
const item = id => P.tags.find(t => t.id === id) || P.options.find(o => o.id === id);
const estOption = id => P.options.some(o => o.id === id);

function sauverVue() {
  try { localStorage.setItem('fc-vue', JSON.stringify({ niveau: V.niveau, compact: V.compact, tri: V.tri })); } catch { /* ignoré */ }
}

// ---------------------------------------------------------------- stockage
// Dans l'application, l'enregistrement passe par le processus principal (fichier sur disque).
// Ouvert dans un simple navigateur (développement), il se fait dans le stockage local.
const natif = window.natif || null;

const Stockage = {
  rev: 0, timer: null, envoi: null, relancer: false, sale: false,
  async charger() {
    if (natif) {
      const j = await natif.charger();
      this.rev = j.rev || 0;
      return j.projet ? M.normaliser(j.projet) : null;
    }
    try { const s = localStorage.getItem('fc-projet'); return s ? M.normaliser(JSON.parse(s)) : null; } catch { return null; }
  },
  planifier() {
    this.sale = true;
    etatSauvegarde('attente');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.envoyer(), 300);
  },
  envoyer() {
    clearTimeout(this.timer);
    if (this.envoi) { this.relancer = true; return this.envoi; }
    if (!this.sale) return Promise.resolve();
    this.sale = false;
    const texte = JSON.stringify(P);
    const operation = natif
      ? natif.enregistrer(texte).then(r => { this.rev = r.rev; })
      : Promise.resolve().then(() => localStorage.setItem('fc-projet', texte));
    this.envoi = operation
      .then(() => { bandeau(null); etatSauvegarde('ok'); })
      .catch(err => {
        this.sale = true;
        etatSauvegarde('erreur');
        bandeau(`Enregistrement impossible (${esc(err?.message || err)}). <button data-bandeau="reessayer">Réessayer</button>`, 'erreur');
      })
      .finally(() => {
        this.envoi = null;
        if (this.relancer) { this.relancer = false; this.envoyer(); }
      });
    return this.envoi;
  },
};

function etatSauvegarde(etat) {
  const el = $('#etat-sauvegarde');
  const txt = { attente: 'Enregistrement…', ok: `${ico('ok')} Enregistré`, erreur: `${ico('alerte')} Non enregistré` }[etat] || '';
  el.innerHTML = txt;
  el.className = `etat-sauvegarde ${etat}`;
}

function bandeau(html, niv = 'info') {
  const b = $('#bandeau');
  if (!html) { b.hidden = true; return; }
  b.className = niv;
  b.innerHTML = html;
  b.hidden = false;
}

// ---------------------------------------------------------------- mutations / annulation
function muter(label, fn, { sauf = null, toast = null } = {}) {
  const avant = JSON.stringify(P);
  if (fn(P) === false) return false;
  if (JSON.stringify(P) === avant) { rendre(sauf); return false; }
  pileAnnuler.push({ label, etat: avant });
  if (pileAnnuler.length > 100) pileAnnuler.shift();
  pileRetablir.length = 0;
  Stockage.planifier();
  rendre(sauf);
  if (toast) notifier(toast, { annulable: true });
  return true;
}

function annuler() {
  const x = pileAnnuler.pop();
  if (!x) return;
  pileRetablir.push({ label: x.label, etat: JSON.stringify(P) });
  P = JSON.parse(x.etat);
  nettoyerVue();
  Stockage.planifier();
  rendre();
  notifier(`Annulé : ${x.label}`);
}

function retablir() {
  const x = pileRetablir.pop();
  if (!x) return;
  pileAnnuler.push({ label: x.label, etat: JSON.stringify(P) });
  P = JSON.parse(x.etat);
  nettoyerVue();
  Stockage.planifier();
  rendre();
  notifier(`Rétabli : ${x.label}`);
}

function nettoyerVue() {
  const ids = new Set(P.eleves.map(e => e.id));
  for (const id of [...V.selection]) if (!ids.has(id)) V.selection.delete(id);
  if (V.inspecte && !ids.has(V.inspecte)) V.inspecte = null;
  if (V.surbrillance && !item(V.surbrillance)) V.surbrillance = null;
}

// ---------------------------------------------------------------- rendu
let demande = null;
function rendre(sauf = null) {
  if (!demande) {
    demande = new Set(sauf ? [sauf] : []);
    requestAnimationFrame(() => { const s = demande; demande = null; rendreMaintenant(s); });
  } else {
    demande = new Set([...demande].filter(x => x === sauf));
  }
}

function rendreMaintenant(sauf = new Set()) {
  A = M.analyser(P);
  rendreBarre();
  rendrePalette();
  rendreTableau();
  if (!sauf.has('inspecteur')) rendreInspecteur(); else majTitreInspecteur();
  rendreSelection();
  for (const f of rafraichisseurs) f(sauf);
}

// Remplace le contenu d'un conteneur en gardant le champ actif et le défilement.
function remplacer(el, html) {
  const a = document.activeElement;
  const cle = a && el.contains(a) ? a.dataset.f : null;
  let pos = null;
  try { if (cle && typeof a.selectionStart === 'number') pos = [a.selectionStart, a.selectionEnd]; } catch { /* ignoré */ }
  const defile = el.scrollTop;
  el.innerHTML = html;
  el.scrollTop = defile;
  const viser = focusApres || cle;
  if (viser) {
    const n = el.querySelector(`[data-f="${CSS.escape(viser)}"]`);
    if (n) {
      n.focus();
      if (focusApres && n.select) n.select();
      else if (pos && n.setSelectionRange) { try { n.setSelectionRange(pos[0], pos[1]); } catch { /* ignoré */ } }
      if (focusApres === viser) focusApres = null;
    }
  }
}

function rendreBarre() {
  const t = $('#titre-projet');
  if (document.activeElement !== t) t.value = P.titre || '';
  const compte = niv => P.eleves.filter(e => e.niveau === niv).length;
  $('#onglets').innerHTML = [['tous', 'Tous', P.eleves.length], ...NIVEAUX.map(n => [n, n, compte(n)])]
    .map(([id, label, n]) => `<button class="onglet ${V.niveau === id ? 'actif' : ''}" data-action="niveau" data-niveau="${id}">${label}<small>${n}</small></button>`).join('');
  $('#actions').innerHTML = `
    <button data-action="annuler" title="Annuler (Ctrl/⌘ + Z)" ${pileAnnuler.length ? '' : 'disabled'}>${ico('annuler')}</button>
    <button data-action="retablir" title="Rétablir (Ctrl/⌘ + Maj + Z)" ${pileRetablir.length ? '' : 'disabled'}>${ico('retablir')}</button>
    <span class="sep"></span>
    <button data-action="importer" class="primaire" title="Importer des listes d’élèves (.csv)">${ico('importer')}Importer CSV</button>
    <button data-action="nouvel-eleve" title="Ajouter un élève">${ico('eleve')}Élève</button>
    <button data-action="ajouter-classes" title="Ajouter des classes">${ico('classe')}Classe</button>
    <button data-action="regles" title="Règles d’équilibre et incompatibilités">${ico('balance')}Règles</button>
    <button data-action="auto" class="accent" title="Remplir les classes automatiquement">${ico('eclair')}Remplissage auto</button>
    <span class="sep"></span>
    <button data-action="menu-fichier" title="Exporter, sauvegarder, ouvrir">${ico('fichier')}Fichier</button>
    <button data-action="parametres" title="Tags, options et propriétés des élèves">${ico('reglages')}</button>
    <button data-action="aide" title="Aide">${ico('aide')}</button>`;
}

function rendrePalette() {
  const filtre = V.niveau === 'tous' ? P.eleves : P.eleves.filter(e => e.niveau === V.niveau);
  const nb = id => filtre.filter(e => e.tags.includes(id) || e.options.includes(id)).length;
  const chip = (x, opt) => `<span class="chip ${opt ? 'opt' : ''} ${V.surbrillance === x.id ? 'actif' : ''}" draggable="true" data-item="${x.id}" style="--c:${esc(x.couleur)}"
      title="${esc(x.nom)} — cliquer pour surligner ces élèves, glisser sur un élève pour l’ajouter ou le retirer"><b>${esc(x.abr)}</b>${esc(x.nom)}<small>${nb(x.id)}</small></span>`;
  const err = A.nbErreurs, att = A.nbAttentions;
  const nonAff = NIVEAUX.filter(n => V.niveau === 'tous' || n === V.niveau).reduce((a, n) => a + A.niveaux[n].nonAffectes, 0);
  $('#palette').innerHTML = `
    <div class="pal-groupe"><span class="pal-titre">Tags</span>${P.tags.map(t => chip(t, false)).join('')}</div>
    <div class="pal-groupe"><span class="pal-titre">Options</span>${P.options.map(o => chip(o, true)).join('')}
      <button class="chip-ajout" data-action="parametres" title="Gérer les tags, options et propriétés">${ico('plus')}</button></div>
    <div class="pal-espace"></div>
    <label class="pal-ctrl">Tri
      <select id="tri">${[['nom', 'Nom'], ['genre', 'Genre'], ['tags', 'Tags'], ['origine', 'Classe d’origine']].map(([v, l]) => `<option value="${v}" ${V.tri === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </label>
    <label class="pal-ctrl"><input type="checkbox" id="compact" ${V.compact ? 'checked' : ''}> Compact</label>
    <span class="pal-info">${pl(nonAff, 'non affecté')}</span>
    <button class="pal-alertes ${err ? 'erreur' : att ? 'attention' : 'ok'}" data-action="alertes">${err || att ? ico('alerte') : ico('ok')}${err ? pl(err, 'erreur') : ''}${err && att ? ' · ' : ''}${att ? pl(att, 'déséquilibre') : ''}${!err && !att ? 'Aucune alerte' : ''}</button>`;
  document.body.classList.toggle('compact', !!V.compact);
}

const COLLATEUR = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
function triEleves(liste) {
  const ordreTags = new Map(P.tags.map((t, i) => [t.id, i]));
  const parNom = (a, b) => COLLATEUR.compare(a.nom, b.nom) || COLLATEUR.compare(a.prenom, b.prenom);
  const l = [...liste];
  if (V.tri === 'genre') return l.sort((a, b) => (a.genre || 'Z').localeCompare(b.genre || 'Z') || parNom(a, b));
  if (V.tri === 'tags') {
    const k = e => (e.tags.length ? Math.min(...e.tags.map(t => ordreTags.get(t) ?? 99)) : 99);
    return l.sort((a, b) => k(a) - k(b) || parNom(a, b));
  }
  if (V.tri === 'origine') return l.sort((a, b) => COLLATEUR.compare(a.origine || '~', b.origine || '~') || parNom(a, b));
  return l.sort(parNom);
}

function correspond(e, q) {
  const props = Object.values(e.props || {}).join(' ');
  return M.norm(`${e.nom} ${e.prenom} ${e.prenom} ${e.nom} ${e.origine} ${e.notes} ${props}`).includes(q);
}

function carteHTML(e, ctx) {
  const cls = ['carte', `genre-${e.genre || 'X'}`];
  if (V.selection.has(e.id)) cls.push('sel');
  const alertes = A.eleves[e.id];
  if (alertes) cls.push('conflit');
  if (V.inspecte === e.id) cls.push('inspecte');
  if (ctx.partenaires.has(e.id)) cls.push('incompat-vue');
  if (ctx.q && !correspond(e, ctx.q)) cls.push('attenue');
  else if (ctx.q) cls.push('trouve');
  if (V.surbrillance && !e.tags.includes(V.surbrillance) && !e.options.includes(V.surbrillance)) cls.push('attenue');
  if (V.choixIncompat) {
    const src = eleve(V.choixIncompat);
    if (src && (src.niveau !== e.niveau || src.id === e.id)) cls.push('attenue');
  }
  const badges = [
    ...e.tags.map(id => ctx.idx.get(id)).filter(Boolean).map(t => `<i class="badge" style="--c:${esc(t.couleur)}">${esc(t.abr)}</i>`),
    ...e.options.map(id => ctx.idx.get(id)).filter(Boolean).map(o => `<i class="badge opt" style="--c:${esc(o.couleur)}">${esc(o.abr)}</i>`),
  ].join('');
  const props = ctx.propsCarte.map(pr => {
    const v = e.props[pr.id];
    if (v === undefined || v === '' || v === null) return '';
    const txt = pr.type === 'booleen' ? (v ? pr.nom : '') : `${pr.nom} : ${v}`;
    return txt ? `<span>${esc(txt)}</span>` : '';
  }).filter(Boolean).join('');
  const info = [
    M.nomComplet(e),
    [e.genre === 'F' ? 'Fille' : e.genre === 'G' ? 'Garçon' : 'Genre non précisé', e.origine && `origine ${e.origine}`].filter(Boolean).join(' · '),
    e.tags.length ? `Tags : ${e.tags.map(t => ctx.idx.get(t)?.nom).filter(Boolean).join(', ')}` : '',
    e.options.length ? `Options : ${e.options.map(t => ctx.idx.get(t)?.nom).filter(Boolean).join(', ')}` : '',
    ...P.proprietes.filter(pr => e.props[pr.id] !== undefined && e.props[pr.id] !== '').map(pr => `${pr.nom} : ${pr.type === 'booleen' ? (e.props[pr.id] ? 'oui' : 'non') : e.props[pr.id]}`),
    e.verrou ? 'Verrouillé dans sa classe' : '',
    ...(alertes || []).map(a => `⚠ ${a}`),
    e.notes ? `Notes : ${e.notes}` : '',
  ].filter(Boolean).join('\n');
  return `<div class="${cls.join(' ')}" draggable="true" data-eleve="${e.id}" title="${esc(info)}">
    <span class="c-genre">${e.genre || '?'}</span>
    <span class="c-nom"><span class="c-ligne"><b>${esc((e.nom || '').toUpperCase())}</b> ${esc(e.prenom)}</span>${props ? `<span class="c-props">${props}</span>` : ''}</span>
    <span class="c-badges">${badges}</span>
    ${e.verrou ? ico('cadenas', 'c-verrou') : ''}${alertes ? ico('alerte', 'c-alerte') : ''}
  </div>`;
}

function barreGenre(s) {
  const tot = s.F + s.G + s.X;
  if (!tot) return '<div class="genre-barre nul"><span>vide</span></div>';
  return `<div class="genre-barre" title="${s.F} filles, ${s.G} garçons${s.X ? `, ${s.X} non précisé(s)` : ''}">
    ${s.F ? `<span class="f" style="flex:${s.F}">${s.F} F</span>` : ''}${s.G ? `<span class="g" style="flex:${s.G}">${s.G} G</span>` : ''}${s.X ? `<span class="x" style="flex:${s.X}">${s.X}</span>` : ''}</div>`;
}

function compteurs(s, ctx, membres = null) {
  const l = [...P.tags, ...P.options].filter(x => s.items[x.id]).map(x =>
    `<span class="cpt ${estOption(x.id) ? 'opt' : ''}" style="--c:${esc(x.couleur)}" title="${esc(x.nom)}">${esc(x.abr)} ${s.items[x.id]}</span>`);
  if (membres) {
    for (const pr of P.proprietes.filter(x => x.type === 'nombre')) {
      const v = membres.map(e => e.props[pr.id]).filter(x => typeof x === 'number' && Number.isFinite(x));
      if (v.length) l.push(`<span class="cpt moy" title="Moyenne de « ${esc(pr.nom)} » sur ${v.length} élève(s)">${esc(pr.nom)} ⌀ ${(v.reduce((a, b) => a + b, 0) / v.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>`);
    }
  }
  return l.length ? `<div class="compteurs">${l.join('')}</div>` : '';
}

function modesHTML(c, ctx) {
  const l = Object.entries(c.modes || {}).map(([id, m]) => {
    const x = ctx.idx.get(id);
    if (!x) return '';
    const label = { interdit: 'interdit', exclusif: 'exclusif', reserve: 'réservé' }[m];
    return `<span class="mode mode-${m}" style="--c:${esc(x.couleur)}" title="${esc(M.MODES.find(k => k.id === m)?.aide || '')}">${m === 'interdit' ? ico('interdit') : ''}${esc(x.nom)} ${label}</span>`;
  }).filter(Boolean);
  return l.length ? `<div class="modes">${l.join('')}</div>` : '';
}

function alertesHTML(c, alertes) {
  if (!alertes.length) return '';
  const ouvert = V.alertesOuvertes.has(c.id);
  const visibles = ouvert ? alertes : alertes.slice(0, 3);
  return `<ul class="alertes">${visibles.map(a => `<li class="${a.niv}">${esc(a.msg)}</li>`).join('')}
    ${alertes.length > 3 ? `<li class="plus" data-action="basculer-alertes" data-id="${c.id}">${ouvert ? 'Réduire' : `+ ${alertes.length - 3} autre(s)…`}</li>` : ''}</ul>`;
}

function colonnePool(niv, ctx) {
  const st = A.niveaux[niv];
  const membres = triEleves(P.eleves.filter(e => e.niveau === niv && !(e.classe && A.classes[e.classe])));
  return `<div class="colonne pool" data-classe="" data-niveau="${niv}">
    <div class="col-entete">
      <div class="col-titre"><span class="col-nom">Non affectés</span><span class="col-eff">${membres.length}</span>
        <button class="ico-btn" data-action="nouvel-eleve" data-niveau="${niv}" title="Ajouter un élève en ${niv}">${ico('plus')}</button></div>
      ${barreGenre(st.pool)}${compteurs(st.pool, ctx)}
    </div>
    <div class="col-liste" data-liste="pool-${niv}">${membres.map(e => carteHTML(e, ctx)).join('')}
      ${membres.length ? '' : `<div class="vide">${st.n ? 'Tous les élèves sont placés.<br>Glissez un élève ici pour le retirer de sa classe.' : `Aucun élève en ${niv}.<br><button data-action="importer">Importer une liste</button>`}</div>`}</div>
  </div>`;
}

function colonneClasse(c, ctx) {
  const s = A.classes[c.id];
  const err = s.alertes.some(a => a.niv === 'erreur'), att = s.alertes.some(a => a.niv === 'attention');
  const etat = err ? 'erreur' : att ? 'attention' : s.n ? 'ok' : '';
  const taux = c.capacite ? Math.min(100, s.n / c.capacite * 100) : 0;
  return `<div class="colonne classe ${etat}" data-classe="${c.id}" data-niveau="${c.niveau}">
    <div class="col-entete" draggable="true" data-drag-classe="${c.id}" title="Glisser l’en-tête pour déplacer la colonne">
      <div class="col-titre">
        <span class="col-nom" data-action="classe" data-id="${c.id}" title="Réglages de la classe">${esc(c.nom)}</span>
        <span class="col-eff ${s.n > c.capacite ? 'plein' : ''}">${s.n}/${c.capacite}</span>
        <span class="col-etat">${err ? ico('alerte', 'rouge') : att ? ico('alerte', 'orange') : s.n ? ico('ok', 'vert') : ''}</span>
        <button class="ico-btn" data-action="classe" data-id="${c.id}" title="Réglages de la classe">${ico('reglages')}</button>
      </div>
      <div class="jauge ${s.n > c.capacite ? 'plein' : ''}"><i style="width:${taux}%"></i></div>
      ${barreGenre(s)}${compteurs(s, ctx, s.membres)}${modesHTML(c, ctx)}${alertesHTML(c, s.alertes)}
    </div>
    <div class="col-liste" data-liste="${c.id}">${triEleves(s.membres).map(e => carteHTML(e, ctx)).join('')}
      ${s.n ? '' : '<div class="vide">Glissez des élèves ici</div>'}</div>
  </div>`;
}

function rendreTableau() {
  const t = $('#tableau');
  const sx = t.scrollLeft;
  const sy = {};
  for (const l of $$('.col-liste', t)) sy[l.dataset.liste] = l.scrollTop;
  if (!P.eleves.length && !P.classes.length) {
    t.innerHTML = accueilHTML();
    return;
  }
  const ctx = {
    idx: M.indexItems(P),
    q: M.norm(V.recherche),
    propsCarte: P.proprietes.filter(p => p.surCarte),
    partenaires: new Set(V.inspecte ? P.incompatibilites.flatMap(i => (i.a === V.inspecte ? [i.b] : i.b === V.inspecte ? [i.a] : [])) : []),
  };
  const niveaux = V.niveau === 'tous' ? NIVEAUX : [V.niveau];
  t.innerHTML = niveaux.map(niv => {
    const st = A.niveaux[niv];
    const cls = P.classes.filter(c => c.niveau === niv);
    return `<section class="groupe" data-niveau="${niv}">
      <div class="groupe-entete"><div class="groupe-entete-int">
        <h2>${niv}</h2>
        <span class="g-stat">${pl(st.n, 'élève')} · ${st.F} F / ${st.G} G${st.X ? ` / ${st.X} ?` : ''} · ${pl(cls.length, 'classe')} · ${pl(st.capacite, 'place')}</span>
        ${st.alertes.filter(a => a.niv !== 'info').map(a => `<span class="g-alerte ${a.niv}">${esc(a.msg)}</span>`).join('')}
        <span class="g-actions">
          <button data-action="auto" data-niveau="${niv}" class="accent petit" title="Remplir automatiquement les classes de ${niv}">${ico('eclair')}Remplir</button>
        </span>
      </div></div>
      <div class="colonnes">
        ${colonnePool(niv, ctx)}
        ${cls.map(c => colonneClasse(c, ctx)).join('')}
        <button class="colonne-ajout" data-action="ajouter-classes" data-niveau="${niv}">${ico('plus')}<span>Ajouter une classe de ${niv}</span></button>
      </div>
    </section>`;
  }).join('');
  t.scrollLeft = sx;
  for (const l of $$('.col-liste', t)) if (sy[l.dataset.liste]) l.scrollTop = sy[l.dataset.liste];
  if (drag?.type === 'eleves') marquerColonnes(drag.ids);
}

function accueilHTML() {
  return `<div class="accueil">
    <img src="icone.svg" alt="" width="64" height="64">
    <h1>Formation des classes</h1>
    <ol>
      <li><b>Importez vos listes d’élèves</b> (fichiers .csv de Pronote, SIECLE, Excel, LibreOffice…) : bouton « Importer CSV » ou glissez les fichiers dans cette fenêtre. Choisissez le niveau de chaque liste.</li>
      <li><b>Créez les classes</b> de chaque niveau et réglez leurs contraintes (classe Italien, classe Segpa…).</li>
      <li><b>Décrivez les élèves</b> : glissez un tag sur un élève, cliquez sur un élève pour ouvrir sa fiche.</li>
      <li><b>Lancez le remplissage automatique</b>, puis ajustez par glisser-déposer. Les alertes signalent les classes déséquilibrées.</li>
    </ol>
    <div class="accueil-actions">
      <button class="primaire grand" data-action="importer">${ico('importer')}Importer des listes CSV</button>
      <button class="grand" data-action="ajouter-classes">${ico('classe')}Créer des classes</button>
    </div>
  </div>`;
}

function rendreSelection() {
  const b = $('#barre-selection');
  const n = V.selection.size;
  if (!n) { b.hidden = true; return; }
  const sel = [...V.selection].map(eleve).filter(Boolean);
  const tousVerr = sel.every(e => e.verrou);
  b.hidden = false;
  b.innerHTML = `<b>${pl(n, 'élève sélectionné', 'élèves sélectionnés')}</b>
    <span class="aide">Glissez-les vers une classe, ou déposez un tag sur l’un d’eux.</span>
    <button data-action="sel-verrou">${ico(tousVerr ? 'ouvert' : 'cadenas')}${tousVerr ? 'Déverrouiller' : 'Verrouiller'}</button>
    <button data-action="sel-retirer">${ico('sortir')}Retirer des classes</button>
    <button data-action="sel-supprimer" class="danger">${ico('corbeille')}Supprimer</button>
    <button data-action="sel-vider" class="ico-btn" title="Désélectionner (Échap)">${ico('x')}</button>`;
}

// ---------------------------------------------------------------- fiche élève (inspecteur)
function majTitreInspecteur() {
  const e = V.inspecte && eleve(V.inspecte);
  const h = $('#inspecteur h3');
  if (e && h) h.textContent = M.nomComplet(e);
}

function rendreInspecteur() {
  const el = $('#inspecteur');
  const e = V.inspecte && eleve(V.inspecte);
  if (!e) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const cls = P.classes.filter(c => c.niveau === e.niveau);
  const incs = P.incompatibilites.filter(i => i.a === e.id || i.b === e.id);
  const autres = P.eleves.filter(x => x.niveau === e.niveau && x.id !== e.id && !incs.some(i => i.a === x.id || i.b === x.id));
  const al = A.eleves[e.id] || [];
  const champProp = pr => {
    const v = e.props[pr.id];
    const f = `data-f="p-${pr.id}" data-prop="${pr.id}"`;
    let input;
    if (pr.type === 'nombre') input = `<input type="number" step="any" ${f} value="${v ?? ''}">`;
    else if (pr.type === 'booleen') input = `<select ${f}><option value="">—</option><option value="1" ${v === true ? 'selected' : ''}>Oui</option><option value="0" ${v === false ? 'selected' : ''}>Non</option></select>`;
    else if (pr.type === 'liste') input = `<select ${f}><option value="">—</option>${(pr.valeurs || []).map(x => `<option ${v === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    else input = `<input ${f} value="${esc(v ?? '')}">`;
    return `<label class="champ">${esc(pr.nom)}${input}</label>`;
  };
  const html = `
    <header>
      <div><h3>${esc(M.nomComplet(e))}</h3><small>${e.niveau} · ${e.classe && classe(e.classe) ? esc(classe(e.classe).nom) : 'non affecté'}</small></div>
      <button class="ico-btn" data-insp="fermer" title="Fermer (Échap)">${ico('x')}</button>
    </header>
    <div class="insp-corps">
      ${al.length ? `<ul class="alertes">${al.map(a => `<li class="erreur">${esc(a)}</li>`).join('')}</ul>` : ''}
      <div class="champ-ligne">
        <label class="champ">Nom<input data-f="nom" data-champ="nom" value="${esc(e.nom)}"></label>
        <label class="champ">Prénom<input data-f="prenom" data-champ="prenom" value="${esc(e.prenom)}"></label>
      </div>
      <div class="champ"><span class="lbl">Genre</span>
        <div class="segments">${[['F', 'Fille'], ['G', 'Garçon'], ['', 'Non précisé']].map(([v, l]) =>
          `<label><input type="radio" name="insp-genre" value="${v}" ${e.genre === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      </div>
      <div class="champ-ligne">
        <label class="champ">Niveau<select data-f="niveau" data-champ="niveau">${NIVEAUX.map(n => `<option ${n === e.niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Classe<select data-f="classe" data-champ="classe"><option value="">Non affecté</option>${cls.map(c => `<option value="${c.id}" ${c.id === e.classe ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Classe d’origine<input data-f="origine" data-champ="origine" value="${esc(e.origine)}"></label>
      <label class="case"><input type="checkbox" data-champ="verrou" ${e.verrou ? 'checked' : ''} ${e.classe ? '' : 'disabled'}>
        <span><b>${ico('cadenas')}Verrouillé dans sa classe</b><small>Le remplissage automatique ne le déplacera pas.</small></span></label>
      <div class="champ"><span class="lbl">Tags</span>
        <div class="puces">${P.tags.map(t => `<button class="puce ${e.tags.includes(t.id) ? 'on' : ''}" data-insp-item="${t.id}" style="--c:${esc(t.couleur)}">${esc(t.nom)}</button>`).join('')}</div></div>
      <div class="champ"><span class="lbl">Options</span>
        <div class="puces">${P.options.map(o => `<button class="puce ${e.options.includes(o.id) ? 'on' : ''}" data-insp-item="${o.id}" style="--c:${esc(o.couleur)}">${esc(o.nom)}</button>`).join('')}</div></div>
      <div class="champ"><span class="lbl">Propriétés</span>
        ${P.proprietes.map(champProp).join('')}
        <button class="lien" data-insp="props">${ico('plus')}Ajouter une propriété à tous les élèves</button>
      </div>
      <div class="champ"><span class="lbl">Incompatible avec</span>
        ${incs.length ? `<ul class="incs">${incs.map(i => {
          const o = eleve(i.a === e.id ? i.b : i.a);
          return `<li><button class="lien" data-insp="voir" data-id="${o?.id}">${esc(o ? M.nomComplet(o) : '?')}</button>
            <input data-f="m-${i.id}" data-inc-motif="${i.id}" value="${esc(i.motif || '')}" placeholder="motif (facultatif)">
            <button class="ico-btn" data-insp="suppr-inc" data-id="${i.id}" title="Supprimer l’incompatibilité">${ico('x')}</button></li>`;
        }).join('')}</ul>` : '<p class="aide">Aucune.</p>'}
        <div class="inc-ajout">
          <input data-f="ajout-inc" data-ajout-inc list="dl-eleves" placeholder="Taper un nom…">
          <datalist id="dl-eleves">${autres.map(x => `<option value="${esc(libelleEleve(x))}">`).join('')}</datalist>
          <button data-insp="choisir-inc" title="Cliquer ensuite sur l’élève dans le tableau">Choisir sur le tableau</button>
        </div>
      </div>
      <label class="champ">Notes<textarea data-f="notes" data-champ="notes" rows="3">${esc(e.notes)}</textarea></label>
    </div>
    <footer><button class="danger" data-insp="supprimer">${ico('corbeille')}Supprimer l’élève</button></footer>`;
  remplacer(el, html);
}

const libelleEleve = x => `${M.nomComplet(x)}${x.origine ? ` (${x.origine})` : ''}`;

function initInspecteur() {
  const el = $('#inspecteur');
  el.addEventListener('change', ev => {
    const t = ev.target;
    const id = V.inspecte;
    if (!id || !eleve(id)) return;
    const avec = fn => p => { const e = p.eleves.find(x => x.id === id); if (e) return fn(e, p); };
    if (t.dataset.champ) {
      const k = t.dataset.champ;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'classe') v = v || null;
      const texte = ['nom', 'prenom', 'origine', 'notes'].includes(k);
      muter('Modification de la fiche', avec(e => {
        if (k === 'nom') v = v.trim().toUpperCase();
        e[k] = typeof v === 'string' && k !== 'notes' ? v.trim() : v;
        if (k === 'niveau') { e.classe = null; e.verrou = false; }
        if (k === 'classe' && !v) e.verrou = false;
      }), { sauf: texte ? 'inspecteur' : null });
    } else if (t.name === 'insp-genre') {
      muter('Modification du genre', avec(e => { e.genre = t.value; }));
    } else if (t.dataset.prop) {
      const pr = P.proprietes.find(x => x.id === t.dataset.prop);
      let v = t.value;
      if (pr?.type === 'nombre') v = v === '' ? undefined : parseFloat(v);
      if (pr?.type === 'booleen') v = v === '' ? undefined : v === '1';
      muter('Modification d’une propriété', avec(e => { if (v === undefined || v === '') delete e.props[pr.id]; else e.props[pr.id] = v; }),
        { sauf: pr?.type === 'texte' || pr?.type === 'nombre' ? 'inspecteur' : null });
    } else if (t.dataset.incMotif) {
      muter('Motif d’incompatibilité', p => { const i = p.incompatibilites.find(x => x.id === t.dataset.incMotif); if (i) i.motif = t.value.trim(); }, { sauf: 'inspecteur' });
    } else if ('ajoutInc' in t.dataset) {
      const e = eleve(id);
      const cible = P.eleves.find(x => x.niveau === e.niveau && x.id !== id && libelleEleve(x) === t.value);
      if (!cible && t.value.trim()) notifier('Élève introuvable : choisissez un nom dans la liste.', { niv: 'attention' });
    }
  });
  el.addEventListener('input', ev => {
    const t = ev.target;
    if (!('ajoutInc' in t.dataset) || !V.inspecte) return;
    const e = eleve(V.inspecte);
    const cible = e && P.eleves.find(x => x.niveau === e.niveau && x.id !== e.id && libelleEleve(x) === t.value);
    if (cible) ajouterIncompat(e.id, cible.id);
  });
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-insp], [data-insp-item]');
    if (!b) return;
    const id = V.inspecte;
    if (b.dataset.inspItem) {
      basculerItem([id], b.dataset.inspItem);
      return;
    }
    switch (b.dataset.insp) {
      case 'fermer': V.inspecte = null; rendre(); break;
      case 'props': ouvrirParametres('proprietes'); break;
      case 'voir': if (b.dataset.id) { V.inspecte = b.dataset.id; rendre(); montrerEleve(b.dataset.id); } break;
      case 'suppr-inc': muter('Suppression d’une incompatibilité', p => { p.incompatibilites = p.incompatibilites.filter(i => i.id !== b.dataset.id); }); break;
      case 'choisir-inc': commencerChoixIncompat(id); break;
      case 'supprimer': supprimer([id]); break;
    }
  });
}

function ouvrirFiche(id) {
  V.inspecte = id;
  rendre();
}

function montrerEleve(id) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = $(`.carte[data-eleve="${CSS.escape(id)}"]`);
    if (c) { c.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); c.classList.add('flash'); }
  }));
}

// ---------------------------------------------------------------- actions élèves
function basculerItem(ids, itemId) {
  const x = item(itemId);
  if (!x) return;
  const opt = estOption(itemId);
  const els = ids.map(eleve).filter(Boolean);
  const tous = els.every(e => (opt ? e.options : e.tags).includes(itemId));
  const qui = els.length === 1 ? M.nomComplet(els[0]) : pl(els.length, 'élève');
  muter(tous ? `Retrait de « ${x.nom} »` : `Ajout de « ${x.nom} »`, p => {
    for (const id of ids) {
      const e = p.eleves.find(k => k.id === id);
      if (!e) continue;
      const l = opt ? e.options : e.tags;
      if (tous) { const i = l.indexOf(itemId); if (i >= 0) l.splice(i, 1); } else if (!l.includes(itemId)) l.push(itemId);
    }
  }, { toast: `« ${x.nom} » ${tous ? 'retiré de' : 'ajouté à'} ${qui}` });
}

function raisonsDepot(els, classeId) {
  const c = classe(classeId);
  if (!c) return [];
  const ctx = M.contexte(P, c.niveau);
  const idx = M.indexItems(P);
  const ids = new Set(els.map(e => e.id));
  const r = new Set();
  const membres = P.eleves.filter(e => e.classe === c.id && !ids.has(e.id));
  const entrants = els.filter(e => e.classe !== c.id);
  if (membres.length + els.length > c.capacite && entrants.length) r.add(`Classe pleine (${membres.length + els.length}/${c.capacite})`);
  for (const e of els) {
    for (const m of M.problemesPlacement(P, e, c, ctx, idx)) r.add(m);
    for (const o of membres) if (M.sontIncompatibles(P, e.id, o.id)) r.add(`${M.nomComplet(e)} incompatible avec ${M.nomComplet(o)}`);
  }
  return [...r];
}

function deplacer(ids, classeId, niveau) {
  const els = ids.map(eleve).filter(Boolean);
  const bons = els.filter(e => e.niveau === niveau);
  if (bons.length < els.length) notifier(`${pl(els.length - bons.length, 'élève')} d’un autre niveau ignoré(s).`, { niv: 'attention' });
  const aBouger = bons.filter(e => (e.classe || null) !== (classeId || null));
  if (!aBouger.length) return;
  const raisons = classeId ? raisonsDepot(bons, classeId) : [];
  const dest = classeId ? classe(classeId).nom : 'Non affectés';
  const qui = aBouger.length === 1 ? M.nomComplet(aBouger[0]) : pl(aBouger.length, 'élève');
  muter('Déplacement', p => {
    for (const e of aBouger) {
      const x = p.eleves.find(k => k.id === e.id);
      x.classe = classeId || null;
      if (!classeId) x.verrou = false;
    }
  }, { toast: `${qui} → ${dest}${raisons.length ? ` · ⚠ ${raisons[0]}` : ''}` });
}

function ajouterIncompat(a, b) {
  if (a === b) return;
  const ea = eleve(a), eb = eleve(b);
  if (!ea || !eb) return;
  if (ea.niveau !== eb.niveau) { notifier('Les deux élèves doivent être du même niveau.', { niv: 'attention' }); return; }
  if (M.sontIncompatibles(P, a, b)) { notifier('Ces élèves sont déjà incompatibles.'); return; }
  muter('Ajout d’une incompatibilité', p => { p.incompatibilites.push({ id: M.uid('i_'), a, b, motif: '' }); },
    { toast: `Incompatibilité : ${M.nomComplet(ea)} ↔ ${M.nomComplet(eb)}` });
}

function commencerChoixIncompat(id) {
  V.choixIncompat = id;
  document.body.classList.add('choix-incompat');
  bandeau(`Cliquez sur l’élève incompatible avec <b>${esc(M.nomComplet(eleve(id)))}</b>. <button data-bandeau="annuler-choix">Annuler (Échap)</button>`, 'info');
  rendre();
}

function finirChoixIncompat() {
  V.choixIncompat = null;
  document.body.classList.remove('choix-incompat');
  bandeau(null);
  rendre();
}

async function supprimer(ids) {
  const els = ids.map(eleve).filter(Boolean);
  if (!els.length) return;
  const ok = await confirmer(els.length === 1 ? `Supprimer ${M.nomComplet(els[0])} du projet ?` : `Supprimer ${pl(els.length, 'élève')} du projet ?`, { ok: 'Supprimer', danger: true });
  if (!ok) return;
  muter('Suppression', p => M.supprimerEleves(p, ids), { toast: `${pl(els.length, 'élève supprimé', 'élèves supprimés')}` });
  for (const id of ids) V.selection.delete(id);
  if (ids.includes(V.inspecte)) V.inspecte = null;
}

function clicCarte(id, ev) {
  if (V.choixIncompat) {
    const src = V.choixIncompat;
    finirChoixIncompat();
    if (src !== id) ajouterIncompat(src, id);
    return;
  }
  if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
    if (V.selection.has(id)) V.selection.delete(id); else V.selection.add(id);
    rendre();
    return;
  }
  V.selection.clear();
  ouvrirFiche(id);
}

function menuCarte(id, x, y) {
  const e = eleve(id);
  if (!e) return;
  const groupe = V.selection.has(id) && V.selection.size > 1 ? [...V.selection] : [id];
  const els = groupe.map(eleve).filter(Boolean);
  const tousVerr = els.every(k => k.verrou);
  const n = groupe.length > 1 ? ` (${groupe.length})` : '';
  menuContextuel(x, y, [
    { label: 'Ouvrir la fiche', icone: 'modifier', action: () => ouvrirFiche(id) },
    { label: (tousVerr ? 'Déverrouiller' : 'Verrouiller dans sa classe') + n, icone: tousVerr ? 'ouvert' : 'cadenas', action: () => verrouiller(groupe, !tousVerr) },
    { label: 'Incompatible avec…', icone: 'interdit', action: () => commencerChoixIncompat(id) },
    { label: 'Retirer de la classe' + n, icone: 'sortir', action: () => deplacer(groupe, null, e.niveau) },
    '-',
    { label: 'Supprimer' + n, icone: 'corbeille', danger: true, action: () => supprimer(groupe) },
  ]);
}

function verrouiller(ids, valeur) {
  const placeables = ids.map(eleve).filter(e => e && (e.classe || !valeur));
  if (valeur && placeables.length < ids.length) notifier('Seuls les élèves déjà placés peuvent être verrouillés.', { niv: 'attention' });
  muter(valeur ? 'Verrouillage' : 'Déverrouillage', p => {
    for (const e of placeables) p.eleves.find(k => k.id === e.id).verrou = valeur;
  }, { toast: `${pl(placeables.length, 'élève')} ${valeur ? 'verrouillé(s)' : 'déverrouillé(s)'}` });
}

// ---------------------------------------------------------------- glisser-déposer
function marquerColonnes(ids) {
  const els = ids.map(eleve).filter(Boolean);
  const niveaux = new Set(els.map(e => e.niveau));
  for (const col of $$('.colonne[data-classe]')) {
    col.classList.remove('drop-ok', 'drop-attention', 'drop-non');
    delete col.dataset.raison;
    const niv = col.dataset.niveau, cid = col.dataset.classe;
    if (niveaux.size !== 1 || !niveaux.has(niv)) { col.classList.add('drop-non'); continue; }
    if (!cid) { col.classList.add('drop-ok'); continue; }
    const r = raisonsDepot(els, cid);
    col.classList.add(r.length ? 'drop-attention' : 'drop-ok');
    if (r.length) col.dataset.raison = r[0];
  }
}

let survole = null;
function survol(el, cote = null) {
  if (survole && survole !== el) survole.classList.remove('survol', 'avant', 'apres');
  survole = el;
  if (el) {
    el.classList.add('survol');
    el.classList.toggle('avant', cote === 'avant');
    el.classList.toggle('apres', cote === 'apres');
  }
}

function finDrag() {
  drag = null;
  survol(null);
  document.body.classList.remove('drag-eleves', 'drag-item', 'drag-classe');
  for (const el of $$('.en-deplacement')) el.classList.remove('en-deplacement');
  for (const col of $$('.colonne')) { col.classList.remove('drop-ok', 'drop-attention', 'drop-non'); delete col.dataset.raison; }
}

const aDesFichiers = ev => [...(ev.dataTransfer?.types || [])].includes('Files');
// Firefox peut viser un nœud texte : on remonte à l'élément.
const cibleDe = ev => (ev.target?.nodeType === 1 ? ev.target : ev.target?.parentElement) || document.body;
let minuterieVoile = null;

function initDragDrop() {
  document.addEventListener('dragstart', ev => {
    const t = cibleDe(ev);
    const carte = t.closest('.carte');
    const chip = t.closest('#palette [data-item]');
    const entete = t.closest('[data-drag-classe]');
    if (carte) {
      const id = carte.dataset.eleve;
      const ids = V.selection.has(id) ? [...V.selection] : [id];
      drag = { type: 'eleves', ids };
      ev.dataTransfer.effectAllowed = 'copyMove';
      ev.dataTransfer.setData('text/plain', ids.map(i => M.nomComplet(eleve(i))).join('\n'));
      if (ids.length > 1) {
        const g = document.createElement('div');
        g.className = 'fantome';
        g.textContent = pl(ids.length, 'élève');
        document.body.append(g);
        ev.dataTransfer.setDragImage(g, 12, 12);
        setTimeout(() => g.remove(), 0);
      }
      setTimeout(() => {
        if (drag?.type !== 'eleves') return;
        document.body.classList.add('drag-eleves');
        for (const i of ids) $(`.carte[data-eleve="${CSS.escape(i)}"]`)?.classList.add('en-deplacement');
        marquerColonnes(ids);
      }, 0);
    } else if (chip) {
      drag = { type: 'item', id: chip.dataset.item };
      ev.dataTransfer.effectAllowed = 'copy';
      ev.dataTransfer.setData('text/plain', item(chip.dataset.item)?.nom || '');
      setTimeout(() => { if (drag) document.body.classList.add('drag-item'); }, 0);
    } else if (entete) {
      const c = classe(entete.dataset.dragClasse);
      drag = { type: 'classe', id: c.id, niveau: c.niveau };
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', c.nom);
      setTimeout(() => { if (drag) document.body.classList.add('drag-classe'); }, 0);
    }
  });

  document.addEventListener('dragover', ev => {
    const t = cibleDe(ev);
    if (!drag) {
      if (aDesFichiers(ev)) {
        ev.preventDefault();
        $('#voile-fichiers').hidden = false;
        clearTimeout(minuterieVoile);
        minuterieVoile = setTimeout(() => { $('#voile-fichiers').hidden = true; }, 200);
      }
      return;
    }
    if (drag.type === 'eleves') {
      const carte = t.closest('.carte');
      if (ev.altKey && carte && drag.ids.length === 1 && carte.dataset.eleve !== drag.ids[0]) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'link';
        survol(carte);
        return;
      }
      const col = t.closest('.colonne[data-classe]');
      if (col && !col.classList.contains('drop-non')) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        survol(col);
      } else survol(null);
    } else if (drag.type === 'item') {
      const carte = t.closest('.carte');
      if (carte) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; survol(carte); } else survol(null);
    } else if (drag.type === 'classe') {
      const col = t.closest('.colonne.classe');
      if (col && col.dataset.niveau === drag.niveau && col.dataset.classe !== drag.id) {
        ev.preventDefault();
        const r = col.getBoundingClientRect();
        survol(col, ev.clientX < r.left + r.width / 2 ? 'avant' : 'apres');
      } else survol(null);
    }
  });

  document.addEventListener('drop', ev => {
    if (!drag) {
      if (aDesFichiers(ev)) {
        ev.preventDefault();
        $('#voile-fichiers').hidden = true;
        const f = [...ev.dataTransfer.files].filter(x => /\.(csv|txt)$/i.test(x.name) || x.type.includes('csv'));
        if (f.length) ouvrirImport(f);
        else if ([...ev.dataTransfer.files].some(x => /\.json$/i.test(x.name))) ouvrirProjetFichier([...ev.dataTransfer.files].find(x => /\.json$/i.test(x.name)));
        else notifier('Seuls les fichiers .csv peuvent être importés.', { niv: 'attention' });
      }
      return;
    }
    ev.preventDefault();
    const d = drag;
    const t = cibleDe(ev);
    const cote = survole?.classList.contains('avant') ? 'avant' : 'apres';
    finDrag();
    if (d.type === 'eleves') {
      const carte = t.closest('.carte');
      if (ev.altKey && carte && d.ids.length === 1 && carte.dataset.eleve !== d.ids[0]) {
        ajouterIncompat(d.ids[0], carte.dataset.eleve);
        return;
      }
      const col = t.closest('.colonne[data-classe]');
      if (col) deplacer(d.ids, col.dataset.classe || null, col.dataset.niveau);
    } else if (d.type === 'item') {
      const carte = t.closest('.carte');
      if (!carte) return;
      const cible = carte.dataset.eleve;
      basculerItem(V.selection.has(cible) ? [...V.selection] : [cible], d.id);
    } else if (d.type === 'classe') {
      const col = t.closest('.colonne.classe');
      if (!col || col.dataset.classe === d.id) return;
      muter('Déplacement de colonne', p => {
        const i = p.classes.findIndex(c => c.id === d.id);
        const [c] = p.classes.splice(i, 1);
        let j = p.classes.findIndex(k => k.id === col.dataset.classe);
        if (cote === 'apres') j++;
        p.classes.splice(j, 0, c);
      });
    }
  });

  document.addEventListener('dragend', finDrag);
}

// ---------------------------------------------------------------- menus, notifications, fenêtres
function fermerMenus() { for (const m of $$('.menu')) m.remove(); }

function menuContextuel(x, y, entrees, classeSup = '') {
  fermerMenus();
  const m = document.createElement('div');
  m.className = `menu ${classeSup}`;
  m.innerHTML = entrees.map((e, i) => (e === '-' ? '<hr>' : e.html ? e.html : `<button data-i="${i}" class="${e.danger ? 'danger' : ''}">${e.icone ? ico(e.icone) : ''}${esc(e.label)}</button>`)).join('');
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 8))}px`;
  m.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 8))}px`;
  m.addEventListener('click', ev => {
    const b = ev.target.closest('[data-i]');
    if (b) { fermerMenus(); entrees[+b.dataset.i].action(); }
  });
  return m;
}

function notifier(texte, { annulable = false, niv = 'info' } = {}) {
  const t = document.createElement('div');
  t.className = `toast ${niv}`;
  t.innerHTML = `<span>${esc(texte)}</span>${annulable ? '<button>Annuler</button>' : ''}`;
  if (annulable) t.querySelector('button').onclick = () => { annuler(); t.remove(); };
  const z = $('#toasts');
  z.append(t);
  while (z.children.length > 4) z.firstChild.remove();
  setTimeout(() => t.classList.add('sortie'), annulable ? 5500 : 3500);
  setTimeout(() => t.remove(), annulable ? 6000 : 4000);
}

function modal({ titre, corps = '', pied = '', taille = '', classeSup = '' }) {
  const voile = document.createElement('div');
  voile.className = 'voile-modal';
  voile.innerHTML = `<div class="modal ${taille} ${classeSup}" role="dialog" aria-modal="true">
    <header><h3>${titre}</h3><button class="ico-btn" data-fermer title="Fermer (Échap)">${ico('x')}</button></header>
    <div class="modal-corps">${corps}</div>${pied ? `<footer>${pied}</footer>` : ''}</div>`;
  document.body.append(voile);
  const m = {
    el: voile,
    corps: voile.querySelector('.modal-corps'),
    $: s => voile.querySelector(s),
    surFermer: null,
    fermer() {
      if (!voile.isConnected) return;
      voile.remove();
      if (m.rafraichir) rafraichisseurs.delete(m.rafraichir);
      m.surFermer?.();
    },
  };
  voile.addEventListener('mousedown', ev => { if (ev.target === voile) voile.dataset.dehors = '1'; });
  voile.addEventListener('mouseup', ev => { if (ev.target === voile && voile.dataset.dehors) m.fermer(); delete voile.dataset.dehors; });
  voile.addEventListener('click', ev => { if (ev.target.closest('[data-fermer]')) m.fermer(); });
  voile._modal = m;
  return m;
}

function confirmer(message, { ok = 'Confirmer', danger = false, titre = 'Confirmation' } = {}) {
  return new Promise(res => {
    const m = modal({ titre, corps: `<p>${esc(message)}</p>`, pied: `<button data-fermer>Annuler</button><button class="${danger ? 'danger plein' : 'primaire'}" data-ok>${esc(ok)}</button>`, taille: 'petite' });
    let r = false;
    m.$('[data-ok]').onclick = () => { r = true; m.fermer(); };
    m.surFermer = () => res(r);
    m.$('[data-ok]').focus();
  });
}

async function telecharger(nom, contenu, type, filtre) {
  if (natif) {
    const chemin = await natif.enregistrerFichier({ nom, contenu, filtre });
    if (chemin) notifierFichier(chemin);
    return;
  }
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = nom;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const nomFichier = s => (s || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projet';

function notifierFichier(chemin) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>Fichier enregistré : ${esc(chemin.split(/[\\/]/).pop())}</span><button>Afficher</button>`;
  t.querySelector('button').onclick = () => { natif.montrerFichier(chemin); t.remove(); };
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('sortie'), 6000);
  setTimeout(() => t.remove(), 6500);
}

function exporterClasses() {
  telecharger(`classes-${nomFichier(P.titre)}.csv`, M.exporterCSV(P), 'text/csv;charset=utf-8', { name: 'Fichier CSV', extensions: ['csv'] });
  if (!natif) notifier('Classes exportées dans vos téléchargements.');
}

function copieProjet() {
  telecharger(`projet-${nomFichier(P.titre)}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(P, null, 1), 'application/json', { name: 'Projet Formation des classes', extensions: ['json'] });
}

function menuFichier(bouton) {
  const r = bouton.getBoundingClientRect();
  menuContextuel(r.left, r.bottom + 4, [
    { label: 'Importer des élèves (.csv)…', icone: 'importer', action: () => $('#fichier-csv').click() },
    { label: 'Exporter les classes (.csv)…', icone: 'telecharger', action: exporterClasses },
    '-',
    { label: 'Enregistrer une copie du projet…', icone: 'telecharger', action: copieProjet },
    { label: 'Ouvrir un projet…', icone: 'ouvrir', action: () => $('#fichier-projet').click() },
    { label: 'Nouveau projet vide', icone: 'nouveau', action: nouveauProjet },
    ...(natif ? ['-', { label: 'Quitter', icone: 'quitter', action: quitter }] : []),
  ]);
}

async function nouveauProjet() {
  if (!await confirmer('Repartir d’un projet vide ? (Vous pourrez annuler avec Ctrl/⌘ + Z.)', { ok: 'Nouveau projet' })) return;
  muter('Nouveau projet', () => { P = M.projetParDefaut(); }, { toast: 'Nouveau projet créé' });
  V.selection.clear(); V.inspecte = null;
}

async function ouvrirProjetFichier(f) {
  if (!f) return;
  try {
    const data = JSON.parse(decoder(await f.arrayBuffer()).texte);
    if (data.format !== 'formation-classes') throw new Error('format');
    if (!await confirmer(`Remplacer le projet actuel par « ${data.titre || f.name} » ? (Vous pourrez annuler.)`, { ok: 'Ouvrir' })) return;
    muter('Ouverture d’un projet', () => { P = M.normaliser(data); }, { toast: `Projet « ${data.titre || f.name} » ouvert` });
    V.selection.clear(); V.inspecte = null;
  } catch {
    notifier('Ce fichier n’est pas un projet « Formation des classes ».', { niv: 'erreur' });
  }
}

async function quitter() {
  await Stockage.envoyer();
  natif?.quitter();
}

function ouvrirAlertes(bouton) {
  const lignes = [];
  for (const niv of NIVEAUX) {
    for (const a of A.niveaux[niv].alertes) if (a.niv !== 'info') lignes.push({ niv: a.niv, msg: `${niv} : ${a.msg}`, classe: null });
    for (const c of P.classes.filter(k => k.niveau === niv)) {
      for (const a of A.classes[c.id].alertes) lignes.push({ niv: a.niv, msg: `${c.nom} : ${a.msg}`, classe: c.id });
    }
  }
  const r = bouton.getBoundingClientRect();
  const m = menuContextuel(r.right - 380, r.bottom + 4, lignes.length
    ? lignes.map(l => ({ html: `<button class="alerte-ligne ${l.niv}" data-classe-cible="${l.classe || ''}">${ico('alerte')}<span>${esc(l.msg)}</span></button>` }))
    : [{ html: `<p class="aide pad">${ico('ok', 'vert')} Aucune alerte : toutes les classes respectent les règles.</p>` }], 'menu-alertes');
  m.addEventListener('click', ev => {
    const b = ev.target.closest('[data-classe-cible]');
    if (!b || !b.dataset.classeCible) return;
    fermerMenus();
    montrerClasse(b.dataset.classeCible);
  });
}

function montrerClasse(id) {
  const c = classe(id);
  if (!c) return;
  if (V.niveau !== 'tous' && V.niveau !== c.niveau) { V.niveau = c.niveau; sauverVue(); rendre(); }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const col = $(`.colonne[data-classe="${CSS.escape(id)}"]`);
    if (col) { col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); col.classList.add('flash'); setTimeout(() => col.classList.remove('flash'), 1600); }
  }));
}

// ---------------------------------------------------------------- import CSV
async function ouvrirImport(fichiers) {
  const lus = [];
  for (const f of fichiers) {
    try {
      const { texte, encodage } = decoder(await f.arrayBuffer());
      const sep = detecterSeparateur(texte);
      const lignes = parserCSV(texte, sep);
      if (!lignes.length) { notifier(`${f.name} est vide.`, { niv: 'attention' }); continue; }
      const codes = devinerColonnes(lignes[0], P);
      const iOrig = codes.indexOf('origine');
      const devine = iOrig >= 0 ? devinerNiveau(lignes.slice(1).map(l => l[iOrig] || '')) : null;
      lus.push({ nom: f.name, encodage, sep, lignes, entete: true, codes, niveau: devine || (V.niveau !== 'tous' ? V.niveau : '6e'), devine: !!devine });
    } catch {
      notifier(`Impossible de lire ${f.name}.`, { niv: 'erreur' });
    }
  }
  if (!lus.length) return;

  const m = modal({
    titre: `Importer ${lus.length > 1 ? `${lus.length} listes` : 'une liste'} d’élèves`,
    taille: 'large',
    pied: `<label class="case-simple"><input type="checkbox" id="imp-doublons" checked> Ignorer les doublons (même nom, prénom et niveau)</label>
      <span class="espace"></span><button data-fermer>Annuler</button><button class="primaire" id="imp-ok">Importer</button>`,
  });
  const NOMS_SEP = { ';': 'point-virgule', ',': 'virgule', '\t': 'tabulation', '|': 'barre' };
  const choix = (h, code) => {
    const l = [['ignorer', '— Ignorer —'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['nomcomplet', 'Nom et prénom'], ['genre', 'Genre (F/G, 1/2…)'],
      ['origine', 'Classe d’origine'], ['options', 'Options (Allemand, Espagnol…)'], ['tags', 'Tags (séparés par des virgules)'],
      [`tagsi:${h}`, `Tag « ${h} » si la case est remplie`], [`prop:${h}`, `Propriété « ${h} »`]];
    return l.map(([v, t]) => `<option value="${esc(v)}" ${v === code ? 'selected' : ''}>${esc(t)}</option>`).join('');
  };
  const analyse = f => {
    const entetes = f.entete ? f.lignes[0] : f.lignes[0].map((_, j) => `Colonne ${j + 1}`);
    const donnees = f.entete ? f.lignes.slice(1) : f.lignes;
    const r = construireEleves(donnees, f.codes, entetes, f.niveau, P);
    return { entetes, donnees, ...r };
  };
  const rendreCorps = () => {
    m.corps.innerHTML = lus.map((f, i) => {
      const a = analyse(f);
      const nbCols = Math.max(...f.lignes.slice(0, 20).map(l => l.length));
      const entetes = Array.from({ length: nbCols }, (_, j) => a.entetes[j] ?? `Colonne ${j + 1}`);
      const sansNom = !f.codes.some(c => ['nom', 'prenom', 'nomcomplet'].includes(c));
      const F = a.eleves.filter(e => e.genre === 'F').length, G = a.eleves.filter(e => e.genre === 'G').length;
      return `<section class="imp-fichier">
        <header>
          <div><b>${esc(f.nom)}</b><small>${pl(a.donnees.length, 'ligne')} · ${f.encodage} · séparateur ${NOMS_SEP[f.sep] || f.sep}</small></div>
          <label class="niveau-choix">Niveau à la rentrée
            <select data-f="${i}" data-k="niveau">${NIVEAUX.map(n => `<option ${n === f.niveau ? 'selected' : ''}>${n}</option>`).join('')}</select>
            ${f.devine ? '<small>deviné d’après les classes d’origine</small>' : ''}</label>
          <label class="case-simple"><input type="checkbox" data-f="${i}" data-k="entete" ${f.entete ? 'checked' : ''}> 1re ligne = titres</label>
        </header>
        <p class="aide">Indiquez ce que contient chaque colonne :</p>
        <div class="imp-table"><table>
          <thead><tr>${entetes.map((h, j) => `<th><div class="imp-h">${esc(h)}</div><select data-f="${i}" data-col="${j}" class="${f.codes[j] && f.codes[j] !== 'ignorer' ? 'utilise' : ''}">${choix(h, f.codes[j] || 'ignorer')}</select></th>`).join('')}</tr></thead>
          <tbody>${a.donnees.slice(0, 5).map(l => `<tr>${entetes.map((_, j) => `<td class="${f.codes[j] && f.codes[j] !== 'ignorer' ? 'utilise' : ''}">${esc(l[j] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="imp-resume ${sansNom ? 'erreur' : ''}">${sansNom ? `${ico('alerte')} Choisissez au moins une colonne « Nom » ou « Nom et prénom ».`
          : `→ <b>${pl(a.eleves.length, 'élève')}</b> en ${f.niveau} · ${F} F / ${G} G${a.eleves.length - F - G ? ` / ${a.eleves.length - F - G} sans genre` : ''}${a.nouvellesOptions.length ? ` · nouvelles options : ${esc(a.nouvellesOptions.map(x => x.nom).join(', '))}` : ''}${a.nouveauxTags.length ? ` · nouveaux tags : ${esc(a.nouveauxTags.map(x => x.nom).join(', '))}` : ''}${a.nouvellesProps.length ? ` · nouvelles propriétés : ${esc(a.nouvellesProps.map(x => x.nom).join(', '))}` : ''}`}</p>
      </section>`;
    }).join('');
    const total = lus.reduce((s, f) => s + analyse(f).eleves.length, 0);
    const bloque = lus.some(f => !f.codes.some(c => ['nom', 'prenom', 'nomcomplet'].includes(c)));
    const b = m.$('#imp-ok');
    b.disabled = bloque || !total;
    b.textContent = `Importer ${pl(total, 'élève')}`;
  };
  m.corps.addEventListener('change', ev => {
    const t = ev.target;
    const f = lus[+t.dataset.f];
    if (!f) return;
    if (t.dataset.k === 'niveau') { f.niveau = t.value; f.devine = false; }
    else if (t.dataset.k === 'entete') f.entete = t.checked;
    else if (t.dataset.col !== undefined) f.codes[+t.dataset.col] = t.value;
    rendreCorps();
  });
  rendreCorps();
  m.$('#imp-ok').onclick = () => {
    const ignorer = m.$('#imp-doublons').checked;
    let ajoutes = 0, doublons = 0;
    const parNiveau = {};
    muter('Import CSV', p => {
      const vus = new Set(p.eleves.map(cleDoublon));
      for (const f of lus) {
        const a = analyse(f);
        const ids = new Set();
        for (const x of a.nouveauxTags) if (!p.tags.some(t => t.id === x.id)) p.tags.push(x);
        for (const x of a.nouvellesOptions) if (!p.options.some(t => t.id === x.id)) p.options.push(x);
        for (const x of a.nouvellesProps) if (!p.proprietes.some(t => t.id === x.id)) p.proprietes.push(x);
        for (const e of a.eleves) {
          const k = cleDoublon(e);
          if (ignorer && vus.has(k)) { doublons++; continue; }
          vus.add(k); ids.add(e.id);
          e.nom = e.nom.toUpperCase();
          p.eleves.push(e);
          ajoutes++;
          parNiveau[f.niveau] = (parNiveau[f.niveau] || 0) + 1;
        }
      }
    });
    m.fermer();
    const detail = Object.entries(parNiveau).map(([n, k]) => `${k} en ${n}`).join(', ');
    notifier(`${pl(ajoutes, 'élève importé', 'élèves importés')}${detail ? ` (${detail})` : ''}${doublons ? ` · ${pl(doublons, 'doublon ignoré', 'doublons ignorés')}` : ''}`, { annulable: true });
    const niveauxSansClasse = Object.keys(parNiveau).filter(n => !P.classes.some(c => c.niveau === n));
    if (niveauxSansClasse.length) setTimeout(() => ouvrirAjoutClasses(niveauxSansClasse[0]), 300);
  };
}

// ---------------------------------------------------------------- classes
function ouvrirAjoutClasses(niveau) {
  niveau = NIVEAUX.includes(niveau) ? niveau : V.niveau !== 'tous' ? V.niveau : (NIVEAUX.find(n => P.eleves.some(e => e.niveau === n) && !P.classes.some(c => c.niveau === n)) || '6e');
  const derniereCap = P.classes.at(-1)?.capacite || 25;
  const suggestion = n => {
    const nb = P.eleves.filter(e => e.niveau === n).length;
    const deja = P.classes.filter(c => c.niveau === n).length;
    return deja ? 1 : Math.max(1, Math.ceil(nb / derniereCap));
  };
  const m = modal({
    titre: 'Ajouter des classes',
    taille: 'petite',
    corps: `<div class="form-grille">
      <label class="champ">Niveau<select id="ac-niveau">${NIVEAUX.map(n => `<option ${n === niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="champ">Nombre de classes<input id="ac-nombre" type="number" min="1" max="30" value="${suggestion(niveau)}"></label>
      <label class="champ">Élèves maximum par classe<input id="ac-cap" type="number" min="1" max="60" value="${derniereCap}"></label>
    </div><p class="aide" id="ac-apercu"></p>`,
    pied: '<button data-fermer>Annuler</button><button class="primaire" id="ac-ok">Créer</button>',
  });
  const noms = () => {
    const niv = m.$('#ac-niveau').value;
    const nb = Math.max(1, Math.min(30, parseInt(m.$('#ac-nombre').value, 10) || 1));
    const pris = new Set(P.classes.map(c => c.nom));
    const r = [];
    for (let i = 1; r.length < nb; i++) if (!pris.has(`${niv}${i}`)) r.push(`${niv}${i}`);
    return r;
  };
  const apercu = () => {
    const niv = m.$('#ac-niveau').value;
    const nb = P.eleves.filter(e => e.niveau === niv).length;
    const capExist = P.classes.filter(c => c.niveau === niv).reduce((a, c) => a + c.capacite, 0);
    const cap = capExist + noms().length * (parseInt(m.$('#ac-cap').value, 10) || 0);
    m.$('#ac-apercu').innerHTML = `Classes créées : <b>${noms().join(', ')}</b><br>${nb ? `${pl(nb, 'élève')} en ${niv} pour ${pl(cap, 'place')} au total.` : ''}`;
  };
  m.$('#ac-niveau').onchange = () => { m.$('#ac-nombre').value = suggestion(m.$('#ac-niveau').value); apercu(); };
  m.$('#ac-nombre').oninput = apercu;
  m.$('#ac-cap').oninput = apercu;
  apercu();
  m.$('#ac-ok').onclick = () => {
    const niv = m.$('#ac-niveau').value;
    const cap = Math.max(1, parseInt(m.$('#ac-cap').value, 10) || 25);
    const l = noms();
    muter('Création de classes', p => { for (const nom of l) p.classes.push({ id: M.uid('c_'), nom, niveau: niv, capacite: cap, modes: {} }); },
      { toast: `${pl(l.length, 'classe créée', 'classes créées')} : ${l.join(', ')}` });
    m.fermer();
  };
  m.$('#ac-nombre').select();
}

function ouvrirClasse(id) {
  const m = modal({
    titre: 'Réglages de la classe',
    pied: `<button class="danger" id="cl-suppr">${ico('corbeille')}Supprimer la classe</button><span class="espace"></span><button class="primaire" data-fermer>Terminé</button>`,
  });
  m.rafraichir = sauf => {
    const c = classe(id);
    if (!c) { m.fermer(); return; }
    if (sauf?.has('modal')) return;
    const s = A.classes[c.id];
    remplacer(m.corps, `
      <div class="form-grille">
        <label class="champ">Nom<input data-f="nom" data-k="nom" value="${esc(c.nom)}"></label>
        <label class="champ">Niveau<select data-f="niveau" data-k="niveau">${NIVEAUX.map(n => `<option ${n === c.niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Élèves maximum<input type="number" min="0" data-f="capacite" data-k="capacite" value="${c.capacite}"></label>
      </div>
      <p class="aide">${s ? `${pl(s.n, 'élève')} actuellement.` : ''}</p>
      <h4>Tags et options dans cette classe</h4>
      <p class="aide"><b>Interdit</b> : aucun élève avec ce tag. <b>Exclusif</b> : seule(s) classe(s) du niveau à accueillir ces élèves (ex. classe Italien).
        <b>Réservé</b> : exclusif, et la classe n’accueille que ces élèves (ex. classe Segpa).</p>
      <table class="table-modes">${items().map(x => `<tr>
        <td><i class="badge ${x.sorte === 'option' ? 'opt' : ''}" style="--c:${esc(x.couleur)}">${esc(x.abr)}</i> ${esc(x.nom)}</td>
        <td><div class="segments">${M.MODES.map(md => `<label title="${esc(md.aide)}"><input type="radio" name="m-${x.id}" value="${md.id}" ${(c.modes[x.id] || 'autorise') === md.id ? 'checked' : ''}><span class="seg-${md.id}">${md.label}</span></label>`).join('')}</div></td>
      </tr>`).join('')}</table>`);
  };
  rafraichisseurs.add(m.rafraichir);
  m.rafraichir();
  m.corps.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.k) {
      const k = t.dataset.k;
      let v = t.value;
      if (k === 'capacite') v = Math.max(0, parseInt(v, 10) || 0);
      if (k === 'nom') v = v.trim() || classe(id).nom;
      muter('Réglage de classe', p => {
        const c = p.classes.find(x => x.id === id);
        if (k === 'niveau' && v !== c.niveau) {
          c.niveau = v;
          c.modes = {};
          for (const e of p.eleves) if (e.classe === id) { e.classe = null; e.verrou = false; }
        } else c[k] = v;
      }, { sauf: k === 'niveau' ? null : 'modal' });
    } else if (t.type === 'radio') {
      const it = t.name.slice(2);
      muter('Contrainte de classe', p => {
        const c = p.classes.find(x => x.id === id);
        if (t.value === 'autorise') delete c.modes[it]; else c.modes[it] = t.value;
      }, { sauf: 'modal' });
    }
  });
  m.$('#cl-suppr').onclick = async () => {
    const c = classe(id);
    const n = P.eleves.filter(e => e.classe === id).length;
    if (!await confirmer(`Supprimer la classe ${c.nom} ?${n ? ` Ses ${n} élèves retourneront dans « Non affectés ».` : ''}`, { ok: 'Supprimer', danger: true })) return;
    m.fermer();
    muter('Suppression de classe', p => M.supprimerClasse(p, id), { toast: `Classe ${c.nom} supprimée` });
  };
}

// ---------------------------------------------------------------- règles
function phraseRegle(r) {
  const its = items();
  const sel = (k, val) => `<select data-r="${r.id}" data-k="${k}">${its.map(x => `<option value="${x.id}" ${x.id === val ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select>`;
  const num = (k, val) => `<input type="number" min="0" class="petit" data-f="${r.id}-${k}" data-r="${r.id}" data-k="${k}" value="${val ?? 0}">`;
  switch (r.type) {
    case 'repartir': return `Répartir équitablement les élèves ${sel('a', r.a)} entre les classes, avec une tolérance de ${num('tol', r.tol)} élève(s)`;
    case 'equilibrer': return `Équilibrer ${sel('a', r.a)} et ${sel('b', r.b)} dans chaque classe (écart maximum ${num('tol', r.tol)})`;
    case 'compenser': return `Chaque ${sel('a', r.a)} doit être compensé par au moins un ${sel('b', r.b)} dans sa classe`;
    case 'max': return `Au plus ${num('n', r.n)} ${sel('a', r.a)} par classe`;
    case 'regrouper': return `Regrouper tous les ${sel('a', r.a)} dans une même classe`;
    default: return '';
  }
}

function ouvrirRegles() {
  const m = modal({ titre: 'Règles d’équilibre', taille: 'moyenne', pied: '<button class="primaire" data-fermer>Terminé</button>' });
  m.rafraichir = sauf => {
    if (sauf?.has('modal')) return;
    const parId = new Map(P.eleves.map(e => [e.id, e]));
    remplacer(m.corps, `
      <h4>Alertes</h4>
      <div class="form-grille">
        <label class="champ">Écart filles/garçons toléré (en élèves)<input type="number" min="0" data-f="tolGenre" data-g="tolGenre" value="${P.reglages.tolGenre}"></label>
        <label class="champ">Écart d’effectif toléré (en élèves)<input type="number" min="0" data-f="tolEffectif" data-g="tolEffectif" value="${P.reglages.tolEffectif}"></label>
      </div>
      <h4>Règles sur les tags et les options</h4>
      <p class="aide">Elles déclenchent les alertes et guident le remplissage automatique.</p>
      <div class="regles">${P.regles.map(r => `<div class="regle"><span class="regle-type">${esc(M.TYPES_REGLES[r.type]?.label || r.type)}</span>
        <span class="regle-phrase">${phraseRegle(r)}</span>
        <button class="ico-btn" data-op="suppr-regle" data-id="${r.id}" title="Supprimer la règle">${ico('x')}</button></div>`).join('') || '<p class="aide">Aucune règle.</p>'}</div>
      <div class="ajout-regle"><span>Ajouter :</span>${Object.entries(M.TYPES_REGLES).map(([k, t]) => `<button data-op="ajout-regle" data-type="${k}">${ico('plus')}${esc(t.label)}</button>`).join('')}</div>
      <h4>Incompatibilités entre élèves (${P.incompatibilites.length})</h4>
      <p class="aide">Pour en ajouter : clic droit sur un élève → « Incompatible avec… », depuis sa fiche, ou glissez un élève sur un autre en maintenant Alt (⌥).</p>
      ${P.incompatibilites.length ? `<ul class="liste-inc">${P.incompatibilites.map(i => {
        const a = parId.get(i.a), b = parId.get(i.b);
        return `<li><span>${esc(a ? M.nomComplet(a) : '?')} ↔ ${esc(b ? M.nomComplet(b) : '?')}</span><small>${a ? a.niveau : ''}${i.motif ? ` · ${esc(i.motif)}` : ''}</small>
          <button class="ico-btn" data-op="suppr-inc" data-id="${i.id}" title="Supprimer">${ico('x')}</button></li>`;
      }).join('')}</ul>` : ''}`);
  };
  rafraichisseurs.add(m.rafraichir);
  m.rafraichir();
  m.corps.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.g) {
      muter('Tolérance', p => { p.reglages[t.dataset.g] = Math.max(0, parseInt(t.value, 10) || 0); }, { sauf: 'modal' });
    } else if (t.dataset.r) {
      const k = t.dataset.k;
      const v = k === 'tol' || k === 'n' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
      muter('Modification de règle', p => { const r = p.regles.find(x => x.id === t.dataset.r); if (r) r[k] = v; }, { sauf: k === 'tol' || k === 'n' ? 'modal' : null });
    }
  });
  m.corps.addEventListener('click', ev => {
    const b = ev.target.closest('[data-op]');
    if (!b) return;
    if (b.dataset.op === 'suppr-regle') muter('Suppression de règle', p => { p.regles = p.regles.filter(r => r.id !== b.dataset.id); });
    if (b.dataset.op === 'suppr-inc') muter('Suppression d’une incompatibilité', p => { p.incompatibilites = p.incompatibilites.filter(r => r.id !== b.dataset.id); });
    if (b.dataset.op === 'ajout-regle') {
      const type = b.dataset.type;
      const t = M.TYPES_REGLES[type];
      const its = items();
      const r = { id: M.uid('r_'), type, a: its[0]?.id };
      if (t.nbItems === 2) r.b = its[1]?.id;
      if (t.param) r[t.param] = t.defaut;
      if (!r.a) return;
      muter('Ajout de règle', p => { p.regles.push(r); });
    }
  });
}

// ---------------------------------------------------------------- paramètres : tags, options, propriétés
function ouvrirParametres(section) {
  const m = modal({ titre: 'Tags, options et propriétés', taille: 'moyenne', pied: '<button class="primaire" data-fermer>Terminé</button>' });
  const ligneItem = (x, sorte) => {
    const n = P.eleves.filter(e => (sorte === 'tag' ? e.tags : e.options).includes(x.id)).length;
    return `<tr>
      <td><input type="color" data-x="${x.id}" data-k="couleur" value="${esc(x.couleur)}" title="Couleur"></td>
      <td><input data-f="nom-${x.id}" data-x="${x.id}" data-k="nom" value="${esc(x.nom)}"></td>
      <td><input data-f="abr-${x.id}" data-x="${x.id}" data-k="abr" value="${esc(x.abr)}" maxlength="5" class="petit" title="Abréviation affichée sur les cartes"></td>
      <td class="doux">${pl(n, 'élève')}</td>
      <td><button class="ico-btn" data-op="suppr-item" data-id="${x.id}" title="Supprimer">${ico('corbeille')}</button></td></tr>`;
  };
  m.rafraichir = sauf => {
    if (sauf?.has('modal')) return;
    remplacer(m.corps, `
      <h4 id="sec-tags">Tags</h4>
      <table class="table-items"><tr><th></th><th>Nom</th><th>Abrév.</th><th></th><th></th></tr>${P.tags.map(t => ligneItem(t, 'tag')).join('')}</table>
      <button data-op="ajout" data-sorte="tag">${ico('plus')}Ajouter un tag</button>
      <h4 id="sec-options">Options</h4>
      <table class="table-items"><tr><th></th><th>Nom</th><th>Abrév.</th><th></th><th></th></tr>${P.options.map(o => ligneItem(o, 'option')).join('')}</table>
      <button data-op="ajout" data-sorte="option">${ico('plus')}Ajouter une option</button>
      <h4 id="sec-proprietes">Propriétés des élèves</h4>
      <p class="aide">Informations libres attachées à chaque élève (moyenne, PAP, demande des parents…), modifiables dans sa fiche.</p>
      ${P.proprietes.length ? `<table class="table-items"><tr><th>Nom</th><th>Type</th><th>Choix possibles</th><th>Sur la carte</th><th></th></tr>${P.proprietes.map(pr => `<tr>
        <td><input data-f="pnom-${pr.id}" data-pr="${pr.id}" data-k="nom" value="${esc(pr.nom)}"></td>
        <td><select data-pr="${pr.id}" data-k="type">${Object.entries(M.TYPES_PROPRIETES).map(([k, l]) => `<option value="${k}" ${pr.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${pr.type === 'liste' ? `<input data-f="pval-${pr.id}" data-pr="${pr.id}" data-k="valeurs" value="${esc((pr.valeurs || []).join(', '))}" placeholder="choix séparés par des virgules">` : '<span class="doux">—</span>'}</td>
        <td><input type="checkbox" data-pr="${pr.id}" data-k="surCarte" ${pr.surCarte ? 'checked' : ''}></td>
        <td><button class="ico-btn" data-op="suppr-prop" data-id="${pr.id}" title="Supprimer">${ico('corbeille')}</button></td></tr>`).join('')}</table>` : ''}
      <button data-op="ajout-prop">${ico('plus')}Ajouter une propriété</button>`);
  };
  rafraichisseurs.add(m.rafraichir);
  m.rafraichir();
  if (section) requestAnimationFrame(() => m.$(`#sec-${section}`)?.scrollIntoView({ block: 'start' }));
  m.corps.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.x) {
      const k = t.dataset.k;
      const v = t.value.trim();
      if (!v) { rendre(); return; }
      muter('Modification d’un tag', p => { const x = p.tags.find(y => y.id === t.dataset.x) || p.options.find(y => y.id === t.dataset.x); if (x) x[k] = k === 'abr' ? v.toUpperCase() : v; }, { sauf: 'modal' });
    } else if (t.dataset.pr) {
      const k = t.dataset.k;
      muter('Modification d’une propriété', p => {
        const pr = p.proprietes.find(y => y.id === t.dataset.pr);
        if (!pr) return;
        if (k === 'surCarte') pr.surCarte = t.checked;
        else if (k === 'valeurs') pr.valeurs = t.value.split(',').map(s => s.trim()).filter(Boolean);
        else if (k === 'nom') pr.nom = t.value.trim() || pr.nom;
        else if (k === 'type') pr.type = t.value;
      }, { sauf: k === 'type' ? null : 'modal' });
    }
  });
  m.corps.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-op]');
    if (!b) return;
    const op = b.dataset.op;
    if (op === 'ajout') {
      const sorte = b.dataset.sorte;
      const nom = sorte === 'tag' ? 'Nouveau tag' : 'Nouvelle option';
      const x = { id: M.uid(sorte === 'tag' ? 't_' : 'o_'), nom, abr: sorte === 'tag' ? 'TAG' : 'OPT', couleur: M.COULEURS[(P.tags.length + P.options.length) % M.COULEURS.length] };
      focusApres = `nom-${x.id}`;
      muter(sorte === 'tag' ? 'Ajout d’un tag' : 'Ajout d’une option', p => { (sorte === 'tag' ? p.tags : p.options).push(x); });
    } else if (op === 'ajout-prop') {
      const pr = { id: M.uid('p_'), nom: 'Nouvelle propriété', type: 'texte', valeurs: [], surCarte: false };
      focusApres = `pnom-${pr.id}`;
      muter('Ajout d’une propriété', p => { p.proprietes.push(pr); });
    } else if (op === 'suppr-item') {
      const x = item(b.dataset.id);
      const n = P.eleves.filter(e => e.tags.includes(x.id) || e.options.includes(x.id)).length;
      if (!await confirmer(`Supprimer « ${x.nom} » ?${n ? ` Il sera retiré de ${pl(n, 'élève')}.` : ''}`, { ok: 'Supprimer', danger: true })) return;
      muter(`Suppression de « ${x.nom} »`, p => M.supprimerItem(p, x.id));
    } else if (op === 'suppr-prop') {
      const pr = P.proprietes.find(y => y.id === b.dataset.id);
      if (!await confirmer(`Supprimer la propriété « ${pr.nom} » pour tous les élèves ?`, { ok: 'Supprimer', danger: true })) return;
      muter('Suppression d’une propriété', p => {
        p.proprietes = p.proprietes.filter(y => y.id !== pr.id);
        for (const e of p.eleves) delete e.props[pr.id];
      });
    }
  });
}

// ---------------------------------------------------------------- nouvel élève
function ouvrirNouvelEleve(niveau) {
  niveau = NIVEAUX.includes(niveau) ? niveau : V.niveau !== 'tous' ? V.niveau : '6e';
  const m = modal({
    titre: 'Nouvel élève',
    taille: 'petite',
    corps: `<div class="form-grille deux">
      <label class="champ">Nom<input id="ne-nom" autocomplete="off"></label>
      <label class="champ">Prénom<input id="ne-prenom" autocomplete="off"></label>
      <div class="champ"><span class="lbl">Genre</span><div class="segments">${[['F', 'Fille'], ['G', 'Garçon'], ['', 'Non précisé']].map(([v, l], i) =>
        `<label><input type="radio" name="ne-genre" value="${v}" ${i === 2 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <label class="champ">Niveau<select id="ne-niveau">${NIVEAUX.map(n => `<option ${n === niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>`,
    pied: '<button data-fermer>Annuler</button><button class="primaire" id="ne-ok">Ajouter</button>',
  });
  const valider = () => {
    const nom = m.$('#ne-nom').value.trim().toUpperCase(), prenom = m.$('#ne-prenom').value.trim();
    if (!nom && !prenom) { m.$('#ne-nom').focus(); return; }
    const e = { id: M.uid('e_'), nom, prenom, genre: m.$('input[name="ne-genre"]:checked').value, niveau: m.$('#ne-niveau').value, origine: '', tags: [], options: [], props: {}, notes: '', classe: null, verrou: false };
    muter('Ajout d’un élève', p => { p.eleves.push(e); }, { toast: `${M.nomComplet(e)} ajouté(e) en ${e.niveau}` });
    m.fermer();
    V.inspecte = e.id;
    montrerEleve(e.id);
  };
  m.$('#ne-ok').onclick = valider;
  m.corps.addEventListener('keydown', ev => { if (ev.key === 'Enter') valider(); });
  m.$('#ne-nom').focus();
}

// ---------------------------------------------------------------- remplissage automatique
function ouvrirAuto(niveau) {
  const avecClasses = NIVEAUX.filter(n => P.classes.some(c => c.niveau === n) && P.eleves.some(e => e.niveau === n));
  if (!avecClasses.length) {
    notifier('Créez d’abord des classes et importez des élèves.', { niv: 'attention' });
    return;
  }
  const coches = new Set(niveau ? [niveau] : V.niveau !== 'tous' ? [V.niveau] : avecClasses);
  let poids = { genre: 3, tags: 3, effectif: 2 };
  try { poids = { ...poids, ...JSON.parse(localStorage.getItem('fc-poids') || '{}') }; } catch { /* ignoré */ }
  const m = modal({
    titre: 'Remplissage automatique',
    taille: 'moyenne',
    corps: `
      <h4>Niveaux</h4>
      <div class="puces">${NIVEAUX.map(n => {
        const ok = avecClasses.includes(n);
        const st = A.niveaux[n];
        return `<label class="case-niveau ${ok ? '' : 'desactive'}"><input type="checkbox" value="${n}" ${ok && coches.has(n) ? 'checked' : ''} ${ok ? '' : 'disabled'}>
          <span><b>${n}</b><small>${pl(st.n, 'élève')} · ${pl(st.nbClasses, 'classe')}</small></span></label>`;
      }).join('')}</div>
      <h4>Mode</h4>
      <label class="choix-mode"><input type="radio" name="au-mode" value="tout" checked><span><b>Tout redistribuer</b><small>Recompose les classes. Les élèves verrouillés ${ico('cadenas')} ne bougent pas.</small></span></label>
      <label class="choix-mode"><input type="radio" name="au-mode" value="completer"><span><b>Compléter seulement</b><small>Place uniquement les élèves non affectés, sans toucher aux autres.</small></span></label>
      <h4>Priorités</h4>
      <div class="curseurs">
        <label><span>Équilibre filles / garçons</span><input type="range" min="0" max="5" data-p="genre" value="${poids.genre}"><output>${poids.genre}</output></label>
        <label><span>Règles sur les tags et options</span><input type="range" min="0" max="5" data-p="tags" value="${poids.tags}"><output>${poids.tags}</output></label>
        <label><span>Effectifs équilibrés</span><input type="range" min="0" max="5" data-p="effectif" value="${poids.effectif}"><output>${poids.effectif}</output></label>
      </div>
      <p class="aide">Toujours respectés : niveau, capacité, tags et options interdits, exclusifs ou réservés. Les incompatibilités sont évitées en priorité.
        Le résultat peut être annulé (Ctrl/⌘ + Z).</p>`,
    pied: `<button data-fermer>Annuler</button><button class="accent" id="au-ok">${ico('eclair')}Lancer</button>`,
  });
  m.corps.addEventListener('input', ev => { if (ev.target.dataset.p) ev.target.nextElementSibling.textContent = ev.target.value; });
  m.$('#au-ok').onclick = () => {
    const niveaux = $$('input[type=checkbox]:checked', m.corps).map(x => x.value);
    if (!niveaux.length) { notifier('Cochez au moins un niveau.', { niv: 'attention' }); return; }
    const mode = m.$('input[name="au-mode"]:checked').value;
    const pds = Object.fromEntries($$('input[data-p]', m.corps).map(x => [x.dataset.p, +x.value]));
    try { localStorage.setItem('fc-poids', JSON.stringify(pds)); } catch { /* ignoré */ }
    const b = m.$('#au-ok');
    b.disabled = true;
    b.innerHTML = `${ico('eclair')}Calcul en cours…`;
    setTimeout(() => {
      const res = remplirAuto(P, { niveaux, mode, poids: pds });
      const nb = Object.keys(res.affectations).length;
      muter('Remplissage automatique', p => {
        for (const [id, c] of Object.entries(res.affectations)) {
          const e = p.eleves.find(x => x.id === id);
          if (e) { e.classe = c; if (!c) e.verrou = false; }
        }
      });
      m.fermer();
      const A2 = M.analyser(P);
      const restant = niveaux.reduce((s, n) => s + P.classes.filter(c => c.niveau === n).reduce((a, c) => a + A2.classes[c.id].alertes.length, 0), 0);
      const r = modal({
        titre: 'Remplissage terminé',
        taille: 'petite',
        corps: `<p>${ico('ok', 'vert')} <b>${pl(nb - res.nonPlaces.length, 'élève placé', 'élèves placés')}</b> en ${niveaux.join(', ')}.</p>
          ${res.nonPlaces.length ? `<p>${ico('alerte', 'orange')} ${pl(res.nonPlaces.length, 'élève non placé', 'élèves non placés')} :</p><ul class="liste-simple">${res.nonPlaces.slice(0, 12).map(x => `<li>${esc(M.nomComplet(eleve(x.id)))} — ${esc(x.raison)}</li>`).join('')}${res.nonPlaces.length > 12 ? '<li>…</li>' : ''}</ul>` : ''}
          <p>${restant ? `${pl(restant, 'alerte restante', 'alertes restantes')} : voyez les en-têtes de colonnes et ajustez par glisser-déposer.` : 'Aucune alerte restante.'}</p>`,
        pied: '<button id="au-annuler">Annuler le remplissage</button><button class="primaire" data-fermer>OK</button>',
      });
      r.$('#au-annuler').onclick = () => { annuler(); r.fermer(); };
    }, 30);
  };
}

// ---------------------------------------------------------------- aide
function ouvrirAide() {
  modal({
    titre: 'Aide',
    taille: 'moyenne',
    corps: `<div class="aide-grille">
      <div><h4>Glisser-déposer</h4><ul>
        <li><b>Élève → colonne</b> : le place dans la classe (ou le retire, vers « Non affectés »). Pendant le glisser, les colonnes en vert sont sans problème, en orange avec une alerte.</li>
        <li><b>Tag ou option → élève</b> : l’ajoute ou le retire (à toute la sélection si l’élève est sélectionné).</li>
        <li><b>Élève → élève avec Alt (⌥)</b> : crée une incompatibilité.</li>
        <li><b>En-tête de classe → autre classe</b> : réordonne les colonnes.</li>
        <li><b>Fichiers CSV → fenêtre</b> : les importe.</li></ul></div>
      <div><h4>Clics</h4><ul>
        <li><b>Clic</b> sur un élève : ouvre sa fiche.</li>
        <li><b>Ctrl/⌘ ou Maj + clic</b> : sélection multiple, puis glissez le groupe.</li>
        <li><b>Clic droit</b> : verrouiller, incompatibilité, retirer, supprimer.</li>
        <li><b>Clic sur un tag</b> de la barre : surligne les élèves concernés.</li>
        <li><b>Nom d’une classe</b> : ses réglages (capacité, tags interdits, exclusifs, réservés).</li></ul></div>
      <div><h4>Raccourcis</h4><ul>
        <li><kbd>Ctrl/⌘ Z</kbd> annuler, <kbd>Ctrl/⌘ Maj Z</kbd> rétablir</li>
        <li><kbd>Ctrl/⌘ F</kbd> rechercher</li>
        <li><kbd>Échap</kbd> fermer, désélectionner</li></ul></div>
      <div><h4>Repères</h4><ul>
        <li>Bordure rose : fille, bleue : garçon.</li>
        <li>${ico('cadenas')} élève verrouillé : le remplissage automatique ne le déplace pas.</li>
        <li>Carte rouge : contrainte non respectée (incompatibilité, tag interdit…).</li>
        <li>Le travail est enregistré automatiquement.</li></ul></div>
    </div>`,
    pied: '<button class="primaire" data-fermer>Fermer</button>',
  });
}

// ---------------------------------------------------------------- événements globaux
const ACTIONS = {
  niveau: b => { V.niveau = b.dataset.niveau; sauverVue(); rendre(); },
  annuler, retablir,
  importer: () => $('#fichier-csv').click(),
  'nouvel-eleve': b => ouvrirNouvelEleve(b.dataset.niveau),
  'ajouter-classes': b => ouvrirAjoutClasses(b.dataset.niveau),
  regles: ouvrirRegles,
  auto: b => ouvrirAuto(b.dataset.niveau),
  'menu-fichier': b => menuFichier(b),
  parametres: () => ouvrirParametres(),
  aide: ouvrirAide,
  alertes: b => ouvrirAlertes(b),
  classe: b => ouvrirClasse(b.dataset.id),
  'basculer-alertes': b => { const id = b.dataset.id; if (V.alertesOuvertes.has(id)) V.alertesOuvertes.delete(id); else V.alertesOuvertes.add(id); rendre(); },
  'sel-verrou': () => { const ids = [...V.selection]; verrouiller(ids, !ids.map(eleve).every(e => e?.verrou)); },
  'sel-retirer': () => { const ids = [...V.selection]; for (const n of NIVEAUX) { const l = ids.filter(i => eleve(i)?.niveau === n); if (l.length) deplacer(l, null, n); } },
  'sel-supprimer': () => supprimer([...V.selection]),
  'sel-vider': () => { V.selection.clear(); rendre(); },
};

function initEvenements() {
  document.addEventListener('click', ev => {
    if (ev.target.closest('.voile-modal, .menu, #inspecteur')) return;
    const bb = ev.target.closest('[data-bandeau]');
    if (bb) {
      const op = bb.dataset.bandeau;
      if (op === 'reessayer') { Stockage.sale = true; Stockage.envoyer(); }
      if (op === 'annuler-choix') finirChoixIncompat();
      return;
    }
    const act = ev.target.closest('[data-action]');
    if (act && !act.disabled) { ACTIONS[act.dataset.action]?.(act, ev); return; }
    const carte = ev.target.closest('.carte');
    if (carte) { clicCarte(carte.dataset.eleve, ev); return; }
    const chip = ev.target.closest('#palette [data-item]');
    if (chip) { V.surbrillance = V.surbrillance === chip.dataset.item ? null : chip.dataset.item; rendre(); return; }
    if (ev.target.closest('#tableau') && !ev.target.closest('button, input, select') && V.selection.size && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey) {
      V.selection.clear(); rendre();
    }
  });
  document.addEventListener('mousedown', ev => { if (!ev.target.closest('.menu')) fermerMenus(); });
  document.addEventListener('contextmenu', ev => {
    const carte = ev.target.closest('.carte');
    if (!carte) return;
    ev.preventDefault();
    menuCarte(carte.dataset.eleve, ev.clientX, ev.clientY);
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'tri') { V.tri = t.value; sauverVue(); rendre(); }
    if (t.id === 'compact') { V.compact = t.checked; sauverVue(); rendre(); }
    if (t.id === 'titre-projet') muter('Nom du projet', p => { p.titre = t.value.trim() || 'Rentrée'; });
    if (t.id === 'fichier-csv' && t.files.length) { ouvrirImport([...t.files]); t.value = ''; }
    if (t.id === 'fichier-projet' && t.files.length) { ouvrirProjetFichier(t.files[0]); t.value = ''; }
  });
  let minRech = null;
  $('#recherche').addEventListener('input', ev => {
    clearTimeout(minRech);
    minRech = setTimeout(() => { V.recherche = ev.target.value; rendre(); }, 120);
  });
  $('#recherche').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { const c = $('.carte.trouve'); if (c) montrerEleve(c.dataset.eleve); }
  });
  $('#titre-projet').addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.target.blur(); });

  document.addEventListener('keydown', ev => {
    const mod = ev.metaKey || ev.ctrlKey;
    if (ev.key === 'Escape') {
      const modals = $$('.voile-modal');
      if (modals.length) { modals.at(-1)._modal.fermer(); return; }
      if ($('.menu')) { fermerMenus(); return; }
      if (V.choixIncompat) { finirChoixIncompat(); return; }
      if (document.activeElement?.id === 'recherche' && V.recherche) { $('#recherche').value = ''; V.recherche = ''; rendre(); return; }
      if (V.selection.size) { V.selection.clear(); rendre(); return; }
      if (V.surbrillance) { V.surbrillance = null; rendre(); return; }
      if (V.inspecte) { V.inspecte = null; rendre(); return; }
      return;
    }
    const dansChamp = ev.target.closest?.('input, textarea, select, [contenteditable]');
    if (mod && ev.key.toLowerCase() === 'f') { ev.preventDefault(); $('#recherche').focus(); $('#recherche').select(); return; }
    if (dansChamp || $('.voile-modal')) return;
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) retablir(); else annuler(); }
    else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); retablir(); }
  });
  if (natif) {
    natif.surFermeture(async () => {
      try { await Stockage.envoyer(); } finally { natif.fermer(); }
    });
    natif.surMenu(commandeMenu);
  }
}

// Commandes du menu de l'application.
function commandeMenu(c) {
  const dansTexte = document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]), textarea');
  if (c === 'annuler' || c === 'retablir') {
    if (dansTexte) document.execCommand(c === 'annuler' ? 'undo' : 'redo');
    else if (!$('.voile-modal')) (c === 'annuler' ? annuler : retablir)();
    return;
  }
  if (c.startsWith('niveau-')) { V.niveau = c.slice(7); sauverVue(); rendre(); return; }
  if ($('.voile-modal') && c !== 'aide') return;
  const actions = {
    importer: () => $('#fichier-csv').click(),
    'exporter-csv': exporterClasses,
    'copie-projet': copieProjet,
    'ouvrir-projet': () => $('#fichier-projet').click(),
    'nouveau-projet': nouveauProjet,
    rechercher: () => { $('#recherche').focus(); $('#recherche').select(); },
    aide: () => { if (!$('.voile-modal')) ouvrirAide(); },
  };
  actions[c]?.();
}

// ---------------------------------------------------------------- démarrage
async function demarrer() {
  initEvenements();
  initDragDrop();
  initInspecteur();
  document.body.classList.toggle('mac', natif?.plateforme === 'darwin');
  const charge = await Stockage.charger();
  if (charge) P = charge;
  else { P = M.projetParDefaut(); P.titre = `Rentrée ${new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear()}`; Stockage.planifier(); }
  if (!NIVEAUX.includes(V.niveau) && V.niveau !== 'tous') V.niveau = 'tous';
  etatSauvegarde('ok');
  rendre();
}

demarrer();

// Accès pour le débogage depuis la console du navigateur.
window.formationClasses = { get projet() { return P; }, analyser: () => M.analyser(P) };
