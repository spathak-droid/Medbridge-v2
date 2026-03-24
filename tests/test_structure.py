"""Tests for project directory structure."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

REQUIRED_DIRS = [
    "app",
    "app/api",
    "app/models",
    "app/services",
    "app/graphs",
    "app/tools",
    "tests",
]


def test_required_directories_exist():
    for d in REQUIRED_DIRS:
        path = PROJECT_ROOT / d
        assert path.is_dir(), f"Missing required directory: {d}"


def test_app_is_importable_package():
    init = PROJECT_ROOT / "app" / "__init__.py"
    assert init.exists(), "app/__init__.py must exist for app to be a package"
