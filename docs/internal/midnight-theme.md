# Midnight theme experiment

Midnight is a visual theme experiment for the web app.
It is dark-first, with ink/navy surfaces, one electric indigo accent, soft cool borders, and Inter as the UI font.
It replaces the default palette in both light and dark mode while it is applied.

## Where it lives

All of Midnight is one section at the end of the variable blocks in `frontend/src/styles/base.scss`, headed `Midnight theme`.
`frontend/src/styles/lemon-skin.scss` reads `--color-on-accent` for quill primary buttons.
No component or scene stylesheet changes.

The section works by overriding tokens rather than components:

- The primitive ramps (`--color-neutral-*`, `--color-neutral-cool-*`, `--color-posthog-3000-*`) are retinted cool, so semantic tokens, the quill bridge, and the Lemon skin follow automatically.
- `--color-brand-primary-*` drives `--color-accent` and its hover, active, and highlight variants.
- `--color-on-accent` is the text color on accent-filled primary buttons: white in light mode, ink in dark mode.
- The legacy `*-3000-light` and `*-3000-dark` tokens that Lemon components still read are set to matching values.

A few global rules sit next to the tokens:

- `html`, `.font-sans`, and `.font-title` re-apply `--font-sans`, because the Tailwind config hardcodes the RoundHog stack.
- Primary `LemonButton`s read `--color-on-accent`. The `body` prefix and `:not()` outrank the `.Link.LemonButton` variants.
- `.AuthScene` keeps its primary fill on the accent instead of amber, so the on-accent text stays readable.

## Palette

| Token                   | Light     | Dark      |
| ----------------------- | --------- | --------- |
| Accent                  | `#505EF1` | `#7A8CFF` |
| Page / canvas           | `#F4F6FB` | `#0D1322` |
| Nav chrome              | `#E6EAF3` | `#0A0F1C` |
| Cards (surface primary) | `#FFFFFF` | `#151C2E` |
| Popovers                | `#FFFFFF` | `#182037` |
| Border                  | `#DDE2EE` | `#1F273D` |
| Text primary            | `#0E1426` | `#E8ECF7` |
| Text secondary          | `#3C4562` | `#A9B2CC` |
| Link                    | `#4553E8` | `#8F9FFF` |

## Limits

Insight series colors come from the project's data color theme, which is stored in the database.
Midnight changes the CSS `--data-color-*` tokens, which only sparklines, SQL charts, and series glyphs read.
Trend lines on insights and dashboards keep the stock palette.

To remove the experiment, delete the `Midnight theme` section from `base.scss` and restore `--text-3000-light` in the quill primary button rule in `lemon-skin.scss`.
