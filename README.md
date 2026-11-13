# Self-Healing Cloud Infrastructure: project site

The public website for our B.Tech capstone on reinforcement learning for fault repair on a live Kubernetes cluster. It explains the project in plain language, replays real recorded incidents, and shows the evaluation results.

The research code and raw data live in a separate repository: [self-healing-cloud-infrastructure](https://github.com/zaidbinshams/self-healing-cloud-infrastructure). This site only displays what that repository recorded.

## Running it

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`.

## Deploying

The site is static and is hosted on Cloudflare Pages. Build command `npm run build`, output directory `dist`. Cache and security headers are in `public/_headers`.

## Icons

`public/favicon.svg` is the source. After changing it, run `npm run make_icons` to regenerate the PNG sizes in `public/icons/`.

## Credits

Researched, experimented and built by Pratyush, Zaid and team.
