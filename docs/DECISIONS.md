# Cost model: what changed from the brief

Workstream D update, Saturday November 14, 12:10 PM.

The cost model is trained and tested on providers it never saw. Across all providers it beats the simple baseline by 11%. On primary-care providers, which is what students use, it is only about 2% better. The `/estimate` endpoint is not wired up yet; it is waiting on open decision 1 below.

## Changes that affect other workstreams

### 1. The TB skin test is gone. Six services remain.

Maryland has only 2 rows for code 86580 in the CMS data, which is not enough to train on. Please remove it from any service list, demo step or slide.

| Code | Service |
| --- | --- |
| 99213 | Office visit, established patient |
| 99203 | Office visit, new patient |
| 87880 | Rapid strep test |
| 87804 | Rapid flu test |
| 90471 | Vaccine administration |
| 85025 | Complete blood count |

### 2. "Setting" only means office or facility.

The brief talks about campus health, retail clinic, urgent care and ER. The CMS data cannot tell those apart. It records the clinician's type and whether the visit was in an office or a facility (a hospital-based clinic).

- A nurse practitioner at a retail clinic and one at an urgent care look the same to the model. The "cheaper options across clinic types" nice-to-have cannot be built on it. Drop it or find another data source.
- Facility rows hold only the clinician's fee. The hospital's separate facility fee is not in this dataset, so do not present a facility number as the full cost of a hospital or ER visit.
- Lab tests and vaccines appear only in office settings, so the model always uses office for them.

### 3. Provider type is optional.

The brief makes provider type a model feature, but a patient does not know who they will see. When no provider type is passed, the range covers four primary-care types: Family Practice, Internal Medicine, Nurse Practitioner and Physician Assistant.

Leave provider type out unless you have a reason to pass it. On held-out primary-care providers, 87% of real charges fell inside the default range. Passing the provider type gives a narrower range that caught about 78%.

### 4. The numbers are billed prices, and they look high.

The model predicts what providers billed, which is more than double what Medicare allows. For an established-patient office visit the median Maryland charge is $195 and the median Medicare allowed amount is about $88.

- UI wording: label the range as a billed price before insurance, next to the estimate label.
- Strep test prices cluster at two points (about $32 and $58), so the "typical" number is less meaningful there. Show the range prominently, not only the typical price.

## Results for the deck

Trained on 12,619 rows from 7,761 providers. Tested on 3,152 rows from 1,941 providers the model never saw.

**All held-out providers, provider type known:**

| Measure | Our model | Baseline (median per code) |
| --- | --- | --- |
| Average error | $39.79 | $44.72 |
| Median error, as a share of the real charge | 16.2% | 19.1% |
| Real charges inside the range (goal is 80%) | 77.7% | 80.4% |
| Average width of the range | $122 | $138 |

**Held-out primary-care providers, provider type unknown (what the app shows), 1,645 rows:**

| Measure | Our model | Baseline (median per code) |
| --- | --- | --- |
| Average error | $36.78 | $37.64 |
| Median error, as a share of the real charge | 16.1% | 17.7% |
| Real charges inside the range | 86.7% | 84.1% |
| Average width of the range | $133 | $125 |

What this means:

- The 11% gain is real, but most of it comes from telling specialists apart. An optometrist bills a median of $125 for an established-patient visit and a urologist bills $270.
- For primary care the model and the baseline are nearly tied. The service code alone explains most of the price, and each practice sets its own charges.
- Quote the first table as the model's test result, and say the second point plainly if a judge asks. Both are in `ai/model/metrics.json`.
- For the 4:00 PM track choice: D's view is that this model supports the story but is not strong enough to carry an AI & Data pitch on its own.

Average error by service, all held-out providers:

| Service | Our model | Baseline |
| --- | --- | --- |
| Office visit, established | $41.29 | $46.41 |
| Office visit, new | $53.88 | $60.36 |
| Rapid strep test | $9.50 | $11.97 |
| Rapid flu test | $10.68 | $11.44 |
| Vaccine administration | $11.76 | $12.28 |
| Complete blood count | $5.07 | $6.41 |

Two evaluation choices worth knowing:

- **The split is by provider.** The brief said to hold out 20% of providers, and the code does that with a grouped split. A plain row split would put the same provider in both sets and make the error look better than it is.
- **We also report range coverage.** The app shows a range, so we measure how often the real charge falls inside it, not only the error of the middle number.

## How to use the model

```python
from model.predict import estimate   # run from the ai/ folder

estimate("87880", "21252")
# {"code": "87880", "service": "Rapid strep test",
#  "low": 18, "typical": 50, "high": 58, "setting": "office",
#  "zip_in_training_area": true, "caveat": "Estimate only, not a quote. ..."}
```

- Arguments: service code, ZIP, then optional `setting` ("office" or "facility") and optional `provider_type`.
- An unknown service code raises a `ValueError`. The endpoint should turn that into a "no estimate available" reply.
- A ZIP outside Maryland still returns a range, with `zip_in_training_area` set to false. Show a "based on Maryland prices" note in that case.

Demo numbers for Maya near Towson (ZIP 21252):

| Service | Low | Typical | High |
| --- | --- | --- | --- |
| Office visit, new patient | $169 | $269 | $376 |
| Office visit, established patient | $117 | $199 | $287 |
| Rapid strep test | $18 | $50 | $58 |

## Setup

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r ai/requirements.txt
python ai/model/train.py
```

- Training takes about 3 seconds and rewrites `cost_model.joblib` and `metrics.json`.
- You do not need to pull the data again. `data/cms_md_services.csv` is saved in the repo. The CMS API needs no key, but it is slow and drops connections, so `python data/pull_cms.py` takes about 6 minutes.
- The saved model only loads with scikit-learn 1.9.1, which `requirements.txt` pins. If that version will not install on your machine, install whatever version does and rerun the training script.
- Add FastAPI and the other service libraries to `ai/requirements.txt`.

## Open decisions

1. **How does a visit with several codes get priced? (C and D)** A strep visit is an office visit plus a strep test. Proposal: `/estimate` accepts a list of codes and returns each range plus a total that adds the lows and adds the highs. For Maya that is $187 to $434 as a new patient. The alternative is that the companion calls `/estimate` once per code and adds them itself.
2. **Which data year goes on the slide? (E)** The script pulls the latest release the CMS API serves. Check the year on the dataset page before quoting it.
3. **README disclosures (E).** For the cost model: the CMS dataset, the libraries `requests`, `pandas`, `scikit-learn` and `joblib`, and Claude Code, which helped write the pull and training scripts.
