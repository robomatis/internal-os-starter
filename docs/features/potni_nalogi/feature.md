---
module: potni_nalogi
title: Potni nalogi
status: built
created: 2026-06-30
by: tilen
verified_runs: 0
live_url:
---

# Potni nalogi

## Goal
Vnesem stranko, relacijo od–do, datum in namen poti; sistem sam izračuna km prek
Google Maps, shrani zapis in iz njega natisne uradni potni nalog za podpis.

## What it does (input → process → output)
- **Input:** obrazec — stranka (prosto besedilo), kraj odhoda, kraj cilja, datum, namen poti.
- **Process:** Server Action pokliče Google Maps (server-side, ključ iz `process.env`,
  **read-only** razdalja) → dobi km za relacijo → vstavi vrstico v `potni_nalogi_zapisi`.
- **Output:** vrstica v seznamu potnih nalogov + tiskalni pogled posameznega naloga
  (uradni dokument za podpis). — human approves at: pred tiskom pregledaš in podpišeš.

## Access
Samo lastnik (jaz). Dodeli se v Adminu. Člani vidijo samo dodeljene module; RLS loči
zapise po lastniku, če se dostop kdaj razširi.

## Done when
- Vnos relacije (npr. Ljubljana – Maribor) samodejno izpolni km prek Google Maps.
- Zapis se shrani in pokaže v seznamu (`potni_nalogi_zapisi`, prefiksana + RLS).
- Tiskalni pogled posameznega naloga prikaže stranko, relacijo, km, datum, namen.
- Uporabnik brez dostopa do modula dobi zavrnitev server-side na `/m/potni_nalogi`.

## Out of scope
Izračun kilometrine/cene in seštevki po obdobju; urejanje/brisanje zapisov;
večdnevni nalogi in dnevnice; izvoz v računovodstvo; kakršenkoli *write* nazaj v
zunanji sistem (Google Maps je samo branje razdalje).
