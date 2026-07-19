import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class ChatHistoryModel extends Model {
  declare id: string;
  declare userId: string;
  declare sessionId: string;
  declare agent: string;
  declare role: 'user' | 'assistant' | 'system';
  declare content: string;
  declare metadata: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ChatHistoryModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    agent: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  },
  {
    sequelize,
    modelName: 'ChatHistory',
    tableName: 'chat_histories',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['session_id'] },
      { fields: ['agent'] }
    ]
  }
);
