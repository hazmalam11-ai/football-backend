const { GoogleAuth } = require("google-auth-library");

async function indexURL(url) {
  try {
    // التأكد أن الأرشفة مفعلة
    if (process.env.ENABLE_GOOGLE_INDEXING !== "true") {
      console.log("Indexing disabled");
      return false;
    }

    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/indexing"],
    });

    const client = await auth.getClient();

    const res = await client.request({
      url: "https://indexing.googleapis.com/v3/urlNotifications:publish",
      method: "POST",
      data: {
        url,
        type: "URL_UPDATED",
      },
    });

    console.log("Indexed:", url, res.data);
    return true;

  } catch (err) {
    console.error("Indexing error:", err.response?.data || err.message);
    return false;
  }
}

module.exports = indexURL;
