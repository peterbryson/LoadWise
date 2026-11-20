# Competitor comparison (Ch1)

Drafted by Claude Code at Peter's request, 20 Nov 2026; Peter to check. Task #38.

Every fact in the first table comes from the numbered source in that cell, read on 20 Nov 2026.
"Not stated" means the source did not say, not that the product lacks the feature. Prices are as
listed on the day, in the currency shown, and change often. The pros and cons in the second table
are analysis against LoadWise's aims, not findings from users.

## What each product does

| Product | Type and target users | Load metrics | Wellness | Flags and how they are explained | Several teams, sharing and consent | AI | Offline logging | Price |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Catapult** (AMS, Vector, Catapult One) | GPS wearables (Vector) and an athlete management system (AMS). Vector Pro is its premier product; Catapult One is "for high school and youth level coaches and athletes" [2]. The AMS example is a professional rugby side [1] | ACWR charts in its OpenField software, with team-set acute and chronic windows [3]. Daily RPE after training in AMS [1] | Team-chosen wellness questions, plus "Are you injured?" and "Do you feel unwell?" [1] | Injury or illness reports flag the player on nominated staff dashboards [1] | Not stated | Not stated | Not stated | Contact for pricing [2] |
| **STATSports** (Apex Coach Series, Academy) | GPS trackers. Coach Series is "developed with amateur teams in mind", aimed at amateur hurling and Gaelic football clubs [4] | Distance, speed and match and training load from GPS [4]. A Load view shows strain, intensity and RPE across the week [5] | Not stated [4] | Not stated | Squad comparisons in the coach app [4]. Consent not stated | Not stated | Not stated | Academy tracker £170 to £240 (sale prices), no subscription [5]. Coach Series: contact [4] |
| **Kitman Labs** (iP platform, Risk Advisor) | Performance and medical platform. Named clients are professional clubs, academies, universities and governing bodies such as the Premier League and IRFU [7] | Workload tracking from its Performance Optimization product [6] | Wellness inputs feed its injury-risk model [6] | Risk Advisor flags athletes at elevated daily injury risk with "clear contributing factors"; custom alerts against staff thresholds [6] | Player profiles transfer between clubs within a league [7]. Consent not stated | Machine-learning injury-risk model [6] | Not stated (forms on "mobile, kiosk, or web") [7] | Contact for pricing [6][7] |
| **Actimet** | Athlete app plus coach web portal, from an Irish company in Galway [8] | Training load planning in the coach portal; RPE on each activity [8] | Daily wellness, readiness and injury status; health questionnaire; menstrual cycle tracking [8] | Not stated | Not stated | Not stated | Not stated | App free; portal price not stated [8] |
| **PlayerPulse** | Coach and athlete app (PlayerPulse, Inc.) [9] | RPE combined with training data for workload tracking [9] | Daily mental and physical wellness and injury reports [9] | Team availability and readiness views [9] | Not stated | Not stated | Not stated | Free on the App Store [9] |
| **YouCoach** (Training Load Monitoring) | Coaching planner with a load module for "professional and non professional" coaches [10] | Session-RPE (CR-10) and ACWR, with week-to-week change [10] | Hooper Index: sleep, stress, fatigue, soreness [10] | Alerts when values leave set thresholds [10] | Not stated | Not stated | Not stated | Pro plan USD 54 a month billed yearly, or 77 monthly [10] |
| **WHOOP** | Wrist wearable and subscription for individuals [11] | Strain score from the wearable [11] | Recovery, sleep and stress scores [11] | Not stated | No team features listed [11] | WHOOP Coach, using OpenAI's GPT-4, answers questions from the member's own data (announced Sept 2023) [12] | Not stated | USD 199 to 359 a year [11] |
| **Strava** | Activity tracking app for individuals [13] | Relative Effort (heart rate or perceived exertion) and Fitness & Freshness, subscription only [13] | Not stated | Not stated | Club leaderboards and group challenges only; no team load features [13] | Athlete Intelligence: AI workout insights for subscribers (public beta from Oct 2024) [14] | Not stated | Subscription; price not stated on the source [13] |

