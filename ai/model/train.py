"""Train and test the cost model.

Reads the CSV made by data/pull_cms.py and trains two models:

  area model    price range from the service, provider type, setting and region
  clinic model  the same, plus how that clinic prices compared with typical

Each one is really three gradient boosting models, for the 10th, 50th and 90th
percentile of price, so the app can show a range. Both are tested on providers
they never saw, next to a simple baseline, and the results go to metrics.json.

Run from the repo root:
    python ai/model/train.py
"""

import json
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import make_column_transformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OrdinalEncoder

from features import (
    AREA_FEATURES,
    CLINIC_FEATURES,
    PRIMARY_CARE_TYPES,
    SERVICES,
    add_clinic_features,
    load_data,
    price_reference,
)
from predict import MODEL_PATH, clinics_near, estimate_visit, predict_ranges, predict_ranges_any_primary_care

METRICS_PATH = Path(__file__).parent / "metrics.json"
PREDICTIONS_PATH = Path(__file__).parent / "test_predictions.csv"

QUANTILES = (0.1, 0.5, 0.9)  # low, typical, high
TEST_SHARE = 0.2
SEED = 42
OFFICE_VISITS = ["99213", "99203"]


def split_by_provider(data):
    """Hold out 20% of providers, not 20% of rows.

    One provider can have several rows (different codes or settings). If the
    same provider were in both train and test, the model would be tested on
    someone whose prices it had already seen, and the error would look better
    than it really is.
    """
    splitter = GroupShuffleSplit(n_splits=1, test_size=TEST_SHARE, random_state=SEED)
    train_rows, test_rows = next(splitter.split(data, groups=data["provider_id"]))
    return data.iloc[train_rows], data.iloc[test_rows]


def make_model(quantile, features):
    """One gradient boosting model that predicts one percentile of log(price).

    The four area features are categories, so they are turned into integer
    labels first. Categories with fewer than 20 rows are grouped together, and
    a category never seen in training (a new ZIP, say) gets -1, which the model
    treats as "unknown". The clinic features are already numbers and pass
    straight through; the model handles their empty values itself.
    """
    categories = [name for name in features if name in AREA_FEATURES]
    numeric = [name for name in features if name not in AREA_FEATURES]
    transformers = [(OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1, min_frequency=20), categories)]
    if numeric:
        transformers.append(("passthrough", numeric))
    return make_pipeline(
        make_column_transformer(*transformers),
        HistGradientBoostingRegressor(
            loss="quantile",
            quantile=quantile,
            categorical_features=list(range(len(categories))),
            max_iter=300,
            learning_rate=0.05,
            max_depth=4,
            min_samples_leaf=20,
            random_state=SEED,
        ),
    )


def train_model(train, features):
    """Train the low, typical and high models on one set of features.

    The target is log(charge) because prices are skewed: a few providers bill
    several times the usual amount.
    """
    target = np.log(train["charge"])
    fitted = {q: make_model(q, features).fit(train[features], target) for q in QUANTILES}
    return {"features": features, "quantiles": fitted}


def baseline_ranges(train, test):
    """The simple baseline: the same range for everyone getting a service.

    Typical = median charge for that code in the training data, and the range
    is the 10th to 90th percentile for that code.
    """
    by_code = train.groupby("code")["charge"]
    return pd.DataFrame(
        {
            "low": test["code"].map(by_code.quantile(0.1)),
            "typical": test["code"].map(by_code.median()),
            "high": test["code"].map(by_code.quantile(0.9)),
        }
    )


def score(ranges, actual):
    """Compare predicted ranges with the charges providers really billed."""
    error = (ranges["typical"] - actual).abs()
    inside = (actual >= ranges["low"]) & (actual <= ranges["high"])
    return {
        # Average dollars between the typical price and the real charge.
        "mae_dollars": round(float(error.mean()), 2),
        # Half of predictions are closer than this, as a percent of the real charge.
        "median_pct_error": round(float((error / actual).median() * 100), 1),
        # Share of real charges that fall inside low..high. The goal is about 80%.
        "range_coverage_pct": round(float(inside.mean() * 100), 1),
        "avg_range_width_dollars": round(float((ranges["high"] - ranges["low"]).mean()), 2),
    }


def compare(predictions, actual, rows):
    """Score every set of predictions on the same subset of test rows."""
    result = {"test_rows": int(rows.sum())}
    for name, ranges in predictions.items():
        result[name] = score(ranges[rows], actual[rows])
    return result


def clinic_price_consistency(train):
    """The finding behind the clinic model, measured on the training rows.

    How far is a provider's price from the usual price for that service?
    Compared with the whole state it is far. Compared with other providers at
    the same clinic it is almost nothing, which is why the clinic's own price
    level is such a strong feature.
    """
    charge = train["charge"]
    statewide = charge.groupby(train["code"]).transform("median")
    at_clinic = charge.groupby([train["clinic"], train["code"]]).transform("median")
    shared = charge.groupby([train["clinic"], train["code"]]).transform("size") >= 2
    return {
        "median_gap_from_statewide_price_pct": round(float(((charge - statewide).abs() / statewide).median() * 100), 1),
        "median_gap_from_same_clinic_price_pct": round(float(((charge - at_clinic).abs() / at_clinic)[shared].median() * 100), 1),
        "rows_at_a_clinic_with_2_or_more_rows_for_the_service": int(shared.sum()),
        "clinics_in_training_data": int(train["clinic"].nunique()),
    }


