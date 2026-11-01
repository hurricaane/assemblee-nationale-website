#!/usr/bin/env bash
# Downloads and unzips the Assemblée nationale open data archives used by run.ts.
# Usage: scripts/import/download.sh <legislature> <dir>
set -euo pipefail

legislature="${1:?legislature number, e.g. 17}"
dir="${2:?target directory}"
base="https://data.assemblee-nationale.fr/static/openData/repository/${legislature}"

rm -rf "$dir"
mkdir -p "$dir"

curl -fsSL -o "$dir/scrutins.zip" "$base/loi/scrutins/Scrutins.json.zip"
curl -fsSL -o "$dir/dossiers.zip" "$base/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip"
# Historical archive: the active-deputies one misses dissolved groups
curl -fsSL -o "$dir/amo.zip" "$base/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip"

unzip -q -o "$dir/scrutins.zip" -d "$dir/scrutins"
unzip -q -o "$dir/dossiers.zip" -d "$dir/dossiers"
unzip -q -o "$dir/amo.zip" 'json/organe/*' -d "$dir/amo"
