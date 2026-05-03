#!/usr/bin/env python3
import csv
import os
import re
from pathlib import Path

# Resolve all paths relative to this script so it works on any OS.
base_dir = Path(__file__).resolve().parent
spviewer_root = base_dir / 'csv' / 'spviewer'
ini_path = base_dir / 'global.ini'

version_dirs = [p for p in spviewer_root.iterdir() if p.is_dir()]
if not version_dirs:
    raise FileNotFoundError(f"No SPViewer version directories found in: {spviewer_root}")

csv_dir = sorted(version_dirs, key=lambda p: p.name)[-1]
print(f"Using SPViewer CSV directory: {csv_dir}")

# Mapping from class name to abbreviation
class_abbrev = {
    'Stealth': 'Sth',
    'Industrial': 'Ind',
    'Civilian': 'Civ',
    'Competition': 'Cmp',
    'Military': 'Mil',
}

# Build a dictionary: component name -> prefix string (e.g., "Sth/1/B")
name_to_prefix = {}

for filename in os.listdir(csv_dir):
    if not filename.endswith('.spviewer.csv'):
        continue
    filepath = os.path.join(csv_dir, filename)
    with open(filepath, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            name = row.get('Name', '').strip()
            cls = row.get('Class', '').strip()
            size = row.get('Size', '').strip()
            grade = row.get('Grade', '').strip()
            if not name:
                continue
            # Get abbreviation for class, fallback to first three letters if not found
            abbr = class_abbrev.get(cls, cls[:3] if cls else '???')
            prefix = f"{abbr}/{size}/{grade}"
            name_to_prefix[name] = prefix

print(f"Loaded {len(name_to_prefix)} component names from CSVs.")

# Read the global.ini file
with open(ini_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Process each line
updated_lines = []
pattern = re.compile(r'^(item_Name_[^=]+)=(.*)$')
for line in lines:
    line = line.rstrip('\n')
    match = pattern.match(line)
    if match:
        key = match.group(1)
        current_value = match.group(2)
        # The current_value might be just the name, or might already have extra info.
        # We want to extract the base name (the part after the last space if there is a space and the first part looks like a prefix?)
        # But from the examples, the current_value in the ini is just the name (e.g., "Veil").
        # However, to be safe, we'll assume that if the current_value already contains a space and the first part matches a known prefix pattern, we skip.
        # But let's just try to map by the whole current_value first.
        base_name = current_value.strip()
        # If the current_value already has a prefix like "Sth/1/B Veil", we might want to update the prefix if needed?
        # For simplicity, we'll just update if the base_name (without any prefix) is in our mapping.
        # Let's try to split by space and take the last part as the actual name? Not reliable.
        # Instead, we'll check if the current_value starts with any of the known prefixes? Too heavy.
        # We'll just use the whole current_value as the name to look up.
        if base_name in name_to_prefix:
            prefix = name_to_prefix[base_name]
            new_value = f"{prefix} {base_name}"
            # Only update if the new_value is different
            if new_value != current_value:
                line = f"{key}={new_value}"
                print(f"Updated: {key} = {new_value}")
        else:
            # If not found, we could try to see if the current_value already has a prefix and the base name is in the mapping.
            # For example, if current_value is "Sth/1/B Veil", we want to check if "Veil" is in mapping.
            parts = current_value.split(' ', 1)
            if len(parts) == 2:
                possible_prefix, possible_name = parts
                if possible_name in name_to_prefix:
                    # Reconstruct with the correct prefix from mapping
                    correct_prefix = name_to_prefix[possible_name]
                    new_value = f"{correct_prefix} {possible_name}"
                    if new_value != current_value:
                        line = f"{key}={new_value}"
                        print(f"Updated (re-prefix): {key} = {new_value}")
            # If still not found, we leave the line unchanged.
    updated_lines.append(line)

# Write back to global.ini
with open(ini_path, 'w', encoding='utf-8') as f:
    for line in updated_lines:
        f.write(line + '\n')

print("Done updating global.ini.")
