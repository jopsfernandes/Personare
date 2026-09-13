import { ZstdCodec, type ZstdSimple } from "zstd-codec";

let simplePromise: Promise<ZstdSimple> | null = null;

function getSimple(): Promise<ZstdSimple> {
  simplePromise ??= new Promise((resolve) => {
    ZstdCodec.run((zstd) => {
      resolve(new zstd.Simple());
    });
  });

  return simplePromise;
}

export async function zstdCompress(data: Uint8Array): Promise<Buffer> {
  const simple = await getSimple();
  const result = simple.compress(data);

  if (!result) {
    throw new Error("Falha ao comprimir dados em zstd");
  }

  return Buffer.from(result);
}

export async function zstdDecompress(data: Uint8Array): Promise<Buffer> {
  const simple = await getSimple();
  const result = simple.decompress(data);

  if (!result) {
    throw new Error("Falha ao descomprimir dados em zstd");
  }

  return Buffer.from(result);
}
