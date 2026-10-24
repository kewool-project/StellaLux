const electron = require("electron");
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell, session } =
  electron;
const { autoUpdater } = require("electron-updater");
const lib = require("./lib.js");
const config = require("./config.json");
const Store = require("electron-store");

const page_dir = path.join(__dirname, "/src/");
const twitterId = config["TWITTER_ID"];

const store = new Store();

const lock = app.requestSingleInstanceLock();

let mainWin;
let tray;
let backWin;
let streamWin = {};
const streamRequests = new Map();
let spaceWin = {};
let chatWin = {};
let trayIcon;
let guideWin;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 560,
    height: 494,
    frame: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    icon: path.join(page_dir, "assets/icon.png"),
    resizable: false,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 12,
      y: 12,
    },
  });
  mainWin.setMenu(null);
  mainWin.loadURL(
    "file://" +
      path.join(page_dir, `pages/main/index.html?platform=${process.platform}`),
  );
  mainWin.on("closed", () => {
    mainWin = null;
  });
  // mainWin.webContents.openDevTools();
}

function createBackground() {
  backWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  // backWin.webContents.openDevTools();

  backWin.loadFile(path.join(page_dir, "pages/background/index.html"));
}

function createPIPWin(url, channelId) {
  streamWin[channelId] = {};
  streamWin[channelId].pip = new BrowserWindow({
    width: store.get("pip_options")[channelId].size.width,
    height: store.get("pip_options")[channelId].size.height,
    minWidth: 240,
    minHeight: 135,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
      partition: channelId,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
    x: store.get("pip_options")[channelId].location.x,
    y: store.get("pip_options")[channelId].location.y,
    opacity: store.get("pip_options")[channelId].opacity,
  });
  streamWin[channelId].pip.setAspectRatio(16 / 9);
  streamWin[channelId].pip.setMenu(null);
  streamWin[channelId].pip.loadURL(
    "file://" +
      path.join(
        page_dir,
        `pages/pip/index.html?url=${url}&channelId=${channelId}`,
      ),
  );
  streamWin[channelId].pip.setAlwaysOnTop(true, "screen-saver");
  streamWin[channelId].pip.setVisibleOnAllWorkspaces(true);

  const windows = streamWin[channelId];
  windows.pip.on("closed", () => {
    if (streamWin[channelId] === windows) closeStream(channelId, true);
  });

  createLiveWin(channelId);
}

function closeStream(channelId, closed) {
  const windows = streamWin[channelId];
  const chat = chatWin[channelId];
  streamRequests.delete(channelId);
  streamWin[channelId] = null;
  chatWin[channelId] = null;
  store.set(`auto_start.${channelId}.status`, false);
  store.set(`auto_start.${channelId}.closed`, closed);
  for (const window of [windows?.pip, windows?.points, chat]) {
    if (window && !window.isDestroyed()) window.close();
  }
}

function createLiveWin(channelId) {
  streamWin[channelId].points = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
  });
  streamWin[channelId].points.loadURL(
    "https://chzzk.naver.com/live/" + channelId,
    {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
  );
  streamWin[channelId].points.webContents.setAudioMuted(true);
  const points = streamWin[channelId].points;
  points.webContents.on("did-finish-load", () => {
    if (points.isDestroyed()) return;
    points.webContents.executeJavaScript(
      `setTimeout(() => {
        document.querySelector("#layout-body > section > div > main > div.live_information_contents__ms0SV > div.live_information_player__uFFcH > div.live_information_video_dimmed__Hrmtd > div > div:nth-child(4) > button").click();
      }, 3000);`,
    );
  });
}

