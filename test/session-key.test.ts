import { describe, it, expect, beforeEach } from "vitest";
import { generateSessionKey, saveSessionKey, loadSessionKey, loadSessionKeyInfo } from "../src/session-key.js";
import type { SessionKey } from "../src/types.js";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("generateSessionKey", () => {
  it("应该生成一个有效的 Session Key", () => {
    const key = generateSessionKey();
    expect(key.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(key.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("每次调用应生成不同的 key", () => {
    const key1 = generateSessionKey();
    const key2 = generateSessionKey();
    expect(key1.privateKey).not.toBe(key2.privateKey);
    expect(key1.address).not.toBe(key2.address);
  });
});

describe("saveSessionKey / loadSessionKey", () => {
  const tmpFile = join(tmpdir(), `test-session-key-${Date.now()}.json`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  });

  it("应该保存 Session Key 到文件", () => {
    const key = generateSessionKey();
    saveSessionKey(tmpFile, key);
    expect(existsSync(tmpFile)).toBe(true);
  });

  it("应该从文件加载 Session Key", () => {
    const key = generateSessionKey();
    saveSessionKey(tmpFile, key);

    const loaded = loadSessionKey(tmpFile);
    expect(loaded).not.toBeNull();
    // loadSessionKey 返回 viem Account 对象，其 address 应与原始 key 匹配
    expect(loaded!.address.toLowerCase()).toBe(key.address.toLowerCase());
  });

  it("不存在的文件应返回 null", () => {
    expect(loadSessionKey(tmpFile)).toBeNull();
  });
});

describe("loadSessionKeyInfo", () => {
  const tmpFile = join(tmpdir(), `test-session-key-info-${Date.now()}.json`);

  beforeEach(() => {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  });

  it("应该加载包含地址的 key 文件", () => {
    const key: SessionKey = {
      privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      address: "0xAbCdEf1234567890",
    };
    saveSessionKey(tmpFile, key);

    const info = loadSessionKeyInfo(tmpFile);
    expect(info).not.toBeNull();
    expect(info!.address).toBe("0xAbCdEf1234567890");
  });

  it("格式错误的文件应返回 null", () => {
    require("fs").writeFileSync(tmpFile, "not json");
    expect(loadSessionKeyInfo(tmpFile)).toBeNull();
  });
});
