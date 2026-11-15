# CareVault demo video script

- **Target length:** 2:00. Hard limit 3:00.
- **Spoken words:** 312.
- **Estimated runtime:** about 2:05 of speech at 150 words a minute, plus about 10 seconds where the screen needs time. Plan for 2:14. The cuts in "If we are running long" bring it to 2:00.
- **Product on screen:** from 0:38 to 1:46, which is just over half the video.
- **Voices:** four, labeled Voice 1 to Voice 4. With three people, Voice 1 also takes Voice 4's lines (the "So we built CareVault" turn, the share step, and leading the last line).
- **Statistics spoken:** three, each worded to match its source. The number in square brackets on screen points to the "Sources" list below.

## Filming notes

- Tripod, one mic, a plain background such as a brick wall. Speakers stand still. No walking.
- Cut between speakers. The mic pass happens between cuts, or one clean hand-off on camera at the points marked below.
- The camera flips on the line "So we built CareVault."
- Put each source label on screen for the whole time the number is being said.
- Record the screen once, slowly, following "Screen recording steps". Cut out the waiting time when editing, then record the voice-over against the edited picture.

## The script

| Time | Who | Says | On screen |
| --- | --- | --- | --- |
| 0:00 to 0:13 | Voice 1 | You see a doctor to catch problems early. But a UnitedHealthcare report on employer health plans found Gen Z and millennials are developing chronic conditions like diabetes and obesity earlier in life. | Voice 1 alone, standing still. Text: "Developing chronic conditions earlier in life." Label: "[1] UnitedHealthcare and Health Action Council, Feb 2026. 225,000+ employer-plan members." |
| 0:13 to 0:24 | Voice 2 | And you can't see the price first. Gallup found only 17 percent of U.S. adults say they know what their care will cost before they get it. | Cut to Voice 2 (mic pass). Big number: "17%". Label: "[2] Bentley-Gallup survey, 5,458 U.S. adults, 2023." |
| 0:24 to 0:36 | Voice 3 | So young people ask something else. In an Aflac survey of employed adults, 76 percent of Gen Z said they use AI for health support before seeking professional medical care. | Cut to Voice 3 (mic pass). Big number drops in on "76 percent": "76%". Label: "[3] Aflac Wellness Matters Survey, 2,000 employed U.S. adults, 2026." |
| 0:36 to 0:41 | Voice 4 | So we built CareVault. Health care without the guesswork. | Voice 4 says "So we built CareVault." The camera flips on that line. Cut to the landing page for the tagline, with the headline "Health care without the guesswork" and the live cost card in view. |
| 0:41 to 0:57 | Voice 2 (voice-over) | Maya thinks she has strep and has no idea what it costs. She picks a strep test and types her ZIP. She sees the estimated cost and likely range for her area, and nearby clinics, cheapest first. | Screen recording. Sign in as Maya, timeline with three records, then Costs: rapid strep test, ZIP 21204. Hold on the area estimate ($50, likely range $18 to $58) and the clinic list. Caption: "Before the visit. Billed prices, before insurance. A range, not a quote." |
| 0:57 to 1:11 | Voice 3 (voice-over) | Next problem: scattered paperwork. After a visit, she takes a photo of the summary. The AI reads it, labels it, explains it in plain language, and files it on her timeline. | Upload screen. Choose the sample visit summary, press "Read and file this document". Hold on the type label, key details and plain-language summary, then the timeline with the new record. Caption: "After the visit." |
| 1:11 to 1:28 | Voice 1 (voice-over) | A general chatbot does not know her records or local prices. Her companion does. She asks what strep will cost. It gives a range, says it is an estimate, says it cannot diagnose, and lists what it used. | Companion screen. Send "I think I have strep. What will it cost?" Hold on the answer, then zoom or highlight the "Used" list under it. Caption: "Answers from her own records and our cost model." |
| 1:28 to 1:46 | Voice 4 (voice-over) | And the clinic has none of her old records. Maya picks what to share, sets a time limit, and gets a code. The clinician enters it, sees only those records, and adds a note. Maya sees who viewed what. | Share screen: pick records, "1 hour", "Create share code". Cut to the clinician tab: enter the code, shared records, "Add a visit note", "Save to patient timeline". Cut back to Maya: the note on her timeline, then "Who viewed your records". Caption: "During the visit." |
| 1:46 to 1:59 | Voice 1 | We trained the cost model today on public 2024 Medicare billing data for Maryland. On providers it never saw, its average error was about 32 dollars, 28 percent better than the simple baseline. | Everyone on camera together, standing still. Voice 1 holds the mic. Text: "Average error $32.25. Baseline $44.72. 28% better. Six services." Label: "[13] Our test, held-out providers. CMS data." |
| 1:59 to 2:06 | Voice 2 | You choose what to share. Codes expire. Every view is logged. And the demo uses synthetic records. | Mic pass to Voice 2. Text: "Private by design. Synthetic demo data. Not HIPAA compliant yet." |
| 2:06 to 2:11 | Voice 3 | The companion shows its sources and tells you it is not a doctor. | Mic pass to Voice 3. Text: "Shows its sources. Never diagnoses." |
| 2:11 to 2:14 | All, led by Voice 4 | CareVault. Health care without the guesswork. | Everyone together, then cut to the logo and the tagline. |

