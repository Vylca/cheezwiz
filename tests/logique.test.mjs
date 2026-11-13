import assert from 'node:assert/strict';
import { projetParDefaut, analyser, uid, problemesPlacement, contexte, exporterCSV, normaliser } from '../web/js/model.js';
import { remplirAuto } from '../web/js/autofill.js';
import { parserCSV, detecterSeparateur, decoder, devinerColonnes, construireEleves, devinerNiveau, separerNomComplet, lireGenre } from '../web/js/csv.js';

let graine = 42;
const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };

// --- CSV ---
{
  const t = 'Nom;Prénom;Sexe;Classe;LV2\n"DUPONT";Marie;2;CM2 A;Espagnol\nMARTIN;"Jean ""Jo""";1;CM2 B;ALL\r\nDURAND;Léa;F;CM2 A;Italien LV2\n';
  assert.equal(detecterSeparateur(t), ';');
  const l = parserCSV(t);
  assert.equal(l.length, 4);
  assert.equal(l[2][1], 'Jean "Jo"');
  const p = projetParDefaut();
  const codes = devinerColonnes(l[0], p);
  assert.deepEqual(codes, ['nom', 'prenom', 'genre', 'origine', 'options']);
  assert.equal(devinerNiveau(l.slice(1).map(r => r[3])), '6e');
  const r = construireEleves(l.slice(1), codes, l[0], '6e', p);
  assert.equal(r.eleves.length, 3);
  assert.equal(r.eleves[0].genre, 'F');
  assert.equal(r.eleves[1].genre, 'G');
  assert.deepEqual(r.eleves[0].options, ['o_espagnol']);
  assert.deepEqual(r.eleves[1].options, ['o_allemand']);
  assert.deepEqual(r.eleves[2].options, ['o_italien']);
  assert.equal(r.nouvellesOptions.length, 0);
  assert.deepEqual(separerNomComplet('DE LA FONTAINE Jean-Pierre'), { nom: 'DE LA FONTAINE', prenom: 'Jean-Pierre' });
  assert.equal(lireGenre('Masculin'), 'G');
  const latin1 = new Uint8Array([0x4e, 0x6f, 0x6d, 0x3b, 0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d]); // "Nom;Prénom" en Windows-1252
  assert.equal(decoder(latin1.buffer).texte, 'Nom;Prénom');
  // Colonne « ULIS » remplie => tag, colonne inconnue => propriété
  const t2 = 'Élève,ULIS,Moyenne\nBERNARD Paul,X,12.5\nPETIT Zoé,,9\n';
  const l2 = parserCSV(t2);
  const c2 = devinerColonnes(l2[0], p);
  assert.deepEqual(c2, ['nomcomplet', 'tagsi:ULIS', 'ignorer']);
  c2[2] = 'prop:Moyenne';
  const r2 = construireEleves(l2.slice(1), c2, l2[0], '5e', p);
  assert.deepEqual(r2.eleves[0].tags, ['t_ulis']);
  assert.deepEqual(r2.eleves[1].tags, []);
  assert.equal(r2.nouvellesProps[0].type, 'nombre');
  assert.equal(r2.eleves[0].props[r2.nouvellesProps[0].id], 12.5);
  console.log('CSV : OK');
}

// --- Projet synthétique ---
function projetTest() {
  const p = projetParDefaut();
  const tags = p.tags.map(t => t.id);
  for (let i = 0; i < 150; i++) {
    const e = { id: `e${i}`, nom: `NOM${i}`, prenom: `P${i}`, genre: alea() < 0.48 ? 'F' : 'G', niveau: '6e', origine: '', tags: [], options: [], props: {}, notes: '', classe: null, verrou: false };
    const r = alea();
    if (r < 0.1) e.tags.push('t_tete'); else if (r < 0.25) e.tags.push('t_moteur'); else if (r < 0.37) e.tags.push('t_perturbateur'); else if (r < 0.45) e.tags.push('t_decrocheur');
    if (i < 12) { e.tags = ['t_segpa']; }
    else if (i < 16) e.tags.push('t_ulis');
    const lv = alea();
    e.options.push(i >= 12 && lv < 0.12 ? 'o_italien' : lv < 0.4 ? 'o_allemand' : 'o_espagnol');
    p.eleves.push(e);
  }
  for (let c = 1; c <= 6; c++) p.classes.push({ id: `c${c}`, nom: `6e${c}`, niveau: '6e', capacite: c === 6 ? 16 : 28, modes: {} });
  p.classes[1].modes.o_italien = 'exclusif';
  p.classes[5].modes.t_segpa = 'reserve';
  p.classes[0].modes.t_ulis = 'interdit';
  p.regles.push({ id: uid(), type: 'regrouper', a: 't_ulis' });
  for (let i = 0; i < 25; i++) {
    const a = 12 + Math.floor(alea() * 138), b = 12 + Math.floor(alea() * 138);
    if (a !== b) p.incompatibilites.push({ id: uid(), a: `e${a}`, b: `e${b}`, motif: '' });
  }
  return p;
}

