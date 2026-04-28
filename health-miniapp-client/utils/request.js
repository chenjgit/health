const app = getApp();

function buildUrl(path, query) {
  const base = app.globalData.baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${p}`;
  if (query && typeof query === "object") {
    const qs = Object.keys(query)
      .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== "")
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  return url;
}

function request({ method = "GET", path, query, data }) {
  return new Promise((resolve, reject) => {
    const headers = {
      "content-type": "application/json"
    };
    if (app.globalData.token) {
      headers["Authorization"] = `Bearer ${app.globalData.token}`;
    }
    wx.request({
      url: buildUrl(path, query),
      method,
      timeout: 15000,
      header: headers,
      data,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data || { message: "request failed", statusCode: res.statusCode });
        }
      },
      fail: (err) => reject(err)
    });
  });
}

module.exports = {
  request
};

