import { getStorage } from "firebase-admin/storage";

const BUCKET_NAME = process.env.LINE_MEDIA_BUCKET ?? "hr-system-487809-line-media";

const CONTENT_TYPE_MAP: Record<string, string> = {
  image: "image/jpeg",
  video: "video/mp4",
  audio: "audio/m4a",
};

const EXT_MAP: Record<string, string> = {
  image: "jpg",
  video: "mp4",
  audio: "m4a",
};

/**
 * LINE メッセージのメディアコンテンツを Cloud Storage にアップロードし、
 * 公開URLを返す。
 */
export async function uploadLineMedia(
  messageId: string,
  messageType: string,
  data: Buffer,
): Promise<string> {
  const bucket = getStorage().bucket(BUCKET_NAME);
  const ext = EXT_MAP[messageType] ?? "bin";
  const contentType = CONTENT_TYPE_MAP[messageType] ?? "application/octet-stream";
  const filePath = `line/${messageType}/${messageId}.${ext}`;

  const file = bucket.file(filePath);
  await file.save(data, {
    metadata: { contentType },
    public: true,
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
}
