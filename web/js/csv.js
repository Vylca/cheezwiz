// Lecture des fichiers CSV (Pronote, SIECLE, Excel, LibreOffice...) et conversion en élèves.
import { norm, uid, abreviation, COULEURS, NIVEAUX } from './model.js';

export function decoder(buffer) {
  const b = new Uint8Array(buffer);
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return { texte: new TextDecoder('utf-8').decode(b.subarray(3)), encodage: 'UTF-8' };
  if (b[0] === 0xFF && b[1] === 0xFE) return { texte: new TextDecoder('utf-16le').decode(b.subarray(2)), encodage: 'UTF-16' };
  if (b[0] === 0xFE && b[1] === 0xFF) return { texte: new TextDecoder('utf-16be').decode(b.subarray(2)), encodage: 'UTF-16' };
  try {
    return { texte: new TextDecoder('utf-8', { fatal: true }).decode(b), encodage: 'UTF-8' };
  } catch {
    return { texte: new TextDecoder('windows-1252').decode(b), encodage: 'Windows-1252' };
  }
}

export function detecterSeparateur(texte) {
  const lignes = texte.split(/\r\n|\n|\r/).filter(l => l.trim()).slice(0, 10);
  let meilleur = ';', score = -1;
  for (const sep of [';', ',', '\t', '|']) {
    const comptes = lignes.map(l => {
      let n = 0, q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) n++; }
      return n;
    });
    if (!comptes.length || !comptes[0]) continue;
    const constants = comptes.filter(n => n === comptes[0]).length;
    const s = constants * 100 + comptes[0];
    if (s > score) { score = s; meilleur = sep; }
  }
  return meilleur;
}

export function parserCSV(texte, sep = detecterSeparateur(texte)) {
  const lignes = [];
  let ligne = [], champ = '', q = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (q) {
      if (ch === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; } else q = false;
      } else champ += ch;
    } else if (ch === '"' && champ.trim() === '') { q = true; champ = ''; }
    else if (ch === sep) { ligne.push(champ); champ = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ); lignes.push(ligne); ligne = []; champ = '';
    } else champ += ch;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.map(l => l.map(c => c.trim())).filter(l => l.some(c => c !== ''));
}

