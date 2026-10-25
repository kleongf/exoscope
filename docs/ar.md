# Viewing a planet in AR

Select a planet, open its card, and press **View in AR**. ExoScope builds a schematic model in the browser: a sphere tinted by equilibrium temperature with a latitude/longitude grid, and a label baked into the model. The label gives the planet's name, radius (with unit and uncertainty, or "Missing"), equilibrium temperature, what the colour means, and the Live/Snapshot provenance. Nothing is downloaded or generated, and the model is never presented as a photograph.

## Which phones work

| Device | Browser | AR mode |
|---|---|---|
| Android with ARCore | Chrome | WebXR |
| iPhone / iPad | Safari | AR Quick Look |

Google's Scene Viewer is not used: it needs a public model URL, and our model is a local blob. Elsewhere (desktop, unsupported phones) the dialog explains why AR can't start and the model can still be rotated on screen.

## Open ExoScope on a phone over HTTPS

AR only starts on a secure page. The demo runs on localhost, so give the phone an HTTPS URL with a Cloudflare quick tunnel (no account needed):

1. Start the backend and frontend as usual (`uv run uvicorn exoscope.app:app --port 8000` in `backend/`, `pnpm dev` in `frontend/`).
2. Install `cloudflared` (`brew install cloudflared`, or download it from Cloudflare's GitHub releases).
3. Run `cloudflared tunnel --url http://localhost:5173`.
4. Open the printed `https://<words>.trycloudflare.com` URL on the phone. `/api` is proxied by Vite, so the whole app works through the tunnel.

`vite.config.ts` allows `*.trycloudflare.com` hosts for both `pnpm dev` and `pnpm preview`. The tunnel is public while it runs; stop it (Ctrl-C) when you're done.
