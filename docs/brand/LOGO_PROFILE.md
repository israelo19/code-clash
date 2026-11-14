# CareVault logo profile

Working logo for the pitch. The name is still an open decision, so the mark was chosen to survive a rename.

## What the logo needs to say

- **These are your records, and you hold the key.** Ownership and privacy come first.
- **This is an organizer, not a clinic.** No cross, heart, stethoscope, pulse line or shield, because the app does not diagnose.
- **Calm and plain.** One simple shape in the teal the app already uses. Nothing cute, nothing clinical.

## The three concepts

| | Concept | Idea | Why it fits | At small sizes |
| --- | --- | --- | --- | --- |
| **A, recommended** | Keyhole page | A record page with a folded corner and a keyhole cut out of it. | Says "patient-owned vault" directly. Uses no medical symbol and no letter from the name. | One solid shape and one cut-out. Still reads as a keyhole at 16px. The fold becomes a clipped corner. |
| B, alternate | Talking page | The same page as a speech bubble with two lines of text. | Shows records plus the Companion. Friendlier, but looks like a generic chat icon and puts the AI in front. | The outline holds at 16px. The two text lines go soft. |
| C, not drawn as a final file | Visit loop | An open ring with a dot at the gap, for before, during and after a visit. | Matches the demo story and doubles as a C. | Holds at 16px, but only works while the name starts with C, and ring-and-dot marks are common. |

A is recommended because it is the clearest at favicon size, it matches the first thing we say about the product, and it never suggests a doctor. One caveat: a keyhole on its own can look like a security app. The page shape and the word "Care" carry the health-records meaning, so prefer the full logo where there is room.

## Colors and type

| Use | Color | Hex |
| --- | --- | --- |
| Mark, "Vault" in the wordmark | teal-700 | `#0f766e` |
| Folded corner | teal-900 | `#134e4a` |
| "Care" in the wordmark | slate-900 | `#0f172a` |
| Mark on a teal tile | white | `#ffffff` |
| Backgrounds it sits on | page, teal-50, white | `#f8fafc`, `#f0fdfa`, `#ffffff` |

Type: the system sans stack the app already uses (`system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`), weight 600, slightly tight spacing. No font files to load or license. The wordmark in `logo-full.svg` is live text, so its width shifts a little between devices. Use the PNG where it must look identical everywhere.

## Usage

| Where | File |
| --- | --- |
| Deck slide, light background | `png/logo-full.png` (Google Slides does not import SVG) or `logo-full.svg` |
| Deck slide, dark or teal background | `logo-mark-on-teal.svg` or `png/logo-mark-on-teal-512.png`, with the name set in white beside it |
| App header | `logo-mark.svg` at 28 to 32px beside the app name, or `logo-full.svg` at 28 to 32px high |
| Favicon / browser tab | `logo-mark.svg` |
| Phone home-screen icon | `logo-mark-on-teal.svg` exported to PNG. Set `rx="0"` if the platform rounds the corners itself. |

- **Minimum size:** mark 16px. Full logo 24px high. Below 24px use the mark alone.
- **Clear space:** keep a quarter of the mark's height empty on every side.
- **Do** use the teal mark on white, the page background or teal-50.
- **Do** switch to the on-teal version on dark backgrounds. The teal mark is weak on slate-900.
- **Don't** recolor it, add a cross or heart, stretch it, or put a shadow or gradient on it.
- **Don't** use the on-teal version as the favicon. The keyhole gets too small at 16px.

If the name changes, edit the one `<text>` line in `logo-full.svg` and re-export the PNG. The mark does not need to change.

## Name check

This is a flag for the team, not legal advice. Searched on November 14, 2026.

- **Care Vault (CareVault Pty Ltd, Australia)** sells software for disability, home care and community service providers. Its listings include patient records. [carevault.com.au](https://carevault.com.au), [Capterra listing](https://www.capterra.com/p/10014552/Care-Vault/)
- **eCare Vault (United States)** is a care-coordination platform for Medicaid and education agencies, with an iOS app. A trademark directory lists two US marks under eCare Vault Inc. [ecarevault.com](https://www.ecarevault.com), [App Store](https://apps.apple.com/us/app/id6475713121), [trademark directory](https://trademarkdir.com/owner/ecare-vault-inc)
- **CareVault 360** is an Android caregiver app for medications, care tasks and health records. Seen only on a third-party tracker. [listing](https://chrome-stats.com/d/com.carevault360.app)
- **CORAVault** is a similar-sounding medical records app. [App Store](https://apps.apple.com/de/app/coravault/id1008831356)
- **Not checked:** `carevault.com` would not load, so its owner is unknown. The USPTO trademark search was not run directly.

Bottom line: the name is already used by healthcare software in at least two countries. It is fine for today's demo. Before any real launch, pick a different name or do a proper trademark search. If a judge asks, "CareVault is a working title" is the honest answer.

## Sources

Sources 2 to 4 are design-practitioner blogs, not research. We found no source specific to logos for price-transparency apps.

1. [Apple Human Interface Guidelines: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons). Keep to a minimal number of shapes, use a simple background, avoid very thin lines.
2. [Spellbrand: medical and healthcare logo guide](https://spellbrand.com/blog/ultimate-guide-medical-healthcare-logo-design-branding). Medical logos tend to look identical. Avoid crosses, hearts and stethoscopes unless the take is original.
3. [Kreafolk: clinic logo design](https://kreafolk.com/blogs/articles/clinic-logo-design). The usual medical icons are recognized but rarely distinctive. Shrink the logo to app-icon size to test it.
4. [Wild & Free Tools: favicon design at 16px](http://wildandfreetools.com/blog/favicon-design-contrast-readability/). Contrast matters most. Thin lines and outlines vanish. Test in a dark browser tab.
5. [Evil Martians: How to Favicon](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs). One SVG icon plus a 32px fallback, a 180px touch icon with margin, and a central safe zone for maskable icons.
