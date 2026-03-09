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

### v2.2.0 — Personnel interne (onboarding salariés EU) ⏳ PRIORITÉ 2
**Objectif** : permettre aux EU d'inviter et gérer leurs propres salariés
(pas seulement les workers externes / sous-traitants).

**Contexte décisionnel** :
- Aujourd'hui `worker` = intervenant externe uniquement
- Les PME ont aussi besoin de gérer les habilitations de leurs propres salariés
- Douleur réelle : Excel + classeur papier + rappels manuels
- Argument commercial : SafetySphere remplace l'outil RH habilitations

**Ce qui change** :
- Nouveau champ `employment_type: 'internal' | 'external'` dans `profiles`
- Flux invitation directe EU → salarié par email (sans QR code)
- Dashboard Worker interne légèrement différent (pas de rattachement ST)
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

**Contenu du module** :
- Éditeur structuré par étapes numérotées
- Photos/schémas par étape
- Pictogrammes EPI requis
- Niveau de risque par étape
- Workflow validation (HSE → signature)
- Accusé de lecture signé par l'intervenant
- Historique révisions (v1, v2, v3...)
- Alertes révision périodique
- Attachable à un PDP
- Visible dans dashboard Worker (interne ET externe)

**Tables SQL à créer** :
```sql
mop_entries    -- les modes opératoires (titre, version, statut, org_id)
mop_steps      -- les étapes (ordre, description, epi, niveau_risque, photo_url)
mop_readings   -- accusés de lecture (worker_id, mop_id, signed_at, sig_url)
```

**Fichiers** : nouveau fichier `js/mop.js` + modification `index.html`

---

### v2.4.0 — Zones blanches (offline) ⏳ PRIORITÉ 4

**Option A — Badge PDF imprimable (1 jour)**
- PDF téléchargeable avec habilitations + QR code + dates expiration
- Imprimable avant intervention en zone sans réseau
- Fichiers à modifier : `workers.js`

**Option B — Mode offline localStorage (2-3 jours)**
- Sauvegarde automatique données intervenant au login
- Page hors-ligne en lecture seule
- Fichiers à modifier : `core.js`, `workers.js`

---

### Backlog

- Activer PDP dans checklist conformité Admin (`conformite.js`)
- Export CSV/PDF tableaux Analytics (`analytics.js`)
- Analytics Worker individuel (`analytics.js`, `workers.js`)
- Comparaison inter-périodes charts Analytics N vs N-1 (`analytics.js`)
- Permis de travail (nouveau module `permis.js`)
- Notifications push / email digest hebdo
- PWA complète (offline total)
- Application mobile native
- Matrice de polyvalence personnel interne
- Suivi visites médicales

---

## Positionnement marché

**Concurrents directs FR** : Preventeo, Daxium, Qualintra, SafetyCulture
→ 80-300€/mois/utilisateur, interface lourde, pensé grands groupes

**Différenciateurs forts** :
- Relation EU↔ST native (angle rare sur le marché)
- Signature numérique intégrée (pas de renvoi vers DocuSign)
- Onboarding QR code (zéro friction terrain)
- Gestion personnel interne + externe dans le même outil (v2.2.0)

**Cible prioritaire** : entreprises qui interviennent chez d'autres
(électriciens, maintenance industrielle, BTP, nettoyage industriel)
→ 1 EU qui impose SafetySphere à 10 ST = 11 comptes d'un coup

**Déclencheurs d'achat** : contrôle URSSAF, accident, appel d'offres
exigeant attestation conformité, nouveau donneur d'ordre

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
| Nouvelle feature multi-modules | Les fichiers listés dans la roadmap ci-dessus |

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
| v2.2.0 | — | Personnel interne (onboarding salariés EU) |
| v2.3.0 | — | Modes opératoires (MOP) |
| v2.4.0 | — | Zones blanches (badge PDF + offline) |