## Screen recording steps

Before you record:

1. Start all three services as in `README.md`: the AI service on port 8000, the backend on port 4000, the web app on port 3000.
2. Open http://localhost:8000/health and check it shows `"mock_mode": false`. If it shows `true`, the companion gives fake answers; fix the API key first.
3. Open http://localhost:3000, scroll to the bottom of the landing page and press **Reset demo data**. Wait for "Demo data reset".
4. Open a second browser window (a private window works) for the clinician. Close other tabs and hide bookmarks and notifications.
5. Record at phone width or a narrow window if you can, so the text is large.

Record in this order:

1. **Landing page.** Start at the top with the headline "Health care without the guesswork". On the live cost card, pick the rapid strep test so the estimated cost shows. Hold two seconds.
2. **Sign in as the patient.** Press **Sign in**. The demo details are already filled in. Sign in. Hold on the **Timeline** with Maya's three records for two seconds.
3. **Costs (before the visit).** Open **Costs**. Service: rapid strep test. ZIP code: `21204`. Wait for the area estimate ($50, likely range $18 to $58) and "Clinics near you, cheapest first" (the cheapest clinic shows $19, likely range $18 to $31). Hold three seconds so the numbers can be read. Keep "Billed prices, before insurance." in the frame.
4. **Upload (after the visit).** Open **Upload**. Press "Take a photo or choose a file" and choose `data/demo/sample_visit_summary.png`. Press **Read and file this document**. Wait. Hold on the result: the document type, the key details and the plain-language summary. Then go back to the **Timeline** and show the new record there.
5. **Companion.** Open **Companion**. Type exactly: `I think I have strep. What will it cost?` Press **Send**. Wait for the full answer (about $18 to $58 for the rapid strep test, $117 to $287 for a returning-patient office visit, the estimate and "cannot diagnose" lines). Scroll so the **Used** list under the answer is in the frame. Hold three seconds.
6. **Share.** Open **Share**. Tick the records to share. Choose **1 hour**. Press **Create share code**. Hold on the 6-character code under "Give this code to your clinician".
7. **Clinician view.** Switch to the second window. Sign in as the clinician. On "Open shared records", type the code and press **Open records**. Show that only the shared records appear. Under "Add a visit note", type a short note, for example `Rapid strep positive. Started amoxicillin. Return if not improving in 48 to 72 hours.` Press **Save to patient timeline** and wait for "Saved".
8. **Back to Maya.** Switch to the patient window. Show the **Timeline** with the clinician's note. Open **Share** and hold on "Who viewed your records" for three seconds.

