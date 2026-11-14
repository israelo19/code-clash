# Cost model: what changed from the brief

Workstream D update, Saturday November 14, 1:25 PM. This replaces the 12:10 PM version.

The cost model is trained, tested and a lot stronger than it was at noon. On providers it never saw, its average error is $34.93 against $44.72 for the simple baseline, which is 22% better. The noon version was 11% better. The gain came from one finding: prices are set by the clinic, so the model now uses the clinic's own price level when it knows the clinic.

The `/estimate` endpoint is still not built. The functions it will call are ready and tested.

## Changes that affect other workstreams

### 1. There are now two kinds of estimate: by area and by clinic.

- **Area estimate.** Needs only a service and a ZIP. This is what we had at noon.
- **Clinic estimate.** Needs a clinic picked from a list of known clinics near the ZIP. It is much tighter, because providers at the same address bill almost the same prices.

The model can list known clinics near a ZIP, cheapest first, so the brief's "cheaper options nearby" comparison is now possible. It compares real clinics, not clinic types.

What this needs from others:

- **Web app (A):** a way to show the nearby list and let the user pick one. Without it the app still works, on area estimates only.
- **Companion (C):** the cost tool can call the nearby list and quote two or three options.

Limits to know:

- A clinic is a street address plus ZIP. The CMS data has no clinic names, so the list shows addresses. A large medical building can hold several unrelated practices under one address.
- About 72% of held-out rows were at a clinic the model knows. For the rest it falls back to the area estimate.

### 2. A visit can be priced by name, with a total.

A strep visit is an office visit plus a strep test, so one code is not enough. The model now prices named visits (`office`, `strep`, `flu`, `blood_count`, `vaccine`) and any list of codes, and returns each item plus a total.

- The office visit code depends on whether the patient is new to the clinic. New is the default and costs more.
- The vaccine visit covers giving the shot, not the vaccine itself. The result carries a note saying so, and the UI should show it.

### 3. The TB skin test is gone. Six services remain.

Maryland has only 2 rows for code 86580 in the CMS data. Please remove it from any service list, demo step or slide.

| Code | Service |
| --- | --- |
| 99213 | Office visit, established patient |
| 99203 | Office visit, new patient |
| 87880 | Rapid strep test |
| 87804 | Rapid flu test |
| 90471 | Vaccine administration |
| 85025 | Complete blood count |

### 4. "Setting" only means office or facility.

The brief talks about campus health, retail clinic, urgent care and ER. The CMS data cannot tell those apart.

- Facility rows hold only the clinician's fee. The hospital's separate facility fee is not in this dataset, so do not present a facility number as the full cost of a hospital or ER visit.
- Lab tests and vaccines appear only in office settings, so the model always uses office for them.

### 5. Provider type is optional. Leave it out.

A patient does not know who they will see. When no provider type is passed, the range covers four primary-care types: Family Practice, Internal Medicine, Nurse Practitioner and Physician Assistant. That default range is the one we tested as "what the app shows".

### 6. The numbers are billed prices, and they look high.

The model predicts what providers billed Medicare in 2024, which is more than double what Medicare allows. For an established-patient office visit the median Maryland charge is $195 and the median Medicare allowed amount is about $88.

- UI wording: label the range as a billed price before insurance, next to the estimate label.
- Strep test prices cluster at two points (about $32 and $58), so show the range, not only the typical price.

## What we tested, in order (for the deck)

Charts are in `docs/charts/`. Every number below is in `ai/model/metrics.json` or `ai/model/experiments.json`, and rerunning the scripts reproduces them.

**Step 1. Set a baseline.** The median price per service, the same for everyone. Any model has to beat this.

**Step 2. Train a model and add information one piece at a time.** Chart `1_what_each_step_added.png`. Measured by cross-validation on the training providers, so the test providers stay untouched.

| What the model knows | Average error |
| --- | --- |
| Baseline: median price per service | $43.20 |
| Service code only | $43.20 |
| + office or facility | $43.11 |
| + region (first 3 ZIP digits) | $41.59 |
| + provider type | $39.00 |
| + the clinic's own price level | $33.22 |

**Step 3. Try to improve it the usual ways.** None of these helped much, so none were kept.

| Idea | Change in error |
| --- | --- |
| Full 5-digit ZIP as an extra feature | 1.7% lower |
| Deeper trees | 1.1% lower |
| Twice as many boosting rounds | 0.5% lower |

**Step 4. Ask whether more data would help.** Chart `2_would_more_data_help.png`. Going from half the training providers to all of them improved the area model by 1%, so more of the same data was not the answer.

**Step 5. Find what does drive the price.** Providers at the same street address bill within 0.2% of each other for the same service. Across the state the typical spread is 20%. So we gave the model the clinic's price level, worked out only from the other providers at that address, never from the provider being predicted. This is the last row of the table in step 2. The same chart shows this clinic model still improving as data grows (7% from half to all), so more years of CMS data are the next thing to add.

