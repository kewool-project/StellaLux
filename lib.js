const { BrowserWindow } = require("electron");
const https = require("https");

async function loginAndGetSession(id = "", pw = "") {
  let loginWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  let sessionCookie = "";

  loginWin.loadURL("https://chzzk.naver.com");
  loginWin.webContents.setAudioMuted(true);
  await loginWin.webContents.session.cookies
    .get({ url: "https://chzzk.naver.com" })
    .then((cookies) => {
      for (const cookie of cookies) {
        if (cookie.name === "NID_AUT") {
          sessionCookie = `${cookie.name}=${cookie.value};`;
        } else if (cookie.name === "NID_SES") {
          sessionCookie += `${cookie.name}=${cookie.value}`;
        }
      }
    });
  const myData = getMyData(sessionCookie);
  if (!myData.nickname) sessionCookie = "";
  if (!sessionCookie) {
    loginWin.loadURL(
      "https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fchzzk.naver.com%2F",
    );
    loginWin.webContents.on("did-finish-load", () => {
      loginWin.webContents.executeJavaScript(`
        document.getElementById("keep").checked = true;
      `);
    });
    loginWin.show();
    await new Promise((resolve) => {
      loginWin.webContents.on("did-navigate", async (event, url) => {
        if (url === "https://chzzk.naver.com/") {
          await loginWin.webContents.session.cookies
            .get({ url: "https://chzzk.naver.com" })
            .then((cookies) => {
              for (const cookie of cookies) {
                sessionCookie += `${cookie.name}=${cookie.value};`;
              }
            });
          resolve();
        }
      });
    });
  }
  loginWin.close();
  return sessionCookie;
}

function logout() {
  let logoutWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  logoutWin.loadURL("https://chzzk.naver.com/");
  logoutWin.webContents.session.clearStorageData();
}

async function getMyData(sessionCookie) {
  const headers = {
    cookie: sessionCookie ?? "",
  };

  const options = {
    hostname: "comm-api.game.naver.com",
    port: 443,
    path: "/nng_main/v1/user/getUserStatus",
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body).content);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

function getUserById(channelId) {
  const options = {
    hostname: "api.chzzk.naver.com",
    port: 443,
    path: `/service/v1/channels/${channelId}`,
    method: "GET",
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body));
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

function getLiveById(channelId, sessionCookie) {
  const headers = {
    cookie: sessionCookie ?? "",
  };

  const options = {
    hostname: "api.chzzk.naver.com",
    port: 443,
    path: `/service/v2/channels/${channelId}/live-detail`,
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body));
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

function getLastStreamDate(channel) {
  const options = {
    hostname: "api.chzzk.naver.com",
    port: 443,
    path: `/service/v1/channels/${channel}/videos?sortType=LATEST&page=0&size=1`,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${JSON.parse(data.body).message}`));
        } else {
          resolve(JSON.parse(resData.body).content.data[0]?.publishDate ?? 0);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function checkSpace(ct0, auth_token, userId) {
  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    cookie: `ct0=${ct0}; auth_token=${auth_token};`,
  };

  const options = {
    hostname: "twitter.com",
    port: 443,
    path: `/i/api/fleets/v1/avatar_content?user_ids=${userId}&only_spaces=true`,
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");
        try {
          resolve(
            JSON.parse(resData.body).users[userId].spaces.live_content
              .audiospace.broadcast_id,
          );
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function getSpaceMediaKey(id, ct0, auth_token) {
  const params = {
    variables: JSON.stringify({
      id: id,
      isMetatagsQuery: true,
      withSuperFollowsUserFields: true,
      withDownvotePerspective: false,
      withReactionsMetadata: false,
      withReactionsPerspective: false,
      withSuperFollowsTweetFields: true,
      withReplays: true,
    }),
    features: JSON.stringify({
      spaces_2022_h2_clipping: true,
      spaces_2022_h2_spaces_communities: true,
      responsive_web_twitter_blue_verified_badge_is_enabled: true,
      verified_phone_label_enabled: false,
      view_counts_public_visibility_enabled: true,
      longform_notetweets_consumption_enabled: false,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_uc_gql_enabled: true,
      vibe_api_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      interactive_text_enabled: true,
      responsive_web_text_conversations_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    }),
  };

  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    "x-csrf-token": ct0,
    cookie: `ct0=${ct0}; auth_token=${auth_token};`,
  };

  const options = {
    hostname: "api.twitter.com",
    port: 443,
    path:
      "/graphql/xjTKygiBMpX44KU8ywLohQ/AudioSpaceById?" +
      new URLSearchParams(params),
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        try {
          resolve(JSON.parse(resData.body).data.audioSpace.metadata.media_key);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function getSpaceM3U8(id, ct0, auth_token) {
  const media_key = await getSpaceMediaKey(id, ct0, auth_token);
  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    cookie: "auth_token=",
  };

  const options = {
    hostname: "twitter.com",
    port: 443,
    path: "/i/api/1.1/live_video_stream/status/" + media_key,
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        try {
          resolve(JSON.parse(resData.body).source.location);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

module.exports = {
  getUserById: getUserById,
  getLiveById: getLiveById,
  getLastStreamDate: getLastStreamDate,
  checkSpace: checkSpace,
  getSpaceM3U8: getSpaceM3U8,
  loginAndGetSession: loginAndGetSession,
  getMyData: getMyData,
  logout: logout,
};
