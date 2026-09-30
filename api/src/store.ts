import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type BatchWriteCommandInput,
  type BatchWriteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { AuditEntry, Dialplan, NumberSummary, type Rules } from '@dialplan/shared';

// Single-table layout
//
//   pk               sk                  what
//   DID#<number>     RULES               the dialplan for a number (gsi1pk/gsi1sk set)
//   DID#<number>     AUDIT#<iso time>    one entry per change, expires after 30 days
//
//   GSI "gsi1": gsi1pk = TENANT#<tenant id>, gsi1sk = DID#<number>
//   Only RULES items carry these attributes, so the index is sparse: one row
//   per number, which is exactly the "numbers for a tenant" query.

export const AUDIT_RETENTION_DAYS = 30;

export class VersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super(`Someone else changed this dialplan; it is now at version ${currentVersion}`);
  }
}

export interface Store {
  getDialplan(did: string): Promise<Dialplan | undefined>;
  /** Writes the new rules and an audit entry atomically, if `current` is still current. */
  saveRules(current: Dialplan, rules: Rules, changes: string[], now: Date): Promise<Dialplan>;
  listAudit(did: string, limit: number): Promise<AuditEntry[]>;
  listNumbers(tenantId: string): Promise<NumberSummary[]>;
  /** Replaces the dialplan unconditionally and clears its audit log. */
  restore(dialplan: Omit<Dialplan, 'version' | 'updatedAt'>, now: Date): Promise<Dialplan>;
}

const keys = {
  number: (did: string) => `DID#${did}`,
  tenant: (tenantId: string) => `TENANT#${tenantId}`,
  rules: 'RULES',
  auditPrefix: 'AUDIT#',
  audit: (at: string) => `AUDIT#${at}`,
};

export class DynamoStore implements Store {
  private readonly db: DynamoDBDocumentClient;

  constructor(
    private readonly table: string,
    client = new DynamoDBClient({}),
  ) {
    this.db = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async getDialplan(did: string): Promise<Dialplan | undefined> {
    const { Item } = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: keys.number(did), sk: keys.rules },
        // Edits must be visible to the very next call.
        ConsistentRead: true,
      }),
    );
    return Item ? Dialplan.parse(Item) : undefined;
  }

  async saveRules(current: Dialplan, rules: Rules, changes: string[], now: Date): Promise<Dialplan> {
    const next: Dialplan = { ...current, rules, version: current.version + 1, updatedAt: now.toISOString() };
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.table,
                Item: this.rulesItem(next),
                ConditionExpression: 'version = :expected',
                ExpressionAttributeValues: { ':expected': current.version },
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: this.auditItem(next, 'update', changes),
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const latest = await this.getDialplan(current.did);
        throw new VersionConflictError(latest?.version ?? current.version);
      }
      throw error;
    }
    return next;
  }

  async listAudit(did: string, limit: number): Promise<AuditEntry[]> {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': keys.number(did), ':prefix': keys.auditPrefix },
        ProjectionExpression: '#at, #version, #action, #changes',
        ExpressionAttributeNames: { '#at': 'at', '#version': 'version', '#action': 'action', '#changes': 'changes' },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.map((item) => AuditEntry.parse(item));
  }

  async listNumbers(tenantId: string): Promise<NumberSummary[]> {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :tenant',
        ExpressionAttributeValues: { ':tenant': keys.tenant(tenantId) },
      }),
    );
    return Items.map((item) => NumberSummary.parse(item));
  }

  async restore(dialplan: Omit<Dialplan, 'version' | 'updatedAt'>, now: Date): Promise<Dialplan> {
    await this.deleteAudit(dialplan.did);
    // Keep versions increasing across resets, so an editor holding a
    // pre-reset version still gets a conflict instead of a silent overwrite.
    const previous = await this.getDialplan(dialplan.did);
    const next: Dialplan = { ...dialplan, version: (previous?.version ?? 0) + 1, updatedAt: now.toISOString() };
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.table, Item: this.rulesItem(next) } },
          { Put: { TableName: this.table, Item: this.auditItem(next, 'reset', ['Restored the demo dialplan']) } },
        ],
      }),
    );
    return next;
  }

  private async deleteAudit(did: string): Promise<void> {
    let cursor: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: { ':pk': keys.number(did), ':prefix': keys.auditPrefix },
          ProjectionExpression: 'pk, sk',
          ExclusiveStartKey: cursor,
        }),
      );
      const items = page.Items ?? [];
      for (let i = 0; i < items.length; i += 25) {
        await this.batchWrite({
          [this.table]: items.slice(i, i + 25).map((key) => ({ DeleteRequest: { Key: key } })),
        });
      }
      cursor = page.LastEvaluatedKey;
    } while (cursor);
  }

  private async batchWrite(requests: NonNullable<BatchWriteCommandInput['RequestItems']>): Promise<void> {
    let pending: BatchWriteCommandInput['RequestItems'] = requests;
    for (let attempt = 0; pending && Object.keys(pending).length > 0; attempt++) {
      if (attempt === 6) throw new Error('DynamoDB kept returning unprocessed items');
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      const result: BatchWriteCommandOutput = await this.db.send(new BatchWriteCommand({ RequestItems: pending }));
      pending = result.UnprocessedItems;
    }
  }

  private rulesItem(dialplan: Dialplan) {
    return {
      pk: keys.number(dialplan.did),
      sk: keys.rules,
      gsi1pk: keys.tenant(dialplan.tenantId),
      gsi1sk: keys.number(dialplan.did),
      ...dialplan,
    };
  }

  private auditItem(dialplan: Dialplan, action: AuditEntry['action'], changes: string[]) {
    const at = dialplan.updatedAt;
    return {
      pk: keys.number(dialplan.did),
      sk: keys.audit(at),
      at,
      version: dialplan.version,
      action,
      changes,
      rules: dialplan.rules,
      expiresAt: Math.floor(Date.parse(at) / 1000) + AUDIT_RETENTION_DAYS * 86_400,
    };
  }
}
