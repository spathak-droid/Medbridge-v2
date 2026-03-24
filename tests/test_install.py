"""Tests that verify pip install and pytest work correctly."""

import importlib


def test_fastapi_importable():
    mod = importlib.import_module("fastapi")
    assert hasattr(mod, "FastAPI")


def test_langgraph_importable():
    mod = importlib.import_module("langgraph")
    assert mod is not None


def test_sqlalchemy_importable():
    mod = importlib.import_module("sqlalchemy")
    assert hasattr(mod, "create_engine")


def test_app_main_importable():
    mod = importlib.import_module("app.main")
    assert hasattr(mod, "create_app")
