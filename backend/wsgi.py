"""WSGI entrypoint for gunicorn.

backend/app.py (this Flask app) and backend/app/ (the package holding
chatbot_service.py etc.) share the name "app". A normal `import app` is
ambiguous between the two, and Python's import system resolves it to the
package — not app.py — so gunicorn's usual `app:app` target fails with
"Failed to find attribute 'app' in 'app'". Load app.py explicitly by its
file path instead, which sidesteps the name collision entirely.
"""
import importlib.util
import os

_app_py_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.py')
_spec = importlib.util.spec_from_file_location('neurotrade_flask_app', _app_py_path)
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)

app = _module.app
