# Running this on your Mac

Open **Terminal** and paste these one at a time.

## 0. Do you have Node?

```bash
node -v
```

If that prints v20 or higher, skip to step 1.
If it says "command not found", install it first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

## 1. Install the project

```bash
cd ~/Documents/kgis-quotehub
npm install
```

Takes a minute or two the first time.

## 2. Get a free database

Go to **https://neon.tech** and sign up — no card needed.
Create a project, then copy the **pooled** connection string. It looks
like this:

```
postgresql://neondb_owner:xxxx@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

## 3. Create your settings file

```bash
cd ~/Documents/kgis-quotehub
cp .env.example .env.local
openssl rand -base64 32
open -e .env.local
```

TextEdit opens. Fill in three values:

- `DATABASE_URL` — the Neon string from step 2
- `APP_PASSWORD` — the password you will type to log in. Pick your own.
- `AUTH_SECRET` — the random string `openssl` just printed above

Save and close TextEdit.

## 4. Create the tables

```bash
cd ~/Documents/kgis-quotehub
npm run db:push
```

Optional — load a few sample customers and products to click around:

```bash
npm run db:seed
```

## 5. Run it

```bash
npm run dev
```

Open **http://localhost:3000** and enter the password you chose.

Press `Control` + `C` in Terminal to stop it. To start it again later:

```bash
cd ~/Documents/kgis-quotehub
npm run dev
```

---

## First things to try

1. **Customers** → add a customer. Set the country to something outside
   India and watch the GSTIN field disappear and the currency switch.
2. **New quotation** → pick that customer. GST columns vanish, and the
   custom tax panel invites you to add VAT or Customs Duty.
3. **Add section** → name it `M2407 — SPARE ELECTRICAL` and add lines
   with remarks.
4. **Save**, then **Print / Save PDF** to see the finished document with
   your logo and stamp.
5. **Convert to invoice** on a saved quotation.

---

## Putting it online later

Push this folder to GitHub and import it at **vercel.com** (free tier).
Add the same three environment variables there and you get a URL you can
open from your phone or any laptop.

Full details are in README.md.