// Codes de correspondance des colonnes :
// ignorer | nom | prenom | nomcomplet | genre | origine | options | tags | tagsi:<nom> | prop:<nom>
export function devinerColonnes(entetes, projet) {
  const tagsParNom = new Map(projet.tags.map(t => [norm(t.nom), t]));
  const deja = new Set();
  return entetes.map(h => {
    const n = norm(h);
    let code = 'ignorer';
    if (/^(nom|nom de famille|nom d'usage|nom d’usage|nom eleve|nom de l'eleve|nom_eleve|nom usage)$/.test(n)) code = 'nom';
    else if (/^(prenom|prenoms|prenom eleve|prenom_eleve|premier prenom|prenom 1)$/.test(n)) code = 'prenom';
    else if (/^(eleve|eleves|nom prenom|nom et prenom|nom - prenom|identite|nom complet)$/.test(n)) code = 'nomcomplet';
    else if (/^(sexe|genre|sexe eleve|f\/g|f\/m|g\/f|m\/f)$/.test(n)) code = 'genre';
    else if (/^(classe|division|classe d'origine|classe d’origine|classe origine|div|classe actuelle|classe \d{4}.*)$/.test(n)) code = 'origine';
    else if (/(lv2|langue vivante 2|^option|^options|^langue|^lv b|^lvb)/.test(n)) code = 'options';
    else if (/^(tags?|profil|profils|etiquettes?|remarques? profil)$/.test(n)) code = 'tags';
    else if (tagsParNom.has(n)) code = 'tagsi:' + h;
    if (['nom', 'prenom', 'nomcomplet', 'genre', 'origine'].includes(code)) {
      if (deja.has(code)) code = 'ignorer';
      deja.add(code);
    }
    return code;
  });
}

export function devinerNiveau(valeursOrigine) {
  const votes = {};
  for (const v of valeursOrigine) {
    const n = norm(v).replace(/\s/g, '');
    let niv = null;
    if (/^cm2/.test(n) || /^cm1-?cm2/.test(n)) niv = '6e';
    else if (/^6/.test(n)) niv = '5e';
    else if (/^5/.test(n)) niv = '4e';
    else if (/^4/.test(n)) niv = '3e';
    if (niv) votes[niv] = (votes[niv] || 0) + 1;
  }
  let best = null, max = 0;
  for (const [k, n] of Object.entries(votes)) if (n > max) { max = n; best = k; }
  return best;
}

export function lireGenre(v) {
  const n = norm(v);
  if (!n) return '';
  if (n === '2' || n === 'f' || n.startsWith('fem') || n.startsWith('fille') || n === 'feminin') return 'F';
  if (n === '1' || n === 'm' || n === 'g' || n.startsWith('mas') || n.startsWith('garc') || n.startsWith('homme')) return 'G';
  return '';
}

export function separerNomComplet(v) {
  const mots = v.trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { nom: v.trim(), prenom: '' };
  const estMaj = m => /\p{L}/u.test(m) && m === m.toUpperCase();
  const maj = mots.filter(estMaj);
  if (maj.length && maj.length < mots.length) {
    return { nom: maj.join(' '), prenom: mots.filter(m => !estMaj(m)).join(' ') };
  }
  return { nom: mots[0], prenom: mots.slice(1).join(' ') };
}

const VRAI = v => {
  const n = norm(v);
  return n !== '' && !['0', 'non', 'n', 'false', 'faux', '-', 'x0', 'no'].includes(n);
};

function trouverItem(liste, valeur) {
  const n = norm(valeur);
  if (!n) return null;
  return liste.find(x => norm(x.nom) === n || norm(x.abr) === n)
    || liste.find(x => n.includes(norm(x.nom)))
    || liste.find(x => n.length >= 3 && norm(x.nom).startsWith(n))
    || liste.find(x => n.split(/[\s_-]+/).includes(norm(x.abr)))
    || null;
}

// Construit les élèves d'un fichier. Ne modifie pas le projet : renvoie aussi les tags,
// options et propriétés à créer.
export function construireEleves(lignes, codes, entetes, niveau, projet) {
  const tags = [...projet.tags], options = [...projet.options], proprietes = [...projet.proprietes];
  const nouveauxTags = [], nouvellesOptions = [], nouvellesProps = [];
  let couleur = tags.length + options.length;
  const creer = (liste, nouveaux, nom, prefixe) => {
    const x = { id: uid(prefixe), nom: nom.trim(), abr: abreviation(nom), couleur: COULEURS[couleur++ % COULEURS.length] };
    liste.push(x); nouveaux.push(x); return x;
  };
  const decouper = v => v.split(/[,;/|+]/).map(s => s.trim()).filter(Boolean);
  const eleves = [];
  for (const l of lignes) {
    const e = { id: uid('e_'), nom: '', prenom: '', genre: '', niveau, origine: '', tags: [], options: [], props: {}, notes: '', classe: null, verrou: false };
    codes.forEach((code, i) => {
      const v = (l[i] ?? '').trim();
      if (code === 'nom') e.nom = v;
      else if (code === 'prenom') e.prenom = v;
      else if (code === 'nomcomplet') Object.assign(e, separerNomComplet(v));
      else if (code === 'genre') e.genre = lireGenre(v);
      else if (code === 'origine') e.origine = v;
      else if (code === 'options') {
        for (const part of decouper(v)) {
          const o = trouverItem(options, part) || creer(options, nouvellesOptions, part, 'o_');
          if (!e.options.includes(o.id)) e.options.push(o.id);
        }
      } else if (code === 'tags') {
        for (const part of decouper(v)) {
          const t = trouverItem(tags, part) || creer(tags, nouveauxTags, part, 't_');
          if (!e.tags.includes(t.id)) e.tags.push(t.id);
        }
      } else if (code.startsWith('tagsi:') && VRAI(v)) {
        const nom = code.slice(6);
        const t = tags.find(x => norm(x.nom) === norm(nom)) || creer(tags, nouveauxTags, nom, 't_');
        if (!e.tags.includes(t.id)) e.tags.push(t.id);
      } else if (code.startsWith('prop:') && v !== '') {
        const nom = code.slice(5);
        let pr = proprietes.find(x => norm(x.nom) === norm(nom));
        if (!pr) { pr = { id: uid('p_'), nom, type: 'texte', valeurs: [], surCarte: false }; proprietes.push(pr); nouvellesProps.push(pr); }
        e.props[pr.id] = pr.type === 'nombre' ? (parseFloat(v.replace(',', '.')) || 0) : pr.type === 'booleen' ? VRAI(v) : v;
      }
    });
    if (!e.nom && !e.prenom) continue;
    eleves.push(e);
  }
  // Une propriété nouvelle dont toutes les valeurs sont numériques devient « nombre ».
  for (const pr of nouvellesProps) {
    const vals = eleves.map(e => e.props[pr.id]).filter(v => v !== undefined);
    if (vals.length && vals.every(v => /^-?\d+([.,]\d+)?$/.test(v))) {
      pr.type = 'nombre';
      for (const e of eleves) if (e.props[pr.id] !== undefined) e.props[pr.id] = parseFloat(String(e.props[pr.id]).replace(',', '.'));
    }
  }
  return { eleves, nouveauxTags, nouvellesOptions, nouvellesProps };
}

export function cleDoublon(e) {
  return `${norm(e.nom)}|${norm(e.prenom)}|${e.niveau}`;
}

export { NIVEAUX };
