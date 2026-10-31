"""Build a clean, downloadable source archive without dependencies or runtime data."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'dist' / 'nexo-source.zip'
entries = ['README.md', 'package.json', 'package-lock.json', '.gitignore']
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in entries:
        file = root / name
        if file.exists():
            archive.write(file, 'nexo/' + name)
    for directory in ['dist', 'local', 'desktop', 'tests', 'scripts']:
        for file in sorted((root / directory).rglob('*')):
            if file.is_file() and file.suffix not in ['.zip', '.pyc'] and '__pycache__' not in file.parts:
                archive.write(file, 'nexo/' + file.relative_to(root).as_posix())
print(target)
