# 🚀 Guide pas-à-pas — Tester en local & mettre en production

Ce guide suppose que vous partez de zéro. Comptez **~20 min** pour le test local
et **~20 min** pour la mise en production.

---

# PARTIE 1 — Tester sur votre machine

## Étape 0 — Prérequis (une seule fois)

1. **Node.js 20 ou plus** : téléchargez sur <https://nodejs.org> (version LTS),
   installez, puis vérifiez dans un terminal :
   ```bash
   node --version    # doit afficher v20.x ou v22.x
   ```
2. **Git** : <https://git-scm.com/downloads> (sur Mac : déjà présent en général).

## Étape 1 — Récupérer le code

```bash
git clone https://github.com/micheldian/parcelle_client.git -b claude/agriconnect-parcelles-dispatch-6f4jfg
cd parcelle_client
npm install
```

## Étape 2 — Créer la base de données (Supabase, gratuit)

> La même base servira ensuite en production : vous ne ferez ça qu'une fois.

1. Allez sur <https://supabase.com> → **Start your project** → créez un compte.
2. **New project** :
   - *Name* : `agriconnect-parcelles`
   - *Database Password* : choisissez un mot de passe fort et **notez-le**
   - *Region* : **West EU (Paris)** ou Frankfurt
3. Attendez ~2 min que le projet se crée.
4. Cliquez sur le bouton **Connect** (en haut de la page du projet) → onglet
   **ORMs** → sélectionnez **Prisma**. Supabase affiche deux URI :
   - `DATABASE_URL` → celle avec le port **6543** (Transaction pooler)
   - `DIRECT_URL` → celle avec le port **5432** (Direct connection)
5. Copiez les deux (remplacez `[YOUR-PASSWORD]` par votre mot de passe).

## Étape 3 — Configurer l'application

```bash
cp .env.example .env
```

Ouvrez le fichier `.env` et remplissez :

```bash
DATABASE_URL="postgresql://postgres.xxxx:VOTRE_MDP@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:VOTRE_MDP@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"

NEXTAUTH_SECRET="collez-ici-le-résultat-de-la-commande-ci-dessous"
NEXTAUTH_URL="http://localhost:3000"

ADMIN_EMAIL="votre@email.fr"
ADMIN_PASSWORD="un-mot-de-passe-solide"

# Laissez vide pour l'instant (le dispatch affichera une erreur claire, c'est normal)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_DISPATCH_CHAT_ID=""
```

Pour générer le secret NextAuth :

```bash
# Mac / Linux :
openssl rand -base64 32
# Windows (PowerShell) :
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Étape 4 — Créer les tables et le compte admin

```bash
npx prisma migrate deploy   # crée toutes les tables dans Supabase
npm run db:seed             # crée votre compte admin (ADMIN_EMAIL / ADMIN_PASSWORD)
```

Vous devez voir : `✔ Compte admin créé : votre@email.fr`.

## Étape 5 — Lancer et tester

```bash
npm run dev
```

Ouvrez <http://localhost:3000> → connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Parcours de test conseillé (10 min)

1. **Clients** → « Nouveau client » → créez un client avec une couleur.
2. **Carte** → « Par référence » → tapez une commune (ex. *Riquewihr*),
   choisissez-la dans la liste, saisissez section + numéro (ex. `17` / `648`),
   « Rechercher » → la parcelle s'affiche en jaune → rattachez-la au client →
   « Enregistrer ».
3. **Carte** → « Pointer » → cliquez sur une vigne sur la photo satellite →
   la parcelle cadastrale intersectée est proposée → confirmez.
4. **Import** → « Télécharger le modèle Excel » → ouvrez-le, ajoutez 3-4 lignes
   avec vos vrais clients/communes → ré-uploadez-le → vérifiez le mapping
   (pré-rempli) → « Aperçu » → « Lancer l'import » → regardez la progression
   puis les parcelles apparaître sur la carte.
   - Testez aussi avec **votre vrai fichier clients** : l'écran de mapping
     accepte n'importe quels noms de colonnes.
5. **Carte** → Ctrl+clic sur 2-3 parcelles (ou cases du panneau) →
   « Créer un chantier ».
6. **Chantiers** → votre chantier est dans la colonne « À faire ».
   Le bouton « Envoyer » répondra *Telegram non configuré* tant que la
   Partie 3 n'est pas faite — c'est attendu.

---

# PARTIE 2 — Mettre en production (Vercel)

> La base Supabase de la Partie 1 est déjà prête : il ne reste qu'à héberger l'app.

## Étape 1 — Pousser le code sur votre branche principale

Quand le test local vous convient, fusionnez la branche dans `main`
(via une pull request GitHub, ou en ligne de commande) :

```bash
git checkout main || git checkout -b main
git merge claude/agriconnect-parcelles-dispatch-6f4jfg
git push -u origin main
```

## Étape 2 — Créer le projet Vercel

1. Allez sur <https://vercel.com> → connectez-vous **avec votre compte GitHub**.
2. **Add New… → Project** → importez le dépôt `parcelle_client`.
3. Framework détecté : **Next.js** — ne changez rien aux réglages de build
   (`npm run build` lance déjà `prisma generate`).
4. **Avant de cliquer sur Deploy**, ouvrez la section **Environment Variables**
   et ajoutez :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | la même qu'en local (port **6543**, `?pgbouncer=true`) |
   | `DIRECT_URL` | la même qu'en local (port **5432**) |
   | `NEXTAUTH_SECRET` | **un NOUVEAU secret** (regénérez : `openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | laissez vide pour l'instant, on la mettra à l'étape 3 |
   | `TELEGRAM_BOT_TOKEN` | voir Partie 3 (peut rester vide au début) |
   | `TELEGRAM_DISPATCH_CHAT_ID` | voir Partie 3 (peut rester vide au début) |

