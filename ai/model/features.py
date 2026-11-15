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

# Where a provider works, from most exact to least exact:
#   clinic    street address + suite + ZIP   (one practice)
#   street    street address + ZIP           (can hold several practices)
#   building  street address with any suite words removed + ZIP
#   zip5      the 5-digit ZIP
LEVELS = ["clinic", "street", "building", "zip5"]

# An earlier version of the clinic model, kept so experiments.py can show what
# each step added: how the same street address prices compared with typical.
STREET_FEATURES = AREA_FEATURES + ["street_level", "street_same_code", "street_rows"]

# Final model: the four area features, plus how OTHER providers at each level
# price compared with typical. For every level there are six numbers: the
# middle price gap, how spread out the gaps are and how many rows they come
# from, once across all services and once for the same service ("_code").
# They are empty when we have no data at that level.
LOCATION_FEATURES = AREA_FEATURES + [
    f"{level}{kind}_{stat}" for level in LEVELS for kind in ("", "_code") for stat in ("median", "spread", "n")
]

# The model's starting guess, in log dollars: the typical price for the service
# moved by the price gap of the closest peers we know. The model then only has
# to learn the correction to this guess (see train_model in train.py).
OFFSET = "peer_base"

# A patient usually does not know what type of clinician they will see. When no
# provider type is given, the range covers these four common primary-care types.
PRIMARY_CARE_TYPES = [
    "Family Practice",
    "Internal Medicine",
    "Nurse Practitioner",
    "Physician Assistant",
]


def clean(text):
    """Upper-case, and drop punctuation and extra spaces, so that
    "8630 Fenton St." and "8630 FENTON ST" count as the same place."""
    text = text.str.upper().str.replace(r"[^A-Z0-9 ]", "", regex=True)
    return text.str.replace(r"\s+", " ", regex=True).str.strip()


def street_id(street, zip5):
    """One ID per street address: the cleaned street line plus the ZIP."""
    return clean(street) + "|" + zip5


def clinic_id(street, suite, zip5):
    """One ID per clinic: street address, suite (when there is one) and ZIP.

    Several practices can share a street address and charge different prices.
    The suite line tells them apart. With no suite, this is the street ID.
    """
    suite = clean(suite)
    return clean(street) + ("|" + suite).where(suite != "", "") + "|" + zip5


def building_id(street, zip5):
    """The street address with any suite written into it removed, plus the ZIP.
    "600 E Belvedere Ave Ste A" and "600 E Belvedere Ave Ste C" share a building."""
    street = clean(street).str.replace(r"\b(STE|SUITE|UNIT|RM|ROOM|FL|FLOOR|APT|BLDG|BUILDING)\b.*$", "", regex=True)
    return street.str.strip() + "|" + zip5


def load_data():
    """Read the CMS rows and build the basic columns."""
    raw = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False)
    street, zip5 = raw["Rndrng_Prvdr_St1"], raw["Rndrng_Prvdr_Zip5"]
    suite = raw["Rndrng_Prvdr_St2"].str.strip()  # second address line, usually a suite number
    data = pd.DataFrame(
        {
            "provider_id": raw["Rndrng_NPI"],
            "code": raw["HCPCS_Cd"],
            "provider_type": raw["Rndrng_Prvdr_Type"],
            "place": raw["Place_Of_Srvc"],  # O = office, F = facility
            "zip3": zip5.str[:3],
            "zip5": zip5,
            "clinic": clinic_id(street, suite, zip5),
            "street": street_id(street, zip5),
            "building": building_id(street, zip5),
            "address": street + (", " + suite).where(suite != "", ""),
            "city": raw["Rndrng_Prvdr_City"],
            "charge": pd.to_numeric(raw["Avg_Sbmtd_Chrg"], errors="coerce"),
        }
    )
    data = data[data["code"].isin(SERVICES) & (data["charge"] > 0)]
    return data.reset_index(drop=True)


def price_reference(train):
    """How far each training row's price is from the typical price for its code.

    "gap" is on a log scale, so 0 means typical, about +0.2 means roughly 20%
    above typical and about -0.2 means roughly 20% below. The location features
    are built from these gaps. "typical_log" is the typical price for the row's
    code, in log dollars.
    """
    log_charge = np.log(train["charge"])
    typical = log_charge.groupby(train["code"]).median()
    reference = train[LEVELS + ["code", "provider_id"]].copy()
    reference["typical_log"] = train["code"].map(typical)
    reference["gap"] = log_charge - reference["typical_log"]
    return reference


def others_gap(rows, reference, keys):
    """For each row: the price gaps of OTHER providers that share `keys` with it.

    Returns their mean, median, spread (standard deviation) and count, one line
    per row. "Other providers" matters: a provider's own prices are never used
    for their own row. Otherwise the model would be handed the answer during
    training and look far better than it really is. In the app there is no
    "own" provider, so every reference row is used.
    """
    wanted = rows[keys + ["provider_id"]].copy()
    wanted["row"] = np.arange(len(wanted))
    pairs = wanted.merge(reference[keys + ["provider_id", "gap"]], on=keys, suffixes=("", "_other"))
    pairs = pairs[pairs["provider_id"] != pairs["provider_id_other"]]
    stats = pairs.groupby("row")["gap"].agg(["mean", "median", "std", "count"])
    return stats.reindex(np.arange(len(wanted))).set_index(rows.index)


def add_clinic_features(rows, reference):
    """Add the location features and the starting guess to `rows`.

    `rows` needs the columns in LEVELS plus "code". Only the reference rows
    (the training providers) are used, so nothing about a test provider's own
    prices can leak into their features.
    """
    rows = rows.copy()
    if "provider_id" not in rows:
        rows["provider_id"] = ""

    for level in LEVELS:
        for kind, keys in (("", [level]), ("_code", [level, "code"])):
            stats = others_gap(rows, reference, keys)
            rows[f"{level}{kind}_median"] = stats["median"]
            rows[f"{level}{kind}_spread"] = stats["std"]
            rows[f"{level}{kind}_n"] = stats["count"].fillna(0)
            if level == "street":  # the three features of the earlier model use the mean
                rows["street_same_code" if kind else "street_level"] = stats["mean"]
    rows["street_rows"] = rows["street_n"]

    # Starting guess: the gap of the closest peers we have. Same service at the
    # same clinic first, then wider and wider, and typical (gap 0) if nothing is known.
    peer_gap = rows["clinic_code_median"]
    for wider in ("street_code_median", "clinic_median", "street_median", "building_code_median", "building_median"):
        peer_gap = peer_gap.fillna(rows[wider])
    typical = reference.groupby("code")["typical_log"].first()
    rows[OFFSET] = rows["code"].map(typical) + peer_gap.fillna(0.0)
    return rows
