/** Small standalone pages for the email links (sign-in, approve): no app shell, light and dark, noindex. */
export const authPage = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · Puzzle Trail</title>
<style>
:root{--bg:#f2f2f7;--surface:#fff;--text:#1c1c1e;--muted:#6e6e73;--accent:#2f6fed;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--surface:#1c1c1e;--text:#f5f5f7;--muted:#98989d;--accent:#4c8dff}}
body{font:17px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:64px 16px}
main{max-width:420px;margin:auto;background:var(--surface);border-radius:12px;padding:32px 24px;text-align:center}
h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:var(--muted)}
button,a.btn{font:inherit;font-weight:600;background:var(--accent);color:#fff;border:0;border-radius:12px;min-height:48px;padding:0 24px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;width:100%;justify-content:center;box-sizing:border-box}
button.quiet{background:transparent;color:var(--muted)}
</style></head><body><main>${body}</main></body></html>`;
