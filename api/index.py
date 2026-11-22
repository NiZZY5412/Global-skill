"""Vercel entrypoint for the TALVORA FastAPI application.

Vercel discovers Python Functions from the root-level ``api`` directory.
The application itself remains organized in ``Backend/app.py`` for local
development and deployment outside Vercel.
"""

from Backend.app import app

__all__ = ["app"]
