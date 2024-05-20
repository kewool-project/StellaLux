const electron = require("electron");
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell } = electron;
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

  createLiveWin(channelId);
}

function createLiveWin(channelId) {
  streamWin[channelId].points = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
  });
  streamWin[channelId].points.loadURL(
    "https://chzzk.naver.com/live/" + channelId,
  );
  streamWin[channelId].points.webContents.setAudioMuted(true);
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
    width: 350,
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
    "file://" +
      path.join(page_dir, `pages/chat/index.html?channelId=${channelId}`),
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
  // store.delete("pip_order"); //test
  // store.delete("auto_start"); //test
  // store.delete("pip_options"); //test
  // store.delete("space_auto_start"); //test
  // store.delete("space_options"); //test
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
  if (!store.get("pip_order")) {
    store.set("pip_order", config["CHANNEL_ID"]);
    app.setLoginItemSettings({
      openAtLogin: true,
    });
  }
  if (!store.get("auto_start")) {
    const order = store.get("pip_order");
    let autoStart = {};
    order.forEach((e) => {
      autoStart[e] = {};
      autoStart[e].enabled = false;
      autoStart[e].closed = false;
      autoStart[e].status = false;
    });
    store.set("auto_start", autoStart);
  } else {
    const order = store.get("pip_order");
    order.forEach((e) => {
      store.set(`auto_start.${e}.closed`, false);
      store.set(`auto_start.${e}.status`, false);
    });
  }
  if (!store.get("space_auto_start")) {
    const order = store.get("pip_order");
    let spaceAutoStart = {};
    order.forEach((e) => {
      spaceAutoStart[e] = {};
      spaceAutoStart[e].enabled = false;
      spaceAutoStart[e].closed = false;
      spaceAutoStart[e].status = false;
    });
    store.set("space_auto_start", spaceAutoStart);
  } else {
    const order = store.get("pip_order");
    order.forEach((e) => {
      store.set(`space_auto_start.${e}.closed`, false);
      store.set(`space_auto_start.${e}.status`, false);
    });
  }
  if (!store.get("pip_options")) {
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
  }
  if (!store.get("space_options")) {
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
        stream = await lib.getLiveById(e);
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

ipcMain.on("getThumnail", async (evt, channelId) => {
  const thumnail = (await lib.getLiveById(channelId)).content.liveImageUrl;
  evt.returnValue = thumnail;
});

ipcMain.on("getStream", async (evt, channelId) => {
  if (streamWin[channelId]?.pip || store.get("auto_start")[channelId].status) {
    streamWin[channelId].pip.focus();
    return;
  }
  const isStream = (await lib.getUserById(channelId)).content.openLive;
  if (isStream) {
    store.set(`auto_start.${channelId}.status`, true);
    lib.getLiveById(channelId).then((res) => {
      const hls = JSON.parse(res.content.livePlaybackJson).media[0].path;
      createPIPWin(hls, channelId);
    });
  }
});

ipcMain.on("movePIP", (evt, arg) => {
  const currentPostion = streamWin[arg.name].pip.getPosition();
  const newPosition = {
    x: currentPostion[0] + arg.x,
    y: currentPostion[1] + arg.y,
  };
  streamWin[arg.name].pip.setBounds({
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
  streamWin[name].pip.setOpacity(store.get(`pip_options.${name}.opacity`));
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
  pip.resizable = !fixed;
  pip.setIgnoreMouseEvents(fixed, option);
});

ipcMain.on("closePIP", (evt, name) => {
  streamWin[name].pip.close();
  streamWin[name].pip = null;
  streamWin[name].points.close();
  streamWin[name].points = null;
  if (chatWin[name]) {
    chatWin[name].close();
    chatWin[name] = null;
  }
  streamWin[name] = null;
  store.set(`auto_start.${name}.status`, false);
  store.set(`auto_start.${name}.closed`, true);
});

ipcMain.on("closeAllPIP", () => {
  const order = store.get("pip_order");
  order.forEach((e) => {
    if (streamWin[e]?.pip) {
      streamWin[e].pip.close();
      streamWin[e].pip = null;
      streamWin[e].points.close();
      streamWin[e].points = null;
      if (chatWin[e]) {
        chatWin[e].close();
        chatWin[e] = null;
      }
      streamWin[e] = null;
      store.set(`auto_start.${e}.status`, false);
      store.set(`auto_start.${e}.closed`, true);
    }
  });
});

ipcMain.on("isStreamOff", async (evt, name) => {
  const isStream = (await lib.getUserById(name)).content.openLive;
  if (!isStream) store.set(`auto_start.${name}.closed`, false);
});

ipcMain.on("isStreamOffWhileOn", async (evt, channelId) => {
  const isStream = (await lib.getUserById(channelId)).content.openLive;
  if (!isStream) {
    streamWin[channelId].pip.close();
    streamWin[channelId].pip = null;
    streamWin[channelId].points.close();
    streamWin[channelId].points = null;
    if (chatWin[channelId]) {
      chatWin[channelId].close();
      chatWin[channelId] = null;
    }
    streamWin[channelId] = null;
    store.set(`auto_start.${channelId}.status`, false);
    store.set(`auto_start.${channelId}.closed`, false);
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
