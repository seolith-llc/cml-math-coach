# Using Math Coach on an iPad

The app is a website that can be installed like an app. The iPad needs to reach it over **HTTPS**:
Safari only allows the microphone and offline mode on secure sites.

## 1. Put it online (one time, free)

**Option A: GitHub Pages (recommended, updates automatically)**
1. Create an empty repository on GitHub, e.g. `cml-math-coach` (private repos need a paid plan for Pages, so public is simplest. There's no personal data in the code).
2. Push this project to it:
   ```bash
   git remote add origin https://github.com/<you>/cml-math-coach.git
   ```
   ```bash
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The workflow in `.github/workflows/deploy-pages.yml` tests, builds and publishes the app. After about 2 minutes it is live at
   `https://<you>.github.io/cml-math-coach/`.

**Option B: Netlify Drop (no Git needed, 2 minutes)**
1. Run `npm run build` on your computer.
2. Open https://app.netlify.com/drop and drag the `dist` folder onto the page.
3. You get an `https://….netlify.app` link. Repeat the drag to update it.

## 2. Open it on the iPad
1. Open **Safari** and go to the link. Other iPad browsers may not support voice input.
2. Tap anywhere once. This unlocks the read-aloud voice (an Apple rule).
3. Go to ⚙️ Settings → choose **Grade**, a **voice**, and the talking speed.
4. Tap 🎤 the first time and choose **Allow** for the microphone.

## 3. Add it to the Home Screen (optional)
Safari → **Share** button → **Add to Home Screen** → Add. It then opens full-screen like an app and works offline.

> ⚠️ **Voice answers on iPad:** Apple currently does not give speech recognition to web apps opened **from the Home Screen icon**.
> Read-aloud, hints, solutions and typing all work there, but the 🎤 button only appears when the app runs **in Safari**.
> For hands-free voice practice, open the bookmark in Safari instead of the Home Screen icon.
> The app detects this and shows a note on the home page.

## iPad settings that help
- **Settings → General → Keyboard → Enable Dictation: On.** Safari's speech recognition uses Apple's dictation service.
- **Settings → Safari → Microphone:** Ask or Allow.
- **Settings → Accessibility → Spoken Content → Voices:** download an "Enhanced" or "Premium" English voice for a nicer read-aloud voice, then pick it in Math Coach ⚙️ Settings.
- **Ring/silent and volume:** speech is muted when the volume is down.
- For focused practice, **Guided Access** (Settings → Accessibility → Guided Access) keeps the iPad in this one app.

## Testing from your computer on the same Wi-Fi (no deploy)
`npm run dev -- --host` prints an address like `http://192.168.1.20:5173`. The iPad can open it, but because it is not HTTPS
there's **no microphone and no install/offline**. It's useful only for a quick look at layout and read-aloud.

## Privacy
Progress is stored only on the iPad, in Safari's website data. Clearing Safari history and data erases it.
Spoken answers are processed by Apple's speech service.
