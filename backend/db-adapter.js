// db-adapter.js - Database adapter (DynamoDB only)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DYNAMODB_TABLE = process.env.DYNAMODB_USERS_TABLE || "smartdive-users";

console.log(`[DB Adapter] Initializing DynamoDB: ${DYNAMODB_TABLE}`);

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ===== DynamoDB User Operations =====
const dbOps = {
  // Find user by email (using GSI)
  async getUserByEmail(email) {
    try {
      const command = new QueryCommand({
        TableName: DYNAMODB_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
        Limit: 1,
      });

      const response = await docClient.send(command);
      return response.Items && response.Items.length > 0
        ? response.Items[0]
        : null;
    } catch (error) {
      console.error("[DynamoDB] Failed to query email:", error.message);
      throw error;
    }
  },

  // Find user by ID (email optional)
  async getUserById(userId, email = null) {
    try {
      // If email is not provided, query by userId first
      if (!email) {
        const command = new QueryCommand({
          TableName: DYNAMODB_TABLE,
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          Limit: 1,
          ConsistentRead: true,
        });

        const response = await docClient.send(command);
        return response.Items && response.Items.length > 0
          ? response.Items[0]
          : null;
      }

      // If email is provided, query directly by composite key
      const command = new GetCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          userId: userId,
          email: email,
        },
      });

      const response = await docClient.send(command);
      return response.Item || null;
    } catch (error) {
      console.error("[DynamoDB] Failed to query user ID:", error.message);
      throw error;
    }
  },

  // Create user
  async createUser(userData) {
    try {
      const command = new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: {
          userId: userData.id,
          email: userData.email,
          passwordHash: userData.password,
          username: userData.username || userData.email.split("@")[0],
          createdAt: Math.floor(
            new Date(userData.created_at || new Date()).getTime() / 1000,
          ),
          status: "active",
        },
      });

      await docClient.send(command);

      return {
        id: userData.id,
        email: userData.email,
        username: userData.username,
      };
    } catch (error) {
      console.error("[DynamoDB] Failed to create user:", error.message);
      throw error;
    }
  },

  // Update user
  async updateUser(userId, email, updates) {
    try {
      const updateExpressions = [];
      const expressionValues = {};

      // Map Supabase fields to DynamoDB fields
      const fieldMap = {
        last_login: "lastLogin",
        updated_at: "updatedAt",
        username: "username",
        password: "passwordHash",
      };

      Object.keys(updates).forEach((key) => {
        const dynamoKey = fieldMap[key] || key;
        updateExpressions.push(`${dynamoKey} = :${key}`);

        // Convert timestamp string to Unix timestamp
        if (key === "last_login" || key === "updated_at") {
          expressionValues[`:${key}`] = Math.floor(
            new Date(updates[key]).getTime() / 1000,
          );
        } else {
          expressionValues[`:${key}`] = updates[key];
        }
      });

      expressionValues[":now"] = Math.floor(Date.now() / 1000);
      updateExpressions.push("updatedAt = :now");

      const command = new UpdateCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          userId: userId,
          email: email,
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: "ALL_NEW",
      });

      const response = await docClient.send(command);
      return response.Attributes;
    } catch (error) {
      console.error("[DynamoDB] Failed to update user:", error.message);
      throw error;
    }
  },

  /**
   * Atomically move a user row from (oldUserId, email) to (newItem.userId, email).
   * Used when the same person had a legacy UUID userId and later signs in with Cognito (sub).
   */
  async migrateUserPartitionKey({ oldUserId, email, newItem }) {
    try {
      if (!oldUserId || !email || !newItem?.userId || newItem.email !== email) {
        throw new Error("migrateUserPartitionKey: invalid arguments");
      }
      if (oldUserId === newItem.userId) return;

      const command = new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: DYNAMODB_TABLE,
              Key: { userId: oldUserId, email },
              ConditionExpression:
                "attribute_exists(userId) AND attribute_exists(#e)",
              ExpressionAttributeNames: { "#e": "email" },
            },
          },
          {
            Put: {
              TableName: DYNAMODB_TABLE,
              Item: newItem,
              ConditionExpression:
                "attribute_not_exists(userId) AND attribute_not_exists(#e2)",
              ExpressionAttributeNames: { "#e2": "email" },
            },
          },
        ],
      });

      await docClient.send(command);
    } catch (error) {
      console.error("[DynamoDB] migrateUserPartitionKey failed:", error.message);
      throw error;
    }
  },

  // Delete user
  async deleteUser(userId, email) {
    try {
      const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
      const command = new DeleteCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          userId: userId,
          email: email,
        },
      });

      await docClient.send(command);
      return true;
    } catch (error) {
      console.error("[DynamoDB] Failed to delete user:", error.message);
      throw error;
    }
  },

  // Get all users
  async getAllUsers() {
    try {
      const command = new ScanCommand({
        TableName: DYNAMODB_TABLE,
      });

      const response = await docClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error("[DynamoDB] Failed to scan users:", error.message);
      throw error;
    }
  },
};
class DatabaseAdapter {
  static getOperations() {
    return dbOps;
  }
}

module.exports = DatabaseAdapter;
