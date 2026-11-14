"""Pull Maryland provider charges for our service codes from the CMS public API.

Dataset: Medicare Physician & Other Practitioners by Provider and Service.
Each row is one provider + one service code + one place of service, with that
provider's average submitted charge.

The API is public, so there is no API key.

Run from the repo root:
    python data/pull_cms.py

Output: data/cms_md_services.csv
"""

import csv
import time
from pathlib import Path

import requests

API_URL = "https://data.cms.gov/data-api/v1/dataset/92396110-2aed-4d63-a6a2-5d6207d46a29/data"
STATE = "MD"
PAGE_SIZE = 5000
MAX_TRIES = 5

# Services students actually use. The TB skin test (86580) is left out on
# purpose: Maryland only has 2 rows for it, which is not enough to train on.
SERVICES = {
    "99213": "Office visit, established patient",
    "99203": "Office visit, new patient",
    "87880": "Rapid strep test",
    "87804": "Rapid flu test",
    "90471": "Vaccine administration",
    "85025": "Complete blood count",
}

# We keep only the columns the model needs. Provider names and street addresses
# are dropped; the NPI stays because the train/test split is done by provider.
KEEP_COLUMNS = [
    "Rndrng_NPI",
    "Rndrng_Prvdr_Type",
    "Rndrng_Prvdr_Ent_Cd",
    "Rndrng_Prvdr_City",
    "Rndrng_Prvdr_Zip5",
    "HCPCS_Cd",
    "HCPCS_Desc",
    "Place_Of_Srvc",
    "Tot_Benes",
    "Tot_Srvcs",
    "Avg_Sbmtd_Chrg",
    "Avg_Mdcr_Alowd_Amt",
]

OUT_PATH = Path(__file__).parent / "cms_md_services.csv"


def filters(code):
    return {
        "filter[Rndrng_Prvdr_State_Abrvtn]": STATE,
        "filter[HCPCS_Cd]": code,
    }


def get_json(url, params):
    """GET a URL and return its JSON. The CMS server sometimes drops a
    connection, so we retry a few times before giving up."""
    for attempt in range(1, MAX_TRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as error:
            if attempt == MAX_TRIES:
                raise
            print(f"  request failed ({type(error).__name__}), retry {attempt} of {MAX_TRIES - 1}")
            time.sleep(3 * attempt)


def expected_rows(code):
    """Ask the API how many rows match, so we can check we got them all."""
    return get_json(API_URL + "/stats", filters(code))["found_rows"]


def fetch_code(code):
    """Download every Maryland row for one service code, one page at a time."""
    rows = []
    while True:
        page = get_json(API_URL, filters(code) | {"size": PAGE_SIZE, "offset": len(rows)})
        if not page:  # an empty page means we have reached the end
            break
        rows.extend(page)
    return rows


def main():
    all_rows = []
    for code, name in SERVICES.items():
        rows = fetch_code(code)
        expected = expected_rows(code)
        print(f"{code}  {name:<36} {len(rows):>6} rows (API says {expected})")
        if len(rows) != expected:
            raise SystemExit(f"Row count mismatch for {code}. Stopping so we do not train on partial data.")
        all_rows.extend(rows)

    # One provider + code + place of service should appear exactly once.
    keys = {(r["Rndrng_NPI"], r["HCPCS_Cd"], r["Place_Of_Srvc"]) for r in all_rows}
    if len(keys) != len(all_rows):
        raise SystemExit("Duplicate rows found. Paging returned overlapping pages.")

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=KEEP_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    providers = len({r["Rndrng_NPI"] for r in all_rows})
    print(f"\nSaved {len(all_rows)} rows from {providers} providers to {OUT_PATH}")


if __name__ == "__main__":
    main()
