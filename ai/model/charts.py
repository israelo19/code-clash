"""Draw the evaluation charts for the deck.

Reads the numbers that train.py and experiments.py saved and writes PNG files
to docs/charts/. Nothing is trained here, so it runs in a couple of seconds
and can be rerun whenever the numbers change.

Run from the repo root:
    python ai/model/charts.py
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # draw to files, no window needed
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import PathPatch, Rectangle
from matplotlib.path import Path as Outline

HERE = Path(__file__).parent
OUT_DIR = HERE.parents[1] / "docs" / "charts"

# One consistent look for every chart.
SURFACE, INK, INK_SOFT, MUTED = "#fcfcfb", "#0b0b0b", "#52514e", "#898781"
GRID, AXIS = "#e1e0d9", "#c3c2b7"
BLUE, ORANGE, GRAY = "#2a78d6", "#eb6834", "#b4b2a9"  # our model, second series, baseline/context
DPI = 200
PX = DPI / 100  # one "design pixel" in real pixels

plt.rcParams.update({
    "font.family": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 10.5,
    "text.color": INK,
    "axes.edgecolor": AXIS,
    "axes.labelcolor": INK_SOFT,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "xtick.labelcolor": INK_SOFT,
    "ytick.labelcolor": INK_SOFT,
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
})


def new_chart(title, subtitle, left=0.08, right=0.95, top=0.78, bottom=0.15):
    fig = plt.figure(figsize=(9.6, 5.4), dpi=DPI)
    ax = fig.add_axes([left, bottom, right - left, top - bottom])
    fig.text(0.04, 0.945, title, fontsize=15, fontweight="bold", ha="left", va="top")
    fig.text(0.04, 0.875, subtitle, fontsize=10.5, color=INK_SOFT, ha="left", va="top")
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0, pad=6)
    ax.set_axisbelow(True)
    return fig, ax


def finish(fig, name, footer):
    fig.text(0.04, 0.035, footer, fontsize=8.5, color=MUTED, ha="left", va="bottom")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT_DIR / name, dpi=DPI)
    plt.close(fig)
    print("wrote", OUT_DIR / name)


def pixel_size(ax):
    """Width and height of one real pixel, in the chart's data units."""
    ax.figure.canvas.draw()
    to_data = ax.transData.inverted()
    (x0, y0), (x1, y1) = to_data.transform((0, 0)), to_data.transform((1, 1))
    return abs(x1 - x0), abs(y1 - y0)


def horizontal_bars(ax, positions, values, color, thickness_px=22):
    """Bars that start square at zero and end with a small rounded corner.

    Set the axis limits before calling this, because the corner radius is
    worked out from the final size of the chart.
    """
    px_x, px_y = pixel_size(ax)
    thickness = thickness_px * PX * px_y
    corner_x, corner_y = 4 * PX * px_x, 4 * PX * px_y  # a 4px corner, in data units
    colors = color if isinstance(color, list) else [color] * len(values)
    for y, value, color in zip(positions, values, colors):
        bottom, top, corner = y - thickness / 2, y + thickness / 2, min(corner_x, value)
        outline = Outline(
            [(0, bottom), (value - corner, bottom), (value, bottom), (value, bottom + corner_y),
             (value, top - corner_y), (value, top), (value - corner, top), (0, top), (0, bottom)],
            [Outline.MOVETO, Outline.LINETO, Outline.CURVE3, Outline.CURVE3,
             Outline.LINETO, Outline.CURVE3, Outline.CURVE3, Outline.LINETO, Outline.CLOSEPOLY],
        )
        ax.add_patch(PathPatch(outline, linewidth=0, facecolor=color, zorder=3))
    return thickness


def swatch_legend(fig, entries, y=0.815, x=0.04):
    """A small legend row under the subtitle: a colored mark, then its name."""
    for label, color in entries:
        fig.patches.append(Rectangle((x, y - 0.008), 0.014, 0.018, transform=fig.transFigure, facecolor=color, linewidth=0))
        text = fig.text(x + 0.02, y, label, fontsize=10, color=INK_SOFT, ha="left", va="center")
        fig.canvas.draw()
        x = text.get_window_extent().x1 / fig.bbox.width + 0.03