5. Cliquez **Deploy** et attendez ~2 min.

## Étape 3 — Finaliser l'URL

1. Vercel vous donne une URL du type `https://parcelle-client.vercel.app`
   (vous pourrez brancher un domaine perso plus tard dans *Settings → Domains*).
2. Retournez dans *Settings → Environment Variables* → renseignez
   `NEXTAUTH_URL` = `https://parcelle-client.vercel.app` (votre URL exacte).
3. *Deployments* → menu `…` du dernier déploiement → **Redeploy**
   (nécessaire pour prendre en compte la variable).

## Étape 4 — Vérifier

- Ouvrez votre URL → page de connexion → connectez-vous avec le compte admin
  créé en Partie 1 (même base ⇒ même compte, et **vos données de test sont déjà là**).
- Si vous préférez repartir d'une base propre : créez un second projet Supabase
  « prod », répétez Partie 1 / Étapes 2 à 4 avec ses URI, et mettez celles-ci
  dans Vercel.

> **À chaque `git push` sur `main`, Vercel redéploie automatiquement.**

---

# PARTIE 3 — Activer le dispatch Telegram (5 min)

1. Dans Telegram, ouvrez **@BotFather** → `/newbot` →
   - nom affiché : `Chantiers AGRICONNECT`
   - identifiant : ex. `PickajobChantiers_bot`
   - BotFather vous donne le **token** → c'est `TELEGRAM_BOT_TOKEN`.
2. Créez un **groupe Telegram** « Chantiers » → ajoutez-y le bot **et** vos ouvriers.
3. Envoyez n'importe quel message dans le groupe, puis ouvrez dans un navigateur :
   ```
   https://api.telegram.org/bot<VOTRE_TOKEN>/getUpdates
   ```
   Cherchez `"chat":{"id":-100xxxxxxxxxx` → ce nombre **négatif** est votre
   `TELEGRAM_DISPATCH_CHAT_ID`.
4. Renseignez les deux variables :
   - en local : dans `.env` (puis relancez `npm run dev`) ;
   - en prod : dans Vercel *Settings → Environment Variables* (puis **Redeploy**).
5. Test : ouvrez un chantier → « Envoyer » → le groupe reçoit le récap
   **+ une position GPS cliquable par parcelle** (itinéraire en un tap),
   et le chantier passe en « Envoyé ».

---

# En cas de problème

| Symptôme | Cause probable / solution |
|---|---|
| `migrate deploy` échoue (connexion) | Vérifiez `DIRECT_URL` (port **5432**) et le mot de passe ; certains réseaux d'entreprise bloquent le port → essayez en 4G |
| Login refusé | Relancez `npm run db:seed` ; vérifiez `ADMIN_EMAIL`/`ADMIN_PASSWORD` du `.env` |
| Page blanche après login en prod | `NEXTAUTH_URL` absente ou incorrecte → corrigez puis Redeploy |
| « Commune introuvable » à l'import | API Géo momentanément indisponible, ou orthographe : ajoutez la colonne `code_insee`, ré-importez le rapport d'erreurs corrigé |
| « Parcelle inexistante côté IGN » | Vérifiez section/numéro sur <https://cadastre.gouv.fr> |
| Dispatch : « Telegram non configuré » | Variables Telegram absentes → Partie 3 |
| Import lent | Normal : ~20 lignes par lot, appels IGN limités à 5 simultanés par courtoisie ; laissez l'onglet ouvert (reprise possible via « Reprendre ») |
