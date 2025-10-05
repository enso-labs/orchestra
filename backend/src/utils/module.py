import importlib


def load_function(func_path: str):
    # Get the function from the path
    module_path, func_name = func_path.rsplit(".", 1)

    # Import the module dynamically
    module = importlib.import_module(module_path)
    func = getattr(module, func_name)
    return func
