import os
import json
import re
import requests
import time
from datetime import datetime
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

URL = "https://telebeat.ethiotelecom.et/superBrainGameApi/my/userTimes"


def extract_index(filename):
    match = re.search(r"\((\d+)\)", filename)
    return int(match.group(1)) if match else None


def list_directories(base_path="."):
    dirs = [
        d for d in os.listdir(base_path)
        if os.path.isdir(os.path.join(base_path, d)) and not d.startswith(".")
    ]
    return sorted(dirs)


def get_meta_path(base_path, folder_name):
    """Return path to the metadata file: <base_path>/<folder_name>.json"""
    return os.path.join(base_path, f"{folder_name}.json")


def load_meta(meta_path):
    """Load existing metadata, or return empty dict."""
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_meta(meta_path, meta):
    """Save metadata dict to file."""
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def choose_directory(base_path="."):
    dirs = list_directories(base_path)
    if not dirs:
        print("❌ No directories found.")
        return None, None

    print("\n📂 Available directories:\n")
    for i, d in enumerate(dirs, 1):
        # Show last-sent time if metadata exists
        meta_path = get_meta_path(base_path, d)
        meta = load_meta(meta_path)
        last_sent = meta.get("last_sent")
        tag = f"  (last sent: {last_sent})" if last_sent else ""
        print(f"  [{i}] {d}{tag}")
    print()

    while True:
        choice = input("Enter number to select a directory: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(dirs):
            folder_name = dirs[int(choice) - 1]
            selected = os.path.join(base_path, folder_name)
            print(f"\n✅ Selected: {selected}\n")
            return selected, folder_name
        print(f"  ⚠️  Enter a number between 1 and {len(dirs)}.")


def read_sessions(sessions_dir):
    sessions = {}
    for filename in sorted(os.listdir(sessions_dir)):
        if not filename.endswith(".json"):
            continue
        index = extract_index(filename)
        if index is None:
            continue
        filepath = os.path.join(sessions_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            token = data.get("SRBNtoken")
            phone = data.get("SRBNphone")
            if token and phone:
                sessions[index] = {"token": token, "phone": phone}
        except Exception as e:
            print(f"  ⚠️  Error reading {filename}: {e}")
    return dict(sorted(sessions.items()))


def send_request(token):
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "token": token,
        "Referer": "https://telebeat.ethiotelecom.et/",
    }
    cookies = {
        "JSESSIONID": "9DC6DB74962ABD711493663355218410"
    }
    try:
        response = requests.get(URL, headers=headers, cookies=cookies, timeout=10, verify=False)
        try:
            return response.json()
        except Exception:
            return {"raw": response.text.strip().replace("\n", " ")[:120]}
    except requests.RequestException as e:
        return {"error": str(e)}


if __name__ == "__main__":
    base_path = "."

    sessions_dir, folder_name = choose_directory(base_path)
    if not sessions_dir:
        exit(1)

    meta_path = get_meta_path(base_path, folder_name)
    meta = load_meta(meta_path)

    # Show last sent info and ask for confirmation
    last_sent = meta.get("last_sent")
    if last_sent:
        print(f"🕒 Last sent: {last_sent}")
    else:
        print("🕒 Last sent: never")

    confirm = input("\n▶  Proceed with sending requests? [y/N]: ").strip().lower()
    if confirm == "n":
        print("⛔ Aborted.")
        exit(0)

    sessions = read_sessions(sessions_dir)
    if not sessions:
        print(f"❌ No valid session files found in '{sessions_dir}'.")
        exit(1)

    print(f"\n📡 Found {len(sessions)} session(s). Sending requests...\n")
    print(f"{'#':<6} {'Phone':<20} Response")
    print("-" * 80)

    results = {}
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for index, info in sessions.items():
        time.sleep(3)
        response_data = send_request(info["token"])
        response_text = json.dumps(response_data)
        print(f"{index:<6} {info['phone']:<20} {response_text}")

        results[str(index)] = {
            "phone": info["phone"],
            "sent_at": now,
            "response": response_data,
        }

    # Save metadata to <folder_name>.json beside the folder
    meta["last_sent"] = now
    meta["folder"] = folder_name
    meta["runs"] = meta.get("runs", 0) + 1
    meta["sessions"] = results
    save_meta(meta_path, meta)

    print(f"\n💾 Metadata saved → {meta_path}")
    print("✅ Done.")



    