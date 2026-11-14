"""Turn the trained cost model into price ranges for the app.

The /estimate endpoint should call these. Run from the ai/ folder:

    from model.predict import estimate, estimate_visit, clinics_near

    estimate("87880", "21204")                  # one service, area estimate
    estimate_visit("strep", "21204")            # office visit + strep test, with a total
    clinics_near("21204", "87880")              # known clinics nearby, cheapest first
    estimate("87880", "21204", clinic="...")    # one service at a clinic from clinics_near
"""

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

try:  # works both as "model.predict" (from the service) and as "predict" (from train.py)
    from .features import PRIMARY_CARE_TYPES, add_clinic_features
except ImportError:
    from features import PRIMARY_CARE_TYPES, add_clinic_features

MODEL_PATH = Path(__file__).parent / "cost_model.joblib"

CAVEAT = (
    "Estimate only, not a quote. Based on what Maryland providers billed "
    "Medicare in 2024, which is not what your own insurance pays."
)

# Common visits, so the companion and the cost card can ask for a visit by name
# instead of raw codes. Every visit also includes the office visit itself, which
# is a different code for new and for established patients.
VISITS = {
    "office": {"name": "Office visit", "codes": []},
    "strep": {"name": "Sore throat visit with a rapid strep test", "codes": ["87880"]},
    "flu": {"name": "Flu visit with a rapid flu test", "codes": ["87804"]},
    "blood_count": {"name": "Visit with a complete blood count", "codes": ["85025"]},
    "vaccine": {
        "name": "Vaccine visit",
        "codes": ["90471"],
        "note": "Covers the visit and giving the shot. The vaccine itself is billed separately and is not included.",
    },
}


def predict_ranges(model, rows):
    """Predict low, typical and high prices in dollars for each row.

    `model` holds one trained model per percentile (10th, 50th, 90th) and the
    list of features they use. They predict log dollars, so we convert back
    with exp. The three are trained separately and can occasionally cross (a
    "low" above a "typical"), so we sort each row to guarantee
    low <= typical <= high.
    """
    inputs = rows[model["features"]]
    log_predictions = np.column_stack([model["quantiles"][q].predict(inputs) for q in (0.1, 0.5, 0.9)])
    dollars = np.sort(np.exp(log_predictions), axis=1)
    return pd.DataFrame(dollars, columns=["low", "typical", "high"], index=rows.index)


def predict_ranges_any_primary_care(model, rows):
    """Price range when we do not know the provider type.

    Predict once per primary-care type, then take the lowest low and the
    highest high so the range covers all four. This is what the app shows by
    default, and train.py measures how often it contains the real charge.
    """
    per_type = [predict_ranges(model, rows.assign(provider_type=t)) for t in PRIMARY_CARE_TYPES]
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


