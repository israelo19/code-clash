"""Checks that the saved cost model behaves sensibly.

These are not accuracy tests (train.py does those on held-out providers). They
catch broken behavior: a range that is upside down, a total that does not add
up, or a crash on unusual input.

Run from the repo root:
    python -m pytest ai/tests
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from model.features import SERVICES
from model.predict import VISITS, clinics_near, estimate, estimate_total, estimate_visit

ZIPS = ["21204", "20742", "21502", "21801"]  # Towson, College Park, Cumberland, Salisbury


@pytest.mark.parametrize("code", SERVICES)
@pytest.mark.parametrize("zip_code", ZIPS)
def test_range_is_in_order_and_positive(code, zip_code):
    price = estimate(code, zip_code)
    assert 0 < price["low"] <= price["typical"] <= price["high"]
    assert price["based_on"] == "area"
    assert "Estimate only" in price["caveat"]


def test_new_patient_visit_costs_more_than_established():
    assert estimate("99203", "21204")["typical"] > estimate("99213", "21204")["typical"]


def test_total_adds_up():
    result = estimate_total(["99203", "87880"], "21204")
    for key in ("low", "typical", "high"):
        assert result["total"][key] == sum(item[key] for item in result["items"])


@pytest.mark.parametrize("visit", VISITS)
def test_named_visits_include_the_office_visit(visit):
    new = estimate_visit(visit, "21204", new_patient=True)
    returning = estimate_visit(visit, "21204", new_patient=False)
    assert new["items"][0]["code"] == "99203"
    assert returning["items"][0]["code"] == "99213"
    assert len(new["items"]) == 1 + len(VISITS[visit]["codes"])


def test_nearby_clinics_are_cheapest_first_and_usable():
    options = clinics_near("21204", "87880", limit=5)
    assert options, "expected known clinics near Towson"
    typical = [option["typical"] for option in options]
    assert typical == sorted(typical)
    # A clinic from the list can be passed straight back into estimate().
    at_clinic = estimate("87880", "21204", clinic=options[0]["clinic"]["id"])
    assert at_clinic["based_on"] == "clinic"
    assert at_clinic["typical"] == options[0]["typical"]


def test_unknown_clinic_falls_back_to_the_area_estimate():
    assert estimate("87880", "21204", clinic="NOT A REAL CLINIC|00000") == estimate("87880", "21204")


def test_zip_outside_maryland_is_flagged_not_rejected():
    price = estimate("99213", "90210")
    assert price["zip_in_training_area"] is False
    assert price["low"] <= price["typical"] <= price["high"]
    assert clinics_near("90210", "99213") == []


def test_lab_test_ignores_facility_setting():
    assert estimate("87880", "21204", setting="facility")["setting"] == "office"


@pytest.mark.parametrize("call", [
    lambda: estimate("86580", "21204"),       # TB test: dropped, too little data
    lambda: estimate_visit("xray", "21204"),  # not a visit we know
    lambda: clinics_near("21204", "00000"),
])
def test_unknown_requests_raise_a_clear_error(call):
    with pytest.raises(ValueError):
        call()