If something fails on camera, press **Reset demo data** and start that step again. The clinician screen notes that code `DEMO01` always works, which is a backup for step 7.

## If we are running long

Cut in this order. Each cut stands alone.

1. **The last line** ("CareVault. Health care without the guesswork."). End on the logo with the tagline as text. Saves 3 seconds.
2. **"and adds a note"** in the share step, and skip showing the note in the recording. Saves about 6 seconds.
3. **The opening sourced sentence** ("But a UnitedHealthcare report ... earlier in life."). Voice 1 says only "You see a doctor to catch problems early." and Voice 2 follows. Saves about 10 seconds and leaves two statistics.
4. **"says it is an estimate,"** in the companion step. The screen still shows it. Saves 2 seconds.

Cuts 1 to 3 bring the video to about 1:55. Do not cut the source labels, the "Used" list, the access log, or the "not a doctor" line.

## Sources

Every page below was opened and the number checked on the page itself on November 14, 2026. Sources 1 to 3 are spoken in the script. The others are verified and ready for slides.

1. **UnitedHealthcare with Health Action Council (an insurer and a nonprofit employer coalition).** "New Report Reveals Americans Are Getting Sick More Often, Earlier in Life." February 4, 2026. https://www.uhc.com/news-articles/newsroom/health-action-council-2026
   - Supports: "These younger groups [Millennials and Gen Z] are developing chronic conditions like diabetes and obesity earlier in life, visiting emergency rooms more frequently and engaging with primary care providers less often than any other generation."
   - Also on the page: "Between 2023 and 2025, their year-over-year growth rate was nearly double that of Baby Boomers", about health care claims. The page also says Millennials and Gen Z "still have lower health care claims than older generations".
   - Limits: the data is claims from more than 225,000 Health Action Council members on employer health plans run by UnitedHealthcare. It is not all young adults. The page gives no percentages for these findings.
2. **Gallup (Bentley-Gallup Business in Society Report).** Gallup news article, January 31, 2024. Web survey of 5,458 U.S. adults, May 8 to 15, 2023. https://news.gallup.com/poll/609434/few-americans-know-healthcare-costs.aspx
   - Supports: "Seventeen percent of U.S. adults report they know how much their healthcare products or services will cost before receiving them." The page says results are similar across age groups.
   - Also on the page: 95% believe healthcare organizations should make these costs more transparent before providing care.
3. **Aflac (an insurer).** "76% of Gen Z and 63% of millennials turn to AI for first line of primary healthcare." August 4, 2026. Wellness Matters Survey, run by Kantar Profiles in March 2026 with 2,000 employed U.S. adults ages 18 to 65. https://newsroom.aflac.com/2026-08-04-76-of-Gen-Z-and-63-of-millennials-turn-to-AI-for-first-line-of-primary-healthcare
   - Supports: "Gen Z (76%) and millennials (63%) use AI for health support before seeking professional medical care", compared with 47% of Americans overall.
   - Limits: employed adults only. "Professional medical care" is broad in the release (physician, therapist, dietician, personal trainer, sleep coach and others). The release does not give the question wording.
   - Also on the page: 48% of Gen Z have a primary doctor (79% of Gen X, 87% of baby boomers). 65% of Gen Z "admit to delaying or skipping routine checkups and screenings".
4. **KFF.** "Americans' Challenges with Health Care Costs." Updated October 23, 2026. KFF Survey of Health Access and Caregiving, May 4 to 26, 2026. https://www.kff.org/health-costs/report/americans-challenges-with-health-care-costs/
   - Supports: "About three in ten (28%) adults say in the past 12 months they have skipped or postponed getting health care they needed because of the cost." Among young adults under age 30 it is 40%. Among uninsured adults under 65 it is 62%.
   - Note: the project brief says 36%. The page no longer gives 36% for this. Use 28% (all adults) or 40% (under 30).
