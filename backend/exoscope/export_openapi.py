"""Write the OpenAPI schema to stdout; the frontend generates its types from it."""

import json

from exoscope.app import app


def main() -> None:
    print(json.dumps(app.openapi(), indent=2))


if __name__ == "__main__":
    main()
