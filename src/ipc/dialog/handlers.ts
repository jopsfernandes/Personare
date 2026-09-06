import { os } from "@orpc/server";
import { dialog as electronDialog } from "electron";

export const selectPdfFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: [{ extensions: ["pdf"], name: "PDF" }],
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});
