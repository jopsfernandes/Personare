import { ipc } from "@/ipc/manager";

export function saveAttachmentImage(sourcePath: string) {
  return ipc.client.attachments.saveImage({ sourcePath });
}

export function getAttachmentImageDataUrl(fileName: string) {
  return ipc.client.attachments.getImageDataUrl({ fileName });
}

export function deleteAttachmentImage(fileName: string) {
  return ipc.client.attachments.deleteImage({ fileName });
}
