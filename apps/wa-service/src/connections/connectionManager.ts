import { join } from "node:path";
import type { Logger } from "pino";
import { WhatsAppClient, type WaServiceStatus } from "../baileys/client.js";
import type { AppConfig } from "../config.js";
import {
  listConnectionRegistryRecords,
  upsertConnectionRegistryRecord,
  type ConnectionRegistryRecord,
} from "../services/connectionRegistryStore.js";

export type WaConnectionRecord = {
  connectionId: string;
  businessId: string | null;
  label: string | null;
  autoStart: boolean;
  client: WhatsAppClient;
};

export type WaConnectionSnapshot = {
  connectionId: string;
  businessId: string | null;
  label: string | null;
  autoStart: boolean;
} & WaServiceStatus;

type StatusChangeHandlerFactory = (
  connectionId: string,
  businessId: string | null,
) => (status: WaServiceStatus, reason: string) => void | Promise<void>;

export class ConnectionManager {
  private readonly connections = new Map<string, WaConnectionRecord>();

  constructor(
    private readonly params: {
      baseConfig: AppConfig;
      logger: Logger;
      defaultConnectionId?: string;
      createStatusChangeHandler?: StatusChangeHandlerFactory;
    },
  ) {}

  get defaultConnectionId(): string {
    return this.params.defaultConnectionId ?? "default";
  }

  register(record: WaConnectionRecord): WaConnectionSnapshot {
    this.connections.set(record.connectionId, record);
    return this.toSnapshot(record);
  }

  async loadPersistedConnections(): Promise<WaConnectionSnapshot[]> {
    const records = await listConnectionRegistryRecords(
      this.params.baseConfig.connectionStoreFile,
    );
    const snapshots: WaConnectionSnapshot[] = [];

    for (const record of records) {
      if (record.connectionId === this.defaultConnectionId) {
        continue;
      }

      if (this.connections.has(record.connectionId)) {
        continue;
      }

      const connection = this.createRecordFromRegistry(record);
      this.register(connection);
      if (record.autoStart) {
        await connection.client.connect("startup_connection_auto_start");
      }
      snapshots.push(this.toSnapshot(connection));
    }

    return snapshots;
  }

  async createConnection(params: {
    connectionId: string;
    businessId: string | null;
    label: string | null;
    autoStart?: boolean;
  }): Promise<WaConnectionSnapshot> {
    if (this.connections.has(params.connectionId)) {
      return this.toSnapshot(this.requireConnection(params.connectionId));
    }

    const record = await upsertConnectionRegistryRecord({
      filePath: this.params.baseConfig.connectionStoreFile,
      connectionId: params.connectionId,
      businessId: params.businessId,
      label: params.label,
      autoStart: params.autoStart,
    });

    const connection = this.createRecordFromRegistry(record);
    this.register(connection);
    if (record.autoStart) {
      await connection.client.connect("create_connection_auto_start");
    }

    return this.toSnapshot(connection);
  }

  list(): WaConnectionSnapshot[] {
    return [...this.connections.values()].map((record) =>
      this.toSnapshot(record),
    );
  }

  get(connectionId: string): WaConnectionRecord | null {
    return this.connections.get(connectionId) ?? null;
  }

  getDefaultConnection(): WaConnectionRecord {
    const record = this.get(this.defaultConnectionId);
    if (!record) {
      throw new Error(
        `Default WhatsApp connection "${this.defaultConnectionId}" is not registered`,
      );
    }

    return record;
  }

  getSnapshot(connectionId: string): WaConnectionSnapshot | null {
    const record = this.get(connectionId);
    return record ? this.toSnapshot(record) : null;
  }

  async start(
    connectionId: string,
    reason: string,
  ): Promise<WaConnectionSnapshot> {
    const record = this.requireConnection(connectionId);
    await upsertConnectionRegistryRecord({
      filePath: this.params.baseConfig.connectionStoreFile,
      connectionId: record.connectionId,
      businessId: record.businessId,
      label: record.label,
      autoStart: true,
    });
    record.autoStart = true;
    await record.client.start(reason);
    return this.toSnapshot(record);
  }

  async stop(
    connectionId: string,
    reason: string,
  ): Promise<WaConnectionSnapshot> {
    const record = this.requireConnection(connectionId);
    await upsertConnectionRegistryRecord({
      filePath: this.params.baseConfig.connectionStoreFile,
      connectionId: record.connectionId,
      businessId: record.businessId,
      label: record.label,
      autoStart: false,
    });
    record.autoStart = false;
    await record.client.stop(reason);
    return this.toSnapshot(record);
  }

  async resetSession(
    connectionId: string,
    reason: string,
  ): Promise<WaConnectionSnapshot> {
    const record = this.requireConnection(connectionId);
    await record.client.resetSession(reason);
    return this.toSnapshot(record);
  }

  async sendTextMessage(params: {
    connectionId: string;
    phone: string;
    text: string;
  }): Promise<string> {
    const record = this.requireConnection(params.connectionId);
    return record.client.sendTextMessage({
      phone: params.phone,
      text: params.text,
    });
  }

  getLatestQr(connectionId: string): string | null {
    return this.requireConnection(connectionId).client.getLatestQr();
  }

  private requireConnection(connectionId: string): WaConnectionRecord {
    const record = this.get(connectionId);
    if (!record) {
      throw new Error(`WhatsApp connection "${connectionId}" was not found`);
    }

    return record;
  }

  private toSnapshot(record: WaConnectionRecord): WaConnectionSnapshot {
    return {
      connectionId: record.connectionId,
      businessId: record.businessId,
      label: record.label,
      autoStart: record.autoStart,
      ...record.client.getStatus(),
    };
  }

  private createRecordFromRegistry(
    registryRecord: ConnectionRegistryRecord,
  ): WaConnectionRecord {
    const config = this.createConnectionConfig(registryRecord.connectionId);
    const logger = this.params.logger.child({
      connectionId: registryRecord.connectionId,
      businessId: registryRecord.businessId,
    });
    const client = new WhatsAppClient(config, logger, {
      connectionId: registryRecord.connectionId,
      businessId: registryRecord.businessId,
    });
    const statusHandler = this.params.createStatusChangeHandler?.(
      registryRecord.connectionId,
      registryRecord.businessId,
    );

    if (statusHandler) {
      client.setStatusChangeHandler(statusHandler);
    }

    return {
      connectionId: registryRecord.connectionId,
      businessId: registryRecord.businessId,
      label: registryRecord.label,
      autoStart: registryRecord.autoStart,
      client,
    };
  }

  private createConnectionConfig(connectionId: string): AppConfig {
    const safeConnectionId = encodeURIComponent(connectionId);
    const dataRoot = join(
      this.params.baseConfig.connectionDataRoot,
      safeConnectionId,
    );

    return {
      ...this.params.baseConfig,
      whatsappAuthDir: join(
        this.params.baseConfig.whatsappAuthRoot,
        safeConnectionId,
      ),
      registryStoreFile: join(dataRoot, "registrations.json"),
      inboundContactsStoreFile: join(dataRoot, "inbound-contacts.json"),
      conversationStoreFile: join(dataRoot, "conversations.json"),
      autoresponseTestPhonesFile: join(
        dataRoot,
        "autoresponse-test-phones.json",
      ),
    };
  }
}
