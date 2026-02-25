import os
import re

def check_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r') as f:
        content = f.read()
        
    # Find all vi.mock calls for CampaignManager
    # Use a more flexible regex to find the start and end of vi.mock("@src/renderer/campaign/CampaignManager", ...)
    
    # Simple check: if the file has vi.mock for CampaignManager, check for the methods
    if 'vi.mock' in content and 'CampaignManager' in content:
        # We need to find the specific vi.mock for CampaignManager
        match = re.search(r'vi\.mock\([^)]*CampaignManager[^)]*,\s*(?:\([^)]*\)|([^)]*))\s*=>\s*({|[^;]*)', content, re.DOTALL)
        if match:
            # Now we have the start of the mock. We need to find the matching closing brace if it's an object/block.
            # But simpler: just check if addChangeListener is in the WHOLE file if it's mocking CampaignManager.
            # If it's mocking it, it MUST have it.
            if 'addChangeListener' not in content or 'removeChangeListener' not in content:
                print(file_path)

for root, dirs, files in os.walk("tests"):
    for file in files:
        if file.endswith(".ts"):
            check_file(os.path.join(root, file))