def chart_steps(experiments):
    """1. How the cross-validated error changed as we added information."""
    baseline, steps = experiments["baseline"], experiments["progression"]
    labels = [baseline["step"]] + [s["step"] for s in steps]
    values = [baseline["mae_dollars"]] + [s["mae_dollars"] for s in steps]
    drop = round((1 - values[-1] / values[0]) * 100)

    fig, ax = new_chart(
        f"Knowing the clinic's own prices cut the error {drop}% below the baseline",
        "Average error of the typical price as we gave the model more information. Lower is better.",
        left=0.33, top=0.80,
    )
    positions = np.arange(len(values))[::-1]
    ax.set_xlim(0, max(values) * 1.22)
    ax.set_ylim(-0.6, len(values) - 0.4)
    horizontal_bars(ax, positions, values, [GRAY] + [BLUE] * len(steps))
    for y, value in zip(positions, values):
        ax.text(value + max(values) * 0.012, y, f"${value:.2f}", va="center", ha="left", fontsize=10.5)
    ax.set_yticks(positions, labels)
    ax.xaxis.set_major_formatter(lambda v, _: f"${v:.0f}")
    ax.grid(axis="x", color=GRID, linewidth=0.6)
    ax.spines["left"].set_color(AXIS)
    ax.spines["bottom"].set_visible(False)
    finish(fig, "1_what_each_step_added.png",
           "4-fold cross-validation on the training providers only. The held-out test providers are not used here.")


def chart_more_data(experiments):
    """2. Would more of the same data help?"""
    curve = pd.DataFrame(experiments["learning_curve"])
    share = curve["share_of_training_providers"] * 100
    half, full = curve.iloc[2], curve.iloc[-1]
    area_gain = (1 - full["area_model_mae_dollars"] / half["area_model_mae_dollars"]) * 100
    clinic_gain = (1 - full["clinic_model_mae_dollars"] / half["clinic_model_mae_dollars"]) * 100

    fig, ax = new_chart(
        f"Doubling the data improved the area model {area_gain:.0f}% and the clinic model {clinic_gain:.0f}%",
        "Average error when training on a growing share of the training providers. Lower is better.",
        right=0.80, top=0.76, bottom=0.21,
    )
    series = [
        ("Baseline", "baseline_mae_dollars", GRAY),
        ("Area model", "area_model_mae_dollars", BLUE),
        ("Clinic model", "clinic_model_mae_dollars", ORANGE),
    ]
    for label, column, color in series:
        ax.plot(share, curve[column], color=color, linewidth=2.2, marker="o", markersize=7,
                markeredgecolor=SURFACE, markeredgewidth=1.5, solid_capstyle="round", zorder=3)
        ax.text(103, curve[column].iloc[-1], f"{label}  ${curve[column].iloc[-1]:.2f}", va="center", ha="left", fontsize=10.5)
    low = curve[[c for _, c, _ in series]].min().min()
    high = curve[[c for _, c, _ in series]].max().max()
    bottom, top = np.floor(low / 5) * 5, np.ceil(high / 5) * 5
    ax.set_ylim(bottom, top)
    ax.set_yticks(np.arange(bottom, top + 1, 5))
    ax.set_xlim(5, 102)
    ax.set_xticks(share, [f"{s:.0f}%" for s in share])
    ax.set_xlabel("Share of training providers used")
    ax.yaxis.set_major_formatter(lambda v, _: f"${v:.0f}")
    ax.grid(axis="y", color=GRID, linewidth=0.6)
    ax.spines["left"].set_visible(False)
    swatch_legend(fig, [(label, color) for label, _, color in series])
    finish(fig, "2_would_more_data_help.png",
           "4-fold cross-validation on the training providers only. The vertical axis does not start at zero.")


def chart_by_service(metrics):
    """3. Final test: typical miss by service, baseline against our model."""
    services = metrics["per_service"]
    names = [s["service"] for s in services.values()]
    baseline = [s["baseline"]["median_pct_error"] for s in services.values()]
    final = [s["final_model"]["median_pct_error"] for s in services.values()]
    overall = metrics["provider_type_known"]["all_held_out"]

    fig, ax = new_chart(
        f"On providers it never saw, the model's typical miss is {overall['final_model']['median_pct_error']:.0f}% "
        f"against the baseline's {overall['baseline']['median_pct_error']:.0f}%",
        "Median error as a share of the real charge, by service. Lower is better.",
        left=0.30, top=0.76,
    )
    rows = np.arange(len(names))[::-1].astype(float)
    ax.set_xlim(0, max(baseline + final) * 1.15)
    ax.set_ylim(-0.7, len(names) - 0.3)
    px_x, px_y = pixel_size(ax)
    offset = (16 * PX * px_y + 2 * PX * px_y) / 2  # two 16px bars with a 2px gap between them
    horizontal_bars(ax, rows + offset, baseline, GRAY, thickness_px=16)
    horizontal_bars(ax, rows - offset, final, BLUE, thickness_px=16)
    pad = max(baseline + final) * 0.012
    for y, b, f in zip(rows, baseline, final):
        ax.text(b + pad, y + offset, f"{b:.0f}%", va="center", ha="left", fontsize=9.5, color=INK_SOFT)
        ax.text(f + pad, y - offset, f"{f:.0f}%", va="center", ha="left", fontsize=10, fontweight="bold")
    ax.set_yticks(rows, names)
    ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.grid(axis="x", color=GRID, linewidth=0.6)
    ax.spines["bottom"].set_visible(False)
    swatch_legend(fig, [("Baseline: median price per service", GRAY), ("Our model", BLUE)])
    finish(fig, "3_final_test_by_service.png",
           f"Final test on {overall['test_rows']:,} held-out rows from providers the model never saw, provider type known.")


