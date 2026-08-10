"""Compatibility import for local tests and older tooling.

The production process is ``aegra_api.main:app``.  Orchestra's custom routes
are assembled in :mod:`custom_app`; this module must not create a second API,
start a scheduler, or own a background runtime.
"""

from custom_app import api_app, app

__all__ = ["api_app", "app"]
