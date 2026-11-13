// Pont sécurisé entre l'interface et le processus principal.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('natif', {
  plateforme: process.platform,
  charger: () => ipcRenderer.invoke('charger'),
  enregistrer: texteProjet => ipcRenderer.invoke('enregistrer', texteProjet),
  enregistrerFichier: options => ipcRenderer.invoke('enregistrer-fichier', options),
  montrerFichier: chemin => ipcRenderer.invoke('montrer-fichier', chemin),
  fermer: () => ipcRenderer.send('fermer'),
  quitter: () => ipcRenderer.send('quitter'),
  surFermeture: fn => ipcRenderer.on('fermeture', () => fn()),
  surMenu: fn => ipcRenderer.on('menu', (_e, commande) => fn(commande)),
});
