# Miso UI illustration pack

These PNG files are generated production illustrations for contextual UI use. They are not flattened UI cards and contain no required operational text.

| File | Intended use | Suggested rendered size |
|---|---|---|
| `miso-shift-ready.png` | Home shift hero | 132–220 px wide |
| `miso-ask.png` | Ask Miso callout/chat identity | 48–112 px wide |
| `miso-low-stock.png` | Low-stock alert or empty state | 64–144 px wide |
| `miso-out-of-stock.png` | Out-of-stock filter/empty state | 96–176 px wide |
| `miso-stock-good.png` | Healthy-stock success state | 96–176 px wide |
| `miso-task-complete.png` | Completed tasks/checklist success | 96–176 px wide |
| `miso-finance-insight.png` | Finance help/empty state | 96–176 px wide |
| `miso-log-note.png` | Log or shift-handoff assistance | 72–160 px wide |

Implementation rules:

- Render with `expo-image` and `contentFit="contain"`.
- Preserve the original aspect ratio and transparent padding.
- Keep all live text, badges, values, buttons, and progress indicators in React Native.
- Use at most one prominent illustration or two small cameos per screen.
- Do not use illustrations as navigation icons or repeated inventory-row thumbnails.
