# SafetySphere — Contexte Projet

> **À fournir à Claude en début de chaque session avec les fichiers JS concernés.**

---

## Stack technique

| Élément | Valeur |
|---|---|
| Frontend | HTML/CSS/JS vanilla (SPA) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Déploiement | Vercel (auto-deploy sur push `main`) |
| Email | Resend (à configurer — v2.1.0) |
| Repo GitHub | github.com/SebastienCau/safetysphere |
| URL prod | safetysphere.vercel.app |
| Supabase URL | https://hyqsiakhkivteaaqyzjc.supabase.co |

---

## Version actuelle : v2.0.0

Refacto architecture complète — fichier monolithique 12 844 lignes
découpé en 9 fichiers séparés. Déployé en production le 2026-03-09.

---

## Structure des fichiers

```
safetysphere/
├── index.html                  (squelette HTML pur — ne pas modifier sauf HTML)
├── index_v142_backup.html      (sauvegarde version monolithique v1.4.2)
├── CONTEXT.md                  (ce fichier)
├── css/
│   ├── base.css                (reset + variables CSS :root)
│   ├── components.css          (composants UI + modules métier)
│   └── themes.css              (overrides body.theme-light)
└── js/
    ├── core.js                 (Supabase init, auth, routing, theme, globals)
    ├── analytics.js            (analytics admin + Company/ST/HSE/Trainer)
    ├── workers.js              (workers, docs, invitations, missions, QR, ST)
    ├── signatures.js           (OTP, workflow envoi, page publique, consolidé)
    ├── reports.js              (rapports, archivage, historique, widgets, impersonation)
    └── conformite.js           (DUER, VGP, FDS, PDP, personnalisation sections)
```

---

## Ordre de chargement JS (important — ne pas changer)

```
core.js → analytics.js → workers.js → signatures.js → reports.js → conformite.js
```

---

## Rôles utilisateurs

| Rôle | Description |
|---|---|
| `admin` | Accès total, gestion plateforme |
| `company` | Entreprise utilisatrice (EU) — donneur d'ordre |
| `subcontractor` | Sous-traitant (ST) |
| `hse` | Responsable HSE |
| `trainer` | Centre de formation |
| `worker` | Intervenant terrain (externe OU interne) |
| `guest` | Lecture seule |

> ⚠️ Le rôle `worker` va évoluer en v2.2.0 pour distinguer
> `employment_type: 'internal'` (salarié EU) vs `'external'` (ST/prestataire)

---

## Tables Supabase principales

```
organizations, profiles, documents, report_archive,
duer_entries, registre_vgp, fds_library, pdp_entries,
signature_requests, signature_request_items,
org_relationships, st_invites, worker_invites,
doc_workflow_config
```

---

## Modules présents (v2.0.0)

- ✅ Auth (login, register, logout, RGPD)
- ✅ Dashboard Worker externe (habilitations, QR badge, rattachement ST)
- ✅ Dashboard Company/EU (workers, docs société, sous-traitants)
- ✅ Dashboard Sous-traitant (EU partenaires, workers, docs)
- ✅ Dashboard HSE (conformité, ST, invitations)
- ✅ Dashboard Trainer (formations, validation documents)
- ✅ Dashboard Admin (users, orgs, signatures, simulator, impersonation)
- ✅ DUER (templates sectoriels, cotation gravité×probabilité, rapport PDF)
- ✅ VGP (registre légaux, alertes J-30, rapport PDF)
- ✅ FDS (bibliothèque, pictogrammes GHS, statuts)
- ✅ PDP (multi-sections, workflow EU→ST→SPS, rapport PDF)
- ✅ Signatures (OTP, parallèle/séquentiel, page publique token, consolidé)
- ✅ Analytics (8 KPI admin + analytics par rôle avec charts SVG)
- ✅ QR Code (badge worker, scan rattachement)
- ✅ Missions ST↔EU
- ✅ Thème clair/sombre
- ✅ Accessibilité (zoom police, contraste)

---

## Modèle de pricing décidé

| Profil | Prix | Accès |
|---|---|---|
| EU / HSE | 79-149€/mois | Complet + jusqu'à 10 ST inclus |
| ST rattaché à 1 EU | Gratuit | Limité à la relation avec cet EU |
| ST autonome (multi-EU) | 29-49€/mois | Complet multi-EU |

**Logique** : le ST gratuit devient prescripteur → client payant dès qu'il
travaille avec plusieurs EU. Modèle viral type Slack/Figma.

---

## Roadmap priorisée

---

### v2.1.0 — Edge Function email signature ⏳ PRIORITÉ 1
**Objectif** : email automatique à chaque signataire avec lien de signature.

**Prérequis avant de coder** :
- Compte Resend (resend.com) + clé API `re_xxx`
- Variable d'environnement `RESEND_API_KEY` dans Supabase Dashboard → Settings → Edge Functions

