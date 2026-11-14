"""PLACEHOLDER cost estimates, owned by workstream D (cost model).

The numbers below are made up so the companion can call estimate_cost today.
When the trained model is ready, replace the body of estimate() with a call to
the saved model, and keep the same inputs and output keys so nothing else breaks.
"""

# Service codes the companion knows about (from the project brief, section 6)
SERVICES = {
    "99213": "Office visit, established patient",
    "99203": "Office visit, new patient",
    "87880": "Rapid strep test",
    "87804": "Rapid flu test",
    "86580": "TB skin test",
    "90471": "Giving a vaccine",
    "85025": "Complete blood count",
}

_FAKE_TYPICAL = {
    "99213": 140, "99203": 190, "87880": 35, "87804": 45,
    "86580": 25, "90471": 30, "85025": 30,
}


def estimate(service_code, setting="office", zip_code="212"):
    typical = _FAKE_TYPICAL.get(service_code, 100)
    if setting == "facility":
        typical *= 1.6
    return {
        "service_code": service_code,
        "service": SERVICES.get(service_code, "Unknown service"),
        "setting": setting,
        "zip3": str(zip_code)[:3],
        "low": round(typical * 0.6),
        "typical": round(typical),
        "high": round(typical * 1.8),
        "caveat": "PLACEHOLDER numbers until the trained model is plugged in. "
        "Estimate only, not a quote, and not what your insurance will pay.",
    }