def visit_total_check(test, ranges):
    """Test the totals the app shows for a visit with two services.

    The app adds the ranges of an office visit and an add-on such as a strep
    test. Some held-out providers bill both, so for them we know the real
    total and can check how often it falls inside the added-up range.
    """
    office = test[test["place"] == "O"].reset_index()
    visits = office[office["code"].isin(OFFICE_VISITS)]
    addons = office[~office["code"].isin(OFFICE_VISITS)]
    pairs = visits.merge(addons, on="provider_id", suffixes=("_visit", "_addon"))
    actual_total = pairs["charge_visit"] + pairs["charge_addon"]
    predicted_total = pd.DataFrame(
        ranges.loc[pairs["index_visit"]].to_numpy() + ranges.loc[pairs["index_addon"]].to_numpy(),
        columns=ranges.columns,
    )
    strep = (pairs["code_addon"] == "87880").to_numpy()
    return {
        "all_visit_plus_addon_pairs": {"pairs": len(pairs), **score(predicted_total, actual_total)},
        "visit_plus_strep_test": {"pairs": int(strep.sum()), **score(predicted_total[strep], actual_total[strep])},
    }


def evaluate(area_model, clinic_model, train, test):
    actual = test["charge"]
    clinic_in_data = test["clinic_rows"] > 0
    primary_care = test["provider_type"].isin(PRIMARY_CARE_TYPES)

    def use_clinic_when_known(area_ranges, clinic_ranges):
        """What the app does: the clinic model when the clinic is in our data,
        the area model when it is not."""
        return clinic_ranges.where(clinic_in_data, area_ranges)

    # 1. Provider type known. This is the plain test of the models.
    area = predict_ranges(area_model, test)
    known_type = {
        "baseline": baseline_ranges(train, test),
        "area_model": area,
        "final_model": use_clinic_when_known(area, predict_ranges(clinic_model, test)),
    }

    # 2. Provider type unknown. The app usually does not know it, so it shows a
    # range that covers the four primary-care types. Test that range on the
    # held-out primary-care providers, because it is what users actually see.
    area_default = predict_ranges_any_primary_care(area_model, test)
    app_shows = {
        "baseline": known_type["baseline"],
        "area_estimate": area_default,
        "final_estimate": use_clinic_when_known(area_default, predict_ranges_any_primary_care(clinic_model, test)),
    }

    everyone = pd.Series(True, index=test.index)
    per_service = {}
    for code, name in SERVICES.items():
        per_service[code] = {"service": name, **compare(known_type, actual, test["code"] == code)}

    app_per_service = {}
    for code, name in SERVICES.items():
        app_per_service[code] = {"service": name, **compare(app_shows, actual, primary_care & (test["code"] == code))}

    # Every held-out prediction, saved so anyone can check the numbers and so
    # charts.py can plot predicted against real prices.
    final = known_type["final_model"]
    predictions = pd.DataFrame(
        {
            "code": test["code"],
            "provider_type": test["provider_type"],
            "clinic_in_data": clinic_in_data,
            "actual_charge": actual,
            "baseline_typical": known_type["baseline"]["typical"].round(2),
            "area_model_typical": area["typical"].round(2),
            "final_model_low": final["low"].round(2),
            "final_model_typical": final["typical"].round(2),
            "final_model_high": final["high"].round(2),
        }
    )

    all_rows = compare(known_type, actual, everyone)
    known = compare(known_type, actual, clinic_in_data)
    metrics = {
        "headline": {
            "baseline_mae_dollars": all_rows["baseline"]["mae_dollars"],
            "area_model_mae_dollars": all_rows["area_model"]["mae_dollars"],
            "final_model_mae_dollars": all_rows["final_model"]["mae_dollars"],
            "final_vs_baseline_improvement_pct": round((1 - all_rows["final_model"]["mae_dollars"] / all_rows["baseline"]["mae_dollars"]) * 100, 1),
            "clinic_in_data_share_pct": round(float(clinic_in_data.mean() * 100), 1),
            "clinic_in_data_baseline_mae_dollars": known["baseline"]["mae_dollars"],
            "clinic_in_data_final_mae_dollars": known["final_model"]["mae_dollars"],
            "clinic_in_data_final_median_pct_error": known["final_model"]["median_pct_error"],
        },
        "provider_type_known": {
            "all_held_out": all_rows,
            "clinic_in_data": known,
            "clinic_not_in_data": compare(known_type, actual, ~clinic_in_data),
        },
        "what_the_app_shows": {
            "primary_care": compare(app_shows, actual, primary_care),
            "primary_care_clinic_in_data": compare(app_shows, actual, primary_care & clinic_in_data),
            "primary_care_clinic_not_in_data": compare(app_shows, actual, primary_care & ~clinic_in_data),
            "per_service": app_per_service,
        },
        "per_service": per_service,
        "visit_totals": visit_total_check(test[primary_care], app_shows["final_estimate"]),
    }
    return metrics, predictions


