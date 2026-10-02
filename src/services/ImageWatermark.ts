import { existsSync } from "node:fs";
import { resolve } from "node:path";
import axios from "axios";
import sharp from "sharp";

export interface WatermarkOptions {
  watermarkPath?: string;
  opacity?: number;
  relativeWidth?: number;
}

const DEFAULT_WATERMARK_PATH = resolve("assets/watermark.png");
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function createWatermarkedImage(
  imageUrl: string,
  options: WatermarkOptions = {},
): Promise<Buffer | undefined> {
  const watermarkPath = resolve(options.watermarkPath ?? DEFAULT_WATERMARK_PATH);
  if (!existsSync(watermarkPath)) return undefined;

  const response = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: "arraybuffer",
    timeout: 10_000,
    maxContentLength: MAX_INPUT_BYTES,
  });
  const source = Buffer.from(response.data);
  const sourceImage = sharp(source, { limitInputPixels: 32_000_000 }).rotate();
  const metadata = await sourceImage.metadata();
  if (!metadata.width || !metadata.height) return undefined;

  const relativeWidth = options.relativeWidth ?? 0.18;
  const watermarkWidth = Math.max(72, Math.min(180, Math.round(metadata.width * relativeWidth)));
  const padding = Math.max(12, Math.round(metadata.width * 0.035));
  const watermark = await createWatermarkOverlay(watermarkPath, watermarkWidth, options.opacity ?? 0.78);
  const watermarkMetadata = await sharp(watermark).metadata();
  if (!watermarkMetadata.width || !watermarkMetadata.height) return undefined;

  const left = Math.max(padding, metadata.width - watermarkMetadata.width - padding);
  const top = Math.max(padding, metadata.height - watermarkMetadata.height - padding);

  return sourceImage
    .composite([{ input: watermark, left, top }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function createWatermarkOverlay(
  watermarkPath: string,
  width: number,
  opacity: number,
): Promise<Buffer> {
  const resized = sharp(watermarkPath)
    .trim({ background: "#ffffff", threshold: 10 })
    .resize({ width, withoutEnlargement: true })
    .ensureAlpha();
  const metadata = await resized.metadata();
  if (!metadata.width || !metadata.height) {
    return resized.png().toBuffer();
  }

  return resized
    .composite([{
      input: {
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: opacity },
        },
      },
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
}