function createChatWin(channelId, type) {
  chatWin[channelId] = new BrowserWindow({
    x:
      type === "stream"
        ? store.get("pip_options")[channelId].location.x +
          store.get("pip_options")[channelId].size.width
        : store.get("space_options")[channelId].location.x +
          store.get("space_options")[channelId].size.width,
    y:
      type === "stream"
        ? store.get("pip_options")[channelId].location.y
        : store.get("space_options")[channelId].location.y,
    width: 380,
    height: store.get("pip_options")[channelId].size.height,
    webPreferences: {
      webviewTag: true,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
  });
  chatWin[channelId].setMenu(null);
  chatWin[channelId].loadURL(
    "file://" + path.join(page_dir, `pages/chat/index.html?name=${channelId}`),
  );
  chatWin[channelId].setAlwaysOnTop(true, "screen-saver");
  chatWin[channelId].setVisibleOnAllWorkspaces(true);
}

function createSpaceWin(url, channelId) {
  spaceWin[channelId] = {};
  spaceWin[channelId].pip = new BrowserWindow({
    width: store.get("space_options")[channelId].size.width,
    height: store.get("space_options")[channelId].size.height,
    minWidth: 240,
    minHeight: 135,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
    x: store.get("space_options")[channelId].location.x,
    y: store.get("space_options")[channelId].location.y,
    opacity: store.get("space_options")[channelId].opacity,
  });
  spaceWin[channelId].pip.setAspectRatio(16 / 9);
  spaceWin[channelId].pip.setMenu(null);
  spaceWin[channelId].pip.loadURL(
    "file://" +
      path.join(
        page_dir,
        `pages/space/index.html?url=${url}&channelId=${channelId}`,
      ),
  );
  spaceWin[channelId].pip.setAlwaysOnTop(true, "screen-saver");
  spaceWin[channelId].pip.setVisibleOnAllWorkspaces(true);
  // spaceWin[channelId].pip.openDevTools();
}

function createGuideWin() {
  guideWin = new BrowserWindow({
    width: 1280,
    height: 1080,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    opacity: 1,
  });
  guideWin.loadFile(path.join(page_dir, "pages/guide/index.html"));
}

if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized() || !mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    } else if (!mainWin) {
      createMainWindow();
    }
  });
}

