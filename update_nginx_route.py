import datetime
import getpass
import os
import re
import sys

HOST = "31.97.76.62"
USER = "root"
REMOTE_CANDIDATES = [
    "/etc/nginx/sites-available/n-lux.com",
    "/etc/nginx/conf.d/n-lux.com",
]
DEFAULT_PROXY_PASS = "http://127.0.0.1:5000"


def _require_paramiko():
    try:
        import paramiko  # type: ignore
    except Exception:
        print("Missing dependency: paramiko")
        print("Install with: python -m pip install paramiko")
        sys.exit(1)
    return paramiko


def _normalize_route(route: str) -> str:
    route = route.strip()
    if not route:
        raise ValueError("Route cannot be empty.")
    if not route.startswith("/"):
        route = "/" + route
    return route


def _build_location_block(route: str) -> str:
    return (
        "\n"
        f"    location {route} {{\n"
        f"        proxy_pass {DEFAULT_PROXY_PASS};\n"
        "        proxy_set_header Host $host;\n"
        "        proxy_set_header X-Real-IP $remote_addr;\n"
        "    }\n"
    )


def _insert_location(config_text: str, route: str) -> str:
    pattern = re.compile(r"^\s*location\s+" + re.escape(route) + r"\b", re.MULTILINE)
    if pattern.search(config_text):
        raise ValueError(f"Route already exists in config: {route}")

    lines = config_text.splitlines()
    insert_at = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == "}":
            if all(not ln.strip() for ln in lines[i + 1 :]):
                insert_at = i
                break
    if insert_at is None:
        raise ValueError("Could not find server block closing brace.")

    block = _build_location_block(route)
    new_lines = lines[:insert_at] + block.strip("\n").splitlines() + [""] + lines[insert_at:]
    new_text = "\n".join(new_lines)
    if not new_text.endswith("\n"):
        new_text += "\n"
    return new_text


def _select_remote_path(sftp, candidates):
    for path in candidates:
        try:
            sftp.stat(path)
            return path
        except Exception:
            continue
    raise FileNotFoundError("Could not find n-lux.com in default nginx config paths.")


def main():
    route_input = input("Nhap route muon them (vi du: /new/): ").strip()
    password = getpass.getpass("Nhap password VPS: ")

    try:
        route = _normalize_route(route_input)
    except ValueError as exc:
        print(str(exc))
        sys.exit(1)

    paramiko = _require_paramiko()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, username=USER, password=password, timeout=15)
        sftp = client.open_sftp()
        remote_path = _select_remote_path(sftp, REMOTE_CANDIDATES)

        with sftp.open(remote_path, "rb") as f:
            raw = f.read()
        text = raw.decode("utf-8", errors="replace")

        updated = _insert_location(text, route)

        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"n-lux.com.backup.{ts}"
        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Backup saved: {backup_path}")

        with sftp.open(remote_path, "wb") as f:
            f.write(updated.encode("utf-8"))

        print(f"Updated nginx config: {remote_path}")
        print("Done.")
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
    finally:
        try:
            client.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
