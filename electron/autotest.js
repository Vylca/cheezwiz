// Scénario d'autotest exécuté dans la fenêtre (voir autotest() dans main.cjs).
// Il passe par l'interface réelle : dépôt d'un fichier CSV, fenêtres, boutons, glisser-déposer.
window.__autotest = (() => {
  const $ = s => document.querySelector(s);
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const attendre = async (sel, ms = 15000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) { const el = $(sel); if (el) return el; await pause(50); }
    throw new Error(`élément introuvable : ${sel}`);
  };
  const saisir = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const etat = () => {
    const p = window.formationClasses.projet, a = window.formationClasses.analyser();
    return { eleves: p.eleves.length, places: p.eleves.filter(e => e.classe).length, classes: p.classes.length, erreurs: a.nbErreurs, attentions: a.nbAttentions };
  };
  const glisser = (source, cible, options = {}) => {
    const dt = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
    cible.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true, ...options }));
    cible.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, ...options }));
    source.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
  };
  return {
    async importer(base64) {
      await attendre('#tableau');
      const octets = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([octets], 'eleves.csv', { type: 'text/csv' }));
      $('#tableau').dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      $('#tableau').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      (await attendre('#imp-ok')).click();
      await attendre('#ac-ok');
      saisir($('#ac-nombre'), '4');
      saisir($('#ac-cap'), '30');
      $('#ac-ok').click();
      await pause(600);
      return etat();
    },
    async remplir() {
      (await attendre('#actions button[data-action=auto]')).click();
      (await attendre('#au-ok')).click();
      await attendre('#au-annuler', 60000);
      $('.modal footer button[data-fermer]').click();
      await pause(600);
      return etat();
    },
    async glisser() {
      const carte = await attendre('.colonne.classe .carte');
      const id = carte.dataset.eleve;
      const destination = [...document.querySelectorAll('.colonne.classe')].find(c => !c.contains(carte));
      glisser(carte, destination.querySelector('.col-liste'));
      await pause(600);
      const e = window.formationClasses.projet.eleves.find(x => x.id === id);
      if (e.classe !== destination.dataset.classe) throw new Error('le glisser-déposer n’a pas déplacé l’élève');
      return etat();
    },
  };
})();
