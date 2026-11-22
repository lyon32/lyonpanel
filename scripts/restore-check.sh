#!/usr/bin/env bash
# Test de restauration 15.4 : dump de la base LOCALE, restauration dans une base vide, comparaison.
# Usage : bash scripts/restore-check.sh   (nécessite Docker + `supabase start`). Aucun secret lu ni affiché.
set -euo pipefail
DBC=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_db_' | head -1 || true)
[ -n "$DBC" ] || { echo "Base Supabase locale introuvable (Docker arrêté ou supabase start manquant)."; exit 2; }
T=restore_check_$$
Q="select count(*) wallets, coalesce(sum(balance_xaf),0) solde, (select count(*) from public.wallet_transactions) tx, (select coalesce(sum(amount_xaf),0) from public.wallet_transactions) tx_total, (select count(*) from public.orders) commandes, (select coalesce(sum(charged_xaf),0) from public.orders) commandes_total, (select count(*) from public.payments) paiements, (select coalesce(sum(credited_xaf),0) from public.payments) recharges_total from public.wallets"
dk() { docker exec -i "$DBC" "$@"; }
dk pg_dump -U postgres -d postgres --schema=public --format=custom -f /tmp/lp.dump
dk psql -U postgres -c "drop database if exists $T" -c "create database $T"
# Base vide : le schéma public est restauré seul (comptes auth hors périmètre de la comparaison).
dk pg_restore -U postgres -d "$T" --no-owner --no-privileges --disable-triggers /tmp/lp.dump 2>/tmp/restore.err || true
SRC=$(dk psql -U postgres -d postgres -At -F'|' -c "$Q")
DST=$(dk psql -U postgres -d "$T" -At -F'|' -c "$Q")
dk psql -U postgres -c "drop database $T" >/dev/null
echo "source    : $SRC"
echo "restaurée : $DST"
if [ "$SRC" = "$DST" ]; then echo "OK : soldes et totaux identiques"; else echo "ECART"; exit 1; fi
