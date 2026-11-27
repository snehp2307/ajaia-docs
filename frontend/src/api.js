// small wrapper around fetch so every call handles errors the same way

export class ApiError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method, url, body) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    let message = "Something went wrong";
    if (typeof detail === "string") message = detail;
    else if (detail?.message) message = detail.message;
    else if (Array.isArray(detail)) message = detail[0]?.msg || message; // pydantic validation errors
    throw new ApiError(res.status, message, detail);
  }
  return data;
}

export const api = {
  login: (email, password) => request("POST", "/api/login", { email, password }),
  logout: () => request("POST", "/api/logout"),
  me: () => request("GET", "/api/me"),
  users: () => request("GET", "/api/users"),

  listDocs: () => request("GET", "/api/documents"),
  getDoc: (id) => request("GET", `/api/documents/${id}`),
  createDoc: (title) => request("POST", "/api/documents", { title }),
  updateDoc: (id, changes) => request("PATCH", `/api/documents/${id}`, changes),
  deleteDoc: (id) => request("DELETE", `/api/documents/${id}`),
  importDoc: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("POST", "/api/documents/import", form);
  },

  share: (id, email, role) => request("POST", `/api/documents/${id}/shares`, { email, role }),
  unshare: (id, userId) => request("DELETE", `/api/documents/${id}/shares/${userId}`),
};