def estimate(code, zip_code, setting="office", provider_type=None, clinic=None):
    """Price range for one service code.

    code           one of the service codes we trained on, e.g. "87880"
    zip_code       the patient's ZIP; only the first three digits are used
    setting        "office" or "facility" (hospital-based clinic)
    provider_type  optional CMS provider type, e.g. "Nurse Practitioner"
    clinic         optional clinic id from clinics_near(). When the clinic is in
                   our data, the estimate uses that clinic's own price level and
                   is much tighter. Otherwise it is an estimate for the area.
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

    clinic_known = clinic in saved["clinics"].index
    zip3 = saved["clinics"].loc[clinic, "zip5"][:3] if clinic_known else str(zip_code)[:3]
    row = pd.DataFrame([{"code": code, "provider_type": provider_type, "place": place, "zip3": zip3, "clinic": clinic}])

    if clinic_known:
        model = saved["clinic_model"]
        row = add_clinic_features(row, saved["reference"])
    else:
        model = saved["area_model"]

    if provider_type:
        price = predict_ranges(model, row).iloc[0]
    else:
        price = predict_ranges_any_primary_care(model, row).iloc[0]

    result = {
        "code": code,
        "service": saved["services"][code],
        "low": round(price["low"]),
        "typical": round(price["typical"]),
        "high": round(price["high"]),
        "setting": "facility" if place == "F" else "office",
        # "clinic" means the range uses that clinic's own prices. "area" means
        # it is for providers in that part of Maryland in general.
        "based_on": "clinic" if clinic_known else "area",
        # False means the ZIP is outside the Maryland areas we trained on, so
        # the model falls back to a statewide pattern.
        "zip_in_training_area": zip3 in saved["known_zip3"],
        "caveat": CAVEAT,
    }
    if clinic_known:
        place_info = saved["clinics"].loc[clinic]
        result["clinic"] = {"id": clinic, "address": place_info["address"], "city": place_info["city"], "zip": place_info["zip5"]}
    return result


def estimate_total(codes, zip_code, **options):
    """Price ranges for several service codes, plus a total.

    The total adds the lows, the typicals and the highs. Adding lows and highs
    makes the total range a little wider than it strictly needs to be, which is
    the safe direction for a cost estimate. train.py checks this against real
    providers who bill both services.
    """
    items = [estimate(code, zip_code, **options) for code in codes]
    return {
        "items": items,
        "total": {key: sum(item[key] for item in items) for key in ("low", "typical", "high")},
        "based_on": items[0]["based_on"],
        "caveat": CAVEAT,
    }


def estimate_visit(visit, zip_code, new_patient=True, **options):
    """Price range for a named visit, e.g. estimate_visit("strep", "21204").

    new_patient picks the office visit code: 99203 for someone new to the
    clinic, 99213 for someone who has been there before.
    """
    if visit not in VISITS:
        raise ValueError(f"Unknown visit '{visit}'. Known visits: {sorted(VISITS)}")
    office_visit = "99203" if new_patient else "99213"
    result = estimate_total([office_visit] + VISITS[visit]["codes"], zip_code, **options)
    result["visit"] = VISITS[visit]["name"]
    if "note" in VISITS[visit]:
        result["note"] = VISITS[visit]["note"]
    return result


def clinics_near(zip_code, code, limit=5, min_providers=2):
    """Known clinics near a ZIP with their price range for a service, cheapest first.

    Looks in the same 5-digit ZIP first, then widens to the same 3-digit area.
    Only clinics where at least `min_providers` providers bill this service are
    listed, so each range rests on more than one person's prices. Clinics are
    identified by street address, because the CMS data has no clinic names.
    """
    saved = load_model()
    code, zip_code = str(code), str(zip_code)
    if code not in saved["services"]:
        raise ValueError(f"No estimate for service code {code}. Known codes: {sorted(saved['services'])}")

    reference = saved["reference"]
    billing = reference[reference["code"] == code].groupby("clinic")["provider_id"].nunique()
    known = saved["clinics"].join(billing.rename("providers_for_code"), how="inner")
    known = known[known["providers_for_code"] >= min_providers]

    nearby = known[known["zip5"] == zip_code]
    if len(nearby) < limit:
        nearby = known[known["zip5"].str[:3] == zip_code[:3]]
    if nearby.empty:
        return []

    # Price every nearby clinic in one batch, which is much faster than calling
    # estimate() once per clinic.
    nearby = nearby.reset_index()  # the clinic id becomes a normal column
    rows = pd.DataFrame(
        {"code": code, "provider_type": None, "place": "O", "zip3": nearby["zip5"].str[:3], "clinic": nearby["clinic"]}
    )
    rows = add_clinic_features(rows, reference)
    prices = predict_ranges_any_primary_care(saved["clinic_model"], rows).round().astype(int)
    listing = nearby.join(prices).sort_values(["typical", "low"]).head(limit)

    return [
        {
            "clinic": {
                "id": info["clinic"],
                "address": info["address"],
                "city": info["city"],
                "zip": info["zip5"],
                "providers_in_data": int(info["providers_for_code"]),
            },
            "code": code,
            "service": saved["services"][code],
            "low": int(info["low"]),
            "typical": int(info["typical"]),
            "high": int(info["high"]),
            "based_on": "clinic",
            "caveat": CAVEAT,
        }
        for _, info in listing.iterrows()
    ]
