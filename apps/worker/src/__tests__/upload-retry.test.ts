import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/storage.js", () => ({
  uploadLineMedia: vi.fn(),
}));

import { uploadLineMedia } from "../lib/storage.js";
import { uploadWithRetry } from "../pipeline/process-line-message.js";

const mockUpload = vi.mocked(uploadLineMedia);

describe("uploadWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1回目で成功した場合はそのままURLを返す", async () => {
    mockUpload.mockResolvedValueOnce("https://storage.googleapis.com/bucket/line/image/msg-1.jpg");

    const result = await uploadWithRetry("msg-1", "image", Buffer.from("data"));

    expect(result).toBe("https://storage.googleapis.com/bucket/line/image/msg-1.jpg");
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("1回目失敗・2回目成功でリトライしてURLを返す", async () => {
    mockUpload
      .mockRejectedValueOnce(new Error("transient error"))
      .mockResolvedValueOnce("https://storage.googleapis.com/bucket/line/image/msg-2.jpg");

    const promise = uploadWithRetry("msg-2", "image", Buffer.from("data"));

    // 1回目失敗後、1秒のバックオフ
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe("https://storage.googleapis.com/bucket/line/image/msg-2.jpg");
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it("3回すべて失敗した場合は最後のエラーをスローする", async () => {
    mockUpload
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    const promise = uploadWithRetry("msg-3", "image", Buffer.from("data"));

    // promiseにcatchを先にアタッチして unhandled rejection を防ぐ
    const caught = promise.catch((e: Error) => e);

    // 全タイマーを進めてリトライを完了させる
    await vi.runAllTimersAsync();

    const error = await caught;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("fail 3");
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it("引数が正しく uploadLineMedia に渡される", async () => {
    mockUpload.mockResolvedValueOnce("https://example.com/url");

    await uploadWithRetry("msg-4", "video", Buffer.from("video-data"));

    expect(mockUpload).toHaveBeenCalledWith("msg-4", "video", Buffer.from("video-data"));
  });
});
