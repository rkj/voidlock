import os

def check_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        if 'vi.mock("@src/renderer/campaign/CampaignManager"' in content:
            if 'addChangeListener' not in content:
                print(filepath)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

for root, dirs, files in os.walk("tests"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            check_file(os.path.join(root, file))
