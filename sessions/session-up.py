#!/usr/bin/env python3
"""
Keep Telebirr sessions alive (Termux / Linux / Windows).

Same layout (folder `session` next to this script):
  session-up.py
  session/
    yonas.json          <- sync metadata (written after each run)
    yonas/
      yonas (1).json    <- session index from "(N)" in filename
      yonas (2).json
    M/
      m (1).json
    junk/               <- skipped

Termux setup:
  pkg install python
  pip install requests urllib3

Usage:
  python session-up.py              # interactive menu
  python session-up.py --all        # sync every agent folder
  python session-up.py --agent yonas
  python session-up.py --agent M --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Any

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

URL = "https://telebeat.ethiotelecom.et/superBrainGameApi/my/userTimes"
JSESSIONID = "9DC6DB74962ABD711493663355218410"
DELAY_SECONDS = 3
SKIP_DIRS = {"junk"}

# Agent folders live in ./session next to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_PATH = os.path.join(SCRIPT_DIR, "session")


def extract_index(filename: str) -> int | None:
    match = re.search(r"\((\d+)\)", filename)
    return int(match.group(1)) if match else None


def list_agent_folders(base_path: str) -> list[str]:
    folders = []
    for name in os.listdir(base_path):
        if name.startswith("."):
            continue
        if name in SKIP_DIRS:
            continue
        path = os.path.join(base_path, name)
        if os.path.isdir(path):
            folders.append(name)
    return sorted(folders)


def meta_path(base_path: str, folder_name: str) -> str:
    return os.path.join(base_path, f"{folder_name}.json")


def load_meta(path: str) -> dict[str, Any]:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_meta(path: str, meta: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def read_sessions(sessions_dir: str) -> dict[int, dict[str, str]]:
    sessions: dict[int, dict[str, str]] = {}
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
                sessions[index] = {"token": str(token), "phone": str(phone)}
        except Exception as exc:
            print(f"  ⚠️  Error reading {filename}: {exc}")
    return dict(sorted(sessions.items()))


def send_request(token: str) -> dict[str, Any]:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "token": token,
        "Referer": "https://telebeat.ethiotelecom.et/",
    }
    cookies = {"JSESSIONID": JSESSIONID}
    try:
        response = requests.get(
            URL,
            headers=headers,
            cookies=cookies,
            timeout=15,
            verify=False,
        )
        try:
            return response.json()
        except Exception:
            text = response.text.strip().replace("\n", " ")
            return {"raw": text[:120], "http_status": response.status_code}
    except requests.RequestException as exc:
        return {"error": str(exc)}


def response_summary(response: dict[str, Any]) -> tuple[bool, str]:
    if response.get("error"):
        return False, str(response["error"])
    code = str(response.get("code", ""))
    if code == "0":
        data = response.get("data") or {}
        coins = data.get("coins")
        if coins is not None:
            return True, f"Success · {coins} coin(s)"
        return True, "Success"
    msg = response.get("msg") or response.get("raw") or f"code {code}"
    return False, str(msg)


def sync_folder(
    base_path: str,
    folder_name: str,
    *,
    dry_run: bool = False,
    delay: float = DELAY_SECONDS,
) -> tuple[int, int]:
    sessions_dir = os.path.join(base_path, folder_name)
    meta_file = meta_path(base_path, folder_name)
    meta = load_meta(meta_file)

    sessions = read_sessions(sessions_dir)
    if not sessions:
        print(f"  ❌ No valid session files in '{folder_name}/'")
        return 0, 0

    last_sent = meta.get("last_sent")
    if last_sent:
        print(f"  Last sent: {last_sent}")
    else:
        print("  Last sent: never")

    if dry_run:
        print(f"  [dry-run] Would sync {len(sessions)} session(s)")
        for index, info in sessions.items():
            print(f"    {index:<4} {info['phone']}")
        return len(sessions), 0

    print(f"  Syncing {len(sessions)} session(s)…\n")
    print(f"  {'#':<6} {'Phone':<14} Result")
    print("  " + "-" * 52)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    results: dict[str, Any] = {}
    ok = 0
    failed = 0

    items = list(sessions.items())
    for i, (index, info) in enumerate(items):
        if i > 0 and delay > 0:
            time.sleep(delay)

        response_data = send_request(info["token"])
        success, summary = response_summary(response_data)
        symbol = "✓" if success else "✗"
        print(f"  {index:<6} {info['phone']:<14} {symbol} {summary}")

        results[str(index)] = {
            "phone": info["phone"],
            "sent_at": now,
            "response": response_data,
        }
        if success:
            ok += 1
        else:
            failed += 1

    meta["last_sent"] = now
    meta["folder"] = folder_name
    meta["runs"] = meta.get("runs", 0) + 1
    meta["sessions"] = results
    save_meta(meta_file, meta)
    print(f"\n  💾 Metadata saved → {meta_file}")
    print(f"  Done: {ok} ok, {failed} failed")
    return ok, failed


def pick_folder(base_path: str) -> str | None:
    folders = list_agent_folders(base_path)
    if not folders:
        print("❌ No agent folders found.")
        return None

    print("\n📂 Agent folders:\n")
    for i, name in enumerate(folders, 1):
        meta = load_meta(meta_path(base_path, name))
        last = meta.get("last_sent")
        tag = f"  (last: {last})" if last else ""
        count = len(read_sessions(os.path.join(base_path, name)))
        print(f"  [{i}] {name}  ({count} session(s)){tag}")
    print()

    while True:
        choice = input("Enter number (or folder name): ").strip()
        if choice.isdigit():
            n = int(choice)
            if 1 <= n <= len(folders):
                return folders[n - 1]
        elif choice in folders:
            return choice
        print(f"  ⚠️  Pick 1–{len(folders)} or type the folder name.")


def confirm(prompt: str) -> bool:
    answer = input(f"{prompt} [y/N]: ").strip().lower()
    return answer in ("y", "yes")


def run_all(base_path: str, *, dry_run: bool = False, delay: float = DELAY_SECONDS) -> None:
    folders = list_agent_folders(base_path)
    if not folders:
        print("❌ No agent folders found.")
        return

    print(f"\n📡 Sync ALL — {len(folders)} agent folder(s)\n")
    total_ok = 0
    total_failed = 0

    for folder in folders:
        print(f"\n{'=' * 56}")
        print(f"📂 {folder}")
        print("=" * 56)
        ok, failed = sync_folder(base_path, folder, dry_run=dry_run, delay=delay)
        total_ok += ok
        total_failed += failed

    print(f"\n{'=' * 56}")
    print(f"ALL DONE — {total_ok} ok, {total_failed} failed across {len(folders)} folder(s)")


def interactive_menu(base_path: str) -> None:
    while True:
        print("\n" + "=" * 56)
        print("  Session keep-alive (Termux)")
        print(f"  Folder: {base_path}")
        print("=" * 56)
        print("  [1] Sync one agent")
        print("  [2] Sync ALL agents")
        print("  [0] Exit")
        print()

        choice = input("Choose: ").strip()

        if choice == "0":
            print("Bye.")
            return
        if choice == "1":
            folder = pick_folder(base_path)
            if not folder:
                continue
            print(f"\n▶  Agent: {folder}")
            if not confirm("Proceed?"):
                print("⛔ Skipped.")
                continue
            print()
            sync_folder(base_path, folder)
            continue
        if choice == "2":
            folders = list_agent_folders(base_path)
            if not folders:
                print("❌ No agent folders found.")
                continue
            print(f"\n▶  Will sync: {', '.join(folders)}")
            if not confirm("Proceed with ALL?"):
                print("⛔ Skipped.")
                continue
            run_all(base_path)
            continue
        print("  ⚠️  Enter 0, 1, or 2.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Telebirr session tokens (Termux-friendly)")
    parser.add_argument(
        "--base",
        default=BASE_PATH,
        help="Path to session data root (default: ./session next to this script)",
    )
    parser.add_argument("--all", action="store_true", help="Sync every agent folder")
    parser.add_argument("--agent", metavar="FOLDER", help="Sync one agent folder, e.g. yonas or M")
    parser.add_argument("--dry-run", action="store_true", help="List sessions without sending requests")
    parser.add_argument("--delay", type=float, default=DELAY_SECONDS, help="Seconds between requests")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompts")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_path = os.path.abspath(args.base)

    if not os.path.isdir(base_path):
        print(f"❌ Session folder not found: {base_path}")
        print(f"   Create it next to the script: {BASE_PATH}")
        return 1

    if args.all:
        if not args.yes and not args.dry_run and not confirm(f"Sync ALL agents in {base_path}?"):
            print("⛔ Aborted.")
            return 0
        run_all(base_path, dry_run=args.dry_run, delay=args.delay)
        return 0

    if args.agent:
        folder = args.agent
        agent_dir = os.path.join(base_path, folder)
        if not os.path.isdir(agent_dir):
            print(f"❌ Folder not found: {agent_dir}")
            return 1
        if not args.yes and not args.dry_run and not confirm(f"Sync agent '{folder}'?"):
            print("⛔ Aborted.")
            return 0
        print(f"\n📂 {folder}\n")
        sync_folder(base_path, folder, dry_run=args.dry_run, delay=args.delay)
        return 0

    interactive_menu(base_path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n⛔ Interrupted.")
        raise SystemExit(130)
