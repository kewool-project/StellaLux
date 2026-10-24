const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const config = require("../config.json");

const source = fs.readFileSync(path.join(__dirname, "../main.js"), "utf8");
const channelId = config.CHANNEL_ID[0];
const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function createStore(initial = {}) {
  const data = {};
  const store = {
    get(key) {
      return clone(key.split(".").reduce((obj, part) => obj?.[part], data));
    },
    set(key, value) {
      const parts = key.split(".");
      const last = parts.pop();
      let obj = data;
      for (const part of parts) obj = obj[part] ??= {};
      obj[last] = clone(value);
    },
    delete(key) {
      delete data[key];
    },
  };
  for (const [key, value] of Object.entries(initial)) store.set(key, value);
  return store;
}

function loadMain(initial = {}, overrides = {}) {
  const store = createStore(initial);
  const handlers = new Map();
  const app = new EventEmitter();
  app.requestSingleInstanceLock = () => true;
  app.setLoginItemSettings = () => {};
  const windows = [];
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.focusCount = 0;
      this.webContents = new EventEmitter();
      this.webContents.setAudioMuted = () => {};
      this.webContents.executeJavaScript = async () => {};
      windows.push(this);
    }
    isDestroyed() {
      return this.destroyed;
    }
    close() {
      assert.equal(this.destroyed, false, "a window must only close once");
      this.destroyed = true;
      this.emit("closed");
    }
    focus() {
      assert.equal(this.destroyed, false);
      this.focusCount++;
    }
    loadURL(url) {
      this.url = url;
    }
    loadFile(file) {
      this.file = file;
    }
  }
  for (const method of [
    "setMenu",
    "setAspectRatio",
    "setAlwaysOnTop",
    "setVisibleOnAllWorkspaces",
    "setOpacity",
    "setIgnoreMouseEvents",
  ]) {
    FakeWindow.prototype[method] = () => {};
  }
  FakeWindow.fromWebContents = () => null;
  class FakeTray extends EventEmitter {
    setToolTip() {}
    setContextMenu() {}
  }
  const lib = {
    getUserById: async () => ({ content: { openLive: true } }),
    getLiveById: async () => ({
      content: {
        livePlaybackJson: JSON.stringify({ media: [{ path: "test-stream" }] }),
      },
    }),
    ...overrides,
  };
  const electron = {
    app,
    BrowserWindow: FakeWindow,
    ipcMain: { on: (name, handler) => handlers.set(name, handler) },
    Tray: FakeTray,
    Menu: { buildFromTemplate: () => [] },
    screen: {
      getPrimaryDisplay: () => ({
        workAreaSize: { width: 1920, height: 1080 },
      }),
    },
    session: { defaultSession: { cookies: { set() {} } } },
  };
  vm.runInNewContext(source, {
    __dirname: path.resolve(__dirname, ".."),
    process,
    console: { error() {} },
    setTimeout,
    require(name) {
      if (name === "electron") return electron;
      if (name === "electron-store")
        return class {
          constructor() {
            return store;
          }
        };
      if (name === "electron-updater")
        return { autoUpdater: new EventEmitter() };
      if (name === "./lib.js") return lib;
      if (name === "./config.json") return clone(config);
      return require(name);
    },
  });
  return {
    store,
    windows,
    lib,
    start: () => app.emit("ready"),
    send: (name, ...args) => handlers.get(name)({}, ...args),
    sendFrom: (name, sender, ...args) =>
      handlers.get(name)({ sender }, ...args),
    streams: () =>
      windows.filter((window) => window.options.webPreferences?.partition),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("fresh installation stays unique across subsequent launches", () => {
  const app = loadMain();
  for (let launch = 0; launch < 3; launch++) {
    app.start();
    assert.deepEqual(app.store.get("pip_order"), config.CHANNEL_ID);
  }
});

test("upgrade repairs duplicates, preserving custom order and window preferences", () => {
  const order = [...config.CHANNEL_ID].reverse();
  const options = {
    location: { x: 42, y: 84 },
    size: { width: 640, height: 360 },
    volume: 0.8,
    opacity: 0.7,
  };
  const app = loadMain({
    "3.0.0": true,
    "3.2.0": true,
    "3.2.9": true,
    pip_order: [...order, channelId, channelId],
    pip_options: { [channelId]: options },
    space_options: { [channelId]: options },
    auto_start: { [channelId]: { enabled: true } },
  });
  app.start();
  assert.deepEqual(app.store.get("pip_order"), order);
  assert.deepEqual(app.store.get(`pip_options.${channelId}`), options);
  assert.deepEqual(app.store.get(`space_options.${channelId}`), options);
  assert.equal(app.store.get(`auto_start.${channelId}.enabled`), true);
});

test("missing members append after the saved order and receive complete defaults", () => {
  const order = config.CHANNEL_ID.slice(0, -4).reverse();
  const app = loadMain({
    "3.0.0": true,
    "3.2.0": true,
    pip_order: order,
    auto_start: {},
    space_auto_start: {},
    pip_options: {},
    space_options: {},
  });
  app.start();
  assert.deepEqual(app.store.get("pip_order"), [
    ...order,
    ...config.CHANNEL_ID.slice(-4),
  ]);
  for (const id of config.CHANNEL_ID) {
    assert.deepEqual(app.store.get(`auto_start.${id}`), {
      enabled: false,
      closed: false,
      status: false,
    });
    assert.deepEqual(app.store.get(`pip_options.${id}.size`), {
      width: 480,
      height: 270,
    });
  }
});

test("concurrent open requests create a single PIP and focus it on later requests", async () => {
  const user = deferred();
  const app = loadMain({}, { getUserById: () => user.promise });
  app.start();
  const pending = app.send("getStream", channelId);
  await app.send("getStream", channelId);
  assert.equal(app.streams().length, 0);
  user.resolve({ content: { openLive: true } });
  await pending;
  assert.equal(app.streams().length, 1);
  await app.send("getStream", channelId);
  assert.equal(app.streams().length, 1);
  assert.equal(app.streams()[0].focusCount, 1);
});

test("repeated close requests safely close PIP, points and chat windows once", async () => {
  const app = loadMain();
  app.start();
  await app.send("getStream", channelId);
  app.send("openChat", channelId, "stream");
  app.send("closePIP", channelId);
  app.send("closePIP", channelId);
  app.send("movePIP", { name: channelId, x: 1, y: 1 });
  app.send("changeOpacity", channelId);
  assert.equal(app.streams()[0].isDestroyed(), true);
  assert.ok(app.windows.slice(2).every((window) => window.isDestroyed()));
  assert.equal(app.store.get(`auto_start.${channelId}.status`), false);
  assert.equal(app.store.get(`auto_start.${channelId}.closed`), true);
});

test("closing a native PIP also cleans up its hidden points window", async () => {
  const app = loadMain();
  app.start();
  await app.send("getStream", channelId);
  app.streams()[0].close();
  assert.ok(app.windows.slice(2).every((window) => window.isDestroyed()));
  app.send("closePIP", channelId);
});

test("queued messages from a closed PIP cannot affect its replacement", async () => {
  const app = loadMain();
  app.start();
  await app.send("getStream", channelId);
  const oldSender = app.streams()[0].webContents;
  app.sendFrom("closePIP", oldSender, channelId);
  await app.send("getStream", channelId);
  app.sendFrom("closePIP", oldSender, channelId);
  app.lib.getUserById = async () => ({ content: { openLive: false } });
  await app.sendFrom("isStreamOffWhileOn", oldSender, channelId);
  assert.equal(app.streams()[1].isDestroyed(), false);
  assert.equal(app.store.get(`auto_start.${channelId}.status`), true);
});

test("an ended broadcast cleans up windows and permits later auto-start", async () => {
  const app = loadMain();
  app.start();
  await app.send("getStream", channelId);
  app.lib.getUserById = async () => ({ content: { openLive: false } });
  await app.send("isStreamOffWhileOn", channelId);
  await app.send("isStreamOffWhileOn", channelId);
  assert.ok(app.windows.slice(2).every((window) => window.isDestroyed()));
  assert.equal(app.store.get(`auto_start.${channelId}.status`), false);
  assert.equal(app.store.get(`auto_start.${channelId}.closed`), false);
});

test("close-all cancels pending opens, including late playback responses", async () => {
  const playback = deferred();
  const app = loadMain({}, { getLiveById: () => playback.promise });
  app.start();
  const pending = app.send("getStream", channelId);
  await Promise.resolve();
  app.send("closeAllPIP");
  playback.resolve({
    content: {
      livePlaybackJson: JSON.stringify({ media: [{ path: "late" }] }),
    },
  });
  await pending;
  assert.equal(app.streams().length, 0);
  assert.equal(app.store.get(`auto_start.${channelId}.status`), false);
});

test("an old request cannot reset or replace a newly opened PIP", async () => {
  const oldRequest = deferred();
  const app = loadMain({}, { getUserById: () => oldRequest.promise });
  app.start();
  const pending = app.send("getStream", channelId);
  app.send("closePIP", channelId);
  app.lib.getUserById = async () => ({ content: { openLive: true } });
  await app.send("getStream", channelId);
  oldRequest.resolve({ content: { openLive: true } });
  await pending;
  assert.equal(app.streams().length, 1);
  assert.equal(app.streams()[0].isDestroyed(), false);
  assert.equal(app.store.get(`auto_start.${channelId}.status`), true);
});

test("an offline check finishing after manual close cannot close a reopened PIP", async () => {
  const app = loadMain();
  app.start();
  await app.send("getStream", channelId);
  const check = deferred();
  app.lib.getUserById = () => check.promise;
  const pending = app.send("isStreamOffWhileOn", channelId);
  app.send("closePIP", channelId);
  app.lib.getUserById = async () => ({ content: { openLive: true } });
  await app.send("getStream", channelId);
  check.resolve({ content: { openLive: false } });
  await pending;
  assert.equal(app.streams()[1].isDestroyed(), false);
  assert.equal(app.store.get(`auto_start.${channelId}.status`), true);
});

test("network failures and unavailable playback release the open request for retry", async () => {
  for (const result of ["network-error", "no-playback", "offline"]) {
    const app = loadMain();
    app.start();
    if (result === "network-error")
      app.lib.getUserById = async () => {
        throw new Error("network");
      };
    if (result === "no-playback")
      app.lib.getLiveById = async () => ({ content: {} });
    if (result === "offline")
      app.lib.getUserById = async () => ({ content: { openLive: false } });
    await app.send("getStream", channelId);
    assert.equal(app.store.get(`auto_start.${channelId}.status`), false);
    app.lib.getUserById = async () => ({ content: { openLive: true } });
    app.lib.getLiveById = async () => ({
      content: {
        livePlaybackJson: JSON.stringify({ media: [{ path: "retry" }] }),
      },
    });
    await app.send("getStream", channelId);
    assert.equal(app.streams().length, 1);
  }
});

test("refreshing the main view leaves only one background polling interval", () => {
  const handlers = new Map();
  const active = new Set();
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../src/pages/background/script.js"),
      "utf8",
    ),
    {
      require(name) {
        if (name === "electron")
          return { ipcRenderer: { on: (name, fn) => handlers.set(name, fn) } };
        return class {};
      },
      setInterval() {
        const id = {};
        active.add(id);
        return id;
      },
      clearInterval(id) {
        active.delete(id);
      },
    },
  );
  for (let refresh = 0; refresh < 3; refresh++) handlers.get("login")();
  assert.equal(active.size, 1);
});
