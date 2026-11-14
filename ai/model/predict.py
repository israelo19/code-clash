"""Turn the trained cost model into a price range.

The /estimate endpoint should call estimate(). Example:

    from model.predict import estimate
    estimate("87880", "21252")
    -> {"low": 26, "typical": 40, "high": 59, ...}
"""

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODEL_PATH = Path(__file__).parent / "cost_model.joblib"

# The four inputs the model was trained on.
FEATURES = ["code", "provider_type", "place", "zip3"]

# A patient usually does not know what type of clinician they will see. When no
# provider type is given, the range covers these four common primary-care types.
PRIMARY_CARE_TYPES = [
    "Family Practice",
    "Internal Medicine",
    "Nurse Practitioner",
    "Physician Assistant",
]

CAVEAT = (
    "Estimate only, not a quote. Based on what Maryland providers billed "
    "Medicare, which is not what your own insurance pays."
)


def predict_ranges(models, rows):
    """Predict low, typical and high prices in dollars for each row.

    `models` holds one model per percentile (10th, 50th, 90th). They predict
    log dollars, so we convert back with exp. The three models are trained
    separately and can occasionally cross (a "low" above a "typical"), so we
    sort each row to guarantee low <= typical <= high.
    """
    log_predictions = np.column_stack([models[q].predict(rows[FEATURES]) for q in (0.1, 0.5, 0.9)])
    dollars = np.sort(np.exp(log_predictions), axis=1)
    return pd.DataFrame(dollars, columns=["low", "typical", "high"], index=rows.index)


def predict_ranges_any_primary_care(models, rows):
    """Price range when we do not know the provider type.

    Predict once per primary-care type, then take the lowest low and the
    highest high so the range covers all four. This is what the app shows by
    default, and train.py measures how often it contains the real charge.
    """
    per_type = [predict_ranges(models, rows.assign(provider_type=t)) for t in PRIMARY_CARE_TYPES]
    return pd.DataFrame(
        {
            "low": np.min([r["low"] for r in per_type], axis=0),
            "typical": np.median([r["typical"] for r in per_type], axis=0),
            "high": np.max([r["high"] for r in per_type], axis=0),
        },
        index=rows.index,
    )


@lru_cache
def load_model():
    """Load the saved model file once and reuse it for every request."""
    return joblib.load(MODEL_PATH)


def estimate(code, zip_code, setting="office", provider_type=None):
    """Price range for one service code.

    code           one of the service codes we trained on, e.g. "87880"
    zip_code       the patient's ZIP; only the first three digits are used
    setting        "office" or "facility" (hospital-based clinic)
    provider_type  optional CMS provider type, e.g. "Nurse Practitioner"
    """
    saved = load_model()
    code = str(code)
    if code not in saved["services"]:
        raise ValueError(f"No estimate for service code {code}. Known codes: {sorted(saved['services'])}")

    # Lab tests and vaccines only appear in office settings in the data, so
    # fall back to office when a code was never seen in a facility.
    place = "F" if setting == "facility" else "O"
    if place not in saved["places_by_code"][code]:
        place = "O"

    zip3 = str(zip_code)[:3]
    row = pd.DataFrame([{"code": code, "provider_type": provider_type, "place": place, "zip3": zip3}])
    if provider_type:
        price = predict_ranges(saved["models"], row).iloc[0]
    else:
        price = predict_ranges_any_primary_care(saved["models"], row).iloc[0]

    return {
        "code": code,
        "service": saved["services"][code],
        "low": round(price["low"]),
        "typical": round(price["typical"]),
        "high": round(price["high"]),
        "setting": "facility" if place == "F" else "office",
        # False means the ZIP is outside the Maryland areas we trained on, so
        # the model falls back to a statewide pattern.
        "zip_in_training_area": zip3 in saved["known_zip3"],
        "caveat": CAVEAT,
    }
