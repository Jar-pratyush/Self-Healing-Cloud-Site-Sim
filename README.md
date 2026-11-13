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

## Refreshing the data

Everything the site shows is read from `public/data/`, which is generated from the capstone repository by one script. It needs Python 3.10+ and PyYAML.

```bash
npm run export_data
# or point it somewhere else:
python3 scripts/export_site_data.py --capstone_path ../cloud-healing-capstone
```

The script never writes to the capstone repository. Before writing anything it recomputes the recovery counts and median recovery times from the raw episode logs and stops if they differ from the committed summary tables. `public/data/provenance.json` records the capstone commit and a hash of every file that was read.

The per-tick replay traces come from the capstone's local `data/` folder, which is not in its git repository. Without it, run with `--public_only`: the committed tables are re-exported and the existing traces are kept.

`npm run test_export` runs the script's unit tests.

## Deploying

The site is static and is hosted on Cloudflare Pages. Build command `npm run build`, output directory `dist`. Cache and security headers are in `public/_headers`.

## Icons

`public/favicon.svg` is the source. After changing it, run `npm run make_icons` to regenerate the PNG sizes in `public/icons/`.

## Credits

Researched, experimented and built by Pratyush, Zaid and team.
