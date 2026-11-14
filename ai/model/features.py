"""Shared pieces of the cost model: the data loader and the features.

train.py, experiments.py and predict.py all import from here, so the features
are built the same way in training, in testing and in the app.
"""

from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = REPO_ROOT / "data" / "cms_md_services.csv"

SERVICES = {
    "99213": "Office visit, established patient",
    "99203": "Office visit, new patient",
    "87880": "Rapid strep test",
    "87804": "Rapid flu test",
    "90471": "Vaccine administration",
    "85025": "Complete blood count",
}

# Area model: what a patient can tell us without naming a clinic.
AREA_FEATURES = ["code", "provider_type", "place", "zip3"]

# Clinic model: the same four, plus how that clinic prices compared with the
# typical price. These three are numbers and are empty when we have no data on
# the clinic.
CLINIC_FEATURES = AREA_FEATURES + ["clinic_level", "clinic_same_code", "clinic_rows"]

# A patient usually does not know what type of clinician they will see. When no
# provider type is given, the range covers these four common primary-care types.
PRIMARY_CARE_TYPES = [
    "Family Practice",
    "Internal Medicine",
    "Nurse Practitioner",
    "Physician Assistant",
]


def clinic_id(street, zip5):
    """One ID per clinic: the street address, cleaned up, plus the ZIP.

    "8630 Fenton St." and "8630 FENTON ST" should count as the same place, so
    we upper-case the street and drop punctuation and extra spaces.
    """
    street = street.str.upper().str.replace(r"[^A-Z0-9 ]", "", regex=True)
    street = street.str.replace(r"\s+", " ", regex=True).str.strip()
    return street + "|" + zip5


def load_data():
    """Read the CMS rows and build the basic columns."""
    raw = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False)
    data = pd.DataFrame(
        {
            "provider_id": raw["Rndrng_NPI"],
            "code": raw["HCPCS_Cd"],
            "provider_type": raw["Rndrng_Prvdr_Type"],
            "place": raw["Place_Of_Srvc"],  # O = office, F = facility
            "zip3": raw["Rndrng_Prvdr_Zip5"].str[:3],
            "zip5": raw["Rndrng_Prvdr_Zip5"],
            "clinic": clinic_id(raw["Rndrng_Prvdr_St1"], raw["Rndrng_Prvdr_Zip5"]),
            "address": raw["Rndrng_Prvdr_St1"],
            "city": raw["Rndrng_Prvdr_City"],
            "charge": pd.to_numeric(raw["Avg_Sbmtd_Chrg"], errors="coerce"),
        }
    )
    data = data[data["code"].isin(SERVICES) & (data["charge"] > 0)]
    return data.reset_index(drop=True)


def price_reference(train):
    """How far each training row's price is from the typical price for its code.

    "gap" is on a log scale, so 0 means typical, about +0.2 means roughly 20%
    above typical and about -0.2 means roughly 20% below. Clinic features are
    averages of these gaps.
    """
    log_charge = np.log(train["charge"])
    typical = log_charge.groupby(train["code"]).median()
    reference = train[["clinic", "code", "provider_id"]].copy()
    reference["gap"] = log_charge - train["code"].map(typical)
    return reference


def add_clinic_features(rows, reference):
    """Add the three clinic features to `rows`, using only the reference rows.

    clinic_level      average price gap of OTHER providers at the same clinic,
                      across all services
    clinic_same_code  the same average, but only for the same service code
    clinic_rows       how many reference rows the clinic_level is based on

    "Other providers" matters: a provider's own prices are never used for their
    own row. Otherwise the model would be handed the answer during training and
    look far better than it really is. In the app there is no "own" provider,
    so every reference row at the clinic is used.
    """
    rows = rows.copy()
    if "provider_id" not in rows:
        rows["provider_id"] = ""

    def others_average(keys):
        everyone = reference.groupby(keys)["gap"].agg(["sum", "count"])
        own = reference.groupby(keys + ["provider_id"])["gap"].agg(["sum", "count"])
        at_clinic = rows[keys].join(everyone, on=keys).fillna(0)
        mine = rows[keys + ["provider_id"]].join(own, on=keys + ["provider_id"]).fillna(0)
        count = (at_clinic["count"] - mine["count"]).to_numpy()
        total = (at_clinic["sum"] - mine["sum"]).to_numpy()
        average = np.where(count > 0, total / np.maximum(count, 1), np.nan)
        return average, count

    rows["clinic_level"], rows["clinic_rows"] = others_average(["clinic"])
    rows["clinic_same_code"], _ = others_average(["clinic", "code"])
    return rows
