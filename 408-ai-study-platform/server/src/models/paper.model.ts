import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class PaperModel extends Model {
  declare id: string;
  declare title: string;
  declare type: 'real' | 'mock' | 'daily';
  declare year: number;
  declare durationMinutes: number;
  declare questionIds: string[];
  declare totalScore: number;
  declare status: 'draft' | 'published';
  declare createdAt: Date;
  declare updatedAt: Date;
}

PaperModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('real', 'mock', 'daily'),
      allowNull: false,
      defaultValue: 'mock'
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 180
    },
    questionIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    totalScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 150
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'published'
    }
  },
  {
    sequelize,
    modelName: 'Paper',
    tableName: 'papers',
    indexes: [
      { fields: ['type'] },
      { fields: ['year'] }
    ]
  }
);
