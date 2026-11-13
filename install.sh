#!/usr/bin/env bash
# Installe ou met à jour Formation des classes pour l'utilisateur, sous Linux (x64) ou macOS.
# Usage : curl -fsSL https://raw.githubusercontent.com/Vylca/cheezwiz/main/install.sh | bash
# Options : --force (réinstaller même si à jour), --desinstaller (les projets sont conservés)
set -euo pipefail

REPO="Vylca/cheezwiz"
NOM="Formation des classes"
OPTION="${1:-}"

# Dossier de téléchargement temporaire, supprimé à la fin du script.
TMP_DIR=""
cleanup() { [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"; return 0; }
trap cleanup EXIT

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || fail "curl est nécessaire."

latest_version() {
  # Dernière version publiée, lue dans la redirection de la page des versions.
  local url
  url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") || fail "Impossible de joindre GitHub."
  local v="${url##*/}"
  case "$v" in v*) echo "$v" ;; *) fail "Aucune version publiée pour l'instant." ;; esac
}

download() {
  curl -fL --progress-bar "https://github.com/$REPO/releases/download/$1/$2" -o "$3" || fail "Le téléchargement a échoué."
}

install_mac() {
  local arch asset apps app version current majeur
  majeur=$(sw_vers -productVersion | cut -d. -f1)
  [ "$majeur" -ge 12 ] || fail "macOS 12 (Monterey) ou plus récent est nécessaire."
  # sysctl plutôt que uname : uname répond x86_64 dans un Terminal lancé avec Rosetta.
  if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then arch="arm64"; else arch="x64"; fi
  asset="Formation-des-classes-mac-$arch.zip"
  apps="${FORMATION_CLASSES_APPS_DIR:-/Applications}"
  if [ ! -w "$apps" ]; then
    apps="$HOME/Applications"
    mkdir -p "$apps"
  fi
  app="$apps/$NOM.app"

  if [ "$OPTION" = "--desinstaller" ]; then
    rm -rf "$app" "$HOME/Applications/$NOM.app"
    say "$NOM est désinstallée."
    echo "Vos projets restent dans ~/Library/Application Support/$NOM (supprimez ce dossier pour les effacer)."
    exit 0
  fi

  if pgrep -f "$NOM.app/Contents/MacOS/" >/dev/null 2>&1; then
    fail "$NOM est ouverte. Fermez-la (Cmd+Q), puis relancez la commande."
  fi

  version=$(latest_version)
  current=""
  if [ -f "$app/Contents/Info.plist" ]; then
    current="v$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist" 2>/dev/null || true)"
  fi
  if [ "$current" = "$version" ] && [ "$OPTION" != "--force" ]; then
    say "$NOM $version est déjà à jour."
    exit 0
  fi

  say "Téléchargement de $NOM $version ($arch)…"
  TMP_DIR=$(mktemp -d)
  local tmp="$TMP_DIR"
  download "$version" "$asset" "$tmp/$asset"
  ditto -x -k "$tmp/$asset" "$tmp/x"
  [ -d "$tmp/x/$NOM.app" ] || fail "Archive inattendue."
  # Les fichiers téléchargés avec curl ne sont pas mis en quarantaine, ceci ne fait que nettoyer.
  xattr -dr com.apple.quarantine "$tmp/x/$NOM.app" 2>/dev/null || true

  rm -rf "$app" || fail "Impossible de remplacer l'ancienne version : mettez-la à la Corbeille, puis relancez la commande."
  mv "$tmp/x/$NOM.app" "$app"

  # Restes des versions d'essai précédentes.
  rm -rf "$HOME/.local/share/formation-classes" "$HOME/.local/bin/formation-classes"
  [ "$apps" != "$HOME/Applications" ] && [ -f "$HOME/Applications/$NOM.app/Contents/MacOS/formation-classes" ] && rm -rf "$HOME/Applications/$NOM.app"

  if [ "$current" != "v" ] && [ -n "$current" ]; then
    say "$NOM mise à jour : $current -> $version."
  else
    say "$NOM $version est installée dans $apps."
  fi
  echo "Lancez-la depuis le Launchpad ou le dossier Applications."
  echo "Pour mettre à jour plus tard, relancez la même commande."
}