5. **Gallup with West Health.** "U.S. Adults' Ability to Afford Healthcare at a Five-Year Low." June 17, 2026. 5,660 U.S. adults, October 27 to December 22, 2025. https://news.gallup.com/poll/710942/adults-ability-afford-healthcare-five-year-low.aspx
   - Supports: "Adults aged 18 to 29 have experienced the sharpest decline in healthcare affordability since 2021, with the share classified as Cost Secure falling from 46% to 32%." All adults: 56% in 2021, 49% in 2025.
   - Exact meaning: "Cost Secure individuals say they have access to quality, affordable care and have recently been able to pay for both needed care and medicine." Say "Cost Secure", not "could afford care".
6. **KFF.** "KFF Tracking Poll on Health Information and Trust: Use of AI For Health Information and Advice." March 25, 2026. 1,343 U.S. adults, February 24 to March 2, 2026. https://www.kff.org/public-opinion/kff-tracking-poll-on-health-information-and-trust-use-of-ai-for-health-information-and-advice/
   - Supports: 36% of adults ages 18 to 29 report using AI tools or chatbots in the past year for information or advice about their physical health, and 28% for mental health. Among all adults, 32% turned to AI chatbots for health information in the past year.
   - Also: among AI users ages 18 to 29, 38% say not having a provider or appointment was a major reason and 29% say difficulty affording care was a major reason. 42% of those who asked AI about physical health did not follow up with a doctor or other health professional.
   - This is the most careful number on young adults and AI. Use it if anyone questions the Aflac figure.
7. **KFF.** "KFF Health Misinformation Tracking Poll: Artificial Intelligence and Health Information." August 15, 2024. Fielded June 3 to 24, 2024. https://www.kff.org/health-information-trust/kff-health-misinformation-tracking-poll-artificial-intelligence-and-health-information/
   - Supports: 25% of adults ages 18 to 29 use AI chatbots at least once a month for health information and advice (17% of all adults). About six in ten adults are not confident that health information from AI chatbots is accurate.
8. **Georgetown University Center on Health Insurance Reforms (a university research center).** "As Workers Brace for Higher Health Insurance Costs, Policymakers Have Options to Improve Affordability." Stacey Pogue, Sabrina Corlette and Karen Davenport. October 15, 2026. https://chir.georgetown.edu/as-workers-brace-for-higher-health-insurance-costs-policymakers-have-options-to-improve-affordability/
   - Supports: "Employers expect health insurance costs to rise more in 2027 than they have for nearly two decades." Employer surveys and analyst projections "point to a big jump in ESI costs in 2027, ranging from 9% to 11%" before plan changes. "Most large employers report that they will shift at least some of these cost increases to workers in 2027 through higher deductibles and other out-of-pocket costs and higher premiums."
   - Also: the average deductible for workers with single coverage reached $1,886, and workers' deductibles have increased by more than 50% since 2015 (the page cites KFF).
   - Limits: this is about employer-sponsored insurance and these are projections. Not spoken in the script because the team chose "unknown cost" over "rising cost" for the hook.
9. **American Cancer Society.** "Colorectal Cancer Drops in Older Adults and Rises in Younger Ones." March 2, 2026, reporting "Colorectal Cancer Statistics, 2026" in CA: A Cancer Journal for Clinicians. https://www.cancer.org/research/acs-research-news/colorectal-cancer-drops-in-older-adults-and-rises-in-young-ones.html
   - Supports: colorectal cancer incidence is rising by 3% per year in people 20 to 49.
10. **American Cancer Society.** "Mortality Under 50 Declines for 4 of 5 Leading Cancers in U.S., but Colorectal Now Top Cancer Killer, New ACS Study Finds." January 22, 2026 (study in JAMA). https://pressroom.cancer.org/under-50-mortality-declines
    - Supports: colorectal cancer went from the fifth most common cancer death under 50 in the early 1990s to first in 2023. Three in four people under 50 with colorectal cancer are diagnosed with advanced disease.
    - Balance: overall cancer mortality in people younger than 50 decreased by 44% from 1990 to 2023. Do not say young adults are dying of cancer more overall.
