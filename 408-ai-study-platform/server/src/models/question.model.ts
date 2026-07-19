import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class QuestionModel extends Model {
  declare id: string;
  declare subject: string;
  declare chapterId: string;
  declare type: 'single' | 'multiple' | 'judge' | 'blank' | 'essay';
  declare stem: string;
  declare options: Array<{ key: string; content: string }>;
  declare answer: string | string[];
  declare explanation: string;
  declare difficulty: number;
  declare tags: string[];
  declare source: string;
  declare year: number;
  declare score: number;
  declare status: 'draft' | 'published';
  declare createdAt: Date;
  declare updatedAt: Date;
}

QuestionModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false
    },
    chapterId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'chapters',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('single', 'multiple', 'judge', 'blank', 'essay'),
      allowNull: false
    },
    stem: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    answer: {
      type: DataTypes.JSON,
      allowNull: false
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    difficulty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
      validate: {
        min: 1,
        max: 5
      }
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'published'
    }
  },
  {
    sequelize,
    modelName: 'Question',
    tableName: 'questions',
    indexes: [
      { fields: ['subject'] },
      { fields: ['chapter_id'] },
      { fields: ['difficulty'] },
      { fields: ['year'] },
      { fields: ['status'] }
    ]
  }
);
