"""Recommend a plugin for a language the project uses but has no active plugin for.

A non-fatal hint printed to stderr only: it never changes the findings output or
the exit code. Detection is deliberately conservative — a language counts as used
only on a cheap, clear signal (a known config file in the project root or a file
extension among the scoped files). A language whose plugin already declares it is
never recommended.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LanguageSignal:
    language: str
    config_files: tuple[str, ...]
    extensions: tuple[str, ...]


LANGUAGE_SIGNALS = (
    LanguageSignal("python", ("pyproject.toml",), (".py",)),
    LanguageSignal("typescript", ("tsconfig.json", "package.json"), (".ts", ".tsx")),
    LanguageSignal("php", ("composer.json",), (".php",)),
)


def _is_used(signal: LanguageSignal, project_dir: Path, files: list[str]) -> bool:
    if any((project_dir / name).is_file() for name in signal.config_files):
        return True
    return any(file.endswith(signal.extensions) for file in files)


def recommendations(
    project_dir: Path, files: list[str], active_languages: set[str]
) -> list[str]:
    """Hint lines for used languages no active plugin covers, one per language."""
    return [
        f"habit-sensors: detected {signal.language}; "
        f"consider `pip install habit-hooks-{signal.language}`"
        for signal in LANGUAGE_SIGNALS
        if signal.language not in active_languages
        and _is_used(signal, project_dir, files)
    ]
