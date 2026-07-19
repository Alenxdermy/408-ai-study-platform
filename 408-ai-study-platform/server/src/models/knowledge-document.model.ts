import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class KnowledgeDocumentModel extends Model {
  declare id: string;
  declare userId: string;
  declare title: string;
  declare originalName: string;
  declare mimeType: string;
  declare storagePath: string;
  declare status: 'uploaded' | 'parsed' | 'embedded' | 'failed';
  declare errorMessage: string;
  declare chunkCount: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

KnowledgeDocumentModel.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    storagePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'parsed', 'embedded', 'failed'),
      allowNull: false,
      defaultValue: 'uploaded'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    chunkCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    sequelize,
    modelName: 'KnowledgeDocument',
    tableName: 'knowledge_documents',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] }
    ]
  }
);