app.on("ready", () => {
  store.set("app_start", false);
  if (!store.get("3.0.0")) {
    store.delete("pip_order");
    store.delete("auto_start");
    store.delete("pip_options");
    store.set("3.0.0", true);
  }
  if (!store.get("3.2.0")) {
    store.delete("pip_order");
    store.delete("auto_start");
    store.delete("pip_options");
    store.delete("space_auto_start");
    store.delete("space_options");
    store.set("3.2.0", true);
  }
  const savedOrder = store.get("pip_order");
  const order = [...new Set(savedOrder ?? [])];
  config["CHANNEL_ID"].forEach((channelId) => {
    if (!order.includes(channelId)) order.push(channelId);
  });
  store.set("pip_order", order);
  if (!savedOrder) {
    app.setLoginItemSettings({
      openAtLogin: true,
    });
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  order.forEach((channelId) => {
    ["auto_start", "space_auto_start"].forEach((key) => {
      const settings = store.get(`${key}.${channelId}`);
      store.set(`${key}.${channelId}`, {
        ...settings,
        enabled: settings?.enabled ?? false,
        closed: false,
        status: false,
      });
    });
    ["pip_options", "space_options"].forEach((key) => {
      if (!store.get(`${key}.${channelId}`)) {
        const isPip = key === "pip_options";
        store.set(`${key}.${channelId}`, {
          location: {
            x: width - (isPip ? 530 : 290),
            y: height - (isPip ? 320 : 185),
          },
          size: {
            width: isPip ? 480 : 240,
            height: isPip ? 270 : 135,
          },
          volume: 0.5,
          opacity: 1,
        });
      }
    });
  });
  if (!store.get("chzzk_session")) {
    store.set("chzzk_session", "");
  } else {
    try {
      store
        .get("chzzk_session")
        .split(";")
        .forEach((e) => {
          if (e === "") return;
          const cookie = {
            url: "https://chzzk.naver.com",
            name: e.split("=")[0],
            value: e.split("=")[1],
            domain: ".naver.com",
            secure: true,
          };
          session.defaultSession.cookies.set(cookie);
        });
    } catch {}
  }

  createMainWindow();
  createBackground();
  trayIcon =
    process.platform === "darwin" ? "assets/icon_mac.png" : "assets/icon2.png";
  tray = new Tray(path.join(page_dir, trayIcon));
  const contextMenu = Menu.buildFromTemplate([
    { label: "Exit", type: "normal", role: "quit" },
  ]);
  tray.setToolTip(config["TOOLTIP_NAME"]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!mainWin) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (backWin === null) createBackground();
  if (mainWin === null) createMainWindow();
});

ipcMain.on("getChannelInfo", async (evt) => {
  const info = await Promise.all(
    store.get("pip_order").map(async (e) => {
      const user = await lib.getUserById(e);
      let stream = null;
      if (user.content.openLive) {
        stream = await lib.getLiveById(e, store.get("chzzk_session") ?? "");
      }
      const lastStreamDate = await lib.getLastStreamDate(e);
      let isSpace = null;
      if (store.get("twitter_csrf_token") && store.get("twitter_auth_token")) {
        isSpace = await lib.checkSpace(
          store.get("twitter_csrf_token"),
          store.get("twitter_auth_token"),
          twitterId[e],
        );
      }
      return {
        name: e,
        displayName: user.content.channelName,
        profile: user.content.channelImageUrl,
        follows: user.content.followerCount,
        startDate: stream?.content.openDate ?? false,
        lastStreamDate: lastStreamDate,
        isStream: user.content.openLive,
        thumbnail: stream?.content.liveImageUrl,
        isSpace: isSpace,
      };
    }),
  );
  backWin.webContents.send("login");
  autoUpdater.checkForUpdates();
  evt.returnValue = info;
});

ipcMain.on("login", async (evt) => {
  store.set("chzzk_session", await lib.loginAndGetSession());
  mainWin.webContents.reload();
});

ipcMain.on("logout", () => {
  store.delete("chzzk_session");
  lib.logout();
  mainWin.webContents.reload();
});

ipcMain.on("getUserProfile", async (evt) => {
  const user = await lib.getMyData(store.get("chzzk_session"));
  if (!user) store.set("chzzk_session", "");
  evt.returnValue = {
    name: user?.nickname,
    profile: user?.profileImageUrl,
  };
});

ipcMain.on("getThumnail", async (evt, channelId) => {
  const thumnail = (
    await lib.getLiveById(channelId, store.get("chzzk_session") ?? "")
  ).content.liveImageUrl;
  evt.returnValue = thumnail;
});

ipcMain.on("getStream", async (evt, channelId) => {
  const pip = streamWin[channelId]?.pip;
  if (pip && !pip.isDestroyed()) {
    pip.focus();
    return;
  }
  if (streamRequests.has(channelId)) return;
  const request = {};
  streamRequests.set(channelId, request);
  store.set(`auto_start.${channelId}.status`, true);
  try {
    const user = await lib.getUserById(channelId);
    if (streamRequests.get(channelId) !== request || !user.content.openLive)
      return;
    const res = await lib.getLiveById(
      channelId,
      store.get("chzzk_session") ?? "",
    );
    if (streamRequests.get(channelId) !== request) return;
    const playback = res.content.livePlaybackJson;
    const hls = playback && JSON.parse(playback).media?.[0]?.path;
    if (hls) createPIPWin(hls, channelId);
  } catch (error) {
    console.error("Failed to open stream", channelId, error);
    if (streamRequests.get(channelId) === request)
      closeStream(channelId, false);
  } finally {
    if (streamRequests.get(channelId) === request) {
      streamRequests.delete(channelId);
      const window = streamWin[channelId]?.pip;
      store.set(
        `auto_start.${channelId}.status`,
        Boolean(window && !window.isDestroyed()),
      );
    }
  }
});

ipcMain.on("movePIP", (evt, arg) => {
  const pip = streamWin[arg.name]?.pip;
  if (!pip || pip.isDestroyed()) return;
  const currentPostion = pip.getPosition();
  const newPosition = {
    x: currentPostion[0] + arg.x,
    y: currentPostion[1] + arg.y,
  };
  pip.setBounds({
    x: newPosition.x,
    y: newPosition.y,
    width: store.get("pip_options")[arg.name].size.width,
    height: store.get("pip_options")[arg.name].size.height,
  });
  store.set(`pip_options.${arg.name}.location`, newPosition);
});

ipcMain.on("resizePIP", (evt, arg) => {
  store.set(`pip_options.${arg.name}.size`, arg.size);
  store.set(`pip_options.${arg.name}.location`, arg.location);
});

ipcMain.on("changeOpacity", (evt, name) => {
  const pip = streamWin[name]?.pip;
  if (pip && !pip.isDestroyed())
    pip.setOpacity(store.get(`pip_options.${name}.opacity`));
});

ipcMain.on("openChat", (evt, name, type) => {
  if (chatWin[name]) {
    chatWin[name].close();
    chatWin[name] = null;
    return;
  }
  createChatWin(name, type);
});

ipcMain.on("fixedPIP", (evt, fixed, option) => {
  const pip = BrowserWindow.fromWebContents(evt.sender);
  if (!pip || pip.isDestroyed()) return;
  pip.resizable = !fixed;
  pip.setIgnoreMouseEvents(fixed, option);
});

ipcMain.on("closePIP", (evt, name) => {
  if (evt.sender && evt.sender !== streamWin[name]?.pip?.webContents) return;
  closeStream(name, true);
});

ipcMain.on("closeAllPIP", () => {
  const order = store.get("pip_order");
  order.forEach((e) => {
    if (streamWin[e] || streamRequests.has(e)) closeStream(e, true);
  });
});

ipcMain.on("isStreamOff", async (evt, name) => {
  const isStream = (await lib.getUserById(name)).content.openLive;
  if (!isStream) store.set(`auto_start.${name}.closed`, false);
});

ipcMain.on("isStreamOffWhileOn", async (evt, channelId) => {
  const windows = streamWin[channelId];
  if (!windows?.pip || windows.pip.isDestroyed()) return;
  if (evt.sender && evt.sender !== windows.pip.webContents) return;
  try {
    const isStream = (await lib.getUserById(channelId)).content.openLive;
    if (!isStream && streamWin[channelId] === windows)
      closeStream(channelId, false);
  } catch (error) {
    console.error("Failed to check stream", channelId, error);
  }
});

ipcMain.on("openNewWindow", (evt, url) => {
  shell.openExternal(url);
});

ipcMain.on("resetPIPSetting", () => {
  store.delete("pip_options");
  const order = store.get("pip_order");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  let pip_options = {};
  order.forEach((e) => {
    pip_options[e] = {
      location: {
        x: width - 530,
        y: height - 320,
      },
      size: {
        width: 480,
        height: 270,
      },
      volume: 0.5,
      opacity: 1,
    };
  });
  store.set("pip_options", pip_options);
});

ipcMain.on("getSpace", async (evt, name) => {
  if (spaceWin[name]?.pip || store.get("space_auto_start")[name].status) {
    spaceWin[name].pip.focus();
    return;
  }
  const spaceId = await lib.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (spaceId) {
    const spaceM3U8 = await lib.getSpaceM3U8(
      spaceId,
      store.get("twitter_csrf_token"),
      store.get("twitter_auth_token"),
    );
    store.set(`space_auto_start.${name}.status`, true);
    setTimeout(() => {
      createSpaceWin(spaceM3U8, name);
    }, 10000);
  }
});

ipcMain.on("moveSpace", (evt, arg) => {
  const currentPostion = spaceWin[arg.name].pip.getPosition();
  const newPosition = {
    x: currentPostion[0] + arg.x,
    y: currentPostion[1] + arg.y,
  };
  spaceWin[arg.name].pip.setBounds({
    x: newPosition.x,
    y: newPosition.y,
    width: store.get("space_options")[arg.name].size.width,
    height: store.get("space_options")[arg.name].size.height,
  });
  store.set(`space_options.${arg.name}.location`, newPosition);
});

ipcMain.on("resizeSpace", (evt, arg) => {
  store.set(`space_options.${arg.name}.size`, arg.size);
  store.set(`space_options.${arg.name}.location`, arg.location);
});

ipcMain.on("changeSpaceOpacity", (evt, name) => {
  spaceWin[name].pip.setOpacity(store.get(`space_options.${name}.opacity`));
});

ipcMain.on("closeSpace", (evt, name) => {
  spaceWin[name].pip.close();
  spaceWin[name].pip = null;
  spaceWin[name] = null;
  store.set(`space_auto_start.${name}.status`, false);
  store.set(`space_auto_start.${name}.closed`, true);
});

ipcMain.on("closeAllSpace", () => {
  const order = store.get("pip_order");
  order.forEach((e) => {
    if (spaceWin[e]?.pip) {
      spaceWin[e].pip.close();
      spaceWin[e].pip = null;
      spaceWin[e] = null;
      store.set(`space_auto_start.${e}.status`, false);
      store.set(`space_auto_start.${e}.closed`, true);
    }
  });
});

ipcMain.on("isSpaceOff", async (evt, name) => {
  const isSpace = await lib.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (!isSpace) store.set(`space_auto_start.${name}.closed`, false);
});

ipcMain.on("isSpaceOffWhileOn", async (evt, name) => {
  const isSpace = await lib.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (!isSpace) {
    spaceWin[name].pip.close();
    spaceWin[name].pip = null;
    spaceWin[name] = null;
    store.set(`space_auto_start.${name}.status`, false);
    store.set(`space_auto_start.${name}.closed`, false);
  }
});

ipcMain.on("resetSpaceSetting", () => {
  store.delete("space_options");
  const order = store.get("pip_order");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  let space_options = {};
  order.forEach((e) => {
    space_options[e] = {
      location: {
        x: width - 290,
        y: height - 185,
      },
      size: {
        width: 240,
        height: 135,
      },
      volume: 0.5,
      opacity: 1,
    };
  });
  store.set("space_options", space_options);
});

ipcMain.on("openGuide", () => {
  createGuideWin();
});

ipcMain.on("app_version", (evt) => {
  evt.sender.send("app_version_reply", { version: app.getVersion() });
});

ipcMain.on("mac_update", () => {
  shell.openExternal(config.RELEASE_URL);
});

autoUpdater.on("update-downloaded", () => {
  mainWin.webContents.send("update_downloaded");
});

ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on("closeMainWin", () => {
  mainWin.close();
  mainWin = null;
});

ipcMain.on("minimizeMainWin", () => {
  mainWin.minimize();
});
