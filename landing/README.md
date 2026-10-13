# agent-render landing page

Static HTML/CSS/JS served by Cloudflare Pages at https://agent-render.kierkegaard.space/.

Public files live only in `public/`. `demo.png` is rendered by this repository's CLI from `examples/landing-demo.tsx`. The launch film is a four-second HyperFrames export; source lives in `videos/agent-render-launch/`.

Preview from the repository root:

```sh
python3 -m http.server 4790 --bind 127.0.0.1 --directory landing/public
```

Deploy with `python3 scripts/deploy-landing.py`. The helper reads the authorized local credentials file, creates a one-hour token scoped to Pages on the account and DNS on the intended zone, checks hostname ownership, uploads only `public/`, attaches the hostname, and revokes the token in `finally`. Deployment receipts are local and ignored under `checks/`.

The `cf` CLI manages Pages metadata, domain and DNS. The landing's `wrangler.jsonc` configures the asset uploader; `cf pages deploy` does not implement directory uploads in the installed CLI, so the helper uses pinned Wrangler 4.148.0 for that step.

The npm publication workflow is manual. Git pushes run CI but do not publish the CLI to npm.
