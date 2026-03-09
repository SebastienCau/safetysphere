# SafetySphere — Contexte Projet

> **À fournir à Claude en début de chaque session avec les fichiers JS concernés.**

---

## Stack technique

| Élément | Valeur |
|---|---|
| Frontend | HTML/CSS/JS vanilla (SPA) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Déploiement | Vercel (auto-deploy sur push `main`) |
| Email | Resend (à configurer) |
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
| `worker` | Intervenant terrain |
| `guest` | Lecture seule |

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

## Modules présents

- ✅ Auth (login, register, logout, RGPD)
- ✅ Dashboard Worker (habilitations, QR badge, rattachement)
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
- ⏳ Email automatique signature (Resend — session suivante)
- ⏳ Badge PDF imprimable (zones blanches)
- ⏳ Mode offline localStorage

---

## Prochaines priorités

### 1. Edge Function email signature (HAUTE PRIORITÉ)
**Objectif** : envoyer un email automatique à chaque signataire avec lien de signature.

**Prérequis** :
- Compte Resend (resend.com) + clé API `re_xxx`
- Variable d'environnement `RESEND_API_KEY` dans Supabase

**Fichiers à créer** :
- `supabase/functions/send-signature-email/index.ts` (nouveau)

**Fichiers à modifier** :
- `js/signatures.js` (appel à la fonction depuis `sendSignatureRequest`)

**Paramètres de la fonction** :
```
to, signer_name, signer_role, emitter_name,
report_num, report_type, workflow_mode, position, sig_url
```

---

### 2. Badge PDF imprimable (solution zones blanches)
**Objectif** : PDF téléchargeable avec habilitations + QR code + dates expiration.

**Fichiers à modifier** : `js/workers.js`

---

### 3. Mode offline localStorage
**Objectif** : consultation données intervenant sans réseau.

**Fichiers à modifier** : `js/core.js`, `js/workers.js`

---

### 4. Backlog
- Activer PDP dans checklist conformité Admin (`conformite.js`)
- Export CSV/PDF tableaux Analytics (`analytics.js`)
- Analytics Worker individuel (`analytics.js`)
- Permis de travail (nouveau module)
- Notifications push / email digest hebdo
- PWA complète

---

## Convention sessions de développement

```
1. Tu fournis : CONTEXT.md + journal + fichiers JS concernés (1-3 max)
2. Claude génère : uniquement les fichiers modifiés
3. Tu remplaces : sur GitHub via ✏️ Edit file
4. Vercel déploie : automatiquement en 30 secondes
```

**Règle** : ne jamais fournir tous les fichiers — uniquement ceux touchés par la feature.

| Type de tâche | Fichiers à fournir |
|---|---|
| Nouvelle fonctionnalité isolée | Aucun ou 1 fichier |
| Modifier un module existant | Le fichier du module |
| Bug multi-modules | Les 2-3 fichiers concernés |

---

## Historique versions

| Version | Date | Description |
|---|---|---|
| v0.1.0 | — | MVP initial : auth, worker, company, HSE, admin |
| v1.0.0 | — | Habilitations personnalisables |
| v1.1.0 | — | DUER, VGP, FDS |
| v1.3.0 | — | PDP multi-sections |
| v1.4.0 | — | Conformité KPI + personnalisation |
| v1.4.2 | — | Analytics Admin + Analytics par rôle |
| v2.0.0 | 2026-03-09 | Refacto architecture multi-fichiers |
