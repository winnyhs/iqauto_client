from __future__ import annotations

import json
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, abort


# Usage:
# Terminal: 
#     python3 -m venv .venv
#     source .venv/bin/activate
#     pip install flask
#     python app.py
# Browser: 
#     고객정보: http://127.0.0.1:5000/client
#     진단: http://127.0.0.1:5000/diagnosis
#     진단결과: http://127.0.0.1:5000/results
#

app = Flask(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "client.json")


def _read_db() -> dict:
    if not os.path.exists(DB_PATH):
        return {"clients": []}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_db(db: dict) -> None:
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DB_PATH)


def _find_client(db: dict, name: str) -> dict | None:
    for c in db.get("clients", []):
        if c.get("name") == name:
            return c
    return None


def _sorted_names(db: dict) -> list[str]:
    names = [c.get("name", "") for c in db.get("clients", []) if c.get("name")]
    # "가나다" + 영문 혼재 대비: 기본은 파이썬 유니코드 정렬
    return sorted(names)


def _latest_test(tests: list[str]) -> str | None:
    if not tests:
        return None
    # 형식: YYYY-MM-DDTHH-MM-SS
    def key(x: str):
        try:
            return datetime.strptime(x, "%Y-%m-%dT%H-%M-%S")
        except Exception:
            return datetime.min
    return max(tests, key=key)


@app.get("/")
def index():
    # 시작 시 고객정보가 활성화
    return render_template("client.html")


@app.get("/client")
def client_page():
    return render_template("client.html")


@app.get("/diagnosis")
def diagnosis_page():
    return render_template("diagnosis.html")


@app.get("/results")
def results_page():
    return render_template("results.html")


# --- APIs ---

@app.get("/api/clients")
def api_clients():
    db = _read_db()
    return jsonify({"names": _sorted_names(db)})


@app.get("/api/client/<name>")
def api_client(name: str):
    db = _read_db()
    c = _find_client(db, name)
    if not c:
        abort(404, "client not found")
    return jsonify(c)


@app.post("/api/client")
def api_create_client():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        abort(400, "name is required")

    db = _read_db()
    if _find_client(db, name):
        abort(409, "client already exists")

    new_client = {
        "name": name,
        "birth_date": (data.get("birth_date") or "").strip(),
        "sex": (data.get("sex") or "").strip(),
        "weight": (data.get("weight") or "").strip(),
        "height": (data.get("height") or "").strip(),
        "tests": data.get("tests") or []
    }
    db.setdefault("clients", []).append(new_client)
    _write_db(db)
    return jsonify({"ok": True, "client": new_client}), 201


@app.get("/api/result")
def api_result():
    """
    Query:
      name=kkk
      test=2025-01-01T16-00-00
    """
    name = (request.args.get("name") or "").strip()
    test = (request.args.get("test") or "").strip()
    if not name or not test:
        abort(400, "name and test are required")

    db = _read_db()
    c = _find_client(db, name)
    if not c:
        abort(404, "client not found")

    if test not in (c.get("tests") or []):
        abort(404, "test not found for this client")

    # TODO: 여기서 실제 진단결과를 DB/모델에서 조회하면 됨.
    # 지금은 데모 응답
    demo_payload = {
        "name": c["name"],
        "birth_date": c.get("birth_date", ""),
        "sex": c.get("sex", ""),
        "weight": c.get("weight", ""),
        "height": c.get("height", ""),
        "test": test,
        "summary": f"[DEMO] {test} 진단 결과 요약",
        "score": 87,
        "details": [
            {"item": "A", "value": "OK"},
            {"item": "B", "value": "Needs review"},
        ],
    }
    return jsonify(demo_payload)


@app.get("/api/latest_result")
def api_latest_result():
    """
    Query:
      name=kkk
    """
    name = (request.args.get("name") or "").strip()
    if not name:
        abort(400, "name is required")

    db = _read_db()
    c = _find_client(db, name)
    if not c:
        abort(404, "client not found")

    latest = _latest_test(c.get("tests") or [])
    if not latest:
        return jsonify({"name": name, "latest": None, "result": None})

    # 재사용
    with app.test_request_context(f"/api/result?name={name}&test={latest}"):
        result = api_result().get_json()
    return jsonify({"name": name, "latest": latest, "result": result})


if __name__ == "__main__":
    app.run(debug=True)