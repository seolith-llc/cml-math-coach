# Using Math Coach on an iPad

The app is a website that can be installed like an app. The iPad needs to reach it over **HTTPS**:
Safari only allows the microphone and offline mode on secure sites.

## 1. Put it online (one time)
The app is hosted on **Cloudflare Pages** at **https://cml-math-coach.seolith.com**. Every push to `main` is tested and redeployed
automatically. One-time setup (API token, two GitHub secrets, custom domain) is in [DEPLOY.md](DEPLOY.md).

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
