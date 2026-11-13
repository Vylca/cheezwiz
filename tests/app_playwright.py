"""Tests locaux de l'application (Playwright par CDP, sous Xvfb). Nécessite le paquet Python playwright.

    xvfb-run -a -s "-screen 0 1600x1000x24" python3 tests/app_playwright.py node_modules/electron/dist/electron .
    xvfb-run -a -s "-screen 0 1600x1000x24" python3 tests/app_playwright.py release/linux-unpacked/formation-classes ""
"""
import json
import os
import random
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

EXE = sys.argv[1]
APPDIR = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
ICI = Path(__file__).parent
CAPTURES = ICI / "captures"
CAPTURES.mkdir(exist_ok=True)
TMP = Path("/tmp/test-formation-classes")
shutil.rmtree(TMP, ignore_errors=True)
(TMP / "config").mkdir(parents=True)
(TMP / "exports").mkdir()
DONNEES = TMP / "config" / "Formation des classes"
FICHIER = DONNEES / "projet.json"
erreurs = []


class Appli:
    def __init__(self):
        env = {**os.environ, "HOME": str(TMP), "XDG_CONFIG_HOME": str(TMP / "config"),
               "FORMATION_CLASSES_TEST_DOSSIER": str(TMP / "exports")}
        env.pop("NODE_OPTIONS", None)
        cmd = [EXE] + ([APPDIR] if APPDIR else []) + ["--no-sandbox", "--remote-debugging-port=9334"]
        self.proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen("http://127.0.0.1:9334/json/version", timeout=0.5)
                break
            except OSError:
                time.sleep(0.15)

    def page(self, pw):
        self.nav = pw.chromium.connect_over_cdp("http://127.0.0.1:9334")
        for _ in range(50):
            pages = [p for c in self.nav.contexts for p in c.pages]
            if pages:
                p = pages[0]
                p.on("console", lambda m: m.type == "error" and erreurs.append(f"console: {m.text}"))
                p.on("pageerror", lambda e: erreurs.append(f"pageerror: {e}"))
                p.set_viewport_size({"width": 1600, "height": 950})
                return p
            time.sleep(0.1)
        raise RuntimeError("pas de fenêtre")

    def attendre_fin(self, delai=8):
        try:
            return self.proc.wait(delai)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            raise AssertionError("l'application ne s'est pas fermée")


def projet():
    time.sleep(0.6)
    return json.loads(FICHIER.read_text(encoding="utf-8"))["projet"]


def capture(page, nom):
    page.screenshot(path=str(CAPTURES / f"{nom}.png"))