def print_table(title, block, columns):
    labels = {
        "mae_dollars": "Average error ($)",
        "median_pct_error": "Median error (%)",
        "range_coverage_pct": "Charges inside the range (%)",
        "avg_range_width_dollars": "Average range width ($)",
    }
    print(f"\n{title} ({block['test_rows']} rows)")
    print(f"{'':<32}" + "".join(f"{name:>16}" for name in columns))
    for key, label in labels.items():
        print(f"{label:<32}" + "".join(f"{block[name][key]:>16}" for name in columns))


def main():
    data = load_data()
    train, test = split_by_provider(data)

    # Clinic price levels come from the training providers only. A test
    # provider's own prices are never part of their features.
    reference = price_reference(train)
    train = add_clinic_features(train, reference)
    test = add_clinic_features(test, reference)

    area_model = train_model(train, AREA_FEATURES)
    clinic_model = train_model(train, CLINIC_FEATURES)
    metrics, predictions = evaluate(area_model, clinic_model, train, test)
    predictions.to_csv(PREDICTIONS_PATH, index=False)

    metrics["clinic_price_consistency"] = clinic_price_consistency(train)
    metrics["about"] = {
        "target": "Average submitted charge per provider and service (billed to Medicare)",
        "data": "CMS Medicare Physician & Other Practitioners by Provider and Service, 2024, Maryland",
        "model": "scikit-learn HistGradientBoostingRegressor, quantile loss at 0.1, 0.5, 0.9, on log(charge)",
        "baseline": "Median charge per service code, range = 10th to 90th percentile per code",
        "area_model_features": AREA_FEATURES,
        "clinic_model_features": CLINIC_FEATURES,
        "final_model": "Clinic model when the clinic is in the training data, area model otherwise",
        "clinic": "Providers that share a street address and ZIP",
        "split": "20% of providers held out, grouped by provider so none appear in both sets",
        "rows": {"train": len(train), "test": len(test)},
        "providers": {"train": train["provider_id"].nunique(), "test": test["provider_id"].nunique()},
        "trained_on": date.today().isoformat(),
        "scikit_learn_version": sklearn.__version__,
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2) + "\n")

    # Everything the /estimate endpoint needs, in one file.
    joblib.dump(
        {
            "area_model": area_model,
            "clinic_model": clinic_model,
            "services": SERVICES,
            "places_by_code": train.groupby("code")["place"].unique().map(list).to_dict(),
            "known_zip3": sorted(train["zip3"].value_counts().loc[lambda counts: counts >= 20].index),
            "reference": reference,
            "clinics": train.groupby("clinic").agg(
                address=("address", "first"),
                city=("city", "first"),
                zip5=("zip5", "first"),
                providers=("provider_id", "nunique"),
            ),
        },
        MODEL_PATH,
    )

    print(f"Trained on {len(train)} rows, tested on {len(test)} rows from providers the model never saw.")
    known_type = metrics["provider_type_known"]
    columns = ["baseline", "area_model", "final_model"]
    print_table("All held-out providers", known_type["all_held_out"], columns)
    print_table("Held-out providers whose clinic is in our data", known_type["clinic_in_data"], columns)
    print_table("Held-out providers whose clinic is not in our data", known_type["clinic_not_in_data"], columns)
    app_columns = ["baseline", "area_estimate", "final_estimate"]
    print_table("What the app shows, primary care, provider type unknown", metrics["what_the_app_shows"]["primary_care"], app_columns)
    print_table("  ...of those, clinic in our data", metrics["what_the_app_shows"]["primary_care_clinic_in_data"], app_columns)

    print("\nAverage error by service ($):")
    print(f"{'':<44}" + "".join(f"{name:>14}" for name in columns))
    for code, result in metrics["per_service"].items():
        print(f"  {code} {result['service']:<36}" + "".join(f"{result[name]['mae_dollars']:>14}" for name in columns))

    totals = metrics["visit_totals"]["all_visit_plus_addon_pairs"]
    print(f"\nVisit totals: on {totals['pairs']} held-out providers who bill an office visit and an add-on, "
          f"the added-up range contained the real total {totals['range_coverage_pct']}% of the time.")

    # Load the file we just saved and run the demo, to prove it works end to end.
    visit = estimate_visit("strep", "21204")
    print(f"\nExample, new-patient strep visit near Towson (area estimate): ${visit['total']['low']} to ${visit['total']['high']}, typical ${visit['total']['typical']}")
    for option in clinics_near("21204", "87880", limit=3):
        print(f"  strep test at {option['clinic']['address']}, {option['clinic']['city']}: ${option['low']} to ${option['high']}, typical ${option['typical']}")
    print(f"Saved {MODEL_PATH.name}, {METRICS_PATH.name} and {PREDICTIONS_PATH.name} in {MODEL_PATH.parent}")


if __name__ == "__main__":
    main()
