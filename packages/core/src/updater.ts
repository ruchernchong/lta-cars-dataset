import fs from "fs/promises";
import * as d3 from "d3";
import { downloadFile } from "./lib/downloadFile";
import { extractZipFile } from "./lib/extractZipFile";
import db from "../../config/db";

const EXTRACT_PATH: string = "/tmp";

interface UpdateParams {
  collectionName: string;
  zipFileName: string;
  zipUrl: string;
}

export const update = async ({
  collectionName,
  zipFileName,
  zipUrl,
}: UpdateParams): Promise<{ message: string }> => {
  try {
    const zipFilePath = `${EXTRACT_PATH}/${zipFileName}`;
    await downloadFile({ url: zipUrl, destination: zipFilePath });

    const extractedFileName = await extractZipFile(zipFilePath, EXTRACT_PATH);
    const destinationPath = `${EXTRACT_PATH}/${extractedFileName}`;
    console.log(`Destination path:`, destinationPath);

    const csvData = await fs.readFile(destinationPath, "utf-8");
    const parsedData = d3.csvParse(csvData);

    const existingData = await db.collection(collectionName).find().toArray();
    const existingDataMap = new Map(
      existingData.map((item) => [item.month, item]),
    );
    const newDataToInsert = parsedData.filter(
      (newItem) => !existingDataMap.has(newItem.month),
    );

    let message: string;
    if (newDataToInsert.length > 0) {
      const result = await db
        .collection(collectionName)
        .insertMany(newDataToInsert);
      message = `${result.insertedCount} document(s) inserted`;
    } else {
      message = `No new data to insert for collection - ${collectionName}. The provided data matches the existing records.`;
    }

    return { message };
  } catch (error) {
    console.error(`An error has occurred:`, error);
    throw error;
  }
};

export * as Updater from "./updater";