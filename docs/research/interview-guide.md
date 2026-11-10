# LoadWise interview guides

Semi-structured interview guides for athletes, coaches and S&C coaches, and physios (GitLab #37).
Master copy for the ethics application (#33) and the interviews (#41). Peter keeps the working Word
document, `LoadWise Interviews.docx`, which also holds the pilot record, interview log, findings and
per-interview record sheets. Those stay out of the repository because they will contain participant
data. Only anonymised findings come into the repository, through `docs/requirements-changes.md` and
the issue log.

- Status: agreed by Peter on 10 Nov 2026; not yet piloted or ethically approved.
- Drafted with Claude Code at Peter's request (see `docs/ai-usage-log.md`); method choices are Peter's.

## 1. Research goals

Every question in the guides should trace back to one of these goals. The right-hand column lists the questions that cover each goal.

| # | What I need to find out                                                          | Feeds into                                      | Covered by questions           |
|--------|--------------------------------------------------------------------------------------|-----------------------------------------------------|------------------------------------|
| G1     | How athletes and staff track training load and wellness today, if at all             | Ch1 problem and context; competitor table (#38)     | A3, A4, C2, C3, C4, P1, P2, P7     |
| G2     | What makes logging stick or get abandoned                                            | #4, #5, NFR 1.1 (60 s daily log), reminders (#22) | A3, A8, C4, C11, P7, P10           |
| G3     | Playing for several teams: how many squads, and who knows what each athlete is doing | #3, #8                                            | A1, A2, A5, C1, C3, C6, P4         |
| G4     | What athletes are comfortable sharing, and with whom                                 | Consent model (#3, #11), NFR 2                     | A4, A6, A7, C8, P3, P6             |
| G5     | What coaches and physios would act on, and how quickly                               | Flags (#9), squad overview (#10)                    | A5, A9, C2, C5, C7, C9, P2, P3, P5 |
| G6     | How far an AI explanation would be trusted                                           | #12, #15                                          | A9, C10, P8, P9                    |
| G7     | \[Add any other goal\]                                                               | \[ \]                                               | \[ \]                              |

## 2. Method

| Item                   | Detail                                                                                                                  |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Format                     | Semi-structured interviews: prepared core questions with follow-up prompts                                                  |
| Length                     | 10-15 minutes                                                                                                               |
| Mode                       | In Person/Teams                                                                                                             |
| Participants               | 3 athletes, 2 coaches, 1 physio. Adults (18+) only                                                                          |
| Recruitment                | Teammates, own club coaches and physio                                                                                      |
| Inclusion criteria         | Amateur athlete, coach or physio part of at least one team                                                                  |
| Consent                    | Participant information sheet and signed consent form before the interview (see ethics application #33)                    |
| Recording                  | Audio recorded with consent                                                                                                 |
| Anonymisation              | Participants identified by code only: A1, A2… (athletes), C1… (coaches), P1… (physios). No names in notes or the repository |
| Data storage and retention | Recordings are stored on personal OneDrive and deleted once the relevant information is extracted                           |
| Sensitive topics avoided   | No questions about specific injuries, diagnoses or medical history: only how training and recovery are managed              |
| Ethics approval            | \[Reference number and date once approved\]                                                                                 |

## 3. Interview guide: athletes

| Item                        | Detail                                                                         |
|---------------------------------|------------------------------------------------------------------------------------|
| Participant codes               | A1, A2, A3                                                                         |
| Target length                   | 10 minutes                                                                         |
| Figma screens to show in part 6 | Log session; Today (Flagged state); Why this was flagged                           |
| Timing tip                      | About 1 minute per question. Skip the "if time" questions if you are running over. |

### Part 1: Introduction and consent

About 1 minute.

| Script (read to every participant)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Thanks for taking part. I'm Peter, a final-year software engineering student at Queen's. For my project I'm building an app to help amateur athletes manage training load. Before I build more of it, I want to understand how things work for you now. This takes about 10 minutes. There are no right or wrong answers, and I'm interested in your real experience. With your permission I'll record the audio so I can take accurate notes; you won't be named anywhere, only a code like A1. Please don't share details of any specific injuries or medical conditions, yours or anyone else's. You can skip any question or stop at any time. Are you happy to start, and happy for me to record? |

### Part 2: Background

| # | Question                                                                               | Follow-up prompts                                       | Goal |
|--------|--------------------------------------------------------------------------------------------|-------------------------------------------------------------|----------|
| A1     | What sport do you play, and how many teams are you training or playing with at the moment? | How many sessions is that in a typical week, including gym? | G3       |

### Part 3: Current practice

| # | Question                                                                                | Follow-up prompts                                                  | Goal |
|--------|---------------------------------------------------------------------------------------------|------------------------------------------------------------------------|----------|
| A2     | Walk me through last week: what training, matches and gym did you do?                       | Did anyone know about all of it? Who?                                  | G3       |
| A3     | Do you keep track of your training, or of how you're feeling, in any way? Tell me about it. | If you've used an app or notes before and stopped, what made you stop? | G1, G2   |

### Part 4: Pain points

Ask for recent, specific examples. Do not ask about injuries.

| # | Question                                                                                                          | Follow-up prompts                      | Goal |
|--------|-----------------------------------------------------------------------------------------------------------------------|--------------------------------------------|----------|
| A4     | Tell me about the last time you felt run-down, sore or tired going into a session or match. What did you do about it? | Did you tell anyone? Why, or why not?      | G1, G4   |
| A5     | (If time) Has there been a time when training for two teams added up to too much? What happened?                      | How did the coaches find out, if they did? | G3, G5   |

### Part 5: Data sharing and privacy

| # | Question                                                                                                    | Follow-up prompts                           | Goal |
|--------|-----------------------------------------------------------------------------------------------------------------|-------------------------------------------------|----------|
| A6     | Who would you be happy to see how much you're training and how you're feeling? Who wouldn't you want to see it? | Would that be different for each of your teams? | G4       |
| A7     | (If time) What would make you stop sharing that kind of information?                                            | What would make you trust it more?              | G4       |

### Part 6: Reaction to the concept

Only now introduce LoadWise. Show the screens listed above.

| # | Question                                                                                        | Follow-up prompts                                                     | Goal |
|--------|-----------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|----------|
| A8     | \[Show Log session\] If you had to fill this in after training, what would get in the way?          | When and where would you realistically do it? How long would you give it? | G2       |
| A9     | \[Show Today (Flagged) and Why this was flagged\] What do you make of this? What would you do next? | Would you trust it more or less if an AI wrote the explanation? Why?      | G5, G6   |

### Part 7: Close

| # | Question                                                                     | Follow-up prompts                   | Goal |
|--------|----------------------------------------------------------------------------------|-----------------------------------------|----------|
| A10    | Is there anything about how you manage your training that I haven't asked about? | Can I contact you later to try the app? | All      |

## 4. Interview guide: coaches and S&C coaches

| Item                        | Detail                                                                                           |
|---------------------------------|------------------------------------------------------------------------------------------------------|
| Participant codes               | C1, C2                                                                                               |
| Target length                   | 15 minutes                                                                                           |
| Figma screens to show in part 6 | Today (Flagged state); Why this was flagged. Describe the squad overview verbally (not designed yet) |
| S&C coaches                     | Ask the same questions about gym programmes and conditioning sessions                                |

### Part 1: Introduction and consent

About 1 minute.

| Script (read to every participant)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Thanks for taking part. I'm Peter, a final-year software engineering student at Queen's. For my project I'm building an app to help amateur athletes and coaches manage training load. Before I build more of it, I want to understand how things work for you now. This takes about 15 minutes. There are no right or wrong answers, and I'm interested in your real experience. With your permission I'll record the audio so I can take accurate notes; you won't be named anywhere, only a code like C1. Please don't share details of any specific injuries or medical conditions, yours or anyone else's. You can skip any question or stop at any time. Are you happy to start, and happy for me to record? |

### Part 2: Background

| # | Question                                                                  | Follow-up prompts                                       | Goal |
|--------|-------------------------------------------------------------------------------|-------------------------------------------------------------|----------|
| C1     | What's your role, and which team or teams do you coach? How big is the squad? | Roughly how many of your players also play for other teams? | G3       |

### Part 3: Current practice

| # | Question                                                                               | Follow-up prompts                            | Goal |
|--------|--------------------------------------------------------------------------------------------|--------------------------------------------------|----------|
| C2     | How do you plan training load across a week, especially around matches?                    | What information do you base those decisions on? | G1, G5   |
| C3     | How do you currently find out how players are feeling, or how much they've done elsewhere? | Do you record any of it? Where?                  | G1, G3   |
| C4     | (If time) Have you tried any tool or app for tracking players? What happened with it?      | Why did players keep using it, or stop?          | G1, G2   |

### Part 4: Pain points

Ask for recent, specific examples. Do not ask about any player's injuries.

| # | Question                                                                                                   | Follow-up prompts                            | Goal |
|--------|----------------------------------------------------------------------------------------------------------------|--------------------------------------------------|----------|
| C5     | Tell me about the last time you found out a player was overloaded or run-down. How did you find out, and when? | What would you have done if you'd known earlier? | G5       |
| C6     | When a player is on two or three teams, how do you work with the other coaches?                                | What gets in the way?                            | G3       |

### Part 5: Data sharing and privacy

| # | Question                                                                               | Follow-up prompts                                            | Goal |
|--------|--------------------------------------------------------------------------------------------|------------------------------------------------------------------|----------|
| C7     | What information about a player would actually change a decision you make before training? | How soon would you need it: the night before, or the morning of? | G5       |
| C8     | What player information do you think coaches shouldn't see?                                | Who should decide that: the player, the physio, or you?          | G4       |

### Part 6: Reaction to the concept

Only now introduce LoadWise. Show the screens listed above, then describe a squad overview: every player's status and flags on one screen.

| # | Question                                                                        | Follow-up prompts                            | Goal |
|--------|-------------------------------------------------------------------------------------|--------------------------------------------------|----------|
| C9     | If you saw a flag like this for one of your players, what would you do?             | What would make you ignore it?                   | G5       |
| C10    | (If time) If an AI wrote a weekly summary of your squad, what would you want in it? | What would make you not trust it?                | G6       |
| C11    | What would stop your squad from using something like this?                          | Time, cost, players' phones, worries about data? | G2       |

### Part 7: Close

| # | Question                                                                    | Follow-up prompts                   | Goal |
|--------|---------------------------------------------------------------------------------|-----------------------------------------|----------|
| C12    | Is there anything about managing your players' load that I haven't asked about? | Can I contact you later to try the app? | All      |

## 5. Interview guide: physios

| Item                        | Detail                                                                             |
|---------------------------------|----------------------------------------------------------------------------------------|
| Participant codes               | P1                                                                                     |
| Target length                   | 15 minutes                                                                             |
| Figma screens to show in part 6 | Why this was flagged                                                                   |
| Reminder                        | Do not record any player's injury or medical details, even if the physio mentions them |

### Part 1: Introduction and consent

About 1 minute.

| Script (read to every participant)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Thanks for taking part. I'm Peter, a final-year software engineering student at Queen's. For my project I'm building an app to help amateur athletes and their staff manage training load. Before I build more of it, I want to understand how things work for you now. This takes about 15 minutes. There are no right or wrong answers, and I'm interested in your real experience. With your permission I'll record the audio so I can take accurate notes; you won't be named anywhere, only a code like P1. Please don't share details of any specific injuries or medical conditions, yours or anyone else's. You can skip any question or stop at any time. Are you happy to start, and happy for me to record? |

### Part 2: Background

| # | Question                                                                        | Follow-up prompts                         | Goal |
|--------|-------------------------------------------------------------------------------------|-----------------------------------------------|----------|
| P1     | What's your role with the team, and how much time do you spend with them each week? | How many squads or players do you look after? | G1       |

### Part 3: Current practice

| # | Question                                                                             | Follow-up prompts                  | Goal |
|--------|------------------------------------------------------------------------------------------|----------------------------------------|----------|
| P2     | How do you currently find out that a player is struggling with load or recovery?         | How often do you find out too late?    | G1, G5   |
| P3     | When you set training restrictions for a player, how do you share them with the coaches? | How do you know they've been followed? | G4, G5   |

### Part 4: Pain points

Ask for recent, specific examples, without any player's medical details.

| # | Question                                                                                                  | Follow-up prompts                       | Goal |
|--------|---------------------------------------------------------------------------------------------------------------|---------------------------------------------|----------|
| P4     | Tell me about a recent time when training on another team affected a player's recovery. How did you find out? | What would have helped you find out sooner? | G3       |
| P5     | What information do you want before a player goes back to full training, and where does it come from now?     | What's usually missing?                     | G5       |

### Part 5: Data sharing and privacy

| # | Question                                                                           | Follow-up prompts                                    | Goal |
|--------|----------------------------------------------------------------------------------------|----------------------------------------------------------|----------|
| P6     | What information should coaches be able to see, and what must stay with medical staff? | What about wellness scores like sleep, soreness or mood? | G4       |
| P7     | How reliable do you find athletes' own reports of how they feel?                       | What makes them more or less honest?                     | G1, G2   |

### Part 6: Reaction to the concept

Only now introduce LoadWise. Show Why this was flagged.

| # | Question                                                          | Follow-up prompts           | Goal |
|--------|-----------------------------------------------------------------------|---------------------------------|----------|
| P8     | Could an athlete read anything here as medical advice?                | What would you change?          | G6       |
| P9     | If an athlete told the app they were in pain, what should the app do? | Who should they be referred to? | G6       |
| P10    | (If time) What would stop you or the club using a tool like this?     |                                 | G2       |

### Part 7: Close

| # | Question                                                          | Follow-up prompts                               | Goal |
|--------|-----------------------------------------------------------------------|-----------------------------------------------------|----------|
| P11    | Is there anything about load and recovery that I haven't asked about? | Can I contact you later to check the app's wording? | All      |

## Appendix A: question checklist

Check every question against this list before the pilot.

| Check                                                                                         | Done |
|---------------------------------------------------------------------------------------------------|----------|
| Asks about past behaviour ("Tell me about the last time…"), not hypotheticals ("Would you use…?") | [ ]        |
| Open question (how, what, tell me about), not yes/no                                              | [ ]        |
| Does not lead the participant towards an answer                                                   | [ ]        |
| Does not mention LoadWise before Part 6                                                           | [ ]        |
| Maps to at least one research goal (G1–G7)                                                        | [ ]        |
| Does not ask about specific injuries, diagnoses or medical history                                | [ ]        |
| Each guide fits in the target length when piloted                                                 | [ ]        |
