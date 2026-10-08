with open('src/pages/Home.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.rstrip()
if content.endswith('}\n'):
    content = content[:-2]
content = content.rstrip()
if content.endswith(');'):
    content = content[:-2]
    catch_block = '''  } catch(e) { console.error("Home error:", e); return null; }
}
'''
    content = content + catch_block

with open('src/pages/Home.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed. Length:', len(content))
print('Ends with:', repr(content[-80:]))
