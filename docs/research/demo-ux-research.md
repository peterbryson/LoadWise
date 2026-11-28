# Competitor and UX research for the January demo

Drafted by a Claude Code research subagent overnight on 28 Nov 2026, at Peter's request ("do some
deep research on how to improve the app and how to have a fully working app to demo for january").
**Not yet reviewed by Peter.** It extends `competitor-comparison.md` (#38) and does not replace it.

All URLs were accessed on 28 Nov 2026. The subagent used web search and page fetches. Some claims
come from vendor marketing, app-store listings or abstracts rather than full papers or hands-on use;
these are marked "vendor claim" or "abstract only". Anything not confirmed is marked **not verified**.
No product was installed. Two pages could not be fetched: PMC7534939 (captcha) and a UCD Gaelic games
thesis (HTTP 405).

## 1. Competitor comparison

| Product | Target user | Price and access for an amateur club | Athlete daily check-in | Coach squad view | Multi-team athletes | Consent and privacy |
|---|---|---|---|---|---|---|
| **Kitman Labs iP** | Pro teams, leagues, governing bodies, colleges, defence [1][2] | Enterprise quote only [1][3]. Athlete app works only inside a subscribing organisation [4] | Structured forms for wellness, pain and symptoms on mobile, web or kiosk [5]; reminders [4]. Item count **not verified** | Availability, screening compliance and alarms with the triggering data [6] | **Not verified** | Organisation-controlled; athlete-held consent **not verified** |
| **Catapult AMS / One** | AMS: elite and college [7]. One: GPS for individuals and grassroots [8] | AMS **not verified**. One: US$14.99/month or $179.99/year [8]; A$227.99/year One Team [9] | Team-chosen metrics; optional "Are you injured?" / "Do you feel unwell?" expand on yes [10][11]. Reminders skip athletes who have submitted [10] | Flagged answers on nominated staff dashboards; in-app message [10] | Staff scoped to groups [12]; not athlete-side | Admin-set permissions [11] |
| **Teamworks AMS (Smartabase)** | Elite, college, military [13] | **Not verified** | Configurable forms with sliders and body charts [13][14]; offline added later [14] | Configurable dashboards; alerts [13] | Staff switch between organisations [13] | SSO, MFA [13]; consent model **not verified** |
| **TeamBuildr** | US school and college S&C | Silver US$90/month (≤50 athletes); AMS add-on $50/month [15] | Questionnaires included [15]; details **not verified** | **Not verified** | **Not verified** | **Not verified** |
| **BridgeAthletic** | Team S&C programming | App free; team price **not verified** [16] | Readiness survey before a session [16] | Tablet programme management [16] | **Not verified** | Health data may be linked to identity (App Store label) [16] |
| **CoachMePlus** | US college and pro S&C | US$1,000/year (≤250) to $2,500/year (≤500) [17] | Fatigue, sleep, soreness, mood, stress, 1 to 5, "under a minute" (vendor claim) [18] | Colour-coded outliers; vendor advises a conversation if a score drops >1.5 SD below baseline [18] | **Not verified** | **Not verified** |
| **Metrifit** | Team and individual sport; used in Gaelic football research [19] | **Not verified**; website now shows only a blog [20] | Daily questionnaire feeding a configurable "readiness to train" score [19][21] | Traffic-light report (vendor slides) [21] | **Not verified** | **Not verified** |
| **AthleteMonitoring.com** | Pro, elite, youth, schools [22] | Quote-based; free staff accounts [22] | Customisable morning questionnaire [23] | Team risk and readiness dashboard; ACWR, monotony, strain [23][24] | **Not verified** | "GDPR & HIPAA compliant" (vendor claim) [22] |
| **RYPT** | Grassroots to Olympic; 22 counties and 300+ GAA, LGFA and Camogie units [25] | Free to county teams under a GAA deal (30 May 2025); club price **not verified** [25] | Internal and external load and wellbeing [26] | **Not verified** | **Not verified** (most relevant for dual club and county players) | **Not verified** |
| **Sportlyzer** | Youth and amateur clubs [27] | Free base plan; about €1,000/year full (third-party claim) [27] | Training diary; sickness or injury entry alerts the coach [28] | Attendance and plans | **Not verified** | Athlete chooses diary fields [28] |
| **Output Sports** | Pro to school teams, gyms, physios [29] | Sensor plus subscription; quote [29] | Daily wellbeing and sleep self-report [29] | Readiness dashboards (third-party listing) [30] | **Not verified** | **Not verified** |
| **WHOOP** (consumer) | Individuals | Subscription | Journal of 300+ behaviours; advises tracking 10 or fewer [31] | n/a; 1 to 99% recovery score [31] | n/a | Personal |
| **Oura** (consumer) | Individuals | Not checked | Passive readiness from contributors with 14-day baselines [32] | n/a | n/a | Personal |
| **Garmin Training Readiness** | Individuals | With compatible watches | Passive [33] | n/a; 1 to 100 in five labelled bands [33] | n/a | Personal |
| **Strava** | Individuals | RPE free [34] | Perceived Exertion slider 1 to 10, Easy to Max Effort [34] | n/a | n/a | Personal |
| **TrainingPeaks** | Endurance athletes and coaches | Not checked | Post-workout RPE 0 to 10 plus "Feeling" icon [35]; optional sleep, soreness, stress [36] | Coach sees RPE and Feeling trends over 90 days [37] | n/a | Coach-athlete pairing |
| **Daylio** | Individuals | Freemium [38] | Five-face mood scale plus activity icons, "no writing" [38][39] | n/a | n/a | Personal |
| **Bearable** | Individuals | Free with IAP [40] | Mood, energy, sleep, symptoms in a few taps [40] | n/a; correlations, "not medical advice" [40] | n/a | Personal |

### Observations

1. **Elite-first pricing.** The richest products are sold on enterprise quotes [3][4][22]. Published team prices (US$90/month to US$2,500/year) target US school and college S&C budgets [15][17].
2. **RYPT is the key local competitor.** It is free to GAA county teams and used by 300+ GAA units [25]. LoadWise should not claim to be the only option for GAA. Its defensible difference is the athlete-centred, multi-team view; whether RYPT offers one is **not verified** either way and Peter should check.
3. **Multi-team athletes are handled from the staff side, if at all** [12][13]. No vendor documentation was found of one athlete-held load history shared with several independent squads under per-squad consent. The need is documented: a GAA minor review found leading young players training "12 times in 9 days" and possibly on 10 teams [41]; the GPA has called for a competition load policy [42].
4. **Consent is team-centric.** Coaches are the main recipients of athlete data and athletes see it at coaches' discretion [43]. The Australian AMS asks for consent per record [44]. Per-squad, athlete-controlled, revocable consent is a real differentiator.
5. **Opaque composite scores are the norm** [21][31][32][33], and there is no standard for traffic-light systems [45]. LoadWise's reason, value and threshold on every flag is a transparency advantage.
6. **Check-ins converge on about five items scored 1 to 5** (fatigue, sleep, soreness, stress, mood) [18][23][46][47], which supports LoadWise's current items.

**Gap LoadWise fills:** an affordable, athlete-owned app for amateur multi-team athletes that combines
load across every team, gives each squad explicit revocable consent, and shows each squad's staff a
transparent baseline-relative flag rather than an opaque readiness score, within decision support.

## 2. Fast daily logging and adherence

| Finding | Source | Implication |
|---|---|---|
| Subjective measures tracked load more sensitively and consistently than objective ones (56 studies) | Saw, Main & Gastin 2016 [48] (abstract) | Justifies a self-report-first MVP |
| Compliance depends on the measure (timing, access) and the social environment (buy-in) | Saw et al. 2015a [49] | Coach engagement matters as much as the form |
| Coach-supported team athletes: 84 ± 21% compliance over 16 weeks; self-directed: 8 ± 18% | Saw et al. 2015b [50] | Coach nudges and feedback to athletes are essential |
| Sliders (VAS) gave similar answers but more missing data and longer completion | Couper et al. 2006 [51] (abstract) | Prefer discrete tap buttons |
| Session RPE × minutes is a valid load measure | Foster 2001 [52]; Haddad 2017 [53] | Supports #4 |
| Mobile EMA compliance 81.9%, linked to prompts per day and items per prompt | Williams et al. 2021 [54] | One daily prompt, few items |
| Individualised reminders improved mHealth adherence | Jakob et al. 2022 [55] | A reminder at a chosen time is worth building |
| Gamification evidence mixed; loss framing may backfire | [56] (abstract only) | Gentle consistency indicator, no "you broke it" |
| World Rugby: six items, 1 to 5 with 5 = best, compared with the athlete's own previous scores; a low score means a conversation | World Rugby Passport [46] | Governing-body precedent for baseline-relative, conversation-first wording |
| WCAG 2.2 SC 2.5.8: targets ≥24×24; 44×44 recommended (2.5.5) | W3C [57] | Scale buttons ≥44 pt |

## 3. Coach dashboard patterns

| Pattern | Seen in |
|---|---|
| Who has or hasn't completed today's check-in | Kitman Coach [6]; Catapult reminders [10] |
| Manual nudge to team or individual | Catapult AMS [11] |
| Flag shown with its triggering data | Kitman [6]; Catapult [10] |
| Colour-coded outliers against own baseline (never colour alone) | CoachMePlus [18]; Metrifit [21]; AthleteMonitoring [23] |
| Status bands with plain-language labels | Garmin [33] (avoid its prescriptive wording) |
| Academic basis for visualisation and meaningful change | Thornton et al. 2019 [58]; Robertson et al. 2017 [45] |

Suggested phone layout for squads under about 40 (synthesis, not measured): a summary strip
("18/24 logged · 3 flags"), flagged athletes first with a reason chip, then not-logged athletes,
then OK athletes, each opening a consented drill-down.

## 4. Prioritised recommendations

Effort: S < 1 day, M 1 to 3 days, L > 3 days (rough).

| # | Recommendation | Inspired by | Story | Effort |
|---|---|---|---|---|
| 1 | Squad overview sorted by need with a summary strip; text and icon next to colour | [6][18][45] | #10, #50 | M |
| 2 | "Not logged today" list with a nudge action | [10][11][50] | new issue | M |
| 3 | Flag cards always show reason, value, threshold and baseline window, worded as "worth a conversation" | [18][46] | #9, #12 | S |
| 4 | One-screen wellness check-in, five items, large 1 to 5 tap buttons with word anchors, no sliders, no preselection | [51][46][39] | #5 | S–M |
| 5 | Daily reminder at a chosen time, skipped if already logged | [10][55] | new issue | M |
| 6 | Session log with anchored RPE scale, duration chips and live load preview | [34][35][52] | #4 | S |
| 7 | Feedback to the athlete after submitting (7-day load, sleep vs baseline) | [37][49][50] | #7 | M |
| 8 | Combined-load breakdown by team | gap analysis; [41][42] | #8 | M |
| 9 | Per-squad consent screen listing what each role can see, one-tap withdraw | [43][44] | #3 | M |
| 10 | Optional "Any pain or injury?" with physio or GP referral, no load advice | [11]; LoadWise rules | #13 | S–M |
| 11 | Offline entry with a visible "Saved, will sync" state | [14] | #6 | M–L |
| 12 | Measure check-in duration (no health data in the metric) to evidence NFR 1 | NFR 1; [18] | NFR 1 | S |
| 13 | No composite readiness score in the MVP; record as a decision | [21][31][32][33][59] | decision log | S |
| 14 | Gentle consistency indicator ("Logged 5 of the last 7 days") | [39][56] | new issue | S |
| 15 | Touch targets ≥44 pt and labels on all scale buttons; check before claiming WCAG | [57] | NFR 1 | S |
| 16 | Realistic synthetic demo squad (~20 athletes, ~8 weeks) with a multi-team athlete, a spike, a wellness dip, a non-logger and a withdrawn consent | rubric; CLAUDE.md | demo prep | M |
| 17 | Label thresholds as configurable hypotheses, citing the debate | [59][60][61][62] | #9, #12 | S |

None of these diagnose, predict injury or prescribe training; 3, 10, 13 and 17 reinforce the boundary.

## 5. Points for Peter's judgement

- RYPT's GAA deal [25] weakens any "nothing exists for GAA" argument. Check its multi-team handling yourself before claiming it lacks one.
- Metrifit's status is unclear [20].
- ACWR threshold evidence is contested [59][61][62]; keep "configurable hypothesis" wording.
- Several entries are vendor claims; cite them as claims.

## References (accessed 28 Nov 2026)

1. Kitman Labs, Leagues & governing bodies. https://kitmanlabs.com/sports-management-software/leagues-governing-bodies
2. IntuitionLabs, Kitman Labs listing. https://intuitionlabs.ai/software/sports-medicine-athletic-training/athletic-performance-testing/kitman-labs-performance
3. AWS Marketplace, Kitman Labs. https://aws.amazon.com/marketplace/pp/prodview-jq4kseixao3ci
4. App Store, Kitman Labs Athlete. https://apps.apple.com/us/app/kitman-athlete/id941173941
5. Kitman Labs marketing page. https://www.kitmanlabs.com/?p=42755
6. App Store, Kitman Labs Coach. https://apps.apple.com/us/app/-/id1215705987
7. Catapult, AMS wellness measures. https://www.catapult.com/blog/ams-wellness-measures-athlete-wellbeing
8. Catapult US store. https://us-store.catapultsports.com/pages/subscribe
9. iTWire, Catapult One launch. https://itwire.com/your-it-news/mobility/catapult-one-tracks-athletes%E2%80%99-performance-to-improve-their-power-and-speed
10. Catapult, AMS wellness measures helping to track athlete wellbeing. https://www.catapult.com/blog/ams-wellness-measures-athlete-wellbeing
11. Catapult, AMS v2.25 release. https://www.catapult.com/blog/ams-by-catapult-update
12. Catapult, Baylor multiple teams case study. https://www.catapult.com/?p=1132
13. Teamworks, Smartabase new mobile app. https://teamworks.com/blog/smartabase-new-mobile-app/
14. App Store, Teamworks AMS. https://apps.apple.com/us/app/teamworks-ams/id1639825572
15. TeamBuildr pricing. https://www.teambuildr.com/pricing
16. App Store, BridgeAthletic. https://apps.apple.com/us/app/id1024299963
17. CoachMePlus pricing. https://coachmeplus.com/pricing/
18. CoachMePlus, The underused tool in sports performance. https://coachmeplus.com/underused-tool-in-sports-performance/
19. Springer, Gaelic football readiness-to-train study. https://link.springer.com/doi/10.1007/s11332-020-00667-x
20. Metrifit. https://www.metrifit.com
21. Metrifit functionality overview (SlideShare). https://www.slideshare.net/slideshow/metrifit-functionality-overview/58619077
22. AthleteMonitoring pricing. https://www.athletemonitoring.com/pricing
23. AthleteMonitoring wellness monitoring. https://www.athletemonitoring.com/?p=24907
24. AthleteMonitoring feature list (Jul 2025). https://www.athletemonitoring.com/wordpress/wp-content/uploads/2025/11/20250731-FEATURE-LIST-ATHLETEMONITORING.pdf
25. GAA, GAA and RYPT announce partnership (30 May 2025). https://www.gaa.ie/article/gaa-and-rypt-announce-partnership
26. App Store, RYPT. https://apps.apple.com/ie/app/rypt/id982834567
27. Capterra, Sportlyzer. https://capterra.com/p/144279/Sportlyzer/
28. Sportlyzer Help, training diary. https://intercom.help/sportlyzer/en/articles/82917-getting-started-with-the-training-diary
29. Output Sports. https://www.outputsports.com
30. IntuitionLabs, Output Sports. https://intuitionlabs.ai/software/sports-medicine-athletic-training/athletic-performance-testing/output-sports
31. WHOOP Journal. https://whoop.com/thelocker/the-whoop-journal
32. Oura Support, Readiness Score. https://support.ouraring.com/hc/en-us/articles/360057791533
33. Garmin manual, Training Readiness. https://www8.garmin.com/manuals/webhelp/GUID-9D99A9D4-467A-4F1A-A0EA-023184FEA3DD/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html
34. Strava Support, Perceived Exertion. https://support.strava.com/en-us/articles/15401767-perceived-exertion
35. TrainingPeaks, RPE and subjective feedback. https://www.trainingpeaks.com/learn/articles/what-are-rpe-and-subjective-feedback/
36. TrainingPeaks Help, available metrics. https://help.trainingpeaks.com/hc/en-us/articles/360025290131-What-Metrics-Are-Available-on-TrainingPeaks-
37. TrainingPeaks Help, Athlete Home insights. https://help.trainingpeaks.com/hc/en-us/articles/41077784209165-Athlete-Home-Performance-Insights
38. Google Play, Daylio. https://play.google.com/store/apps/details?id=net.daylio
39. Wikipedia, Daylio. https://en.wikipedia.org/wiki/Daylio
40. Bearable. https://bearable.app/
41. Irish Times, Forced to do too much too young. https://www.irishtimes.com/sport/forced-to-do-too-much-too-young-1.972311
42. Irish Times, GPA calls for competition load policy (22 Feb 2024). https://www.irishtimes.com/sport/gaelic-games/2024/02/22/gpa-calls-for-competition-load-policy-for-male-players-to-counteract-player-burnout
43. Stenger & Feng (2024) Information flows for athletes' health and performance data. https://arxiv.org/html/2412.05055v4
44. AUSPORT Sports Intel, selective sharing. https://support.sportsintel.ausport.gov.au/hc/en-us/articles/12850588722319
45. Robertson, Bartlett & Gastin (2017) Red, amber, or green? https://lida.sport-iat.de/ta/Record/4048177?lng=en
46. World Rugby Passport, screening tools. https://passport.world.rugby/conditioning-for-rugby/conditioning-for-female-rugby-players/movement-skills-warm-ups-and-screening-tools/effective-preparation/screening-tools/
47. Hooper et al. (1995), secondary summary. https://coachsci.sdsu.edu/csa/vol13/hooper2.htm
48. Saw, Main & Gastin (2016) BJSM 50(5):281–291. https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708
49. Saw, Main & Gastin (2015) JSSM 14:137–146. https://pmc.ncbi.nlm.nih.gov/articles/PMC4306765
50. Saw, Main & Gastin (2015) JSSM 14:732–739. https://jssm.org/jssm-14-732.xml-Fulltext
51. Couper et al. (2006) SSCR 24(2):227–245. https://scilit.com/publications/8388612f15b174ef335ca55053ba1ea5
52. Foster et al. (2001) JSCR 15(1):109–115. https://pubmed.ncbi.nlm.nih.gov/11708692/
53. Haddad et al. (2017) Front. Neurosci. https://www.frontiersin.org/articles/10.3389/fnins.2017.00612/full
54. Williams et al. (2021) JMIR 23(3):e17023. https://www.jmir.org/2021/3/e17023
55. Jakob et al. (2022) JMIR 24(5):e35371. https://jmir.org/2022/5/e35371
56. Crossref, 2026 RCT on gamification and adherence. https://api.crossref.org/works/10.1007%2FS41666-025-00216-6
57. W3C, Understanding SC 2.5.8. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
58. Thornton et al. (2019) IJSPP 14(6):698–705. https://vuir.vu.edu.au/38606/
59. Impellizzeri et al. (2020) IJSPP 15:907–913. https://opus.lib.uts.edu.au/handle/10453/141898
60. Gabbett (2016) BJSM 50(5):273–280. https://bjsm.bmj.com/content/50/5/273.abstract
61. Williams et al. (2017) BJSM 51(3):209–210. https://pubmed.ncbi.nlm.nih.gov/27650255/
62. Murray et al. (2017) BJSM 51(9):749–754. https://acuresearchbank.acu.edu.au/item/8qv67/calculating-acute-chronic-workload-ratios-using-exponentially-weighted-moving-averages-provides-a-more-sensitive-indicator-of-injury-likelihood-than-rolling-averages
