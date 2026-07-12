"""Deterministic chart rendering for the published dataset.

Unlike the app's LLM-written plotting code (which samples rows internally and
costs an API call), these render a chart from an *exact* data frame so the
grounded QA generated over that same frame is answerable from the image. This
is the property a chart-QA benchmark needs, and it makes the whole build free,
reproducible, and seed-controlled.
"""

import matplotlib

matplotlib.use("Agg")  # headless

import matplotlib.pyplot as plt  # noqa: E402

_COLORS = ["#4C72B0", "#55A868", "#C44E52", "#8172B3", "#CCB974", "#64B5CD",
           "#DD8452", "#937860", "#DA8BC3", "#8C8C8C"]


def _finalize(fig, path: str) -> None:
    fig.tight_layout()
    fig.savefig(path, dpi=100, bbox_inches="tight")
    plt.close(fig)


def render_bar(labels, values, xlabel, ylabel, title, path) -> None:
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar([str(v) for v in labels], values, color=_COLORS[0])
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    _finalize(fig, path)


def render_pie(labels, values, title, path) -> None:
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.pie(values, labels=[str(v) for v in labels], autopct="%1.1f%%",
           startangle=90, colors=_COLORS)
    ax.set_title(title)
    _finalize(fig, path)


def render_line(x, y, xlabel, ylabel, title, path) -> None:
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot([str(v) for v in x], y, marker="o", color=_COLORS[1])
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    _finalize(fig, path)


def render_scatter(x, y, xlabel, ylabel, title, path) -> None:
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(x, y, alpha=0.7, color=_COLORS[2])
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    _finalize(fig, path)
