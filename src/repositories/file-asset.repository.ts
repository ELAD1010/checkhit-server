import { DataSource } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { FileAsset } from "../entities/file-asset.js";
import type { StoredFile } from "../storage/local-file-storage.js";

export class FileAssetRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createFromStoredFile(stored: StoredFile): Promise<FileAsset> {
    const repository = this.dataSource.getRepository(FileAsset);
    return repository.save(
      repository.create({
        objectKey: stored.objectKey,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        sizeBytes: String(stored.sizeBytes),
        checksum: stored.checksum,
      }),
    );
  }

  async findById(fileId: string): Promise<FileAsset | null> {
    return this.dataSource.getRepository(FileAsset).findOne({
      where: { id: fileId },
    });
  }

  async deleteById(fileId: string): Promise<void> {
    await this.dataSource.getRepository(FileAsset).delete({ id: fileId });
  }
}