## Pros and cons for LoadWise's users

Analysis by Claude Code, from the table above. LoadWise's users are amateur athletes and their
coaches and physios, often in several squads at once (club, county, college).

| Product | Pros | Cons |
| --- | --- | --- |
| Catapult | Mature load and wellness tools; ACWR built in; staff alerts | Priced by quote; the AMS and GPS products are built for funded teams; needs hardware for most load data |
| STATSports | Aimed at GAA clubs; objective GPS load; no subscription for the tracker | Each player needs a tracker; no wellness questionnaire stated; load is per device, not combined across squads |
| Kitman Labs | Explains its injury-risk flags with contributing factors; strong medical tools | Professional and governing-body market; priced by quote; not aimed at amateur athletes |
| Actimet | Irish; free athlete app; covers wellness, injury and RPE | Small user base (13 ratings); no stated flags or explanation; portal price unknown |
| PlayerPulse | Free; wellness, RPE and readiness in one app | Very new (6 ratings); no stated flag logic, multi-team support or consent controls |
| YouCoach | sRPE, ACWR, Hooper wellness and threshold alerts in one place | Load monitoring only on the Pro plan; a coach tool first, so the athlete is not the owner of the data |
| WHOOP | Polished individual recovery data; AI coach on the athlete's own data | Expensive for an amateur; no team or coach view; strain is not session-RPE load |
| Strava | Huge user base; free logging | Load metrics behind a subscription; endurance-focused; no squad or staff view |

## Gap LoadWise may address (hypothesis to test in interviews)

No product in this comparison states all of the following together: free or low cost for amateur
athletes without hardware; one athlete's load combined across several squads, with the athlete
controlling which squads' staff can see it; and flags that state their reason, value and threshold
in plain language. Kitman Labs explains its flags but targets professional teams; YouCoach and
Catapult compute ACWR but are coach-owned or quote-priced; the GAA-focused products (STATSports,
Actimet) do not state flag logic or multi-squad load. Whether amateur GAA athletes, coaches and
physios actually want this combination, and would use it daily, is a hypothesis for the interviews
(#41, `docs/research/interview-guide.md`), not a finding.

## Sources (all read 20 Nov 2026)

1. Catapult, "AMS by Catapult wellness measures helping to track athlete wellbeing". https://www.catapult.com/blog/ams-wellness-measures-athlete-wellbeing
2. Catapult, Pricing. https://www.catapult.com/pricing
3. Catapult Support, "How to Set Up an Acute:Chronic Workload Ratio Chart". https://support.catapultsports.com/hc/en-us/articles/360000538795-How-to-Set-Up-an-Acute-Chronic-Workload-Ratio-Chart
4. STATSports, "Apex Coach Series: bridging the gap between professional GPS analysis and the GAA". https://statsports.com/article/apex-coach-series-bridging-the-gap-between-professional-gps-analysis-and-the-gaa
5. STATSports UK shop, Academy GPS tracker. https://uk.shop.statsports.com/products/apex-athlete-series
6. Kitman Labs, "Intelligence built around injury risk". https://www.kitmanlabs.com/platform/sports-injury-software/
7. Kitman Labs, Platform (GB). https://www.kitmanlabs.com/gb/platform/
8. Apple App Store (Ireland), Actimet. https://apps.apple.com/ie/app/actimet/id1358448780
9. Apple App Store, PlayerPulse. https://apps.apple.com/app/playerpulse/id6480585691
10. YouCoach, Training Load Monitoring. https://www.youcoach.com/tlm
11. WHOOP, Membership. https://whoop.com/membership
12. WHOOP, "WHOOP unveils the new WHOOP Coach powered by OpenAI" (26 Sept 2023). https://www.whoop.com/us/en/press-center/whoop-unveils-the-new-whoop-coach-powered-by-openai/
13. Strava Support, "Strava subscription features". https://support.strava.com/en-us/articles/15402044-strava-subscription-features
14. the5krunner, "Strava Athlete Intelligence – now in beta for subscribers" (3 Oct 2024). https://the5krunner.com/2024/10/03/strava-athlete-intelligence-subscribers/