**Fichiers à créer** :
- `supabase/functions/send-signature-email/index.ts` (nouveau — Claude le génère complet)

**Fichiers à modifier** :
- `js/signatures.js` (appel depuis `sendSignatureRequest`)

**Paramètres de la fonction** :
```
to, signer_name, signer_role, emitter_name,
report_num, report_type, workflow_mode, position, sig_url
```

**Pour démarrer cette session** : fournir `js/signatures.js`

---

### v2.1.1 — Export Passeport Prévention ⏳ PRIORITÉ 1 BIS 🔥
**Mis à jour le 2026-03-09 avec infos techniques officielles**
**Contexte** : Le Passeport Prévention (dispositif légal obligatoire Ministère du Travail)
a ouvert son espace employeurs le 16 mars 2026 — aujourd'hui même.
Les employeurs ont désormais l'obligation de déclarer les formations SST de leurs salariés.
À partir du 9 juillet 2026, un import par fichier sera disponible.
Des trames de fichiers officielles sont déjà publiées par l'État.

**Opportunité commerciale** :
> "SafetySphere génère automatiquement votre fichier de déclaration
> pour le Passeport Prévention — votre nouvelle obligation légale."
C'est un déclencheur d'achat immédiat pour toute PME qui découvre SafetySphere.

**Ce que la feature fait** :
- Bouton "Exporter vers le Passeport Prévention" dans dashboard Company/HSE
- Génère un fichier CSV/Excel au format officiel État à partir des habilitations
  déjà enregistrées dans SafetySphere (zéro double saisie)
- L'employeur dépose le fichier directement sur passeport-prevention.travail-emploi.gouv.fr
- Champs requis : nom, prénom, date naissance, identifiant CPF, intitulé formation,
  dates formation, type attestation, niveau obtenu

**Complexité** : 1-2 jours — pas d'API à intégrer, juste un export au bon format

**Fichiers à modifier** : `workers.js` ou `conformite.js`

**Pour démarrer cette session** : récupérer la trame officielle sur
passeport-prevention.travail-emploi.gouv.fr puis fournir `js/workers.js`

---

### v2.2.0 — Personnel interne (onboarding salariés EU) ⏳ PRIORITÉ 2
**Objectif** : permettre aux EU d'inviter et gérer leurs propres salariés
(pas seulement les workers externes / sous-traitants).

**Contexte** :
- Aujourd'hui `worker` = intervenant externe uniquement
- Les PME ont besoin de gérer les habilitations de leurs propres salariés
- Douleur réelle : Excel + classeur papier + rappels manuels
- Lien direct avec Passeport Prévention (v2.1.1) — les salariés internes
  sont exactement les personnes dont les formations doivent être déclarées

**Ce qui change** :
- Nouveau champ `employment_type: 'internal' | 'external'` dans `profiles`
- Flux invitation directe EU → salarié par email (sans QR code)
- Dashboard Worker interne (pas de rattachement ST)
- Alertes expiration habilitations salariés dans dashboard Company
- KPI conformité incluant personnel interne

**Tables SQL à modifier** :
```sql
profiles       -- ajouter employment_type (default 'external')
worker_invites -- ajouter flux invitation interne
```

**Fichiers à modifier** : `core.js`, `workers.js`, `conformite.js`

**Pour démarrer cette session** : fournir `core.js` + `workers.js`

---

### v2.3.0 — Modes opératoires (MOP) ⏳ PRIORITÉ 3
**Objectif** : créer, valider et diffuser des procédures de sécurité étape par étape.

**Contenu** :
- Éditeur structuré par étapes numérotées
- Photos/schémas par étape, pictogrammes EPI, niveau de risque
- Workflow validation HSE → signature
- Accusé de lecture signé par l'intervenant (interne ET externe)
- Historique révisions (v1, v2, v3...) + alertes révision périodique
- Attachable à un PDP, visible dans dashboard Worker

**Tables SQL à créer** :
```sql
mop_entries    -- (titre, version, statut, org_id)
mop_steps      -- (ordre, description, epi, niveau_risque, photo_url)
mop_readings   -- (worker_id, mop_id, signed_at, sig_url)
```

**Fichiers** : nouveau `js/mop.js` + modification `index.html`

---

### v2.4.0 — Zones blanches ⏳ PRIORITÉ 4

**Option A — Badge PDF imprimable (1 jour)**
- PDF avec habilitations + QR code + dates expiration
- Fichiers : `workers.js`

**Option B — Mode offline localStorage (2-3 jours)**
- Sauvegarde automatique au login, lecture seule sans réseau
- Fichiers : `core.js`, `workers.js`

---

### Backlog

