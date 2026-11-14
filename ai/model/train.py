"""Train and evaluate the cost model.

Reads the CSV made by data/pull_cms.py, trains three gradient boosting models
(10th, 50th and 90th percentile of price), tests them on providers the models
never saw, and saves the model plus metrics.json.

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
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OrdinalEncoder

from predict import (
    FEATURES,
    MODEL_PATH,
    PRIMARY_CARE_TYPES,
    estimate,
    predict_ranges,
    predict_ranges_any_primary_care,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = REPO_ROOT / "data" / "cms_md_services.csv"
METRICS_PATH = Path(__file__).parent / "metrics.json"

SERVICES = {
    "99213": "Office visit, established patient",
    "99203": "Office visit, new patient",
    "87880": "Rapid strep test",
    "87804": "Rapid flu test",
    "90471": "Vaccine administration",
    "85025": "Complete blood count",
}

QUANTILES = (0.1, 0.5, 0.9)  # low, typical, high
TEST_SHARE = 0.2
SEED = 42


def load_data():
    """Read the CMS rows and build the four features and the target."""
    raw = pd.read_csv(DATA_PATH, dtype=str)
    data = pd.DataFrame(
        {
            "provider_id": raw["Rndrng_NPI"],
            "code": raw["HCPCS_Cd"],
            "provider_type": raw["Rndrng_Prvdr_Type"],
            "place": raw["Place_Of_Srvc"],  # O = office, F = facility
            "zip3": raw["Rndrng_Prvdr_Zip5"].str[:3],
            "charge": pd.to_numeric(raw["Avg_Sbmtd_Chrg"], errors="coerce"),
        }
    )
    data = data[data["code"].isin(SERVICES) & (data["charge"] > 0)].dropna()
    return data.reset_index(drop=True)


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


def train_models(train):
    """Train one gradient boosting model per percentile.

    The target is log(charge) because prices are skewed: a few providers bill
    several times the usual amount. All four features are categories, so they
    are turned into integer labels first. Categories with fewer than 20 rows
    are grouped together, and a category never seen in training (a new ZIP,
    say) gets -1, which the model treats as "unknown".
    """
    models = {}
    for quantile in QUANTILES:
        model = make_pipeline(
            OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1, min_frequency=20),
            HistGradientBoostingRegressor(
                loss="quantile",
                quantile=quantile,
                categorical_features=list(range(len(FEATURES))),
                max_iter=300,
                learning_rate=0.05,
                max_depth=4,
                min_samples_leaf=20,
                random_state=SEED,
            ),
        )
        model.fit(train[FEATURES], np.log(train["charge"]))
        models[quantile] = model
    return models


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
        "mae_dollars": round(error.mean(), 2),
        # Half of predictions are closer than this, as a percent of the real charge.
        "median_pct_error": round((error / actual).median() * 100, 1),
        # Share of real charges that fall inside low..high. The goal is about 80%.
        "range_coverage_pct": round(inside.mean() * 100, 1),
        "avg_range_width_dollars": round((ranges["high"] - ranges["low"]).mean(), 2),
    }


def evaluate(models, train, test):
    model_ranges = predict_ranges(models, test)
    simple_ranges = baseline_ranges(train, test)
    actual = test["charge"]

    per_service = {}
    for code, name in SERVICES.items():
        rows = test["code"] == code
        per_service[code] = {
            "service": name,
            "test_rows": int(rows.sum()),
            "model": score(model_ranges[rows], actual[rows]),
            "baseline": score(simple_ranges[rows], actual[rows]),
        }

    # The app usually does not know the provider type, so it shows a range that
    # covers the four primary-care types. Test that range too, on the held-out
    # primary-care providers, because it is what users actually see. The
    # baseline is scored on the same rows so the comparison is fair.
    primary_care = test[test["provider_type"].isin(PRIMARY_CARE_TYPES)]
    app_default = {
        "test_rows": len(primary_care),
        "model": score(predict_ranges_any_primary_care(models, primary_care), primary_care["charge"]),
        "baseline": score(simple_ranges.loc[primary_care.index], primary_care["charge"]),
    }

    model_score = score(model_ranges, actual)
    baseline_score = score(simple_ranges, actual)
    improvement = 1 - model_score["mae_dollars"] / baseline_score["mae_dollars"]
    return {
        "headline": {
            "model_mae_dollars": model_score["mae_dollars"],
            "baseline_mae_dollars": baseline_score["mae_dollars"],
            "mae_improvement_pct": round(improvement * 100, 1),
            "app_range_coverage_pct": app_default["model"]["range_coverage_pct"],
        },
        "model": model_score,
        "baseline": baseline_score,
        "app_default_range": app_default,
        "per_service": per_service,
    }


def main():
    data = load_data()
    train, test = split_by_provider(data)
    models = train_models(train)
    metrics = evaluate(models, train, test)

    metrics["about"] = {
        "target": "Average submitted charge per provider and service (billed to Medicare)",
        "data": "CMS Medicare Physician & Other Practitioners by Provider and Service, Maryland",
        "model": "scikit-learn HistGradientBoostingRegressor, quantile loss at 0.1, 0.5, 0.9, on log(charge)",
        "baseline": "Median charge per service code, range = 10th to 90th percentile per code",
        "features": FEATURES,
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
            "models": models,
            "services": SERVICES,
            "places_by_code": train.groupby("code")["place"].unique().map(list).to_dict(),
            "known_zip3": sorted(train["zip3"].value_counts().loc[lambda counts: counts >= 20].index),
        },
        MODEL_PATH,
    )

    print(f"Trained on {len(train)} rows, tested on {len(test)} rows from providers the model never saw.\n")
    print(f"{'':<36}{'model':>10}{'baseline':>10}")
    labels = {
        "mae_dollars": "Average error ($)",
        "median_pct_error": "Median error (%)",
        "range_coverage_pct": "Charges inside the range (%)",
        "avg_range_width_dollars": "Average range width ($)",
    }
    for key, label in labels.items():
        print(f"{label:<36}{metrics['model'][key]:>10}{metrics['baseline'][key]:>10}")
    print("\nAverage error by service ($):")
    for code, result in metrics["per_service"].items():
        print(f"  {code} {result['service']:<36}{result['model']['mae_dollars']:>8}{result['baseline']['mae_dollars']:>10}")

    app = metrics["app_default_range"]
    print(f"\nWhat the app shows by default (provider type unknown), on {app['test_rows']} held-out primary-care rows:")
    for key, label in labels.items():
        print(f"{label:<36}{app['model'][key]:>10}{app['baseline'][key]:>10}")

    # Load the file we just saved and run one estimate, to prove it works end to end.
    example = estimate("87880", "21252")
    print(f"Example, rapid strep test near Towson: ${example['low']} to ${example['high']}, typical ${example['typical']}")
    print(f"Saved {MODEL_PATH.name} and {METRICS_PATH.name} in {MODEL_PATH.parent}")


if __name__ == "__main__":
    main()
