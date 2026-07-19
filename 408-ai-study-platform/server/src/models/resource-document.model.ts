import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class ResourceDocumentModel extends Model {
  declare id: string;
  declare uploaderId: string;
  declare title: string;
  declare description: string;
  declare category: string;
  declare originalName: string;
  declare mimeType: string;
  declare storagePath: string;
  declare size: number;
  declare parseStatus: 'pending' | 'parsed' | 'failed';
  declare parseError: string;
  declare textPreview: string;
  declare wordCount: number;
  declare summary: string;
  declare summaryStatus: 'pending' | 'generated' | 'skipped' | 'failed';
  declare summaryError: string;
  declare parsedAt: Date | null;
  declare summarizedAt: Date | null;
  declare downloadCount: number;
  declare viewCount: number;
  declare status: 'published' | 'hidden';
  declare createdAt: Date;
  declare updatedAt: Date;
}

ResourceDocumentModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    uploaderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    category: {
      type: DataTypes.ENUM('paper', 'answer', 'data_structure', 'computer_network', 'os', 'computer_organization', 'general'),
      allowNull: false,
      defaultValue: 'general'
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
    size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    parseStatus: {
      type: DataTypes.ENUM('pending', 'parsed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    parseError: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    textPreview: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    wordCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    summaryStatus: {
      type: DataTypes.ENUM('pending', 'generated', 'skipped', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    summaryError: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    parsedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    summarizedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('published', 'hidden'),
      allowNull: false,
      defaultValue: 'published'
    }
  },
  {
    sequelize,
    modelName: 'ResourceDocument',
    tableName: 'resource_documents',
    indexes: [
      { fields: ['uploader_id'] },
      { fields: ['category'] },
      { fields: ['parse_status'] },
      { fields: ['summary_status'] },
      { fields: ['status'] }
    ]
  }
);