- Activer PDP dans checklist conformité Admin (`conformite.js`)
- Export CSV/PDF tableaux Analytics (`analytics.js`)
- Analytics Worker individuel (`analytics.js`, `workers.js`)
- Comparaison inter-périodes N vs N-1 (`analytics.js`)
- Permis de travail (nouveau module `permis.js`)
- Notifications push / email digest hebdo
- PWA complète (offline total)
- Application mobile native
- Matrice de polyvalence personnel interne
- Suivi visites médicales
- Intégration API Passeport Prévention (import automatique attestations
  dans profil Worker depuis Mon Compte Formation — à surveiller,
  API non publique à ce jour)

---

## Positionnement marché

**Concurrents directs FR** : Preventeo, Daxium, Qualintra, SafetyCulture
→ 80-300€/mois/utilisateur, interface lourde, pensé grands groupes

**Différenciateurs forts** :
- Relation EU↔ST native (angle rare sur le marché)
- Signature numérique intégrée (pas de renvoi vers DocuSign)
- Onboarding QR code (zéro friction terrain)
- Export Passeport Prévention automatique (obligation légale depuis 16/03/2026)
- Gestion personnel interne + externe dans le même outil (v2.2.0)

**Cible prioritaire** : entreprises qui interviennent chez d'autres
(électriciens, maintenance industrielle, BTP, nettoyage industriel)
→ 1 EU qui impose SafetySphere à 10 ST = 11 comptes d'un coup

**Déclencheurs d'achat** :
- Nouvelle obligation Passeport Prévention (16/03/2026) 🔥
- Contrôle URSSAF / accident
- Appel d'offres exigeant attestation conformité
- Nouveau donneur d'ordre

---

## Convention sessions de développement

```
1. Fournir : CONTEXT.md + journal + fichiers JS concernés (1-3 max)
2. Claude génère : uniquement les fichiers modifiés
3. Remplacer : sur GitHub via ✏️ Edit file
4. Vercel déploie : automatiquement en 30 secondes
```

| Type de tâche | Fichiers à fournir |
|---|---|
| Nouvelle fonctionnalité isolée | Aucun ou 1 fichier |
| Modifier un module existant | Le fichier du module |
| Bug multi-modules | Les 2-3 fichiers concernés |
| Nouvelle feature multi-modules | Les fichiers listés dans la roadmap |

---

## Historique versions

| Version | Date | Description |
|---|---|---|
| v0.1.0 | — | MVP : auth, worker, company, HSE, admin |
| v1.0.0 | — | Habilitations personnalisables |
| v1.1.0 | — | DUER, VGP, FDS |
| v1.3.0 | — | PDP multi-sections |
| v1.4.0 | — | Conformité KPI + personnalisation |
| v1.4.2 | — | Analytics Admin + Analytics par rôle |
| v2.0.0 | 2026-03-09 | Refacto architecture multi-fichiers |
| v2.1.0 | — | Edge Function email signature (Resend) |
| v2.1.1 | — | Export Passeport Prévention (format officiel État) |
| v2.2.0 | — | Personnel interne (onboarding salariés EU) |
| v2.3.0 | — | Modes opératoires (MOP) |
| v2.4.0 | — | Zones blanches (badge PDF + offline) |

---

## Passeport Prévention — Notes techniques (2026-03-09)

### Format d'échange
- Pas d'API REST publique à ce jour
- Format : **fichier CSV** à déposer sur le portail employeur
- Trame CSV officielle disponible sur :
  https://passeport-prevention.travail-emploi.gouv.fr/employeurs/guide
- Deux types de déclarations :
  1. Attestation de formation (suivi de formation)
  2. Justificatif de réussite (certification obtenue)

### Champs requis (à confirmer sur la trame officielle)
nom, prénom, date de naissance, identifiant CPF,
intitulé formation, dates formation, type attestation, niveau obtenu

### Calendrier obligations employeur
- 16/03/2026 : espace ouvert, obligation démarre (périmètre limité)
  → formations obligatoires réglementées uniquement :
    amiante, habilitation électrique, conduite engins, hyperbare...
- 09/07/2026 : import masse CSV disponible
- 01/10/2026 : toutes les formations concernées à déclarer
- Délai déclaration : 6 mois après fin du trimestre de formation (9 mois max)
- Période transitoire : délai prolongé de 3 mois jusqu'au 09/07/2026

### Action SafetySphere
1. Récupérer la trame CSV officielle (lien ci-dessus)
2. Coder l'export CSV dans workers.js ou conformite.js
3. Mai 2026 : candidater comme testeur officiel
   → levier marketing : apparaître dans les communications du Ministère
4. Juillet 2026 : feature live le jour J

### Ressources officielles
- Portail : https://passeport-prevention.travail-emploi.gouv.fr
- Guide employeur : https://passeport-prevention.travail-emploi.gouv.fr/employeurs/guide
- Replay webinaire : https://www.youtube.com/watch?v=GvhpGgKE0i4