11. **ASTP/ONC (U.S. Department of Health and Human Services).** "Gaps in Individuals' Information Exchange." Quick stat, published September 2025, modified May 2026. https://healthit.gov/data/quickstats/gaps-individuals-information-exchange/ (read through the site's data page for this quick stat).
    - Supports: among people who saw a health care provider in the past year, about 1 in 5 in 2017 to 2022 had to bring a prior test result to an appointment (21% in 2022). In 2024, about 1 in 5 (20%) waited for test results longer than they thought reasonable, and about 10% had to redo a test or procedure because earlier results were unavailable.
12. **NCES.** "National Assessment of Adult Literacy: Health Literacy, Highlights of Findings." 2003 survey of adults 16 and older. https://nces.ed.gov/naal/health_results.asp
    - Supports: "A majority of adults had Intermediate health literacy" and "Over 75 million adults combined had Basic and Below Basic health literacy." The data is from 2003, so it was left out of the script.
13. **Our own test and data.** `docs/DECISIONS.md` and `ai/model/metrics.json`. Data: CMS, "Medicare Physician & Other Practitioners by Provider and Service", 2024, Maryland. https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
    - Supports: on 1,941 providers the model never saw (3,152 rows), average error $32.25 against $44.72 for the baseline (the median price per service), which is 28% better. 83% of real primary-care charges fell inside the range the app shows. Six services. Prices are charges billed to Medicare, before insurance.

## Numbers we did not use

- **"60% of deaths last year were because people didn't know what was wrong with them."** Made up in the team talk. No source says this. We recommend dropping the mortality angle. The nearest real facts are in source 10, and they are about one cancer. The app does not diagnose, so the video does not say it saves lives.
- **"Save lives" in the tagline.** Not used, for the same reason. The tagline is the app's own headline.
- **"70%, or a large amount, of young people are not going to the doctor."** No source found for 70%. Verified numbers that are close: 40% of adults under 30 skipped or postponed needed care because of cost (source 4), and 65% of Gen Z in a survey of employed adults delay or skip routine checkups and screenings (source 3).
- **"76% of Gen Z use AI for health help."** The number is real (source 3), but the loose wording is not. It comes from an insurer's survey of employed adults and measures using AI for health support before seeking professional medical care. The script uses that wording.
- **"36% of adults skipped care over cost" (project brief).** The KFF page was updated on October 23, 2026 and now says 28% for all adults. Replace it in the brief and the slides.
- **"Could afford care fell from 46% to 32%" (project brief).** The numbers are right, but they measure the share Gallup classifies as "Cost Secure" (source 5). Not spoken because the script is limited to three statistics.
- **UnitedHealthcare: "claims growing nearly twice as fast".** The page says the year-over-year growth rate was "nearly double" that of baby boomers between 2023 and 2025, in employer-plan claims, and gives no percentages. Not spoken; use the page's wording on a slide.
- **UnitedHealthcare: "rely more on emergency rooms than primary care".** The page does not compare the two. It says younger groups visit emergency rooms more frequently and see primary care providers less often than any other generation.
- **"Entry-level workers".** Not on either page.
- **"79% do not know what care will cost."** News reports give this number, but the Gallup page states only the 17% who say they do know. The script uses 17%.
- **"Only 12% of adults have proficient health literacy."** Widely repeated, from the 2003 survey in source 12, but the page we opened does not show the number and the data is over 20 years old.
- **Clinicians lacking outside records (figures such as 71% of hospitals or 13% of family physicians).** Found only in search summaries, not confirmed on a source page. The clinician problem in the script is told through Maya's story with no number.
- **CDC "20% to 40% of deaths from the leading causes are preventable".** Seen only in search summaries, not confirmed on the CDC page, and it measures prevention, not missed diagnoses.
