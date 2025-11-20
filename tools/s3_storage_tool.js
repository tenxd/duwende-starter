import { Tool } from "duwende";
import { S3Client } from "bun";

export class S3StorageTool extends Tool {
  constructor(params) {
    super(params);
    this.endpoint = params.endpoint;
    this.accessKeyId = params.accessKeyId;
    this.secretAccessKey = params.secretAccessKey;
    this.bucket = params.bucket;
    this.region = params.region;

    this.s3 = new S3Client({
      bucket: this.bucket,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      endpoint: this.endpoint,
      region: this.region,
      // If needed: virtualHostedStyle, but not always required
    });
  }

  async use(params) {
    const { operation, path, content, contentType, options = {} } = params;

    try {
      switch (operation) {
        case "read": {
          const data = await this.readFromS3(path, contentType);
          return { status: 200, content: data };
        }
        case "write": {
          await this.writeToS3(path, content);
          return { status: 200, content: "Write operation successful" };
        }
        case "delete": {
          const msg = await this.deleteFromS3(path);
          return { status: 200, content: msg };
        }
        case "list": {
          const data = await this.listFromS3(path, options);
          return { status: 200, content: data };
        }
        case "count": {
          const cnt = await this.countObjectsInS3(path);
          return { status: 200, content: cnt };
        }
        default:
          return { status: 400, content: `Invalid operation: ${operation}` };
      }
    } catch (error) {
      // Bun S3 error codes documented: ERR_S3_INVALID_PATH, etc. :contentReference[oaicite:6]{index=6}
      if (error.code === "ERR_S3_INVALID_PATH") {
        return { status: 404, content: `Error: Key not found. Path: ${path}` };
      }
      return { status: 500, content: `Error: ${error.message}` };
    }
  }

  async readFromS3(key, contentType) {
    const s3file = this.s3.file(key);
    const exists = await s3file.exists?.();

    // Note: S3File.exists is supported. :contentReference[oaicite:7]{index=7}
    if (!exists) {
      const err = new Error("NoSuchKey");
      err.code = "NoSuchKey";
      throw err;
    }

    const buf = await s3file.arrayBuffer();
    const uint8 = new Uint8Array(buf);
    const nodeBuf = Buffer.from(uint8);

    if (contentType === "image/*") {
      const base64 = nodeBuf.toString("base64");
      // Bun’s S3File doesn't always expose contentType, so fallback:
      const ct = s3file.type ?? "application/octet-stream";
      return `data:${ct};base64,${base64}`;
    }

    return nodeBuf.toString("utf-8");
  }

  async writeToS3(key, content) {
    // Bun's S3Client.write supports many types. :contentReference[oaicite:8]{index=8}
    await this.s3.write(key, content);
  }

  async deleteFromS3(key) {
    // delete (alias unlink) :contentReference[oaicite:9]{index=9}
    await this.s3.delete(key);
    return "Delete operation successful";
  }

  async listFromS3(prefix, options = {}) {
    const { maxKeys, startAfter, metadata_only = false } = options;

    // Call Bun’s list API :contentReference[oaicite:10]{index=10}
    const res = await this.s3.list(
      {
        prefix,
        maxKeys,
        startAfter,
      },
      {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        endpoint: this.endpoint,
        region: this.region,
        bucket: this.bucket,
      }
    );

    const contents = res.contents ?? [];

    if (metadata_only) {
      return contents.map((c) => ({
        key: c.key,
        lastModified: new Date(c.lastModified), // or use c.lastModified string
        size: c.size,
      }));
    }

    const full = await Promise.all(
      contents.map(async (c) => ({
        key: c.key,
        content: await this.readFromS3(c.key),
      }))
    );

    return full;
  }

  async countObjectsInS3(prefix) {
    let count = 0;
    let startAfter;

    while (true) {
      const res = await this.s3.list(
        {
          prefix,
          maxKeys: 1000,
          startAfter,
        },
        {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
          endpoint: this.endpoint,
          region: this.region,
          bucket: this.bucket,
        }
      );
      const contents = res.contents ?? [];
      count += contents.length;

      if (!res.isTruncated || contents.length === 0) break;

      // For next page
      startAfter = contents[contents.length - 1].key;
    }

    return count;
  }

  static in_schema() {
    return {
      operation: { type: "string", required: true, enum: ["read","write","list","count","delete"] },
      path: { type: "string", required: true },
      content: { type: "string", required: false },
      contentType: { type: "string", required: false },
      options: { type: "object", required: false }
    };
  }

  static out_schema() {
    return {
      type: "object",
      properties: {
        status: { type: "number" },
        content: { type: "any" }
      }
    };
  }

  static about() {
    return "S3StorageTool using Bun’s native S3Client";
  }
}

export const s3_storage_tool = S3StorageTool;
