"""Defensive helpers for content destined for spreadsheet apps."""

from typing import Any

# Characters that can trigger formula execution in spreadsheet applications.
# "-" is left out on purpose so negative numbers exported as strings stay numeric in Excel.
_FORMULA_TRIGGER_CHARS = ("=", "+", "@", "|", "\t", "\r")


def sanitize_formula_injection(value: Any) -> Any:
    """Prefix dangerous cell values with a single quote to prevent formula injection.

    Spreadsheet applications like Excel and Google Sheets interpret cells
    starting with =, +, -, @, tab, or carriage return as formulas. Prefixing
    with a single quote forces them to be treated as plain text.
    """
    if value is None:
        return value
    if not isinstance(value, str):
        value = str(value)
    # Leading whitespace is ignored by Excel when it decides whether a cell is a formula,
    # so strip it before checking the first character.
    value = value.lstrip()
    if value and value[0] in _FORMULA_TRIGGER_CHARS:
        return f"'{value}"
    return value