{
  const p = projetTest();
  const t0 = Date.now();
  const r = remplirAuto(p, { niveaux: ['6e'], mode: 'tout', alea });
  const duree = Date.now() - t0;
  for (const [id, c] of Object.entries(r.affectations)) p.eleves.find(e => e.id === id).classe = c;
  const a = analyser(p);
  const erreurs = Object.entries(a.classes).flatMap(([id, c]) => c.alertes.filter(x => x.niv === 'erreur').map(x => `${id}: ${x.msg}`));
  const attentions = Object.entries(a.classes).flatMap(([id, c]) => c.alertes.filter(x => x.niv === 'attention').map(x => `${id}: ${x.msg}`));
  console.log(`Remplissage : ${duree} ms, placés ${r.parNiveau['6e'].places}, non placés ${r.nonPlaces.length}`);
  for (const c of p.classes) {
    const s = a.classes[c.id];
    console.log(`  ${c.nom} n=${s.n}/${c.capacite} F=${s.F} G=${s.G}`, Object.entries(s.items).map(([k, v]) => `${k.slice(2, 6)}:${v}`).join(' '));
  }
  console.log('  erreurs :', erreurs.length ? erreurs : 'aucune');
  console.log('  attentions :', attentions.length ? attentions : 'aucune');
  {
    const it = p.eleves.filter(e => e.options.includes('o_italien'));
    const aut = p.eleves.filter(e => e.classe === 'c2' && !e.options.includes('o_italien'));
    console.log('  italiens :', it.length, 'dont perturbateurs', it.filter(e => e.tags.includes('t_perturbateur')).length,
      '/ autres élèves en 6e2 :', aut.map(e => e.tags.join('+') || '-').join(' '));
  }
  assert.equal(erreurs.length, 0);
  assert.equal(r.nonPlaces.length, 0);
  // Segpa tous dans la classe réservée, Italien tous en 6e2, ULIS regroupés
  assert.ok(p.eleves.filter(e => e.tags.includes('t_segpa')).every(e => e.classe === 'c6'));
  assert.ok(p.eleves.filter(e => e.classe === 'c6').every(e => e.tags.includes('t_segpa')));
  assert.ok(p.eleves.filter(e => e.options.includes('o_italien')).every(e => e.classe === 'c2'));
  assert.equal(new Set(p.eleves.filter(e => e.tags.includes('t_ulis')).map(e => e.classe)).size, 1);
  assert.ok(attentions.length <= 4, 'trop de déséquilibres');

  // Mode « compléter » : les élèves placés ne bougent pas
  const avant = new Map(p.eleves.map(e => [e.id, e.classe]));
  const nouveau = { id: 'nv', nom: 'NOUVEAU', prenom: 'X', genre: 'F', niveau: '6e', origine: '', tags: ['t_perturbateur'], options: ['o_espagnol'], props: {}, notes: '', classe: null, verrou: false };
  p.eleves.push(nouveau);
  const r2 = remplirAuto(p, { niveaux: ['6e'], mode: 'completer', alea });
  assert.deepEqual(Object.keys(r2.affectations), ['nv']);
  assert.ok(r2.affectations.nv);
  for (const [id, c] of avant) assert.equal(p.eleves.find(e => e.id === id).classe, c);

  // Verrou respecté en mode « tout »
  const e5 = p.eleves.find(e => e.id === 'e40');
  e5.verrou = true;
  const classeE5 = e5.classe;
  const r3 = remplirAuto(p, { niveaux: ['6e'], mode: 'tout', alea });
  assert.ok(!('e40' in r3.affectations));
  assert.equal(e5.classe, classeE5);

  // Contraintes de placement
  const ctx = contexte(p, '6e');
  const ita = p.eleves.find(e => e.options.includes('o_italien'));
  assert.ok(problemesPlacement(p, ita, p.classes[0], ctx).length > 0);
  assert.equal(problemesPlacement(p, ita, p.classes[1], ctx).length, 0);

  // Export
  const csv = exporterCSV(p);
  assert.ok(csv.startsWith('﻿Niveau;Classe;Nom'));
  assert.equal(csv.trim().split('\r\n').length, p.eleves.length + 1);
  console.log('Remplissage, contraintes, export : OK');
}

// Capacité insuffisante et incompatibilité impossible
{
  const p = projetParDefaut();
  for (let i = 0; i < 30; i++) p.eleves.push({ id: `e${i}`, nom: `N${i}`, prenom: '', genre: i % 2 ? 'F' : 'G', niveau: '5e', origine: '', tags: [], options: [], props: {}, notes: '', classe: null, verrou: false });
  p.classes.push({ id: 'a', nom: '5e1', niveau: '5e', capacite: 14, modes: {} }, { id: 'b', nom: '5e2', niveau: '5e', capacite: 14, modes: {} });
  const r = remplirAuto(p, { niveaux: ['5e'], alea });
  assert.equal(r.nonPlaces.length, 2);
  assert.match(r.nonPlaces[0].raison, /pleines/);
  const an = (() => { for (const [id, c] of Object.entries(r.affectations)) p.eleves.find(e => e.id === id).classe = c; return analyser(p); })();
  assert.ok(an.niveaux['5e'].alertes.some(a => a.niv === 'erreur'));
  console.log('Capacité : OK');
}

// normaliser
{
  const p = normaliser({ eleves: [{ nom: 'A', classe: 'inexistante' }] });
  assert.equal(p.eleves[0].classe, null);
  assert.equal(p.tags.length, 6);
  console.log('Normalisation : OK');
}