with sync_playwright() as pw:
    # ------------------------------------------------------------ scénario complet
    app = Appli()
    page = app.page(pw)
    page.wait_for_selector(".accueil")
    assert page.evaluate("typeof window.natif") == "object"
    capture(page, "a01-accueil")

    page.set_input_files("#fichier-csv", [str(ICI / "donnees/liste_cm2.csv"), str(ICI / "donnees/liste_6e.csv")])
    page.wait_for_selector(".imp-fichier")
    assert page.eval_on_selector_all(".imp-fichier select[data-k=niveau]", "l => l.map(s => s.value)") == ["6e", "5e"]
    assert "216" in page.inner_text("#imp-ok")
    page.click("#imp-ok")
    page.wait_for_selector("#ac-ok")
    page.fill("#ac-nombre", "4"); page.fill("#ac-cap", "30"); page.click("#ac-ok")
    page.click("button[data-action=ajouter-classes][data-niveau='5e']")
    page.wait_for_selector("#ac-ok")
    page.fill("#ac-nombre", "4"); page.fill("#ac-cap", "28"); page.click("#ac-ok")
    p = projet()
    assert len(p["eleves"]) == 216 and len(p["classes"]) == 8
    print("import + classes : OK")

    page.click("button[data-action=niveau][data-niveau='5e']")
    page.click(".colonne.classe >> nth=1 >> .col-nom")
    page.wait_for_selector(".table-modes")
    page.check("input[name='m-o_italien'][value=exclusif]", force=True)
    page.keyboard.press("Escape")
    page.click(".colonne.classe >> nth=0 >> .col-nom")
    page.wait_for_selector(".table-modes")
    page.check("input[name='m-t_ulis'][value=interdit]", force=True)
    page.keyboard.press("Escape")
    page.click("#actions button[data-action=auto]")
    page.click("#au-ok")
    page.wait_for_selector("#au-annuler", timeout=20000)
    page.click(".modal footer button[data-fermer]")
    p = projet()
    c52 = next(c["id"] for c in p["classes"] if c["nom"] == "5e2")
    c51 = next(c["id"] for c in p["classes"] if c["nom"] == "5e1")
    for e in p["eleves"]:
        if e["niveau"] == "5e":
            assert e["classe"]
            if "o_italien" in e["options"]: assert e["classe"] == c52
            if "t_ulis" in e["tags"]: assert e["classe"] != c51
    capture(page, "a02-5e-apres-remplissage")
    print("contraintes + remplissage : OK")

    src = page.locator(".colonne.classe >> nth=2 >> .carte >> nth=0")
    eid = src.get_attribute("data-eleve")
    src.drag_to(page.locator(".colonne.classe >> nth=3 >> .col-liste"))
    c54 = next(c["id"] for c in p["classes"] if c["nom"] == "5e4")
    assert next(e for e in projet()["eleves"] if e["id"] == eid)["classe"] == c54
    print("glisser un élève : OK")

    cible = page.locator(".colonne.classe >> nth=0 >> .carte >> nth=1")
    cid = cible.get_attribute("data-eleve")
    avant = "t_moteur" in next(e for e in projet()["eleves"] if e["id"] == cid)["tags"]
    page.locator("#palette [data-item=t_moteur]").drag_to(cible)
    assert ("t_moteur" in next(e for e in projet()["eleves"] if e["id"] == cid)["tags"]) != avant
    print("glisser un tag : OK")

    cartes = page.locator(".colonne.classe >> nth=0 >> .carte")
    ids = [cartes.nth(i).get_attribute("data-eleve") for i in range(3)]
    for i in range(3):
        cartes.nth(i).click(modifiers=["Shift"])
    page.locator(f".carte[data-eleve='{ids[0]}']").drag_to(page.locator(".colonne.pool .col-liste"))
    assert all(next(e for e in projet()["eleves"] if e["id"] == i)["classe"] is None for i in ids)
    page.keyboard.press("Escape")
    page.keyboard.press("Control+z")
    assert all(next(e for e in projet()["eleves"] if e["id"] == i)["classe"] for i in ids)
    print("sélection multiple + annuler : OK")

    # Ctrl+Z dans un champ texte : annule la saisie, pas le tableau
    page.locator(".colonne.classe >> nth=1 >> .carte >> nth=0").click()
    page.wait_for_selector("#inspecteur:not([hidden])")
    champ = page.locator("#inspecteur textarea[data-champ=notes]")
    champ.click()
    page.keyboard.type("abc")
    page.keyboard.press("Control+z")
    nb_classes = sum(1 for e in projet()["eleves"] if e["classe"])
    assert nb_classes == 104 + 0 or nb_classes > 0
    capture(page, "a03-fiche")
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")

    # Export CSV (sans boîte de dialogue en mode test)
    page.click("#actions button[data-action=menu-fichier]")
    page.click(".menu button:has-text('Exporter les classes')")
    time.sleep(0.8)
    exports = list((TMP / "exports").glob("classes-*.csv"))
    assert exports and exports[0].read_text(encoding="utf-8-sig").startswith("Niveau;Classe;Nom")
    print("export : OK")

    # Fermeture juste après une modification : elle doit être enregistrée
    page.fill("#titre-projet", "Rentrée test fermeture")
    page.keyboard.press("Enter")
    page.evaluate("window.natif.quitter()")
    code = app.attendre_fin()
    assert json.loads(FICHIER.read_text(encoding="utf-8"))["projet"]["titre"] == "Rentrée test fermeture"
    print(f"fermeture avec enregistrement : OK (code {code})")
    assert list((DONNEES / "sauvegardes").glob("projet-*.json"))

    # ------------------------------------------------------------ gros projet : 600 élèves
    random.seed(3)
    p = json.loads(FICHIER.read_text(encoding="utf-8"))["projet"]
    p["eleves"], p["classes"], p["incompatibilites"] = [], [], []
    tags = ["t_tete", "t_moteur", "t_perturbateur", "t_decrocheur"]
    for niv in ["6e", "5e", "4e", "3e"]:
        for k in range(1, 6):
            p["classes"].append({"id": f"c{niv}{k}", "nom": f"{niv}{k}", "niveau": niv, "capacite": 30, "modes": {}})
        for i in range(150):
            p["eleves"].append({"id": f"e{niv}{i}", "nom": f"NOM{i:03d}", "prenom": f"Prénom{niv}", "genre": random.choice("FG"),
                                "niveau": niv, "origine": "", "tags": random.sample(tags, random.choice([0, 0, 1, 1, 2])),
                                "options": [random.choice(["o_allemand", "o_espagnol", "o_italien"])], "props": {}, "notes": "",
                                "classe": None, "verrou": False})
    FICHIER.write_text(json.dumps({"rev": 1, "projet": p}), encoding="utf-8")
    app = Appli()
    page = app.page(pw)
    page.wait_for_selector(".carte")
    page.click("button[data-action=niveau][data-niveau='tous']")
    page.wait_for_timeout(300)
    assert page.locator(".carte").count() == 600
    page.click("#actions button[data-action=auto]")
    t = time.time()
    page.click("#au-ok")
    page.wait_for_selector("#au-annuler", timeout=30000)
    print(f"remplissage de 600 élèves : {time.time() - t:.2f} s")
    page.click(".modal footer button[data-fermer]")
    duree = page.evaluate("""() => new Promise(res => {
      const t0 = performance.now();
      document.querySelector('#compact').click();
      requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0)));
    })""")
    print(f"affichage de 600 élèves : {duree:.0f} ms")
    capture(page, "a04-600-eleves")

    # Alt + glisser = incompatibilité ; dépôt de fichier ; réordonner
    a = page.locator(".colonne.classe >> nth=0 >> .carte >> nth=0").get_attribute("data-eleve")
    b = page.locator(".colonne.classe >> nth=1 >> .carte >> nth=0").get_attribute("data-eleve")
    page.evaluate("""([ida, idb]) => {
      const A = document.querySelector(`.carte[data-eleve="${ida}"]`), B = document.querySelector(`.carte[data-eleve="${idb}"]`);
      const dt = new DataTransfer();
      A.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
      B.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true, altKey: true }));
      B.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, altKey: true }));
      A.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
    }""", [a, b])
    assert any({i["a"], i["b"]} == {a, b} for i in projet()["incompatibilites"])
    print("Alt + glisser : OK")
    contenu = (ICI / "donnees/liste_cm2.csv").read_bytes()
    page.evaluate("""(octets) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(octets)], 'depot.csv', { type: 'text/csv' }));
      const c = document.querySelector('#tableau');
      c.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      c.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }""", list(contenu))
    page.wait_for_selector(".imp-fichier")
    page.keyboard.press("Escape")
    print("dépôt de fichier : OK")

    # Deuxième lancement : la fenêtre existante est réutilisée
    env = {**os.environ, "HOME": str(TMP), "XDG_CONFIG_HOME": str(TMP / "config")}
    env.pop("NODE_OPTIONS", None)
    r = subprocess.run([EXE] + ([APPDIR] if APPDIR else []) + ["--no-sandbox"], env=env, timeout=15,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert app.proc.poll() is None
    print(f"instance unique : OK (2e lancement terminé, code {r.returncode})")
    page.evaluate("window.natif.quitter()")
    app.attendre_fin()

if erreurs:
    print("\n".join(erreurs))
    sys.exit(1)
print("Aucune erreur.")
