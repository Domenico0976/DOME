import re

with open('src/pages/Home.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the big useEffect block (lines 11-137)
# Pattern: from "  useEffect(() => {" to the matching "  }, []);"
pattern = r'  useEffect\(\(\) => \{[\s\S]*?  \}, \[\]\);'
match = re.search(pattern, content)
if match:
    print(f"Found useEffect block at {match.start()}-{match.end()}")
    print(f"Length: {match.end() - match.start()}")
    print(f"First 100 chars: {repr(match.group()[:100])}")
else:
    print("No match found")
    # Try to find useEffect
    idx = content.find('  useEffect(() => {')
    print(f"useEffect at index: {idx}")
    if idx >= 0:
        print(repr(content[idx:idx+200]))
