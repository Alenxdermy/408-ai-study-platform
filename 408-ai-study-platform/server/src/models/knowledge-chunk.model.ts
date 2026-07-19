import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class KnowledgeChunkModel extends Model {
  declare id: string;
  declare documentId: string;
  declare userId: string;
  declare chunkIndex: number;
  declare content: string;
  declare tokenCount: number;
  declare vectorId: string;
  declare metadata: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

KnowledgeChunkModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    documentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'knowledge_documents', key: 'id' }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    chunkIndex: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tokenCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    vectorId: {
      type: DataTypes.STRING,
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
    modelName: 'KnowledgeChunk',
    tableName: 'knowledge_chunks',
    indexes: [
      { fields: ['document_id'] },
      { fields: ['user_id'] },
      { fields: ['vector_id'] }
    ]
  }
);
