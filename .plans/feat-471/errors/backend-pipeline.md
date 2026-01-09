Run # Create the database directory
  # Create the database directory
  mkdir -p ./docker/postgres/data
  # Run your tests
  uv run pytest -rs
  shell: /usr/bin/bash -e {0}
  env:
    APP_ENV: test
    APP_LOG_LEVEL: debug
    APP_SECRET_KEY: ***
    POSTGRES_CONNECTION_STRING: ***localhost:5432/lg_template_test
    OPENAI_API_KEY: ***
    ANTHROPIC_API_KEY: ***
    pythonLocation: /opt/hostedtoolcache/Python/3.11.14/x64
    PKG_CONFIG_PATH: /opt/hostedtoolcache/Python/3.11.14/x64/lib/pkgconfig
    Python_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.14/x64
    Python2_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.14/x64
    Python3_ROOT_DIR: /opt/hostedtoolcache/Python/3.11.14/x64
    LD_LIBRARY_PATH: /opt/hostedtoolcache/Python/3.11.14/x64/lib
    PYTHONPATH: ./src:.
usage: pytest [-h] [--env-file ENV_FILE]
pytest: error: unrecognized arguments: -rs
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-9.0.1, pluggy-1.6.0
rootdir: /home/runner/work/orchestra/orchestra/backend
configfile: pytest.ini (WARNING: ignoring pytest config in pyproject.toml!)
testpaths: tests
plugins: respx-0.22.0, anyio-4.12.0, Faker-38.2.0, asyncio-1.3.0, mock-3.15.1, langsmith-0.4.53
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=session, asyncio_default_test_loop_scope=session
collected 30 items
INTERNALERROR> Traceback (most recent call last):
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 318, in wrap_session
INTERNALERROR>     session.exitstatus = doit(config, session) or 0
INTERNALERROR>                          ^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 371, in _main
INTERNALERROR>     config.hook.pytest_collection(session=session)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_hooks.py", line 512, in __call__
INTERNALERROR>     return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_manager.py", line 120, in _hookexec
INTERNALERROR>     return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 167, in _multicall
INTERNALERROR>     raise exception
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 139, in _multicall
mainloop: caught unexpected SystemExit!
INTERNALERROR>     teardown.throw(exception)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/logging.py", line 788, in pytest_collection
INTERNALERROR>     return (yield)
INTERNALERROR>             ^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 139, in _multicall
INTERNALERROR>     teardown.throw(exception)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/warnings.py", line 98, in pytest_collection
INTERNALERROR>     return (yield)
INTERNALERROR>             ^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 139, in _multicall
INTERNALERROR>     teardown.throw(exception)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/config/__init__.py", line 1372, in pytest_collection
INTERNALERROR>     return (yield)
INTERNALERROR>             ^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 121, in _multicall
INTERNALERROR>     res = hook_impl.function(*args)
INTERNALERROR>           ^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 382, in pytest_collection
INTERNALERROR>     session.perform_collect()
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 857, in perform_collect
INTERNALERROR>     self.items.extend(self.genitems(node))
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 1023, in genitems
INTERNALERROR>     yield from self.genitems(subnode)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 1023, in genitems
INTERNALERROR>     yield from self.genitems(subnode)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 1023, in genitems
INTERNALERROR>     yield from self.genitems(subnode)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 1020, in genitems
INTERNALERROR>     rep, duplicate = self._collect_one_node(node, handle_dupes)
INTERNALERROR>                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/main.py", line 883, in _collect_one_node
INTERNALERROR>     rep = collect_one_node(node)
INTERNALERROR>           ^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/runner.py", line 576, in collect_one_node
INTERNALERROR>     rep: CollectReport = ihook.pytest_make_collect_report(collector=collector)
INTERNALERROR>                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_hooks.py", line 512, in __call__
INTERNALERROR>     return self._hookexec(self.name, self._hookimpls.copy(), kwargs, firstresult)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_manager.py", line 120, in _hookexec
INTERNALERROR>     return self._inner_hookexec(hook_name, methods, kwargs, firstresult)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 167, in _multicall
INTERNALERROR>     raise exception
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 139, in _multicall
INTERNALERROR>     teardown.throw(exception)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/capture.py", line 880, in pytest_make_collect_report
INTERNALERROR>     rep = yield
INTERNALERROR>           ^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/pluggy/_callers.py", line 121, in _multicall
INTERNALERROR>     res = hook_impl.function(*args)
INTERNALERROR>           ^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/runner.py", line 400, in pytest_make_collect_report
INTERNALERROR>     call = CallInfo.from_call(
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/runner.py", line 353, in from_call
INTERNALERROR>     result: TResult | None = func()
INTERNALERROR>                              ^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/runner.py", line 398, in collect
INTERNALERROR>     return list(collector.collect())
INTERNALERROR>                 ^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/python.py", line 563, in collect
INTERNALERROR>     self._register_setup_module_fixture()
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/python.py", line 576, in _register_setup_module_fixture
INTERNALERROR>     self.obj, ("setUpModule", "setup_module")
INTERNALERROR>     ^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/python.py", line 289, in obj
INTERNALERROR>     self._obj = obj = self._getobj()
INTERNALERROR>                       ^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/python.py", line 560, in _getobj
INTERNALERROR>     return importtestmodule(self.path, self.config)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/python.py", line 507, in importtestmodule
INTERNALERROR>     mod = import_path(
INTERNALERROR>           ^^^^^^^^^^^^
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/pathlib.py", line 587, in import_path
INTERNALERROR>     importlib.import_module(module_name)
INTERNALERROR>   File "/usr/lib/python3.12/importlib/__init__.py", line 90, in import_module
INTERNALERROR>     return _bootstrap._gcd_import(name[level:], package, level)
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "<frozen importlib._bootstrap>", line 1387, in _gcd_import
INTERNALERROR>   File "<frozen importlib._bootstrap>", line 1360, in _find_and_load
INTERNALERROR>   File "<frozen importlib._bootstrap>", line 1331, in _find_and_load_unlocked
INTERNALERROR>   File "<frozen importlib._bootstrap>", line 935, in _load_unlocked
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/.venv/lib/python3.12/site-packages/_pytest/assertion/rewrite.py", line 197, in exec_module
INTERNALERROR>     exec(co, module.__dict__)
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/tests/unit/services/test_project_service.py", line 10, in <module>
INTERNALERROR>     from seeds.user_seeder import seed_admin
INTERNALERROR>   File "/home/runner/work/orchestra/orchestra/backend/seeds/user_seeder.py", line 8, in <module>
INTERNALERROR>     args = parser.parse_args()
INTERNALERROR>            ^^^^^^^^^^^^^^^^^^^
INTERNALERROR>   File "/usr/lib/python3.12/argparse.py", line 1911, in parse_args
INTERNALERROR>     self.error(msg % ' '.join(argv))
INTERNALERROR>   File "/usr/lib/python3.12/argparse.py", line 2677, in error
INTERNALERROR>     self.exit(2, _('%(prog)s: error: %(message)s\n') % args)
INTERNALERROR>   File "/usr/lib/python3.12/argparse.py", line 2664, in exit
INTERNALERROR>     _sys.exit(status)
INTERNALERROR> SystemExit: 2

============================= 2 warnings in 0.07s ==============================