**Step 6. Run the final test once, on the 1,941 providers held out from the start.** Charts `3_final_test_by_service.png` and `5_how_close_are_estimates.png`.

| Measure, all 3,152 held-out rows | Baseline | Area model (noon) | Final model |
| --- | --- | --- | --- |
| Average error | $44.72 | $39.79 | $34.93 |
| Median error, as a share of the real charge | 19.1% | 16.2% | 11.5% |
| Estimates within 10% of the real charge | 33% | 37% | 47% |

- When the clinic is in our data (2,259 rows), the median error is 8.2% against the baseline's 18.1%.
- When it is not (893 rows), the model is the area model: 19.2% against the baseline's 25.0%.
- The biggest gain is the strep test: median error 8.8% against the baseline's 31.0%.

**Step 7. Check the range the app shows.** Chart `4_range_check.png`. On 1,645 held-out primary-care rows with the provider type left out, as in the app, 84% of real charges fell inside the range. The goal is 80%, and every service clears it.

**Step 8. Check the visit totals.** 561 held-out providers bill both an office visit and an add-on such as a strep test, so their real totals are known. The added-up range contained the real total 97% of the time, and the typical price was a median of 5.5% off. The total range is wider than it needs to be, which is the safe direction.

**Step 9. Automated checks.** 38 tests in `ai/tests/` confirm the estimates behave: low is never above high, totals add up, a clinic from the nearby list can be priced, and bad input gives a clear error.

Things to say plainly if a judge asks:

- The clinic estimate works only for clinics already in the data. It is closer to "what did this clinic bill others" than to a prediction from scratch.
- With the provider type passed in, the range holds 76% of real charges, under the 80% goal. The app does not pass it.
- These are charges billed to Medicare, not what a student's insurance pays.

For the 4:00 PM track choice: D's view is that the model can now support an AI & Data pitch, since it has a baseline, a tested progression and a real finding. Decide on the whole demo, not the model alone.

## How to use the model

Run from the `ai/` folder.

```python
from model.predict import estimate, estimate_visit, estimate_total, clinics_near

estimate_visit("strep", "21204")                  # area estimate with a total
clinics_near("21204", "87880", limit=3)           # known clinics, cheapest first
estimate_visit("strep", "21204", clinic=clinic_id)  # the same visit at one of them
estimate("87880", "21204")                        # a single service
estimate_total(["99213", "85025"], "21204")       # any list of codes
```

- `estimate_visit` and `estimate_total` return `items` (one range per service), a `total` with `low`, `typical` and `high`, and `based_on`, which is `"area"` or `"clinic"`.
- `clinics_near` returns a list. Each entry has a `clinic` with `id`, `address`, `city` and `zip`, and the price range. Pass the `id` back as `clinic=`.
- An unknown service code or visit name raises a `ValueError`. The endpoint should turn that into a "no estimate available" reply.
- A ZIP outside Maryland still returns an area range, with `zip_in_training_area` set to false, and an empty clinic list. Show a "based on Maryland prices" note.

Demo numbers for Maya in Towson. Use ZIP 21204; the university's own ZIP, 21252, has no clinics in the data.

| What | Low | Typical | High |
| --- | --- | --- | --- |
| Strep visit, new patient, area estimate | $187 | $319 | $434 |
| Strep visit, established patient, area estimate | $135 | $249 | $345 |
| Strep test alone, area estimate | $18 | $50 | $58 |
| Strep test at 600 E Belvedere Ave, Baltimore | $15 | $20 | $52 |
| Strep test at 5230 Campbell Blvd, Nottingham | $24 | $28 | $53 |

## Setup

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r ai/requirements.txt
python ai/model/train.py          # about 5 seconds: model, metrics.json, test_predictions.csv
python ai/model/experiments.py    # about 3 minutes: experiments.json
python ai/model/charts.py         # a few seconds: docs/charts/*.png
python -m pytest ai/tests
```

- You only need the first three lines to use the model. The saved model and all results are in the repo.
- You do not need to pull the data again. `data/cms_md_services.csv` is in the repo. The CMS API needs no key, but it is slow and drops connections, so `python data/pull_cms.py` takes about 6 minutes.
- The saved model only loads with the scikit-learn and pandas versions that `requirements.txt` pins. If they will not install on your machine, install what does and rerun the training script.
- Add FastAPI and the other service libraries to `ai/requirements.txt`.

## Open decisions

1. **Do we add a clinic picker? (A, C, D)** It makes the estimate much tighter and gives the "cheaper options nearby" comparison, but it needs a list and a selection in the UI. Without it we demo area estimates only.
2. **What does `/estimate` accept? (C and D)** Proposal: a visit name or a list of codes, a ZIP, and an optional clinic id, plus a second route for the nearby list. Not built yet.
3. **README disclosures (E).** For the cost model: the CMS dataset (2024 release), the libraries `requests`, `pandas`, `scikit-learn`, `joblib`, `matplotlib` and `pytest`, and Claude Code, which helped write the cost model code.
