import os
import re

def check_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if file mocks CampaignManager
    if 'vi.mock("@src/renderer/campaign/CampaignManager"' in content or "vi.mock('@src/renderer/campaign/CampaignManager'" in content:
        # Check if it defines getInstance
        if 'getInstance' in content:
            # Check if it misses addChangeListener
            if 'addChangeListener' not in content:
                print(filepath)

for root, dirs, files in os.walk("tests"):
    for file in files:
        if file.endswith(".ts") or file.endswith(".tsx"):
            check_file(os.path.join(root, file))
