import { Document, WithId } from "mongodb";
import fs from "fs/promises";
import * as d3 from "d3";
import { downloadFile } from "./utils/downloadFile";
import { extractZipFile } from "./utils/extractZipFile";
import db from "../../config/db";
import { UpdateParams } from "./types";

const EXTRACT_PATH: string = "/tmp";

export const update = async ({
  collectionName,
  zipFileName,
  zipUrl,
  keyFields,
}: UpdateParams): Promise<{ message: string }> => {
  const collection = db.collection<Document>(collectionName);

  try {
    const zipFilePath = `${EXTRACT_PATH}/${zipFileName}`;
    await downloadFile({ url: zipUrl, destination: zipFilePath });

    const extractedFileName = await extractZipFile(zipFilePath, EXTRACT_PATH);
    const destinationPath = `${EXTRACT_PATH}/${extractedFileName}`;
    console.log(`Destination path:`, destinationPath);

    const csvData = await fs.readFile(destinationPath, "utf-8");
    const parsedData = d3.csvParse(csvData);

    const existingData: WithId<Document>[] = await collection.find().toArray();

    const createUniqueKey = <T extends object>(
      item: T,
      keyFields: Array<keyof T>,
    ): string =>
      keyFields
        .filter((field) => item[field])
        .map((field) => item[field])
        .join("-");

    const existingDataMap: Map<string, WithId<Document>> = new Map(
      existingData.map((item) => [createUniqueKey(item, keyFields), item]),
    );
    const newDataToInsert = parsedData.filter(
      (newItem) => !existingDataMap.has(createUniqueKey(newItem, keyFields)),
    );

    let message: string;
    if (newDataToInsert.length > 0) {
      const result = await collection.insertMany(newDataToInsert);
      message = `${result.insertedCount} document(s) inserted`;
    } else {
      message = `No new data to insert. The provided data matches the existing records.`;
    }

    return { message };
  } catch (error) {
    console.error(`An error has occurred:`, error);
    throw error;
  }
};

export * as Updater from "./updater";
