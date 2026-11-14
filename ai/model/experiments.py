"""Experiments behind the cost model: what we tried, in order, and what it did.

Every number here comes from cross-validation on the TRAINING providers only.
The 20% of providers held out for the final test are never touched, so we can
try as many ideas as we like here without fooling ourselves. The final test
lives in train.py and is run once on the model we settled on.

How the cross-validation works: the training providers are cut into four
groups. Four times over, a model trains on three groups and is tested on the
fourth, and the four errors are averaged. Providers never straddle groups.

Run from the repo root (takes a few minutes):
    python ai/model/experiments.py

Output: ai/model/experiments.json, which charts.py turns into charts.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from features import AREA_FEATURES, LOCATION_FEATURES, OFFSET, STREET_FEATURES, add_clinic_features, load_data, price_reference
from train import QUANTILES, SEED, make_model, split_by_provider

OUT_PATH = Path(__file__).parent / "experiments.json"
FOLDS = 4


def cross_validate(train, features, share=1.0, with_ranges=True, offset=None, **model_settings):
    """Average error of one model recipe across the four folds.

    share < 1 trains on only that share of the training providers, which is how
    we check whether more data would help.
    """
    results = []
    for fit_rows, check_rows in GroupKFold(n_splits=FOLDS).split(train, groups=train["provider_id"]):
        fit, check = train.iloc[fit_rows], train.iloc[check_rows]
        if share < 1:
            providers = pd.Series(fit["provider_id"].unique()).sample(frac=share, random_state=SEED)
            fit = fit[fit["provider_id"].isin(providers)]

        # Clinic price levels are rebuilt inside every fold from the fitting
        # rows only, exactly as the final model builds them from training rows.
        reference = price_reference(fit)
        fit, check = add_clinic_features(fit, reference), add_clinic_features(check, reference)

        # With an offset the model learns the correction to a starting guess
        # (what the closest peers charge), as train_model does in train.py.
        start_fit = fit[offset] if offset else 0
        start_check = check[offset].to_numpy() if offset else 0
        target = np.log(fit["charge"]) - start_fit
        quantiles = QUANTILES if with_ranges else (0.5,)
        predictions = {}
        for q in quantiles:
            model = make_model(q, features)
            model.set_params(**{f"histgradientboostingregressor__{k}": v for k, v in model_settings.items()})
            predictions[q] = np.exp(model.fit(fit[features], target).predict(check[features]) + start_check)

        actual = check["charge"].to_numpy()
        baseline = check["code"].map(fit.groupby("code")["charge"].median()).to_numpy()
        fold = {
            "mae_dollars": np.abs(predictions[0.5] - actual).mean(),
            "median_pct_error": np.median(np.abs(predictions[0.5] - actual) / actual) * 100,
            "baseline_mae_dollars": np.abs(baseline - actual).mean(),
            "baseline_median_pct_error": np.median(np.abs(baseline - actual) / actual) * 100,
        }
        if with_ranges:
            low, _, high = np.sort(np.column_stack([predictions[q] for q in QUANTILES]), axis=1).T
            fold["range_coverage_pct"] = ((actual >= low) & (actual <= high)).mean() * 100
        results.append(fold)
    return {key: round(float(value), 2) for key, value in pd.DataFrame(results).mean().items()}


def main():
    train, _ = split_by_provider(load_data())  # the held-out test providers are dropped here
    train = train.assign(zip5_number=train["zip5"].astype(float))

    # 1. Build the model up one piece of information at a time.
    steps = [
        ("Service code only", ["code"], None),
        ("+ office or facility", ["code", "place"], None),
        ("+ region (first 3 ZIP digits)", ["code", "place", "zip3"], None),
        ("+ provider type", AREA_FEATURES, None),
        ("+ price level at the same street address", STREET_FEATURES, None),
        ("+ suite, building and ZIP price levels", LOCATION_FEATURES, OFFSET),
    ]
    progression = []
    for label, features, offset in steps:
        result = cross_validate(train, features, offset=offset)
        progression.append({"step": label, "features": features, **result})
        print(f"{label:<34} error ${result['mae_dollars']:<7} median {result['median_pct_error']}%  coverage {result['range_coverage_pct']}%")
    baseline = {"step": "Baseline: median price per service", "mae_dollars": progression[0]["baseline_mae_dollars"],
                "median_pct_error": progression[0]["baseline_median_pct_error"]}
    print(f"{'Baseline':<34} error ${baseline['mae_dollars']}")

    # 2. Ideas we tested on the area model and did not keep.
    not_kept = []
    ideas = [
        ("Full 5-digit ZIP as an extra feature", AREA_FEATURES + ["zip5_number"], {}),
        ("Deeper trees (depth 6 instead of 4)", AREA_FEATURES, {"max_depth": 6}),
        ("Twice as many boosting rounds (600)", AREA_FEATURES, {"max_iter": 600}),
    ]
    area_error = progression[3]["mae_dollars"]
    for label, features, settings in ideas:
        result = cross_validate(train, features, **settings)
        change = round((result["mae_dollars"] / area_error - 1) * 100, 1)
        not_kept.append({"idea": label, **result, "change_vs_area_model_pct": change})
        print(f"{label:<40} error ${result['mae_dollars']:<7} ({change:+}% vs area model)")

    # 3. Would more of the same data help? Train on a growing share of providers.
    learning_curve = []
    for share in (0.1, 0.25, 0.5, 0.75, 1.0):
        area = cross_validate(train, AREA_FEATURES, share=share, with_ranges=False)
        clinic = cross_validate(train, LOCATION_FEATURES, share=share, with_ranges=False, offset=OFFSET)
        learning_curve.append({
            "share_of_training_providers": share,
            "baseline_mae_dollars": area["baseline_mae_dollars"],
            "area_model_mae_dollars": area["mae_dollars"],
            "clinic_model_mae_dollars": clinic["mae_dollars"],
        })
        print(f"{int(share * 100):>3}% of providers: area ${area['mae_dollars']}  clinic ${clinic['mae_dollars']}  baseline ${area['baseline_mae_dollars']}")

    OUT_PATH.write_text(json.dumps({
        "method": f"{FOLDS}-fold cross-validation grouped by provider, on the {len(train)} training rows only. The held-out test set is not used.",
        "baseline": baseline,
        "progression": progression,
        "not_kept": not_kept,
        "learning_curve": learning_curve,
    }, indent=2) + "\n")
    print(f"Saved {OUT_PATH.name}")


if __name__ == "__main__":
    main()
