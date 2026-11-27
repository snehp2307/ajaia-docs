from fastapi.testclient import TestClient

from main import app


def new_doc(client, title="Test doc", content="<p>hello</p>"):
    res = client.post("/api/documents", json={"title": title, "content": content})
    assert res.status_code == 201
    return res.json()


def test_must_be_logged_in():
    client = TestClient(app)
    assert client.get("/api/documents").status_code == 401


def test_wrong_password_rejected():
    with TestClient(app) as client:
        res = client.post("/api/login", json={"email": "alice@ajaia.test", "password": "nope"})
        assert res.status_code == 401


def test_create_rename_edit_and_reopen(alice):
    doc = new_doc(alice)
    res = alice.patch(f"/api/documents/{doc['id']}", json={
        "version": doc["version"],
        "title": "Renamed",
        "content": "<h2>Plan</h2><p><strong>bold</strong> <em>it</em> <u>under</u></p><ul><li>one</li></ul>",
    })
    assert res.status_code == 200

    reopened = alice.get(f"/api/documents/{doc['id']}").json()
    assert reopened["title"] == "Renamed"
    assert "<strong>bold</strong>" in reopened["content"]
    assert "<u>under</u>" in reopened["content"]
    assert "<ul><li>one</li></ul>" in reopened["content"]
    assert reopened["version"] == doc["version"] + 1


def test_scripts_are_stripped_from_content(alice):
    doc = new_doc(alice, content='<p onclick="x()">hi</p><script>alert(1)</script>')
    assert "script" not in doc["content"]
    assert "onclick" not in doc["content"]


def test_empty_title_rejected(alice):
    res = alice.post("/api/documents", json={"title": "   "})
    assert res.status_code == 400


def test_sharing_flow(alice, bob, carol):
    doc = new_doc(alice, title="Shared plan")
    url = f"/api/documents/{doc['id']}"

    # before sharing, Bob can't see it at all
    assert bob.get(url).status_code == 404

    alice.post(url + "/shares", json={"email": "bob@ajaia.test", "role": "editor"})
    alice.post(url + "/shares", json={"email": "carol@ajaia.test", "role": "viewer"})

    # the owner's list shows how many people have access
    owned = {d["id"]: d for d in alice.get("/api/documents").json()["owned"]}
    assert owned[doc["id"]]["share_count"] == 2

    # it shows up under "shared with me", not "my documents"
    bob_list = bob.get("/api/documents").json()
    assert doc["id"] in [d["id"] for d in bob_list["shared"]]
    assert doc["id"] not in [d["id"] for d in bob_list["owned"]]

    # editor can save
    res = bob.patch(url, json={"version": doc["version"], "content": "<p>bob was here</p>"})
    assert res.status_code == 200

    # viewer can read but not save
    assert carol.get(url).status_code == 200
    res = carol.patch(url, json={"version": 2, "content": "<p>carol</p>"})
    assert res.status_code == 403

    # only the owner can share or delete
    assert bob.post(url + "/shares", json={"email": "carol@ajaia.test", "role": "editor"}).status_code == 403
    assert bob.delete(url).status_code == 403

    # removing access works
    bob_id = [s["user"]["id"] for s in alice.get(url).json()["shares"] if s["user"]["email"] == "bob@ajaia.test"][0]
    alice.delete(f"{url}/shares/{bob_id}")
    assert bob.get(url).status_code == 404


def test_share_with_unknown_email(alice):
    doc = new_doc(alice)
    res = alice.post(f"/api/documents/{doc['id']}/shares", json={"email": "nobody@x.com", "role": "viewer"})
    assert res.status_code == 404


def test_stale_save_is_rejected(alice, bob):
    # two people open the same version; second save must not silently overwrite the first
    doc = new_doc(alice)
    url = f"/api/documents/{doc['id']}"
    alice.post(url + "/shares", json={"email": "bob@ajaia.test", "role": "editor"})

    first = alice.patch(url, json={"version": doc["version"], "content": "<p>alice</p>"})
    assert first.status_code == 200
    second = bob.patch(url, json={"version": doc["version"], "content": "<p>bob</p>"})
    assert second.status_code == 409
    assert "<p>alice</p>" in alice.get(url).json()["content"]


def test_import_markdown(alice):
    md = b"# Meeting notes\n\nSome **bold** text\n\n- item one\n- item two\n"
    res = alice.post("/api/documents/import", files={"file": ("notes.md", md, "text/markdown")})
    assert res.status_code == 201
    doc = res.json()
    assert doc["title"] == "notes"
    assert "<h1>Meeting notes</h1>" in doc["content"]
    assert "<strong>bold</strong>" in doc["content"]
    assert "<li>item one</li>" in doc["content"]


def test_import_txt_escapes_html(alice):
    res = alice.post("/api/documents/import", files={"file": ("a.txt", b"line <b>1</b>\n\npara 2", "text/plain")})
    assert res.status_code == 201
    assert res.json()["content"] == "<p>line &lt;b&gt;1&lt;/b&gt;</p><p>para 2</p>"


def test_import_rejects_other_file_types(alice):
    res = alice.post("/api/documents/import", files={"file": ("x.pdf", b"%PDF", "application/pdf")})
    assert res.status_code == 400


def test_upload_over_2mb_rejected(alice):
    big = b"a" * (2 * 1024 * 1024 + 1)
    res = alice.post("/api/documents/import", files={"file": ("big.txt", big, "text/plain")})
    assert res.status_code == 413


def test_share_with_invalid_role_rejected(alice):
    doc = new_doc(alice)
    res = alice.post(f"/api/documents/{doc['id']}/shares", json={"email": "bob@ajaia.test", "role": "admin"})
    assert res.status_code == 422


def test_index_html_is_never_cached():
    import os
    if not os.path.isdir(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")):
        return  # frontend not built in this environment
    with TestClient(app) as client:
        res = client.get("/doc/anything")
        assert res.status_code == 200
        assert res.headers["cache-control"] == "no-store"
