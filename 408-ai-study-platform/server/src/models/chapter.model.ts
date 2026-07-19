import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class ChapterModel extends Model {
  declare id: string;
  declare subject: string;
  declare title: string;
  declare parentId: string | null;
  declare order: number;
  declare knowledgePoints: string[];
  declare createdAt: Date;
  declare updatedAt: Date;
}

ChapterModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    subject: {
      type: DataTypes.ENUM('data_structure', 'computer_network', 'os', 'computer_organization'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'chapters',
        key: 'id'
      }
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    knowledgePoints: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    }
  },
  {
    sequelize,
    modelName: 'Chapter',
    tableName: 'chapters',
    indexes: [
      { fields: ['subject'] }
    ]
  }
);