def chart_range_check(metrics):
    """4. How often the real charge fell inside the range the app shows."""
    app = metrics["what_the_app_shows"]
    names = [s["service"] for s in app["per_service"].values()] + ["All services"]
    coverage = [s["final_estimate"]["range_coverage_pct"] for s in app["per_service"].values()]
    coverage.append(app["primary_care"]["final_estimate"]["range_coverage_pct"])

    fig, ax = new_chart(
        f"The range the app shows held the real charge {coverage[-1]:.0f}% of the time",
        "Share of held-out charges that fell between the low and high estimate, by service. The goal is 80%.",
        left=0.30, top=0.80,
    )
    rows = np.arange(len(names))[::-1]
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.6, len(names) - 0.4)
    horizontal_bars(ax, rows, coverage, [BLUE] * (len(names) - 1) + [INK_SOFT])
    for y, value in zip(rows, coverage):
        ax.text(value + 1.2, y, f"{value:.0f}%", va="center", ha="left", fontsize=10.5)
    ax.axvline(80, color=INK, linewidth=1, zorder=4)
    ax.text(80, len(names) - 0.42, "Goal: 80%", ha="center", va="bottom", fontsize=9.5, color=INK_SOFT)
    ax.set_yticks(rows, names)
    ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.grid(axis="x", color=GRID, linewidth=0.6)
    ax.spines["bottom"].set_visible(False)
    finish(fig, "4_range_check.png",
           f"Final test on {app['primary_care']['test_rows']:,} held-out primary-care rows, provider type unknown, as in the app.")


def chart_how_close(predictions):
    """5. Share of held-out predictions that land within X% of the real charge."""
    actual = predictions["actual_charge"]
    limits = np.arange(0, 51)
    series = [
        ("Baseline", "baseline_typical", GRAY),
        ("Area model", "area_model_typical", BLUE),
        ("Final model", "final_model_typical", ORANGE),
    ]
    within = {}
    for label, column, _ in series:
        miss = (predictions[column] - actual).abs() / actual * 100
        within[label] = np.array([(miss <= limit).mean() * 100 for limit in limits])

    fig, ax = new_chart(
        f"{within['Final model'][10]:.0f}% of estimates land within 10% of the real charge, "
        f"up from {within['Baseline'][10]:.0f}% for the baseline",
        "Share of held-out predictions whose typical price is within a given distance of the real charge. Higher is better.",
        right=0.93, top=0.76,
    )
    # The lines meet at the right, so the two numbers from the title are
    # labeled on the "within 10%" points instead. The legend names the lines.
    label_spots = {"Final model": (-0.9, 2.5, "right", "bottom"), "Baseline": (0.9, -1.5, "left", "top")}
    for label, _, color in series:
        ax.plot(limits, within[label], color=color, linewidth=2.2, solid_capstyle="round", zorder=3)
        ax.plot(10, within[label][10], marker="o", markersize=7, color=color, markeredgecolor=SURFACE, markeredgewidth=1.5, zorder=4)
        if label in label_spots:
            dx, dy, ha, va = label_spots[label]
            ax.text(10 + dx, within[label][10] + dy, f"{within[label][10]:.0f}%", ha=ha, va=va, fontsize=10.5, fontweight="bold")
    ax.axvline(10, color=AXIS, linewidth=0.8, zorder=1)
    ax.set_xlim(0, 50)
    ax.set_ylim(0, 100)
    ax.set_xticks(range(0, 51, 10), [f"within {v}%" if v else "exact" for v in range(0, 51, 10)])
    ax.yaxis.set_major_formatter(lambda v, _: f"{v:.0f}%")
    ax.set_ylabel("Share of predictions")
    ax.grid(axis="y", color=GRID, linewidth=0.6)
    ax.spines["left"].set_visible(False)
    swatch_legend(fig, [(label, color) for label, _, color in series])
    finish(fig, "5_how_close_are_estimates.png",
           f"Final test on {len(predictions):,} held-out rows from providers the model never saw, provider type known.")


def main():
    experiments = json.loads((HERE / "experiments.json").read_text())
    metrics = json.loads((HERE / "metrics.json").read_text())
    predictions = pd.read_csv(HERE / "test_predictions.csv")
    chart_steps(experiments)
    chart_more_data(experiments)
    chart_by_service(metrics)
    chart_range_check(metrics)
    chart_how_close(predictions)


if __name__ == "__main__":
    main()