install_linux() {
  local dest="$HOME/.local/share/formation-classes" bin="$HOME/.local/bin" apps="$HOME/.local/share/applications"
  local asset="Formation-des-classes-linux-x64.tar.gz" version current sandbox_flag=""

  if [ "$OPTION" = "--desinstaller" ]; then
    pkill -o -f "$dest/app/formation-classes" 2>/dev/null || true
    rm -rf "$dest/app" "$dest/version" "$dest/icon.png"
    rmdir "$dest" 2>/dev/null || true
    rm -f "$bin/formation-classes" "$bin/formation-classes-update" "$apps/formation-classes.desktop"
    say "$NOM est désinstallée."
    echo "Vos projets restent dans ~/.config/$NOM (supprimez ce dossier pour les effacer)."
    exit 0
  fi

  command -v tar >/dev/null || fail "tar est nécessaire."
  [ "$(uname -m)" = "x86_64" ] || fail "Seuls les ordinateurs x86_64 sont pris en charge pour l'instant."

  if pgrep -f "$dest/app/formation-classes" >/dev/null 2>&1; then
    fail "$NOM est ouverte. Fermez-la, puis relancez la commande."
  fi

  version=$(latest_version)
  current=""
  [ -f "$dest/version" ] && current=$(cat "$dest/version")
  if [ "$current" = "$version" ] && [ "$OPTION" != "--force" ]; then
    say "$NOM $version est déjà à jour."
    exit 0
  fi

  say "Téléchargement de $NOM $version…"
  TMP_DIR=$(mktemp -d)
  local tmp="$TMP_DIR"
  download "$version" "$asset" "$tmp/$asset"
  mkdir -p "$tmp/x"
  tar -xzf "$tmp/$asset" -C "$tmp/x" --strip-components=1
  [ -x "$tmp/x/formation-classes" ] || fail "Archive inattendue."

  mkdir -p "$dest" "$bin" "$apps"
  rm -rf "$dest/app.old"
  [ -d "$dest/app" ] && mv "$dest/app" "$dest/app.old"
  mv "$tmp/x" "$dest/app"
  rm -rf "$dest/app.old"
  # Restes des versions d'essai précédentes (les anciens projets sont repris au premier lancement).
  rm -f "$dest/VERSION" "$dest/desinstaller.sh" "$dest/icone.png"
  cp "$dest/app/resources/icon.png" "$dest/icon.png"
  echo "$version" > "$dest/version"

  # Le bac à sable de Chromium a besoin des espaces de noms utilisateur : on le désactive seulement s'ils manquent.
  if ! command -v unshare >/dev/null || ! unshare --user --map-root-user true 2>/dev/null; then
    sandbox_flag="--no-sandbox"
  fi
  cat > "$bin/formation-classes" <<EOF
#!/usr/bin/env bash
exec "$dest/app/formation-classes" $sandbox_flag "\$@"
EOF
  chmod +x "$bin/formation-classes"

  cat > "$bin/formation-classes-update" <<EOF
#!/usr/bin/env bash
curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- "\$@"
EOF
  chmod +x "$bin/formation-classes-update"

  cat > "$apps/formation-classes.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$NOM
Comment=Composer les classes de la rentrée au collège
Exec=$bin/formation-classes %U
Icon=$dest/icon.png
Categories=Education;Office;
Terminal=false
StartupWMClass=$NOM
EOF
  command -v update-desktop-database >/dev/null && update-desktop-database "$apps" >/dev/null 2>&1 || true

  if [ -n "$current" ]; then
    say "$NOM mise à jour : $current -> $version."
  else
    say "$NOM $version est installée."
  fi
  echo "Lancez-la depuis le menu des applications, ou avec la commande : formation-classes"
  echo "Pour mettre à jour plus tard : formation-classes-update"
  case ":$PATH:" in
    *":$bin:"*) ;;
    *) echo "Note : $bin n'est pas dans votre PATH. Utilisez $bin/formation-classes et $bin/formation-classes-update." ;;
  esac
}

case "$(uname -s)" in
  Darwin) install_mac ;;
  Linux) install_linux ;;
  *) fail "Système non pris en charge : $(uname -s)." ;;
esac
