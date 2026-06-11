# 🚀 Mise en production — sans aucune ligne de commande

Tout se fait **dans le navigateur**, en cliquant. Comptez **~15 minutes**.
Vous aurez besoin de : votre compte GitHub (le code y est déjà), un compte
Supabase (gratuit) et un compte Vercel (gratuit).

> ℹ️ Le dépôt est déjà prêt : au premier déploiement, Vercel **crée tout seul
> les tables de la base et votre compte administrateur**. Vous n'avez rien
> d'autre à faire que remplir des formulaires web.

---

## Étape 1 — Créer la base de données (Supabase) — 5 min

1. Allez sur <https://supabase.com> → **Start your project** → créez un compte
   (le plus simple : « Continue with GitHub »).
2. Cliquez **New project** et remplissez :
   - **Name** : `agriconnect-parcelles`
   - **Database Password** : cliquez sur **Generate a password**, puis
     **copiez-le dans un endroit sûr** (vous en aurez besoin à l'étape 2)
   - **Region** : *West EU (Paris)*
3. Cliquez **Create new project** et attendez ~2 minutes.
4. Sur la page du projet, cliquez le bouton **Connect** (en haut) →
   onglet **ORMs** → choisissez **Prisma** dans la liste.
   Deux lignes s'affichent, gardez cette page ouverte :
   - `DATABASE_URL` (l'adresse avec le port **6543**)
   - `DIRECT_URL` (l'adresse avec le port **5432**)

---

## Étape 2 — Déployer l'application (Vercel) — 8 min

1. Allez sur <https://vercel.com> → **Sign Up** → **Continue with GitHub**
   (autorisez l'accès quand GitHub le demande).
2. Cliquez **Add New… → Project** → dans la liste de vos dépôts GitHub,
   trouvez **parcelle_client** → **Import**.
   (S'il n'apparaît pas : bouton *Adjust GitHub App Permissions* → cochez le dépôt.)
3. Sur l'écran de configuration :
   - **Project Name** : `agriconnect-parcelles` ← retenez-le, votre site sera
     `https://agriconnect-parcelles.vercel.app`
   - **Framework Preset** : Next.js (détecté automatiquement — ne touchez à rien)
4. Dépliez **Environment Variables** et ajoutez ces 7 lignes, une par une
   (Nom → Valeur → bouton *Add*) :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | collez la ligne `DATABASE_URL` de Supabase (port 6543) en remplaçant `[YOUR-PASSWORD]` par votre mot de passe |
   | `DIRECT_URL` | collez la ligne `DIRECT_URL` de Supabase (port 5432), même remplacement |
   | `NEXTAUTH_SECRET` | une longue phrase aléatoire (40+ caractères) — ou générez-en une sur <https://generate-secret.vercel.app/32> et collez |
   | `NEXTAUTH_URL` | `https://agriconnect-parcelles.vercel.app` (l'URL correspondant au nom choisi au point 3) |
   | `ADMIN_EMAIL` | votre email (ce sera votre identifiant de connexion) |
   | `ADMIN_PASSWORD` | le mot de passe de connexion que vous voulez |
   | `TELEGRAM_BOT_TOKEN` | laissez vide pour l'instant (voir étape 4) |

5. Cliquez **Deploy**. Pendant les ~3 minutes de construction, Vercel :
   crée les tables dans Supabase ✅ crée votre compte admin ✅ met le site en ligne ✅
6. Quand « Congratulations » s'affiche, cliquez sur l'aperçu du site.

---

## Étape 3 — Premier login et premier import — 2 min

1. Ouvrez `https://agriconnect-parcelles.vercel.app` → connectez-vous avec
   `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Menu **Import** → « Télécharger le modèle Excel » → remplissez quelques
   lignes avec vos clients et leurs parcelles → ré-uploadez → vérifiez le
   mapping (pré-rempli) → **Lancer l'import**.
3. Menu **Carte** : vos parcelles sont là, colorées par client, sur la photo
   satellite IGN. 🍇

Vous pouvez directement importer **votre fichier clients existant** : l'écran
de « mapping » vous laisse associer vos propres noms de colonnes aux champs
attendus, aucun reformatage nécessaire.

---

## Étape 4 — Activer l'envoi Telegram à l'équipe — 5 min

1. Dans Telegram, cherchez **@BotFather** → envoyez `/newbot` :
   - nom affiché : `Chantiers AGRICONNECT`
   - identifiant : par ex. `PickajobChantiers_bot`
   - BotFather répond avec un **token** (longue chaîne avec `:`) → copiez-le.
2. Créez un **groupe Telegram** « Chantiers » → ajoutez-y le bot et vos ouvriers.
3. Envoyez n'importe quel message dans le groupe, puis ouvrez dans votre
   navigateur (en remplaçant VOTRE_TOKEN) :
   ```
   https://api.telegram.org/botVOTRE_TOKEN/getUpdates
   ```
   Cherchez `"chat":{"id":-100…` → ce **nombre négatif** est l'identifiant du groupe.
4. Dans Vercel : votre projet → **Settings → Environment Variables** :
   - `TELEGRAM_BOT_TOKEN` = le token de BotFather
   - `TELEGRAM_DISPATCH_CHAT_ID` = le nombre négatif
5. Onglet **Deployments** → menu **⋯** du déploiement le plus récent →
   **Redeploy** (pour prendre en compte les variables).
6. Test : ouvrez un chantier → **Envoyer** → le groupe reçoit le récap et une
   **position GPS cliquable par parcelle** (itinéraire en un tap).

---

## C'est tout ✅

- **Votre site** : `https://agriconnect-parcelles.vercel.app` (vous pourrez
  brancher un nom de domaine à vous plus tard : Vercel → Settings → Domains).
- **Les mises à jour sont automatiques** : à chaque modification poussée sur
  GitHub, Vercel reconstruit et republie le site, y compris les évolutions
  de la base de données.
- **Coût : 0 €** — Supabase gratuit (500 Mo, très large pour cet usage),
  Vercel gratuit, fonds de carte IGN gratuits, Telegram gratuit.

---

## En cas de problème

| Symptôme | Solution |
|---|---|
| Le déploiement Vercel échoue avec une erreur `P1001` / `connect` | Le mot de passe dans `DATABASE_URL`/`DIRECT_URL` est faux ou `[YOUR-PASSWORD]` n'a pas été remplacé → corrigez dans Settings → Environment Variables, puis Redeploy |
| « Identifiants incorrects » au login | Vérifiez `ADMIN_EMAIL`/`ADMIN_PASSWORD` dans Vercel. Le compte est créé **au premier déploiement** : si vous changez ces variables ensuite, le mot de passe initial reste valable (le compte n'est pas recréé) |
| Redirection étrange après login | Vérifiez que `NEXTAUTH_URL` correspond exactement à l'adresse du site (avec `https://`, sans `/` final), puis Redeploy |
| « Commune introuvable » à l'import | Faute de frappe ou API Géo momentanément indisponible → téléchargez le rapport d'erreurs, corrigez (ou ajoutez une colonne `code_insee`), ré-importez ce fichier |
| « Parcelle inexistante côté IGN » | Vérifiez la référence sur <https://cadastre.gouv.fr> |
| L'import semble lent | Normal : les géométries sont récupérées auprès de l'IGN par lots de 20 lignes. Laissez l'onglet ouvert ; en cas d'interruption, bouton « Reprendre » sur la page Import |
| « Telegram non configuré » au dispatch | Étape 4 pas encore faite, ou Redeploy oublié après l'ajout des variables |

---

## Annexe — Tester sur votre machine avant (optionnel, nécessite un terminal)

> Pas obligatoire : vous pouvez tout à fait tester directement en production.

1. Installez Node.js LTS (<https://nodejs.org>) et Git (<https://git-scm.com>).
2. Dans un terminal :
   ```bash
   git clone https://github.com/micheldian/parcelle_client.git
   cd parcelle_client
   npm install
   cp .env.example .env
   ```
3. Ouvrez `.env` et remplissez les mêmes valeurs qu'à l'étape 2 ci-dessus
   (avec `NEXTAUTH_URL="http://localhost:3000"`).
4. Puis :
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```
5. Ouvrez <http://localhost:3000>.
