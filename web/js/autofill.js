// Remplissage automatique : placement glouton puis recuit simulé (déplacements et échanges).
// Contraintes strictes : niveau, capacité, tags/options interdits, exclusifs, réservés.
// Contraintes pondérées : incompatibilités (très forte), règles de tags, filles/garçons, effectifs.
import { contexte, problemesPlacement, classesConcernees, indexItems, itemsEleve } from './model.js';

const PENALITE_INCOMPAT = 1000;

export function remplirAuto(projet, { niveaux, mode = 'tout', poids = { genre: 3, tags: 3, effectif: 2 }, essais = 4, alea = Math.random } = {}) {
  const res = { affectations: {}, nonPlaces: [], parNiveau: {} };
  for (const niv of niveaux) {
    const r = remplirNiveau(projet, niv, mode, poids, essais, alea);
    Object.assign(res.affectations, r.affectations);
    res.nonPlaces.push(...r.nonPlaces);
    res.parNiveau[niv] = r.stats;
  }
  return res;
}

function remplirNiveau(projet, niv, mode, poids, essais, alea) {
  const idx = indexItems(projet);
  const ctx = contexte(projet, niv);
  const K = ctx.classes;
  const k = K.length;
  const eleves = projet.eleves.filter(e => e.niveau === niv);
  const cIndex = new Map(K.map((c, i) => [c.id, i]));
  const estFixe = e => cIndex.has(e.classe) && (mode === 'completer' || e.verrou);

  if (!k) {
    return {
      affectations: {},
      nonPlaces: eleves.filter(e => !estFixe(e)).map(e => ({ id: e.id, raison: `aucune classe en ${niv}` })),
      stats: { places: 0, nonPlaces: eleves.length, incompatibilites: 0 },
    };
  }

  const items = [...projet.tags, ...projet.options].map(x => x.id);
  const iIndex = new Map(items.map((id, i) => [id, i]));
  const m = items.length;
  const S = eleves.length;
  const sItems = eleves.map(e => itemsEleve(e).map(id => iIndex.get(id)).filter(i => i !== undefined));
  const genre = eleves.map(e => (e.genre === 'F' ? 1 : e.genre === 'G' ? 2 : 0));
  const fixe = eleves.map(estFixe);
  const cap = K.map(c => Math.max(0, Math.floor(+c.capacite || 0)));

  const raisons = [];
  const elig = eleves.map((e, s) => {
    const ok = [];
    let premiere = null;
    K.forEach((c, ci) => {
      const pb = problemesPlacement(projet, e, c, ctx, idx);
      if (!pb.length) ok.push(ci); else if (!premiere) premiere = `${c.nom} : ${pb[0]}`;
    });
    raisons[s] = premiere;
    return ok;
  });
  const eligMasque = elig.map(l => { const a = new Uint8Array(k); for (const ci of l) a[ci] = 1; return a; });

  const sIdx = new Map(eleves.map((e, i) => [e.id, i]));
  const incomp = eleves.map(() => []);
  for (const inc of projet.incompatibilites) {
    const a = sIdx.get(inc.a), b = sIdx.get(inc.b);
    if (a !== undefined && b !== undefined && a !== b) { incomp[a].push(b); incomp[b].push(a); }
  }

  // Effectifs visés : classes réservées = élèves éligibles, les autres au prorata de la capacité.
  const reservee = K.map(c => Object.values(c.modes || {}).includes('reserve'));
  const tgtN = new Float64Array(k);
  let reste = S;
  K.forEach((c, ci) => {
    if (reservee[ci]) {
      const n = eleves.filter((e, s) => eligMasque[s][ci]).length;
      tgtN[ci] = Math.min(cap[ci], n);
      reste -= tgtN[ci];
    }
  });
  const capLibre = K.reduce((a, c, ci) => a + (reservee[ci] ? 0 : cap[ci]), 0) || 1;
  K.forEach((c, ci) => { if (!reservee[ci]) tgtN[ci] = Math.min(cap[ci], Math.max(0, reste) * cap[ci] / capLibre); });

  let nF = 0, nG = 0;
  for (const g of genre) { if (g === 1) nF++; else if (g === 2) nG++; }
  const pF = nF + nG ? nF / (nF + nG) : 0.5;

  const W = { g: +poids.genre || 0, t: (+poids.tags || 0) * 3, e: +poids.effectif || 0 };

  const regles = [];
  for (const r of projet.regles) {
    const ia = iIndex.get(r.a);
    if (ia === undefined) continue;
    const ib = r.b !== undefined ? iIndex.get(r.b) : undefined;
    if ((r.type === 'equilibrer' || r.type === 'compenser') && ib === undefined) continue;
    const T = sItems.reduce((a, l) => a + (l.includes(ia) ? 1 : 0), 0);
    const R = { type: r.type, ia, ib, tol: +r.tol || 0, n: +r.n || 0, T, att: null };
    if (r.type === 'repartir') {
      const E = new Set(classesConcernees(ctx, r.a).map(c => cIndex.get(c.id)));
      const somme = [...E].reduce((a, ci) => a + tgtN[ci], 0);
      R.att = new Float64Array(k).fill(NaN);
      if (somme > 0) for (const ci of E) R.att[ci] = T * tgtN[ci] / somme;
    }
    if (T > 0) regles.push(R);
  }

  const n = new Int32Array(k), F = new Int32Array(k), G = new Int32Array(k), cnt = new Int32Array(k * m);
  let assign = new Int32Array(S).fill(-1);

  const ajouter = (s, ci, sg) => {
    n[ci] += sg;
    if (genre[s] === 1) F[ci] += sg; else if (genre[s] === 2) G[ci] += sg;
    const base = ci * m;
    for (const it of sItems[s]) cnt[base + it] += sg;
  };
  const partenaires = (s, ci) => { let p = 0; for (const t of incomp[s]) if (assign[t] === ci) p++; return p; };

  const cout = ci => {
    let c = 0;
    const d = n[ci] - tgtN[ci];
    c += W.e * d * d;
    const fg = F[ci] + G[ci];
    if (fg) { const dg = F[ci] - fg * pF; c += W.g * dg * dg; }
    const base = ci * m;
    for (const r of regles) {
      const a = cnt[base + r.ia];
      switch (r.type) {
        case 'repartir': { const at = r.att[ci]; if (at === at) { const x = a - at; c += W.t * x * x; } break; }
        case 'equilibrer': { const x = Math.abs(a - cnt[base + r.ib]) - r.tol; if (x > 0) c += W.t * x * x; break; }
        case 'compenser': { const x = a - cnt[base + r.ib]; if (x > 0) c += 2 * W.t * x * x; break; }
        case 'max': { const x = a - r.n; if (x > 0) c += 50 * x * x; break; }
        case 'regrouper': if (r.T > 1) c += 2 * Math.max(W.t, 3) * a * (r.T - a) / r.T; break;
      }
    }
    return c;
  };

  const mobilesTous = [];
  for (let s = 0; s < S; s++) if (!fixe[s]) mobilesTous.push(s);

  const melanger = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const poidsEleve = s => sItems[s].reduce((a, it) => a + (regles.some(r => r.ia === it || r.ib === it) ? 1 : 0), 0);

  function essai() {
    n.fill(0); F.fill(0); G.fill(0); cnt.fill(0); assign.fill(-1);
    eleves.forEach((e, s) => { if (fixe[s]) { assign[s] = cIndex.get(e.classe); ajouter(s, assign[s], 1); } });
    const cc = new Float64Array(k);
    for (let ci = 0; ci < k; ci++) cc[ci] = cout(ci);

    // 1. Placement glouton, élèves les plus contraints d'abord.
    const ordre = melanger(mobilesTous.slice()).sort((a, b) =>
      elig[a].length - elig[b].length || poidsEleve(b) - poidsEleve(a) || incomp[b].length - incomp[a].length);
    const attente = [];
    for (const s of ordre) {
      let best = -1, bestD = Infinity;
      for (const ci of elig[s]) {
        if (n[ci] >= cap[ci]) continue;
        ajouter(s, ci, 1);
        const d = cout(ci) - cc[ci] + PENALITE_INCOMPAT * partenaires(s, ci) + alea() * 1e-3;
        ajouter(s, ci, -1);
        if (d < bestD) { bestD = d; best = ci; }
      }
      if (best < 0) { attente.push(s); continue; }
      ajouter(s, best, 1); assign[s] = best; cc[best] = cout(best);
    }
    // 2. Libérer une place pour les élèves restés sans classe.
    for (const s of attente) {
      let fait = false;
      for (const ci of elig[s]) {
        if (fait) break;
        if (n[ci] < cap[ci]) { ajouter(s, ci, 1); assign[s] = ci; cc[ci] = cout(ci); fait = true; break; }
        for (const t of mobilesTous) {
          if (assign[t] !== ci) continue;
          const cj = elig[t].find(x => x !== ci && n[x] < cap[x]);
          if (cj === undefined) continue;
          ajouter(t, ci, -1); ajouter(t, cj, 1); assign[t] = cj;
          ajouter(s, ci, 1); assign[s] = ci;
          cc[ci] = cout(ci); cc[cj] = cout(cj); fait = true; break;
        }
      }
    }

    // 3. Recuit simulé.
    const mobiles = mobilesTous.filter(s => assign[s] >= 0);
    let total = 0;
    for (let ci = 0; ci < k; ci++) total += cc[ci];
    let inc = 0;
    for (let s = 0; s < S; s++) if (assign[s] >= 0) inc += partenaires(s, assign[s]);
    total += PENALITE_INCOMPAT * inc / 2;
    let meilleur = total, meilleurAssign = assign.slice();
    if (mobiles.length && k > 1) {
      const iters = Math.min(90000, Math.max(8000, mobiles.length * k * 60));
      const T0 = 0.6 * (W.t + W.g + W.e) + 0.5, T1 = 0.005;
      const alpha = Math.pow(T1 / T0, 1 / iters);
      let T = T0;
      for (let it = 0; it < iters; it++, T *= alpha) {
        const s = mobiles[Math.floor(alea() * mobiles.length)];
        const c1 = assign[s];
        if (alea() < 0.45) {
          const c2 = elig[s][Math.floor(alea() * elig[s].length)];
          if (c2 === c1 || n[c2] >= cap[c2]) continue;
          const avant = cc[c1] + cc[c2];
          const dInc = partenaires(s, c2) - partenaires(s, c1);
          ajouter(s, c1, -1); ajouter(s, c2, 1);
          const a1 = cout(c1), a2 = cout(c2);
          const delta = a1 + a2 - avant + PENALITE_INCOMPAT * dInc;
          if (delta <= 0 || alea() < Math.exp(-delta / T)) { assign[s] = c2; cc[c1] = a1; cc[c2] = a2; total += delta; }
          else { ajouter(s, c2, -1); ajouter(s, c1, 1); }
        } else {
          const t = mobiles[Math.floor(alea() * mobiles.length)];
          const c2 = assign[t];
          if (c2 === c1 || !eligMasque[s][c2] || !eligMasque[t][c1]) continue;
          const avant = cc[c1] + cc[c2];
          let dInc = partenaires(s, c2) - partenaires(s, c1);
          assign[s] = c2;
          dInc += partenaires(t, c1) - partenaires(t, c2);
          assign[t] = c1;
          ajouter(s, c1, -1); ajouter(t, c2, -1); ajouter(s, c2, 1); ajouter(t, c1, 1);
          const a1 = cout(c1), a2 = cout(c2);
          const delta = a1 + a2 - avant + PENALITE_INCOMPAT * dInc;
          if (delta <= 0 || alea() < Math.exp(-delta / T)) { cc[c1] = a1; cc[c2] = a2; total += delta; }
          else {
            ajouter(s, c2, -1); ajouter(t, c1, -1); ajouter(s, c1, 1); ajouter(t, c2, 1);
            assign[s] = c1; assign[t] = c2;
          }
        }
        if (total < meilleur - 1e-9) { meilleur = total; meilleurAssign = assign.slice(); }
      }
    }
    return { cout: meilleur, assign: meilleurAssign };
  }

  let best = null;
  for (let i = 0; i < Math.max(1, essais); i++) {
    const r = essai();
    if (!best || r.cout < best.cout) best = r;
  }

  assign = best.assign;
  const affectations = {};
  const nonPlaces = [];
  let incompat = 0;
  for (let s = 0; s < S; s++) {
    if (fixe[s]) continue;
    const ci = assign[s];
    affectations[eleves[s].id] = ci >= 0 ? K[ci].id : null;
    if (ci < 0) {
      nonPlaces.push({ id: eleves[s].id, raison: elig[s].length ? 'toutes les classes compatibles sont pleines' : `aucune classe compatible (${raisons[s]})` });
    }
  }
  for (let s = 0; s < S; s++) if (assign[s] >= 0) incompat += partenaires(s, assign[s]);
  return {
    affectations,
    nonPlaces,
    stats: { places: Object.values(affectations).filter(Boolean).length, nonPlaces: nonPlaces.length, incompatibilites: incompat / 2, cout: best.cout },
  };
}
