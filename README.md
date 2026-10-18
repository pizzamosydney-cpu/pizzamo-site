# PizzAmò site with an editable menu (prototype, Pages CMS)

The client edits **menu, prices, opening hours and a banner message** in a web editor.
Layout and code can't be touched from the editor.

## How it works
1. Content lives in `data/*.json` (menu, hours, site notice).
2. `.pages.yml` tells Pages CMS which forms to show for those files.
3. Every save in the CMS is a change in the GitHub repo; Netlify runs `node build.js`, which builds the page from the data and publishes `dist/`.
4. If the data is invalid (price not a number, bad time, missing name) the build stops with a plain message and the previous live version stays online.

## Set up for a client (about 20 minutes)
1. Create a GitHub repo in the client's name (private is fine). Push this folder:
   `git init && git add . && git commit -m "site" && git branch -M main && git remote add origin <repo-url> && git push -u origin main`
2. Netlify: Add new site → Import from Git → pick the repo. The build settings come from `netlify.toml`.
   Move the domain to this site (Domain management).
3. Go to https://pagescms.org, sign in with GitHub, open the repo. The forms from `.pages.yml` appear.
4. Invite the client by email (Collaborators in Pages CMS). They don't need a GitHub account (check this with a test invite first).
5. Test: change a price in the CMS, wait about a minute, check the live site. Then break a price on purpose and confirm the site stays online.

## Local preview
`node build.js` then open `dist/index.html`.

## Notes
- `.pages.yml` list options (`collapsible`, `summary`) were written from the Pages CMS docs and not yet tested in the hosted tool. If the editor shows a config error, replace each `list:` block with `list: true`.
- To add a field (e.g. allergens): add it to the form in `.pages.yml`, then to `build.js` where items are rendered.
