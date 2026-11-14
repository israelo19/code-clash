"""Cost estimates for the AI service, backed by the trained model (workstream D).

This file used to hold made-up placeholder prices. The file name stayed the
same so nothing that imports it had to change. The functions keep the inputs
and output keys the companion already uses, and the numbers now come from the
model saved in ai/model/.
"""

from model.features import SERVICES  # the six services we trained on (the TB test is gone)
from model.predict import VISITS, clinics_near, estimate as model_estimate, estimate_visit as model_estimate_visit

# The model only knows two settings: a regular office, or a hospital-based
# clinic ("facility"). The app's wording is mapped onto those two here.
OFFICE_SETTINGS = {"office", "campus health center", "retail clinic", "urgent care"}
FACILITY_SETTINGS = {"facility", "hospital clinic"}
NO_ESTIMATE_SETTINGS = {"emergency room", "er"}

EMERGENCY_ROOM_MESSAGE = (
    "No estimate for emergency rooms. Our data only has the clinician's fee, "
    "not the hospital's separate facility fee, so any number would be far too low."
)


def _model_setting(setting):
    """Turn the app's setting label into "office" or "facility" for the model."""
    label = str(setting or "office").strip().lower()
    if label in NO_ESTIMATE_SETTINGS:
        raise ValueError(EMERGENCY_ROOM_MESSAGE)
    if label in FACILITY_SETTINGS:
        return "facility"
    if label in OFFICE_SETTINGS:
        return "office"
    raise ValueError(f"Unknown setting '{setting}'. Use 'office' or 'facility'.")


def _for_the_app(price, zip_code):
    """Rename the model's keys to the ones the companion and the web app read."""
    result = {
        "service_code": price["code"],
        "service": price["service"],
        "setting": price["setting"],
        "zip3": str(zip_code)[:3],
        "low": price["low"],
        "typical": price["typical"],
        "high": price["high"],
        # "clinic" = uses that clinic's own prices. "area" = providers in that part of Maryland.
        "based_on": price["based_on"],
        "caveat": price["caveat"],
    }
    if "clinic" in price:
        result["clinic"] = price["clinic"]
    return result


def estimate(service_code, setting="office", zip_code="21252", clinic=None):
    """Price range for one service.

    If we cannot estimate it (unknown code, emergency room), the result has an
    "error" message and no prices. It never raises, so a bad request cannot
    crash the companion in the middle of a chat.
    """
    try:
        price = model_estimate(service_code, zip_code, setting=_model_setting(setting), clinic=clinic)
    except ValueError as problem:
        return {"service_code": str(service_code), "error": str(problem)}
    return _for_the_app(price, zip_code)


def estimate_visit(visit, setting="office", zip_code="21252", new_patient=True, clinic=None):
    """Price range for a whole named visit ("strep", "flu", ...), with a total."""
    try:
        priced = model_estimate_visit(
            visit, zip_code, new_patient=new_patient, setting=_model_setting(setting), clinic=clinic
        )
    except ValueError as problem:
        return {"visit": str(visit), "error": str(problem)}
    result = {
        "visit": priced["visit"],
        "items": [_for_the_app(item, zip_code) for item in priced["items"]],
        "total": priced["total"],
        "based_on": priced["based_on"],
        "caveat": priced["caveat"],
    }
    if "note" in priced:
        result["note"] = priced["note"]
    return result


def nearby_clinics(service_code, zip_code="21252", limit=5):
    """Known clinics near a ZIP with their price range for a service, cheapest first."""
    try:
        clinics = clinics_near(zip_code, service_code, limit=limit)
    except ValueError as problem:
        return {"service_code": str(service_code), "error": str(problem)}
    # Same key name as everywhere else in the app: "service_code", not the model's "code".
    return [{"service_code": clinic.pop("code"), **clinic} for clinic in clinics]


def service_menu():
    """What the app can ask for: single services and named visits."""
    return {
        "services": [{"code": code, "label": label} for code, label in SERVICES.items()],
        "visits": [{"id": visit, "label": details["name"]} for visit, details in VISITS.items()],
    }
