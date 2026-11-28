# UI design direction (V2 visual refresh)

Drafted by Claude Code overnight on 28 Nov 2026 after Peter asked for a much sleeker UI ("it is very
vibe coded looking as is. use mobbin for inspiration and shadcn etc."). **Not yet reviewed by
Peter.** Two research subagents produced the inputs: a Mobbin screen search (section 1) and a
styling-library comparison (section 3, decision DL-033). The resulting tokens are in
`apps/mobile/src/theme/tokens.ts` on `prototype/demo`.

## 1. Mobbin inspiration (iOS)

The Mobbin MCP worked without authentication problems. Twelve `search_screens` queries returned 5 or
6 results each, and the subagent looked at each preview image. Previews are low resolution, so type
sizes are estimates. No TeamSnap, Spond, Heja, Bearable, Daylio, Finch, Strong or staff-side invite
share screens came back; patterns for those are inferred and marked as such.

| Area | Best examples (Mobbin) | What LoadWise borrows |
|---|---|---|
| Daily check-in | [Bloom](https://mobbin.com/screens/57925b4d-f371-4887-ba00-d7e70be3b26a), [stoic.](https://mobbin.com/screens/05a9030a-e25a-43f3-b28f-53a4b025dfef), [Insight Timer](https://mobbin.com/screens/25acbde9-3526-4e30-ad92-2ead4e7c2e0c), [How We Feel](https://mobbin.com/screens/aafe5784-457c-4b09-b50a-b067585649f9) | One compact card per wellness item with a row of five ≥44 pt circular buttons and anchor labels at the ends; the selected button is filled with the accent and shows a check, so state is not colour alone; a single pinned "Save check-in" button |
| Today dashboard | [Oura Readiness](https://mobbin.com/screens/121db3f0-43f9-4642-830e-d82d26190ba9), [WHOOP Recovery](https://mobbin.com/screens/c85b5dd2-aa58-41be-a07b-11d5c8e4db9f), [Visible](https://mobbin.com/screens/3f60710a-3d4e-4892-a146-05dc3a432fc9), [Bevel](https://mobbin.com/screens/bf86c914-92f3-441f-acf6-08a4c2a7e1d0) | A hero number with a status pill and one plain sentence giving reason, value and threshold; "contributors" rows with the athlete's own baseline in muted text. No rings, and none of the predictive copy some of these apps use |
| Quick activity log | [Hevy](https://mobbin.com/screens/b7c6155c-8453-4230-9c28-a12218a415d8), [Bevel](https://mobbin.com/screens/c4ffd0fd-3863-4f0f-b94c-289b6768732d), [Fitbit](https://mobbin.com/screens/769a4748-45ba-48e5-94e2-3eb019212017), [Ladder](https://mobbin.com/screens/3daed3ec-2832-48af-9f73-0aab0d428f51) | Grouped form card, segmented type control, RPE as tap chips rather than a slider, a live load preview, sticky save |
| Trend charts | [Apple Health](https://mobbin.com/screens/1fc68a4e-8b4f-4fbe-82f8-25a5619d5d7a), [Withings](https://mobbin.com/screens/445f153c-d36a-47f0-ac35-c07cb797292a), [Visible](https://mobbin.com/screens/f76b7bc4-dbc5-4f58-8793-9f686159a678), [Noom](https://mobbin.com/screens/446f528a-16b4-4961-9a83-617bed75679f) | Stacked metric cards with a caps label, a big number, a muted date range, one series colour and very light gridlines; the threshold as a labelled dashed line |
| Roster with status | [NFL injury report](https://mobbin.com/screens/3f19a35f-e6da-4e98-a91f-28baa0a62ee4), [Discord members](https://mobbin.com/screens/d0bfacf8-db5c-409c-b652-1c5c553c13ce), [Riot](https://mobbin.com/screens/a53f450a-6981-4fa7-bd66-a1eca07624e9), [FotMob](https://mobbin.com/screens/20222bc2-7102-46c8-b28e-d0d710b8f291) | Group headers with counts ("Flagged (3)"); rows with initials avatar, name, status pill with icon and text, muted reason |
| Consent onboarding | [MacroFactor](https://mobbin.com/screens/3d08f136-1813-4d49-9be9-638e13ec51b3), [Fitbit](https://mobbin.com/screens/e5a1665c-58c7-4b48-acf1-a8c5a691fd8a), [Flo](https://mobbin.com/screens/9524933d-5f9c-415f-9c2b-fb95b4ee5693), [BitePal](https://mobbin.com/screens/af5234db-93d1-42a6-a2f7-89aa28d07c6f) | Plain-language bold lead-ins, separate granular consents (MacroFactor model, not Flo's bundled consent), a reassurance line |
| Invite code | [Quizlet](https://mobbin.com/screens/a8192739-6109-4395-b0a9-c2b3d1ae437a), [Discord](https://mobbin.com/screens/d8cb65c8-b4e8-4944-9281-27e41d186ad7), [Numo](https://mobbin.com/screens/6d74c4e6-b0b1-4754-89d3-0e2f32be2e09), [Premier League](https://mobbin.com/screens/d4020bf7-0e60-4ae3-adad-1de479324f42) | A large, widely tracked code display or input; helper and inline error text; on the staff side (inferred) copy and share buttons and "Invite codes add athletes only" |
| Settings and profile | [Hevy](https://mobbin.com/screens/9c98b33f-442d-4a90-a11c-0e5535b1e5e7), [Runna](https://mobbin.com/screens/27e968a9-ce87-4e7b-ac11-742fc3febb26), [Ultrahuman](https://mobbin.com/screens/a373b100-fc5b-4964-a820-2fde9776f65a), [Equinox+](https://mobbin.com/screens/da2bc7da-c2e0-4fb6-bb48-fa59b1c34773) | Initials avatar header; grouped rows with icon, title, muted subtitle showing current state, chevron |
| Empty and offline | [Hevy](https://mobbin.com/screens/7370cfee-bee2-437d-a374-5d65f4545a89), [Ultrahuman](https://mobbin.com/screens/3bb7406d-cdbf-4d07-939d-3c9dece29b2f), [Withings](https://mobbin.com/screens/dbd5c8e5-224d-476b-a4b4-7e36c7262e77), [GoPay](https://mobbin.com/screens/95483b32-a4d7-4025-b6e7-64220245eff5) | Placeholder cards keep their shape and show "--" with a short reason ("ACWR needs 28 days of sessions"); a thin non-blocking offline banner |
| Tabs and segmented controls | [Apple Health](https://mobbin.com/screens/1fc68a4e-8b4f-4fbe-82f8-25a5619d5d7a), [Strava](https://mobbin.com/screens/a6c097b2-652c-4483-900d-af2421dd13da), [Apple Fitness](https://mobbin.com/screens/35c82e3b-a43e-47c5-ae01-573f85d5a8ba) | A grey track with a raised white thumb; the active tab uses accent colour plus a filled indicator, never hue alone |

## 2. Design principles and tokens

- Neutral zinc surfaces and **one accent for actions only**. The accent stays LoadWise green (from the Figma V1 brand) rather than the teal the Mobbin synthesis suggested, so the brand carries over.
- Status colours (success, warning, danger) appear only in flags and pills, always with an icon or text.
- Numbers are the hero: one big value per card with a muted label and baseline. Tabular figures.
- Hairline borders, not shadows. One primary action per screen.
- Plain-language, decision-support wording: reasons with value and threshold, never predictions or advice.

**Type scale** (Inter): display 40/44 semibold, title 28/34 bold, heading 20/26 semibold, subheading 17/22 semibold, body 15/22, small 13/18, caption 12/16 uppercase with tracking.

**Spacing** (4 pt base): 4, 8, 12, 16, 20, 24, 32, 40. **Radius:** sm 6, md 10, lg 14, full. **Touch targets:** at least 44×44 pt; score buttons 48 pt.

**Contrast:** the subagent computed WCAG ratios for its proposed pairs with a luminance script (e.g. zinc-500 `#71717A` on white 4.83:1; `#A1A1AA` on white fails at 2.56:1). The colours actually used are listed in `tokens.ts`. **Every screen still needs a real accessibility check before anyone calls it WCAG 2.2 AA (NFR 1).**

## 3. Styling approach

See DL-033. Summary: keep React Native `StyleSheet` and rebuild the tokens and primitives by hand in
shadcn/ui's style, rather than adopting react-native-reusables with NativeWind, Tamagui, gluestack or
Unistyles. Those options need new Babel, Metro or Jest configuration, and none has published Expo SDK
58 or jest-expo verification (NativeWind v5 was still a release candidate tested on SDK 57, checked
28 Nov 2026). The full comparison table and sources are in DL-033.
